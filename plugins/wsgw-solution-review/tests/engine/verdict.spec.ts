// T-DES-05 / T-PRO-07: deterministic verdict policy (design.md §6).
import { describe, expect, it } from 'vitest'
import { computeVerdict, type VerdictIssue } from '../../src/engine/verdict.js'

const cfg = { minorThreshold: 3 }
const i = (severity: VerdictIssue['severity'], status: VerdictIssue['status'] = 'confirmed', tier: VerdictIssue['tier'] = 'hard'): VerdictIssue => ({
  severity,
  status,
  tier,
})

describe('computeVerdict (T-DES-05)', () => {
  it('no issues → 通过 with zero counts and a basis string', () => {
    const r = computeVerdict([], cfg)
    expect(r.verdict).toBe('通过')
    expect(r.counts).toEqual({ blocker: 0, major: 0, minor: 0 })
    expect(r.basis.length).toBeGreaterThan(0)
  })

  it('one confirmed blocker → 不通过', () => {
    expect(computeVerdict([i('blocker')], cfg).verdict).toBe('不通过')
  })

  it('one confirmed major → 建议整改', () => {
    expect(computeVerdict([i('major')], cfg).verdict).toBe('建议整改')
  })

  it('minor count equal to threshold → 建议整改; threshold − 1 → 通过', () => {
    expect(computeVerdict([i('minor'), i('minor'), i('minor')], cfg).verdict).toBe('建议整改')
    expect(computeVerdict([i('minor'), i('minor')], cfg).verdict).toBe('通过')
  })

  it('rejected issues do not count', () => {
    const r = computeVerdict([i('blocker', 'rejected'), i('major', 'rejected')], cfg)
    expect(r.verdict).toBe('通过')
    expect(r.counts).toEqual({ blocker: 0, major: 0, minor: 0 })
  })

  it('pending issues never count, even when severe', () => {
    expect(computeVerdict([i('blocker', 'pending', 'hybrid')], cfg).verdict).toBe('通过')
  })

  it('soft-tier issues never count regardless of status', () => {
    expect(computeVerdict([i('blocker', 'confirmed', 'soft'), i('major', 'adopted', 'soft')], cfg).verdict).toBe('通过')
  })

  it('adopted / rewritten / expert issues count', () => {
    expect(computeVerdict([i('major', 'adopted', 'hybrid')], cfg).verdict).toBe('建议整改')
    expect(computeVerdict([i('blocker', 'rewritten', 'hybrid')], cfg).verdict).toBe('不通过')
    expect(computeVerdict([i('major', 'adopted', 'expert')], cfg).verdict).toBe('建议整改')
  })

  it('blocker outranks everything else and counts are reported per severity', () => {
    const r = computeVerdict([i('minor'), i('major', 'adopted', 'hybrid'), i('blocker'), i('minor', 'rejected')], cfg)
    expect(r.verdict).toBe('不通过')
    expect(r.counts).toEqual({ blocker: 1, major: 1, minor: 1 })
  })

  it('basis mentions the deciding factor', () => {
    expect(computeVerdict([i('blocker')], cfg).basis).toMatch(/blocker/)
    expect(computeVerdict([i('minor'), i('minor'), i('minor')], cfg).basis).toMatch(/minor/)
    expect(computeVerdict([i('minor'), i('minor'), i('minor')], cfg).basis).toMatch(/3/)
  })

  it('respects a custom minorThreshold', () => {
    expect(computeVerdict([i('minor')], { minorThreshold: 1 }).verdict).toBe('建议整改')
    expect(computeVerdict([i('minor'), i('minor'), i('minor'), i('minor')], { minorThreshold: 5 }).verdict).toBe('通过')
  })
})
