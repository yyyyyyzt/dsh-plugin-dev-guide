// Shared look: DSH theme variables only, so light and dark themes both work (dashboard.md §7).
import * as React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Severity, Verdict } from '../engine/types.js'
import type { ReviewState } from './model.js'

export const C = {
  label: 'var(--dsw-alias-label-primary)',
  secondary: 'var(--dsw-alias-label-secondary)',
  tertiary: 'var(--dsw-alias-label-tertiary)',
  border: 'var(--dsw-alias-border-l2)',
  borderStrong: 'var(--dsw-alias-border-l3)',
  base: 'var(--dsw-alias-bg-base)',
  layer1: 'var(--dsw-alias-bg-layer-1)',
  layer2: 'var(--dsw-alias-bg-layer-2)',
  hover: 'var(--dsw-alias-interactive-bg-hover)',
  brand: 'var(--dsw-alias-brand-primary)',
  success: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  error: 'var(--dsw-alias-state-error-primary)',
}

export const brandMix = (percent: number): string => `color-mix(in srgb, ${C.brand} ${percent}%, transparent)`
export const EMPTY_CELL = `color-mix(in srgb, ${C.label} 7%, transparent)`

/** Hover and focus rings need selectors; everything else stays inline. */
export const SCOPED_CSS = [
  '.wsgw-row{transition:background-color .12s}',
  '.wsgw-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.wsgw-row:focus-visible,.wsgw-chip:focus-visible,.wsgw-cell:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}',
  '.wsgw-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.wsgw-cell{cursor:pointer}',
  '.wsgw-cell:hover{stroke:var(--dsw-alias-label-secondary);stroke-width:1}',
].join('')

export const S: Record<string, CSSProperties> = {
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  spread: { display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  card: { border: `1px solid ${C.border}`, borderRadius: 'var(--dsw-radius-sm)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: C.layer1, minWidth: 0 },
  cardTitle: { fontWeight: 500, font: 'var(--dsw-font-xs-13)' },
  issue: { borderLeft: `2px solid ${C.borderStrong}`, paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  section: { marginTop: 8, fontWeight: 600 },
  muted: { color: C.tertiary, font: 'var(--dsw-font-xxs-12)' },
  secondary: { color: C.secondary },
  notice: { color: C.warn, font: 'var(--dsw-font-xxs-12)' },
  error: { color: C.error, font: 'var(--dsw-font-xxs-12)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  empty: { padding: 24, textAlign: 'center', color: C.tertiary, font: 'var(--dsw-font-xs-13)' },
  pill: { display: 'inline-block', border: `1px solid ${C.borderStrong}`, borderRadius: 999, padding: '0 6px', font: 'var(--dsw-font-xxs-12)', color: C.secondary, whiteSpace: 'nowrap' },
  button: { border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: '2px 10px', cursor: 'pointer', font: 'var(--dsw-font-xxs-12)', lineHeight: '20px' },
  primary: { border: `1px solid ${C.brand}`, background: C.brand, color: C.base, borderRadius: 'var(--dsw-radius-sm)', padding: '2px 10px', cursor: 'pointer', font: 'var(--dsw-font-xxs-12)', lineHeight: '20px' },
  link: { border: 'none', background: 'transparent', color: C.secondary, textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'var(--dsw-font-xxs-12)' },
  chip: { height: 28, borderRadius: 14, padding: '0 10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, cursor: 'pointer', font: 'var(--dsw-font-xxs-12)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 },
  chipOn: { background: C.hover, color: C.label, borderColor: C.borderStrong, fontWeight: 500 },
  field: { border: `1px solid ${C.borderStrong}`, background: C.layer2, color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: '3px 6px', font: 'var(--dsw-font-xxs-12)', minHeight: 28, boxSizing: 'border-box' },
  textarea: { border: `1px solid ${C.borderStrong}`, background: C.layer2, color: C.label, borderRadius: 'var(--dsw-radius-sm)', padding: 6, font: 'var(--dsw-font-xxs-12)', width: '100%', boxSizing: 'border-box', minHeight: 64, resize: 'vertical' },
  quote: { margin: 0, borderLeft: `2px solid ${C.border}`, paddingLeft: 8, color: C.secondary, font: 'var(--dsw-font-xxs-12)' },
  pre: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: 6, background: C.layer2, borderRadius: 'var(--dsw-radius-sm)', font: 'var(--dsw-font-xxs-12)' },
  table: { borderCollapse: 'collapse', width: '100%', font: 'var(--dsw-font-xxs-12)' },
  cell: { borderBottom: `1px solid ${C.border}`, padding: '4px 6px', textAlign: 'left' },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
}

export const VERDICT_COLOR: Record<Verdict, string> = { 通过: C.success, 建议整改: C.warn, 不通过: C.error }
export const SEVERITY_COLOR: Record<Severity, string> = { blocker: C.error, major: C.warn, minor: C.secondary }
export const STATE_COLOR: Record<ReviewState, string | undefined> = { open: C.brand, finalized: undefined, stale: C.warn }

export function Pill({ children, color }: { children: ReactNode; color?: string | undefined }): React.ReactElement {
  return <span style={{ ...S.pill, ...(color ? { color, borderColor: color } : {}) }}>{children}</span>
}

export function VerdictPill({ verdict, prefix }: { verdict: Verdict; prefix?: string }): React.ReactElement {
  return <Pill color={VERDICT_COLOR[verdict]}>{prefix ? `${prefix}${verdict}` : verdict}</Pill>
}

export function Chip({ on, onClick, children, ...rest }: { on: boolean; onClick: () => void; children: ReactNode } & Record<`data-${string}`, string>): React.ReactElement {
  return (
    <button type="button" className="wsgw-chip" aria-pressed={on} style={{ ...S.chip, ...(on ? S.chipOn : {}) }} onClick={onClick} {...rest}>
      {children}
    </button>
  )
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
