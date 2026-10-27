// Dashboard client: one right-sidebar page tab (dashboard.md §1) whose four pages read and write the
// same-origin API under /plugins/wsgw-solution-review/api (design.md §10).
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { Verdict } from '../engine/types.js'
import {
  compareNotice,
  requestJson,
  toggleCompare,
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
import { EvalView, Empty, ErrorBar, MemoryView, ReviewDetailView, ReviewListView, RulesView, S } from './views.js'

const TAB_ID = 'wsgw-solution-review'

export const TAB_DEFINITION = {
  id: TAB_ID,
  kind: 'wsgw-review',
  priority: 'extension' as const,
  keepMounted: true,
  title: (): string => '方案审查',
  guide: [{ id: 'dashboard', order: 50, title: (): string => '方案审查看板', description: (): string => '规则 · 审查记录 · 记忆 · 评测' }],
}

type Page = 'reviews' | 'rules' | 'memory' | 'eval'
const PAGES: [Page, string][] = [['reviews', '审查记录'], ['rules', '规则'], ['memory', '记忆'], ['eval', '评测']]

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

interface Loaded<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

function useLoad<T>(path: string | null, version: number): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const reload = useCallback(async () => {
    if (path === null) return
    setLoading(true)
    setError(null)
    try {
      setData(await requestJson<T>(path))
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }, [path])
  useEffect(() => {
    void reload()
  }, [reload, version])
  return { data, error, loading, reload }
}

/** Runs one write, reports its error, then reloads whatever the write affected. */
function useWrite(after: () => Promise<void>): { busy: string | null; error: string | null; run: (key: string, path: string, init: RequestInit) => Promise<void> } {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (key: string, path: string, init: RequestInit) => {
    setBusy(key)
    setError(null)
    try {
      await requestJson(path, init)
      await after()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(null)
    }
  }, [after])
  return { busy, error, run }
}

function ReviewsPage({ version }: { version: number }): React.ReactElement {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const list = useLoad<ReviewListPayload>(`/reviews?page=${page}`, version)
  const detail = useLoad<ReviewDetailPayload>(selected ? `/reviews/${encodeURIComponent(selected)}` : null, version)
  const reloadBoth = useCallback(async () => {
    await Promise.all([detail.reload(), list.reload()])
  }, [detail.reload, list.reload])
  const write = useWrite(reloadBoth)
  const base = selected ? `/reviews/${encodeURIComponent(selected)}` : ''
  if (list.error) return <ErrorBar message={`加载失败：${list.error}`} onRetry={() => void list.reload()} />
  if (!list.data) return <Empty>加载中…</Empty>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {selected ? (
        <>
          <button type="button" style={S.link} onClick={() => setSelected(null)}>← 返回列表</button>
          {write.error ? <ErrorBar message={`操作失败：${write.error}`} /> : null}
          {detail.error ? <ErrorBar message={`加载失败：${detail.error}`} onRetry={() => void detail.reload()} /> : null}
          {detail.data && detail.data.review.reviewId === selected ? (
            <ReviewDetailView
              key={`${selected}:${detail.data.review.reviewer ?? ''}:${detail.data.review.finalVerdict ?? ''}`}
              data={detail.data}
              busy={write.busy !== null}
              onDecide={(issueId: string, body: DecideBody) => void write.run(issueId, `${base}/issues/${encodeURIComponent(issueId)}`, post(body))}
              onReviewer={(reviewer: string) => void write.run('reviewer', `${base}/reviewer`, post({ reviewer }))}
              onVerdict={(finalVerdict: Verdict) => void write.run('verdict', `${base}/final-verdict`, post({ finalVerdict }))}
            />
          ) : detail.error ? null : <Empty>加载中…</Empty>}
        </>
      ) : (
        <ReviewListView data={list.data} onSelect={setSelected} onPage={(p) => setPage(p)} />
      )}
    </div>
  )
}

function RulesPage({ version }: { version: number }): React.ReactElement {
  const [filter, setFilter] = useState<RuleFilter>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const rules = useLoad<RulesPayload>('/rules', version)
  const detail = useLoad<RuleDetailPayload>(expanded ? `/rules/${encodeURIComponent(expanded)}` : null, version)
  const reloadBoth = useCallback(async () => {
    await Promise.all([rules.reload(), detail.reload()])
  }, [rules.reload, detail.reload])
  const write = useWrite(reloadBoth)
  if (rules.error) return <ErrorBar message={`加载失败：${rules.error}`} onRetry={() => void rules.reload()} />
  if (!rules.data) return <Empty>加载中…</Empty>
  return (
    <>
      {write.error ? <ErrorBar message={`操作失败：${write.error}`} /> : null}
      {detail.error ? <ErrorBar message={`规则详情加载失败：${detail.error}`} onRetry={() => void detail.reload()} /> : null}
      <RulesView
        data={rules.data}
        filter={filter}
        onFilter={setFilter}
        expanded={expanded}
        detail={detail.data}
        busy={write.busy}
        onToggle={(ruleId) => setExpanded(expanded === ruleId ? null : ruleId)}
        onAct={(ruleId: string, action: RuleAction) => void write.run(ruleId, `/rules/${encodeURIComponent(ruleId)}`, { method: 'PATCH', body: JSON.stringify(action) })}
      />
    </>
  )
}

function MemoryPage({ version }: { version: number }): React.ReactElement {
  const memory = useLoad<DashboardMemory>('/memory', version)
  const write = useWrite(memory.reload)
  if (memory.error) return <ErrorBar message={`加载失败：${memory.error}`} onRetry={() => void memory.reload()} />
  if (!memory.data) return <Empty>加载中…</Empty>
  return (
    <>
      {write.error ? <ErrorBar message={`操作失败：${write.error}`} /> : null}
      <MemoryView
        data={memory.data}
        busy={write.busy}
        onCandidate={(candidateId: string, action: CandidateAction) => void write.run(candidateId, `/candidates/${encodeURIComponent(candidateId)}`, post({ action }))}
      />
    </>
  )
}

function EvalPage({ version }: { version: number }): React.ReactElement {
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

export function Dashboard(): React.ReactElement {
  const [page, setPage] = useState<Page>('reviews')
  const [version, setVersion] = useState(0)
  return (
    <div style={S.root}>
      <div style={S.header}>
        <strong>方案审查看板</strong>
        <span style={S.muted}>AI 只建议 · 专家定稿</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={S.button} onClick={() => setVersion((v) => v + 1)}>刷新</button>
      </div>
      <div style={S.tabs} role="tablist">
        {PAGES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={page === id}
            style={{ ...S.tab, ...(page === id ? S.tabActive : {}) }}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {page === 'reviews' ? <ReviewsPage version={version} /> : null}
      {page === 'rules' ? <RulesPage version={version} /> : null}
      {page === 'memory' ? <MemoryPage version={version} /> : null}
      {page === 'eval' ? <EvalPage version={version} /> : null}
    </div>
  )
}

interface ClientContext {
  effect(fn: () => unknown, label?: string): void
  sidebarRightTabs: { register(def: typeof TAB_DEFINITION): () => void }
  slots: {
    inject(name: string, cb: () => unknown): () => void
    register(def: { name: string; key: string }, component: React.ComponentType): () => void
  }
}

export const name = TAB_ID
export const inject = ['slots', 'sidebarRightTabs']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.sidebarRightTabs.register(TAB_DEFINITION), 'wsgw-solution-review: tab type')
  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, Dashboard)),
    'wsgw-solution-review: dashboard body',
  )
}
