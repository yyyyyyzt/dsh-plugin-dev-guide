// Read-only dashboard routes under /plugins/wsgw-solution-review/api/* via ctx.webServer.register — S3c/S4.
import { describe, it } from 'vitest'

describe('route policy (T-REQ-19, T-DES-11, NFR-05)', () => {
  it.todo('POST / PUT / DELETE on any api route → 405 with Allow: GET')
  it.todo('cross-origin request (Origin header not same-origin) → 403')
  it.todo('GET /api/reviews/<unknown> → 404 JSON { error }')
  it.todo('GET /api/reviews returns 50 per page with { items, page, total }')
  it.todo('GET /api/reviews/<id> JSON structure snapshot (review + issues + checklist + feedback)')
  it.todo('GET /api/rules returns effective rules with stats and override warnings')
  it.todo('GET /api/memory returns per-rule stats, exemplars (≤ exemplarsPerRule), sliding adopt rate series')
  it.todo('GET /api/eval-runs lists runs; 2–7 run ids may be compared')
  it.todo('responses never include the full solution source, only quotes')
})

describe('config assembly (T-DES-12)', () => {
  it.todo('dsh --dump-config with the plugin installed includes the cordis.patch.yml rows (plugin + preset) without name clashes')
  it.todo('config defaults match design.md §11 (minorThreshold 3, askBatchSize 5, rejectWarnRatio 0.6, …)')
})
