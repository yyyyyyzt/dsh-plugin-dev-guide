// Judge abstraction (evaluation.md §5.1): the semantic decision on hybrid candidates, pluggable for offline runs.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { gate } from '../engine/gate.js'
import { normalize } from '../engine/normalize.js'
import type { Doc, Evidence, GateReason, HybridCandidate, Rule, RulePack, Severity, Snippet, Verdict } from '../engine/types.js'
import { DIRECT_SYSTEM, directUser, JUDGE_SYSTEM, judgeUser, POLICY_SYSTEM, policyUser } from './prompts.js'

export interface JudgeInput {
  solutionId: string
  rule: Rule
  snippet: Snippet
}

export interface JudgeOutput {
  issue: boolean
  quote?: string
  finding?: string
}

export interface DirectInput {
  solutionId: string
  markdown: string
  rules: Rule[]
}

export interface DirectOutput {
  issues: { ruleId: string; quote?: string; finding?: string }[]
  verdict?: Verdict
}

export interface PolicyInput {
  solutionId: string
  issues: { ruleId: string; severity: Severity; finding: string }[]
}

export type MaybePromise<T> = T | Promise<T>

export interface Judge {
  id: string
  model: string
  judge(input: JudgeInput): MaybePromise<JudgeOutput>
  /** Whole-document review (B1). Absent on deterministic judges. */
  direct?(input: DirectInput): Promise<DirectOutput>
  /** Verdict from a one-line model call over a fixed issue list (S-policy). */
  policy?(input: PolicyInput): Promise<Verdict | undefined>
}

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

/** Supplied by the runner (e.g. a DSH `ctx.llm` wrapper); the plugin ships no model client. */
export interface Adapter {
  model: string
  complete(messages: ChatMessage[], opts: { temperature: number }): Promise<string>
}

// ---------- flag judge (deterministic) ----------

const TRAILING_PLACEHOLDER = /[:：]\s*(待定|tbd|n\/a|\/|无|略|-|—|暂无|见图|如图)$/iu

export function isTrailingPlaceholder(quote: string): boolean {
  return TRAILING_PLACEHOLDER.test(normalize(quote).trim())
}

export const flagJudge: Judge = {
  id: 'flag',
  model: 'none',
  judge({ snippet, rule }) {
    const flags = snippet.flags ?? []
    const hit = flags.includes('negated') || flags.includes('assertion-only') || flags.includes('placeholder') || isTrailingPlaceholder(snippet.quote)
    if (!hit) return { issue: false }
    const why = flags.length ? flags.join('/') : 'trailing-placeholder'
    return { issue: true, quote: snippet.quote, finding: `${rule.title}：候选片段带 ${why} 标记` }
  },
}

// ---------- replay judge ----------

export function snippetKey(solutionId: string, ruleId: string, quote: string): string {
  const h = createHash('sha256').update(normalize(quote)).digest('hex').slice(0, 16)
  return `${solutionId}/${ruleId}/${h}`
}

export function replayJudge(records: Record<string, JudgeOutput>, model = 'replay'): Judge {
  return {
    id: 'replay',
    model,
    judge({ solutionId, rule, snippet }) {
      const key = snippetKey(solutionId, rule.id, snippet.quote)
      const hit = records[key]
      if (!hit) throw new Error(`replay judge: no record for ${key}`)
      return hit
    },
  }
}

export function recordingJudge(inner: Judge, sink: Record<string, JudgeOutput>): Judge {
  return {
    ...inner,
    async judge(input) {
      const out = await inner.judge(input)
      sink[snippetKey(input.solutionId, input.rule.id, input.snippet.quote)] = out
      return out
    },
  }
}

// ---------- llm judge (adapter-backed) ----------

const JudgeOutputSchema = z.object({ issue: z.boolean().optional(), quote: z.string().optional(), finding: z.string().optional(), verdict: z.string().optional() })
const DirectOutputSchema = z.object({
  issues: z.array(z.object({ ruleId: z.string(), quote: z.string().optional(), finding: z.string().optional() })).optional(),
  verdict: z.string().optional(),
})

const VERDICTS: Verdict[] = ['通过', '建议整改', '不通过']
const asVerdict = (v: string | undefined): Verdict | undefined => (v && (VERDICTS as string[]).includes(v) ? (v as Verdict) : undefined)

export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('llm judge: response is not JSON')
  }
}

export function llmJudge(adapter: Adapter): Judge {
  const temperature = 0
  return {
    id: 'llm',
    model: adapter.model,
    async judge({ rule, snippet }) {
      const text = await adapter.complete(
        [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content: judgeUser(rule, snippet.quote, snippet.sectionPath) },
        ],
        { temperature },
      )
      const parsed = JudgeOutputSchema.parse(extractJson(text))
      const out: JudgeOutput = { issue: parsed.issue === true }
      if (parsed.quote !== undefined) out.quote = parsed.quote
      if (parsed.finding !== undefined) out.finding = parsed.finding
      return out
    },
    async direct({ markdown, rules }) {
      const text = await adapter.complete(
        [
          { role: 'system', content: DIRECT_SYSTEM },
          { role: 'user', content: directUser(markdown, rules) },
        ],
        { temperature },
      )
      const parsed = DirectOutputSchema.parse(extractJson(text))
      const out: DirectOutput = {
        issues: (parsed.issues ?? []).map((i) => {
          const issue: DirectOutput['issues'][number] = { ruleId: i.ruleId }
          if (i.quote !== undefined) issue.quote = i.quote
          if (i.finding !== undefined) issue.finding = i.finding
          return issue
        }),
      }
      const v = asVerdict(parsed.verdict)
      if (v) out.verdict = v
      return out
    },
    async policy({ issues }) {
      const text = await adapter.complete(
        [
          { role: 'system', content: POLICY_SYSTEM },
          { role: 'user', content: policyUser(issues) },
        ],
        { temperature },
      )
      return asVerdict(JudgeOutputSchema.parse(extractJson(text)).verdict)
    },
  }
}

// ---------- candidate judging + gate ----------

export interface JudgedIssue {
  ruleId: string
  severity: Severity
  tier: 'hybrid'
  quote: string
  finding: string
  evidence: Evidence[]
  gatePassed: boolean
}

export interface JudgeRun {
  issues: JudgedIssue[]
  /** LLM submissions rejected by the gate (one per rule at most). */
  rejected: { ruleId: string; reasons: GateReason[] }[]
  submitted: number
  evaluated: number
}

export interface JudgeOptions {
  solutionId?: string
  gate?: boolean
}

function isPromise<T>(v: MaybePromise<T>): v is Promise<T> {
  return typeof (v as Promise<T>)?.then === 'function'
}

function settle(doc: Doc, rule: Rule, candidate: HybridCandidate, out: JudgeOutput, useGate: boolean, run: JudgeRun): boolean {
  if (!out.issue) return false
  run.submitted += 1
  const quote = out.quote ?? ''
  const finding = out.finding ?? `${rule.title}：${rule.question}`
  if (!useGate) {
    run.issues.push({ ruleId: rule.id, severity: rule.severity, tier: 'hybrid', quote, finding, evidence: [{ quote, kind: 'text' }], gatePassed: true })
    return true
  }
  const g = gate(doc, rule, [{ quote }], candidate.snippets)
  if (g.passed) {
    run.issues.push({ ruleId: rule.id, severity: rule.severity, tier: 'hybrid', quote, finding, evidence: g.resolved, gatePassed: true })
    return true
  }
  run.rejected.push({ ruleId: rule.id, reasons: g.reasons })
  return true
}

/** Synchronous variant for deterministic judges (self-check, tests). */
export function judgeCandidates(doc: Doc, candidates: HybridCandidate[], pack: RulePack, judge: Judge, opts: JudgeOptions = {}): JudgeRun {
  const run: JudgeRun = { issues: [], rejected: [], submitted: 0, evaluated: 0 }
  const useGate = opts.gate ?? true
  const solutionId = opts.solutionId ?? doc.hash
  for (const c of candidates) {
    const rule = pack.rules.find((r) => r.id === c.ruleId)
    if (!rule) continue
    for (const snippet of c.snippets) {
      run.evaluated += 1
      const out = judge.judge({ solutionId, rule, snippet })
      if (isPromise(out)) throw new Error('judgeCandidates: async judge requires judgeCandidatesAsync')
      if (settle(doc, rule, c, out, useGate, run)) break
    }
  }
  return run
}

export async function judgeCandidatesAsync(doc: Doc, candidates: HybridCandidate[], pack: RulePack, judge: Judge, opts: JudgeOptions = {}): Promise<JudgeRun> {
  const run: JudgeRun = { issues: [], rejected: [], submitted: 0, evaluated: 0 }
  const useGate = opts.gate ?? true
  const solutionId = opts.solutionId ?? doc.hash
  for (const c of candidates) {
    const rule = pack.rules.find((r) => r.id === c.ruleId)
    if (!rule) continue
    for (const snippet of c.snippets) {
      run.evaluated += 1
      const out = await judge.judge({ solutionId, rule, snippet })
      if (settle(doc, rule, c, out, useGate, run)) break
    }
  }
  return run
}
