// Read/write dashboard API under /plugins/wsgw-solution-review/api/* (design.md §10).
// Auth is the composition's connection fence; this module adds no credential store of its own.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Verdict } from '../engine/types.js'
import type { ReviewRecord } from '../store/domain.js'
import type { ReviewCounts, ReviewDetailPayload, ReviewListPayload, ReviewView, RulesPayload } from './api-types.js'
import { ReviewToolError } from './errors.js'
import type { ReviewStore } from './store.js'

export type { ReviewCounts, ReviewDetailPayload, ReviewListPayload, ReviewView, RulesPayload } from './api-types.js'

export const name = 'wsgw-solution-review-api'
export const inject = ['webServer', 'connection', 'solutionReview']

export const API_PREFIX = '/plugins/wsgw-solution-review/api'
const MAX_BODY = 64 * 1024
const PAGE_SIZE = 50
const VERDICTS = new Set(['通过', '建议整改', '不通过'])

interface Route {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

interface WebServer {
  register(route: Route): () => void
}

interface Connection {
  requestRejection(req: IncomingMessage): 401 | 403 | undefined
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer: WebServer
    connection: Connection
  }
}

type Json = Record<string, unknown>

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: code, message })
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.setHeader('allow', allow)
  sendError(res, 405, 'METHOD_NOT_ALLOWED', `只支持 ${allow}`)
}

function rejectRequest(ctx: Context, req: IncomingMessage, res: ServerResponse): boolean {
  const rejection = ctx.connection.requestRejection(req)
  if (rejection !== undefined) {
    res.statusCode = rejection
    res.end()
    return true
  }
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        sendError(res, 403, 'CROSS_ORIGIN', '仅接受同源请求')
        return true
      }
    } catch {
      sendError(res, 403, 'CROSS_ORIGIN', 'Origin 无法解析')
      return true
    }
  }
  return false
}

async function readJson(req: IncomingMessage, res: ServerResponse): Promise<Json | undefined> {
  const type = req.headers['content-type']
  if (typeof type !== 'string' || !type.toLowerCase().includes('application/json')) {
    sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', '请求体必须是 application/json')
    return undefined
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buf.length
    if (size > MAX_BODY) {
      sendError(res, 413, 'PAYLOAD_TOO_LARGE', '请求体超过 64 KiB')
      return undefined
    }
    chunks.push(buf)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      sendError(res, 400, 'BAD_BODY', '请求体必须是 JSON 对象')
      return undefined
    }
    return value as Json
  } catch {
    sendError(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
    return undefined
  }
}

function reviewView(review: ReviewRecord): ReviewView {
  return {
    reviewId: review.reviewId,
    title: review.title,
    status: review.status,
    ...(review.reviewer ? { reviewer: review.reviewer } : {}),
    aiVerdict: review.aiVerdict,
    ...(review.aiVerdictAtFinalize ? { aiVerdictAtFinalize: review.aiVerdictAtFinalize } : {}),
    ...(review.finalVerdict ? { finalVerdict: review.finalVerdict } : {}),
    ...(review.verdictDelta ? { verdictDelta: review.verdictDelta } : {}),
    ...(review.opinionPath ? { opinionPath: review.opinionPath } : {}),
    versions: review.versions,
    metrics: review.metrics,
    createdAt: review.createdAt,
    rulePackVersion: review.rulePackVersion,
    ...(review.warnings ? { warnings: review.warnings } : {}),
  }
}

function reviewCounts(store: ReviewStore, reviewId: string): ReviewCounts {
  const issues = store.issuesOf(reviewId)
  const count = (status: string): number => issues.filter((i) => i.status === status).length
  return {
    total: issues.length,
    confirmed: count('confirmed'),
    pending: count('pending'),
    adopted: count('adopted'),
    rejected: count('rejected'),
    rewritten: count('rewritten'),
  }
}

export function rulesPayload(store: ReviewStore): RulesPayload {
  const listed = store.rulesList({})
  return { rules: listed.rules, warnings: listed.warnings, loadErrors: listed.loadErrors, version: store.effectiveRules().version }
}

export function reviewListPayload(store: ReviewStore, page: number): ReviewListPayload {
  const all = store.listReviews()
  const start = (page - 1) * PAGE_SIZE
  const items = all.slice(start, start + PAGE_SIZE).map((review) => ({ ...reviewView(review), counts: reviewCounts(store, review.reviewId) }))
  return { items, page, total: all.length }
}

export function reviewDetailPayload(store: ReviewStore, reviewId: string): ReviewDetailPayload {
  const status = store.status(reviewId)
  return {
    review: reviewView(store.requireReview(reviewId)),
    issues: status.issues,
    checklist: status.checklist,
    checklistCounts: status.checklistCounts,
    counts: status.counts,
    basis: status.basis,
    summary: status.summary,
    feedback: store.feedbackOf(reviewId),
  }
}

function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof ReviewToolError) {
    const notFound = new Set(['REVIEW_NOT_FOUND', 'RULE_NOT_FOUND', 'ISSUE_NOT_FOUND', 'CANDIDATE_NOT_FOUND', 'EVAL_RUN_NOT_FOUND'])
    sendError(res, notFound.has(error.code) ? 404 : 400, error.code, error.message)
    return
  }
  sendError(res, 500, 'INTERNAL', error instanceof Error ? error.message : '内部错误')
}

function route(ctx: Context, kind: Route['kind'], path: string, handler: Route['handler']): void {
  ctx.effect(
    () => ctx.webServer.register({ kind, path, handler }),
    `wsgw-solution-review-api: ${kind} ${path}`,
  )
}

export function apply(ctx: Context): void {
  const store = ctx.solutionReview
  const wrap = (handler: Route['handler']): Route['handler'] => async (req, res) => {
    if (rejectRequest(ctx, req, res)) return
    try {
      await handler(req, res)
    } catch (error) {
      handleError(res, error)
    }
  }

  // Rules: list + enable/disable/severity/whitelisted parameter writes.
  route(ctx, 'exact', `${API_PREFIX}/rules`, wrap(async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    sendJson(res, 200, rulesPayload(store))
  }))

  route(ctx, 'prefix', `${API_PREFIX}/rules/`, wrap(async (req, res) => {
    const ruleId = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(`${API_PREFIX}/rules/`.length))
    if (!ruleId || ruleId.includes('/')) return sendError(res, 404, 'NOT_FOUND', '规则不存在')
    if (req.method === 'GET') return sendJson(res, 200, store.ruleDetail(ruleId))
    if (req.method !== 'PATCH') return methodNotAllowed(res, 'GET, PATCH')
    const body = await readJson(req, res)
    if (!body) return
    const action = body.action
    if (action !== 'disable' && action !== 'enable' && action !== 'set_severity' && action !== 'set_param') {
      return sendError(res, 400, 'BAD_ACTION', 'action 必须是 disable / enable / set_severity / set_param')
    }
    if (action === 'set_severity' && body.severity !== 'blocker' && body.severity !== 'major' && body.severity !== 'minor') {
      return sendError(res, 400, 'BAD_SEVERITY', 'severity 必须是 blocker / major / minor')
    }
    if (action === 'set_param') {
      const param = body.param as { key?: unknown; value?: unknown } | undefined
      if (!param || typeof param.key !== 'string') return sendError(res, 400, 'BAD_PARAM', 'param 需要 key 字符串')
    }
    const result = await store.rulesPropose({
      action,
      ruleId,
      ...(typeof body.severity === 'string' ? { severity: body.severity as 'blocker' | 'major' | 'minor' } : {}),
      ...(body.param && typeof body.param === 'object' ? { param: body.param as { key: string; value: unknown } } : {}),
      who: 'dashboard',
    })
    sendJson(res, 200, result)
  }))

  // Candidate rules: accept the drafted rule or dismiss; drafting itself stays in the conversation.
  route(ctx, 'prefix', `${API_PREFIX}/candidates/`, wrap(async (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    const candidateId = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(`${API_PREFIX}/candidates/`.length))
    if (!candidateId || candidateId.includes('/')) return sendError(res, 404, 'NOT_FOUND', '候选规则不存在')
    const body = await readJson(req, res)
    if (!body) return
    const action = body.action
    if (action !== 'accept_draft' && action !== 'dismiss' && action !== 'draft') {
      return sendError(res, 400, 'BAD_ACTION', 'action 必须是 accept_draft / dismiss / draft')
    }
    if (action === 'draft' && typeof body.draft !== 'string') return sendError(res, 400, 'BAD_DRAFT', 'draft 需要 YAML 文本')
    let ruleId: string | undefined
    if (action === 'accept_draft') {
      const candidate = store.domain.table('rule_candidates').get(candidateId)
      if (!candidate) return sendError(res, 404, 'CANDIDATE_NOT_FOUND', `候选规则 ${candidateId} 不存在`)
      if (!candidate.draftRuleId) return sendError(res, 400, 'BAD_ACTION', '该候选尚未起草：请回到对话让 agent 起草规则（rules_propose draft）后再接受')
      ruleId = candidate.draftRuleId
    }
    const result = await store.rulesPropose({
      action,
      candidateId,
      ...(ruleId ? { ruleId } : {}),
      ...(typeof body.draft === 'string' ? { draft: body.draft } : {}),
      who: 'dashboard',
    })
    sendJson(res, 200, result)
  }))

  route(ctx, 'exact', `${API_PREFIX}/reviews`, wrap(async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    const url = new URL(req.url ?? '/', 'http://localhost')
    const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1)
    sendJson(res, 200, reviewListPayload(store, page))
  }))

  route(ctx, 'prefix', `${API_PREFIX}/reviews/`, wrap(async (req, res) => {
    const rest = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(`${API_PREFIX}/reviews/`.length))
    const parts = rest.split('/').filter(Boolean)
    const reviewId = parts[0]
    if (!reviewId) return sendError(res, 404, 'NOT_FOUND', '审查记录不存在')

    if (req.method === 'GET' && parts.length === 1) return sendJson(res, 200, reviewDetailPayload(store, reviewId))

    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST')

    if (parts.length === 3 && parts[1] === 'issues') {
      const issueId = parts[2]!
      const body = await readJson(req, res)
      if (!body) return
      const action = body.action
      if (action !== 'adopt' && action !== 'reject' && action !== 'rewrite') {
        return sendError(res, 400, 'BAD_ACTION', 'action 必须是 adopt / reject / rewrite')
      }
      if (action === 'rewrite' && typeof body.text !== 'string') return sendError(res, 400, 'BAD_TEXT', 'rewrite 需要 text')
      const result = await store.decide(reviewId, {
        action,
        issueId,
        ...(typeof body.text === 'string' ? { text: body.text } : {}),
        ...(typeof body.reason === 'string' ? { reason: body.reason } : {}),
      })
      return sendJson(res, 200, result)
    }

    if (parts.length === 2 && parts[1] === 'reviewer') {
      const body = await readJson(req, res)
      if (!body) return
      if (typeof body.reviewer !== 'string' || body.reviewer.trim().length === 0) {
        return sendError(res, 400, 'BAD_REVIEWER', 'reviewer 不能为空')
      }
      const result = await store.decide(reviewId, { action: 'set_reviewer', reviewer: body.reviewer.trim() })
      return sendJson(res, 200, result)
    }

    if (parts.length === 2 && parts[1] === 'final-verdict') {
      const body = await readJson(req, res)
      if (!body) return
      if (typeof body.finalVerdict !== 'string' || !VERDICTS.has(body.finalVerdict)) {
        return sendError(res, 400, 'BAD_VERDICT', 'finalVerdict 必须是 通过 / 建议整改 / 不通过')
      }
      const result = await store.decide(reviewId, { action: 'set_final_verdict', finalVerdict: body.finalVerdict as Verdict })
      return sendJson(res, 200, result)
    }

    sendError(res, 404, 'NOT_FOUND', '未知的审查子资源')
  }))

  route(ctx, 'exact', `${API_PREFIX}/memory`, wrap(async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    sendJson(res, 200, store.dashboardMemory())
  }))

  route(ctx, 'exact', `${API_PREFIX}/eval-runs`, wrap(async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    const url = new URL(req.url ?? '/', 'http://localhost')
    const raw = url.searchParams.get('ids')
    const all = store.dashboardEvalRuns()
    if (raw === null) return sendJson(res, 200, { runs: all })
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (ids.length < 2 || ids.length > 7) return sendError(res, 400, 'BAD_COMPARE', '评测对比需要 2–7 个 run id')
    const runs = all.filter((run) => ids.includes(run.runId))
    if (runs.length !== ids.length) return sendError(res, 404, 'EVAL_RUN_NOT_FOUND', '至少一个 run id 不存在')
    sendJson(res, 200, { runs })
  }))
}
