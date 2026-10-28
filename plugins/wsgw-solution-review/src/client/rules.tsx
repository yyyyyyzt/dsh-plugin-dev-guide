// 「规则」tab: global rules with in-place edits to the learned layer, candidate rules, and per-rule
// memory (dashboard.md §3.2). Memory is keyed by rule, so it lives on the rule row.
import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Dimension, Severity, Tier, RuleStatus } from '../engine/types.js'
import { patch, post, useLoad, useWrite } from './data.js'
import {
  CANDIDATE_STATUS_LABEL,
  DIMENSION_LABEL,
  RULE_STATUS_LABEL,
  SEVERITY_LABEL,
  SUGGESTION_MAX,
  TIER_LABEL,
  canReset,
  candidateActions,
  filterRules,
  formatDateTime,
  formatRate,
  markFrequentlyRejected,
  memoryByRule,
  openCandidates,
  slidingAdoptRate,
  validateSuggestion,
  type CandidateAction,
  type DashboardMemory,
  type DashboardMemoryRule,
  type RuleAction,
  type RuleDetailPayload,
  type RuleFilter,
  type RuleView,
  type RulesPayload,
} from './model.js'
import { C, Chip, Empty, ErrorBar, Pill, S, SEVERITY_COLOR } from './ui.js'

const RULE_GRID = '72px minmax(0, 1fr) 64px 56px 64px 48px 96px minmax(0, auto) 14px'

function adoptRate(r: RuleView): number | null {
  const decided = r.stats.adopt + r.stats.reject + r.stats.rewrite
  return decided === 0 ? null : (r.stats.adopt + r.stats.rewrite) / decided
}

function CandidateList({ memory, busy, onCandidate }: { memory: DashboardMemory; busy: string | null; onCandidate: (candidateId: string, action: CandidateAction) => void }): React.ReactElement | null {
  const candidates = openCandidates(memory)
  if (candidates.length === 0) return null
  return (
    <section style={S.card}>
      <span style={S.cardTitle}>{`候选规则（${candidates.length}）`}</span>
      <span style={S.muted}>专家新增且未对应任何规则的意见。回到对话请 agent 起草规则（rules_propose draft）后，可在此接受。</span>
      {candidates.map((c) => (
        <div key={c.candidateId} style={{ ...S.spread, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <span>{c.text}</span>
            <span style={S.muted}>
              {`${c.candidateId} · 来自 ${c.reviewId}${c.suggestedDimension ? ` · 建议维度 ${DIMENSION_LABEL[c.suggestedDimension]}` : ''}${c.draftRuleId ? ` · 草案 ${c.draftRuleId}` : ''}`}
            </span>
            {c.status === 'new' ? <span style={S.muted}>回到对话请 agent 起草后可接受。</span> : null}
          </span>
          <span style={S.row}>
            <Pill>{CANDIDATE_STATUS_LABEL[c.status]}</Pill>
            {candidateActions(c).map((action) => (
              <button key={action} type="button" data-candidate-action={action} style={action === 'accept_draft' ? S.primary : S.button} disabled={busy === c.candidateId} onClick={() => onCandidate(c.candidateId, action)}>
                {action === 'accept_draft' ? `接受草案 ${c.draftRuleId ?? ''}` : '忽略'}
              </button>
            ))}
          </span>
        </div>
      ))}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={S.muted}>{label}</span>
      {children}
    </div>
  )
}

function RuleEditor({ rule, detail, busy, onAct }: { rule: RuleView; detail: RuleDetailPayload; busy: boolean; onAct: (action: RuleAction) => void }): React.ReactElement {
  const d = detail.detail
  const [text, setText] = useState(d.suggestion)
  const [confirming, setConfirming] = useState(false)
  const problem = validateSuggestion(text)
  const unchanged = text.trim() === d.suggestion
  const diffs: string[] = []
  if (d.shipped && d.override?.status) diffs.push(`状态：${RULE_STATUS_LABEL[d.shipped.status]} → ${RULE_STATUS_LABEL[d.override.status]}`)
  if (d.shipped && d.override?.severity) diffs.push(`级别：${d.shipped.severity} → ${d.override.severity}`)
  if (d.shipped && d.override?.suggestion) diffs.push(`整改建议：已修改（出厂：${d.shipped.suggestion}）`)
  if (d.override?.params) diffs.push('校验器参数：已在对话中调整')
  return (
    <div style={S.stack}>
      <span style={S.cardTitle}>编辑（全局生效）</span>
      <div style={S.row}>
        {rule.status === 'draft' ? (
          <span style={S.muted}>草案规则：在候选规则中接受草案后启用。</span>
        ) : (
          <button type="button" data-rule-status style={S.button} disabled={busy} onClick={() => onAct({ action: rule.status === 'active' ? 'disable' : 'enable' })}>
            {rule.status === 'active' ? '停用' : '启用'}
          </button>
        )}
        <select style={S.field} aria-label="严重级别" value={rule.severity} disabled={busy} onChange={(e) => onAct({ action: 'set_severity', severity: e.currentTarget.value as Severity })}>
          {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <Field label="整改建议（预审登记问题时使用的默认建议）">
        <textarea data-rule-suggestion style={S.textarea} aria-label="整改建议" maxLength={SUGGESTION_MAX + 50} value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </Field>
      <div style={S.row}>
        <button type="button" style={S.button} disabled={busy || problem !== null || unchanged} onClick={() => onAct({ action: 'set_suggestion', suggestion: text.trim() })}>保存建议</button>
        {!unchanged ? <button type="button" style={S.link} onClick={() => setText(d.suggestion)}>撤销修改</button> : null}
        <span style={problem && !unchanged ? S.notice : S.muted}>{problem && !unchanged ? problem : `${text.trim().length} / ${SUGGESTION_MAX}`}</span>
      </div>
      {diffs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={S.notice}>已覆盖出厂值</span>
          {diffs.map((line) => <span key={line} style={S.muted}>{line}</span>)}
        </div>
      ) : null}
      {canReset(detail) ? (
        confirming ? (
          <div style={S.row}>
            <span style={S.notice}>恢复全部出厂值（状态、级别、建议、参数）？</span>
            <button type="button" data-rule-reset="confirm" style={S.button} disabled={busy} onClick={() => { setConfirming(false); onAct({ action: 'reset' }) }}>确认恢复</button>
            <button type="button" style={S.link} onClick={() => setConfirming(false)}>取消</button>
          </div>
        ) : (
          <div style={S.row}>
            <button type="button" data-rule-reset style={S.button} disabled={busy} onClick={() => setConfirming(true)}>恢复出厂</button>
          </div>
        )
      ) : null}
      {d.audit.length > 0 ? (
        <Field label="最近变更">
          {[...d.audit].reverse().map((a, i) => (
            <span key={i} style={S.muted}>{`${formatDateTime(a.at)} · ${a.who} · ${a.change.field}：${String(a.change.from ?? '—')} → ${String(a.change.to ?? '—')}`}</span>
          ))}
        </Field>
      ) : null}
    </div>
  )
}

function RuleMemory({ detail, memory }: { detail: RuleDetailPayload; memory: DashboardMemoryRule | undefined }): React.ReactElement {
  const m = detail.detail.memory
  const sliding = slidingAdoptRate(memory?.series ?? [])
  return (
    <div style={S.stack}>
      <span style={S.cardTitle}>记忆</span>
      <span style={S.muted}>{`展示 ${m.stats.shown} · 采纳 ${m.stats.adopt} · 驳回 ${m.stats.reject} · 改写 ${m.stats.rewrite}`}</span>
      <span style={S.muted}>
        {sliding.insufficient ? `近 5 次定稿：样本不足（${sliding.sample} 个决定）` : `近 5 次定稿采纳率 ${formatRate(sliding.rate)}`}
      </span>
      {m.warn ? <span style={S.notice}>常被驳回：建议复核措辞或适用范围。</span> : null}
      {m.exemplars.length === 0 ? <span style={S.muted}>暂无措辞范例。</span> : null}
      {m.exemplars.map((e, i) => <blockquote key={i} style={S.quote}>{`范例（${e.kind === 'rewrite' ? '改写' : '采纳'}）：${e.text}`}</blockquote>)}
      {m.recentRejectReasons.map((reason, i) => <span key={i} style={S.muted}>{`驳回原因：${reason}`}</span>)}
    </div>
  )
}

function RuleContent({ detail }: { detail: RuleDetailPayload }): React.ReactElement {
  const d = detail.detail
  return (
    <div style={S.stack}>
      <span style={S.cardTitle}>内容</span>
      <span>{d.question}</span>
      <span style={S.secondary}>{`依据：${d.rationale}`}</span>
      <span style={S.muted}>{`适用范围：${d.applicability ? JSON.stringify(d.applicability) : '全部方案'}`}</span>
      <details>
        <summary style={{ ...S.muted, cursor: 'pointer' }}>{d.verifier ? `校验器：${d.verifier.kind}` : '校验器：无（语义规则）'}</summary>
        <pre style={S.pre}>{d.verifier ? JSON.stringify(d.verifier, null, 2) : '语义规则由模型判断后一律待人工。'}</pre>
      </details>
      <span style={S.muted}>{`来源：${d.provenance.source}`}</span>
      <span style={S.muted}>检查问题、依据、适用范围与校验器结构不在看板修改；需要时在对话中让 agent 起草新规则。</span>
    </div>
  )
}

export interface RulesViewProps {
  data: RulesPayload
  memory: DashboardMemory | null
  filter: RuleFilter
  onFilter: (filter: RuleFilter) => void
  expanded: string | null
  detail: RuleDetailPayload | null
  busy: string | null
  onToggle: (ruleId: string) => void
  onAct: (ruleId: string, action: RuleAction) => void
  onCandidate: (candidateId: string, action: CandidateAction) => void
}

export function RulesView({ data, memory, filter, onFilter, expanded, detail, busy, onToggle, onAct, onCandidate }: RulesViewProps): React.ReactElement {
  const rules = filterRules(data.rules, filter)
  const memo = memoryByRule(memory)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.loadErrors.map((e, i) => <ErrorBar key={i} message={`规则包加载失败：${JSON.stringify(e)}`} />)}
      {data.warnings.length > 0 ? <div style={S.notice}>{data.warnings.join('；')}</div> : null}
      {memory ? <CandidateList memory={memory} busy={busy} onCandidate={onCandidate} /> : null}

      <section style={{ ...S.card, padding: 0, gap: 0 }}>
        <div style={{ ...S.spread, padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <span style={S.row}>
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
            <input style={{ ...S.field, width: 160 }} type="search" aria-label="搜索规则" placeholder="规则号 / 标题" value={filter.query ?? ''} onChange={(e) => onFilter({ ...filter, query: e.currentTarget.value || undefined })} />
            <Chip on={filter.overriddenOnly === true} onClick={() => onFilter({ ...filter, overriddenOnly: filter.overriddenOnly ? undefined : true })} data-overridden-filter="1">只看已覆盖</Chip>
          </span>
          <span style={S.muted}>{`${rules.length} / ${data.rules.length} 条 · 规则包 ${data.version}`}</span>
        </div>
        {rules.length === 0 ? <Empty>当前筛选下没有规则。</Empty> : null}
        {rules.map((r) => {
          const open = expanded === r.ruleId
          const rate = adoptRate(r)
          return (
            <div key={r.ruleId} style={{ borderBottom: `1px solid ${C.border}` }}>
              <button
                type="button"
                data-rule-row
                className="wsgw-row"
                aria-expanded={open}
                style={{ display: 'grid', gridTemplateColumns: RULE_GRID, gap: 8, alignItems: 'center', width: '100%', padding: '8px 6px', border: 'none', background: open ? C.hover : 'transparent', color: r.status === 'retired' ? C.tertiary : C.label, font: 'var(--dsw-font-xs-13)', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onToggle(r.ruleId)}
              >
                <span style={{ fontWeight: 500 }}>{r.ruleId}</span>
                <span style={S.ellipsis} title={r.title}>{r.title}</span>
                <span style={S.muted}>{DIMENSION_LABEL[r.dimension]}</span>
                <span style={S.muted}>{TIER_LABEL[r.tier]}</span>
                <Pill color={SEVERITY_COLOR[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
                <span style={S.muted}>{RULE_STATUS_LABEL[r.status]}</span>
                <span style={S.muted} title="采纳 + 改写 / 全部决定">{rate === null ? '采纳率 —' : `采纳率 ${formatRate(rate)}（${r.stats.shown}）`}</span>
                <span style={S.row}>
                  {r.overridden ? <Pill color={C.warn}>已覆盖</Pill> : null}
                  {markFrequentlyRejected(r.stats) ? <Pill color={C.error}>常被驳回</Pill> : null}
                </span>
                <span aria-hidden style={S.muted}>{open ? '▾' : '▸'}</span>
              </button>
              {open ? (
                <div data-rule-detail style={{ padding: '12px 12px 16px', background: C.layer1 }}>
                  {detail && detail.rule.ruleId === r.ruleId ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <RuleContent detail={detail} />
                      <RuleEditor key={`${r.ruleId}:${detail.detail.suggestion}`} rule={r} detail={detail} busy={busy === r.ruleId} onAct={(action) => onAct(r.ruleId, action)} />
                      <RuleMemory detail={detail} memory={memo.get(r.ruleId)} />
                    </div>
                  ) : <span style={S.muted}>加载详情…</span>}
                </div>
              ) : null}
            </div>
          )
        })}
      </section>
    </div>
  )
}

export function RulesTab({ version }: { version: number }): React.ReactElement {
  const [filter, setFilter] = useState<RuleFilter>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const rules = useLoad<RulesPayload>('/rules', version)
  const memory = useLoad<DashboardMemory>('/memory', version)
  const detail = useLoad<RuleDetailPayload>(expanded ? `/rules/${encodeURIComponent(expanded)}` : null, version)
  const after = useCallback(async () => {
    await Promise.all([rules.reload(), memory.reload(), detail.reload()])
  }, [rules.reload, memory.reload, detail.reload])
  const write = useWrite(after)
  if (rules.error && !rules.data) return <ErrorBar message={`加载失败：${rules.error}`} onRetry={() => void rules.reload()} />
  if (!rules.data) return <Empty>加载中…</Empty>
  return (
    <div style={S.stack}>
      {write.error ? <ErrorBar message={`操作失败：${write.error}`} /> : null}
      {memory.error ? <ErrorBar message={`记忆加载失败：${memory.error}`} onRetry={() => void memory.reload()} /> : null}
      {detail.error ? <ErrorBar message={`规则详情加载失败：${detail.error}`} onRetry={() => void detail.reload()} /> : null}
      <RulesView
        data={rules.data}
        memory={memory.data}
        filter={filter}
        onFilter={setFilter}
        expanded={expanded}
        detail={detail.data}
        busy={write.busy}
        onToggle={(ruleId) => setExpanded(expanded === ruleId ? null : ruleId)}
        onAct={(ruleId, action) => void write.run(ruleId, `/rules/${encodeURIComponent(ruleId)}`, patch(action))}
        onCandidate={(candidateId, action) => void write.run(candidateId, `/candidates/${encodeURIComponent(candidateId)}`, post({ action }))}
      />
    </div>
  )
}
