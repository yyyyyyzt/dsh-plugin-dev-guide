// `statement` verifier (rule-schema.md §3.3): family keyword sentences → candidates (hybrid) or decisive pass/fail (hard).
import { normalize } from '../normalize.js'
import type { Doc, Lexicon, Snippet, SnippetFlag, StatementParams, VerifierResult } from '../types.js'
import { absenceEvidence, absenceOffset, familyWords, hitsOf, isPlaceholder, sectionsFor, sentencesIn, textEvidence, type Sentence } from './common.js'

export const DEFAULT_CAUSAL_WORDS = ['因为', '由于', '通过', '链路', '依据', '基于', '只与', '仅与', '不调用', '不接触']

interface Match {
  sentence: Sentence
  families: Set<string>
  flags: SnippetFlag[]
}

function negatedAt(norm: string, index: number, negations: string[], window: number): boolean {
  const before = norm.slice(Math.max(0, index - window), index)
  return negations.some((n) => before.includes(normalize(n)))
}

export function verifyStatement(doc: Doc, params: StatementParams, lexicon: Lexicon): VerifierResult {
  const families = params.families.map((f) => ({ key: f, words: familyWords(lexicon, f) }))
  const scope = sectionsFor(doc, lexicon, params.sections)
  const window = params.negationWindow ?? 6
  const causal = (params.causalWords ?? DEFAULT_CAUSAL_WORDS).map((w) => normalize(w))
  const assertion = (params.assertionOnly ?? []).map((p) => new RegExp(p, 'u'))

  const matches: Match[] = []
  for (const s of sentencesIn(doc, scope)) {
    const hitFamilies = new Set<string>()
    let negated = false
    for (const f of families) {
      const hits = hitsOf(s.norm, f.words)
      if (!hits.length) continue
      hitFamilies.add(f.key)
      if (hits.every((h) => negatedAt(s.norm, h.index, lexicon.negations, window))) negated = true
    }
    if (!hitFamilies.size) continue
    const flags: SnippetFlag[] = []
    if (negated) flags.push('negated')
    if (assertion.some((re) => re.test(s.norm) || re.test(s.quote)) && !causal.some((c) => s.norm.includes(c))) {
      flags.push('assertion-only')
    }
    if (isPlaceholder(s.quote, lexicon)) flags.push('placeholder')
    matches.push({ sentence: s, families: hitFamilies, flags })
  }

  const whenNone = params.whenNoCandidate ?? 'pending'
  const noCandidate = (missingLabel: string): VerifierResult => {
    if (whenNone === 'pass') return { status: 'pass', evidence: [], note: `未提及 ${missingLabel}（规则允许）` }
    if (whenNone === 'pending') return { status: 'pending', evidence: [], note: `未提及 ${missingLabel}，待人工判断` }
    const at = absenceOffset(doc, scope)
    return {
      status: 'fail',
      evidence: [absenceEvidence(doc, `未提及：${missingLabel}`, at.offset, at.sectionPath)],
      note: `未提及 ${missingLabel}`,
    }
  }

  if (params.requireAll) {
    const covered = new Set<string>()
    for (const m of matches) for (const f of m.families) covered.add(f)
    const missing = params.families.filter((f) => !covered.has(f))
    if (missing.length) return noCandidate(missing.join('/'))
  }
  if (!matches.length) return noCandidate(params.families.join('/'))

  if (params.decisive) {
    const positive = matches.filter((m) => !m.flags.includes('negated'))
    if (positive.length) {
      return { status: 'pass', evidence: [textEvidence(positive[0]!.sentence)] }
    }
    return {
      status: 'fail',
      evidence: matches.map((m) => textEvidence(m.sentence)),
      note: `仅有否定表述：「${matches[0]!.sentence.norm}」`,
    }
  }

  const candidates: Snippet[] = matches.map((m) => {
    const snip: Snippet = { quote: m.sentence.quote, sectionPath: m.sentence.sectionPath, range: m.sentence.range }
    if (m.flags.length) snip.flags = m.flags
    return snip
  })
  return { status: 'candidate', evidence: [], candidates, note: `${candidates.length} 处候选片段` }
}
