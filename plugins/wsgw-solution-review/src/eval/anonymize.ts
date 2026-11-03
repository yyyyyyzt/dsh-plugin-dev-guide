// Deterministic anonymization (evaluation.md §7.2) and leakage check (§7.3). The dictionary stays private.
export const DEFAULT_PRIVATE_DIR = 'paper/data/private'

export interface AnonymizerDict {
  /** Exact replacements for unit / product names, e.g. { 某平台: 'OSP' }. */
  fixed: Record<string, string>
  provinces: string[]
  thirdParties: string[]
  services: string[]
  tables: string[]
  codes: string[]
  reviewers: string[]
  dateShiftDays: number
}

export interface Anonymizer {
  anonymize(text: string): string
  /** Original → alias, accumulated over every call (sequence aliases depend on first occurrence). */
  map(): Record<string, string>
}

const PROPOSAL_CODE = /PD_TR_\d{6,}/g
const URL_PATH = /(?<![\w/])(?:\/[A-Za-z0-9_.-]+){2,}(?![\w/])/g
const DATE_ANY = /(\d{4})(?:-(\d{1,2})-(\d{1,2})|\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日)/g

const pad = (n: number): string => String(n).padStart(2, '0')

function shiftDate(y: number, m: number, d: number, days: number): string {
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const date = new Date(t)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
}

function replaceAllTerms(text: string, terms: string[], alias: (term: string) => string): string {
  const sorted = [...terms].filter(Boolean).sort((a, b) => b.length - a.length)
  let out = text
  for (const term of sorted) out = out.replace(new RegExp(escapeRe(term), 'g'), () => alias(term))
  return out
}

export function createAnonymizer(dict: AnonymizerDict): Anonymizer {
  const mapping: Record<string, string> = {}
  const counters = { province: 0, third: 0, service: 0, table: 0, reviewer: 0, proposal: 0 }

  const sequence = (term: string, key: keyof typeof counters, make: (n: number) => string): string => {
    const existing = mapping[term]
    if (existing) return existing
    counters[key] += 1
    const alias = make(counters[key])
    mapping[term] = alias
    return alias
  }

  const anonymize = (input: string): string => {
    let text = input
    // Proposal codes first: their aliases are ordered by first occurrence in the text.
    for (const m of text.match(PROPOSAL_CODE) ?? []) sequence(m, 'proposal', (n) => `S-${pad(n)}`)
    text = text.replace(PROPOSAL_CODE, (m) => mapping[m]!)

    text = replaceAllTerms(text, Object.keys(dict.fixed), (t) => {
      mapping[t] = dict.fixed[t]!
      return dict.fixed[t]!
    })
    // Provinces / third parties: numbered by first occurrence, so scan in text order.
    const inOrder = (terms: string[]): string[] =>
      terms
        .map((t) => ({ t, i: text.indexOf(t) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => a.i - b.i)
        .map((x) => x.t)
    for (const t of inOrder(dict.provinces)) sequence(t, 'province', (n) => `省份${String.fromCharCode(64 + n)}`)
    text = replaceAllTerms(text, dict.provinces, (t) => sequence(t, 'province', (n) => `省份${String.fromCharCode(64 + n)}`))
    for (const t of inOrder(dict.thirdParties)) sequence(t, 'third', (n) => `第三方渠道P${n}`)
    text = replaceAllTerms(text, dict.thirdParties, (t) => sequence(t, 'third', (n) => `第三方渠道P${n}`))
    text = replaceAllTerms(text, dict.services, (t) => sequence(t, 'service', (n) => `svc-${pad(n)}`))
    text = replaceAllTerms(text, dict.tables, (t) => sequence(t, 'table', (n) => `tbl_${pad(n)}`))
    text = replaceAllTerms(text, dict.reviewers, (t) => sequence(t, 'reviewer', (n) => `R${n}`))
    text = replaceAllTerms(text, dict.codes, (t) => {
      mapping[t] = '<CODE>'
      return '<CODE>'
    })
    text = text.replace(URL_PATH, '/api/<path>')
    text = text.replace(DATE_ANY, (_m, y, m1, d1, m2, d2) =>
      shiftDate(Number(y), Number(m1 ?? m2), Number(d1 ?? d2), dict.dateShiftDays),
    )
    return text
  }

  return { anonymize, map: () => ({ ...mapping }) }
}

export interface LeakHit {
  term: string
  count: number
}

/** Count occurrences of every forbidden term; publication requires an empty result. */
export function leakCheck(text: string, forbidden: string[]): LeakHit[] {
  const hits: LeakHit[] = []
  for (const term of forbidden) {
    if (!term) continue
    const count = text.split(term).length - 1
    if (count > 0) hits.push({ term, count })
  }
  return hits
}
