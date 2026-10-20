// Tool layer: the nine defineTool handlers over a real ReviewStore (JSON backend in a temp dir).
// File IO is injected (ToolIo) so the specs can assert ctx.fs usage without a FileSystem service.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createReviewTools, type ToolIo } from '../../src/host/tools.js'
import { ReviewToolError } from '../../src/host/errors.js'
import { normalizeAnswer } from '../../src/host/store.js'
import type { ReviewConfig } from '../../src/host/config.js'
import { readFixture, fixturesDir } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'
import { join } from 'node:path'

interface Rig extends OpenedStore {
  tools: Map<string, ToolDefinition>
  reads: string[]
  writes: { fileName: string; content: string }[]
  failWrite: boolean
  call<T = any>(name: string, args: Record<string, unknown>): Promise<T>
  code(name: string, args: Record<string, unknown>): Promise<string>
}

const rigs: Rig[] = []
afterEach(async () => {
  for (const r of rigs.splice(0)) {
    await r.close()
    await removeRoot(r.root)
  }
})

const fakeExec = { signal: new AbortController().signal } as unknown as ToolRunContext

async function rig(overrides: Partial<ReviewConfig> = {}): Promise<Rig> {
  const opened = await openStore(overrides)
  const reads: string[] = []
  const writes: Rig['writes'] = []
  const state = { failWrite: false }
  const io: ToolIo = {
    async readText(path) {
      reads.push(path)
      // Paths are logical: resolve against fixtures without touching node:fs for the real path.
      return readFileSync(join(fixturesDir, path.replace(/^virtual:\/\//, '')), 'utf8')
    },
    async writeOpinion(fileName, content) {
      if (state.failWrite) throw new Error('disk full')
      writes.push({ fileName, content })
      return `reviews/${fileName}`
    },
  }
  const tools = new Map(createReviewTools(opened.store, io).map((t) => [t.name, t]))
  const r: Rig = {
    ...opened,
    tools,
    reads,
    writes,
    get failWrite() {
      return state.failWrite
    },
    set failWrite(v: boolean) {
      state.failWrite = v
    },
    async call(name, args) {
      const tool = tools.get(name)
      if (!tool) throw new Error(`no tool ${name}`)
      return (await tool.execute(args, fakeExec)) as never
    },
    async code(name, args) {
      try {
        await r.call(name, args)
      } catch (e) {
        if (e instanceof ReviewToolError) return e.code
        throw e
      }
      return 'OK'
    },
  }
  rigs.push(r)
  return r
}

async function parsed(r: Rig, fixture = 'seed.md'): Promise<string> {
  const out = await r.call('review_parse', { source: { kind: 'inline', value: readFixture(fixture) } })
  return out.reviewId as string
}

async function checked(r: Rig, fixture = 'seed.md'): Promise<{ reviewId: string; check: any }> {
  const reviewId = await parsed(r, fixture)
  const check = await r.call('review_check', { reviewId })
  return { reviewId, check }
}

describe('tool catalogue', () => {
  it('registers the nine tools of design.md §8 with suggest-only wording', async () => {
    const r = await rig()
    expect([...r.tools.keys()].sort()).toEqual(
      ['memory_recall', 'review_check', 'review_decide', 'review_finalize', 'review_parse', 'review_record_issue', 'review_status', 'rules_list', 'rules_propose'],
    )
    for (const tool of r.tools.values()) expect(tool.description).toContain('专家')
  })
})

describe('review_parse (T-REQ-02, T-REQ-03)', () => {
  it('inline source under maxSourceBytes (200 KB) → reviewId + outline + stats', async () => {
    const r = await rig()
    const out = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') } })
    expect(out.reviewId).toMatch(/^rv_\d{8}_[a-z2-7]{6}$/)
    expect(out.title).toBe('网上国网余额查询能力对AI版支付宝开放技术方案')
    expect(out.outline.length).toBeGreaterThan(5)
    expect(out.stats.headings).toBeGreaterThan(5)
    expect(Array.isArray(out.warnings)).toBe(true)
    expect(r.store.domain.table('reviews').get(out.reviewId)?.status).toBe('open')
  })

  it('inline source over maxSourceBytes → ReviewToolError SOURCE_TOO_LARGE, nothing written', async () => {
    const r = await rig({ maxSourceBytes: 1024 })
    expect(await r.code('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') } })).toBe('SOURCE_TOO_LARGE')
    expect(r.store.domain.table('reviews').size).toBe(0)
  })

  it('path source is read through ctx.fs, not node:fs', async () => {
    const r = await rig()
    const out = await r.call('review_parse', { source: { kind: 'path', value: 'virtual://seed.md' } })
    expect(r.reads).toEqual(['virtual://seed.md'])
    expect(r.store.domain.table('reviews').get(out.reviewId)?.sourcePath).toBe('virtual://seed.md')
  })

  it('same docHash without reuse → returns existingReviewId and does not create a second review', async () => {
    const r = await rig()
    const first = await parsed(r)
    const again = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') } })
    expect(again.existingReviewId).toBe(first)
    expect(again.reviewId).toBe(first)
    expect(r.store.domain.table('reviews').size).toBe(1)
  })

  it('same docHash with reuse=false → creates a new reviewId and keeps the old record', async () => {
    const r = await rig()
    const first = await parsed(r)
    const again = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') }, reuse: false })
    expect(again.reviewId).not.toBe(first)
    expect(r.store.domain.table('reviews').size).toBe(2)
    expect(r.store.domain.table('reviews').get(first)).toBeDefined()
  })

  it('reviewId format rv_<yyyymmdd>_<base32-6>', async () => {
    const r = await rig()
    expect(await parsed(r)).toMatch(/^rv_20261019_[a-z2-7]{6}$/)
  })

  it('warns when a sequence diagram is only an image', async () => {
    const r = await rig()
    const out = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') } })
    expect(out.warnings.some((w: string) => w.includes('图片'))).toBe(true)
  })
})

describe('review_check (T-REQ-06)', () => {
  it('persists hard/hybrid auto-fail issues with origin verifier and updates reviews.aiVerdict', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    expect(check.hardIssues.length).toBeGreaterThan(0)
    const stored = r.store.issuesOf(reviewId)
    expect(stored.length).toBe(check.hardIssues.length)
    expect(stored.every((i) => i.origin === 'verifier' && i.status === 'confirmed')).toBe(true)
    expect(r.store.domain.table('reviews').get(reviewId)?.aiVerdict).toBe(check.aiVerdict)
    expect(check.aiVerdict).toBe('不通过')
  })

  it('returns hybridCandidates with snippets and softRules with questions; neither is persisted as an issue', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    expect(check.hybridCandidates.length).toBeGreaterThan(0)
    for (const c of check.hybridCandidates) {
      expect(c.snippets.length).toBeGreaterThan(0)
      expect(c.snippets[0]).toMatchObject({ quote: expect.any(String), sectionPath: expect.any(String) })
    }
    expect(check.softRules.length).toBeGreaterThan(0)
    expect(check.softRules[0].question).toBeTruthy()
    const persisted = new Set(r.store.issuesOf(reviewId).map((i) => i.ruleId))
    for (const c of check.hybridCandidates) expect(persisted.has(c.ruleId)).toBe(false)
    for (const s of check.softRules) expect(persisted.has(s.ruleId)).toBe(false)
  })

  it('re-running check on the same review replaces verifier-origin issues instead of duplicating them', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    await r.call('review_check', { reviewId })
    expect(r.store.issuesOf(reviewId).length).toBe(check.hardIssues.length)
  })

  it('unknown reviewId → REVIEW_NOT_FOUND', async () => {
    const r = await rig()
    expect(await r.code('review_check', { reviewId: 'rv_20261019_zzzzzz' })).toBe('REVIEW_NOT_FOUND')
  })
})

describe('review_record_issue (T-REQ-07, T-RUL-09)', () => {
  async function candidate(r: Rig) {
    const { reviewId, check } = await checked(r)
    const cand = check.hybridCandidates.find((c: any) => c.ruleId === 'INT-002') ?? check.hybridCandidates[0]
    return { reviewId, cand }
  }

  it('hybrid quote inside a candidate → status confirmed, gate.passed true, resolvedEvidence with range', async () => {
    const r = await rig()
    const { reviewId, cand } = await candidate(r)
    const quote = cand.snippets[0].quote.slice(0, 40)
    const out = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: '未说明', suggestion: '建议补充', evidence: [{ quote }],
    })
    expect(out.status).toBe('confirmed')
    expect(out.gate).toEqual({ passed: true, reasons: [] })
    expect(out.resolvedEvidence[0].range.start.line).toBeGreaterThan(0)
    expect(out.resolvedEvidence[0].sectionPath).toBeTruthy()
    expect(r.store.domain.table('issues').get(out.issueId)?.origin).toBe('llm')
  })

  it('hybrid quote outside candidates → status pending, gate.reasons [OUT_OF_CANDIDATES]', async () => {
    const r = await rig()
    const { reviewId, cand } = await candidate(r)
    const out = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's', evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
    })
    expect(out.status).toBe('pending')
    expect(out.gate.reasons).toEqual(['OUT_OF_CANDIDATES'])
  })

  it('no ruleId → tier soft, status pending, gate.reasons [NO_RULE]', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const out = await r.call('review_record_issue', {
      reviewId, finding: 'f', suggestion: 's', evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
    })
    expect(out.status).toBe('pending')
    expect(out.gate.reasons).toEqual(['NO_RULE'])
    expect(r.store.domain.table('issues').get(out.issueId)?.tier).toBe('soft')
  })

  it('soft ruleId → status pending, gate.reasons [SOFT_RULE]', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    const soft = check.softRules[0].ruleId
    const out = await r.call('review_record_issue', {
      reviewId, ruleId: soft, finding: 'f', suggestion: 's', evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
    })
    expect(out.status).toBe('pending')
    expect(out.gate.reasons).toEqual(['SOFT_RULE'])
  })

  it('hard ruleId → HARD_RULE_VERIFIER_OWNED and nothing written', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const before = r.store.issuesOf(reviewId).length
    expect(await r.code('review_record_issue', {
      reviewId, ruleId: 'CAP-002', finding: 'f', suggestion: 's', evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
    })).toBe('HARD_RULE_VERIFIER_OWNED')
    expect(r.store.issuesOf(reviewId).length).toBe(before)
  })

  it('unknown ruleId → RULE_NOT_FOUND', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    expect(await r.code('review_record_issue', {
      reviewId, ruleId: 'ZZZ-999', finding: 'f', suggestion: 's', evidence: [{ quote: '网上国网余额查询能力对AI版支付宝开放技术方案' }],
    })).toBe('RULE_NOT_FOUND')
  })

  it('severity defaults to the rule severity when omitted', async () => {
    const r = await rig()
    const { reviewId, cand } = await candidate(r)
    const out = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's', evidence: [{ quote: cand.snippets[0].quote.slice(0, 40) }],
    })
    expect(r.store.domain.table('issues').get(out.issueId)?.severity).toBe(cand.severity)
  })

  it('increments reviews.metrics.gateRejects on gate failure', async () => {
    const r = await rig()
    const { reviewId, cand } = await candidate(r)
    await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's', evidence: [{ quote: '这段话绝对不在方案原文里出现过' }],
    })
    expect(r.store.domain.table('reviews').get(reviewId)?.metrics.gateRejects).toBe(1)
  })
})

describe('review_status (T-REQ-08)', () => {
  it('returns aiVerdict, one-line summary, issues[], checklist[], counts without writing', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    const snapshot = JSON.stringify([...r.store.domain.table('reviews').entries()])
    const out = await r.call('review_status', { reviewId })
    expect(out.aiVerdict).toBe(check.aiVerdict)
    expect(out.summary).toContain(out.aiVerdict)
    expect(out.issues.length).toBe(check.hardIssues.length)
    expect(out.checklist.length).toBe(check.checklist.length)
    expect(out.counts).toMatchObject({ blocker: expect.any(Number), major: expect.any(Number), minor: expect.any(Number), pending: expect.any(Number) })
    expect(JSON.stringify([...r.store.domain.table('reviews').entries()])).toBe(snapshot)
  })

  it('aiVerdict is recomputed from current issue statuses (rejected excluded)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    for (const issue of r.store.issuesOf(reviewId)) {
      await r.call('review_decide', { reviewId, action: 'reject', issueId: issue.issueId, reason: '不成立' })
    }
    const out = await r.call('review_status', { reviewId })
    expect(out.aiVerdict).toBe('通过')
  })
})

describe('review_decide (T-REQ-09, T-REQ-12, T-REQ-13, T-PRO-04, T-PRO-05, T-DES-08)', () => {
  it('adopt → issue.status adopted + feedback(adopt)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    const out = await r.call('review_decide', { reviewId, action: 'adopt', issueId: issue.issueId })
    expect(out.ok).toBe(true)
    expect(r.store.domain.table('issues').get(issue.issueId)?.status).toBe('adopted')
    expect(r.store.feedbackOf(reviewId)).toMatchObject([{ issueId: issue.issueId, action: 'adopt' }])
  })

  it('reject with reason → issue.status rejected + feedback(reject, reason)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    await r.call('review_decide', { reviewId, action: 'reject', issueId: issue.issueId, reason: '限流在平台统一做' })
    expect(r.store.domain.table('issues').get(issue.issueId)?.status).toBe('rejected')
    expect(r.store.feedbackOf(reviewId)[0]).toMatchObject({ action: 'reject', reason: '限流在平台统一做' })
  })

  it('rewrite with text → issue.status rewritten, rewriteText set + feedback(rewrite, text)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    await r.call('review_decide', { reviewId, action: 'rewrite', issueId: issue.issueId, text: '建议补充限流阈值' })
    const stored = r.store.domain.table('issues').get(issue.issueId)
    expect(stored?.status).toBe('rewritten')
    expect(stored?.rewriteText).toBe('建议补充限流阈值')
    expect(r.store.feedbackOf(reviewId)[0]).toMatchObject({ action: 'rewrite', text: '建议补充限流阈值' })
  })

  it('add → new issue with origin expert, tier expert, status adopted, seq continues', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const before = r.store.issuesOf(reviewId)
    const maxSeq = Math.max(...before.map((i) => i.seq))
    const out = await r.call('review_decide', { reviewId, action: 'add', text: '还要补充幂等说明', ruleId: 'INT-005' })
    const added = r.store.domain.table('issues').get(out.issue.issueId)
    expect(added).toMatchObject({ origin: 'expert', tier: 'expert', status: 'adopted', ruleId: 'INT-005', seq: maxSeq + 1 })
    const noRule = await r.call('review_decide', { reviewId, action: 'add', text: '补充灰度策略' })
    expect(r.store.domain.table('issues').get(noRule.issue.issueId)?.ruleId).toBeUndefined()
  })

  it('adopt_rest → only issues still confirmed/pending become adopted; decided ones untouched', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const [first, ...rest] = r.store.issuesOf(reviewId)
    await r.call('review_decide', { reviewId, action: 'reject', issueId: first!.issueId })
    const out = await r.call('review_decide', { reviewId, action: 'adopt_rest' })
    expect(out.ok).toBe(true)
    expect(r.store.domain.table('issues').get(first!.issueId)?.status).toBe('rejected')
    for (const i of rest) expect(r.store.domain.table('issues').get(i.issueId)?.status).toBe('adopted')
    expect(r.store.feedbackOf(reviewId).length).toBe(1 + rest.length)
  })

  it('a later decision on the same issue overrides the earlier one and keeps both feedback rows', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    await r.call('review_decide', { reviewId, action: 'adopt', issueId: issue.issueId })
    await r.call('review_decide', { reviewId, action: 'reject', issueId: issue.issueId, reason: '再想想' })
    expect(r.store.domain.table('issues').get(issue.issueId)?.status).toBe('rejected')
    const rows = r.store.feedbackOf(reviewId).filter((f) => f.issueId === issue.issueId)
    expect(rows.map((f) => f.action)).toEqual(['adopt', 'reject'])
    expect([...r.store.domain.table('feedback').keys()]).toEqual([`${issue.issueId}#1`, `${issue.issueId}#2`])
  })

  it('set_reviewer writes reviews.reviewer', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
    expect(r.store.domain.table('reviews').get(reviewId)?.reviewer).toBe('张三')
  })

  it('set_final_verdict without reviewer and without defaultReviewer → REVIEWER_REQUIRED', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    expect(await r.code('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })).toBe('REVIEWER_REQUIRED')
    const withDefault = await rig({ defaultReviewer: '李四' })
    const { reviewId: id2 } = await checked(withDefault)
    expect(await withDefault.code('review_decide', { reviewId: id2, action: 'set_final_verdict', finalVerdict: '建议整改' })).toBe('OK')
    expect(withDefault.store.domain.table('reviews').get(id2)?.reviewer).toBe('李四')
  })

  it('set_final_verdict writes finalVerdict and verdictDelta when it differs from aiVerdict', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
    const out = await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })
    expect(out.finalVerdict).toBe('建议整改')
    const rec = r.store.domain.table('reviews').get(reviewId)!
    expect(rec.finalVerdict).toBe('建议整改')
    expect(rec.verdictDelta).toEqual({ ai: check.aiVerdict, final: '建议整改' })
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: check.aiVerdict })
    expect(r.store.domain.table('reviews').get(reviewId)?.verdictDelta).toBeUndefined()
  })

  it('set_final_verdict is the only writer: any other tool trying to set finalVerdict → FINAL_VERDICT_FORBIDDEN', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    expect(await r.code('review_decide', { reviewId, action: 'adopt', issueId: issue.issueId, finalVerdict: '通过' })).toBe('FINAL_VERDICT_FORBIDDEN')
    expect(r.store.domain.table('reviews').get(reviewId)?.finalVerdict).toBeUndefined()
    for (const [name, tool] of r.tools) {
      if (name === 'review_decide') continue
      expect(Object.keys(tool.parameters.properties ?? {}), name).not.toContain('finalVerdict')
    }
  })

  it('unknown action → BAD_ACTION; unknown issueId → ISSUE_NOT_FOUND', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    expect(await r.code('review_decide', { reviewId, action: 'adopt', issueId: `${reviewId}#999` })).toBe('ISSUE_NOT_FOUND')
    expect(await r.code('review_decide', { reviewId, action: 'adopt' })).toBe('BAD_ACTION')
    expect(await r.code('review_decide', { reviewId, action: 'rewrite', issueId: r.store.issuesOf(reviewId)[0]!.issueId })).toBe('BAD_ACTION')
    await expect(r.call('review_decide', { reviewId, action: 'explode' })).rejects.toThrow()
  })

  it('free-text answer normalisation maps 「采纳（推荐）」→ adopt and other text → rewrite', async () => {
    expect(normalizeAnswer('采纳（推荐）')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('采纳')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('确认为问题')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('驳回')).toEqual({ action: 'reject' })
    expect(normalizeAnswer('不是问题')).toEqual({ action: 'reject' })
    expect(normalizeAnswer('建议写成：补充限流阈值')).toEqual({ action: 'rewrite', text: '补充限流阈值' })
    expect(normalizeAnswer('措辞换一下，强调压测')).toEqual({ action: 'rewrite', text: '措辞换一下，强调压测' })

    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    await r.call('review_decide', { reviewId, issueId: issue.issueId, answer: '换个说法：建议明确限流阈值' })
    expect(r.store.domain.table('issues').get(issue.issueId)).toMatchObject({ status: 'rewritten', rewriteText: '建议明确限流阈值' })
  })
})

describe('review_finalize (T-DES-09, T-REQ-14, T-REQ-15)', () => {
  async function decided(r: Rig) {
    const { reviewId, check } = await checked(r)
    const issues = r.store.issuesOf(reviewId)
    await r.call('review_decide', { reviewId, action: 'reject', issueId: issues[0]!.issueId, reason: '平台统一限流' })
    await r.call('review_decide', { reviewId, action: 'rewrite', issueId: issues[1]!.issueId, text: '建议上线前完成压测并附报告' })
    await r.call('review_decide', { reviewId, action: 'add', text: '补充幂等说明' })
    await r.call('review_decide', { reviewId, action: 'adopt_rest' })
    await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })
    return { reviewId, check, issues }
  }

  it('without finalVerdict → VERDICT_NOT_SET', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    expect(await r.code('review_finalize', { reviewId })).toBe('VERDICT_NOT_SET')
  })

  it('writes reviews/<reviewId>.md through ctx.fs, then updates reviews (status finalized, opinionPath, versions[])', async () => {
    const r = await rig()
    const { reviewId } = await decided(r)
    const out = await r.call('review_finalize', { reviewId })
    expect(r.writes).toHaveLength(1)
    expect(r.writes[0]!.fileName).toBe(`${reviewId}.md`)
    expect(r.writes[0]!.content).toContain('# 技术方案预审意见')
    expect(r.writes[0]!.content).toContain('意见：建议整改')
    expect(r.writes[0]!.content).toContain('建议上线前完成压测并附报告。')
    expect(r.writes[0]!.content).toContain('补充幂等说明。')
    expect(out.opinionPath).toBe(`reviews/${reviewId}.md`)
    const rec = r.store.domain.table('reviews').get(reviewId)!
    expect(rec.status).toBe('finalized')
    expect(rec.opinionPath).toBe(out.opinionPath)
    expect(rec.versions).toEqual([{ version: 1, path: out.opinionPath, at: expect.any(String) }])
    expect(rec.aiVerdictAtFinalize).toBe(rec.aiVerdict)
  })

  it('when the file write fails the review record is unchanged', async () => {
    const r = await rig()
    const { reviewId } = await decided(r)
    const before = JSON.stringify(r.store.domain.table('reviews').get(reviewId))
    r.failWrite = true
    await expect(r.call('review_finalize', { reviewId })).rejects.toThrow(/disk full/)
    expect(JSON.stringify(r.store.domain.table('reviews').get(reviewId))).toBe(before)
    expect(r.store.domain.table('exemplars').size).toBe(0)
  })

  it('second finalize writes -v2.md and appends to versions[]', async () => {
    const r = await rig()
    const { reviewId } = await decided(r)
    await r.call('review_finalize', { reviewId })
    const out = await r.call('review_finalize', { reviewId })
    expect(out.version).toBe(2)
    expect(r.writes[1]!.fileName).toBe(`${reviewId}-v2.md`)
    expect(r.store.domain.table('reviews').get(reviewId)?.versions.map((v) => v.version)).toEqual([1, 2])
  })

  it('refreshes memory: exemplars (adopt/rewrite texts, capped per rule), rule_candidates from expert adds, rule_overrides.stats', async () => {
    const r = await rig({ exemplarsPerRule: 1 })
    const { reviewId, issues } = await decided(r)
    const out = await r.call('review_finalize', { reviewId })
    const exemplars = [...r.store.domain.table('exemplars').entries()]
    expect(exemplars.length).toBeGreaterThan(0)
    const rewritten = exemplars.find(([, e]) => e.kind === 'rewrite')
    expect(rewritten?.[1].text).toBe('建议上线前完成压测并附报告')
    const perRule = new Map<string, number>()
    for (const [, e] of exemplars) perRule.set(e.ruleId, (perRule.get(e.ruleId) ?? 0) + 1)
    for (const n of perRule.values()) expect(n).toBeLessThanOrEqual(1)

    const candidates = [...r.store.domain.table('rule_candidates').entries()]
    expect(candidates).toHaveLength(1)
    expect(candidates[0]![0]).toBe(`rc_${reviewId}_1`)
    expect(candidates[0]![1]).toMatchObject({ text: '补充幂等说明', status: 'new', reviewId, suggestedDimension: 'interface' })

    const rejectedRule = issues[0]!.ruleId!
    const stats = r.store.domain.table('rule_overrides').get(rejectedRule)?.stats
    expect(stats).toMatchObject({ shown: 1, reject: 1, adopt: 0 })
    expect(out.memory).toEqual({ exemplars: exemplars.length, candidates: 1 })

    await r.call('review_finalize', { reviewId })
    expect(r.store.domain.table('rule_overrides').get(rejectedRule)?.stats).toMatchObject({ shown: 1, reject: 1 })
    expect(r.store.domain.table('rule_candidates').size).toBe(1)
  })

  it('returns { opinionPath, version, counts, memory } and does not call present itself', async () => {
    const r = await rig()
    const { reviewId, issues } = await decided(r)
    const out = await r.call('review_finalize', { reviewId })
    expect(Object.keys(out).sort()).toEqual(['counts', 'memory', 'opinionPath', 'version'])
    expect(out.counts).toEqual({ adopt: issues.length - 2, reject: 1, rewrite: 1, add: 1 })
    expect(r.tools.has('present')).toBe(false)
  })
})

describe('rules_list / rules_propose / memory_recall (T-DES-10, T-REQ-10)', () => {
  it('rules_list merges shipped + overrides and filters by dimension / tier / status', async () => {
    const r = await rig()
    const all = await r.call('rules_list', {})
    expect(all.rules).toHaveLength(28)
    await r.call('rules_propose', { action: 'set_severity', ruleId: 'CAP-002', severity: 'minor' })
    await r.call('rules_propose', { action: 'disable', ruleId: 'CAP-003' })
    const cap = await r.call('rules_list', { dimension: 'capacity' })
    expect(cap.rules.every((x: any) => x.dimension === 'capacity')).toBe(true)
    expect(cap.rules.find((x: any) => x.ruleId === 'CAP-002')?.severity).toBe('minor')
    expect(cap.rules.find((x: any) => x.ruleId === 'CAP-003')?.status).toBe('retired')
    const hard = await r.call('rules_list', { tier: 'hard' })
    expect(hard.rules).toHaveLength(10)
    const retired = await r.call('rules_list', { status: 'retired' })
    expect(retired.rules.map((x: any) => x.ruleId)).toEqual(['CAP-003'])
    expect(all.rules[0]).toMatchObject({ stats: { shown: 0, adopt: 0, reject: 0, rewrite: 0 } })
  })

  it('rules_propose(draft) validates the YAML with the rule schema and stores status draft', async () => {
    const r = await rig()
    const good = [
      'id: INT-901', 'title: 幂等说明', 'dimension: interface', 'severity: major', 'tier: soft',
      'question: 写操作接口是否说明幂等？', 'rationale: 重试会重复写入', 'suggestion: 建议补充幂等设计说明',
    ].join('\n')
    const out = await r.call('rules_propose', { action: 'draft', draft: good })
    expect(out.ok).toBe(true)
    expect(out.rule).toMatchObject({ ruleId: 'INT-901', status: 'draft' })
    expect(r.store.domain.table('rule_overrides').get('INT-901')?.draft?.status).toBe('draft')
    expect((await r.call('rules_list', { status: 'draft' })).rules.map((x: any) => x.ruleId)).toEqual(['INT-901'])
    expect(await r.code('rules_propose', { action: 'draft', draft: good.replace('INT-901', 'bad-id') })).toBe('BAD_DRAFT')
  })

  it('rules_propose(accept_draft) flips status to active; dismiss marks the candidate dismissed', async () => {
    const r = await rig()
    const draft = [
      'id: INT-902', 'title: 灰度策略', 'dimension: interface', 'severity: minor', 'tier: soft',
      'question: 是否说明灰度？', 'rationale: r', 'suggestion: 建议补充灰度策略',
    ].join('\n')
    const { reviewId } = await checked(r)
    await r.call('review_decide', { reviewId, action: 'add', text: '补充灰度策略' })
    await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })
    await r.call('review_finalize', { reviewId })
    const candidateId = `rc_${reviewId}_1`

    await r.call('rules_propose', { action: 'draft', draft, candidateId })
    expect(r.store.domain.table('rule_candidates').get(candidateId)?.status).toBe('drafted')
    const accepted = await r.call('rules_propose', { action: 'accept_draft', ruleId: 'INT-902', candidateId })
    expect(accepted.rule.status).toBe('active')
    expect(r.store.domain.table('rule_candidates').get(candidateId)?.status).toBe('accepted')
    expect((await r.call('rules_list', { status: 'active' })).rules.some((x: any) => x.ruleId === 'INT-902')).toBe(true)

    const second = await r.call('review_decide', { reviewId, action: 'add', text: '补充回滚方案' })
    expect(second.ok).toBe(true)
    await r.call('review_finalize', { reviewId })
    const dismissed = await r.call('rules_propose', { action: 'dismiss', candidateId: `rc_${reviewId}_2` })
    expect(dismissed.candidate.status).toBe('dismissed')
    expect(await r.code('rules_propose', { action: 'dismiss', candidateId: 'rc_nope_1' })).toBe('CANDIDATE_NOT_FOUND')
  })

  it('memory_recall warn = rejectRatio ≥ 0.6 && shown ≥ 5 with default config', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const ruleId = r.store.issuesOf(reviewId)[0]!.ruleId!
    const overrides = r.store.domain.table('rule_overrides')
    await overrides.put(ruleId, { ruleId, stats: { shown: 5, adopt: 2, reject: 3, rewrite: 0 }, audit: [] })
    const out = await r.call('memory_recall', { ruleId })
    expect(out.stats).toEqual({ shown: 5, adopt: 2, reject: 3, rewrite: 0, rejectRatio: 0.6 })
    expect(out.warn).toBe(true)
    await overrides.put(ruleId, { ruleId, stats: { shown: 4, adopt: 1, reject: 3, rewrite: 0 }, audit: [] })
    expect((await r.call('memory_recall', { ruleId })).warn).toBe(false)
    expect(await r.code('memory_recall', { ruleId: 'ZZZ-000' })).toBe('RULE_NOT_FOUND')
    const byDim = await r.call('memory_recall', { dimension: 'capacity' })
    expect(byDim.rules.length).toBeGreaterThan(0)
  })
})
