// T-REQ-10 / T-REQ-15 / T-DSH-03 / T-DSH-05: memory pure functions — stats aggregation, recall with
// 「常被驳回」 warning, exemplar cap, candidate rules from expert additions, sliding adopt rate.
import { describe, expect, it } from 'vitest'
import { aggregateStats, candidatesFrom, recall, slidingAdoptRate, trimExemplars } from '../../src/engine/memory.js'
import type { Exemplar, Feedback, Issue } from '../../src/engine/types.js'

const cfg = { rejectWarnRatio: 0.6, rejectWarnMinSamples: 5, exemplarsPerRule: 20 }

const fb = (ruleId: string | undefined, action: Feedback['action'], n: number, extra: Partial<Feedback> = {}): Feedback => ({
  reviewId: `rv_20261019_${String(n).padStart(6, '0')}`,
  issueId: `rv_20261019_${String(n).padStart(6, '0')}#1`,
  action,
  at: `2026-10-19T00:00:${String(n % 60).padStart(2, '0')}Z`,
  ...(ruleId ? { ruleId } : {}),
  ...extra,
})

describe('aggregateStats (T-REQ-15)', () => {
  it('counts adopt / reject / rewrite per rule and takes shown from the caller', () => {
    const stats = aggregateStats(
      [fb('CAP-001', 'reject', 1), fb('CAP-001', 'reject', 2), fb('CAP-001', 'adopt', 3), fb('CAP-002', 'rewrite', 4)],
      { 'CAP-001': 4, 'CAP-002': 1, 'CAP-003': 2 },
    )
    expect(stats['CAP-001']).toEqual({ shown: 4, adopt: 1, reject: 2, rewrite: 0 })
    expect(stats['CAP-002']).toEqual({ shown: 1, adopt: 0, reject: 0, rewrite: 1 })
    expect(stats['CAP-003']).toEqual({ shown: 2, adopt: 0, reject: 0, rewrite: 0 })
  })

  it('ignores feedback without a ruleId (soft / expert-added issues)', () => {
    const stats = aggregateStats([fb(undefined, 'adopt', 1)], {})
    expect(Object.keys(stats)).toEqual([])
  })
})

describe('recall (T-REQ-10, T-DSH-03)', () => {
  const exemplars: Exemplar[] = [
    { ruleId: 'CAP-001', kind: 'adopt', text: '建议补充限流策略。', reviewId: 'rv_a', at: '2026-10-01T00:00:00Z' },
    { ruleId: 'CAP-001', kind: 'rewrite', text: '建议明确网关限流阈值并补充熔断方案。', reviewId: 'rv_b', at: '2026-10-02T00:00:00Z' },
    { ruleId: 'CAP-002', kind: 'adopt', text: '无关。', reviewId: 'rv_c', at: '2026-10-03T00:00:00Z' },
  ]

  it('warns when rejectRatio ≥ ratio and shown ≥ minSamples', () => {
    const r = recall('CAP-001', { shown: 5, adopt: 2, reject: 3, rewrite: 0 }, exemplars, [], cfg)
    expect(r.stats.rejectRatio).toBeCloseTo(0.6)
    expect(r.warn).toBe(true)
  })

  it('does not warn below the sample threshold even with a high ratio', () => {
    const r = recall('CAP-001', { shown: 4, adopt: 0, reject: 4, rewrite: 0 }, exemplars, [], cfg)
    expect(r.stats.rejectRatio).toBe(1)
    expect(r.warn).toBe(false)
  })

  it('does not warn below the ratio threshold', () => {
    const r = recall('CAP-001', { shown: 10, adopt: 5, reject: 5, rewrite: 0 }, exemplars, [], cfg)
    expect(r.warn).toBe(false)
  })

  it('computes rejectRatio as reject / shown and handles shown = 0', () => {
    const r = recall('CAP-001', undefined, [], [], cfg)
    expect(r.stats).toEqual({ shown: 0, adopt: 0, reject: 0, rewrite: 0, rejectRatio: 0 })
    expect(r.warn).toBe(false)
    expect(r.exemplars).toEqual([])
    expect(r.recentRejectReasons).toEqual([])
  })

  it('returns only this rule’s exemplars, newest first', () => {
    const r = recall('CAP-001', undefined, exemplars, [], cfg)
    expect(r.exemplars.map((e) => e.reviewId)).toEqual(['rv_b', 'rv_a'])
  })

  it('returns the 3 most recent reject reasons for the rule, skipping empty reasons', () => {
    const feedback = [
      fb('CAP-001', 'reject', 1, { reason: '一' }),
      fb('CAP-001', 'reject', 2, { reason: '二' }),
      fb('CAP-001', 'reject', 3),
      fb('CAP-001', 'reject', 4, { reason: '四' }),
      fb('CAP-001', 'reject', 5, { reason: '五' }),
      fb('CAP-002', 'reject', 6, { reason: '别的规则' }),
      fb('CAP-001', 'adopt', 7, { reason: '采纳不算' }),
    ]
    const r = recall('CAP-001', undefined, [], feedback, cfg)
    expect(r.recentRejectReasons).toEqual(['五', '四', '二'])
  })
})

describe('trimExemplars (T-REQ-15)', () => {
  const list: Exemplar[] = Array.from({ length: 25 }, (_, k) => ({
    ruleId: k % 2 ? 'CAP-001' : 'CAP-002',
    kind: 'adopt',
    text: `t${k}`,
    reviewId: `rv_${k}`,
    at: `2026-10-${String((k % 28) + 1).padStart(2, '0')}T00:00:00Z`,
  }))

  it('keeps at most perRule entries per rule, dropping the oldest', () => {
    const out = trimExemplars(list, 5)
    const byRule = (id: string) => out.filter((e) => e.ruleId === id)
    expect(byRule('CAP-001')).toHaveLength(5)
    expect(byRule('CAP-002')).toHaveLength(5)
    const kept = byRule('CAP-001').map((e) => e.at).sort()
    const all = list.filter((e) => e.ruleId === 'CAP-001').map((e) => e.at).sort()
    expect(kept).toEqual(all.slice(-5))
  })

  it('is a no-op when under the cap and keeps input order', () => {
    expect(trimExemplars(list.slice(0, 4), 20)).toEqual(list.slice(0, 4))
  })
})

describe('candidatesFrom (T-REQ-15)', () => {
  const base: Omit<Issue, 'issueId' | 'origin' | 'ruleId' | 'finding'> = {
    reviewId: 'rv_x',
    severity: 'major',
    tier: 'expert',
    suggestion: '',
    evidence: [],
    status: 'adopted',
    gate: { passed: true, reasons: [] },
    seq: 1,
  }

  it('creates one candidate per expert-added issue without a ruleId, carrying text and ids', () => {
    const issues: Issue[] = [
      { ...base, issueId: 'rv_x#1', origin: 'expert', finding: '需补充解绑后停止推送的说明', seq: 1 },
      { ...base, issueId: 'rv_x#2', origin: 'expert', ruleId: 'CAP-001', finding: '挂在已有规则下', seq: 2 },
      { ...base, issueId: 'rv_x#3', origin: 'llm', finding: '不是专家新增', seq: 3 },
    ]
    const out = candidatesFrom(issues)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ text: '需补充解绑后停止推送的说明', reviewId: 'rv_x', issueId: 'rv_x#1' })
  })

  it('suggests a dimension from the finding text when obvious', () => {
    const out = candidatesFrom([{ ...base, issueId: 'rv_x#1', origin: 'expert', finding: '缺少对接口限流与压测的说明' }])
    expect(out[0]?.suggestedDimension).toBe('capacity')
  })
})

describe('slidingAdoptRate (T-DSH-05)', () => {
  const review = (adopt: number, reject: number): Feedback[] => [
    ...Array.from({ length: adopt }, (_, k) => fb('R', 'adopt', k)),
    ...Array.from({ length: reject }, (_, k) => fb('R', 'reject', 100 + k)),
  ]

  it('returns null for positions with fewer than `window` reviews, then the windowed adopt ratio', () => {
    const series = [review(1, 0), review(1, 1), review(0, 1), review(1, 0), review(1, 0), review(0, 2)]
    const out = slidingAdoptRate(series, 5)
    expect(out).toHaveLength(6)
    expect(out.slice(0, 4)).toEqual([null, null, null, null])
    // window 1..5: adopt 4 / (4 + 2) decisions
    expect(out[4]).toBeCloseTo(4 / 6)
    // window 2..6: adopt 3 / (3 + 4)
    expect(out[5]).toBeCloseTo(3 / 7)
  })

  it('counts rewrite as adoption', () => {
    const series = [[fb('R', 'rewrite', 1)], [fb('R', 'reject', 2)]]
    expect(slidingAdoptRate(series, 2)).toEqual([null, 0.5])
  })

  it('returns an empty array for no reviews', () => {
    expect(slidingAdoptRate([], 5)).toEqual([])
  })
})
