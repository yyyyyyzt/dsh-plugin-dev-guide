// T-RUL-01 / T-RUL-10 / T-DES-10 / T-RUL-12(schema half): rule pack loading and shipped+override merge.
import { beforeAll, describe, expect, it } from 'vitest'
import { mergeRules, parseRulePack, RulePackError } from '../../src/engine/rules.js'
import type { Rule, RuleOverride, RulePack, StatementParams } from '../../src/engine/types.js'
import { readRuleFixture, shippedPack } from '../helpers.js'

function expectPackError(yaml: string, ruleId: string | null, field: RegExp): RulePackError {
  let caught: unknown
  try {
    parseRulePack(yaml)
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(RulePackError)
  const err = caught as RulePackError
  expect(err.ruleId).toBe(ruleId)
  expect(err.field ?? '').toMatch(field)
  return err
}

describe('parseRulePack (T-RUL-01)', () => {
  it('loads a valid minimal pack with typed fields', () => {
    const pack = parseRulePack(readRuleFixture('valid-minimal.yaml'))
    expect(pack.pack.id).toBe('t')
    expect(pack.rules).toHaveLength(1)
    const r = pack.rules[0]!
    expect(r.id).toBe('CAP-002')
    expect(r.tier).toBe('hard')
    expect(r.verifier?.kind).toBe('statement')
    expect(pack.lexicon.families['loadtest']).toEqual(['压测'])
  })

  it.each([
    ['invalid-bad-id.yaml', null, /id/],
    ['invalid-missing-field.yaml', 'CAP-002', /suggestion/],
    ['invalid-soft-with-verifier.yaml', 'CAP-002', /verifier/],
    ['invalid-hybrid-no-verifier.yaml', 'CAP-002', /verifier/],
    ['invalid-hard-non-decisive.yaml', 'CAP-002', /decisive/],
    ['invalid-hard-pending.yaml', 'CAP-002', /whenNoCandidate/],
    ['invalid-hybrid-fail.yaml', 'CAP-002', /whenNoCandidate/],
    ['invalid-unknown-family.yaml', 'CAP-002', /families/],
  ])('%s is rejected naming rule %s and field %s', (fixture, ruleId, field) => {
    expectPackError(readRuleFixture(fixture), ruleId, field)
  })

  it('rejects duplicate rule ids', () => {
    const yaml = readRuleFixture('valid-minimal.yaml')
    const dup = yaml + yaml.slice(yaml.indexOf('  - id: CAP-002'))
    expectPackError(dup, 'CAP-002', /id/)
  })

  it('rejects a section verifier whose heading key is not in lexicon.headings', () => {
    const yaml = readRuleFixture('valid-minimal.yaml').replace(
      '{ kind: statement, params: { families: [loadtest], decisive: true, whenNoCandidate: fail } }',
      '{ kind: section, params: { heading: nosuchheading } }',
    )
    expectPackError(yaml, 'CAP-002', /heading/)
  })

  it('rejects malformed YAML / non-object input as a pack-level error', () => {
    expectPackError('just a string', null, /pack|root/)
    expectPackError('pack: [1, 2', null, /yaml|parse|pack/i)
  })

  it('accepts LRN-xxx ids for learned drafts', () => {
    const yaml = readRuleFixture('valid-minimal.yaml').replace('id: CAP-002', 'id: LRN-001')
    expect(parseRulePack(yaml).rules[0]!.id).toBe('LRN-001')
  })
})

describe('shipped pack (T-RUL-12 schema half)', () => {
  let pack: RulePack
  beforeAll(() => {
    pack = shippedPack()
  })

  it('has 28 active rules: 10 hard, 13 hybrid, 5 soft', () => {
    expect(pack.rules).toHaveLength(28)
    const count = (tier: Rule['tier']) => pack.rules.filter((r) => r.tier === tier).length
    expect(count('hard')).toBe(10)
    expect(count('hybrid')).toBe(13)
    expect(count('soft')).toBe(5)
    expect(pack.rules.every((r) => r.status === 'active')).toBe(true)
  })

  it('references only lexicon keys that exist (families / headings)', () => {
    const familyKeys = new Set(Object.keys(pack.lexicon.families))
    const headingKeys = new Set(Object.keys(pack.lexicon.headings))
    const walk = (spec: NonNullable<Rule['verifier']>): void => {
      if (spec.kind === 'all' || spec.kind === 'first') return spec.of.forEach(walk)
      if (spec.kind === 'statement') {
        for (const f of spec.params.families) expect(familyKeys.has(f), f).toBe(true)
        for (const s of spec.params.sections ?? []) expect(headingKeys.has(s), s).toBe(true)
      }
      if (spec.kind === 'section') {
        const h = spec.params.heading
        if (typeof h === 'string') expect(headingKeys.has(h), h).toBe(true)
      }
      if (spec.kind === 'quantity') for (const f of spec.params.contextFamilies) expect(familyKeys.has(f), f).toBe(true)
      if (spec.kind === 'mermaid-sequence') {
        for (const f of [...(spec.params.participantFamilies ?? []), ...(spec.params.requiredMessageFamilies ?? [])])
          expect(familyKeys.has(f), f).toBe(true)
      }
    }
    for (const r of pack.rules) {
      if (r.verifier) walk(r.verifier)
      for (const f of r.applicability?.families ?? []) expect(familyKeys.has(f), f).toBe(true)
    }
  })

  it('every hybrid statement keeps absence pending (no auto-fail from missing text)', () => {
    const statements: { ruleId: string; params: Record<string, unknown> }[] = []
    const walk = (ruleId: string, spec: { kind: string; of?: unknown[]; params?: Record<string, unknown> }): void => {
      if (spec.kind === 'statement') statements.push({ ruleId, params: spec.params ?? {} })
      for (const child of (spec.of ?? []) as typeof spec[]) walk(ruleId, child)
    }
    for (const r of pack.rules) {
      if (r.tier !== 'hybrid' || !r.verifier) continue
      walk(r.id, r.verifier as unknown as { kind: string; of?: unknown[]; params?: Record<string, unknown> })
    }
    expect(statements.length).toBeGreaterThan(0)
    for (const { ruleId, params } of statements) {
      expect(params.decisive, ruleId).not.toBe(true)
      expect(params.whenNoCandidate ?? 'pending', ruleId).toBe('pending')
    }
  })
})

describe('mergeRules (T-RUL-10, T-DES-10)', () => {
  let shipped: Rule[]
  beforeAll(() => {
    shipped = shippedPack().rules
  })
  const stats = { shown: 0, adopt: 0, reject: 0, rewrite: 0 }
  const ov = (ruleId: string, patch: Partial<RuleOverride>): RuleOverride => ({ ruleId, stats, audit: [], ...patch })

  it('overrides status / severity / suggestion without mutating the shipped array', () => {
    const before = JSON.stringify(shipped)
    const { rules, warnings } = mergeRules(shipped, [
      ov('CAP-001', { status: 'retired', severity: 'major', suggestion: '改后的建议。' }),
    ])
    const r = rules.find((x) => x.id === 'CAP-001')!
    expect(r.status).toBe('retired')
    expect(r.severity).toBe('major')
    expect(r.suggestion).toBe('改后的建议。')
    expect(warnings).toEqual([])
    expect(JSON.stringify(shipped)).toBe(before)
    expect(rules).toHaveLength(shipped.length)
  })

  it('applies params.families add/remove to the statement verifier and whitelisted numeric params', () => {
    const { rules } = mergeRules(shipped, [
      ov('CAP-002', { params: { families: { add: ['volume'], remove: ['loadtest'] }, negationWindow: 10 } }),
      ov('DOC-001', { params: { minMessages: 5, minParticipants: 3 } }),
    ])
    const cap002 = rules.find((x) => x.id === 'CAP-002')!.verifier!
    expect(cap002.kind).toBe('statement')
    const p = (cap002 as { params: StatementParams }).params
    expect(p.families).toEqual(['volume'])
    expect(p.negationWindow).toBe(10)
    const doc001 = rules.find((x) => x.id === 'DOC-001')!.verifier!
    expect(doc001).toMatchObject({ kind: 'mermaid-sequence', params: { minMessages: 5, minParticipants: 3 } })
  })

  it('ignores params outside the whitelist and warns', () => {
    const { rules, warnings } = mergeRules(shipped, [
      ov('CAP-002', { params: { decisive: false, sections: ['risk'] } as unknown as NonNullable<RuleOverride['params']> }),
    ])
    const p = (rules.find((x) => x.id === 'CAP-002')!.verifier as { params: StatementParams }).params
    expect(p.decisive).toBe(true)
    expect(p.sections).toEqual(['implementation', 'resources'])
    expect(warnings.join(' ')).toMatch(/decisive/)
  })

  it('warns on unknown ruleId and leaves rules unchanged', () => {
    const { rules, warnings } = mergeRules(shipped, [ov('ZZZ-999', { status: 'retired' })])
    expect(rules).toHaveLength(shipped.length)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/ZZZ-999/)
  })

  it('appends draft rules (LRN-*) to the effective set, after shipped rules', () => {
    const draft: Rule = {
      ...shipped.find((x) => x.id === 'CFG-001')!,
      id: 'LRN-001',
      title: '解绑后停止推送',
      tier: 'soft',
      verifier: null,
      status: 'active',
      provenance: { source: 'expert:rv_x', examples: [] },
    }
    const { rules } = mergeRules(shipped, [ov('LRN-001', { draft })])
    expect(rules).toHaveLength(shipped.length + 1)
    expect(rules.at(-1)?.id).toBe('LRN-001')
  })

  it('does not apply a whenNoCandidate: pending override to a hard rule (keeps hard invariant) and warns', () => {
    const { rules, warnings } = mergeRules(shipped, [ov('CAP-002', { params: { whenNoCandidate: 'pending' } })])
    const p = (rules.find((x) => x.id === 'CAP-002')!.verifier as { params: StatementParams }).params
    expect(p.whenNoCandidate).toBe('fail')
    expect(warnings.join(' ')).toMatch(/hard|pending/)
  })
})
