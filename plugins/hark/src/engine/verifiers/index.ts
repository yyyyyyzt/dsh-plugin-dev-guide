// Verifier dispatch + `all` / `first` combinators (rule-schema.md §3).
import type { Doc, Lexicon, Snippet, VerifierResult, VerifierSpec } from '../types.js'
import { verifyCrossRef } from './cross-ref.js'
import { verifyMermaidSequence } from './mermaid-sequence.js'
import { verifyQuantity } from './quantity.js'
import { verifySection } from './section.js'
import { verifyStatement } from './statement.js'
import { verifyTable } from './table.js'

export { verifySection } from './section.js'
export { verifyTable } from './table.js'
export { verifyStatement } from './statement.js'
export { verifyQuantity } from './quantity.js'
export { verifyMermaidSequence } from './mermaid-sequence.js'
export { verifyCrossRef } from './cross-ref.js'

function withNote(r: Omit<VerifierResult, 'note'>, notes: (string | undefined)[]): VerifierResult {
  const note = notes.filter((n): n is string => !!n).join('；')
  return note ? { ...r, note } : r
}

function all(results: VerifierResult[]): VerifierResult {
  const live = results.filter((r) => r.status !== 'not-applicable')
  if (!live.length) return { status: 'not-applicable', evidence: [] }

  const fails = live.filter((r) => r.status === 'fail')
  if (fails.length) return withNote({ status: 'fail', evidence: fails.flatMap((r) => r.evidence) }, fails.map((r) => r.note))

  if (live.every((r) => r.status === 'pass')) return { status: 'pass', evidence: live.flatMap((r) => r.evidence) }

  const cands = live.filter((r) => r.status === 'candidate')
  if (cands.length) {
    const candidates: Snippet[] = cands.flatMap((r) => r.candidates ?? [])
    return withNote({ status: 'candidate', evidence: [], candidates }, cands.map((r) => r.note))
  }

  const pendings = live.filter((r) => r.status === 'pending')
  return withNote({ status: 'pending', evidence: [] }, pendings.map((r) => r.note))
}

export function verify(doc: Doc, spec: VerifierSpec, lexicon: Lexicon): VerifierResult {
  switch (spec.kind) {
    case 'section':
      return verifySection(doc, spec.params, lexicon)
    case 'table':
      return verifyTable(doc, spec.params, lexicon)
    case 'statement':
      return verifyStatement(doc, spec.params, lexicon)
    case 'quantity':
      return verifyQuantity(doc, spec.params, lexicon)
    case 'mermaid-sequence':
      return verifyMermaidSequence(doc, spec.params, lexicon)
    case 'cross-ref':
      return verifyCrossRef(doc, spec.params, lexicon)
    case 'all':
      return all(spec.of.map((s) => verify(doc, s, lexicon)))
    case 'first': {
      for (const s of spec.of) {
        const r = verify(doc, s, lexicon)
        if (r.status !== 'not-applicable') return r
      }
      return { status: 'not-applicable', evidence: [] }
    }
  }
}
