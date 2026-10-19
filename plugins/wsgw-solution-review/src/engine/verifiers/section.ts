// `section` verifier (rule-schema.md §3.1).
import { normalize } from '../normalize.js'
import type { Doc, Lexicon, SectionParams, VerifierResult } from '../types.js'
import { absenceEvidence, findSections, headingAliases, headingEvidence, isPlaceholder, sentencesIn, textEvidence } from './common.js'

export function verifySection(doc: Doc, params: SectionParams, lexicon: Lexicon): VerifierResult {
  const aliases = headingAliases(lexicon, params.heading)
  const expected = aliases[0] ?? String(params.heading)
  const minChars = params.minChars ?? 20
  const nodes = findSections(doc, lexicon, params.heading)

  const node = nodes[0]
  if (!node) {
    return {
      status: 'fail',
      evidence: [absenceEvidence(doc, `缺失：${expected}`, doc.source.length)],
      note: `未找到章节「${expected}」`,
    }
  }

  const sentences = sentencesIn(doc, [node])
  const bodyText = sentences.map((s) => s.norm).join('')
  const chars = bodyText.replace(/\s+/g, '').length

  const onlyPlaceholder = sentences.length > 0 && sentences.every((s) => isPlaceholder(s.quote, lexicon))
  if (onlyPlaceholder) {
    if (params.allowPlaceholder) return { status: 'pass', evidence: [headingEvidence(node)] }
    return {
      status: 'fail',
      evidence: [textEvidence(sentences[0]!)],
      note: `章节「${expected}」正文仅为占位词「${normalize(sentences[0]!.quote)}」`,
    }
  }

  if (chars < minChars) {
    const first = sentences[0]
    return {
      status: 'fail',
      evidence: first
        ? [textEvidence(first)]
        : [absenceEvidence(doc, `缺失：${expected} 正文`, node.bodyRange.start.offset, node.path)],
      note: `章节「${expected}」正文 ${chars} 字，少于 minChars ${minChars}`,
    }
  }

  return { status: 'pass', evidence: [headingEvidence(node)] }
}
