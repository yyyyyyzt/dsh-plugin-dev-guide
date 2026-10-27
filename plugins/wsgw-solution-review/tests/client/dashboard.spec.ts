// Dashboard (sidebar right tab + settings card) — S4. Pure helpers are tested here once src/client exists;
// rendering is verified in `pnpm dsh web` with a recording.
import { describe, expect, it } from 'vitest'
import { TAB_DEFINITION, filterRules, markFrequentlyRejected, slidingAdoptRate, validateSettings } from '../../src/client/index.js'

describe('tab registration (T-DSH-01)', () => {
  it('registers the wsgw-review page type with a guide entry', () => {
    expect(TAB_DEFINITION).toMatchObject({ id: 'wsgw-solution-review', kind: 'wsgw-review', priority: 'extension' })
    expect(TAB_DEFINITION.guide).toHaveLength(1)
    expect(TAB_DEFINITION.guide[0]).toMatchObject({ id: 'dashboard', order: 10 })
    expect(TAB_DEFINITION.guide[0]?.title()).toBe('方案审查看板')
  })
})

describe('pages (T-DSH-02, T-DSH-04, T-DSH-06, T-DSH-07)', () => {
  it.todo('每页在空数据下显示各自空状态文案')
  it.todo('记录详情：aiVerdictAtFinalize ≠ finalVerdict 时高亮差异；清单恰有 28 行')
  it.todo('评测对比视图：选择少于 2 或多于 7 个 run 被禁止')
  it.todo('fetch 失败 → 错误条 + 重试按钮；非 JSON 响应不抛未捕获异常')
  it.todo('不向 localStorage 写入任何数据')
})

describe('pure helpers (T-DSH-03, T-DSH-05)', () => {
  it('markFrequentlyRejected marks rules with rejectRatio ≥ 0.6 and shown ≥ 5', () => {
    expect(markFrequentlyRejected({ shown: 5, adopt: 1, reject: 3, rewrite: 1 })).toBe(true)
    expect(markFrequentlyRejected({ shown: 4, adopt: 1, reject: 3, rewrite: 0 })).toBe(false)
    expect(markFrequentlyRejected({ shown: 5, adopt: 3, reject: 2, rewrite: 0 })).toBe(false)
  })
  it('rule page filters by dimension / tier / status', () => {
    const rules = [
      { ruleId: 'CAP-001', dimension: 'capability', tier: 'hybrid', status: 'active' },
      { ruleId: 'SEC-001', dimension: 'security', tier: 'hard', status: 'retired' },
    ] as unknown as Parameters<typeof filterRules>[0]
    expect(filterRules(rules, { dimension: 'security' }).map((r) => r.ruleId)).toEqual(['SEC-001'])
    expect(filterRules(rules, { tier: 'hybrid' }).map((r) => r.ruleId)).toEqual(['CAP-001'])
    expect(filterRules(rules, { status: 'retired' }).map((r) => r.ruleId)).toEqual(['SEC-001'])
  })
  it('sliding adopt rate reports insufficient below five decided reviews', () => {
    const point = (reviewId: string, adopted: number, rejected: number) => ({ reviewId, at: reviewId, adopted, rejected, rewritten: 0, rate: null })
    expect(slidingAdoptRate([point('a', 1, 0), point('b', 0, 1)])).toMatchObject({ insufficient: true, sample: 2 })
    expect(slidingAdoptRate([point('a', 1, 0), point('b', 1, 0), point('c', 1, 0), point('d', 1, 0), point('e', 0, 1)])).toMatchObject({ insufficient: false, rate: 0.8 })
  })
  it('settings validation rejects out-of-range values', () => {
    expect(validateSettings({ minorThreshold: 3, askBatchSize: 5, rejectWarnRatio: 0.6, dashboardPollSeconds: 0 }).ok).toBe(true)
    const bad = validateSettings({ minorThreshold: 0, askBatchSize: 11, rejectWarnRatio: 2, dashboardPollSeconds: 15 })
    expect(bad.ok).toBe(false)
    expect(Object.keys(bad.errors)).toEqual(['minorThreshold', 'askBatchSize', 'rejectWarnRatio', 'dashboardPollSeconds'])
  })
})

describe('settings card (T-DSH-09)', () => {
  it.todo('minorThreshold accepts 1–10, askBatchSize 1–10, rejectWarnRatio 0–1, dashboardPollSeconds ∈ {0,30,60}')
  it.todo('out-of-range input is rejected with an inline message and not saved')
})

describe('bundle (T-DSH-08, T-DES-13)', () => {
  it.todo('tests/client/check-bundle.mjs exits 0 on the built lib/client.js (run via pnpm check:bundle)')
})
