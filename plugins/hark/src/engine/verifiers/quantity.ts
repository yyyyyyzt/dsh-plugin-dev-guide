// `quantity` verifier (rule-schema.md §3.4): a context word must be accompanied by a number + unit within `window`.
import type { Doc, Lexicon, QuantityParams, VerifierResult } from '../types.js'
import { absenceEvidence, absenceOffset, familyHits, sectionsFor, sentencesIn, textEvidence } from './common.js'

export const DEFAULT_UNITS = ['万', '亿', '次', '条', '笔', '人', '户', 'QPS', 'TPS', '/日', '/天', '/秒', 'ms', '%']

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

export function verifyQuantity(doc: Doc, params: QuantityParams, lexicon: Lexicon): VerifierResult {
  const scope = sectionsFor(doc, lexicon, params.sections)
  const window = params.window ?? 30
  const units = params.units ?? DEFAULT_UNITS
  const numberRe = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${units.map(escape).join('|')})(?![A-Za-z])`, 'giu')

  const contextual = sentencesIn(doc, scope)
    .map((s) => ({ s, hits: params.contextFamilies.flatMap((f) => familyHits(s.norm, lexicon, f)) }))
    .filter((x) => x.hits.length > 0)

  if (!contextual.length) {
    const at = absenceOffset(doc, scope)
    const label = params.contextFamilies.join('/')
    return {
      status: 'fail',
      evidence: [absenceEvidence(doc, `未提及：${label}`, at.offset, at.sectionPath)],
      note: `未提及 ${label}`,
    }
  }

  for (const { s, hits } of contextual) {
    numberRe.lastIndex = 0
    for (const m of s.norm.matchAll(numberRe)) {
      const numStart = m.index
      const numEnd = numStart + m[0].length
      // Nearest context word wins; on ties the one preceding the number reads more naturally in the note.
      const gapOf = (h: { index: number; word: string }) => {
        const ctxEnd = h.index + h.word.length
        return numStart >= ctxEnd ? numStart - ctxEnd : h.index - numEnd
      }
      const near = hits
        .filter((h) => gapOf(h) <= window)
        .sort((a, b) => gapOf(a) - gapOf(b) || a.index - b.index)[0]
      if (near) {
        const span = s.norm.slice(Math.min(near.index, numStart), Math.max(near.index + near.word.length, numEnd))
        return { status: 'pass', evidence: [textEvidence(s)], note: `量化表述：「${span}」` }
      }
    }
  }

  const first = contextual[0]!.s
  return {
    status: 'fail',
    evidence: [textEvidence(first)],
    note: `提及「${contextual[0]!.hits[0]!.word}」但无数字（assertion-only，未量化）`,
  }
}
