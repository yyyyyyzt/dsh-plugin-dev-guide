// Dashboard data model: payload types come from the host builders, so the client cannot drift from the API.
import type { Dimension, IssueOrigin, IssueStatus, RuleStats, Severity, Tier, Verdict, ChecklistStatus, RuleStatus } from '../engine/types.js'
import type { OverviewPayload, ReviewDetailPayload, RulesPayload, ReviewStamp, ReviewState, ReviewView } from '../host/api-types.js'
import type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, RuleDetailPayload, RuleView, SlidingAdoptPoint } from '../host/store.js'
import type { RuleCandidateRecord } from '../store/domain.js'

export { reviewState } from '../host/api-types.js'
export type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, OverviewPayload, ReviewDetailPayload, ReviewStamp, ReviewState, ReviewView, RuleDetailPayload, RulesPayload, RuleView }

export const API_PREFIX = '/plugins/wsgw-solution-review/api'
export const PAGE_SIZE = 50
export const MAX_COMPARE = 7
export const SUGGESTION_MAX = 500

export interface EvalRunsPayload {
  runs: DashboardEvalRun[]
}

export interface RuleFilter {
  dimension?: Dimension | undefined
  tier?: Tier | undefined
  status?: RuleStatus | undefined
  query?: string | undefined
  overriddenOnly?: boolean | undefined
}

export type DecideBody = { action: 'adopt' } | { action: 'reject'; reason?: string } | { action: 'rewrite'; text: string }
export type RuleAction =
  | { action: 'disable' }
  | { action: 'enable' }
  | { action: 'set_severity'; severity: Severity }
  | { action: 'set_suggestion'; suggestion: string }
  | { action: 'reset' }
export type CandidateAction = 'accept_draft' | 'dismiss'

export const DIMENSION_LABEL: Record<Dimension, string> = {
  capacity: '容量',
  security: '安全',
  interface: '接口',
  channel: '渠道',
  data_sync: '数据同步',
  config: '配置',
  monitoring: '监控',
  documentation: '文档',
}
export const TIER_LABEL: Record<Tier, string> = { hard: '程序检查', hybrid: 'AI 辅助', soft: '人工判断' }
export const SEVERITY_LABEL: Record<Severity, string> = { blocker: '严重', major: '一般', minor: '轻微' }
export const RULE_STATUS_LABEL: Record<RuleStatus, string> = { active: '启用', draft: '草案', retired: '停用' }
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  confirmed: '已确认',
  pending: '待人工',
  adopted: '已采纳',
  rejected: '已驳回',
  rewritten: '已改写',
}
export const ORIGIN_LABEL: Record<IssueOrigin, string> = { verifier: '程序检查', llm: 'AI', expert: '专家' }
export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  pass: '通过',
  fail: '未通过',
  candidate: '待判断',
  pending: '待人工',
  'not-applicable': '不适用',
  soft: '人工判断',
  'reviewed-no-issue': '已审阅无问题',
}
export const CANDIDATE_STATUS_LABEL: Record<RuleCandidateRecord['status'], string> = {
  new: '新',
  drafted: '已起草',
  accepted: '已接受',
  dismissed: '已忽略',
}
export const REVIEW_STATE_LABEL: Record<ReviewState, string> = { open: '进行中', finalized: '已定稿', stale: '需重新定稿', closed: '已作废' }
export const VERDICTS: readonly Verdict[] = ['通过', '建议整改', '不通过']
export const GATE_REASON_LABEL: Record<string, string> = {
  NO_RULE: '没有对应规则',
  SOFT_RULE: '人工判断类规则',
  NO_EVIDENCE: '没有给出引文',
  QUOTE_TOO_SHORT: '引文太短',
  QUOTE_TOO_LONG: '引文太长',
  QUOTE_NOT_FOUND: '引文在原文中找不到',
  OUT_OF_CANDIDATES: '引文不在程序找出的片段里',
  ABSENCE_NOT_ALLOWED: '不能用「未提及」作证据',
}

/** Severity in plain words for the rules legend; minorThreshold comes from GET /rules. */
export function severityLegend(minorThreshold: number): { severity: Severity; text: string }[] {
  return [
    { severity: 'blocker', text: '出现一条就建议不通过' },
    { severity: 'major', text: '出现一条就建议整改' },
    { severity: 'minor', text: `累计 ${minorThreshold} 条才建议整改` },
  ]
}

export const TIER_HINT: Record<Tier, string> = {
  hard: '程序直接判定',
  hybrid: '程序找出片段，AI 判断',
  soft: 'AI 只提示，由专家定',
}

const live = (items: ReviewStamp[]): ReviewStamp[] => items.filter((s) => s.state !== 'closed')

export function filterRules(rules: RuleView[], filter: RuleFilter): RuleView[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return rules.filter((r) => (!filter.dimension || r.dimension === filter.dimension)
    && (!filter.tier || r.tier === filter.tier)
    && (!filter.status || r.status === filter.status)
    && (!filter.overriddenOnly || r.overridden)
    && (!query || r.ruleId.toLowerCase().includes(query) || r.title.toLowerCase().includes(query)))
}

/** Same defaults as memory_recall.warn (rejectWarnRatio 0.6, rejectWarnMinSamples 5); the browser does not read Host config. */
export function markFrequentlyRejected(stats: RuleStats, cfg: { minShown?: number; ratio?: number } = {}): boolean {
  const minShown = cfg.minShown ?? 5
  const ratio = cfg.ratio ?? 0.6
  return stats.shown >= minShown && stats.shown > 0 && stats.reject / stats.shown >= ratio
}

export function slidingAdoptRate(series: SlidingAdoptPoint[]): { rate: number | null; sample: number; insufficient: boolean } {
  const recent = series.slice(-5)
  const decided = recent.reduce((n, p) => n + p.adopted + p.rejected + p.rewritten, 0)
  const adopted = recent.reduce((n, p) => n + p.adopted, 0)
  return { rate: decided === 0 ? null : adopted / decided, sample: decided, insufficient: decided < 5 }
}

export function memoryByRule(memory: DashboardMemory | null): Map<string, DashboardMemoryRule> {
  return new Map((memory?.rules ?? []).map((r) => [r.ruleId, r]))
}

export function countDistinct(texts: string[]): { text: string; times: number }[] {
  const out = new Map<string, number>()
  for (const t of texts) out.set(t, (out.get(t) ?? 0) + 1)
  return [...out].map(([text, times]) => ({ text, times }))
}

/** Same wording adopted again and again is one exemplar, not many. */
export function dedupeExemplars<T extends { kind: string; text: string }>(exemplars: T[]): (T & { times: number })[] {
  const out = new Map<string, T & { times: number }>()
  for (const e of exemplars) {
    const key = `${e.kind}\u0000${e.text.trim()}`
    const seen = out.get(key)
    if (seen) seen.times += 1
    else out.set(key, { ...e, times: 1 })
  }
  return [...out.values()]
}

export function openCandidates(memory: DashboardMemory | null): DashboardMemory['candidates'] {
  return (memory?.candidates ?? []).filter((c) => c.status === 'new' || c.status === 'drafted')
}

export function validateSuggestion(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return '整改建议不能为空'
  if (trimmed.length > SUGGESTION_MAX) return `整改建议最长 ${SUGGESTION_MAX} 字`
  return null
}

/** Reset only makes sense for a shipped rule that currently carries a learned-layer override. */
export function canReset(detail: RuleDetailPayload): boolean {
  return detail.detail.shipped !== undefined && detail.detail.override !== undefined
}

export function candidateActions(candidate: Pick<RuleCandidateRecord, 'status' | 'draftRuleId'>): CandidateAction[] {
  if (candidate.status === 'drafted' && candidate.draftRuleId) return ['accept_draft', 'dismiss']
  if (candidate.status === 'new' || candidate.status === 'drafted') return ['dismiss']
  return []
}

export function toggleCompare(selected: string[], runId: string): { selected: string[]; notice?: string } {
  if (selected.includes(runId)) return { selected: selected.filter((id) => id !== runId) }
  if (selected.length >= MAX_COMPARE) return { selected, notice: `最多选择 ${MAX_COMPARE} 个 run` }
  return { selected: [...selected, runId] }
}

export function compareNotice(selected: string[]): string | null {
  return selected.length < 2 ? '至少选择 2 个 run 才能对比' : null
}

export function evalMetricRows(runs: DashboardEvalRun[]): { metric: string; values: (number | null)[] }[] {
  const metrics = (run: DashboardEvalRun): Record<string, unknown> => (run.metrics ?? {}) as Record<string, unknown>
  const keys: string[] = []
  for (const run of runs) {
    for (const [key, value] of Object.entries(metrics(run))) {
      if (typeof value === 'number' && !keys.includes(key)) keys.push(key)
    }
  }
  return keys.map((metric) => ({
    metric,
    values: runs.map((run) => {
      const value = metrics(run)[metric]
      return typeof value === 'number' ? value : null
    }),
  }))
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

// ---------- overview: local-day buckets, calendar, trend, KPIs, filters ----------

const pad = (n: number): string => String(n).padStart(2, '0')

export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The browser-local calendar day of an ISO timestamp (the host only stores UTC instants). */
export function localDayKey(iso: string): string {
  return dayKeyOf(new Date(iso))
}

function dateOfKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function formatDay(key: string): string {
  const date = dateOfKey(key)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatShortDay(key: string): string {
  const date = dateOfKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export interface CalendarCell {
  date: string
  count: number
  finalized: number
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
}

export interface Calendar {
  /** Columns oldest → newest; each column is Monday … Sunday. */
  weeks: CalendarCell[][]
  max: number
  total: number
  months: { index: number; label: string }[]
}

export function heatLevel(count: number, max: number): CalendarCell['level'] {
  if (count <= 0 || max <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as CalendarCell['level']
}

function bucket(items: ReviewStamp[], key: (s: ReviewStamp) => string | undefined): Map<string, ReviewStamp[]> {
  const out = new Map<string, ReviewStamp[]>()
  for (const item of items) {
    const day = key(item)
    if (day === undefined) continue
    const list = out.get(day)
    if (list) list.push(item)
    else out.set(day, [item])
  }
  return out
}

export function buildCalendar(items: ReviewStamp[], today: Date, weeks = 53): Calendar {
  const byDay = bucket(live(items), (s) => localDayKey(s.createdAt))
  const todayKey = dayKeyOf(today)
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const start = addDays(monday, -7 * (weeks - 1))
  const raw: { date: string; count: number; finalized: number; future: boolean }[][] = []
  for (let w = 0; w < weeks; w += 1) {
    const column = []
    for (let d = 0; d < 7; d += 1) {
      const date = dayKeyOf(addDays(start, w * 7 + d))
      const future = date > todayKey
      const list = future ? [] : byDay.get(date) ?? []
      column.push({ date, count: list.length, finalized: list.filter((s) => s.state === 'finalized').length, future })
    }
    raw.push(column)
  }
  const cells = raw.flat()
  const max = cells.reduce((m, c) => Math.max(m, c.count), 0)
  const total = cells.reduce((n, c) => n + c.count, 0)
  const months: Calendar['months'] = []
  for (let i = 1; i < raw.length; i += 1) {
    const month = dateOfKey(raw[i]![0]!.date).getMonth()
    if (month !== dateOfKey(raw[i - 1]![0]!.date).getMonth()) months.push({ index: i, label: `${month + 1}月` })
  }
  return { weeks: raw.map((col) => col.map((c) => ({ ...c, level: heatLevel(c.count, max) }))), max, total, months }
}

export interface TrendPoint {
  date: string
  created: number
  finalized: number
}

export function trendSeries(items: ReviewStamp[], today: Date, days = 30): TrendPoint[] {
  const created = bucket(live(items), (s) => localDayKey(s.createdAt))
  const finalized = bucket(live(items), (s) => (s.finalizedAt ? localDayKey(s.finalizedAt) : undefined))
  return Array.from({ length: days }, (_, i) => {
    const date = dayKeyOf(addDays(today, i - days + 1))
    return { date, created: created.get(date)?.length ?? 0, finalized: finalized.get(date)?.length ?? 0 }
  })
}

export interface OverviewKpis {
  total: number
  last30: number
  pending: number
  stale: number
  adoptRate: number | null
  decided: number
  agreement: number | null
  agreementSample: number
}

export function overviewKpis(all: ReviewStamp[], today: Date): OverviewKpis {
  const items = live(all)
  const since = dayKeyOf(addDays(today, -29))
  let adopted = 0
  let decided = 0
  let agree = 0
  let sample = 0
  for (const s of items) {
    adopted += s.counts.adopted + s.counts.rewritten
    decided += s.counts.adopted + s.counts.rewritten + s.counts.rejected
    if (s.state === 'finalized' && s.finalVerdict !== undefined && s.aiVerdictAtFinalize !== undefined) {
      sample += 1
      if (s.finalVerdict === s.aiVerdictAtFinalize) agree += 1
    }
  }
  return {
    total: items.length,
    last30: items.filter((s) => localDayKey(s.createdAt) >= since).length,
    pending: items.filter((s) => s.state !== 'finalized').length,
    stale: items.filter((s) => s.state === 'stale').length,
    adoptRate: decided === 0 ? null : adopted / decided,
    decided,
    agreement: sample === 0 ? null : agree / sample,
    agreementSample: sample,
  }
}

export type StateFilter = ReviewState | 'pending'

export interface ReviewFilter {
  state?: StateFilter | undefined
  verdict?: Verdict | undefined
  query?: string | undefined
  day?: string | undefined
}

export const STATE_FILTERS: [StateFilter | undefined, string][] = [
  [undefined, '全部'], ['pending', '待处理'], ['open', '进行中'], ['stale', '需重新定稿'], ['finalized', '已定稿'], ['closed', '已作废'],
]

export function effectiveVerdict(stamp: Pick<ReviewStamp, 'aiVerdict' | 'finalVerdict'>): Verdict {
  return stamp.finalVerdict ?? stamp.aiVerdict
}

export function filterStamps(items: ReviewStamp[], filter: ReviewFilter): ReviewStamp[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return items.filter((s) => {
    if (filter.state === 'closed' ? s.state !== 'closed' : s.state === 'closed') return false
    if (filter.state === 'pending' ? s.state === 'finalized' : filter.state && s.state !== filter.state) return false
    if (filter.verdict && effectiveVerdict(s) !== filter.verdict) return false
    if (filter.day && localDayKey(s.createdAt) !== filter.day) return false
    if (query && ![s.title, s.reviewId, s.reviewer ?? ''].some((v) => v.toLowerCase().includes(query))) return false
    return true
  })
}

export function assistantQueue(items: ReviewStamp[]): ReviewStamp[] {
  return items.filter((s) => s.state !== 'finalized' && s.state !== 'closed').sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export async function requestJson<T>(path: string, init: RequestInit = {}, fetchImpl: FetchLike = (input, options) => fetch(input, options)): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')
  const res = await fetchImpl(`${API_PREFIX}${path}`, { credentials: 'same-origin', ...init, headers })
  const text = await res.text()
  let data: unknown = null
  let parsed = true
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      parsed = false
    }
  }
  if (!res.ok) {
    const message = parsed && data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : ''
    throw new Error(message || `HTTP ${res.status}`)
  }
  if (!parsed) throw new Error(`响应不是 JSON（HTTP ${res.status}）`)
  return data as T
}
