// Dashboard API: read models plus the three writable surfaces (rules, candidates, review decisions).
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import * as api from '../../src/host/api.js'
import * as reviewApi from '../../src/host/api.js'
import { readFixture } from '../helpers.js'
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

function install(store: OpenedStore['store']) {
  const routes: { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => unknown }[] = []
  const ctx = {
    solutionReview: store,
    webServer: {
      register(route: any) {
        routes.push(route)
        return () => {}
      },
    },
    connection: { requestRejection: () => undefined },
    effect(fn: () => unknown) {
      return fn()
    },
  }
  api.apply(ctx as any)
  return {
    async call(method: string, path: string, options: CallOptions = {}): Promise<Reply> {
      const pathname = path.split('?')[0]!
      const route = routes.find((r) => (r.kind === 'exact' ? r.path === pathname : pathname.startsWith(r.path)))
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
  it.todo('config defaults match design.md §11 (minorThreshold 3, askBatchSize 5, rejectWarnRatio 0.6, …)')
})
