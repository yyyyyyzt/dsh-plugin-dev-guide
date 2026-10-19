// T-REQ-07 / T-RUL-09 / T-DES-06: evidence gate — every reason has a case; hybrid out-of-candidates; hard throws;
// range backfill and sectionPath correction.
import { beforeAll, describe, expect, it } from 'vitest'
import { gate, HardRuleVerifierOwnedError } from '../../src/engine/gate.js'
import type { Doc, Rule, Snippet } from '../../src/engine/types.js'
import { loadDoc, rule } from '../helpers.js'

let doc: Doc
let hybrid: Rule // CAP-003 资源扩容评估
let soft: Rule // CAP-004
let hard: Rule // CAP-002
let resourcesCandidate: Snippet
beforeAll(() => {
  doc = loadDoc('seed.md')
  hybrid = rule('CAP-003')
  soft = rule('CAP-004')
  hard = rule('CAP-002')
  resourcesCandidate = snippetOf('静态资源 H5 卡片部署，初步评估无需扩容资源。', '二/2.5')
})

function snippetOf(text: string, sectionPath: string): Snippet {
  const offset = doc.source.indexOf(text)
  if (offset < 0) throw new Error(`fixture text not found: ${text}`)
  const before = doc.source.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return {
    quote: text,
    sectionPath,
    range: {
      start: { line, column, offset },
      end: { line, column: column + text.length, offset: offset + text.length },
    },
  }
}

describe('gate (T-REQ-07, T-RUL-09)', () => {
  it('passes a hybrid quote that lies inside a candidate, backfilling range and sectionPath', () => {
    const r = gate(doc, hybrid, [{ quote: '初步评估无需扩容资源' }], [resourcesCandidate])
    expect(r.passed).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.resolved).toHaveLength(1)
    const e = r.resolved[0]!
    expect(e.kind).toBe('text')
    expect(e.sectionPath).toBe('二/2.5')
    expect(doc.source.slice(e.range!.start.offset, e.range!.end.offset)).toBe('初步评估无需扩容资源')
  })

  it('NO_RULE: without a rule the issue is soft/pending but evidence is still resolved when found', () => {
    const r = gate(doc, null, [{ quote: '初步评估无需扩容资源' }], undefined)
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['NO_RULE'])
    expect(r.resolved[0]?.range).toBeDefined()
  })

  it('SOFT_RULE: soft rules always fail the gate', () => {
    const r = gate(doc, soft, [{ quote: '初步评估无需扩容资源' }], undefined)
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['SOFT_RULE'])
  })

  it('HARD rule → throws HardRuleVerifierOwnedError with code', () => {
    expect(() => gate(doc, hard, [{ quote: '初步评估无需扩容资源' }], undefined)).toThrow(HardRuleVerifierOwnedError)
    try {
      gate(doc, hard, [], undefined)
    } catch (e) {
      expect((e as HardRuleVerifierOwnedError).code).toBe('HARD_RULE_VERIFIER_OWNED')
      expect((e as Error).message).toContain('CAP-002')
    }
  })

  it('NO_EVIDENCE: empty evidence list', () => {
    const r = gate(doc, hybrid, [], [resourcesCandidate])
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['NO_EVIDENCE'])
  })

  it('QUOTE_TOO_SHORT: normalized quote under 8 chars', () => {
    const r = gate(doc, hybrid, [{ quote: '无需扩容' }], [resourcesCandidate])
    expect(r.passed).toBe(false)
    expect(r.reasons).toContain('QUOTE_TOO_SHORT')
  })

  it('QUOTE_TOO_LONG: normalized quote over 300 chars', () => {
    const r = gate(doc, hybrid, [{ quote: '静态'.repeat(160) }], [resourcesCandidate])
    expect(r.passed).toBe(false)
    expect(r.reasons).toContain('QUOTE_TOO_LONG')
  })

  it('QUOTE_NOT_FOUND: quote not in the document', () => {
    const r = gate(doc, hybrid, [{ quote: '已完成全链路压测并通过验收' }], [resourcesCandidate])
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['QUOTE_NOT_FOUND'])
  })

  it('OUT_OF_CANDIDATES: hybrid quote found but outside every candidate range', () => {
    const r = gate(doc, hybrid, [{ quote: '上线前期会带来大量新增用户' }], [resourcesCandidate])
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['OUT_OF_CANDIDATES'])
    expect(r.resolved[0]?.range).toBeDefined()
  })

  it('OUT_OF_CANDIDATES also when no candidates were produced for a hybrid rule', () => {
    const r = gate(doc, hybrid, [{ quote: '初步评估无需扩容资源' }], [])
    expect(r.reasons).toEqual(['OUT_OF_CANDIDATES'])
  })

  it('collects all reasons across multiple evidence entries without duplicates', () => {
    const r = gate(doc, hybrid, [{ quote: '太短' }, { quote: '不存在的引文不存在的引文' }, { quote: '初步评估无需扩容资源' }], [
      resourcesCandidate,
    ])
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['QUOTE_TOO_SHORT', 'QUOTE_NOT_FOUND'])
    expect(r.resolved).toHaveLength(1)
  })

  it('tolerates spacing / emphasis differences between quote and source (normalized match)', () => {
    const r = gate(doc, hybrid, [{ quote: '初步 评估 无需扩容 资源' }], [resourcesCandidate])
    expect(r.passed).toBe(true)
  })

  it('a quote partially overlapping a candidate range counts as intersecting', () => {
    const r = gate(doc, hybrid, [{ quote: '卡片部署，初步评估无需' }], [resourcesCandidate])
    expect(r.passed).toBe(true)
  })
})

describe('gate sectionPath handling (T-DES-06)', () => {
  const dup = '与网上国网现有数据架构保持一致'
  let dupRule: Rule
  let cand: Snippet
  beforeAll(() => {
    dupRule = { ...hybrid, id: 'TST-001' }
    cand = snippetOf('数据存储：与网上国网现有数据架构保持一致', '二/2.2')
  })

  it('prefers the hit inside the given sectionPath when the quote occurs more than once', () => {
    const r = gate(doc, dupRule, [{ quote: dup, sectionPath: '二/2.2' }], [cand])
    expect(r.passed).toBe(true)
    expect(r.resolved[0]!.sectionPath).toBe('二/2.2')
  })

  it('corrects a wrong sectionPath to the actual hit section', () => {
    const r = gate(doc, hybrid, [{ quote: '初步评估无需扩容资源', sectionPath: '一' }], [resourcesCandidate])
    expect(r.passed).toBe(true)
    expect(r.resolved[0]!.sectionPath).toBe('二/2.5')
  })
})
