// One review's full result with in-place decisions; shared by the overview's expanded row and the
// right-sidebar assistant (dashboard.md §3.3).
import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Evidence, Verdict } from '../engine/types.js'
import type { IssueRecord } from '../store/domain.js'
import { post, useLoad, useWrite } from './data.js'
import {
  CHECKLIST_STATUS_LABEL,
  ISSUE_STATUS_LABEL,
  ORIGIN_LABEL,
  REVIEW_STATE_LABEL,
  SEVERITY_LABEL,
  VERDICTS,
  reviewState,
  type DecideBody,
  type ReviewDetailPayload,
} from './model.js'
import { C, Empty, ErrorBar, Pill, S, SEVERITY_COLOR, STATE_COLOR, VerdictPill } from './ui.js'

function EvidenceList({ evidence }: { evidence: Evidence[] }): React.ReactElement {
  if (evidence.length === 0) return <span style={S.muted}>无证据（专家意见或待补引文）</span>
  return (
    <>
      {evidence.map((e, i) => e.kind === 'absence'
        ? <span key={i} style={S.muted}>{`未提及（校验器判定，非引文）：${e.quote}`}</span>
        : (
          <blockquote key={i} style={S.quote}>
            “{e.quote}”{e.sectionPath ? <span style={S.muted}>{`（${e.sectionPath}）`}</span> : null}
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
        <strong>{`${issue.ruleId ?? '专家'} · ${issue.finding}`}</strong>
        <span style={S.row}>
          <Pill color={SEVERITY_COLOR[issue.severity]}>{SEVERITY_LABEL[issue.severity]}</Pill>
          <Pill color={issue.status === 'pending' ? C.warn : undefined}>{ISSUE_STATUS_LABEL[issue.status]}</Pill>
        </span>
      </div>
      <span style={S.muted}>
        {`来源：${ORIGIN_LABEL[issue.origin]}${!issue.gate.passed && issue.gate.reasons.length ? ` · 门禁未过：${issue.gate.reasons.join('、')}` : ''}`}
      </span>
      <EvidenceList evidence={issue.evidence} />
      <span style={S.secondary}>{`建议：${issue.status === 'rewritten' && issue.rewriteText ? issue.rewriteText : issue.suggestion}`}</span>
      {issue.status === 'rewritten' ? <span style={S.muted}>{`（专家改写；原建议：${issue.suggestion}）`}</span> : null}
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
  const checklistSummary = Object.entries(data.checklistCounts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${CHECKLIST_STATUS_LABEL[k as keyof typeof CHECKLIST_STATUS_LABEL]} ${n}`)
    .join(' · ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={S.spread}>
        <strong>{r.title}</strong>
        <Pill color={STATE_COLOR[state]}>{REVIEW_STATE_LABEL[state]}</Pill>
      </div>
      <span style={S.muted}>{`${r.reviewId} · 规则包 ${r.rulePackVersion}`}</span>
      {state === 'stale' ? <div style={S.notice}>定稿后决定已变更，旧意见文件已过期：需回到对话重新定稿（review_finalize）。</div> : null}
      {(r.warnings ?? []).map((w) => <div key={w} style={S.notice}>{w}</div>)}

      <div style={S.section}>结论</div>
      <div style={S.row}>
        <VerdictPill verdict={r.aiVerdict} prefix="当前预审建议 " />
        {r.finalVerdict ? <VerdictPill verdict={r.finalVerdict} prefix="最终 " /> : <span style={S.muted}>最终结论未确认</span>}
      </div>
      {delta ? (
        <div data-verdict-delta style={S.notice}>{`定稿时预审结论「${r.aiVerdictAtFinalize}」与专家最终结论「${r.finalVerdict}」不一致`}</div>
      ) : null}
      <span style={S.muted}>{data.basis}</span>

      <div style={S.section}>{`问题（${data.issues.length}）`}</div>
      {data.issues.length === 0 ? <span style={S.muted}>没有登记问题。</span> : null}
      {data.issues.map((issue) => (
        <IssueCard key={issue.issueId} issue={issue} draft={draft} busy={busy} onDraft={setDraft} onDecide={decide} />
      ))}

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
        : r.versions.map((v) => <span key={v.version} style={S.muted}>{`v${v.version} · ${v.path} · ${v.at}`}</span>)}
      <span style={S.muted}>{`工具调用 ${r.metrics.toolCalls} 次 · 门禁拒绝 ${r.metrics.gateRejects} 次`}</span>

      <details>
        <summary style={{ ...S.section, cursor: 'pointer' }}>{`检查清单（${data.checklist.length} 条）${checklistSummary ? ` · ${checklistSummary}` : ''}`}</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, border: `1px solid ${C.border}`, borderRadius: 'var(--dsw-radius-sm)', padding: 6 }}>
          {data.checklist.map((row) => (
            <div key={row.ruleId} data-check-row style={{ display: 'grid', gridTemplateColumns: '72px 84px minmax(0, 1fr)', gap: 6, font: 'var(--dsw-font-xxs-12)' }}>
              <span>{row.ruleId}</span>
              <span style={{ color: row.status === 'fail' ? C.error : row.status === 'pass' ? C.success : C.secondary }}>{CHECKLIST_STATUS_LABEL[row.status]}</span>
              <span style={S.muted}>{row.note ?? row.title}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

/** Loads one review and wires its decisions; `onChanged` lets the caller refresh its own list. */
export function ReviewDetailPanel({ reviewId, version, onChanged }: { reviewId: string; version: number; onChanged: () => Promise<void> }): React.ReactElement {
  const detail = useLoad<ReviewDetailPayload>(`/reviews/${encodeURIComponent(reviewId)}`, version)
  const after = useCallback(async () => {
    await Promise.all([detail.reload(), onChanged()])
  }, [detail.reload, onChanged])
  const write = useWrite(after)
  const base = `/reviews/${encodeURIComponent(reviewId)}`
  return (
    <div style={S.stack}>
      {write.error ? <ErrorBar message={`操作失败：${write.error}`} /> : null}
      {detail.error ? <ErrorBar message={`加载失败：${detail.error}`} onRetry={() => void detail.reload()} /> : null}
      {detail.data && detail.data.review.reviewId === reviewId ? (
        <ReviewDetailView
          key={`${reviewId}:${detail.data.review.reviewer ?? ''}:${detail.data.review.finalVerdict ?? ''}`}
          data={detail.data}
          busy={write.busy !== null}
          onDecide={(issueId, body) => void write.run(issueId, `${base}/issues/${encodeURIComponent(issueId)}`, post(body))}
          onReviewer={(reviewer) => void write.run('reviewer', `${base}/reviewer`, post({ reviewer }))}
          onVerdict={(finalVerdict) => void write.run('verdict', `${base}/final-verdict`, post({ finalVerdict }))}
        />
      ) : detail.error ? null : <Empty>加载中…</Empty>}
    </div>
  )
}
