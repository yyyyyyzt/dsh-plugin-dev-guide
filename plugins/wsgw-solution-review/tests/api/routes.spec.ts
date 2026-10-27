// Dashboard API: read models plus the three writable surfaces (rules, candidates, review decisions).
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import * as api from '../../src/host/api.js'
import * as reviewApi from '../../src/host/api.js'
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { defaultConfig } from '../../src/host/config.js'
import { packageRoot, readFixture } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'

interface CallOptions {
  body?: unknown
  headers?: Record<string, string>
}

interface Reply {
  status: number
  headers: Record<string, string>
  json: any
}

const opened: OpenedStore[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) {
    await o.close()
    await removeRoot(o.root)
  }
})

type StubRoute = { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => unknown }

// Mirrors dsh-webserver 0.2.1 `match`: exact first, then longest prefix p matching `p` or `p/<rest>`.
function matchRoute(routes: StubRoute[], pathname: string): StubRoute | undefined {
  const exact = routes.find((r) => r.kind === 'exact' && r.path === pathname)
  if (exact) return exact
  let best: StubRoute | undefined
  for (const r of routes) {
    if (r.kind !== 'prefix') continue
    if (pathname !== r.path && !pathname.startsWith(`${r.path}/`)) continue
    if (!best || r.path.length > best.path.length) best = r
  }
  return best
}

function install(store: OpenedStore['store'], rejection?: 401 | 403) {
  const routes: StubRoute[] = []
  const ctx = {
    solutionReview: store,
    webServer: {
      register(route: any) {
        routes.push(route)
        return () => {}
      },
    },
    connection: { requestRejection: () => rejection },
    effect(fn: () => unknown) {
      return fn()
    },
  }
  api.apply(ctx as any)
  return {
    routes,
    async call(method: string, path: string, options: CallOptions = {}): Promise<Reply> {
      const pathname = path.split('?')[0]!
      const route = matchRoute(routes, pathname)
      if (!route) return { status: 404, headers: {}, json: { error: 'NO_ROUTE', message: path } }
      const payload = options.body === undefined ? '' : JSON.stringify(options.body)
      const req = Readable.from(payload ? [Buffer.from(payload)] : []) as any
      req.method = method
      req.url = path
      req.headers = {
        host: '127.0.0.1:3080',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      }
      const headers: Record<string, string> = {}
      const chunks: string[] = []
      const res = {
        statusCode: 200,
        setHeader(name: string, value: string) {
          headers[name.toLowerCase()] = value
        },
        end(body?: string) {
          if (body) chunks.push(body)
        },
      } as any
      await route.handler(req, res)
      const text = chunks.join('')
      return {
        status: res.statusCode,
        headers,
        json: text ? JSON.parse(text) : undefined,
      }
    },
  }
}

async function parsed(store: OpenedStore['store'], fixture = 'seed.md'): Promise<string> {
  const out = await store.parse({ source: readFixture(fixture) })
  return out.reviewId
}

describe('route policy (T-REQ-19, T-DES-11, NFR-05)', () => {
  it('registers paths the dsh webserver can match: no trailing slash, no duplicates per kind', async () => {
    const o = await openStore()
    opened.push(o)
    const { routes } = install(o.store)
    for (const r of routes) {
      expect(r.path.startsWith(reviewApi.API_PREFIX)).toBe(true)
      expect(r.path.endsWith('/')).toBe(false)
    }
    const keys = routes.map((r) => `${r.kind} ${r.path}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(expect.arrayContaining([
      `prefix ${reviewApi.API_PREFIX}/rules`,
      `prefix ${reviewApi.API_PREFIX}/reviews`,
      `prefix ${reviewApi.API_PREFIX}/candidates`,
    ]))
  })

  it('unlisted methods return 405 with an Allow header', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const post = await http.call('POST', `${reviewApi.API_PREFIX}/rules`, { body: {} })
    expect(post.status).toBe(405)
    expect(post.headers.allow).toBe('GET')
    const put = await http.call('PUT', `${reviewApi.API_PREFIX}/reviews/rv_20261023_abc234`, { body: {} })
    expect(put.status).toBe(405)
    expect(put.headers.allow).toBe('GET, POST')
  })

  it('rejects a cross-origin request', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const out = await http.call('GET', `${reviewApi.API_PREFIX}/rules`, { headers: { origin: 'http://evil.example' } })
    expect(out.status).toBe(403)
    expect(out.json.error).toBe('CROSS_ORIGIN')
  })

  it('returns 404 JSON for an unknown review', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const out = await http.call('GET', `${reviewApi.API_PREFIX}/reviews/rv_20261023_zzzzzz`)
    expect(out.status).toBe(404)
    expect(out.json.error).toBe('REVIEW_NOT_FOUND')
  })

  it('returns 50 reviews per page with { items, page, total }', async () => {
    const o = await openStore()
    opened.push(o)
    for (let i = 0; i < 2; i += 1) await o.store.parse({ source: `# 方案 ${i}\n\n正文`, title: `方案 ${i}` })
    const http = install(o.store)
    const page = await http.call('GET', `${reviewApi.API_PREFIX}/reviews?page=2`)
    expect(page.status).toBe(200)
    expect(page.json.page).toBe(2)
    expect(page.json.total).toBe(2)
    expect(page.json.items).toEqual([])
    const first = await http.call('GET', `${reviewApi.API_PREFIX}/reviews`)
    expect(first.json.items).toHaveLength(2)
    expect(first.json.items[0].reviewId).toMatch(/^rv_/)
  })

  it('detail returns review + issues + checklist + counts + feedback, never source', async () => {
    const o = await openStore()
    opened.push(o)
    const reviewId = await parsed(o.store)
    await o.store.check(reviewId)
    const http = install(o.store)
    const out = await http.call('GET', `${reviewApi.API_PREFIX}/reviews/${reviewId}`)
    expect(out.status).toBe(200)
    for (const key of ['review', 'issues', 'checklist', 'counts', 'feedback', 'checklistCounts']) expect(out.json).toHaveProperty(key)
    expect(out.json.review).not.toHaveProperty('source')
    expect(JSON.stringify(out.json)).not.toMatch(/用户通过支付宝/)
  })

  it('rules returns effective rules, stats, warnings and version', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const out = await http.call('GET', `${reviewApi.API_PREFIX}/rules`)
    expect(out.status).toBe(200)
    expect(out.json.rules).toHaveLength(28)
    expect(out.json.rules[0]).toHaveProperty('stats')
    expect(out.json).toHaveProperty('warnings')
    expect(out.json.version).toMatch(/capability-open-access@/)
  })

  it('memory returns per-rule stats, exemplars, series and candidates', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const out = await http.call('GET', `${reviewApi.API_PREFIX}/memory`)
    expect(out.status).toBe(200)
    expect(out.json.rules).toHaveLength(28)
    expect(out.json.rules[0].series).toEqual([])
    expect(out.json.totals).toEqual({ exemplars: 0, candidates: 0, feedback: 0 })
  })

  it('eval-runs compares 2–7 ids and rejects other sizes', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    expect((await http.call('GET', `${reviewApi.API_PREFIX}/eval-runs`)).json.runs).toEqual([])
    const one = await http.call('GET', `${reviewApi.API_PREFIX}/eval-runs?ids=a`)
    expect(one.status).toBe(400)
    expect(one.json.error).toBe('BAD_COMPARE')
  })

  it('PATCH /rules/:id disables a rule and the list reflects it', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const write = await http.call('PATCH', `${reviewApi.API_PREFIX}/rules/CAP-002`, { body: { action: 'disable' } })
    expect(write.status).toBe(200)
    expect(write.json.rule.status).toBe('retired')
    const list = await http.call('GET', `${reviewApi.API_PREFIX}/rules`)
    expect(list.json.rules.find((r: any) => r.ruleId === 'CAP-002').status).toBe('retired')
  })

  it('review writes adopt an issue, set the reviewer and the final verdict', async () => {
    const o = await openStore()
    opened.push(o)
    const reviewId = await parsed(o.store)
    const check = await o.store.check(reviewId)
    const issueId = check.hardIssues[0]!.issueId
    const http = install(o.store)
    const adopt = await http.call('POST', `${reviewApi.API_PREFIX}/reviews/${reviewId}/issues/${encodeURIComponent(issueId)}`, { body: { action: 'adopt' } })
    expect(adopt.status).toBe(200)
    expect(adopt.json.issue.status).toBe('adopted')
    const reviewer = await http.call('POST', `${reviewApi.API_PREFIX}/reviews/${reviewId}/reviewer`, { body: { reviewer: '看板专家' } })
    expect(reviewer.status).toBe(200)
    const verdict = await http.call('POST', `${reviewApi.API_PREFIX}/reviews/${reviewId}/final-verdict`, { body: { finalVerdict: '通过' } })
    expect(verdict.status).toBe(200)
    expect(verdict.json.finalVerdict).toBe('通过')
  })

  it('passes the connection fence verdict through untouched and writes nothing (T-DSH-10)', async () => {
    const o = await openStore()
    opened.push(o)
    for (const status of [401, 403] as const) {
      const http = install(o.store, status)
      const read = await http.call('GET', `${reviewApi.API_PREFIX}/rules`)
      expect(read.status).toBe(status)
      const write = await http.call('PATCH', `${reviewApi.API_PREFIX}/rules/CAP-002`, { body: { action: 'disable' } })
      expect(write.status).toBe(status)
    }
    expect(o.store.domain.table('rule_overrides').get('CAP-002')).toBeUndefined()
  })

  it('GET /rules/:id returns the full rule detail with shipped values, override, audit and memory', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const plain = await http.call('GET', `${reviewApi.API_PREFIX}/rules/CAP-002`)
    expect(plain.status).toBe(200)
    expect(plain.json.rule).toMatchObject({ ruleId: 'CAP-002', overridden: false })
    expect(plain.json.detail).toMatchObject({
      question: expect.any(String), rationale: expect.any(String), suggestion: expect.any(String),
      verifier: expect.any(Object), provenance: expect.any(Object), audit: [],
      memory: { stats: { shown: 0 }, warn: false, exemplars: [], recentRejectReasons: [] },
    })
    expect(plain.json.detail.override).toBeUndefined()
    const shippedSeverity = plain.json.rule.severity
    await http.call('PATCH', `${reviewApi.API_PREFIX}/rules/CAP-002`, { body: { action: 'set_severity', severity: 'minor' } })
    const after = await http.call('GET', `${reviewApi.API_PREFIX}/rules/CAP-002`)
    expect(after.json.rule).toMatchObject({ severity: 'minor', overridden: true })
    expect(after.json.detail.shipped).toEqual({ severity: shippedSeverity, status: 'active' })
    expect(after.json.detail.override).toEqual({ severity: 'minor' })
    expect(after.json.detail.audit).toMatchObject([{ who: 'dashboard', change: { field: 'severity', from: shippedSeverity, to: 'minor' } }])
    expect((await http.call('GET', `${reviewApi.API_PREFIX}/rules/NOPE-001`)).status).toBe(404)
  })

  it('POST /candidates/:id accept_draft accepts the drafted rule; an undrafted candidate → 400', async () => {
    const o = await openStore({ defaultReviewer: '张三' })
    opened.push(o)
    const reviewId = await parsed(o.store)
    await o.store.check(reviewId)
    await o.store.decide(reviewId, { action: 'add', text: '补充灰度策略' })
    await o.store.decide(reviewId, { action: 'add', text: '补充回滚方案' })
    await o.store.decide(reviewId, { action: 'set_final_verdict', finalVerdict: '建议整改' })
    await o.store.finalize(reviewId, async (name) => `reviews/${name}`)
    const http = install(o.store)
    const undrafted = await http.call('POST', `${reviewApi.API_PREFIX}/candidates/rc_${reviewId}_2`, { body: { action: 'accept_draft' } })
    expect(undrafted.status).toBe(400)
    expect(undrafted.json.error).toBe('BAD_ACTION')
    await o.store.rulesPropose({
      action: 'draft',
      candidateId: `rc_${reviewId}_1`,
      draft: ['id: INT-903', 'title: 灰度策略', 'dimension: interface', 'severity: minor', 'tier: soft', 'question: 是否说明灰度？', 'rationale: r', 'suggestion: 建议补充灰度策略'].join('\n'),
    })
    const accepted = await http.call('POST', `${reviewApi.API_PREFIX}/candidates/rc_${reviewId}_1`, { body: { action: 'accept_draft' } })
    expect(accepted.status).toBe(200)
    expect(accepted.json.rule).toMatchObject({ ruleId: 'INT-903', status: 'active' })
    expect(o.store.domain.table('rule_candidates').get(`rc_${reviewId}_1`)?.status).toBe('accepted')
    const dismissed = await http.call('POST', `${reviewApi.API_PREFIX}/candidates/rc_${reviewId}_2`, { body: { action: 'dismiss' } })
    expect(dismissed.json.candidate.status).toBe('dismissed')
  })

  it('rejects a write whose body is not JSON object', async () => {
    const o = await openStore()
    opened.push(o)
    const http = install(o.store)
    const out = await http.call('PATCH', `${reviewApi.API_PREFIX}/rules/CAP-002`, { body: [] })
    expect(out.status).toBe(400)
  })
})

describe('config assembly (T-DES-12)', () => {
  it.todo('dsh --dump-config with the plugin installed includes the cordis.patch.yml rows (plugin + preset) without name clashes')

  it('the cordis.patch.yml plugin row carries exactly the schema defaults (design.md §11)', () => {
    const rows = parseYaml(readFileSync(`${packageRoot}/cordis.patch.yml`, 'utf8'), { logLevel: 'error' }) as { insert: { id: string; config: unknown }[] }[]
    const row = rows[0]!.insert.find((r) => r.id === 'wsgw-solution-review')!
    expect(row.config).toEqual(defaultConfig())
    expect(defaultConfig()).toMatchObject({ minorThreshold: 3, askBatchSize: 5, rejectWarnRatio: 0.6, defaultReviewer: '' })
    expect(defaultConfig()).not.toHaveProperty('dashboardPollSeconds')
  })
})
