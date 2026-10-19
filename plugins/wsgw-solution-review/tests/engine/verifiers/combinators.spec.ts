// T-RUL-08: `all` / `first` status composition tables, via verify() dispatch.
import { beforeAll, describe, expect, it } from 'vitest'
import { verify } from '../../../src/engine/verifiers/index.js'
import type { Doc, VerifierSpec } from '../../../src/engine/types.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

// Building blocks with known outcomes on `doc`:
//   PASS  = section(resources) — present with enough body
//   FAIL  = section(risk) — missing
//   CAND  = statement(loadtest) — hits 「压测」, non-decisive
//   NA    = mermaid-sequence(participantFamilies: [openid]) — no diagram
//   PEND  = statement(ratelimit) — no hit, whenNoCandidate default pending
let doc: Doc
beforeAll(() => {
  doc = sectionsDoc({
    资源评估: '静态资源 H5 卡片部署，依据集群余量评估无需扩容，现有资源充足。',
    实施方案: '上线前开展压测。',
  })
})

const PASS: VerifierSpec = { kind: 'section', params: { heading: 'resources' } }
const FAIL: VerifierSpec = { kind: 'section', params: { heading: 'risk' } }
const CAND: VerifierSpec = { kind: 'statement', params: { families: ['loadtest'] } }
const NA: VerifierSpec = { kind: 'mermaid-sequence', params: { participantFamilies: ['openid'] } }
const PEND: VerifierSpec = { kind: 'statement', params: { families: ['ratelimit'] } }

describe('verify() dispatches single verifiers', () => {
  it.each([
    [PASS, 'pass'],
    [FAIL, 'fail'],
    [CAND, 'candidate'],
    [NA, 'not-applicable'],
    [PEND, 'pending'],
  ] as const)('%o → %s', (spec, status) => {
    expect(verify(doc, spec, miniLexicon).status).toBe(status)
  })
})

describe('all combinator (T-RUL-08)', () => {
  it.each([
    [[PASS, PASS], 'pass'],
    [[PASS, FAIL], 'fail'],
    [[CAND, FAIL], 'fail'],
    [[PASS, CAND], 'candidate'],
    [[CAND, PEND], 'candidate'],
    [[PASS, PEND], 'pending'],
    [[NA, NA], 'not-applicable'],
    [[NA, PASS], 'pass'],
    [[NA, CAND], 'candidate'],
  ] as const)('all(%o) → %s', (of, status) => {
    expect(verify(doc, { kind: 'all', of: [...of] }, miniLexicon).status).toBe(status)
  })

  it('merges evidence from every failing child', () => {
    const r = verify(doc, { kind: 'all', of: [FAIL, { kind: 'section', params: { heading: 'attachments' } }] }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence).toHaveLength(2)
    expect(r.evidence.map((e) => e.quote).join(' ')).toMatch(/风险评估/)
    expect(r.evidence.map((e) => e.quote).join(' ')).toMatch(/附件/)
  })

  it('merges candidates from every candidate child and carries no pass evidence into candidate results', () => {
    const r = verify(doc, { kind: 'all', of: [PASS, CAND, CAND] }, miniLexicon)
    expect(r.status).toBe('candidate')
    expect(r.candidates).toHaveLength(2)
  })
})

describe('first combinator (T-RUL-08)', () => {
  it.each([
    [[NA, CAND], 'candidate'],
    [[NA, PASS], 'pass'],
    [[FAIL, PASS], 'fail'],
    [[PASS, FAIL], 'pass'],
    [[NA, NA], 'not-applicable'],
    [[NA, PEND, PASS], 'pending'],
  ] as const)('first(%o) → %s', (of, status) => {
    expect(verify(doc, { kind: 'first', of: [...of] }, miniLexicon).status).toBe(status)
  })

  it('returns exactly the deciding child result (evidence/candidates untouched)', () => {
    const r = verify(doc, { kind: 'first', of: [NA, CAND] }, miniLexicon)
    expect(r.candidates?.[0]?.quote).toBe('上线前开展压测')
    expect(r.evidence).toEqual([])
  })
})

describe('nesting', () => {
  it('supports combinators inside combinators', () => {
    const r = verify(doc, { kind: 'all', of: [PASS, { kind: 'first', of: [NA, CAND] }] }, miniLexicon)
    expect(r.status).toBe('candidate')
  })
})
