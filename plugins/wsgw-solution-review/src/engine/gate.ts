// Evidence gate for LLM-submitted issues (rule-schema.md §5).
import { findAllQuotes, normalize } from './normalize.js'
import type { Doc, Evidence, GateReason, Range, Rule, Snippet } from './types.js'
import { overlaps, sectionPathAt } from './verifiers/common.js'

export interface GateInput {
  quote: string
  sectionPath?: string
}

export interface GateResult {
  passed: boolean
  reasons: GateReason[]
  resolved: Evidence[]
}

export const QUOTE_MIN_CHARS = 8
export const QUOTE_MAX_CHARS = 300

export class HardRuleVerifierOwnedError extends Error {
  readonly code = 'HARD_RULE_VERIFIER_OWNED'
  constructor(ruleId: string) {
    super(`rule ${ruleId} is hard: issues are registered by its verifier only`)
    this.name = 'HardRuleVerifierOwnedError'
  }
}

export function gate(doc: Doc, rule: Rule | null, evidence: GateInput[], candidates: Snippet[] | undefined): GateResult {
  const reasons: GateReason[] = []
  const add = (r: GateReason) => {
    if (!reasons.includes(r)) reasons.push(r)
  }

  if (!rule) add('NO_RULE')
  else if (rule.tier === 'soft') add('SOFT_RULE')
  else if (rule.tier === 'hard') throw new HardRuleVerifierOwnedError(rule.id)

  if (!evidence.length) add('NO_EVIDENCE')

  const resolved: Evidence[] = []
  for (const e of evidence) {
    const compact = normalize(e.quote).replace(/\s+/g, '')
    if (compact.length < QUOTE_MIN_CHARS) {
      add('QUOTE_TOO_SHORT')
      continue
    }
    if (compact.length > QUOTE_MAX_CHARS) {
      add('QUOTE_TOO_LONG')
      continue
    }
    const hits = findAllQuotes(doc.source, e.quote)
    if (!hits.length) {
      add('QUOTE_NOT_FOUND')
      continue
    }
    // A quote may repeat inside one section: prefer the hit that sits in a candidate, then the declared section.
    const inCandidate = (h: Range) => (candidates ?? []).some((c) => overlaps(c.range, h))
    const inSection = (h: Range) => e.sectionPath !== undefined && sectionPathAt(doc, h.start.offset) === e.sectionPath
    const range =
      hits.find((h) => inCandidate(h) && inSection(h)) ?? hits.find(inCandidate) ?? hits.find(inSection) ?? hits[0]!
    const actual: Evidence = {
      quote: doc.source.slice(range.start.offset, range.end.offset),
      sectionPath: sectionPathAt(doc, range.start.offset),
      range,
      kind: 'text',
    }
    if (rule?.tier === 'hybrid') {
      const inside = (candidates ?? []).some((c) => overlaps(c.range, range))
      if (!inside) add('OUT_OF_CANDIDATES')
    }
    resolved.push(actual)
  }

  return { passed: reasons.length === 0, reasons, resolved }
}
