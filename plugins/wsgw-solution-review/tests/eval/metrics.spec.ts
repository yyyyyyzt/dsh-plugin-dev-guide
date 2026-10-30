// Evaluation harness (S5): metrics (T-EVA-01/02), online labels (T-EVA-03), statistics (T-EVA-10).
import { describe, expect, it } from 'vitest'
import {
  accuracy,
  bootstrapCI,
  cohenKappa,
  confusionMatrix,
  holm,
  issueMetrics,
  labelOf,
  macroF1,
  mcnemar,
  seededRandom,
  VERDICT_ORDER,
  wilcoxonSignedRank,
} from '../../src/eval/index.js'
import type { Severity } from '../../src/engine/types.js'

const SEVERITY: Record<string, Severity> = {
  'CAP-001': 'blocker',
  'CAP-002': 'major',
  'INT-004': 'minor',
  'DOC-001': 'major',
  'DOC-010': 'minor',
  'DOC-012': 'minor',
}
const severityOf = (ruleId: string): Severity => SEVERITY[ruleId]!

describe('metrics (T-EVA-01, T-EVA-02)', () => {
  it('precision / recall / F1 / severity-weighted recall on 3 hand-built solutions match hand computation', () => {
    const m = issueMetrics(
      [
        { id: 's1', predicted: ['CAP-002', 'CAP-001'], truth: ['CAP-002', 'INT-004'] },
        { id: 's2', predicted: [], truth: ['DOC-001'] },
        { id: 's3', predicted: ['DOC-010', 'DOC-012'], truth: ['DOC-010', 'DOC-012'] },
      ],
      severityOf,
    )
    expect(m.tp).toBe(3)
    expect(m.fp).toBe(1)
    expect(m.fn).toBe(2)
    expect(m.precision).toBeCloseTo(0.75, 6)
    expect(m.recall).toBeCloseTo(0.6, 6)
    expect(m.f1).toBeCloseTo(2 / 3, 6)
    expect(m.weightedRecall).toBeCloseTo(4 / 7, 6)
  })

  it('empty prediction and truth sets give 0 counts and null-safe ratios', () => {
    const m = issueMetrics([{ id: 's', predicted: [], truth: [] }], severityOf)
    expect(m.tp + m.fp + m.fn).toBe(0)
    expect(m.precision).toBe(0)
    expect(m.recall).toBe(0)
    expect(m.f1).toBe(0)
    expect(m.weightedRecall).toBe(0)
  })

  it('duplicate rule ids inside one solution count once (alignment granularity = (solution, rule))', () => {
    const m = issueMetrics([{ id: 's', predicted: ['CAP-002', 'CAP-002'], truth: ['CAP-002'] }], severityOf)
    expect(m.tp).toBe(1)
    expect(m.fp).toBe(0)
  })

  // Rows = actual, columns = predicted; order 通过 / 建议整改 / 不通过.
  const matrix = [
    [10, 2, 0],
    [3, 8, 1],
    [0, 1, 5],
  ]

  it('confusion matrix is built from (predicted, actual) pairs in VERDICT_ORDER', () => {
    expect(VERDICT_ORDER).toEqual(['通过', '建议整改', '不通过'])
    const pairs = [
      { predicted: '通过', actual: '通过' },
      { predicted: '建议整改', actual: '通过' },
      { predicted: '不通过', actual: '不通过' },
      { predicted: '通过', actual: '建议整改' },
    ] as const
    expect(confusionMatrix([...pairs])).toEqual([
      [1, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ])
  })

  it('Cohen kappa (unweighted) and quadratic-weighted kappa on a known 3×3 confusion matrix match reference values', () => {
    expect(cohenKappa(matrix)).toBeCloseTo(0.635417, 5)
    expect(cohenKappa(matrix, 'quadratic')).toBeCloseTo(0.795322, 5)
    expect(accuracy(matrix)).toBeCloseTo(23 / 30, 6)
  })

  it('macro F1 over the three verdict classes matches reference', () => {
    expect(macroF1(matrix)).toBeCloseTo(0.77633, 4)
  })

  it('kappa of a perfect agreement is 1 and of an all-one-class prediction is 0', () => {
    expect(cohenKappa([[5, 0, 0], [0, 5, 0], [0, 0, 5]])).toBe(1)
    expect(cohenKappa([[5, 0, 0], [5, 0, 0], [5, 0, 0]])).toBe(0)
  })
})

describe('online labels (T-EVA-03)', () => {
  it('adopt → TP, rewrite → TP, reject → FP, add → FN, pending confirmed by expert → TP (reported separately)', () => {
    expect(labelOf({ action: 'adopt' })).toBe('TP')
    expect(labelOf({ action: 'rewrite' })).toBe('TP')
    expect(labelOf({ action: 'reject' })).toBe('FP')
    expect(labelOf({ action: 'add' })).toBe('FN')
    expect(labelOf({ action: 'adopt', wasPending: true })).toBe('TP-pending')
    expect(labelOf({ action: 'reject', wasPending: true })).toBe('FP-pending')
  })
})

describe('statistics (T-EVA-10)', () => {
  it('seeded RNG is deterministic and uniform in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const xs = Array.from({ length: 1000 }, () => a())
    const ys = Array.from({ length: 1000 }, () => b())
    expect(xs).toEqual(ys)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('bootstrap CI is reproducible for the same seed and brackets the point estimate', () => {
    const items = [0.2, 0.4, 0.6, 0.8, 1.0, 0.5, 0.7, 0.3, 0.9, 0.1]
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const r1 = bootstrapCI(items, mean, { resamples: 1000, seed: 7 })
    const r2 = bootstrapCI(items, mean, { resamples: 1000, seed: 7 })
    expect(r1).toEqual(r2)
    expect(r1.estimate).toBeCloseTo(0.55, 6)
    expect(r1.lower).toBeLessThanOrEqual(r1.estimate)
    expect(r1.upper).toBeGreaterThanOrEqual(r1.estimate)
    expect(r1.lower).toBeGreaterThan(0.2)
    expect(r1.upper).toBeLessThan(0.9)
  })

  it('Wilcoxon signed-rank: ties handled, zero differences dropped, two-sided p', () => {
    const r = wilcoxonSignedRank([1, 2, 3, 4, 5], [2, 3, 4, 5, 7])
    expect(r.n).toBe(5)
    expect(r.statistic).toBe(0)
    expect(r.pValue).toBeCloseTo(0.0339, 3)
    const same = wilcoxonSignedRank([1, 2, 3], [1, 2, 3])
    expect(same.n).toBe(0)
    expect(same.pValue).toBe(1)
  })

  it('McNemar: exact binomial for small discordant counts, continuity-corrected chi-square otherwise', () => {
    const small = mcnemar(10, 2)
    expect(small.method).toBe('exact')
    expect(small.pValue).toBeCloseTo(0.03857, 4)
    const large = mcnemar(30, 10)
    expect(large.method).toBe('chi2')
    expect(large.statistic).toBeCloseTo(9.025, 3)
    expect(large.pValue).toBeCloseTo(0.00266, 3)
    expect(mcnemar(0, 0).pValue).toBe(1)
  })

  it('Holm step-down adjustment preserves monotonicity', () => {
    const adj = holm([0.01, 0.04, 0.03])
    expect(adj[0]).toBeCloseTo(0.03, 10)
    expect(adj[1]).toBeCloseTo(0.06, 10)
    expect(adj[2]).toBeCloseTo(0.06, 10)
    expect(holm([0.5])).toEqual([0.5])
    expect(holm([0.9, 0.9]).every((p) => p <= 1)).toBe(true)
  })
})
