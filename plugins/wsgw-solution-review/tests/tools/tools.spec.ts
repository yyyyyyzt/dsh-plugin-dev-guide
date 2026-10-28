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
  render(name: string, args: Record<string, unknown>, value: unknown): string
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
    render(name, args, value) {
      const tool = tools.get(name)
      if (!tool) throw new Error(`no tool ${name}`)
      const blocks = (tool as any).output?.render?.(args, value) ?? []
      return (blocks as { type: string; text?: string }[])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
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

  it('same docHash with reuse=false → creates a new reviewId; the undecided old record is kept but superseded', async () => {
    const r = await rig()
    const first = await parsed(r)
    const again = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') }, reuse: false })
    expect(again.reviewId).not.toBe(first)
    expect(again.superseded).toEqual([first])
    expect(r.store.domain.table('reviews').size).toBe(2)
    expect(r.store.domain.table('reviews').get(first)).toMatchObject({ status: 'superseded', supersededBy: again.reviewId })
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
  it('persists hard auto-fail issues with origin verifier and updates reviews.aiVerdict', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    expect(check.hardIssues.length).toBeGreaterThan(0)
    const stored = r.store.issuesOf(reviewId)
    expect(stored.length).toBe(check.hardIssues.length)
    expect(stored.every((i) => i.origin === 'verifier' && i.status === 'confirmed')).toBe(true)
    expect(stored.every((i) => i.tier === 'hard')).toBe(true)
    expect(r.store.domain.table('reviews').get(reviewId)?.aiVerdict).toBe(check.aiVerdict)
    expect(check.aiVerdict).toBe('建议整改')
  })

  it('renders per-issue details, candidate snippets, soft rules, checklist and absence labels', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    const rendered = r.render('review_check', { reviewId }, check)
    expect(rendered).toContain('自动登记 3 条问题')
    expect(rendered).toContain('CAP-002')
    expect(rendered).toContain('absence·非引文')
    expect(rendered).toContain('CAP-003')
    expect(rendered).toContain('候选1')
    expect(rendered).toContain('CAP-004')
    expect(rendered).toContain('检查清单')
    expect(rendered).toContain('未通过：CAP-002、CAP-006、DOC-001')
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

  it('re-running check after any expert decision → REVIEW_ALREADY_DECIDED and decided issues survive (T-PRO-12)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    await r.call('review_decide', { reviewId, action: 'reject', issueId: issue.issueId, reason: '平台统一限流' })
    expect(await r.code('review_check', { reviewId })).toBe('REVIEW_ALREADY_DECIDED')
    expect(r.store.domain.table('issues').get(issue.issueId)?.status).toBe('rejected')
    expect(r.store.feedbackOf(reviewId)).toHaveLength(1)
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

  it('absence phrase → status pending, gate.reasons [ABSENCE_NOT_ALLOWED]', async () => {
    const r = await rig()
    const { reviewId, cand } = await candidate(r)
    const out = await r.call('review_record_issue', {
      reviewId, ruleId: cand.ruleId, finding: 'f', suggestion: 's', evidence: [{ quote: '未提及：ratelimit' }],
    })
    expect(out.status).toBe('pending')
    expect(out.gate.reasons).toEqual(['ABSENCE_NOT_ALLOWED'])
    expect(out.resolvedEvidence).toEqual([])
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

    const rendered = r.render('review_status', { reviewId }, out)
    expect(rendered).toContain(out.issues[0].issueId)
    expect(rendered).toContain('摘要：')
    expect(rendered).toContain('检查清单')
    expect(rendered).toContain('待人工')
    expect(rendered).toContain('absence·非引文')
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

  it('adopt_rest → only confirmed issues become adopted; pending stay pending and are returned (T-PRO-05)', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const [first, ...rest] = r.store.issuesOf(reviewId)
    const pending = await r.call('review_record_issue', {
      reviewId, finding: '未说明灰度策略', suggestion: '建议补充灰度策略', evidence: [{ quote: '通过支付宝小程序' }],
    })
    expect(pending.status).toBe('pending')
    await r.call('review_decide', { reviewId, action: 'reject', issueId: first!.issueId })
    const out = await r.call('review_decide', { reviewId, action: 'adopt_rest' })
    expect(out.ok).toBe(true)
    expect(r.store.domain.table('issues').get(first!.issueId)?.status).toBe('rejected')
    for (const i of rest) expect(r.store.domain.table('issues').get(i.issueId)?.status).toBe('adopted')
    expect(out.affected).toEqual(rest.map((i) => i.issueId))
    expect(r.store.domain.table('issues').get(pending.issueId)?.status).toBe('pending')
    expect(out.remainingPending).toEqual([pending.issueId])
    expect(r.store.feedbackOf(reviewId).length).toBe(1 + rest.length)
    const rendered = r.render('review_decide', { reviewId, action: 'adopt_rest' }, out)
    expect(rendered).toContain(`其余 ${rest.length} 条已确认问题已采纳`)
    expect(rendered).toContain('1 条待人工')
    expect(rendered).toContain(pending.issueId)
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
    const out = await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '通过' })
    expect(out.finalVerdict).toBe('通过')
    const rec = r.store.domain.table('reviews').get(reviewId)!
    expect(rec.finalVerdict).toBe('通过')
    expect(rec.verdictDelta).toEqual({ ai: check.aiVerdict, final: '通过' })
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

  it('answers that lead with a decision word plus punctuation keep the decision; the tail becomes the reason (T-PRO-11)', async () => {
    expect(normalizeAnswer('驳回：已在 3.2 节说明')).toEqual({ action: 'reject', reason: '已在 3.2 节说明' })
    expect(normalizeAnswer('不对，平台统一限流')).toEqual({ action: 'reject', reason: '平台统一限流' })
    expect(normalizeAnswer('不是问题。方案附件里有压测报告')).toEqual({ action: 'reject', reason: '方案附件里有压测报告' })
    expect(normalizeAnswer('驳回。')).toEqual({ action: 'reject' })
    expect(normalizeAnswer('采纳。')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('同意，按建议改')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('确认为问题！')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('采纳，但改成：上线前完成全链路压测')).toEqual({ action: 'rewrite', text: '上线前完成全链路压测' })
    expect(normalizeAnswer('不对外开放的接口也要鉴权')).toEqual({ action: 'rewrite', text: '不对外开放的接口也要鉴权' })
    expect(normalizeAnswer('对接口补充限流说明')).toEqual({ action: 'rewrite', text: '对接口补充限流说明' })

    const r = await rig()
    const { reviewId } = await checked(r)
    const [a, b] = r.store.issuesOf(reviewId)
    await r.call('review_decide', { reviewId, issueId: a!.issueId, answer: '驳回：已在 3.2 节说明' })
    expect(r.store.domain.table('issues').get(a!.issueId)?.status).toBe('rejected')
    expect(r.store.feedbackOf(reviewId)[0]).toMatchObject({ action: 'reject', reason: '已在 3.2 节说明' })
    await r.call('review_decide', { reviewId, issueId: b!.issueId, answer: '驳回：随便', reason: '平台统一限流' })
    expect(r.store.feedbackOf(reviewId)[1]).toMatchObject({ action: 'reject', reason: '平台统一限流' })
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

  it('a decision after finalize reopens the review; finalizing again yields v2 (T-PRO-12)', async () => {
    const r = await rig()
    const { reviewId, issues } = await decided(r)
    await r.call('review_finalize', { reviewId })
    expect(await r.code('review_check', { reviewId })).toBe('REVIEW_ALREADY_DECIDED')
    await r.call('review_decide', { reviewId, action: 'adopt', issueId: issues[0]!.issueId })
    const reopened = r.store.domain.table('reviews').get(reviewId)!
    expect(reopened.status).toBe('open')
    expect(reopened.versions).toHaveLength(1)
    expect(r.render('review_decide', { reviewId, action: 'adopt' }, await r.call('review_decide', { reviewId, action: 'adopt', issueId: issues[0]!.issueId }))).toContain('需重新定稿')
    const out = await r.call('review_finalize', { reviewId })
    expect(out.version).toBe(2)
    expect(r.store.domain.table('reviews').get(reviewId)?.status).toBe('finalized')
  })

  it('stats-only override rows do not count as overrides for the pack version or RuleView.overridden', async () => {
    const r = await rig()
    const base = r.store.effectiveRules().version
    const { reviewId, issues } = await decided(r)
    await r.call('review_finalize', { reviewId })
    const ruleId = issues[0]!.ruleId!
    expect(r.store.domain.table('rule_overrides').get(ruleId)?.stats.shown).toBe(1)
    expect(r.store.effectiveRules().version).toBe(base)
    expect((await r.call('rules_list', {})).rules.find((x: any) => x.ruleId === ruleId).overridden).toBe(false)
    await r.call('rules_propose', { action: 'set_severity', ruleId, severity: 'minor' })
    expect(r.store.effectiveRules().version).toBe(`${base}+ov1`)
    expect((await r.call('rules_list', {})).rules.find((x: any) => x.ruleId === ruleId).overridden).toBe(true)
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
  it('setting a shipped rule back to its shipped value clears the override but keeps the audit', async () => {
    const r = await rig()
    const base = r.store.effectiveRules().version
    const shipped = (await r.call('rules_list', {})).rules.find((x: any) => x.ruleId === 'CAP-001')
    await r.call('rules_propose', { action: 'set_severity', ruleId: 'CAP-001', severity: 'minor' })
    await r.call('rules_propose', { action: 'disable', ruleId: 'CAP-001' })
    expect(r.store.effectiveRules().version).toBe(`${base}+ov1`)
    await r.call('rules_propose', { action: 'set_severity', ruleId: 'CAP-001', severity: shipped.severity })
    await r.call('rules_propose', { action: 'enable', ruleId: 'CAP-001' })
    const rec = r.store.domain.table('rule_overrides').get('CAP-001')!
    expect(rec.severity).toBeUndefined()
    expect(rec.status).toBeUndefined()
    expect(rec.audit.map((a) => a.change.field)).toEqual(['severity', 'status', 'severity', 'status'])
    expect(r.store.effectiveRules().version).toBe(base)
    const after = (await r.call('rules_list', {})).rules.find((x: any) => x.ruleId === 'CAP-001')
    expect(after).toMatchObject({ severity: shipped.severity, status: 'active', overridden: false })
    expect(r.store.ruleDetail('CAP-001').detail.override).toBeUndefined()
  })

  it('set_suggestion edits a rule globally, feeds later verifier issues, and the shipped text clears it', async () => {
    const r = await rig()
    const base = r.store.effectiveRules().version
    const first = await checked(r)
    const hard = r.store.issuesOf(first.reviewId).find((i) => i.origin === 'verifier')!
    const shipped = r.store.ruleDetail(hard.ruleId!).detail.suggestion
    expect(await r.code('rules_propose', { action: 'set_suggestion', ruleId: hard.ruleId, suggestion: '   ' })).toBe('BAD_ACTION')
    expect(await r.code('rules_propose', { action: 'set_suggestion', ruleId: hard.ruleId, suggestion: 'x'.repeat(501) })).toBe('BAD_ACTION')
    expect(await r.code('rules_propose', { action: 'set_suggestion', ruleId: hard.ruleId })).toBe('BAD_ACTION')
    await r.call('rules_propose', { action: 'set_suggestion', ruleId: hard.ruleId, suggestion: '  请按平台规范补充该项并附依据。 ', who: 'dashboard' })
    expect(r.store.ruleDetail(hard.ruleId!).detail).toMatchObject({
      suggestion: '请按平台规范补充该项并附依据。',
      override: { suggestion: '请按平台规范补充该项并附依据。' },
      shipped: { suggestion: shipped },
    })
    expect(r.store.effectiveRules().version).toBe(`${base}+ov1`)
    const again = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') }, reuse: false })
    await r.call('review_check', { reviewId: again.reviewId })
    const reissued = r.store.issuesOf(again.reviewId).find((i) => i.ruleId === hard.ruleId)!
    expect(reissued.suggestion).toBe('请按平台规范补充该项并附依据。')
    await r.call('rules_propose', { action: 'set_suggestion', ruleId: hard.ruleId, suggestion: shipped })
    expect(r.store.ruleDetail(hard.ruleId!).detail.override).toBeUndefined()
    expect(r.store.effectiveRules().version).toBe(base)
    expect(r.store.ruleDetail(hard.ruleId!).detail.audit.map((a) => a.change.field)).toEqual(['suggestion', 'suggestion'])
  })

  it('reset restores every shipped value in one step, keeps stats and audit, and refuses draft rules', async () => {
    const r = await rig()
    const base = r.store.effectiveRules().version
    const { reviewId } = await checked(r)
    await r.call('review_decide', { reviewId, action: 'adopt_rest' })
    await r.call('review_decide', { reviewId, action: 'set_reviewer', reviewer: '张三' })
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })
    await r.call('review_finalize', { reviewId })
    const ruleId = r.store.issuesOf(reviewId).find((i) => i.ruleId && i.status === 'adopted' && i.origin === 'verifier')!.ruleId!
    const shown = r.store.domain.table('rule_overrides').get(ruleId)!.stats.shown
    const shipped = r.store.ruleDetail(ruleId).detail.shipped!
    await r.call('rules_propose', { action: 'disable', ruleId })
    await r.call('rules_propose', { action: 'set_severity', ruleId, severity: shipped.severity === 'minor' ? 'major' : 'minor' })
    await r.call('rules_propose', { action: 'set_suggestion', ruleId, suggestion: '改过的建议' })
    expect(r.store.effectiveRules().version).toBe(`${base}+ov1`)
    const out = await r.call('rules_propose', { action: 'reset', ruleId })
    expect(out.rule).toMatchObject({ ruleId, status: 'active', severity: shipped.severity, overridden: false })
    const rec = r.store.domain.table('rule_overrides').get(ruleId)!
    expect([rec.status, rec.severity, rec.suggestion, rec.params]).toEqual([undefined, undefined, undefined, undefined])
    expect(rec.stats.shown).toBe(shown)
    expect(rec.audit.slice(-3).map((a) => [a.change.field, a.change.to])).toEqual([
      ['status', shipped.status],
      ['severity', shipped.severity],
      ['suggestion', shipped.suggestion],
    ])
    expect(r.store.effectiveRules().version).toBe(base)
    const before = rec.audit.length
    await r.call('rules_propose', { action: 'reset', ruleId })
    expect(r.store.domain.table('rule_overrides').get(ruleId)!.audit).toHaveLength(before)
    await r.call('rules_propose', {
      action: 'draft',
      draft: ['id: INT-905', 'title: 灰度', 'dimension: interface', 'severity: minor', 'tier: soft', 'question: q', 'rationale: r', 'suggestion: s'].join('\n'),
    })
    expect(await r.code('rules_propose', { action: 'reset', ruleId: 'INT-905' })).toBe('BAD_ACTION')
  })

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

    const rendered = r.render('rules_list', {}, all)
    expect(rendered).toContain('共 28 条规则')
    expect(rendered).toContain('CAP-001')
    expect(rendered).toContain('展示 0 / 采纳 0 / 驳回 0 / 改写 0')
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

describe('one open record per solution (T-DES-17)', () => {
  const seed = () => readFixture('seed.md')
  const revised = () => `${seed()}\n\n## 补充说明\n\n本次修订补充了压测计划。\n`

  it('a copy that differs only in BOM, CRLF and trailing spaces reuses the same record', async () => {
    const r = await rig()
    const first = await parsed(r)
    const noisy = `\uFEFF${seed().split('\n').map((l) => `${l}  `).join('\r\n')}\r\n\r\n`
    const again = await r.call('review_parse', { source: { kind: 'inline', value: noisy } })
    expect(again.existingReviewId).toBe(first)
    expect(r.store.domain.table('reviews').size).toBe(1)
  })

  it('a revised version with the same title supersedes the undecided open record', async () => {
    const r = await rig()
    const first = await parsed(r)
    const next = await r.call('review_parse', { source: { kind: 'inline', value: revised() } })
    expect(next.existingReviewId).toBeUndefined()
    expect(next.superseded).toEqual([first])
    const old = r.store.domain.table('reviews').get(first)!
    expect(old).toMatchObject({ status: 'superseded', supersededBy: next.reviewId })
    expect(old.closedReason).toContain(next.reviewId)
    expect(old.closedAt).toBeDefined()
    expect(r.render('review_parse', {}, next)).toContain(first)
  })

  it('the same source path supersedes even when the title changed', async () => {
    const r = await rig()
    const a = await r.store.parse({ source: seed(), sourcePath: 'docs/plan.md' })
    const b = await r.store.parse({ source: seed().replace('# 网上国网余额查询能力', '# 修订版 网上国网余额查询能力'), sourcePath: 'docs/plan.md' })
    expect(b.superseded).toEqual([a.reviewId])
  })

  it('an open record that already has expert decisions is kept; finalized records are kept', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    await r.call('review_decide', { reviewId, action: 'adopt', issueId: r.store.issuesOf(reviewId)[0]!.issueId })
    const next = await r.call('review_parse', { source: { kind: 'inline', value: revised() } })
    expect(next.superseded ?? []).toEqual([])
    expect(r.store.domain.table('reviews').get(reviewId)?.status).toBe('open')
  })

  it('untitled solutions are not grouped by title', async () => {
    const r = await rig()
    const a = await r.store.parse({ source: '正文一，没有标题。' })
    const b = await r.store.parse({ source: '正文二，也没有标题。' })
    expect(b.superseded ?? []).toEqual([])
    expect(r.store.domain.table('reviews').get(a.reviewId)?.status).toBe('open')
  })

  it('startup collapse folds existing duplicates into one active record (the reported 3-records case)', async () => {
    const r = await rig()
    const { reviewId: kept } = await checked(r)
    await r.call('review_decide', { reviewId: kept, action: 'adopt_rest' })
    const reviews = r.store.domain.table('reviews')
    const base = reviews.get(kept)!
    const dupA = 'rv_20261019_dupaaa'
    const dupB = 'rv_20261019_dupbbb'
    await reviews.put(dupA, { ...structuredClone(base), reviewId: dupA, createdAt: '2026-10-19T08:00:01.000Z', status: 'open' })
    await reviews.put(dupB, { ...structuredClone(base), reviewId: dupB, source: `${base.source}\r\n`, createdAt: '2026-10-19T08:00:02.000Z', status: 'open' })
    const closed = await r.store.supersedeStale()
    expect(closed.sort()).toEqual([dupA, dupB])
    expect(reviews.get(dupA)).toMatchObject({ status: 'superseded', supersededBy: kept })
    expect(reviews.get(dupB)).toMatchObject({ status: 'superseded', supersededBy: kept })
    expect(reviews.get(kept)?.status).toBe('open')
    expect(await r.store.supersedeStale()).toEqual([])
  })

  it('startup collapse keeps the newest undecided record when its content is a new version', async () => {
    const r = await rig()
    const { reviewId: decided } = await checked(r)
    await r.call('review_decide', { reviewId: decided, action: 'adopt_rest' })
    const reviews = r.store.domain.table('reviews')
    const fresh = 'rv_20261019_newver'
    await reviews.put(fresh, { ...structuredClone(reviews.get(decided)!), reviewId: fresh, source: revised(), createdAt: '2026-10-19T09:00:00.000Z' })
    expect(await r.store.supersedeStale()).toEqual([])
    expect(reviews.get(fresh)?.status).toBe('open')
  })
})

describe('closed records (T-DES-18)', () => {
  it('discard closes the review with a reason; every write then fails with REVIEW_CLOSED', async () => {
    const r = await rig({ defaultReviewer: '张三' })
    const { reviewId } = await checked(r)
    const issueId = r.store.issuesOf(reviewId)[0]!.issueId
    const out = await r.call('review_decide', { reviewId, action: 'discard', reason: '重复记录' })
    expect(out.status).toBe('discarded')
    expect(r.store.domain.table('reviews').get(reviewId)).toMatchObject({ status: 'discarded', closedReason: '重复记录' })
    expect(r.render('review_decide', { reviewId, action: 'discard' }, out)).toContain('已作废')
    expect(await r.code('review_check', { reviewId })).toBe('REVIEW_CLOSED')
    expect(await r.code('review_record_issue', { reviewId, finding: 'x', suggestion: 'y', evidence: [{ quote: '通过支付宝小程序' }] })).toBe('REVIEW_CLOSED')
    expect(await r.code('review_decide', { reviewId, action: 'adopt', issueId })).toBe('REVIEW_CLOSED')
    expect(await r.code('review_decide', { reviewId, action: 'discard' })).toBe('REVIEW_CLOSED')
    expect(await r.code('review_finalize', { reviewId })).toBe('REVIEW_CLOSED')
    expect((await r.call('review_status', { reviewId })).status).toBe('discarded')
  })

  it('REVIEW_CLOSED on a superseded record names the replacement', async () => {
    const r = await rig()
    const first = await parsed(r)
    const next = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') }, reuse: false })
    try {
      await r.call('review_check', { reviewId: first })
      throw new Error('expected REVIEW_CLOSED')
    } catch (e) {
      expect((e as ReviewToolError).code).toBe('REVIEW_CLOSED')
      expect((e as Error).message).toContain(next.reviewId)
    }
  })

  it('a closed record is never reused by review_parse', async () => {
    const r = await rig()
    const first = await parsed(r)
    await r.call('review_decide', { reviewId: first, action: 'discard' })
    const again = await r.call('review_parse', { source: { kind: 'inline', value: readFixture('seed.md') } })
    expect(again.existingReviewId).toBeUndefined()
    expect(again.reviewId).not.toBe(first)
  })

  it('discarding a finalized review removes it from rule stats and exemplars', async () => {
    const r = await rig({ defaultReviewer: '张三' })
    const { reviewId } = await checked(r)
    const ruleId = r.store.issuesOf(reviewId)[0]!.ruleId!
    await r.call('review_decide', { reviewId, action: 'adopt_rest' })
    await r.call('review_decide', { reviewId, action: 'set_final_verdict', finalVerdict: '建议整改' })
    await r.call('review_finalize', { reviewId })
    expect(r.store.domain.table('rule_overrides').get(ruleId)?.stats.shown).toBeGreaterThan(0)
    await r.call('review_decide', { reviewId, action: 'discard', reason: '测试数据' })
    expect(r.store.domain.table('rule_overrides').get(ruleId)?.stats.shown ?? 0).toBe(0)
    expect([...r.store.domain.table('exemplars').entries()].filter(([, e]) => e.reviewId === reviewId)).toEqual([])
  })
})

describe('per-issue severity on adopt / rewrite (T-DES-19)', () => {
  it('adopt with severity changes only this issue, records severityFrom and recomputes the verdict', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const [target, ...others] = r.store.issuesOf(reviewId)
    for (const o of others) await r.call('review_decide', { reviewId, action: 'reject', issueId: o.issueId })
    const original = target!.severity
    const lower = await r.call('review_decide', { reviewId, action: 'adopt', issueId: target!.issueId, severity: 'minor' })
    expect(lower.aiVerdict).toBe('通过')
    expect(r.store.domain.table('issues').get(target!.issueId)).toMatchObject({ status: 'adopted', severity: 'minor', severityFrom: original })
    expect(r.store.domain.table('rule_overrides').get(target!.ruleId!)?.severity).toBeUndefined()
    const higher = await r.call('review_decide', { reviewId, action: 'adopt', issueId: target!.issueId, severity: 'blocker' })
    expect(higher.aiVerdict).toBe('不通过')
    expect(r.store.domain.table('issues').get(target!.issueId)?.severityFrom).toBe(original)
    await r.call('review_decide', { reviewId, action: 'adopt', issueId: target!.issueId, severity: original })
    expect(r.store.domain.table('issues').get(target!.issueId)?.severityFrom).toBeUndefined()
  })

  it('a colloquial answer carries the severity: 「降为 minor 后采纳」/「要改，但算轻微」', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const [a, b] = r.store.issuesOf(reviewId)
    await r.call('review_decide', { reviewId, issueId: a!.issueId, answer: '降为 minor 后采纳' })
    await r.call('review_decide', { reviewId, issueId: b!.issueId, answer: '要改，但我换个说法：补充高峰期压测报告，写明目标 TPS', severity: 'minor' })
    expect(r.store.domain.table('issues').get(a!.issueId)).toMatchObject({ status: 'adopted', severity: 'minor' })
    expect(r.store.domain.table('issues').get(b!.issueId)).toMatchObject({ status: 'rewritten', severity: 'minor', rewriteText: '补充高峰期压测报告，写明目标 TPS' })
  })
})

describe('colloquial answers (T-PRO-13)', () => {
  it('maps spoken replies to decisions, reasons and severities', () => {
    expect(normalizeAnswer('要改')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('要改，按这个建议（推荐）')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('是问题')).toEqual({ action: 'adopt' })
    expect(normalizeAnswer('不用改')).toEqual({ action: 'reject' })
    expect(normalizeAnswer('不用改，3.2 写了')).toEqual({ action: 'reject', reason: '3.2 写了' })
    expect(normalizeAnswer('不算问题。平台统一做')).toEqual({ action: 'reject', reason: '平台统一做' })
    expect(normalizeAnswer('算轻微')).toEqual({ action: 'adopt', severity: 'minor' })
    expect(normalizeAnswer('降为 minor 后采纳')).toEqual({ action: 'adopt', severity: 'minor' })
    expect(normalizeAnswer('降成轻微再采纳')).toEqual({ action: 'adopt', severity: 'minor' })
    expect(normalizeAnswer('要改，但算轻微')).toEqual({ action: 'adopt', severity: 'minor' })
    expect(normalizeAnswer('同意，升为严重')).toEqual({ action: 'adopt', severity: 'blocker' })
    expect(normalizeAnswer('要改，算一般')).toEqual({ action: 'adopt', severity: 'major' })
    expect(normalizeAnswer('要改，但我换个说法：补充高峰期压测报告')).toEqual({ action: 'rewrite', text: '补充高峰期压测报告' })
    expect(normalizeAnswer('我换个说法：补充压测报告')).toEqual({ action: 'rewrite', text: '补充压测报告' })
    expect(normalizeAnswer('要改，但我换个说法')).toEqual({ action: 'rewrite' })
    expect(normalizeAnswer('改写')).toEqual({ action: 'rewrite' })
    expect(normalizeAnswer('换个说法')).toEqual({ action: 'rewrite' })
    expect(normalizeAnswer('算了，写清楚回滚步骤')).toEqual({ action: 'rewrite', text: '算了，写清楚回滚步骤' })
    expect(normalizeAnswer('要改成全链路压测')).toEqual({ action: 'rewrite', text: '要改成全链路压测' })
  })

  it('a bare 「要改，但我换个说法」 writes nothing and asks the agent to follow up', async () => {
    const r = await rig()
    const { reviewId } = await checked(r)
    const issue = r.store.issuesOf(reviewId)[0]!
    try {
      await r.call('review_decide', { reviewId, issueId: issue.issueId, answer: '要改，但我换个说法' })
      throw new Error('expected BAD_ACTION')
    } catch (e) {
      expect((e as ReviewToolError).code).toBe('BAD_ACTION')
      expect((e as Error).message).toContain('您想怎么写')
    }
    expect(r.store.domain.table('issues').get(issue.issueId)?.status).toBe(issue.status)
    expect(r.store.feedbackOf(reviewId)).toEqual([])
  })
})

describe('Chinese level names in tool text (T-DES-20)', () => {
  it('status summary, basis and rendered tool text use 严重 / 一般 / 轻微', async () => {
    const r = await rig()
    const { reviewId, check } = await checked(r)
    expect(check.basis).not.toMatch(/blocker|major|minor/)
    const out = await r.call('review_status', { reviewId })
    expect(out.summary).toMatch(/严重 \d+ 条/)
    expect(out.summary).not.toMatch(/blocker|major|minor/)
    for (const [name, args, value] of [
      ['review_status', { reviewId }, out],
      ['review_check', { reviewId }, check],
      ['rules_list', {}, await r.call('rules_list', {})],
    ] as const) {
      expect(r.render(name, args, value), name).not.toMatch(/blocker|major|minor/)
    }
  })
})
