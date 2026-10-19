// T-REQ-06 / T-DES-04 / T-RUL-11 / T-RUL-12 / T-REQ-16(engine part):
// check() over the shipped pack against the seed fixture and its variants.
import { beforeAll, describe, expect, it } from 'vitest'
import { check, isApplicable } from '../../src/engine/check.js'
import type { ChecklistStatus, Lexicon, Rule, RulePack } from '../../src/engine/types.js'
import {
  docFrom,
  loadDoc,
  miniLexicon,
  readExpected,
  rule,
  shippedLexicon,
  shippedPack,
  type SeedExpectation,
  type VariantExpectation,
} from '../helpers.js'

const STATUSES: ChecklistStatus[] = ['pass', 'fail', 'candidate', 'pending', 'not-applicable', 'soft', 'reviewed-no-issue']

function checklistMap(report: ReturnType<typeof check>): Record<string, ChecklistStatus> {
  return Object.fromEntries(report.checklist.map((c) => [c.ruleId, c.status]))
}

describe('check() on the seed solution (T-RUL-12, T-REQ-06, T-DES-04)', () => {
  const expected = readExpected<SeedExpectation>('seed.json')
  let pack: RulePack
  let report: ReturnType<typeof check>
  beforeAll(() => {
    pack = shippedPack()
    report = check(loadDoc('seed.md'), pack.rules, pack.lexicon)
  })

  it('lists every active rule exactly once in the checklist with a valid status', () => {
    const ids = report.checklist.map((c) => c.ruleId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(pack.rules.filter((r) => r.status === 'active').map((r) => r.id).sort())
    for (const c of report.checklist) expect(STATUSES).toContain(c.status)
  })

  it('matches the expected checklist status for all 28 rules', () => {
    expect(checklistMap(report)).toEqual(expected.checklist)
  })

  it('auto-registers exactly the expected hard/hybrid fails as issues with verifier origin and evidence', () => {
    expect(report.hardIssues.map((i) => i.ruleId).sort()).toEqual([...expected.autoRegistered].sort())
    for (const issue of report.hardIssues) {
      expect(issue.origin).toBe('verifier')
      expect(issue.status).toBe('confirmed')
      expect(issue.gate).toEqual({ passed: true, reasons: [] })
      expect(issue.evidence.length).toBeGreaterThan(0)
      for (const e of issue.evidence) expect(e.range).toBeDefined()
      const r = rule(issue.ruleId!)
      expect(issue.severity).toBe(r.severity)
      expect(issue.tier).toBe(r.tier)
      expect(issue.suggestion).toBe(r.suggestion)
    }
  })

  it('emits the expected hybrid candidates with snippets (not issues)', () => {
    expect(report.hybridCandidates.map((c) => c.ruleId).sort()).toEqual([...expected.hybridCandidates].sort())
    for (const c of report.hybridCandidates) {
      expect(c.snippets.length).toBeGreaterThan(0)
      expect(report.hardIssues.some((i) => i.ruleId === c.ruleId)).toBe(false)
    }
  })

  it('lists soft rules only as questions', () => {
    const softIds = pack.rules.filter((r) => r.tier === 'soft').map((r) => r.id).sort()
    expect(report.softRules.map((s) => s.ruleId).sort()).toEqual(softIds)
    for (const s of report.softRules) expect(s.question.length).toBeGreaterThan(0)
  })

  it('reports the expected evidence kinds and quotes', () => {
    for (const [ruleId, kind] of Object.entries(expected.evidenceKinds ?? {})) {
      const issue = report.hardIssues.find((i) => i.ruleId === ruleId)
      expect(issue, ruleId).toBeDefined()
      expect(issue!.evidence[0]!.kind, ruleId).toBe(kind)
    }
    for (const [ruleId, quote] of Object.entries(expected.evidenceQuotes ?? {})) {
      const issue = report.hardIssues.find((i) => i.ruleId === ruleId)
      expect(issue!.evidence[0]!.quote, ruleId).toContain(quote)
    }
  })

  it('flags the expected candidate snippets', () => {
    for (const [ruleId, flags] of Object.entries(expected.candidateFlags ?? {})) {
      const cand = report.hybridCandidates.find((c) => c.ruleId === ruleId)
      expect(cand, ruleId).toBeDefined()
      for (const f of flags) expect(cand!.snippets.some((s) => s.flags?.includes(f as never)), `${ruleId} ${f}`).toBe(true)
    }
  })

  it('is deterministic across runs', () => {
    const again = check(loadDoc('seed.md'), pack.rules, pack.lexicon)
    expect(JSON.stringify(again)).toBe(JSON.stringify(report))
  })
})

describe('check() on seed variants (T-RUL-12)', () => {
  const variants = readExpected<Record<string, VariantExpectation | string>>('variants.json')

  for (const [fixture, exp] of Object.entries(variants)) {
    if (typeof exp === 'string') continue // $comment
    describe(fixture, () => {
      let report: ReturnType<typeof check>
      let map: Record<string, ChecklistStatus>
      beforeAll(() => {
        const pack = shippedPack()
        report = check(loadDoc(fixture), pack.rules, pack.lexicon)
        map = checklistMap(report)
      })

      it('matches the expected per-rule statuses', () => {
        for (const [ruleId, status] of Object.entries(exp.checklist)) expect(map[ruleId], ruleId).toBe(status)
      })

      if (exp.autoRegistered) {
        it('auto-registers exactly the expected rules', () => {
          expect(report.hardIssues.map((i) => i.ruleId).sort()).toEqual([...exp.autoRegistered!].sort())
        })
      }

      if (exp.evidenceKinds) {
        it('produces the expected evidence kinds', () => {
          for (const [ruleId, kind] of Object.entries(exp.evidenceKinds!)) {
            const issue = report.hardIssues.find((i) => i.ruleId === ruleId)
            expect(issue?.evidence[0]?.kind, ruleId).toBe(kind)
          }
        })
      }

      if (exp.evidenceQuotes) {
        it('quotes the expected text', () => {
          for (const [ruleId, quote] of Object.entries(exp.evidenceQuotes!)) {
            const issue = report.hardIssues.find((i) => i.ruleId === ruleId)
            const cand = report.hybridCandidates.find((c) => c.ruleId === ruleId)
            // Passing rules carry no issue/candidate; their verifying span surfaces in the checklist note.
            const entry = report.checklist.find((c) => c.ruleId === ruleId)
            const quotes = [
              ...(issue?.evidence.map((e) => e.quote) ?? []),
              ...(cand?.snippets.map((s) => s.quote) ?? []),
              ...(entry?.note ? [entry.note] : []),
            ]
            expect(quotes.some((q) => q.includes(quote)), `${ruleId} ${quote}`).toBe(true)
          }
        })
      }

      if (exp.absenceMentions) {
        it('absence evidence names the missing heading', () => {
          for (const [ruleId, text] of Object.entries(exp.absenceMentions!)) {
            const issue = report.hardIssues.find((i) => i.ruleId === ruleId)
            expect(issue?.evidence.some((e) => e.kind === 'absence' && e.quote.includes(text)), ruleId).toBe(true)
          }
        })
      }

      if (exp.noteMentions) {
        it('checklist note mentions the missing families', () => {
          for (const [ruleId, words] of Object.entries(exp.noteMentions!)) {
            const entry = report.checklist.find((c) => c.ruleId === ruleId)
            for (const w of words) expect(entry?.note ?? '', `${ruleId} ${w}`).toContain(w)
          }
        })
      }

      if (exp.candidateFlagsAbsent) {
        it('does not carry the listed flags on candidates', () => {
          for (const [ruleId, flags] of Object.entries(exp.candidateFlagsAbsent!)) {
            const cand = report.hybridCandidates.find((c) => c.ruleId === ruleId)
            expect(cand, ruleId).toBeDefined()
            for (const f of flags) expect(cand!.snippets.some((s) => s.flags?.includes(f as never)), `${ruleId} ${f}`).toBe(false)
          }
        })
      }
    })
  }
})

describe('isApplicable (T-RUL-11)', () => {
  let lex: Lexicon
  beforeAll(() => {
    lex = shippedLexicon()
  })

  it('rules with applicability null always apply', () => {
    expect(isApplicable(docFrom('# 空\n\n正文。'), rule('CAP-002'), lex)).toBe(true)
  })

  it('applicability.families must hit somewhere in the full text, including table cells', () => {
    const riskctl = rule('CAP-005')
    expect(isApplicable(docFrom('# a\n\n## 一、技术思路\n\n未涉及。'), riskctl, lex)).toBe(false)
    expect(isApplicable(docFrom('# a\n\n## 一、技术思路\n\n接入风控开关。'), riskctl, lex)).toBe(true)
    expect(isApplicable(docFrom('# a\n\n| 项 | 值 |\n|---|---|\n| 风控 | 是 |'), riskctl, lex)).toBe(true)
  })

  it('applicability.tableRows requires a row whose column equals the value', () => {
    const r = rule('INT-003')
    const modified = docFrom('# a\n\n| 资源名称 | 变更类型 | 名称 |\n|---|---|---|\n| 微服务 | 修改 | svc |')
    const added = docFrom('# a\n\n| 资源名称 | 变更类型 | 名称 |\n|---|---|---|\n| 微服务 | 新增 | svc |')
    expect(isApplicable(modified, r, lex)).toBe(true)
    expect(isApplicable(added, r, lex)).toBe(false)
  })

  it('applicability.sections requires at least one of the headings to exist', () => {
    const synthetic: Rule = { ...rule('CAP-002'), applicability: { sections: ['risk'] } }
    expect(isApplicable(docFrom('# a\n\n## 一、风险评估\n\n无。'), synthetic, lex)).toBe(true)
    expect(isApplicable(docFrom('# a\n\n## 一、工作背景\n\n无。'), synthetic, lex)).toBe(false)
  })
})

describe('check() tier handling on small docs (T-REQ-06, T-REQ-16)', () => {
  let doc: ReturnType<typeof docFrom>
  beforeAll(() => {
    doc = docFrom('# a\n\n## 一、实施方案\n\n分两批上线。')
  })

  it('hard fail → issue; hybrid candidate → candidate only; soft → softRules only', () => {
    const hard = rule('CAP-002')
    const hybrid: Rule = { ...rule('INT-005'), verifier: { kind: 'statement', params: { families: ['implementation-words'] } } }
    const soft = rule('CFG-001')
    const lex = { ...miniLexicon, families: { ...miniLexicon.families, 'implementation-words': ['上线'] } }
    const report = check(doc, [hard, hybrid, soft], lex)
    expect(report.hardIssues.map((i) => i.ruleId)).toEqual(['CAP-002'])
    expect(report.hybridCandidates.map((c) => c.ruleId)).toEqual(['INT-005'])
    expect(report.softRules.map((s) => s.ruleId)).toEqual(['CFG-001'])
    expect(report.checklist.find((c) => c.ruleId === 'CFG-001')?.status).toBe('soft')
  })

  it('retired / draft rules are skipped entirely', () => {
    const retired: Rule = { ...rule('CAP-002'), status: 'retired' }
    const draft: Rule = { ...rule('CHN-001'), id: 'LRN-001', status: 'draft' }
    const report = check(doc, [retired, draft], miniLexicon)
    expect(report.hardIssues).toEqual([])
    expect(report.checklist).toEqual([])
  })

  it('not-applicable rules never become issues', () => {
    const report = check(doc, [rule('CAP-005')], shippedLexicon())
    expect(report.hardIssues).toEqual([])
    expect(report.checklist[0]?.status).toBe('not-applicable')
  })
})
