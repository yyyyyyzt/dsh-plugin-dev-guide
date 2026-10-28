// The two entries (dashboard.md §1): the left-panel main page and the right-sidebar review assistant.
import * as React from 'react'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useLoad } from './data.js'
import { EvalTab } from './eval.js'
import { REVIEW_STATE_LABEL, assistantQueue, formatDateTime, type OverviewPayload, type ReviewStamp } from './model.js'
import { ReviewsTab } from './overview.js'
import { ReviewDetailPanel } from './review-detail.js'
import { RulesTab } from './rules.js'
import { C, Chip, Empty, ErrorBar, S, SCOPED_CSS } from './ui.js'

type Tab = 'reviews' | 'rules' | 'eval'
const TABS: [Tab, string][] = [['reviews', '审查'], ['rules', '规则'], ['eval', '评测']]

export function OverviewPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('reviews')
  const [version, setVersion] = useState(0)
  return (
    <div style={{ height: '100%', width: '100%', minHeight: 0, overflow: 'auto', background: C.base, color: C.label, fontSize: 14, lineHeight: 1.6 }}>
      <style>{SCOPED_CSS}</style>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 clamp(24px, 4vw, 48px) 48px' }}>
        <header style={{ ...S.spread, gap: 16, paddingTop: 'calc(28px + var(--dsh-frame-top-clearance, 0px))', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 500 }}>方案审查</h1>
            <span style={S.muted}>AI 只建议 · 专家定稿。发起审查与定稿在「方案审查」agent 会话中完成。</span>
          </div>
          <button type="button" style={S.button} onClick={() => setVersion((v) => v + 1)}>刷新</button>
        </header>
        <nav role="tablist" style={{ ...S.row, marginBottom: 16 }}>
          {TABS.map(([id, label]) => (
            <Chip key={id} on={tab === id} onClick={() => setTab(id)} data-tab={id}>{label}</Chip>
          ))}
        </nav>
        {tab === 'reviews' ? <ReviewsTab version={version} /> : null}
        {tab === 'rules' ? <RulesTab version={version} /> : null}
        {tab === 'eval' ? <EvalTab version={version} /> : null}
      </div>
    </div>
  )
}

export interface AssistantViewProps {
  queue: ReviewStamp[]
  selected: string | null
  onSelect: (reviewId: string) => void
  detail: ReactNode
  onOpenOverview: () => void
  onRefresh: () => void
}

export function AssistantView({ queue, selected, onSelect, detail, onOpenOverview, onRefresh }: AssistantViewProps): React.ReactElement {
  return (
    <div style={S.stack}>
      <div style={S.spread}>
        <strong>复核助手</strong>
        <span style={S.row}>
          <button type="button" style={S.button} onClick={onRefresh}>刷新</button>
          <button type="button" data-open-overview style={S.button} onClick={onOpenOverview}>打开总览</button>
        </span>
      </div>
      {queue.length === 0 ? (
        <div style={{ ...S.empty, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <span>没有待处理的审查。在「方案审查」会话里粘贴方案开始；历史记录与规则见左侧栏「方案审查」。</span>
          <button type="button" data-open-overview style={S.button} onClick={onOpenOverview}>打开总览</button>
        </div>
      ) : (
        <>
          {queue.length > 1 ? (
            <select style={{ ...S.field, width: '100%' }} aria-label="选择审查" value={selected ?? ''} onChange={(e) => onSelect(e.currentTarget.value)}>
              {queue.map((s) => (
                <option key={s.reviewId} value={s.reviewId}>{`${s.title} · ${formatDateTime(s.createdAt)} · ${REVIEW_STATE_LABEL[s.state]}`}</option>
              ))}
            </select>
          ) : (
            <span style={S.muted}>{`待处理 1 份 · ${formatDateTime(queue[0]!.createdAt)}`}</span>
          )}
          {detail}
        </>
      )}
    </div>
  )
}

export function ReviewAssistant({ openOverview }: { openOverview: () => void }): React.ReactElement {
  const [version, setVersion] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const overview = useLoad<OverviewPayload>('/overview', version)
  const reload = useCallback(() => overview.reload(), [overview.reload])
  const queue = assistantQueue(overview.data?.items ?? [])
  const selected = queue.find((s) => s.reviewId === picked)?.reviewId ?? queue[0]?.reviewId ?? null
  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'auto', padding: 12, boxSizing: 'border-box', color: C.label, font: 'var(--dsw-font-xs-13)' }}>
      <style>{SCOPED_CSS}</style>
      {overview.error ? <ErrorBar message={`加载失败：${overview.error}`} onRetry={() => void overview.reload()} /> : null}
      {!overview.data && !overview.error ? <Empty>加载中…</Empty> : null}
      {overview.data ? (
        <AssistantView
          queue={queue}
          selected={selected}
          onSelect={setPicked}
          detail={selected ? <ReviewDetailPanel key={selected} reviewId={selected} version={version} onChanged={reload} /> : null}
          onOpenOverview={openOverview}
          onRefresh={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </div>
  )
}
