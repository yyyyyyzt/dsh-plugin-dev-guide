// Three-phase review protocol by a scripted agent (S3c).
//
// DSH does not ship `dsh-llm-mock-server` in this profile. The scripted agent below is the
// deterministic replay allowed by progress.md §7: it calls the same tools in the same order as
// review-protocol.md §4, records every call, and simulates the two `ask_user_question` moments
// (reviewer identity, issue batches) without a model.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createReviewTools, type ToolIo } from '../../src/host/tools.js'
import type { ReviewConfig } from '../../src/host/config.js'
import { prefix } from '../../src/persona.js'
import { bundledSkill, SKILL_NAME } from '../../src/host/skills.js'
import { readFixture, rulesDir } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'

interface Call {
  name: string
  args: Record<string, any>
}

interface ProtocolRig extends OpenedStore {
  tools: Map<string, ToolDefinition>
  calls: Call[]
  writes: { fileName: string; content: string }[]
  call<T = any>(name: string, args: Record<string, unknown>): Promise<T>
  code(name: string, args: Record<string, unknown>): Promise<string>
}

const fakeExec = { signal: new AbortController().signal } as unknown as ToolRunContext
const rigs: ProtocolRig[] = []

afterEach(async () => {
  for (const r of rigs.splice(0)) {
    await r.close()
    await removeRoot(r.root)
  }
})

async function rig(overrides: Partial<ReviewConfig> = {}): Promise<ProtocolRig> {
  const opened = await openStore(overrides)
  const writes: ProtocolRig['writes'] = []
  const io: ToolIo = {
    async readText(path) {
      return readFileSync(join(rulesDir, '..', 'tests', 'fixtures', path), 'utf8')
    },
    async writeOpinion(fileName, content) {
      writes.push({ fileName, content })
      return `reviews/${fileName}`
    },
  }
  const tools = new Map(createReviewTools(opened.store, io).map((t) => [t.name, t]))
  const calls: Call[] = []
  const r: ProtocolRig = {
    ...opened,
    tools,
    calls,
    writes,
    async call(name, args) {
      const tool = tools.get(name)
      if (!tool) throw new Error(`no tool ${name}`)
      calls.push({ name, args: args as Record<string, any> })
      return (await tool.execute(args, fakeExec)) as never
    },
    async code(name, args) {
      try {
        await r.call(name, args)
      } catch (e) {
        return (e as { code?: string }).code ?? 'ERROR'
      }
      return 'OK'
    },
  }
  rigs.push(r)
  return r
}

const seed = (): string => readFixture('seed.md')

async function parseAndCheck(r: ProtocolRig): Promise<{ reviewId: string; check: any }> {
  const parse = await r.call('review_parse', { source: { kind: 'inline', value: seed() } })
  const check = await r.call('review_check', { reviewId: parse.reviewId })
  return { reviewId: parse.reviewId, check }
}

const severityRank: Record<string, number> = { blocker: 0, major: 1, minor: 2 }

interface Question {
  issueId: string
  question: string
  detail: string
  options: string[]
  status: string
}

interface Batch {
  header: string
  questions: Question[]
}

function reviewBatches(issues: any[], size = 5): Batch[] {
  const sorted = [...issues].sort((a, b) => {
    const ap = a.status === 'pending' ? 1 : 0
    const bp = b.status === 'pending' ? 1 : 0
    if (ap !== bp) return ap - bp
    return (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || a.seq - b.seq
  })
  const chunks: any[][] = []
  for (let i = 0; i < sorted.length; i += size) chunks.push(sorted.slice(i, i + size))
  return chunks.map((chunk, i) => ({
    header: `复核 第 ${i + 1}/${chunks.length} 批`,
    questions: chunk.map((issue) => ({
      issueId: issue.issueId,
      question: `${issue.ruleId} ${issue.title}（${issue.severity}）`,
      detail: `发现：${issue.finding}\n证据：${issue.evidence.length ? issue.evidence.map((e: any) => e.kind === 'absence' ? `absence·非引文（${e.quote}）` : `「${e.quote}」`).join('；') : '无'}\n建议：${issue.suggestion}`,
      options: issue.status === 'pending' ? ['确认为问题', '不是问题'] : ['采纳（推荐）', '驳回', '改写'],
      status: issue.status,
    })),
  }))
}

/** Simulate the ask_user_question reviewer prompt; returns the answer or null when cancelled. */
function askReviewer(answer: string | null): string | null {
  return answer
}

async function recordAllCandidates(r: ProtocolRig, reviewId: string, check: any): Promise<void> {
  for (const candidate of check.hybridCandidates) {
    const quote = candidate.snippets.map((s: any) => s.quote.trim()).sort((a: string, b: string) => b.length - a.length)[0]!.slice(0, 80)
    await r.call('memory_recall', { ruleId: candidate.ruleId })
    const out = await r.call('review_record_issue', {
      reviewId,
      ruleId: candidate.ruleId,
      finding: `未满足：${candidate.title}`,
      suggestion: `建议补充${candidate.title}相关说明`,
      evidence: [{ quote }],
    })
    if (out.status !== 'confirmed') throw new Error(`${candidate.ruleId} not confirmed: ${out.gate.reasons}`)
  }
  // One pending item: INT-005 has no candidate snippets in this seed, so a real quote is
  // outside the candidate set and the gate deliberately keeps it as 待人工.
  const pending = await r.call('review_record_issue', {
    reviewId,
    ruleId: 'INT-005',
    finding: '异步推送缺少幂等与重试说明',
    suggestion: '建议明确接口幂等与重试策略',
    evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
  })
  if (pending.status !== 'pending') throw new Error('expected pending INT-005')
}

async function canonical(): Promise<{
  r: ProtocolRig
  reviewId: string
  check: any
  before: any
  batches: Batch[]
}> {
  const r = await rig()
  const { reviewId, check } = await parseAndCheck(r)
  await recordAllCandidates(r, reviewId, check)
  const before = await r.call('review_status', { reviewId })
  if (before.issues.length !== 11) throw new Error(`expected 11 issues, got ${before.issues.length}`)
  return { r, reviewId, check, before, batches: reviewBatches(before.issues, 5) }
}

function writesPath(r: ProtocolRig, reviewId: string): string {
  return `reviews/${reviewId}.md`
}

async function runCanonical(): Promise<{ r: ProtocolRig; reviewId: string; check: any; before: any; final: any; verdict: string }> {
  const { r, reviewId, check, before } = await canonical()
  const ordered = reviewBatches(before.issues, 5).flatMap((b) => b.questions)
  const rejectId = ordered[0]!.issueId
  const rewriteId = ordered[1]!.issueId
  const adoptIds = ordered.slice(2).map((q) => q.issueId)

  for (const batch of reviewBatches(before.issues, 5)) {
    expect(batch.questions.length).toBeLessThanOrEqual(5)
    for (const q of batch.questions) {
      if (q.issueId === rejectId) {
        await r.call('review_decide', { reviewId, issueId: q.issueId, answer: '驳回', reason: '该风险由平台统一控制' })
      } else if (q.issueId === rewriteId) {
        await r.call('review_decide', { reviewId, issueId: q.issueId, answer: '改成：建议补充压测报告与回滚方案' })
      } else if (q.status === 'pending') {
        await r.call('review_decide', { reviewId, issueId: q.issueId, answer: '确认为问题' })
      } else {
        await r.call('review_decide', { reviewId, issueId: q.issueId, answer: '采纳（推荐）' })
      }
    }
  }
  expect(adoptIds.length).toBe(9)

  // Expert adds one new opinion after the batches.
  await r.call('review_decide', { reviewId, action: 'add', text: '补充幂等与重试策略', ruleId: 'INT-005' })

  // Reviewer identity (simulated ask_user_question) then the recommended verdict.
  expect(askReviewer('张三')).toBe('张三')
  await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
  const after = await r.call('review_status', { reviewId })
  const recommended = after.aiVerdict
  const options = [recommended, ...['通过', '建议整改', '不通过'].filter((v) => v !== recommended)]
  expect(options[0]).toBe(recommended)
  const final = await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: recommended })
  const finalized = await r.call('review_finalize', { reviewId })
  return { r, reviewId, check, before, final: finalized, verdict: final.finalVerdict }
}

describe('skill & persona wiring (T-PRO-01, T-PRO-10)', () => {
  it('SKILL.md is bundled under the expected name and renders < 8192 chars', () => {
    const skill = bundledSkill()
    expect(skill.name).toBe(SKILL_NAME)
    expect(skill.content.length).toBeLessThan(8192)
    expect(skill.content).toContain('## 阶段一：预审')
    expect(skill.content).toContain('review_finalize')
  })

  it('persona text equals review-protocol.md §2', () => {
    const doc = readFileSync(join(rulesDir, '..', 'docs', 'review-protocol.md'), 'utf8')
    const match = /## 2\. persona[\s\S]*?```\n([\s\S]*?)```/u.exec(doc)
    expect(match?.[1]?.trim()).toBe(prefix.trim())
  })
})

describe('canonical path on the seed solution (T-PRO-02, T-REQ-20, AC-10)', () => {
  it('replays parse → check → memory/record → status → batches → decide → finalize', async () => {
    const { r, reviewId } = await runCanonical()
    const names = r.calls.map((c) => c.name)
    expect(names[0]).toBe('review_parse')
    expect(names[1]).toBe('review_check')
    expect(names.filter((n) => n === 'memory_recall')).toHaveLength(7)
    expect(names.filter((n) => n === 'review_record_issue')).toHaveLength(8)
    expect(names.filter((n) => n === 'review_decide')).toHaveLength(14)
    expect(names.at(-1)).toBe('review_finalize')

    // Parameter snapshot: source, reviewId, candidate rule ids, and the first decisions.
    expect(r.calls[0]!.args).toEqual({ source: { kind: 'inline', value: seed() } })
    expect(r.calls[1]!.args).toEqual({ reviewId })
    const recorded = r.calls.filter((c) => c.name === 'review_record_issue').map((c) => c.args.ruleId)
    expect(recorded).toEqual(['CAP-003', 'SEC-001', 'SEC-002', 'SEC-003', 'SEC-004', 'INT-002', 'INT-003', 'INT-005'])
    const answers = r.calls.filter((c) => c.name === 'review_decide' && typeof c.args.answer === 'string').map((c) => c.args.answer)
    expect(answers.slice(0, 2)).toEqual(['驳回', '改成：建议补充压测报告与回滚方案'])

    expect(r.writes).toHaveLength(1)
    expect(writesPath(r, reviewId)).toBe(`reviews/${r.writes[0]!.fileName}`)
    expect(r.writes[0]!.fileName).toBe(`${reviewId}.md`)
    expect(r.writes[0]!.content).toContain('# 技术方案预审意见')
    expect(r.writes[0]!.content).toContain('| 审核 | 张三 |')
    const normalize = (text: string) => text
      .replace(/rv_\d{8}_[a-z2-7]{6}/g, '{{reviewId}}')
      .replace(/\d{4}-\d{2}-\d{2}/g, '{{date}}')
      .trimEnd()
    expect(normalize(r.writes[0]!.content)).toBe(readFixture('expected/opinion-seed.md').trimEnd())
  })
})

describe('review batches (T-REQ-11, T-PRO-03)', () => {
  it('11 issues → 3 ask batches sized 5 / 5 / 1 with the right options', async () => {
    const { before, batches } = await canonical()
    expect(before.issues).toHaveLength(11)
    expect(batches.map((b) => b.questions.length)).toEqual([5, 5, 1])
    for (const batch of batches) {
      for (const q of batch.questions) {
        if (q.status === 'pending') {
          expect(q.options).toEqual(['确认为问题', '不是问题'])
          expect(q.detail).toContain('证据：')
        } else {
          expect(q.options).toEqual(['采纳（推荐）', '驳回', '改写'])
        }
      }
    }
  })
})

describe('reviewer identity (T-PRO-06)', () => {
  it('without defaultReviewer the flow asks once; with it no ask and reviewer is filled', async () => {
    const noDefault = await rig()
    const missing = await parseAndCheck(noDefault)
    expect(missing.check).toBeTruthy()
    expect(await noDefault.code('review_decide', {
      reviewId: missing.reviewId, action: 'set_final_verdict', finalVerdict: '建议整改',
    })).toBe('REVIEWER_REQUIRED')

    const withDefault = await rig({ defaultReviewer: '李四' })
    const { reviewId } = await parseAndCheck(withDefault)
    expect(await withDefault.code('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })).toBe('OK')
    expect(withDefault.store.domain.table('reviews').get(reviewId)?.reviewer).toBe('李四')
  })
})

describe('final verdict recommendation (T-PRO-07)', () => {
  it('recommended option equals computeVerdict over post-review issue statuses', async () => {
    const { r, reviewId, before } = await runCanonical()
    const after = await r.call('review_status', { reviewId })
    expect(after.finalVerdict).toBe(after.aiVerdict)
    expect(['通过', '建议整改', '不通过']).toContain(after.aiVerdict)
    expect(before.issues).toHaveLength(11)
    expect(r.store.domain.table('reviews').get(reviewId)?.verdictDelta).toBeUndefined()
  })

  it('expert choosing a different verdict records verdictDelta', async () => {
    const { r, reviewId, before } = await runCanonical()
    const after = await r.call('review_status', { reviewId })
    const different = after.aiVerdict === '通过' ? '不通过' : '通过'
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: different })
    const rec = r.store.domain.table('reviews').get(reviewId)!
    expect(rec.verdictDelta).toEqual({ ai: after.aiVerdict, final: different })
    expect(before.issues.length).toBe(11)
  })
})

describe('failure paths (T-PRO-09)', () => {
  it('QUOTE_NOT_FOUND → one corrected retry → confirmed', async () => {
    const r = await rig()
    const { reviewId, check } = await parseAndCheck(r)
    const cand = check.hybridCandidates[0]
    const bad = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's',
      evidence: [{ quote: '这段引文不在方案原文里且长度足够' }],
    })
    expect(bad.gate.reasons).toContain('QUOTE_NOT_FOUND')
    const good = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's',
      evidence: [{ quote: cand.snippets[0].quote.slice(0, 40) }],
    })
    expect(good.status).toBe('confirmed')
    expect(good.gate).toEqual({ passed: true, reasons: [] })
  })

  it('cancelled ask_user_question writes no decision and leaves the review open', async () => {
    const r = await rig()
    const { reviewId } = await parseAndCheck(r)
    const answer = askReviewer(null)
    if (answer !== null) throw new Error('simulated cancellation returned an answer')
    const status = await r.call('review_status', { reviewId })
    expect(status.status).toBe('open')
    expect(r.store.feedbackOf(reviewId)).toHaveLength(0)
  })

  it('re-pasting the same solution surfaces existingReviewId; reuse=false creates a new review', async () => {
    const r = await rig()
    const first = await r.call('review_parse', { source: { kind: 'inline', value: seed() } })
    const second = await r.call('review_parse', { source: { kind: 'inline', value: seed() } })
    expect(second.existingReviewId).toBe(first.reviewId)
    const fresh = await r.call('review_parse', { source: { kind: 'inline', value: seed() }, reuse: false })
    expect(fresh.reviewId).not.toBe(first.reviewId)
  })

  it('skip-review requests are refused by the skill; two-step fast path is documented', () => {
    const skill = bundledSkill().content
    expect(skill).toContain('跳过复核直接出意见')
    expect(skill).toContain('两步快速路径')
  })
})
