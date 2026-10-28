// 「审查」tab of the main panel: KPI cards, daily volume (calendar / trend) and every review, each
// expandable in place (dashboard.md §3.1).
import * as React from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Verdict } from '../engine/types.js'
import { useLoad } from './data.js'
import {
  REVIEW_STATE_LABEL,
  STATE_FILTERS,
  VERDICTS,
  buildCalendar,
  filterStamps,
  formatDateTime,
  formatDay,
  formatRate,
  formatShortDay,
  overviewKpis,
  trendSeries,
  type CalendarCell,
  type OverviewPayload,
  type ReviewFilter,
  type ReviewStamp,
  type TrendPoint,
} from './model.js'
import { ReviewDetailPanel } from './review-detail.js'
import { C, Chip, Empty, ErrorBar, Pill, S, STATE_COLOR, VerdictPill, brandMix } from './ui.js'

export type ChartMode = 'calendar' | 'trend'

const LEVEL_FILL = ['var(--dsw-alias-bg-layer-2)', brandMix(25), brandMix(50), brandMix(75), brandMix(100)] as const
const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const LEFT = 22
const TOP = 16
const WEEKDAY_LABELS: [number, string][] = [[0, '一'], [2, '三'], [4, '五']]

function KpiCard({ label, value, sub, onClick, on }: { label: string; value: string; sub?: string | undefined; onClick?: () => void; on?: boolean }): React.ReactElement {
  const body = (
    <>
      <span style={S.muted}>{label}</span>
      <span style={{ fontSize: 22, lineHeight: '30px', fontWeight: 500, color: C.label }}>{value}</span>
      <span style={{ ...S.muted, minHeight: 16 }}>{sub ?? ''}</span>
    </>
  )
  const style = { ...S.card, gap: 2, padding: '10px 12px' }
  if (!onClick) return <div data-kpi={label} style={style}>{body}</div>
  return (
    <button
      type="button"
      data-kpi={label}
      className="wsgw-row"
      aria-pressed={on ?? false}
      style={{ ...style, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', ...(on ? { borderColor: C.brand } : {}) }}
      onClick={onClick}
    >
      {body}
    </button>
  )
}

export function KpiCards({ data, today, pendingOn, onPending }: { data: OverviewPayload; today: Date; pendingOn: boolean; onPending: () => void }): React.ReactElement {
  const k = overviewKpis(data.items, today)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
      <KpiCard label="累计审查" value={String(data.total)} sub={data.truncated ? `仅统计最近 ${data.items.length} 条` : undefined} />
      <KpiCard label="近 30 天" value={String(k.last30)} />
      <KpiCard label="待处理" value={String(k.pending)} sub={k.stale > 0 ? `需重新定稿 ${k.stale}` : '点击筛选'} on={pendingOn} onClick={onPending} />
      <KpiCard label="问题采纳率" value={formatRate(k.adoptRate)} sub={k.decided > 0 ? `${k.decided} 个决定（改写算采纳）` : '尚无决定'} />
      <KpiCard label="结论一致率" value={formatRate(k.agreement)} sub={k.agreementSample > 0 ? `${k.agreementSample} 份已定稿` : '尚无定稿'} />
    </div>
  )
}

function cellTitle(cell: CalendarCell): string {
  return `${formatDay(cell.date)} · ${cell.count} 份${cell.count > 0 ? `（已定稿 ${cell.finalized}）` : ''}`
}

export function CalendarHeatmap({ items, today, selectedDay, onDay }: { items: ReviewStamp[]; today: Date; selectedDay: string | undefined; onDay: (day: string | undefined) => void }): React.ReactElement {
  const cal = useMemo(() => buildCalendar(items, today), [items, today])
  const width = LEFT + cal.weeks.length * STEP
  const height = TOP + 7 * STEP
  return (
    <div style={S.stack}>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} role="group" aria-label={`近 ${cal.weeks.length} 周每日发起的审查数，共 ${cal.total} 份；点击某天筛选列表`} style={{ display: 'block' }}>
          {cal.months.map((m) => (
            <text key={m.index} x={LEFT + m.index * STEP} y={10} style={{ fill: C.tertiary, fontSize: 10 }}>{m.label}</text>
          ))}
          {WEEKDAY_LABELS.map(([row, label]) => (
            <text key={row} x={0} y={TOP + row * STEP + CELL - 1} style={{ fill: C.tertiary, fontSize: 10 }}>{label}</text>
          ))}
          {cal.weeks.map((week, w) => week.map((cell, d) => {
            const selected = cell.date === selectedDay
            const x = LEFT + w * STEP
            const y = TOP + d * STEP
            if (cell.future) {
              return <rect key={cell.date} data-heat-cell data-level={0} x={x} y={y} width={CELL} height={CELL} rx={2} style={{ fill: 'transparent' }} />
            }
            return (
              <rect
                key={cell.date}
                data-heat-cell
                data-level={cell.level}
                className="wsgw-cell"
                role="button"
                tabIndex={-1}
                aria-label={cellTitle(cell)}
                aria-pressed={selected}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                style={{ fill: LEVEL_FILL[cell.level], ...(selected ? { stroke: C.label, strokeWidth: 1.5 } : {}) }}
                onClick={() => onDay(selected ? undefined : cell.date)}
              >
                <title>{cellTitle(cell)}</title>
              </rect>
            )
          }))}
        </svg>
      </div>
      <div style={{ ...S.row, justifyContent: 'flex-end', gap: 3 }}>
        <span style={S.muted}>少</span>
        {LEVEL_FILL.map((fill, i) => <span key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: fill, display: 'inline-block' }} />)}
        <span style={S.muted}>多</span>
      </div>
    </div>
  )
}

const TREND_W = 600
const TREND_H = 140
const TREND_PAD = 8

function polyline(series: TrendPoint[], key: 'created' | 'finalized', max: number): string {
  const step = TREND_W / series.length
  return series
    .map((p, i) => `${((i + 0.5) * step).toFixed(1)},${(TREND_H - TREND_PAD - (p[key] / max) * (TREND_H - 2 * TREND_PAD)).toFixed(1)}`)
    .join(' ')
}

export function TrendChart({ items, today }: { items: ReviewStamp[]; today: Date }): React.ReactElement {
  const series = useMemo(() => trendSeries(items, today), [items, today])
  const max = Math.max(1, ...series.map((p) => Math.max(p.created, p.finalized)))
  const created = series.reduce((n, p) => n + p.created, 0)
  const finalized = series.reduce((n, p) => n + p.finalized, 0)
  const step = TREND_W / series.length
  const middle = series[Math.floor(series.length / 2)]!
  return (
    <div style={S.stack}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: TREND_H, ...S.muted }}>
          <span>{max}</span>
          <span>0</span>
        </div>
        <svg
          viewBox={`0 0 ${TREND_W} ${TREND_H}`}
          preserveAspectRatio="none"
          width="100%"
          height={TREND_H}
          role="img"
          aria-label={`近 30 天：发起 ${created} 份，定稿 ${finalized} 份`}
          style={{ display: 'block', flex: 1, minWidth: 0 }}
        >
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={0} x2={TREND_W} y1={TREND_PAD + f * (TREND_H - 2 * TREND_PAD)} y2={TREND_PAD + f * (TREND_H - 2 * TREND_PAD)} vectorEffect="non-scaling-stroke" style={{ stroke: C.border, strokeWidth: 1 }} />
          ))}
          <polyline data-trend-line="created" points={polyline(series, 'created', max)} vectorEffect="non-scaling-stroke" style={{ fill: 'none', stroke: C.brand, strokeWidth: 2 }} />
          <polyline data-trend-line="finalized" points={polyline(series, 'finalized', max)} vectorEffect="non-scaling-stroke" style={{ fill: 'none', stroke: C.success, strokeWidth: 2, strokeDasharray: '4 3' }} />
          {series.map((p, i) => (
            <rect key={p.date} x={i * step} y={0} width={step} height={TREND_H} style={{ fill: 'transparent' }}>
              <title>{`${formatDay(p.date)} · 发起 ${p.created} · 定稿 ${p.finalized}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div style={{ ...S.spread, ...S.muted, paddingLeft: 18 }}>
        <span>{formatShortDay(series[0]!.date)}</span>
        <span>{formatShortDay(middle.date)}</span>
        <span>{formatShortDay(series.at(-1)!.date)}</span>
      </div>
      <div style={{ ...S.row, justifyContent: 'flex-end', gap: 12, ...S.muted }}>
        <span style={S.row}><span style={{ width: 14, height: 2, background: C.brand, display: 'inline-block' }} />发起</span>
        <span style={S.row}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.success}`, display: 'inline-block' }} />定稿</span>
      </div>
    </div>
  )
}

const ROW_GRID = '84px minmax(0, 1fr) auto auto minmax(0, 200px) auto 14px'

function countsText(s: ReviewStamp): string {
  const c = s.counts
  return `问题 ${c.total} · 采纳 ${c.adopted} / 驳回 ${c.rejected} / 改写 ${c.rewritten} / 待人工 ${c.pending}`
}

function ReviewRow({ stamp, expanded, onToggle, detail }: { stamp: ReviewStamp; expanded: boolean; onToggle: () => void; detail: ReactNode }): React.ReactElement {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        type="button"
        data-review-row
        className="wsgw-row"
        aria-expanded={expanded}
        style={{ display: 'grid', gridTemplateColumns: ROW_GRID, gap: 10, alignItems: 'center', width: '100%', padding: '8px 6px', border: 'none', background: expanded ? C.hover : 'transparent', color: C.label, font: 'var(--dsw-font-xs-13)', textAlign: 'left', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <span style={S.muted}>{formatDateTime(stamp.createdAt)}</span>
        <span style={{ ...S.ellipsis, fontWeight: 500 }} title={stamp.title}>{stamp.title}</span>
        <VerdictPill verdict={stamp.aiVerdict} prefix="预审 " />
        {stamp.finalVerdict ? <VerdictPill verdict={stamp.finalVerdict} prefix="最终 " /> : <Pill>未定</Pill>}
        <span style={{ ...S.muted, ...S.ellipsis }} title={countsText(stamp)}>{countsText(stamp)}</span>
        <Pill color={STATE_COLOR[stamp.state]}>{REVIEW_STATE_LABEL[stamp.state]}</Pill>
        <span aria-hidden style={S.muted}>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? <div data-review-expanded style={{ padding: '8px 12px 16px', background: C.layer1 }}>{detail}</div> : null}
    </div>
  )
}

export interface ReviewsViewProps {
  data: OverviewPayload
  today: Date
  filter: ReviewFilter
  onFilter: (filter: ReviewFilter) => void
  chart: ChartMode
  onChart: (mode: ChartMode) => void
  expanded: string | null
  onToggle: (reviewId: string) => void
  detail: ReactNode
  limit: number
  onMore: () => void
}

export function ReviewsView({ data, today, filter, onFilter, chart, onChart, expanded, onToggle, detail, limit, onMore }: ReviewsViewProps): React.ReactElement {
  const rows = filterStamps(data.items, filter)
  const shown = rows.slice(0, limit)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiCards data={data} today={today} pendingOn={filter.state === 'pending'} onPending={() => onFilter({ ...filter, state: filter.state === 'pending' ? undefined : 'pending' })} />

      <section style={S.card}>
        <div style={S.spread}>
          <span style={S.cardTitle}>审查量</span>
          <span style={S.row}>
            <Chip on={chart === 'calendar'} onClick={() => onChart('calendar')} data-chart="calendar">日历</Chip>
            <Chip on={chart === 'trend'} onClick={() => onChart('trend')} data-chart="trend">趋势</Chip>
          </span>
        </div>
        {chart === 'calendar'
          ? <CalendarHeatmap items={data.items} today={today} selectedDay={filter.day} onDay={(day) => onFilter({ ...filter, day })} />
          : <TrendChart items={data.items} today={today} />}
      </section>

      <section style={{ ...S.card, padding: 0, gap: 0 }}>
        <div style={{ ...S.spread, padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <span style={S.row}>
            {STATE_FILTERS.map(([state, label]) => (
              <Chip key={label} on={filter.state === state} onClick={() => onFilter({ ...filter, state })} data-state-filter={state ?? 'all'}>{label}</Chip>
            ))}
          </span>
          <span style={S.row}>
            {filter.day ? (
              <Chip on onClick={() => onFilter({ ...filter, day: undefined })} data-day-filter={filter.day}>{`${formatDay(filter.day)} ×`}</Chip>
            ) : null}
            <select style={S.field} aria-label="结论" value={filter.verdict ?? ''} onChange={(e) => onFilter({ ...filter, verdict: (e.currentTarget.value || undefined) as Verdict | undefined })}>
              <option value="">全部结论</option>
              {VERDICTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input style={{ ...S.field, width: 180 }} type="search" aria-label="搜索方案" placeholder="搜索标题 / 编号 / 审核人" value={filter.query ?? ''} onChange={(e) => onFilter({ ...filter, query: e.currentTarget.value || undefined })} />
            <span style={S.muted}>{`${rows.length} / ${data.items.length}`}</span>
          </span>
        </div>
        {data.items.length === 0
          ? <Empty>还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。</Empty>
          : rows.length === 0
            ? <Empty>当前筛选下没有方案。</Empty>
            : shown.map((stamp) => (
              <ReviewRow key={stamp.reviewId} stamp={stamp} expanded={expanded === stamp.reviewId} onToggle={() => onToggle(stamp.reviewId)} detail={expanded === stamp.reviewId ? detail : null} />
            ))}
        {rows.length > shown.length ? (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <button type="button" style={S.button} onClick={onMore}>{`显示更多（剩余 ${rows.length - shown.length}）`}</button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

const PAGE = 50

export function ReviewsTab({ version }: { version: number }): React.ReactElement {
  const overview = useLoad<OverviewPayload>('/overview', version)
  const [filter, setFilter] = useState<ReviewFilter>({})
  const [chart, setChart] = useState<ChartMode>('calendar')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const today = useMemo(() => new Date(), [overview.data])
  const reload = useCallback(() => overview.reload(), [overview.reload])
  if (overview.error && !overview.data) return <ErrorBar message={`加载失败：${overview.error}`} onRetry={() => void overview.reload()} />
  if (!overview.data) return <Empty>加载中…</Empty>
  return (
    <div style={S.stack}>
      {overview.error ? <ErrorBar message={`刷新失败：${overview.error}`} onRetry={() => void overview.reload()} /> : null}
      <ReviewsView
        data={overview.data}
        today={today}
        filter={filter}
        onFilter={(next) => {
          setFilter(next)
          setLimit(PAGE)
        }}
        chart={chart}
        onChart={setChart}
        expanded={expanded}
        onToggle={(id) => setExpanded(expanded === id ? null : id)}
        detail={expanded ? <ReviewDetailPanel reviewId={expanded} version={version} onChanged={reload} /> : null}
        limit={limit}
        onMore={() => setLimit(limit + PAGE)}
      />
    </div>
  )
}
