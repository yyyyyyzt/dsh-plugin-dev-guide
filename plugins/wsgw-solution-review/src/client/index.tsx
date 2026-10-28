// Client entry (dashboard.md §2): a left-panel entry whose main panel is the overview, plus a
// right-sidebar review assistant. Both read and write the same-origin API (design.md §10).
import * as React from 'react'
import { OverviewPage, ReviewAssistant } from './pages.js'

export { OverviewPage, ReviewAssistant }

export const PANEL_ID = 'wsgw-solution-review'
export const TAB_ID = 'wsgw-solution-review'

export const PANEL_ENTRY = { name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: (): string => '方案审查' }

export const TAB_DEFINITION = {
  id: TAB_ID,
  kind: 'wsgw-review',
  priority: 'extension' as const,
  keepMounted: true,
  title: (): string => '复核助手',
  guide: [{ id: 'assistant', order: 50, title: (): string => '方案审查 · 复核助手', description: (): string => '进行中的审查 · 采纳 / 驳回 / 改写' }],
}

/** Decorative glyph for the sidebar row; the sidebar owns the label and the selected state. */
export function PanelIcon({ size }: { size: number; active?: boolean }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={5} y={4} width={14} height={17} rx={2} />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 12.5l2.3 2.3 4.7-4.8" />
    </svg>
  )
}

interface ClientContext {
  effect(fn: () => unknown, label?: string): void
  layout: { selectPanel(panelId: string | null): void }
  sidebarRightTabs: { register(def: typeof TAB_DEFINITION): () => void }
  slots: {
    inject(name: string, cb: () => unknown): () => void
    register(def: Record<string, unknown> & { name: string }, component: React.ComponentType<any>): () => void
  }
}

export const name = PANEL_ID
export const inject = ['slots', 'sidebarRightTabs', 'layout']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, OverviewPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(PANEL_ENTRY, PanelIcon))
  ctx.effect(() => ctx.sidebarRightTabs.register(TAB_DEFINITION), 'wsgw-solution-review: assistant tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    inject: () => ({ openOverview: () => ctx.layout.selectPanel(PANEL_ID) }),
  }, ReviewAssistant))
}
