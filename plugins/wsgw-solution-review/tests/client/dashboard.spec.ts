// Dashboard (sidebar right tab + settings card) — S4. Pure helpers are tested here once src/client exists;
// rendering is verified in `pnpm dsh web` with a recording.
import { describe, it } from 'vitest'

describe('tab registration (T-DSH-01)', () => {
  it.todo('registers { id: "wsgw-solution-review", kind: "wsgw-review", guide } — snapshot')
})

describe('pages (T-DSH-02, T-DSH-04, T-DSH-06, T-DSH-07)', () => {
  it.todo('每页在空数据下显示各自空状态文案')
  it.todo('记录详情：aiVerdictAtFinalize ≠ finalVerdict 时高亮差异；清单恰有 28 行')
  it.todo('评测对比视图：选择少于 2 或多于 7 个 run 被禁止')
  it.todo('fetch 失败 → 错误条 + 重试按钮；非 JSON 响应不抛未捕获异常')
  it.todo('不向 localStorage 写入任何数据')
})

describe('pure helpers (T-DSH-03, T-DSH-05)', () => {
  it.todo('markFrequentlyRejected(stats, cfg) marks rules with rejectRatio ≥ 0.6 and shown ≥ 5')
  it.todo('rule page filter by dimension / tier / status')
  it.todo('sliding adopt rate (window 5) shows 「样本不足」 while fewer than 5 finalized reviews')
})

describe('settings card (T-DSH-09)', () => {
  it.todo('minorThreshold accepts 1–10, askBatchSize 1–10, rejectWarnRatio 0–1, dashboardPollSeconds ∈ {0,30,60}')
  it.todo('out-of-range input is rejected with an inline message and not saved')
})

describe('bundle (T-DSH-08, T-DES-13)', () => {
  it.todo('tests/client/check-bundle.mjs exits 0 on the built lib/client.js (run via pnpm check:bundle)')
})
