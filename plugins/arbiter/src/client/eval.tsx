// 「评测」tab: offline eval runs and a 2–7 run comparison (dashboard.md §3.4).
import * as React from 'react'
import { useState } from 'react'
import { message, useLoad } from './data.js'
import { compareNotice, evalMetricRows, requestJson, toggleCompare, type DashboardEvalRun, type EvalRunsPayload } from './model.js'
import { Empty, ErrorBar, S } from './ui.js'

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
    <div style={S.stack}>
      <div style={S.row}>
        <span style={S.muted}>{`${data.runs.length} 个评测 run · 已选 ${selected.length}（2–7 个可对比）`}</span>
        <button type="button" style={S.button} onClick={onCompare}>对比</button>
      </div>
      {notice ? <div style={S.notice}>{notice}</div> : null}
      {data.runs.map((run) => (
        <label key={run.runId} style={{ ...S.card, cursor: 'pointer' }}>
          <span style={S.row}>
            <input type="checkbox" checked={selected.includes(run.runId)} onChange={() => onToggle(run.runId)} />
            <strong>{run.runId}</strong>
            <span style={S.muted}>{`${run.dataset} · ${run.at}`}</span>
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

export function EvalTab({ version }: { version: number }): React.ReactElement {
  const runs = useLoad<EvalRunsPayload>('/eval-runs', version)
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [compared, setCompared] = useState<DashboardEvalRun[] | null>(null)
  if (runs.error) return <ErrorBar message={`加载失败：${runs.error}`} onRetry={() => void runs.reload()} />
  if (!runs.data) return <Empty>加载中…</Empty>
  const compare = async (): Promise<void> => {
    setCompared(null)
    const blocked = compareNotice(selected)
    setNotice(blocked)
    if (blocked) return
    try {
      setCompared((await requestJson<EvalRunsPayload>(`/eval-runs?ids=${selected.map(encodeURIComponent).join(',')}`)).runs)
    } catch (e) {
      setNotice(message(e))
    }
  }
  return (
    <EvalView
      data={runs.data}
      selected={selected}
      notice={notice}
      compared={compared}
      onToggle={(runId) => {
        const next = toggleCompare(selected, runId)
        setSelected(next.selected)
        setNotice(next.notice ?? null)
      }}
      onCompare={() => void compare()}
    />
  )
}
