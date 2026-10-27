// Dashboard data model: payload types come from the host builders, so the client cannot drift from the API.
import type { Dimension, IssueOrigin, IssueStatus, RuleStats, Severity, Tier, Verdict, ChecklistStatus, RuleStatus } from '../engine/types.js'
import type { ReviewDetailPayload, ReviewListPayload, RulesPayload, ReviewView } from '../host/api-types.js'
import type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, RuleDetailPayload, RuleView, SlidingAdoptPoint } from '../host/store.js'
import type { RuleCandidateRecord } from '../store/domain.js'

export type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, ReviewDetailPayload, ReviewListPayload, ReviewView, RuleDetailPayload, RulesPayload, RuleView }

export const API_PREFIX = '/plugins/wsgw-solution-review/api'
export const PAGE_SIZE = 50
export const MAX_COMPARE = 7

export interface EvalRunsPayload {
  runs: DashboardEvalRun[]
}

export interface RuleFilter {
  dimension?: Dimension | undefined
  tier?: Tier | undefined
  status?: RuleStatus | undefined
}

export type DecideBody = { action: 'adopt' } | { action: 'reject'; reason?: string } | { action: 'rewrite'; text: string }
export type RuleAction = { action: 'disable' } | { action: 'enable' } | { action: 'set_severity'; severity: Severity }
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
export const TIER_LABEL: Record<Tier, string> = { hard: '硬校验', hybrid: '混合', soft: '语义' }
export const SEVERITY_LABEL: Record<Severity, string> = { blocker: 'blocker', major: 'major', minor: 'minor' }
export const RULE_STATUS_LABEL: Record<RuleStatus, string> = { active: '启用', draft: '草案', retired: '停用' }
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  confirmed: '已确认',
  pending: '待人工',
  adopted: '已采纳',
  rejected: '已驳回',
  rewritten: '已改写',
}
export const ORIGIN_LABEL: Record<IssueOrigin, string> = { verifier: '校验器', llm: '模型', expert: '专家' }
export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  pass: '通过',
  fail: '未通过',
  candidate: '待判断',
  pending: '待人工',
  'not-applicable': '不适用',
  soft: '语义',
  'reviewed-no-issue': '已审阅无问题',
}
export const CANDIDATE_STATUS_LABEL: Record<RuleCandidateRecord['status'], string> = {
  new: '新',
  drafted: '已起草',
  accepted: '已接受',
  dismissed: '已忽略',
}
export const REVIEW_STATE_LABEL: Record<ReviewState, string> = { open: '进行中', finalized: '已定稿', stale: '需重新定稿' }
export const VERDICTS: readonly Verdict[] = ['通过', '建议整改', '不通过']

export function filterRules(rules: RuleView[], filter: RuleFilter): RuleView[] {
  return rules.filter((r) => (!filter.dimension || r.dimension === filter.dimension)
    && (!filter.tier || r.tier === filter.tier)
    && (!filter.status || r.status === filter.status))
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

export function memoryRulesWithRecords(rules: DashboardMemoryRule[]): DashboardMemoryRule[] {
  return rules
    .filter((r) => r.stats.shown > 0 || r.exemplars.length > 0)
    .sort((a, b) => b.stats.shown - a.stats.shown)
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

export type ReviewState = 'open' | 'finalized' | 'stale'

export function reviewState(review: Pick<ReviewView, 'status' | 'versions'>): ReviewState {
  if (review.status === 'finalized') return 'finalized'
  return review.versions.length > 0 ? 'stale' : 'open'
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
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
