// Presentational dashboard views: props in, elements out. Fetching and writes live in index.tsx.
import * as React from 'react'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Dimension, Evidence, Severity, Tier, Verdict, RuleStatus } from '../engine/types.js'
import type { IssueRecord } from '../store/domain.js'
import {
  CANDIDATE_STATUS_LABEL,
  CHECKLIST_STATUS_LABEL,
  DIMENSION_LABEL,
  ISSUE_STATUS_LABEL,
  ORIGIN_LABEL,
  PAGE_SIZE,
  REVIEW_STATE_LABEL,
  RULE_STATUS_LABEL,
  SEVERITY_LABEL,
  TIER_LABEL,
  VERDICTS,
  candidateActions,
  evalMetricRows,
  filterRules,
  formatRate,
  markFrequentlyRejected,
  memoryRulesWithRecords,
  reviewState,
  slidingAdoptRate,
  type CandidateAction,
  type DashboardEvalRun,
  type DashboardMemory,
  type DecideBody,
  type EvalRunsPayload,
  type ReviewDetailPayload,
  type ReviewListPayload,
  type RuleAction,
  type RuleDetailPayload,
  type RuleFilter,
  type RulesPayload,
} from './model.js'

const C = {
  label: 'var(--dsw-alias-label-primary)',
  secondary: 'var(--dsw-alias-label-secondary)',
  tertiary: 'var(--dsw-alias-label-tertiary)',
  border: 'var(--dsw-alias-border-l2)',
  borderStrong: 'var(--dsw-alias-border-l3)',
  layer1: 'var(--dsw-alias-bg-layer-1)',
  layer2: 'var(--dsw-alias-bg-layer-2)',
  hover: 'var(--dsw-alias-interactive-bg-hover)',
  success: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  error: 'var(--dsw-alias-state-error-primary)',
}

export const S: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, height: '100%', minHeight: 0, overflow: 'auto', boxSizing: 'border-box', color: C.label, font: 'var(--dsw-font-xs-13)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, paddingBottom: 4, flexWrap: 'wrap' },
  tab: { border: 'none', background: 'transparent', color: C.secondary, padding: '4px 8px', borderRadius: 'var(--dsw-radius-sm)', cursor: 'pointer', font: 'inherit' },
  tabActive: { background: C.hover, color: C.label, fontWeight: 600 },
  row: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  spread: { display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  card: { border: `1px solid ${C.border}`, borderRadius: 'var(--dsw-radius-sm)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, background: C.layer1 },
  cardButton: { border: `1px solid ${C.border}`, borderRadius: 'var(--dsw-radius-sm)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, background: C.layer1, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' },
  issue: { borderLeft: `2px solid ${C.borderStrong}`, paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  section: { marginTop: 8, fontWeight: 600 },
  muted: { color: C.tertiary, font: 'var(--dsw-font-xxs-12)' },
  secondary: { color: C.secondary },
  notice: { color: C.warn, font: 'var(--dsw-font-xxs-12)' },
  error: { color: C.error, font: 'var(--dsw-font-xxs-12)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  empty: { padding: 16, textAlign: 'center', color: C.tertiary },
  pill: { display: 'inline-block', border: `1px solid ${C.borderStrong}`, borderRadius: 999, padding: '0 6px', font: 'var(--dsw-font-xxs-12)', color: C.secondary },
  button: { border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: '2px 8px', cursor: 'pointer', font: 'var(--dsw-font-xxs-12)' },
  link: { border: 'none', background: 'transparent', color: C.secondary, textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'var(--dsw-font-xxs-12)' },
  field: { border: `1px solid ${C.borderStrong}`, background: C.layer2, color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: '2px 6px', font: 'var(--dsw-font-xxs-12)' },
  textarea: { border: `1px solid ${C.borderStrong}`, background: C.layer2, color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: 6, font: 'var(--dsw-font-xxs-12)', width: '100%', boxSizing: 'border-box', minHeight: 56, resize: 'vertical' },
  quote: { margin: 0, borderLeft: `2px solid ${C.border}`, paddingLeft: 8, color: C.secondary, font: 'var(--dsw-font-xxs-12)' },
  checklist: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 'var(--dsw-radius-sm)', padding: 6 },
  checkRow: { display: 'grid', gridTemplateColumns: '72px 84px 1fr', gap: 6, font: 'var(--dsw-font-xxs-12)' },
  pre: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: 6, background: C.layer2, borderRadius: 'var(--dsw-radius-sm)', font: 'var(--dsw-font-xxs-12)' },
  table: { borderCollapse: 'collapse', width: '100%', font: 'var(--dsw-font-xxs-12)' },
  cell: { borderBottom: `1px solid ${C.border}`, padding: '2px 6px', textAlign: 'left' },
}

const VERDICT_COLOR: Record<Verdict, string> = { 通过: C.success, 建议整改: C.warn, 不通过: C.error }
const SEVERITY_COLOR: Record<Severity, string> = { blocker: C.error, major: C.warn, minor: C.secondary }

export function Pill({ children, color }: { children: ReactNode; color?: string | undefined }): React.ReactElement {
  return <span style={{ ...S.pill, ...(color ? { color, borderColor: color } : {}) }}>{children}</span>
}

export function VerdictPill({ verdict, prefix }: { verdict: Verdict; prefix?: string }): React.ReactElement {
  return <Pill color={VERDICT_COLOR[verdict]}>{prefix ? `${prefix}${verdict}` : verdict}</Pill>
}

export function Empty({ children }: { children: ReactNode }): React.ReactElement {
  return <div style={S.empty}>{children}</div>
}

export function ErrorBar({ message, onRetry }: { message: string; onRetry?: (() => void) | undefined }): React.ReactElement {
  return (
    <div role="alert" style={S.error}>
      <span>{message}</span>
      {onRetry ? <button type="button" style={S.link} onClick={onRetry}>重试</button> : null}
    </div>
  )
}

// ---------- 审查记录 ----------

export function ReviewListView({ data, onSelect, onPage }: { data: ReviewListPayload; onSelect: (reviewId: string) => void; onPage: (page: number) => void }): React.ReactElement {
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={S.row}>
        <span style={S.muted}>共 {data.total} 条 · 第 {data.page}/{pages} 页</span>
        <button type="button" style={S.button} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>上一页</button>
        <button type="button" style={S.button} disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>下一页</button>
      </div>
      {data.items.length === 0 ? <Empty>还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。</Empty> : null}
      {data.items.map((item) => {
        const state = reviewState(item)
        return (
          <button key={item.reviewId} type="button" style={S.cardButton} onClick={() => onSelect(item.reviewId)}>
            <span style={S.spread}>
              <strong>{item.title}</strong>
              <span style={S.row}>
                <VerdictPill verdict={item.aiVerdict} prefix="预审 " />
                {item.finalVerdict ? <VerdictPill verdict={item.finalVerdict} prefix="最终 " /> : null}
                <Pill color={state === 'stale' ? C.warn : undefined}>{REVIEW_STATE_LABEL[state]}</Pill>
              </span>
            </span>
            <span style={S.muted}>
              {item.reviewId}{item.reviewer ? ` · ${item.reviewer}` : ''} · 问题 {item.counts.total}（采纳 {item.counts.adopted} / 驳回 {item.counts.rejected} / 改写 {item.counts.rewritten} / 待人工 {item.counts.pending}）
            </span>
          </button>
        )
      })}
    </div>
  )
}

function EvidenceList({ evidence }: { evidence: Evidence[] }): React.ReactElement {
  if (evidence.length === 0) return <span style={S.muted}>无证据（专家意见或待补引文）</span>
  return (
    <>
      {evidence.map((e, i) => e.kind === 'absence'
        ? <span key={i} style={S.muted}>未提及（校验器判定，非引文）：{e.quote}</span>
        : (
          <blockquote key={i} style={S.quote}>
            “{e.quote}”{e.sectionPath ? <span style={S.muted}>（{e.sectionPath}）</span> : null}
          </blockquote>
        ))}
    </>
  )
}

type Draft = { issueId: string; mode: 'reject' | 'rewrite'; text: string }

function IssueCard({ issue, draft, busy, onDraft, onDecide }: {
  issue: IssueRecord
  draft: Draft | null
  busy: boolean
  onDraft: (draft: Draft | null) => void
  onDecide: (issueId: string, body: DecideBody) => void
}): React.ReactElement {
  const undecided = issue.status === 'confirmed' || issue.status === 'pending'
  const mine = draft?.issueId === issue.issueId ? draft : null
  return (
    <div style={S.issue}>
      <div style={S.spread}>
        <strong>{issue.ruleId ?? '专家'} · {issue.finding}</strong>
        <span style={S.row}>
          <Pill color={SEVERITY_COLOR[issue.severity]}>{SEVERITY_LABEL[issue.severity]}</Pill>
          <Pill color={issue.status === 'pending' ? C.warn : undefined}>{ISSUE_STATUS_LABEL[issue.status]}</Pill>
        </span>
      </div>
      <span style={S.muted}>
        来源：{ORIGIN_LABEL[issue.origin]}{!issue.gate.passed && issue.gate.reasons.length ? ` · 门禁未过：${issue.gate.reasons.join('、')}` : ''}
      </span>
      <EvidenceList evidence={issue.evidence} />
      <span style={S.secondary}>建议：{issue.status === 'rewritten' && issue.rewriteText ? issue.rewriteText : issue.suggestion}</span>
      {issue.status === 'rewritten' ? <span style={S.muted}>（专家改写；原建议：{issue.suggestion}）</span> : null}
      {undecided && !mine ? (
        <div style={S.row}>
          <button type="button" data-decide="adopt" style={S.button} disabled={busy} onClick={() => onDecide(issue.issueId, { action: 'adopt' })}>
            {issue.status === 'pending' ? '确认为问题' : '采纳'}
          </button>
          <button type="button" data-decide="reject" style={S.button} disabled={busy} onClick={() => onDraft({ issueId: issue.issueId, mode: 'reject', text: '' })}>
            {issue.status === 'pending' ? '不是问题' : '驳回'}
          </button>
          <button type="button" data-decide="rewrite" style={S.button} disabled={busy} onClick={() => onDraft({ issueId: issue.issueId, mode: 'rewrite', text: issue.suggestion })}>改写</button>
        </div>
      ) : null}
      {mine ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <textarea
            style={S.textarea}
            aria-label={mine.mode === 'reject' ? '驳回原因（可选）' : '改写后的意见'}
            placeholder={mine.mode === 'reject' ? '驳回原因（可选，例如：方案 3.2 已说明）' : '改写后的意见措辞'}
            value={mine.text}
            onChange={(e) => onDraft({ ...mine, text: e.currentTarget.value })}
          />
          <div style={S.row}>
            <button
              type="button"
              style={S.button}
              disabled={busy || (mine.mode === 'rewrite' && !mine.text.trim())}
              onClick={() => onDecide(issue.issueId, mine.mode === 'reject'
                ? { action: 'reject', ...(mine.text.trim() ? { reason: mine.text.trim() } : {}) }
                : { action: 'rewrite', text: mine.text.trim() })}
            >
              {mine.mode === 'reject' ? '确认驳回' : '保存改写'}
            </button>
            <button type="button" style={S.link} onClick={() => onDraft(null)}>取消</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ReviewDetailView({ data, busy, onDecide, onReviewer, onVerdict }: {
  data: ReviewDetailPayload
  busy: boolean
  onDecide: (issueId: string, body: DecideBody) => void
  onReviewer: (reviewer: string) => void
  onVerdict: (verdict: Verdict) => void
}): React.ReactElement {
  const r = data.review
  const [draft, setDraft] = useState<Draft | null>(null)
  const [reviewer, setReviewer] = useState(r.reviewer ?? '')
  const [verdict, setVerdict] = useState<Verdict | ''>(r.finalVerdict ?? '')
  const state = reviewState(r)
  const delta = r.aiVerdictAtFinalize !== undefined && r.finalVerdict !== undefined && r.aiVerdictAtFinalize !== r.finalVerdict
  const decide = (issueId: string, body: DecideBody): void => {
    setDraft(null)
    onDecide(issueId, body)
  }
  return (
    <div style={S.card}>
      <div style={S.spread}>
        <strong>{r.title}</strong>
        <Pill color={state === 'stale' ? C.warn : undefined}>{REVIEW_STATE_LABEL[state]}</Pill>
      </div>
      <span style={S.muted}>{r.reviewId} · 规则包 {r.rulePackVersion}</span>
      {state === 'stale' ? <div style={S.notice}>定稿后决定已变更，旧意见文件已过期：需回到对话重新定稿（review_finalize）。</div> : null}
      {(r.warnings ?? []).map((w) => <div key={w} style={S.notice}>{w}</div>)}

      <div style={S.section}>结论</div>
      <div style={S.row}>
        <VerdictPill verdict={r.aiVerdict} prefix="当前预审建议 " />
        {r.finalVerdict ? <VerdictPill verdict={r.finalVerdict} prefix="最终 " /> : <span style={S.muted}>最终结论未确认</span>}
      </div>
      {delta ? (
        <div data-verdict-delta style={S.notice}>定稿时预审结论「{r.aiVerdictAtFinalize}」与专家最终结论「{r.finalVerdict}」不一致</div>
      ) : null}
      <span style={S.muted}>{data.basis}</span>

      <div style={S.section}>问题（{data.issues.length}）</div>
      {data.issues.length === 0 ? <span style={S.muted}>没有登记问题。</span> : null}
      {data.issues.map((issue) => (
        <IssueCard key={issue.issueId} issue={issue} draft={draft} busy={busy} onDraft={setDraft} onDecide={decide} />
      ))}

      <div style={S.section}>检查清单（{data.checklist.length} 条）</div>
      <span style={S.muted}>
        {Object.entries(data.checklistCounts).filter(([, n]) => n > 0).map(([k, n]) => `${CHECKLIST_STATUS_LABEL[k as keyof typeof CHECKLIST_STATUS_LABEL]} ${n}`).join(' · ')}
      </span>
      <div style={S.checklist}>
        {data.checklist.map((row) => (
          <div key={row.ruleId} data-check-row style={S.checkRow}>
            <span>{row.ruleId}</span>
            <span style={{ color: row.status === 'fail' ? C.error : row.status === 'pass' ? C.success : C.secondary }}>{CHECKLIST_STATUS_LABEL[row.status]}</span>
            <span style={S.muted}>{row.note ?? row.title}</span>
          </div>
        ))}
      </div>

      <div style={S.section}>署名与最终结论</div>
      <div style={S.row}>
        <input style={S.field} aria-label="审核人" placeholder="审核人姓名或工号" value={reviewer} onChange={(e) => setReviewer(e.currentTarget.value)} />
        <button type="button" style={S.button} disabled={busy || !reviewer.trim() || reviewer.trim() === r.reviewer} onClick={() => onReviewer(reviewer.trim())}>保存署名</button>
      </div>
      <div style={S.row}>
        <select style={S.field} aria-label="最终结论" value={verdict} onChange={(e) => setVerdict(e.currentTarget.value as Verdict | '')}>
          <option value="">选择最终结论…</option>
          {VERDICTS.map((v) => <option key={v} value={v}>{v === r.aiVerdict ? `${v}（推荐）` : v}</option>)}
        </select>
        <button type="button" style={S.button} disabled={busy || !verdict || verdict === r.finalVerdict} onClick={() => verdict && onVerdict(verdict)}>确认最终结论</button>
      </div>
      {!r.reviewer ? <span style={S.muted}>确认最终结论前需要审核人署名（或在配置中设置默认署名）。</span> : null}

      <div style={S.section}>正式意见</div>
      {r.versions.length === 0
        ? <span style={S.muted}>尚未定稿。定稿在对话中完成（review_finalize）。</span>
        : r.versions.map((v) => <span key={v.version} style={S.muted}>v{v.version} · {v.path} · {v.at}</span>)}
      <span style={S.muted}>工具调用 {r.metrics.toolCalls} 次 · 门禁拒绝 {r.metrics.gateRejects} 次</span>
    </div>
  )
}

// ---------- 规则 ----------

function RuleDetailBlock({ detail }: { detail: RuleDetailPayload }): React.ReactElement {
  const d = detail.detail
  return (
    <div data-rule-detail style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      <span><strong>检查问题：</strong>{d.question}</span>
      <span style={S.secondary}><strong>依据：</strong>{d.rationale}</span>
      <span style={S.secondary}><strong>整改建议：</strong>{d.suggestion}</span>
      {d.shipped && d.override ? (
        <span style={S.notice}>
          已覆盖：{d.override.severity ? `级别 ${d.shipped.severity} → ${d.override.severity}` : ''}{d.override.status ? ` 状态 ${d.shipped.status} → ${d.override.status}` : ''}{d.override.params ? ' 参数已调整' : ''}
        </span>
      ) : null}
      <span style={S.muted}>适用范围</span>
      <pre style={S.pre}>{d.applicability ? JSON.stringify(d.applicability, null, 2) : '全部方案'}</pre>
      <span style={S.muted}>校验器</span>
      <pre style={S.pre}>{d.verifier ? JSON.stringify(d.verifier, null, 2) : '无（语义规则，由模型判断后一律待人工）'}</pre>
      <span style={S.muted}>来源：{d.provenance.source}</span>
      {d.audit.length > 0 ? (
        <>
          <span style={S.muted}>最近变更</span>
          {d.audit.map((a, i) => <span key={i} style={S.muted}>{a.at} · {a.who} · {a.change.field}：{String(a.change.from ?? '—')} → {String(a.change.to)}</span>)}
        </>
      ) : null}
      <span style={S.muted}>
        记忆：展示 {d.memory.stats.shown} · 采纳 {d.memory.stats.adopt} · 驳回 {d.memory.stats.reject} · 改写 {d.memory.stats.rewrite}
      </span>
      {d.memory.exemplars.map((e, i) => <blockquote key={i} style={S.quote}>范例（{e.kind === 'rewrite' ? '改写' : '采纳'}）：{e.text}</blockquote>)}
      {d.memory.recentRejectReasons.map((reason, i) => <span key={i} style={S.muted}>驳回原因：{reason}</span>)}
    </div>
  )
}

export function RulesView({ data, filter, onFilter, expanded, detail, busy, onToggle, onAct }: {
  data: RulesPayload
  filter: RuleFilter
  onFilter: (filter: RuleFilter) => void
  expanded: string | null
  detail: RuleDetailPayload | null
  busy: string | null
  onToggle: (ruleId: string) => void
  onAct: (ruleId: string, action: RuleAction) => void
}): React.ReactElement {
  const rules = filterRules(data.rules, filter)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={S.muted}>{rules.length} / {data.rules.length} 条 · 规则包 {data.version}</span>
      {data.loadErrors.map((e, i) => <ErrorBar key={i} message={`规则包加载失败：${JSON.stringify(e)}`} />)}
      {data.warnings.length > 0 ? <div style={S.notice}>{data.warnings.join('；')}</div> : null}
      <div style={S.row}>
        <select style={S.field} aria-label="维度" value={filter.dimension ?? ''} onChange={(e) => onFilter({ ...filter, dimension: (e.currentTarget.value || undefined) as Dimension | undefined })}>
          <option value="">全部维度</option>
          {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => <option key={d} value={d}>{DIMENSION_LABEL[d]}</option>)}
        </select>
        <select style={S.field} aria-label="层级" value={filter.tier ?? ''} onChange={(e) => onFilter({ ...filter, tier: (e.currentTarget.value || undefined) as Tier | undefined })}>
          <option value="">全部层级</option>
          {(Object.keys(TIER_LABEL) as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </select>
        <select style={S.field} aria-label="状态" value={filter.status ?? ''} onChange={(e) => onFilter({ ...filter, status: (e.currentTarget.value || undefined) as RuleStatus | undefined })}>
          <option value="">全部状态</option>
          {(Object.keys(RULE_STATUS_LABEL) as RuleStatus[]).map((s) => <option key={s} value={s}>{RULE_STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {rules.length === 0 ? <Empty>当前筛选下没有规则。</Empty> : null}
      {rules.map((r) => (
        <div key={r.ruleId} data-rule-row style={S.card}>
          <div style={S.spread}>
            <button type="button" style={{ ...S.link, color: C.label, textDecoration: 'none', fontWeight: 600 }} aria-expanded={expanded === r.ruleId} onClick={() => onToggle(r.ruleId)}>
              {expanded === r.ruleId ? '▾' : '▸'} {r.ruleId} · {r.title}
            </button>
            <span style={S.row}>
              <Pill color={SEVERITY_COLOR[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
              <Pill>{TIER_LABEL[r.tier]}</Pill>
              <Pill color={r.status === 'retired' ? C.tertiary : undefined}>{RULE_STATUS_LABEL[r.status]}</Pill>
              {r.overridden ? <Pill color={C.warn}>已覆盖</Pill> : null}
            </span>
          </div>
          <span style={S.muted}>
            {DIMENSION_LABEL[r.dimension]} · 展示 {r.stats.shown} / 采纳 {r.stats.adopt} / 驳回 {r.stats.reject} / 改写 {r.stats.rewrite}
          </span>
          {markFrequentlyRejected(r.stats) ? <span style={S.notice}>常被驳回：建议复核规则措辞或适用范围。</span> : null}
          {expanded === r.ruleId ? (
            <>
              {detail && detail.rule.ruleId === r.ruleId ? <RuleDetailBlock detail={detail} /> : <span style={S.muted}>加载详情…</span>}
              <div style={S.row}>
                {r.status !== 'draft' ? (
                  <button type="button" style={S.button} disabled={busy === r.ruleId} onClick={() => onAct(r.ruleId, { action: r.status === 'active' ? 'disable' : 'enable' })}>
                    {r.status === 'active' ? '停用' : '启用'}
                  </button>
                ) : null}
                <select style={S.field} aria-label="严重级别" value={r.severity} disabled={busy === r.ruleId} onChange={(e) => onAct(r.ruleId, { action: 'set_severity', severity: e.currentTarget.value as Severity })}>
                  {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={S.muted}>参数调整与草案起草请在对话中让 agent 用 rules_propose 完成。</span>
              </div>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ---------- 记忆 ----------

export function MemoryView({ data, busy, onCandidate }: {
  data: DashboardMemory
  busy: string | null
  onCandidate: (candidateId: string, action: CandidateAction) => void
}): React.ReactElement {
  const rules = memoryRulesWithRecords(data.rules)
  if (rules.length === 0 && data.candidates.length === 0) return <Empty>记忆为空：完成第一次定稿后出现。</Empty>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={S.muted}>范例 {data.totals.exemplars} · 候选规则 {data.totals.candidates} · 反馈 {data.totals.feedback}</span>
      <div style={S.section}>规则记忆（{rules.length}）</div>
      {rules.length === 0 ? <span style={S.muted}>还没有规则被提出过。</span> : null}
      {rules.map((r) => {
        const sliding = slidingAdoptRate(r.series)
        return (
          <div key={r.ruleId} data-memory-rule style={S.card}>
            <div style={S.spread}>
              <strong>{r.ruleId} · {r.title}</strong>
              {r.warn ? <Pill color={C.warn}>常被驳回</Pill> : null}
            </div>
            <span style={S.muted}>
              展示 {r.stats.shown} · 采纳 {r.stats.adopt} · 驳回 {r.stats.reject} · 改写 {r.stats.rewrite} · 驳回率 {formatRate(r.stats.rejectRatio)}
            </span>
            <span style={S.muted}>
              {sliding.insufficient ? `近 5 次定稿：样本不足（${sliding.sample} 个决定）` : `近 5 次定稿采纳率 ${formatRate(sliding.rate)}`}
            </span>
            {r.exemplars.map((e, i) => <blockquote key={i} style={S.quote}>范例（{e.kind === 'rewrite' ? '改写' : '采纳'}）：{e.text}</blockquote>)}
            {r.recentRejectReasons.map((reason, i) => <span key={i} style={S.muted}>驳回原因：{reason}</span>)}
          </div>
        )
      })}
      <div style={S.section}>候选规则（{data.candidates.length}）</div>
      {data.candidates.length === 0 ? <span style={S.muted}>暂无候选规则：专家新增且未对应任何规则的意见会出现在这里。</span> : null}
      {data.candidates.map((c) => (
        <div key={c.candidateId} style={S.card}>
          <div style={S.spread}>
            <strong>{c.text}</strong>
            <Pill>{CANDIDATE_STATUS_LABEL[c.status]}</Pill>
          </div>
          <span style={S.muted}>
            {c.candidateId} · 来自 {c.reviewId}{c.suggestedDimension ? ` · 建议维度 ${DIMENSION_LABEL[c.suggestedDimension]}` : ''}{c.draftRuleId ? ` · 草案 ${c.draftRuleId}` : ''}
          </span>
          {c.status === 'new' ? <span style={S.muted}>回到对话请 agent 起草规则（rules_propose draft）后，可在此接受。</span> : null}
          <div style={S.row}>
            {candidateActions(c).map((action) => (
              <button key={action} type="button" data-candidate-action={action} style={S.button} disabled={busy === c.candidateId} onClick={() => onCandidate(c.candidateId, action)}>
                {action === 'accept_draft' ? `接受草案 ${c.draftRuleId ?? ''}` : '忽略'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- 评测 ----------

function headline(run: DashboardEvalRun): string {
  const m = run.metrics as Record<string, unknown>
  return ['precision', 'recall', 'f1', 'kappa']
    .filter((k) => typeof m[k] === 'number')
    .map((k) => `${k} ${(m[k] as number).toFixed(3)}`)
    .join(' · ')
}

export function EvalView({ data, selected, notice, compared, onToggle, onCompare }: {
  data: EvalRunsPayload
  selected: string[]
  notice: string | null
  compared: DashboardEvalRun[] | null
  onToggle: (runId: string) => void
  onCompare: () => void
}): React.ReactElement {
  if (data.runs.length === 0) return <Empty>尚无评测结果。运行离线评测脚本后在此查看（evaluation.md §5）。</Empty>
  const rows = compared ? evalMetricRows(compared) : []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={S.row}>
        <span style={S.muted}>{data.runs.length} 个评测 run · 已选 {selected.length}（2–7 个可对比）</span>
        <button type="button" style={S.button} onClick={onCompare}>对比</button>
      </div>
      {notice ? <div style={S.notice}>{notice}</div> : null}
      {data.runs.map((run) => (
        <label key={run.runId} style={{ ...S.card, cursor: 'pointer' }}>
          <span style={S.row}>
            <input type="checkbox" checked={selected.includes(run.runId)} onChange={() => onToggle(run.runId)} />
            <strong>{run.runId}</strong>
            <span style={S.muted}>{run.dataset} · {run.at}</span>
          </span>
          <span style={S.muted}>{headline(run) || '无主要指标'}</span>
        </label>
      ))}
      {compared ? (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.cell}>指标</th>
              {compared.map((run) => <th key={run.runId} style={S.cell}>{run.runId}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <td style={S.cell}>{row.metric}</td>
                {row.values.map((v, i) => <td key={i} style={S.cell}>{v === null ? '—' : v.toFixed(3)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
