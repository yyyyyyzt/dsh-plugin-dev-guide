// Baselines and ablation runner (T-EVA-08), eval_runs records (T-EVA-09).
import { describe, expect, it } from 'vitest'
import { check, parseMarkdown } from '../../src/engine/index.js'
import {
  ABLATIONS,
  b0Keywords,
  flagJudge,
  generateSyntheticSet,
  llmJudge,
  runAblation,
  runB0,
  runConfiguration,
  summarize,
  toDataset,
  type Adapter,
} from '../../src/eval/index.js'
import { EvalRunRecordSchema } from '../../src/store/domain.js'
import { sectionsDoc, shippedPack } from '../helpers.js'

const pack = shippedPack()
const cfg = { minorThreshold: 3 }
const full = toDataset(generateSyntheticSet(pack, { seed: 20261029, minorThreshold: 3 }))
const small = { ...full, solutions: full.solutions.slice(0, 12) }

const hollow = sectionsDoc({
  工作背景: '为探索对外开放能力，建设第三方渠道接入。'.repeat(2),
  技术思路及实现方式: '网关转发。',
  数据规划: '数据增长估算：业务量待定。',
  实施方案: '压测方案：待定。',
  资源评估: '资源评估：待定。',
  风险评估: '风险评估：待定。',
  附件: '附件 1：接口文档。',
})

describe('B0 keyword baseline (T-EVA-08)', () => {
  it('derives 3–5 substrings per verifiable rule from the pack', () => {
    const kw = b0Keywords(pack)
    for (const r of pack.rules.filter((r) => r.tier !== 'soft')) {
      expect(kw[r.id], r.id).toBeDefined()
      expect(kw[r.id]!.length).toBeGreaterThanOrEqual(3)
      expect(kw[r.id]!.length).toBeLessThanOrEqual(5)
    }
    expect(kw['CAP-004']).toBeUndefined()
  })

  it('passes 「关键词在但内容空」 phrases (reproduces the legacy defect) where the verifier fails', () => {
    const b0 = runB0(hollow.source, pack, cfg)
    expect(b0.issues.map((i) => i.ruleId)).not.toContain('CAP-006')
    expect(b0.issues.map((i) => i.ruleId)).not.toContain('CAP-002')
    const report = check(hollow, pack.rules, pack.lexicon)
    expect(report.hardIssues.map((i) => i.ruleId)).toContain('CAP-006')
  })

  it('ignores negation: 「不做压测」 counts as satisfied for B0 but fails the verifier', () => {
    const negated = sectionsDoc({
      工作背景: '背景说明足够长，用于通过章节字数要求的文本。',
      技术思路及实现方式: '网关转发。',
      数据规划: '日均请求量 10 万次。',
      实施方案: '本期不做压测，直接上线。',
      资源评估: '现有 4 个实例。',
      风险评估: '已评估。',
      附件: '附件 1：接口文档。',
    })
    expect(runB0(negated.source, pack, cfg).issues.map((i) => i.ruleId)).not.toContain('CAP-002')
    expect(check(negated, pack.rules, pack.lexicon).hardIssues.map((i) => i.ruleId)).toContain('CAP-002')
  })

  it('verdict is the shared policy over keyword-missing rules', () => {
    const b0 = runB0('# 空方案\n\n## 一、工作背景\n\n无。\n', pack, cfg)
    expect(b0.verdict).toBe('不通过')
    expect(b0.issues.some((i) => i.severity === 'blocker')).toBe(true)
  })
})

function fakeAdapter(answer: unknown, calls: unknown[][] = []): Adapter {
  return {
    model: 'fake-model-1',
    async complete(messages) {
      calls.push(messages as unknown[])
      return JSON.stringify(answer)
    },
  }
}

describe('ablation runner (T-EVA-08, T-EVA-09)', () => {
  it('lists the seven configurations of evaluation.md §5', () => {
    expect([...ABLATIONS]).toEqual(['B0', 'B1', 'S-full', 'S-gate', 'S-verifier', 'S-policy', 'S-memory'])
  })

  it('without an LLM adapter runs B0 / S-full / S-verifier and marks the LLM-only configurations skipped', async () => {
    const { runs, skipped } = await runAblation({ dataset: small, pack, cfg, repetitions: 1, judge: flagJudge })
    expect(runs.map((r) => (r.config as { ablation: string }).ablation)).toEqual(['B0', 'S-full', 'S-verifier'])
    expect(skipped.map((s) => s.ablation).sort()).toEqual(['B1', 'S-gate', 'S-memory', 'S-policy'])
    for (const s of skipped.filter((s) => s.ablation !== 'S-memory')) expect(s.reason).toMatch(/adapter/)
    expect(skipped.find((s) => s.ablation === 'S-memory')!.reason).toMatch(/online/i)
  })

  it('S-full record (flag judge) carries complete fields and validates against EvalRunRecordSchema', async () => {
    const run = await runConfiguration({ ablation: 'S-full', dataset: small, pack, cfg, judge: flagJudge, repetition: 1 })
    expect(() => EvalRunRecordSchema.parse(run)).not.toThrow()
    expect(run.runId).toMatch(/^S-full_/)
    expect(run.dataset).toBe(small.id)
    expect(run.config).toMatchObject({
      ablation: 'S-full',
      judge: 'flag',
      model: 'none',
      repetition: 1,
      rulePackVersion: `${pack.pack.id}@${pack.pack.version}`,
      minorThreshold: 3,
    })
    expect(typeof (run.config as { promptHash: string }).promptHash).toBe('string')
    expect((run.config as { promptHash: string }).promptHash).toMatch(/^[0-9a-f]{12}$/)
    for (const key of [
      'precision',
      'recall',
      'f1',
      'weightedRecall',
      'verdictAccuracy',
      'verdictMacroF1',
      'kappa',
      'kappaQuadratic',
      'evidenceValidity',
      'pendingCoverage',
    ]) {
      expect(typeof run.metrics[key], key).toBe('number')
    }
    expect(run.metrics['confusion']).toBeDefined()
    expect(run.metrics['gateReasons']).toBeDefined()
    expect(run.metrics['perTier']).toBeDefined()
    expect(run.perSolution).toHaveLength(small.solutions.length)
    expect(run.perSolution[0]).toMatchObject({ id: small.solutions[0]!.id })
    expect(run.perRule.length).toBeGreaterThan(0)
    expect(run.perRule[0]).toHaveProperty('ruleId')
    expect(run.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('deterministic configurations are byte-identical across repetitions (apart from runId / repetition / at)', async () => {
    const strip = (r: Awaited<ReturnType<typeof runConfiguration>>) => {
      const { runId: _id, at: _at, config, ...rest } = r
      const { repetition: _rep, ...c } = config as unknown as Record<string, unknown>
      return { ...rest, config: c }
    }
    const a = await runConfiguration({ ablation: 'B0', dataset: small, pack, cfg, judge: flagJudge, repetition: 0 })
    const b = await runConfiguration({ ablation: 'B0', dataset: small, pack, cfg, judge: flagJudge, repetition: 1 })
    expect(strip(a)).toEqual(strip(b))
  })

  it('S-verifier removes section scoping from hybrid statement rules but keeps hard rules', async () => {
    const run = await runConfiguration({ ablation: 'S-verifier', dataset: small, pack, cfg, judge: flagJudge, repetition: 0 })
    expect((run.config as { ablation: string }).ablation).toBe('S-verifier')
    const hardRules = new Set(pack.rules.filter((r) => r.tier === 'hard').map((r) => r.id))
    const perRule = run.perRule as { ruleId: string; tier: string }[]
    expect(perRule.some((p) => hardRules.has(p.ruleId))).toBe(true)
  })

  it('B1 with an injected adapter takes issues and verdict verbatim, bypassing verifier / gate / policy', async () => {
    const calls: unknown[][] = []
    const adapter = fakeAdapter(
      { issues: [{ ruleId: 'CAP-002', quote: '这句话并不在原文里', finding: '无压测' }], verdict: '不通过' },
      calls,
    )
    const run = await runConfiguration({ ablation: 'B1', dataset: small, pack, cfg, judge: llmJudge(adapter), repetition: 0 })
    expect(calls).toHaveLength(small.solutions.length)
    expect((run.config as { model: string }).model).toBe('fake-model-1')
    expect((run.config as { judge: string }).judge).toBe('llm')
    const per = run.perSolution as { predicted: string[]; predictedVerdict: string }[]
    expect(per.every((p) => p.predicted.includes('CAP-002'))).toBe(true)
    expect(per.every((p) => p.predictedVerdict === '不通过')).toBe(true)
    expect(run.metrics['evidenceValidity']).toBe(1)
  })

  it('S-gate with an adapter whose quotes are fabricated counts them anyway, while S-full rejects them', async () => {
    const adapter = fakeAdapter({ issue: true, quote: '这句话并不在原文里', finding: '问题' })
    const gated = await runConfiguration({ ablation: 'S-full', dataset: small, pack, cfg, judge: llmJudge(adapter), repetition: 0 })
    const open = await runConfiguration({ ablation: 'S-gate', dataset: small, pack, cfg, judge: llmJudge(adapter), repetition: 0 })
    expect(gated.metrics['evidenceValidity']).toBe(0)
    const hybridIn = (r: typeof gated) =>
      (r.perSolution as { predictedTiers: Record<string, string> }[]).flatMap((p) => Object.values(p.predictedTiers)).filter((t) => t === 'hybrid').length
    expect(hybridIn(gated)).toBe(0)
    expect(hybridIn(open)).toBeGreaterThan(0)
    const reasons = gated.metrics['gateReasons'] as Record<string, number>
    expect(reasons['QUOTE_NOT_FOUND']).toBeGreaterThan(0)
  })

  it('S-policy keeps the issue set but takes the verdict from the adapter', async () => {
    const adapter = fakeAdapter({ issue: false, verdict: '通过' })
    const run = await runConfiguration({ ablation: 'S-policy', dataset: small, pack, cfg, judge: llmJudge(adapter), repetition: 0 })
    const per = run.perSolution as { predictedVerdict: string }[]
    expect(per.every((p) => p.predictedVerdict === '通过')).toBe(true)
  })

  it('summarize renders one row per configuration with CI and marks skipped ones', async () => {
    const { runs, skipped } = await runAblation({ dataset: small, pack, cfg, repetitions: 2, judge: flagJudge })
    const md = summarize(runs, skipped, { baseline: 'B0', reference: 'S-full' })
    expect(md).toContain('| B0 |')
    expect(md).toContain('| S-full |')
    expect(md).toMatch(/B1.*skipped/)
    expect(md).toMatch(/\[\d\.\d{3}, \d\.\d{3}\]/)
    expect(md).toMatch(/Wilcoxon|McNemar/)
  })
})

describe('parseMarkdown sanity for ablation fixtures', () => {
  it('hollow fixture parses with seven sections', () => {
    expect(parseMarkdown(hollow.source).headings[0]!.children.length).toBe(7)
  })
})
