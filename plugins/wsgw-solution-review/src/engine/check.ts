// Rule execution over a parsed document (design.md §5, rule-schema.md §2): applicability → tier routing → checklist.
import { normalize } from './normalize.js'
import { flattenHeadings } from './parse/markdown.js'
import type { CheckReport, ChecklistEntry, Doc, HybridCandidate, Issue, Lexicon, Rule } from './types.js'
import { familyHits, findSections, sentencesIn } from './verifiers/common.js'
import { verify } from './verifiers/index.js'

type ReportIssue = Omit<Issue, 'issueId' | 'reviewId' | 'seq'>

const fullTextCache = new WeakMap<Doc, string>()

function fullText(doc: Doc): string {
  let text = fullTextCache.get(doc)
  if (text === undefined) {
    const parts = [...flattenHeadings(doc).map((h) => h.text), ...sentencesIn(doc, null).map((s) => s.quote)]
    text = normalize(parts.join('\n'))
    fullTextCache.set(doc, text)
  }
  return text
}

export function isApplicable(doc: Doc, rule: Rule, lexicon: Lexicon): boolean {
  const a = rule.applicability
  if (!a) return true

  if (a.families?.length) {
    const text = fullText(doc)
    if (!a.families.some((f) => familyHits(text, lexicon, f).length > 0)) return false
  }

  if (a.sections?.length) {
    if (!a.sections.some((k) => findSections(doc, lexicon, k).length > 0)) return false
  }

  if (a.tableRows) {
    const col = normalize(a.tableRows.column)
    const want = normalize(a.tableRows.equals)
    const hit = doc.tables.some((t) => {
      const ci = t.header.findIndex((h) => normalize(h).includes(col))
      return ci >= 0 && t.rows.some((r) => normalize(r[ci] ?? '') === want)
    })
    if (!hit) return false
  }

  return true
}

export function check(doc: Doc, rules: Rule[], lexicon: Lexicon): CheckReport {
  const hardIssues: ReportIssue[] = []
  const hybridCandidates: HybridCandidate[] = []
  const softRules: CheckReport['softRules'] = []
  const checklist: ChecklistEntry[] = []

  const entry = (rule: Rule, status: ChecklistEntry['status'], note?: string): void => {
    const e: ChecklistEntry = { ruleId: rule.id, title: rule.title, tier: rule.tier, severity: rule.severity, status }
    if (note) e.note = note
    checklist.push(e)
  }

  for (const rule of rules) {
    if (rule.status !== 'active') continue

    if (!isApplicable(doc, rule, lexicon)) {
      entry(rule, 'not-applicable', '适用性条件未命中')
      continue
    }

    if (rule.tier === 'soft' || !rule.verifier) {
      softRules.push({ ruleId: rule.id, title: rule.title, question: rule.question })
      entry(rule, 'soft')
      continue
    }

    const r = verify(doc, rule.verifier, lexicon)
    switch (r.status) {
      case 'fail':
        hardIssues.push({
          ruleId: rule.id,
          severity: rule.severity,
          tier: rule.tier,
          origin: 'verifier',
          finding: `${rule.title}：${r.note ?? '校验未通过'}`,
          suggestion: rule.suggestion,
          evidence: r.evidence,
          status: 'confirmed',
          gate: { passed: true, reasons: [] },
        })
        entry(rule, 'fail', r.note)
        break
      case 'candidate': {
        const c: HybridCandidate = {
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          question: rule.question,
          snippets: r.candidates ?? [],
        }
        if (r.note) c.note = r.note
        hybridCandidates.push(c)
        entry(rule, 'candidate', r.note)
        break
      }
      case 'pass':
        entry(rule, 'pass', r.note)
        break
      case 'pending':
        entry(rule, 'pending', r.note)
        break
      case 'not-applicable':
        entry(rule, 'not-applicable', r.note)
        break
    }
  }

  return { hardIssues, hybridCandidates, softRules, checklist }
}
