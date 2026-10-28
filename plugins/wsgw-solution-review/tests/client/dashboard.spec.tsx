// Dashboard client: slot registration, pure model helpers, and the presentational views rendered with
// react-dom/server from payloads produced by the real API builders (so client and host cannot drift).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../src/client/index.js'
import {
  DIMENSION_LABEL,
  assistantQueue,
  buildCalendar,
  canReset,
  candidateActions,
  compareNotice,
  countDistinct,
  dedupeExemplars,
  effectiveVerdict,
  evalMetricRows,
  filterRules,
  filterStamps,
  formatDay,
  heatLevel,
  localDayKey,
  markFrequentlyRejected,
  overviewKpis,
  requestJson,
  reviewState,
  slidingAdoptRate,
  toggleCompare,
  trendSeries,
  validateSuggestion,
  type ReviewStamp,
} from '../../src/client/model.js'
import { ReviewsView } from '../../src/client/overview.js'
import { AssistantView } from '../../src/client/pages.js'
import { ReviewDetailView } from '../../src/client/review-detail.js'
import { RulesView } from '../../src/client/rules.js'
import { EvalView } from '../../src/client/eval.js'
import { overviewPayload, reviewDetailPayload, rulesPayload } from '../../src/host/api.js'
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
const local = (y: number, m: number, d: number, h = 10, min = 0): string => new Date(y, m - 1, d, h, min).toISOString()
const TODAY = new Date(2026, 9, 28, 15, 0)

let seq = 0
function stamp(partial: Partial<ReviewStamp> = {}): ReviewStamp {
  seq += 1
  return {
    reviewId: `rv_20261028_s${String(seq).padStart(5, '0')}`,
    title: `方案 ${seq}`,
    createdAt: local(2026, 10, 28),
    state: 'open',
    aiVerdict: '建议整改',
    counts: { total: 0, confirmed: 0, pending: 0, adopted: 0, rejected: 0, rewritten: 0 },
    ...partial,
  }
}

const viewDefaults = {
  today: TODAY,
  filter: {},
  onFilter: noop,
  chart: 'calendar' as const,
  onChart: noop,
  expanded: null,
  onToggle: noop,
  detail: null,
  limit: 50,
  onMore: noop,
}

describe('registration (T-DSH-01)', () => {
  it('registers the left-panel entry, its main panel and the right-sidebar assistant', () => {
    const lists: { name: string; def: any; component: unknown }[] = []
    const tabs: unknown[] = []
    const selectPanel = vi.fn()
    const ctx = {
      effect: (fn: () => unknown) => fn(),
      layout: { selectPanel },
      sidebarRightTabs: { register: (def: unknown) => { tabs.push(def); return noop } },
      slots: {
        inject: (name: string, cb: () => unknown) => { lists.push({ name, def: undefined, component: undefined }); cb(); return noop },
        register: (def: any, component: unknown) => { lists[lists.length - 1] = { name: def.name, def, component }; return noop },
      },
    }
    expect(client.name).toBe('wsgw-solution-review')
    expect(client.inject).toEqual(['slots', 'sidebarRightTabs', 'layout'])
    client.apply(ctx)

    const main = lists.find((l) => l.name === 'main')!
    expect(main.def).toMatchObject({ name: 'main', key: client.PANEL_ID })
    expect(main.component).toBe(client.OverviewPage)
    const entry = lists.find((l) => l.name === 'sidebar.panellist')!
    expect(entry.def).toMatchObject({ name: 'sidebar.panellist', id: client.PANEL_ID, order: 30 })
    expect(entry.def.label()).toBe('方案审查')
    expect(entry.component).toBe(client.PanelIcon)

    expect(tabs).toEqual([client.TAB_DEFINITION])
    expect(client.TAB_DEFINITION).toMatchObject({ id: client.TAB_ID, kind: 'wsgw-review', priority: 'extension', keepMounted: true })
    expect(client.TAB_DEFINITION.title()).toBe('复核助手')
    expect(client.TAB_DEFINITION.guide).toHaveLength(1)
    expect(client.TAB_DEFINITION.guide[0]).toMatchObject({ id: 'assistant', order: 50 })
    expect(client.TAB_DEFINITION.guide[0]!.title()).toBe('方案审查 · 复核助手')
    const body = lists.find((l) => l.name === 'sidebar.right.pane.tab')!
    expect(body.def).toMatchObject({ name: 'sidebar.right.pane.tab', key: client.TAB_ID })
    expect(body.component).toBe(client.ReviewAssistant)
    body.def.inject().openOverview()
    expect(selectPanel).toHaveBeenCalledWith(client.PANEL_ID)
  })

  it('the panel icon is an inline SVG sized by the sidebar and coloured by currentColor', () => {
    const markup = html(<client.PanelIcon size={18} active={false} />)
    expect(markup).toMatch(/^<svg/)
    expect(markup).toContain('width="18"')
    expect(markup).toContain('currentColor')
  })
})

describe('overview model (T-DSH-13, T-DSH-14, T-DSH-15, T-DSH-16, T-DSH-17)', () => {
  it('buckets by browser-local day, not by the UTC date of the ISO string', () => {
    expect(localDayKey(local(2026, 10, 27, 23, 30))).toBe('2026-10-27')
    expect(localDayKey(local(2026, 10, 28, 0, 10))).toBe('2026-10-28')
    expect(formatDay('2026-10-27')).toBe('10月27日')
  })

  it('calendar: 53 Monday-first weeks ending with the current week, future cells blank, levels by max', () => {
    const items = [
      stamp({ createdAt: local(2026, 10, 27, 23, 30) }),
      stamp({ createdAt: local(2026, 10, 28, 0, 10), state: 'finalized' }),
      stamp({ createdAt: local(2026, 10, 28, 9) }),
      stamp({ createdAt: local(2026, 10, 28, 14), state: 'finalized' }),
      stamp({ createdAt: local(2026, 10, 1) }),
      stamp({ createdAt: local(2026, 10, 1) }),
      stamp({ createdAt: local(2024, 1, 1) }),
    ]
    const cal = buildCalendar(items, TODAY)
    expect(cal.weeks).toHaveLength(53)
    for (const week of cal.weeks) expect(week).toHaveLength(7)
    expect(cal.weeks[0]![0]!.date).toBe('2025-10-27')
    const last = cal.weeks[52]!
    expect(last.map((c) => c.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(last.map((c) => c.future)).toEqual([false, false, false, true, true, true, true])
    expect(last[1]).toMatchObject({ count: 1, finalized: 0, level: 2 })
    expect(last[2]).toMatchObject({ count: 3, finalized: 2, level: 4 })
    expect(last[3]).toMatchObject({ count: 0, level: 0 })
    expect(cal.max).toBe(3)
    expect(cal.total).toBe(6)
    expect(cal.months[0]).toEqual({ index: 1, label: '11月' })
    expect(cal.months.at(-1)).toEqual({ index: 49, label: '10月' })
    expect(cal.months).toHaveLength(12)
    expect([heatLevel(0, 5), heatLevel(1, 5), heatLevel(2, 5), heatLevel(4, 5), heatLevel(5, 5)]).toEqual([0, 1, 2, 4, 4])
  })

  it('trend: the last 30 local days, created by createdAt and finalized by finalizedAt', () => {
    const series = trendSeries([
      stamp({ createdAt: local(2026, 10, 27, 23, 30), finalizedAt: local(2026, 10, 28, 0, 30), state: 'finalized' }),
      stamp({ createdAt: local(2026, 9, 29) }),
      stamp({ createdAt: local(2026, 9, 28, 23) }),
    ], TODAY)
    expect(series).toHaveLength(30)
    expect(series[0]).toEqual({ date: '2026-09-29', created: 1, finalized: 0 })
    expect(series.at(-2)).toEqual({ date: '2026-10-27', created: 1, finalized: 0 })
    expect(series.at(-1)).toEqual({ date: '2026-10-28', created: 0, finalized: 1 })
  })

  it('KPIs: total, last 30 days, pending incl. stale, adopt rate with rewrite as adopt, verdict agreement', () => {
    const counts = (adopted: number, rejected: number, rewritten: number) => ({ total: adopted + rejected + rewritten, confirmed: 0, pending: 0, adopted, rejected, rewritten })
    const items = [
      stamp({ state: 'open' }),
      stamp({ state: 'stale', createdAt: local(2026, 10, 10), counts: counts(2, 1, 1) }),
      stamp({ state: 'finalized', createdAt: local(2026, 8, 1), aiVerdictAtFinalize: '建议整改', finalVerdict: '建议整改', counts: counts(3, 0, 0) }),
      stamp({ state: 'finalized', createdAt: local(2026, 10, 20), aiVerdictAtFinalize: '通过', finalVerdict: '建议整改' }),
      stamp({ state: 'finalized', createdAt: local(2026, 9, 29), aiVerdictAtFinalize: '通过' }),
    ]
    expect(overviewKpis(items, TODAY)).toEqual({
      total: 5, last30: 4, pending: 2, stale: 1, adoptRate: 6 / 7, decided: 7, agreement: 0.5, agreementSample: 2,
    })
    expect(overviewKpis([], TODAY)).toMatchObject({ total: 0, adoptRate: null, agreement: null, agreementSample: 0 })
  })

  it('list filters by state (pending = open + stale), effective verdict, search and day', () => {
    const a = stamp({ state: 'open', title: '支付渠道接入', reviewer: '张三' })
    const b = stamp({ state: 'stale', aiVerdict: '通过', finalVerdict: '不通过', createdAt: local(2026, 10, 27, 23, 30) })
    const c = stamp({ state: 'finalized', aiVerdict: '不通过', finalVerdict: '通过' })
    const all = [a, b, c]
    expect(effectiveVerdict(b)).toBe('不通过')
    expect(effectiveVerdict(a)).toBe('建议整改')
    expect(filterStamps(all, {})).toEqual(all)
    expect(filterStamps(all, { state: 'pending' })).toEqual([a, b])
    expect(filterStamps(all, { state: 'finalized' })).toEqual([c])
    expect(filterStamps(all, { verdict: '不通过' })).toEqual([b])
    expect(filterStamps(all, { query: '支付' })).toEqual([a])
    expect(filterStamps(all, { query: '张三' })).toEqual([a])
    expect(filterStamps(all, { query: c.reviewId.toUpperCase() })).toEqual([c])
    expect(filterStamps(all, { day: '2026-10-27' })).toEqual([b])
    expect(filterStamps(all, { state: 'pending', day: '2026-10-28' })).toEqual([a])
  })

  it('assistant queue keeps only open / stale reviews, newest first', () => {
    const old = stamp({ state: 'open', createdAt: local(2026, 10, 1) })
    const done = stamp({ state: 'finalized' })
    const fresh = stamp({ state: 'stale', createdAt: local(2026, 10, 28, 11) })
    expect(assistantQueue([old, done, fresh]).map((s) => s.reviewId)).toEqual([fresh.reviewId, old.reviewId])
    expect(assistantQueue([done])).toEqual([])
  })

  it('reviewState distinguishes open, finalized and stale (decisions changed after finalize)', () => {
    expect(reviewState({ status: 'open', versions: [] })).toBe('open')
    expect(reviewState({ status: 'finalized', versions: [{ version: 1, path: 'p', at: 'a' }] })).toBe('finalized')
    expect(reviewState({ status: 'open', versions: [{ version: 1, path: 'p', at: 'a' }] })).toBe('stale')
  })
})

describe('rules model (T-DSH-03, T-DSH-05, T-DSH-06, T-DSH-07)', () => {
  it('dimension labels cover the engine dimensions; filters by dimension, tier, status, search and overridden', async () => {
    expect(Object.keys(DIMENSION_LABEL).sort()).toEqual(
      ['capacity', 'channel', 'config', 'data_sync', 'documentation', 'interface', 'monitoring', 'security'],
    )
    for (const rule of shippedPack().rules) expect(DIMENSION_LABEL[rule.dimension], rule.id).toBeTruthy()
    const s = await store()
    const rules = rulesPayload(s).rules
    expect(filterRules(rules, { dimension: 'capacity' }).length).toBeGreaterThan(0)
    expect(filterRules(rules, { dimension: 'capacity', tier: 'hard' }).every((r) => r.dimension === 'capacity' && r.tier === 'hard')).toBe(true)
    expect(filterRules(rules, { status: 'retired' })).toEqual([])
    expect(filterRules(rules, { query: 'cap-002' }).map((r) => r.ruleId)).toEqual(['CAP-002'])
    const title = rules.find((r) => r.ruleId === 'CAP-002')!.title
    expect(filterRules(rules, { query: title }).map((r) => r.ruleId)).toContain('CAP-002')
    expect(filterRules(rules, { overriddenOnly: true })).toEqual([])
    await s.rulesPropose({ action: 'set_severity', ruleId: 'CAP-002', severity: 'minor' })
    expect(filterRules(rulesPayload(s).rules, { overriddenOnly: true }).map((r) => r.ruleId)).toEqual(['CAP-002'])
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

  it('suggestion edits need 1–500 non-blank characters; reset only for overridden shipped rules', async () => {
    expect(validateSuggestion('   ')).toBe('整改建议不能为空')
    expect(validateSuggestion('x'.repeat(501))).toBe('整改建议最长 500 字')
    expect(validateSuggestion(' 补充压测报告 ')).toBeNull()
    const s = await store()
    expect(canReset(s.ruleDetail('CAP-002'))).toBe(false)
    await s.rulesPropose({ action: 'set_suggestion', ruleId: 'CAP-002', suggestion: '新建议' })
    expect(canReset(s.ruleDetail('CAP-002'))).toBe(true)
    await s.rulesPropose({
      action: 'draft',
      draft: ['id: INT-907', 'title: 灰度策略', 'dimension: interface', 'severity: minor', 'tier: soft', 'question: q', 'rationale: r', 'suggestion: s'].join('\n'),
    })
    expect(canReset(s.ruleDetail('INT-907'))).toBe(false)
  })

  it('repeated exemplars and reject reasons collapse into one line with a count', () => {
    const e = (kind: 'adopt' | 'rewrite', text: string) => ({ ruleId: 'CAP-002', kind, text, reviewId: 'r', at: 'a' })
    expect(dedupeExemplars([e('adopt', '补充压测'), e('adopt', '补充压测 '), e('rewrite', '补充压测'), e('adopt', '另一条')]).map((x) => [x.kind, x.text.trim(), x.times]))
      .toEqual([['adopt', '补充压测', 2], ['rewrite', '补充压测', 1], ['adopt', '另一条', 1]])
    expect(countDistinct(['a', 'b', 'a'])).toEqual([{ text: 'a', times: 2 }, { text: 'b', times: 1 }])
  })

  it('candidates expose only legal actions', () => {
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

describe('reviews tab (T-DSH-02, T-DSH-13, T-DSH-14, T-DSH-15, T-DSH-16)', () => {
  it('empty data: KPI cards, a blank 53×7 calendar and the empty-list state', async () => {
    const markup = html(<ReviewsView {...viewDefaults} data={overviewPayload(await store())} />)
    for (const label of ['累计审查', '近 30 天', '待处理', '问题采纳率', '结论一致率']) expect(markup).toContain(label)
    expect(count(markup, 'data-heat-cell')).toBe(53 * 7)
    expect(count(markup, 'data-level="0"')).toBe(53 * 7)
    expect(markup).toContain('还没有审查记录')
    expect(markup).toContain('role="group" aria-label="近 53 周每日发起的审查数，共 0 份')
  })

  it('trend mode draws the created and finalized lines', async () => {
    const markup = html(<ReviewsView {...viewDefaults} chart="trend" data={overviewPayload(await store())} />)
    expect(markup).toContain('data-trend-line="created"')
    expect(markup).toContain('data-trend-line="finalized"')
    expect(markup).toContain('role="img" aria-label="近 30 天：发起 0 份，定稿 0 份"')
    expect(markup).not.toContain('data-heat-cell')
  })

  it('rows show verdicts and counts; one expanded row renders the given detail; filters can empty the list', async () => {
    const s = await store({ defaultReviewer: '张三' })
    const a = (await s.parse({ source: readFixture('seed.md'), title: '甲方案' })).reviewId
    await s.check(a)
    const b = (await s.parse({ source: readFixture('seed-compliant.md'), title: '乙方案' })).reviewId
    const data = overviewPayload(s)
    const markup = html(<ReviewsView {...viewDefaults} data={data} expanded={a} detail={<div data-probe>detail-of-a</div>} />)
    expect(count(markup, 'data-review-row')).toBe(2)
    expect(count(markup, 'data-review-expanded')).toBe(1)
    expect(markup).toContain('detail-of-a')
    expect(markup).toContain('甲方案')
    expect(markup).toContain('乙方案')
    expect(markup).toContain('未定')
    expect(markup).toContain(`aria-expanded="true"`)
    expect(b).toMatch(/^rv_/)
    const none = html(<ReviewsView {...viewDefaults} data={data} filter={{ state: 'finalized' }} />)
    expect(none).toContain('当前筛选下没有方案')
    const day = html(<ReviewsView {...viewDefaults} data={data} filter={{ day: '2026-10-19' }} />)
    expect(day).toContain('10月19日')
  })

  it('pages the list by the given limit with a show-more button', async () => {
    const s = await store()
    for (let i = 0; i < 3; i += 1) await s.parse({ source: `# 方案 ${i}\n\n正文`, title: `方案 ${i}` })
    const markup = html(<ReviewsView {...viewDefaults} data={overviewPayload(s)} limit={2} />)
    expect(count(markup, 'data-review-row')).toBe(2)
    expect(markup).toContain('显示更多（剩余 1）')
  })
})

describe('review detail (T-DSH-04)', () => {
  it('28-row checklist, absence evidence unquoted, decision buttons only on undecided issues', async () => {
    const s = await store()
    const { reviewId } = await s.parse({ source: readFixture('seed-no-impl.md') })
    await s.check(reviewId)
    const detail = reviewDetailPayload(s, reviewId)
    const markup = html(<ReviewDetailView data={detail} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} />)
    expect(count(markup, 'data-check-row')).toBe(28)
    expect(markup).toContain('<details')
    const absence = detail.issues.flatMap((i) => i.evidence).find((e) => e.kind === 'absence')
    expect(absence).toBeDefined()
    expect(markup).toContain('未提及')
    expect(markup).not.toContain(`“${absence!.quote}”`)
    expect(count(markup, 'data-decide="adopt"')).toBe(detail.issues.length)
    expect(markup).not.toContain('需回到对话重新定稿')
  })

  it('highlights a verdict delta and a stale opinion after a post-finalize change', async () => {
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
})

describe('rules tab (T-DSH-02, T-DSH-03, T-DSH-05)', () => {
  const rulesDefaults = { filter: {}, onFilter: noop, expanded: null, detail: null, busy: null, onToggle: noop, onAct: noop, onCandidate: noop }

  it('empty filter result and 28 rows with engine dimension labels', async () => {
    const s = await store()
    const data = rulesPayload(s)
    expect(html(<RulesView {...rulesDefaults} data={{ ...data, rules: [] }} memory={s.dashboardMemory()} />)).toContain('当前筛选下没有规则')
    const markup = html(<RulesView {...rulesDefaults} data={data} memory={s.dashboardMemory()} />)
    expect(count(markup, 'data-rule-row')).toBe(28)
    expect(markup).toContain('容量')
    expect(markup).toContain(`28 / 28 条 · 规则包 ${data.version}`)
  })

  it('an expanded shipped rule offers status, severity and suggestion edits; reset appears only once overridden', async () => {
    const s = await store()
    const plain = html(<RulesView {...rulesDefaults} data={rulesPayload(s)} memory={s.dashboardMemory()} expanded="CAP-002" detail={s.ruleDetail('CAP-002')} />)
    expect(count(plain, 'data-rule-detail')).toBe(1)
    expect(plain).toContain(s.ruleDetail('CAP-002').detail.question)
    expect(plain).toContain('data-rule-suggestion')
    expect(plain).toContain('保存建议')
    expect(plain).toContain('停用')
    expect(plain).toContain('样本不足')
    expect(plain).not.toContain('data-rule-reset')
    await s.rulesPropose({ action: 'set_severity', ruleId: 'CAP-002', severity: 'minor', who: 'dashboard' })
    const changed = html(<RulesView {...rulesDefaults} data={rulesPayload(s)} memory={s.dashboardMemory()} expanded="CAP-002" detail={s.ruleDetail('CAP-002')} />)
    expect(changed).toContain('data-rule-reset')
    expect(changed).toContain('恢复出厂')
    expect(changed).toContain('已覆盖')
    expect(changed).toContain('dashboard')
  })

  it('candidates appear above the table with only legal actions; a draft rule has no reset', async () => {
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
    const markup = html(<RulesView {...rulesDefaults} data={rulesPayload(s)} memory={s.dashboardMemory()} expanded="INT-904" detail={s.ruleDetail('INT-904')} />)
    expect(count(markup, 'data-candidate-action="accept_draft"')).toBe(1)
    expect(count(markup, 'data-candidate-action="dismiss"')).toBe(2)
    expect(markup).toContain('回到对话请 agent 起草')
    expect(markup.indexOf('data-candidate-action')).toBeLessThan(markup.indexOf('data-rule-row'))
    expect(markup).not.toContain('data-rule-reset')
  })
})

describe('closed records and plain-language labels (T-DSH-18, T-DSH-19)', () => {
  it('closed stamps stay out of KPIs, calendar, trend, the assistant and the default list', () => {
    const live = stamp({ state: 'open' })
    const closed = stamp({ state: 'closed', closedReason: '被 rv_20261028_aaaaaa 取代', finalizedAt: local(2026, 10, 28, 12) })
    const items = [live, closed]
    expect(overviewKpis(items, TODAY)).toMatchObject({ total: 1, last30: 1, pending: 1 })
    expect(buildCalendar(items, TODAY).total).toBe(1)
    expect(trendSeries(items, TODAY).at(-1)).toMatchObject({ created: 1, finalized: 0 })
    expect(assistantQueue(items)).toEqual([live])
    expect(filterStamps(items, {})).toEqual([live])
    expect(filterStamps(items, { state: 'pending' })).toEqual([live])
    expect(filterStamps(items, { state: 'closed' })).toEqual([closed])
    expect(reviewState({ status: 'superseded', versions: [] })).toBe('closed')
    expect(reviewState({ status: 'discarded', versions: [{ version: 1, path: 'p', at: 'a' }] })).toBe('closed')
  })

  it('the 已作废 chip shows only when closed records exist; closed rows are hidden by default', async () => {
    const s = await store()
    await s.parse({ source: readFixture('seed.md') })
    const none = html(<ReviewsView {...viewDefaults} data={overviewPayload(s)} />)
    expect(none).not.toContain('data-state-filter="closed"')
    await s.parse({ source: readFixture('seed.md'), reuse: false })
    const data = overviewPayload(s)
    const markup = html(<ReviewsView {...viewDefaults} data={data} />)
    expect(markup).toContain('data-state-filter="closed"')
    expect(count(markup, 'data-review-row')).toBe(1)
    expect(markup).toContain('累计审查')
    const closedOnly = html(<ReviewsView {...viewDefaults} data={data} filter={{ state: 'closed' }} />)
    expect(count(closedOnly, 'data-review-row')).toBe(1)
    expect(closedOnly).toContain('已作废')
  })

  it('a closed review is read-only and says why; an active one offers a two-step discard', async () => {
    const s = await store()
    const first = (await s.parse({ source: readFixture('seed.md') })).reviewId
    await s.check(first)
    const active = html(<ReviewDetailView data={reviewDetailPayload(s, first)} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} onDiscard={noop} />)
    expect(active).toContain('data-discard')
    expect(active).toContain('作废这条记录')
    const second = (await s.parse({ source: readFixture('seed.md'), reuse: false })).reviewId
    const closed = html(<ReviewDetailView data={reviewDetailPayload(s, first)} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} onDiscard={noop} />)
    expect(closed).toContain(`已被 ${second} 取代`)
    expect(closed).not.toContain('data-decide=')
    expect(closed).not.toContain('data-discard')
    expect(closed).not.toContain('aria-label="审核人"')
  })

  it('issues show Chinese levels, proposer and gate reasons', async () => {
    const s = await store()
    const { reviewId } = await s.parse({ source: readFixture('seed.md') })
    await s.check(reviewId)
    await s.recordIssue(reviewId, { finding: '没写灰度怎么做', suggestion: '在“上线计划”一节写清灰度比例和回退条件', evidence: [{ quote: '通过支付宝小程序' }] })
    const markup = html(<ReviewDetailView data={reviewDetailPayload(s, reviewId)} busy={false} onDecide={noop} onReviewer={noop} onVerdict={noop} />)
    expect(markup).toContain('没有对应规则')
    expect(markup).not.toContain('NO_RULE')
    expect(markup).toMatch(/严重|一般|轻微/)
    expect(markup).not.toMatch(/>(blocker|major|minor)</)
    expect(markup).toContain('程序检查')
  })

  it('rules read 严重 / 一般 / 轻微 and 程序检查 / AI 辅助 / 人工判断 with a legend; no source line or edit hint', async () => {
    const s = await store({ minorThreshold: 4 })
    const rulesDefaults = { filter: {}, onFilter: noop, busy: null, onToggle: noop, onAct: noop, onCandidate: noop }
    const markup = html(<RulesView {...rulesDefaults} data={rulesPayload(s)} memory={s.dashboardMemory()} expanded="CAP-002" detail={s.ruleDetail('CAP-002')} />)
    expect(markup).toContain('data-severity-legend')
    expect(markup).toContain('累计 4 条才建议整改')
    for (const word of ['严重', '一般', '轻微', '程序检查', 'AI 辅助', '人工判断']) expect(markup).toContain(word)
    expect(markup).not.toMatch(/>(blocker|major|minor)</)
    expect(markup).not.toContain('来源：')
    expect(markup).not.toContain('legacy:')
    expect(markup).not.toContain('不在看板')
  })
})

describe('assistant and eval (T-DSH-02, T-DSH-17)', () => {
  it('assistant: empty state with an open-overview button; a picker when more than one review is pending', () => {
    const empty = html(<AssistantView queue={[]} selected={null} onSelect={noop} detail={null} onOpenOverview={noop} onRefresh={noop} />)
    expect(empty).toContain('没有待处理的审查')
    expect(empty).toContain('data-open-overview')
    const one = stamp({ title: '甲' })
    expect(html(<AssistantView queue={[one]} selected={one.reviewId} onSelect={noop} detail={<i>d</i>} onOpenOverview={noop} onRefresh={noop} />)).not.toContain('<select')
    const two = html(<AssistantView queue={[one, stamp({ title: '乙', state: 'stale' })]} selected={one.reviewId} onSelect={noop} detail={<i>d</i>} onOpenOverview={noop} onRefresh={noop} />)
    expect(count(two, '<option')).toBe(2)
    expect(two).toContain('需重新定稿')
    expect(two).toContain('<i>d</i>')
  })

  it('eval shows its empty state', () => {
    expect(html(<EvalView data={{ runs: [] }} selected={[]} notice={null} compared={null} onToggle={noop} onCompare={noop} />)).toContain('尚无评测结果')
  })
})

describe('client source hygiene (T-DSH-12, dashboard.md §5 / §7)', () => {
  const dir = join(packageRoot, 'src', 'client')
  const sources = readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const)

  it('never touches web storage or blocking prompts', () => {
    for (const [file, code] of sources) expect(code, file).not.toMatch(/localStorage|sessionStorage|window\.prompt|window\.confirm/)
  })

  it('uses theme variables instead of hard-coded colours', () => {
    for (const [file, code] of sources) expect(code, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})
