// Dashboard client: read/write four pages in a right-sidebar tab plus settings validation.
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const TAB_ID = 'wsgw-solution-review'
const API_PREFIX = '/plugins/wsgw-solution-review/api'

type Json = Record<string, unknown>
type Dimension = 'capability' | 'security' | 'integration' | 'channel' | 'sync' | 'config' | 'monitor' | 'document'
type Tier = 'hard' | 'hybrid' | 'soft'
type Severity = 'blocker' | 'major' | 'minor'
type RuleStatus = 'active' | 'draft' | 'retired'
type Verdict = '通过' | '建议整改' | '不通过'

interface RuleStats { shown: number; adopt: number; reject: number; rewrite: number }
interface RuleView {
  ruleId: string
  title: string
  dimension: Dimension
  tier: Tier
  severity: Severity
  status: RuleStatus
  question: string
  suggestion: string
  stats: RuleStats
  overridden: boolean
}
interface RulesPayload { rules: RuleView[]; warnings: string[]; version: string }
interface IssueEvidence { quote: string; kind?: string; sectionPath?: string }
interface IssueRecord {
  issueId: string
  ruleId?: string
  severity: Severity
  tier: string
  origin: string
  finding: string
  suggestion: string
  evidence: IssueEvidence[]
  status: string
  gate: { passed: boolean; reasons: string[] }
}
interface ChecklistEntry { ruleId: string; title: string; tier: Tier; severity: Severity; status: string; note?: string }
interface ReviewSummary {
  reviewId: string
  title: string
  status: string
  reviewer?: string
  aiVerdict: Verdict
  aiVerdictAtFinalize?: Verdict
  finalVerdict?: Verdict
  verdictDelta?: string
  opinionPath?: string
  createdAt: string
  metrics?: { startedAt?: string; finalizedAt?: string; toolCalls?: number; gateRejects?: number }
  counts?: { total?: number; confirmed?: number; pending?: number; adopted?: number; rejected?: number; rewritten?: number }
}
interface ReviewList { items: ReviewSummary[]; page: number; total: number }
interface ReviewDetail {
  review: ReviewSummary
  issues: IssueRecord[]
  checklist: ChecklistEntry[]
  checklistCounts: Record<string, number>
  counts: { blocker: number; major: number; minor: number; pending: number; confirmed: number; adopted: number; rejected: number; rewritten: number }
  basis: string
  summary: string
}
interface MemoryPoint { reviewId: string; at: string; adopted: number; rejected: number; rewritten: number; rate: number | null }
interface MemoryRule {
  ruleId: string
  title: string
  dimension: Dimension
  stats: RuleStats & { rejectRatio: number }
  warn: boolean
  series: MemoryPoint[]
  exemplars: { text: string; reviewId: string; at: string }[]
  recentRejectReasons: string[]
}
interface MemoryPayload {
  rules: MemoryRule[]
  candidates: { candidateId: string; ruleId: string; title: string; status: string; draft?: string }[]
  totals: { exemplars: number; candidates: number; feedback: number }
}
interface EvalRun { runId: string; at: string; status?: string; metrics?: Json; [key: string]: unknown }

const DIMENSION_LABEL: Record<Dimension, string> = {
  capability: '能力', security: '安全', integration: '集成', channel: '渠道', sync: '同步', config: '配置', monitor: '监控', document: '文档',
}
const STATUS_LABEL: Record<string, string> = {
  active: '启用', retired: '停用', draft: '草案',
  confirmed: '已确认', pending: '待人工', adopted: '已采纳', rejected: '已驳回', rewritten: '已改写',
  pass: '通过', fail: '未通过', candidate: '待判断', 'not-applicable': '不适用', soft: '软规则', 'reviewed-no-issue': '已审阅',
}
const VERDICT_COLOR: Record<string, string> = { 通过: '#1f7a3d', 建议整改: '#9a6200', 不通过: '#a12b2b' }

export function filterRules(rules: RuleView[], filter: { dimension?: Dimension | undefined; tier?: Tier | undefined; status?: RuleStatus | undefined }): RuleView[] {
  return rules.filter((r) => (!filter.dimension || r.dimension === filter.dimension)
    && (!filter.tier || r.tier === filter.tier)
    && (!filter.status || r.status === filter.status))
}

export function markFrequentlyRejected(stats: RuleStats, cfg: { minShown?: number; ratio?: number } = {}): boolean {
  const minShown = cfg.minShown ?? 5
  const ratio = cfg.ratio ?? 0.6
  return stats.shown >= minShown && stats.shown > 0 && stats.reject / stats.shown >= ratio
}

export function slidingAdoptRate(series: MemoryPoint[]): { rate: number | null; sample: number; insufficient: boolean } {
  const recent = series.slice(-5)
  const decided = recent.reduce((n, p) => n + p.adopted + p.rejected + p.rewritten, 0)
  const adopted = recent.reduce((n, p) => n + p.adopted, 0)
  return { rate: decided === 0 ? null : adopted / decided, sample: decided, insufficient: decided < 5 }
}

export function validateSettings(input: { minorThreshold: number; askBatchSize: number; rejectWarnRatio: number; dashboardPollSeconds: number }): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  if (!Number.isInteger(input.minorThreshold) || input.minorThreshold < 1 || input.minorThreshold > 10) errors.minorThreshold = '需为 1–10 的整数'
  if (!Number.isInteger(input.askBatchSize) || input.askBatchSize < 1 || input.askBatchSize > 10) errors.askBatchSize = '需为 1–10 的整数'
  if (!Number.isFinite(input.rejectWarnRatio) || input.rejectWarnRatio < 0 || input.rejectWarnRatio > 1) errors.rejectWarnRatio = '需为 0–1'
  if (![0, 30, 60].includes(input.dashboardPollSeconds)) errors.dashboardPollSeconds = '仅支持 0 / 30 / 60'
  return { ok: Object.keys(errors).length === 0, errors }
}

export const TAB_DEFINITION = {
  id: TAB_ID,
  kind: 'wsgw-review',
  priority: 'extension' as const,
  title: (): string => '方案审查',
  guide: [{ id: 'dashboard', order: 10, title: (): string => '方案审查看板', description: (): string => '规则、审查记录、记忆与评测' }],
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')
  const res = await fetch(`${API_PREFIX}${path}`, { credentials: 'same-origin', ...init, headers })
  const text = await res.text()
  let data: unknown
  try { data = text ? JSON.parse(text) : null } catch { throw new Error(`响应不是 JSON（HTTP ${res.status}）`) }
  if (!res.ok) {
    const message = data && typeof data === 'object' && 'message' in data ? String((data as Json).message) : `HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

function useLoad<T>(path: string): { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await requestJson<T>(path)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }
  }, [path])
  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload }
}

function ErrorBar({ error, retry }: { error: string; retry: () => void }): React.ReactElement {
  return React.createElement('div', { style: S.error }, React.createElement('span', null, `加载失败：${error}`), React.createElement('button', { style: S.linkButton, onClick: retry }, '重试'))
}

function Pill({ text, color }: { text: string; color?: string | undefined }): React.ReactElement {
  return React.createElement('span', { style: { ...S.pill, ...(color ? { color, borderColor: color } : {}) } }, text)
}

function Empty({ text }: { text: string }): React.ReactElement {
  return React.createElement('div', { style: S.empty }, text)
}

function PageTabs({ page, setPage }: { page: Page; setPage: (p: Page) => void }): React.ReactElement {
  const tabs: [Page, string][] = [['reviews', '审查记录'], ['rules', '规则'], ['memory', '记忆'], ['eval', '评测']]
  return React.createElement('div', { style: S.tabs }, tabs.map(([id, label]) => React.createElement('button', {
    key: id, style: { ...S.tab, ...(page === id ? S.tabActive : {}) }, onClick: () => setPage(id),
  }, label)))
}

function RulesPage(): React.ReactElement {
  const { data, error, loading, reload } = useLoad<RulesPayload>('/rules')
  const [filter, setFilter] = useState<{ dimension?: Dimension | undefined; tier?: Tier | undefined; status?: RuleStatus | undefined }>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const rules = data ? filterRules(data.rules, filter) : []
  const act = async (ruleId: string, body: Json): Promise<void> => {
    setBusy(ruleId)
    setWriteError(null)
    try { await requestJson(`/rules/${encodeURIComponent(ruleId)}`, { method: 'PATCH', body: JSON.stringify(body) }); await reload() } catch (e) { setWriteError(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  return React.createElement('div', null,
    React.createElement('div', { style: S.toolbar },
      React.createElement('span', { style: S.muted }, data ? `${rules.length} / ${data.rules.length} 条 · ${data.version}` : '加载中…'),
      React.createElement('button', { style: S.button, onClick: () => void reload() }, loading ? '刷新中' : '刷新')),
    data && data.warnings.length > 0 ? React.createElement('div', { style: S.warn }, data.warnings.join('；')) : null,
    error ? React.createElement(ErrorBar, { error, retry: () => void reload() }) : null,
    writeError ? React.createElement('div', { style: S.error }, writeError) : null,
    React.createElement('div', { style: S.toolbar },
      React.createElement('select', { style: S.select, value: filter.dimension ?? '', onChange: (e) => setFilter({ ...filter, dimension: ((e.target as HTMLSelectElement).value || undefined) as Dimension | undefined }) },
        React.createElement('option', { value: '' }, '全部维度'), (Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => React.createElement('option', { key: d, value: d }, DIMENSION_LABEL[d]))),
      React.createElement('select', { style: S.select, value: filter.tier ?? '', onChange: (e) => setFilter({ ...filter, tier: ((e.target as HTMLSelectElement).value || undefined) as Tier | undefined }) },
        React.createElement('option', { value: '' }, '全部层级'), React.createElement('option', { value: 'hard' }, 'hard'), React.createElement('option', { value: 'hybrid' }, 'hybrid'), React.createElement('option', { value: 'soft' }, 'soft')),
      React.createElement('select', { style: S.select, value: filter.status ?? '', onChange: (e) => setFilter({ ...filter, status: ((e.target as HTMLSelectElement).value || undefined) as RuleStatus | undefined }) },
        React.createElement('option', { value: '' }, '全部状态'), React.createElement('option', { value: 'active' }, '启用'), React.createElement('option', { value: 'draft' }, '草案'), React.createElement('option', { value: 'retired' }, '停用'))),
    rules.length === 0 && data ? React.createElement(Empty, { text: '当前筛选下没有规则。' }) : null,
    rules.map((r) => React.createElement('div', { key: r.ruleId, style: S.card },
      React.createElement('div', { style: S.row },
        React.createElement('strong', null, `${r.ruleId} · ${r.title}`),
        React.createElement('span', null,
          React.createElement(Pill, { text: r.severity, color: r.severity === 'blocker' ? '#a12b2b' : r.severity === 'major' ? '#9a6200' : '#555' }),
          React.createElement(Pill, { text: r.tier }),
          React.createElement(Pill, { text: STATUS_LABEL[r.status] ?? r.status }))),
      React.createElement('div', { style: S.muted }, `${DIMENSION_LABEL[r.dimension]} · 展示 ${r.stats.shown} / 采纳 ${r.stats.adopt} / 驳回 ${r.stats.reject} / 改写 ${r.stats.rewrite}`),
      markFrequentlyRejected(r.stats) ? React.createElement('div', { style: S.warn }, '高驳回率：建议复核规则措辞或适用场景。') : null,
      React.createElement('div', { style: S.row },
        React.createElement('button', { style: S.button, disabled: busy === r.ruleId, onClick: () => void act(r.ruleId, { action: r.status === 'active' ? 'disable' : 'enable' }) }, r.status === 'active' ? '停用' : '启用'),
        React.createElement('select', { style: S.select, value: r.severity, disabled: busy === r.ruleId, onChange: (e) => void act(r.ruleId, { action: 'set_severity', severity: (e.target as HTMLSelectElement).value }) },
          React.createElement('option', { value: 'blocker' }, 'blocker'), React.createElement('option', { value: 'major' }, 'major'), React.createElement('option', { value: 'minor' }, 'minor')),
        r.overridden ? React.createElement('span', { style: S.muted }, '已覆盖') : null)))
  )
}

function ReviewDetailPanel({ reviewId, onChanged }: { reviewId: string; onChanged: () => void }): React.ReactElement {
  const { data, error, reload } = useLoad<ReviewDetail>(`/reviews/${encodeURIComponent(reviewId)}`)
  const [busy, setBusy] = useState(false)
  const [reviewer, setReviewer] = useState('')
  const [writeError, setWriteError] = useState<string | null>(null)
  const post = async (path: string, body: Json): Promise<void> => {
    setBusy(true); setWriteError(null)
    try { await requestJson(`/reviews/${encodeURIComponent(reviewId)}${path}`, { method: 'POST', body: JSON.stringify(body) }); await reload(); onChanged() } catch (e) { setWriteError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  if (error) return React.createElement(ErrorBar, { error, retry: () => void reload() })
  if (!data) return React.createElement(Empty, { text: '加载中…' })
  const r = data.review
  const diff = r.aiVerdictAtFinalize !== undefined && r.finalVerdict !== undefined && r.aiVerdictAtFinalize !== r.finalVerdict
  return React.createElement('div', { style: S.card },
    React.createElement('div', { style: S.row }, React.createElement('strong', null, r.title), React.createElement(Pill, { text: r.status })),
    React.createElement('div', { style: S.muted }, `${r.reviewId}${r.reviewer ? ` · ${r.reviewer}` : ''}`),
    React.createElement('div', { style: S.row },
      React.createElement(Pill, { text: `AI：${r.aiVerdict}`, color: VERDICT_COLOR[r.aiVerdict] }),
      r.finalVerdict ? React.createElement(Pill, { text: `最终：${r.finalVerdict}`, color: VERDICT_COLOR[r.finalVerdict] }) : React.createElement('span', { style: S.muted }, '最终结论未定'),
      diff ? React.createElement('span', { style: S.warn }, `AI 与最终结论不一致（${r.aiVerdictAtFinalize} → ${r.finalVerdict}）`) : null),
    React.createElement('div', { style: S.muted }, `blocker ${data.counts.blocker} / major ${data.counts.major} / minor ${data.counts.minor} · 待人工 ${data.counts.pending} · 已采纳 ${data.counts.adopted}`),
    React.createElement('div', { style: S.muted }, data.basis),
    writeError ? React.createElement('div', { style: S.error }, writeError) : null,
    React.createElement('div', { style: S.sectionTitle }, '问题'),
    data.issues.map((issue) => React.createElement('div', { key: issue.issueId, style: S.issue },
      React.createElement('div', { style: S.row }, React.createElement('strong', null, `${issue.ruleId ?? '专家'} · ${issue.finding}`), React.createElement(Pill, { text: STATUS_LABEL[issue.status] ?? issue.status })),
      React.createElement('div', { style: S.muted }, `${issue.severity} · ${issue.tier} · ${issue.origin}`),
      issue.evidence.length > 0 ? React.createElement('div', { style: S.quote }, issue.evidence.map((e, i) => React.createElement('div', { key: i }, e.kind === 'absence' ? `未提及（absence，非引文）：${e.quote}` : `“${e.quote}”`))) : React.createElement('div', { style: S.muted }, '无证据'),
      React.createElement('div', { style: S.muted }, issue.suggestion),
      !['adopted', 'rejected', 'rewritten'].includes(issue.status) ? React.createElement('div', { style: S.row },
        React.createElement('button', { style: S.button, disabled: busy, onClick: () => void post(`/issues/${encodeURIComponent(issue.issueId)}`, { action: 'adopt' }) }, issue.status === 'pending' ? '确认为问题' : '采纳'),
        React.createElement('button', { style: S.button, disabled: busy, onClick: () => void post(`/issues/${encodeURIComponent(issue.issueId)}`, { action: 'reject' }) }, '驳回'),
        React.createElement('button', { style: S.button, disabled: busy, onClick: () => { const text = window.prompt('改写后的措辞'); if (text) void post(`/issues/${encodeURIComponent(issue.issueId)}`, { action: 'rewrite', text }) } }, '改写')) : null)),
    React.createElement('div', { style: S.sectionTitle }, `检查清单（${data.checklist.length} 行）`),
    React.createElement('div', { style: S.muted }, Object.entries(data.checklistCounts).map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${v}`).join(' · ')),
    React.createElement('div', { style: S.checklist }, data.checklist.map((row) => React.createElement('div', { key: row.ruleId, style: S.checkRow },
      React.createElement('span', null, row.ruleId), React.createElement('span', { style: { color: row.status === 'fail' ? '#a12b2b' : row.status === 'pass' ? '#1f7a3d' : '#666' } }, STATUS_LABEL[row.status] ?? row.status), React.createElement('span', { style: S.muted }, row.note ?? '')))),
    React.createElement('div', { style: S.sectionTitle }, '专家署名与最终结论'),
    React.createElement('div', { style: S.row },
      React.createElement('input', { style: S.input, placeholder: '审核人姓名或工号', value: reviewer || r.reviewer || '', onChange: (e) => setReviewer((e.target as HTMLInputElement).value) }),
      React.createElement('button', { style: S.button, disabled: busy, onClick: () => void post('/reviewer', { reviewer: (reviewer || r.reviewer || '').trim() }) }, '保存署名')),
    React.createElement('div', { style: S.row },
      React.createElement('select', { style: S.select, value: r.finalVerdict ?? '', disabled: busy, onChange: (e) => { const value = (e.target as HTMLSelectElement).value; if (value) void post('/final-verdict', { finalVerdict: value }) } },
        React.createElement('option', { value: '' }, '选择最终结论…'), React.createElement('option', { value: '通过' }, '通过'), React.createElement('option', { value: '建议整改' }, '建议整改'), React.createElement('option', { value: '不通过' }, '不通过')),
      React.createElement('button', { style: S.button, onClick: () => void reload() }, '刷新')))
}

function ReviewsPage(): React.ReactElement {
  const [page, setPage] = useState(1)
  const { data, error, reload } = useLoad<ReviewList>(`/reviews?page=${page}`)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { setSelected(null) }, [page])
  if (error) return React.createElement(ErrorBar, { error, retry: () => void reload() })
  if (!data) return React.createElement(Empty, { text: '加载中…' })
  return React.createElement('div', null,
    React.createElement('div', { style: S.toolbar }, React.createElement('span', { style: S.muted }, `共 ${data.total} 条 · 第 ${data.page} 页`),
      React.createElement('button', { style: S.button, disabled: page <= 1, onClick: () => setPage(page - 1) }, '上一页'),
      React.createElement('button', { style: S.button, disabled: page * 1 >= Math.ceil(data.total / 50), onClick: () => setPage(page + 1) }, '下一页')),
    data.items.length === 0 ? React.createElement(Empty, { text: '还没有审查记录。先在与「方案审查」preset 的会话里预审一份方案。' }) : null,
    data.items.map((r) => React.createElement('button', { key: r.reviewId, style: { ...S.card, textAlign: 'left', width: '100%', cursor: 'pointer' }, onClick: () => setSelected(r.reviewId) },
      React.createElement('div', { style: S.row }, React.createElement('strong', null, r.title), React.createElement(Pill, { text: r.aiVerdict, color: VERDICT_COLOR[r.aiVerdict] })),
      React.createElement('div', { style: S.muted }, `${r.reviewId} · ${STATUS_LABEL[r.status] ?? r.status} · 问题 ${r.counts?.total ?? 0}（采纳 ${r.counts?.adopted ?? 0} / 驳回 ${r.counts?.rejected ?? 0} / 待人工 ${r.counts?.pending ?? 0}）`))),
    selected ? React.createElement(ReviewDetailPanel, { reviewId: selected, onChanged: () => void reload() }) : null
  )
}

function MemoryPage(): React.ReactElement {
  const { data, error, reload } = useLoad<MemoryPayload>('/memory')
  const [busy, setBusy] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const candidate = async (id: string, action: string): Promise<void> => {
    setBusy(id); setWriteError(null)
    try { await requestJson(`/candidates/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ action }) }); await reload() } catch (e) { setWriteError(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  if (error) return React.createElement(ErrorBar, { error, retry: () => void reload() })
  if (!data) return React.createElement(Empty, { text: '加载中…' })
  return React.createElement('div', null,
    React.createElement('div', { style: S.muted }, `范例 ${data.totals.exemplars} · 候选规则 ${data.totals.candidates} · 反馈 ${data.totals.feedback}`),
    writeError ? React.createElement('div', { style: S.error }, writeError) : null,
    React.createElement('div', { style: S.sectionTitle }, '规则记忆'),
    data.rules.map((r) => React.createElement('div', { key: r.ruleId, style: S.card },
      React.createElement('div', { style: S.row }, React.createElement('strong', null, `${r.ruleId} · ${r.title}`), r.warn ? React.createElement('span', { style: S.warn }, '高驳回率') : null),
      React.createElement('div', { style: S.muted }, `展示 ${r.stats.shown} · 采纳 ${r.stats.adopt} · 驳回 ${r.stats.reject} · 改写 ${r.stats.rewrite} · 驳回率 ${(r.stats.rejectRatio * 100).toFixed(0)}%`),
      React.createElement('div', { style: S.muted }, slidingAdoptRate(r.series).insufficient ? '样本不足（<5 条已定稿）' : `近 5 条采纳率 ${(slidingAdoptRate(r.series).rate! * 100).toFixed(0)}%`),
      r.recentRejectReasons.length > 0 ? React.createElement('div', { style: S.quote }, `驳回原因：${r.recentRejectReasons.join('；')}`) : null,
      r.exemplars.length > 0 ? React.createElement('div', { style: S.quote }, `范例：${r.exemplars.map((e) => e.text).join(' / ')}`) : null)),
    React.createElement('div', { style: S.sectionTitle }, '候选规则'),
    data.candidates.length === 0 ? React.createElement(Empty, { text: '暂无候选规则。' }) : data.candidates.map((c) => React.createElement('div', { key: c.candidateId, style: S.card },
      React.createElement('div', { style: S.row }, React.createElement('strong', null, c.title), React.createElement(Pill, { text: c.status })),
      React.createElement('div', { style: S.muted }, c.ruleId),
      c.draft ? React.createElement('pre', { style: S.pre }, c.draft) : null,
      React.createElement('div', { style: S.row },
        React.createElement('button', { style: S.button, disabled: busy === c.candidateId, onClick: () => void candidate(c.candidateId, 'accept_draft') }, '采纳草案'),
        React.createElement('button', { style: S.button, disabled: busy === c.candidateId, onClick: () => void candidate(c.candidateId, 'dismiss') }, '忽略'))))
  )
}

function EvalPage(): React.ReactElement {
  const { data, error, reload } = useLoad<{ runs: EvalRun[] }>('/eval-runs')
  const [selected, setSelected] = useState<string[]>([])
  const [compared, setCompared] = useState<EvalRun[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const toggle = (id: string): void => {
    setNotice(null)
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else if (selected.length >= 7) setNotice('最多选择 7 个 run')
    else setSelected([...selected, id])
  }
  const compare = async (): Promise<void> => {
    setNotice(null); setCompared(null)
    if (selected.length < 2) return setNotice('至少选择 2 个 run 才能对比')
    try { setCompared((await requestJson<{ runs: EvalRun[] }>(`/eval-runs?ids=${selected.map(encodeURIComponent).join(',')}`)).runs) } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) }
  }
  if (error) return React.createElement(ErrorBar, { error, retry: () => void reload() })
  if (!data) return React.createElement(Empty, { text: '加载中…' })
  return React.createElement('div', null,
    React.createElement('div', { style: S.toolbar }, React.createElement('span', { style: S.muted }, `${data.runs.length} 个评测 run · 已选 ${selected.length}`), React.createElement('button', { style: S.button, onClick: () => void compare() }, '对比')),
    notice ? React.createElement('div', { style: S.warn }, notice) : null,
    data.runs.length === 0 ? React.createElement(Empty, { text: '还没有评测结果。运行离线评测后在此查看。' }) : data.runs.map((run) => React.createElement('label', { key: run.runId, style: S.card },
      React.createElement('div', { style: S.row }, React.createElement('input', { type: 'checkbox', checked: selected.includes(run.runId), onChange: () => toggle(run.runId) }), React.createElement('strong', null, run.runId), React.createElement(Pill, { text: run.status ?? 'unknown' })),
      React.createElement('div', { style: S.muted }, run.at))),
    compared ? React.createElement('div', { style: S.card }, React.createElement('strong', null, '对比结果'), compared.map((run) => React.createElement('pre', { key: run.runId, style: S.pre }, `${run.runId}\n${JSON.stringify(run.metrics ?? {}, null, 2)}`))) : null
  )
}

type Page = 'reviews' | 'rules' | 'memory' | 'eval'

export function Dashboard(): React.ReactElement {
  const [page, setPage] = useState<Page>('reviews')
  return React.createElement('div', { style: S.root },
    React.createElement('div', { style: S.header }, React.createElement('strong', null, '方案审查看板'), React.createElement('span', { style: S.muted }, 'AI 建议 · 专家定稿')),
    React.createElement(PageTabs, { page, setPage }),
    page === 'reviews' ? React.createElement(ReviewsPage) : page === 'rules' ? React.createElement(RulesPage) : page === 'memory' ? React.createElement(MemoryPage) : React.createElement(EvalPage))
}

interface ClientSlots {
  inject(name: string, cb: () => unknown): () => void
  register(def: { name: string; key?: string }, component: React.ComponentType): () => void
}
interface ClientContext {
  effect(fn: () => unknown, label?: string): void
  sidebarRightTabs: { register(def: unknown): () => void }
  slots: ClientSlots
}

export const name = TAB_ID
export const inject = ['slots', 'sidebarRightTabs']

export function apply(raw: unknown): void {
  const ctx = raw as ClientContext
  ctx.effect(() => ctx.sidebarRightTabs.register(TAB_DEFINITION), 'wsgw-solution-review: tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, Dashboard)), 'wsgw-solution-review: dashboard body')
}

const S: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, fontSize: 12, color: 'var(--fg, #1d1d1f)', minHeight: 0, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid rgba(127,127,127,.25)', paddingBottom: 4 },
  tab: { border: 'none', background: 'transparent', padding: '4px 8px', cursor: 'pointer', color: 'inherit', fontSize: 12, borderRadius: 4 },
  tabActive: { background: 'rgba(127,127,127,.16)', fontWeight: 600 },
  toolbar: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  row: { display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  card: { border: '1px solid rgba(127,127,127,.25)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, background: 'transparent' },
  issue: { borderLeft: '2px solid rgba(127,127,127,.35)', paddingLeft: 6, display: 'flex', flexDirection: 'column', gap: 3 },
  sectionTitle: { marginTop: 8, fontWeight: 600 },
  muted: { color: 'rgba(127,127,127,.95)', fontSize: 11 },
  warn: { color: '#9a6200', fontSize: 11 },
  error: { color: '#a12b2b', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  empty: { padding: 12, textAlign: 'center', color: 'rgba(127,127,127,.95)' },
  pill: { display: 'inline-block', border: '1px solid rgba(127,127,127,.4)', borderRadius: 999, padding: '0 6px', fontSize: 10, lineHeight: '16px', marginRight: 4 },
  button: { border: '1px solid rgba(127,127,127,.4)', background: 'transparent', color: 'inherit', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 11 },
  linkButton: { border: 'none', background: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 11 },
  select: { border: '1px solid rgba(127,127,127,.4)', background: 'transparent', color: 'inherit', borderRadius: 4, padding: '2px 4px', fontSize: 11 },
  input: { border: '1px solid rgba(127,127,127,.4)', background: 'transparent', color: 'inherit', borderRadius: 4, padding: '2px 5px', fontSize: 11, minWidth: 120 },
  quote: { borderLeft: '2px solid rgba(127,127,127,.35)', paddingLeft: 6, color: 'rgba(127,127,127,.95)', fontStyle: 'italic', fontSize: 11 },
  checklist: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflow: 'auto', border: '1px solid rgba(127,127,127,.2)', padding: 4 },
  checkRow: { display: 'grid', gridTemplateColumns: '64px 64px 1fr', gap: 6, fontSize: 10 },
  pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10, margin: 0, padding: 4, background: 'rgba(127,127,127,.08)', borderRadius: 4 },
}
