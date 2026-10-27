// Dashboard client: tab registration, pure model helpers, and the presentational views rendered with
// react-dom/server from payloads produced by the real API builders (so client and host cannot drift).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../src/client/index.js'
import {
  DIMENSION_LABEL,
  candidateActions,
  compareNotice,
  evalMetricRows,
  filterRules,
  markFrequentlyRejected,
  memoryRulesWithRecords,
  requestJson,
  reviewState,
  slidingAdoptRate,
  toggleCompare,
} from '../../src/client/model.js'
import { EvalView, MemoryView, ReviewDetailView, ReviewListView, RulesView } from '../../src/client/views.js'
import { reviewDetailPayload, reviewListPayload, rulesPayload } from '../../src/host/api.js'
import { packageRoot, readFixture, shippedPack } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'

const opened: OpenedStore[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) {
    await o.close()
    await removeRoot(o.root)
  }
})

async function store(overrides = {}) {
  const o = await openStore(overrides)
  opened.push(o)
  return o.store
}

const noop = (): void => {}
const html = (el: React.ReactElement): string => renderToStaticMarkup(el)
const count = (markup: string, needle: string): number => markup.split(needle).length - 1

describe('tab registration (T-DSH-01)', () => {
  it('declares a kept-mounted extension page type with one guide entry', () => {
    expect(client.TAB_DEFINITION).toMatchObject({ id: 'wsgw-solution-review', kind: 'wsgw-review', priority: 'extension', keepMounted: true })
    expect(client.TAB_DEFINITION.title()).toBe('方案审查')
    expect(client.TAB_DEFINITION.guide).toHaveLength(1)
    expect(client.TAB_DEFINITION.guide[0]).toMatchObject({ id: 'dashboard', order: 50 })
    expect(client.TAB_DEFINITION.guide[0]!.title()).toBe('方案审查看板')
  })

  it('apply registers the tab type and the keyed body under sidebar.right.pane.tab', () => {
    const registered: unknown[] = []
    const bodies: { def: { name: string; key: string }; component: unknown }[] = []
    const ctx = {
      effect: (fn: () => unknown) => fn(),
      sidebarRightTabs: { register: (def: unknown) => { registered.push(def); return noop } },
      slots: {
        inject: (name: string, cb: () => unknown) => { expect(name).toBe('sidebar.right.pane.tab'); cb(); return noop },
        register: (def: { name: string; key: string }, component: unknown) => { bodies.push({ def, component }); return noop },
      },
    }
    expect(client.name).toBe('wsgw-solution-review')
    expect(client.inject).toEqual(['slots', 'sidebarRightTabs'])
    client.apply(ctx)
    expect(registered).toEqual([client.TAB_DEFINITION])
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.def).toEqual({ name: 'sidebar.right.pane.tab', key: 'wsgw-solution-review' })
    expect(bodies[0]!.component).toBe(client.Dashboard)
  })
})

describe('model (T-DSH-03, T-DSH-05, T-DSH-06, T-DSH-07)', () => {
  it('dimension labels cover exactly the engine dimensions used by the shipped rules', async () => {
    expect(Object.keys(DIMENSION_LABEL).sort()).toEqual(
      ['capacity', 'channel', 'config', 'data_sync', 'documentation', 'interface', 'monitoring', 'security'],
    )
    for (const rule of shippedPack().rules) expect(DIMENSION_LABEL[rule.dimension], rule.id).toBeTruthy()
    const rules = rulesPayload(await store()).rules
    expect(filterRules(rules, { dimension: 'capacity' }).length).toBeGreaterThan(0)
    expect(filterRules(rules, { dimension: 'capacity', tier: 'hard' }).every((r) => r.dimension === 'capacity' && r.tier === 'hard')).toBe(true)
    expect(filterRules(rules, { status: 'retired' })).toEqual([])
  })

  it('markFrequentlyRejected marks rules with reject / shown ≥ 0.6 and shown ≥ 5', () => {
    expect(markFrequentlyRejected({ shown: 5, adopt: 1, reject: 3, rewrite: 1 })).toBe(true)
    expect(markFrequentlyRejected({ shown: 4, adopt: 1, reject: 3, rewrite: 0 })).toBe(false)
    expect(markFrequentlyRejected({ shown: 5, adopt: 3, reject: 2, rewrite: 0 })).toBe(false)
  })

  it('sliding adopt rate reports insufficient below five decisions', () => {
    const point = (reviewId: string, adopted: number, rejected: number) => ({ reviewId, at: reviewId, adopted, rejected, rewritten: 0, rate: null })
    expect(slidingAdoptRate([point('a', 1, 0), point('b', 0, 1)])).toMatchObject({ insufficient: true, sample: 2 })
    expect(slidingAdoptRate([point('a', 1, 0), point('b', 1, 0), point('c', 1, 0), point('d', 1, 0), point('e', 0, 1)])).toMatchObject({ insufficient: false, rate: 0.8 })
  })

  it('memory lists only rules with records, most shown first; candidates expose only legal actions', async () => {
    const memory = (await store()).dashboardMemory()
    expect(memoryRulesWithRecords(memory.rules)).toEqual([])
    const a = { ...memory.rules[0]!, stats: { ...memory.rules[0]!.stats, shown: 1 } }
    const b = { ...memory.rules[1]!, stats: { ...memory.rules[1]!.stats, shown: 3 } }
    const c = { ...memory.rules[2]!, exemplars: [{ ruleId: memory.rules[2]!.ruleId, kind: 'adopt' as const, text: 't', reviewId: 'r', at: 'x' }] }
    expect(memoryRulesWithRecords([a, b, c, ...memory.rules.slice(3)]).map((r) => r.ruleId)).toEqual([b.ruleId, a.ruleId, c.ruleId])
    expect(candidateActions({ status: 'new' })).toEqual(['dismiss'])
    expect(candidateActions({ status: 'drafted', draftRuleId: 'INT-901' })).toEqual(['accept_draft', 'dismiss'])
    expect(candidateActions({ status: 'accepted' })).toEqual([])
    expect(candidateActions({ status: 'dismissed' })).toEqual([])
  })

  it('eval comparison needs 2–7 runs; an 8th selection is refused with a notice', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(toggleCompare(seven, 'h')).toEqual({ selected: seven, notice: '最多选择 7 个 run' })
    expect(toggleCompare(seven, 'a')).toEqual({ selected: seven.slice(1) })
    expect(toggleCompare([], 'a')).toEqual({ selected: ['a'] })
    expect(compareNotice(['a'])).toBe('至少选择 2 个 run 才能对比')
    expect(compareNotice(['a', 'b'])).toBeNull()
    expect(compareNotice(seven)).toBeNull()
  })

  it('eval metric rows take the union of numeric metrics across runs', () => {
    const rows = evalMetricRows([
      { runId: 'r1', at: '1', metrics: { f1: 0.5, kappa: 0.4 } },
      { runId: 'r2', at: '2', metrics: { f1: 0.7, note: 'x' } },
    ] as never)
    expect(rows).toEqual([
      { metric: 'f1', values: [0.5, 0.7] },
      { metric: 'kappa', values: [0.4, null] },
    ])
  })

  it('reviewState distinguishes open, finalized and stale (decisions changed after finalize)', () => {
    expect(reviewState({ status: 'open', versions: [] })).toBe('open')
    expect(reviewState({ status: 'finalized', versions: [{ version: 1, path: 'p', at: 'a' }] })).toBe('finalized')
    expect(reviewState({ status: 'open', versions: [{ version: 1, path: 'p', at: 'a' }] })).toBe('stale')
  })

  it('requestJson returns JSON, surfaces API error messages and survives non-JSON bodies', async () => {
    const respond = (status: number, body: string) => vi.fn(async () => new Response(body, { status }))
    const ok = respond(200, '{"rules":[]}')
    expect(await requestJson('/rules', {}, ok)).toEqual({ rules: [] })
    expect(ok).toHaveBeenCalledWith('/plugins/wsgw-solution-review/api/rules', expect.objectContaining({ credentials: 'same-origin' }))
    await expect(requestJson('/rules', {}, respond(400, '{"error":"BAD_ACTION","message":"候选尚未起草"}'))).rejects.toThrow('候选尚未起草')
    await expect(requestJson('/rules', {}, respond(502, '<html>bad gateway</html>'))).rejects.toThrow('HTTP 502')
    await expect(requestJson('/rules', {}, respond(401, ''))).rejects.toThrow('HTTP 401')
    expect(await requestJson('/rules', {}, respond(200, ''))).toBeNull()
    const post = respond(200, '{}')
    await requestJson('/x', { method: 'POST', body: '{}' }, post)
    const init = (post.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })
})

describe('views (T-DSH-02, T-DSH-04)', () => {
  it('each page shows its empty state on empty data', async () => {
    const s = await store()
    expect(html(<ReviewListView data={reviewListPayload(s, 1)} onSelect={noop} onPage={noop} />)).toContain('还没有审查记录')
    expect(html(<MemoryView data={s.dashboardMemory()} busy={null} onCandidate={noop} />)).toContain('记忆为空')
    expect(html(<EvalView data={{ runs: [] }} selected={[]} notice={null} compared={null} onToggle={noop} onCompare={noop} />)).toContain('尚无评测结果')
    expect(html(<RulesView data={{ ...rulesPayload(s), rules: [] }} filter={{}} onFilter={noop} expanded={null} detail={null} busy={null} onToggle={noop} onAct={noop} />)).toContain('当前筛选下没有规则')
  })

  it('rules page labels engine dimensions and expands one rule with its detail', async () => {
    const s = await store()
    const data = rulesPayload(s)
    const markup = html(<RulesView data={data} filter={{}} onFilter={noop} expanded="CAP-002" detail={s.ruleDetail('CAP-002')} busy={null} onToggle={noop} onAct={noop} />)
    expect(count(markup, 'data-rule-row')).toBe(28)
    expect(markup).toContain('容量')
    expect(markup).toContain(data.rules.find((r) => r.ruleId === 'CAP-002')!.question)
    expect(markup).toContain('校验器')
  })

  it('review detail: 28-row checklist, absence evidence unquoted, decision buttons only on undecided issues', async () => {
    const s = await store()
    const { reviewId } = await s.parse({ source: readFixture('seed-no-impl.md') })
    await s.check(reviewId)
    const detail = reviewDetailPayload(s, reviewId)
    const markup = html(<ReviewDetailView data={detail} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} />)
    expect(count(markup, 'data-check-row')).toBe(28)
    const absence = detail.issues.flatMap((i) => i.evidence).find((e) => e.kind === 'absence')
    expect(absence).toBeDefined()
    expect(markup).toContain('未提及')
    expect(markup).not.toContain(`“${absence!.quote}”`)
    expect(count(markup, 'data-decide="adopt"')).toBe(detail.issues.length)
    expect(markup).not.toContain('需回到对话重新定稿')
  })

  it('review detail highlights a verdict delta and a stale opinion after a post-finalize change', async () => {
    const s = await store({ defaultReviewer: '张三' })
    const { reviewId } = await s.parse({ source: readFixture('seed.md') })
    await s.check(reviewId)
    await s.decide(reviewId, { action: 'adopt_rest' })
    await s.decide(reviewId, { action: 'set_final_verdict', finalVerdict: '通过' })
    await s.finalize(reviewId, async (name) => `reviews/${name}`)
    const finalized = html(<ReviewDetailView data={reviewDetailPayload(s, reviewId)} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} />)
    expect(finalized).toContain('data-verdict-delta')
    expect(finalized).toContain(`reviews/${reviewId}.md`)
    expect(count(finalized, 'data-decide="adopt"')).toBe(0)
    const first = s.issuesOf(reviewId)[0]!
    await s.decide(reviewId, { action: 'reject', issueId: first.issueId, reason: '平台统一限流' })
    const stale = html(<ReviewDetailView data={reviewDetailPayload(s, reviewId)} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} />)
    expect(stale).toContain('需回到对话重新定稿')
  })

  it('memory page shows a drafted candidate with an accept button and a new one without', async () => {
    const s = await store({ defaultReviewer: '张三' })
    const { reviewId } = await s.parse({ source: readFixture('seed.md') })
    await s.check(reviewId)
    await s.decide(reviewId, { action: 'add', text: '补充灰度策略' })
    await s.decide(reviewId, { action: 'add', text: '补充回滚方案' })
    await s.decide(reviewId, { action: 'adopt_rest' })
    await s.decide(reviewId, { action: 'set_final_verdict', finalVerdict: '建议整改' })
    await s.finalize(reviewId, async (name) => `reviews/${name}`)
    await s.rulesPropose({
      action: 'draft',
      candidateId: `rc_${reviewId}_1`,
      draft: ['id: INT-904', 'title: 灰度策略', 'dimension: interface', 'severity: minor', 'tier: soft', 'question: q', 'rationale: r', 'suggestion: s'].join('\n'),
    })
    const markup = html(<MemoryView data={s.dashboardMemory()} busy={null} onCandidate={noop} />)
    expect(count(markup, 'data-candidate-action="accept_draft"')).toBe(1)
    expect(count(markup, 'data-candidate-action="dismiss"')).toBe(2)
    expect(markup).toContain('INT-904')
    expect(markup).toContain('回到对话请 agent 起草')
    expect(count(markup, 'data-memory-rule')).toBe(memoryRulesWithRecords(s.dashboardMemory().rules).length)
  })
})

describe('client source hygiene (T-DSH-12, dashboard.md §4 / §7)', () => {
  const dir = join(packageRoot, 'src', 'client')
  const sources = readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const)

  it('never touches web storage or blocking prompts', () => {
    for (const [file, code] of sources) expect(code, file).not.toMatch(/localStorage|sessionStorage|window\.prompt|window\.confirm/)
  })

  it('uses theme variables instead of hard-coded colours', () => {
    for (const [file, code] of sources) expect(code, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})
