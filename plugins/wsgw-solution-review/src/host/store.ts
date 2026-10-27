// ReviewStore: the one owner of the `wsgw_solution_review` domain handle. Pure engine functions do the
// judging; this class only sequences reads/writes (design.md §7–§8, review-protocol.md §3, §5).
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import {
  candidatesFrom,
  check as runCheck,
  computeVerdict,
  gate,
  HardRuleVerifierOwnedError,
  mergeRules,
  opinionFileName,
  parseMarkdown,
  parseRuleDraft,
  recall,
  renderOpinion,
  RulePackError,
  trimExemplars,
} from '../engine/index.js'
import { flattenHeadings } from '../engine/parse/markdown.js'
import type {
  ChecklistEntry,
  Dimension,
  Doc,
  Evidence,
  Feedback,
  HybridCandidate,
  Issue,
  Lexicon,
  MemoryRecall,
  Rule,
  RuleAudit,
  RulePack,
  RuleStats,
  Severity,
  Tier,
  Verdict,
} from '../engine/types.js'
import {
  candidateKey,
  exemplarKey,
  feedbackKey,
  issueKey,
  newReviewId,
  type ExemplarRecord,
  type IssueRecord,
  type ReviewDomain,
  type EvalRunRecord,
  type ReviewRecord,
  type RuleCandidateRecord,
  type RuleOverrideRecord,
} from '../store/domain.js'
import type { ReviewConfig } from './config.js'
import { ReviewToolError } from './errors.js'
import type { RulePackLoadError } from './rules-loader.js'

export interface StoreDeps {
  now?: () => Date
  randomId?: () => string
}

/** Writes the rendered opinion and returns the path to report back (display path from ctx.fs). */
export type OpinionSink = (fileName: string, content: string) => Promise<string>

export interface ParseInput {
  source: string
  title?: string | undefined
  sourcePath?: string | undefined
  reuse?: boolean | undefined
}

export interface ParseResult {
  reviewId: string
  title: string
  outline: { path: string; text: string; depth: number }[]
  stats: Doc['stats']
  warnings: string[]
  existingReviewId?: string
}

export interface CheckResult {
  hardIssues: IssueRecord[]
  hybridCandidates: HybridCandidate[]
  softRules: { ruleId: string; title: string; question: string }[]
  checklist: ChecklistEntry[]
  aiVerdict: Verdict
  basis: string
}

export interface RecordIssueInput {
  ruleId?: string | undefined
  severity?: Severity | undefined
  finding: string
  suggestion: string
  evidence: { quote: string; sectionPath?: string | undefined }[]
}

export interface RecordIssueResult {
  issueId: string
  status: Issue['status']
  gate: Issue['gate']
  resolvedEvidence: Evidence[]
}

export interface StatusResult {
  reviewId: string
  title: string
  status: ReviewRecord['status']
  reviewer?: string
  aiVerdict: Verdict
  basis: string
  summary: string
  finalVerdict?: Verdict
  issues: IssueRecord[]
  checklist: ChecklistEntry[]
  counts: {
    blocker: number
    major: number
    minor: number
    pending: number
    confirmed: number
    adopted: number
    rejected: number
    rewritten: number
    expert: number
  }
  checklistCounts: Record<ChecklistEntry['status'], number>
}

export type DecideAction = 'adopt' | 'reject' | 'rewrite' | 'add' | 'adopt_rest' | 'set_reviewer' | 'set_final_verdict'

export interface DecideInput {
  action?: DecideAction | undefined
  answer?: string | undefined
  issueId?: string | undefined
  text?: string | undefined
  reason?: string | undefined
  ruleId?: string | undefined
  severity?: Severity | undefined
  finalVerdict?: Verdict | undefined
  reviewer?: string | undefined
}

export interface DecideResult {
  ok: true
  action: DecideAction
  issue?: IssueRecord
  affected?: string[]
  /** adopt_rest only: pending issues left for one-by-one confirmation. */
  remainingPending?: string[]
  aiVerdict: Verdict
  finalVerdict?: Verdict
  reviewer?: string
  status: ReviewRecord['status']
  /** True when an earlier opinion file exists but decisions changed since (status went back to open). */
  needsRefinalize: boolean
}

export interface FinalizeResult {
  opinionPath: string
  version: number
  counts: { adopt: number; reject: number; rewrite: number; add: number }
  memory: { exemplars: number; candidates: number }
}

export interface RuleView {
  ruleId: string
  title: string
  dimension: Dimension
  tier: Tier
  severity: Severity
  status: Rule['status']
  question: string
  suggestion: string
  stats: RuleStats
  overridden: boolean
}

export interface RuleDetail {
  question: string
  rationale: string
  suggestion: string
  applicability: Rule['applicability']
  verifier: Rule['verifier']
  provenance: Rule['provenance']
  shipped?: { severity: Severity; status: Rule['status'] }
  override?: Partial<Pick<RuleOverrideRecord, 'status' | 'severity' | 'suggestion' | 'params'>>
  audit: RuleAudit[]
  memory: MemoryRecall
}

export interface RuleDetailPayload {
  rule: RuleView
  detail: RuleDetail
}

export interface RulesListFilter {
  dimension?: Dimension | undefined
  tier?: Tier | undefined
  status?: Rule['status'] | undefined
}

export interface SlidingAdoptPoint {
  reviewId: string
  at: string
  adopted: number
  rejected: number
  rewritten: number
  /** adopted / (adopted + rejected + rewritten), or null when nothing was decided. */
  rate: number | null
}

export interface DashboardMemoryRule {
  ruleId: string
  title: string
  dimension: Dimension
  stats: RuleStats & { rejectRatio: number }
  warn: boolean
  exemplars: MemoryRecall['exemplars']
  recentRejectReasons: string[]
  /** Up to the last five finalized reviews containing this rule, oldest first. */
  series: SlidingAdoptPoint[]
}

export interface DashboardMemory {
  rules: DashboardMemoryRule[]
  candidates: (RuleCandidateRecord & { candidateId: string })[]
  totals: { exemplars: number; candidates: number; feedback: number }
}

export interface DashboardEvalRun extends EvalRunRecord {
  runId: string
}

export type ProposeAction = 'disable' | 'enable' | 'set_severity' | 'set_param' | 'draft' | 'accept_draft' | 'dismiss'

export interface ProposeInput {
  action: ProposeAction
  ruleId?: string | undefined
  severity?: Severity | undefined
  param?: { key: string; value: unknown } | undefined
  candidateId?: string | undefined
  draft?: string | undefined
  who?: string | undefined
  reviewId?: string | undefined
}

export interface ProposeResult {
  ok: true
  action: ProposeAction
  rule?: RuleView
  candidate?: RuleCandidateRecord & { candidateId: string }
  warnings: string[]
}

export interface EffectiveRules {
  rules: Rule[]
  lexicon: Lexicon
  warnings: string[]
  version: string
}

const SEVERITIES: readonly Severity[] = ['blocker', 'major', 'minor']
const VERDICTS: readonly Verdict[] = ['通过', '建议整改', '不通过']
const emptyStats = (): RuleStats => ({ shown: 0, adopt: 0, reject: 0, rewrite: 0 })

const defaultRandomId = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

const ADOPT_EXACT = ['是', '是的', '对', '通过']
const ADOPT_LEADS = ['确认为问题', '采纳', '同意']
const REJECT_EXACT = ['否']
const REJECT_LEADS = ['不是问题', '不成立', '不需要', '驳回', '不对']
const LEAD_PUNCT = /^[，,。.；;：:！!、\s]+/u
const REWRITE_PREFIX = /^(?:改成|改为|换成|写成|建议写成|措辞换成|建议改为|换个说法)\s*[:：]\s*(.+)$/su

/** Text after a lead word that is followed by punctuation (or nothing); undefined when no lead matches. */
function afterLead(text: string, leads: readonly string[]): string | undefined {
  for (const lead of leads) {
    if (text === lead) return ''
    if (text.startsWith(lead) && LEAD_PUNCT.test(text.slice(lead.length))) return text.slice(lead.length).replace(LEAD_PUNCT, '').trim()
  }
  return undefined
}

/**
 * Expert free text → decision (review-protocol.md §5, design.md §8). A decision word only counts when it
 * stands alone or is followed by punctuation, so 「不对外开放…」 stays a rewrite.
 */
export function normalizeAnswer(answer: string): { action: 'adopt' | 'reject' | 'rewrite'; text?: string; reason?: string } {
  const t = answer.trim().replace(/[（(]推荐[)）]$/u, '').trim()
  const rewriteOf = (s: string): string | undefined => REWRITE_PREFIX.exec(s)?.[1]?.trim() || undefined
  const direct = rewriteOf(t)
  if (direct) return { action: 'rewrite', text: direct }
  if (ADOPT_EXACT.includes(t)) return { action: 'adopt' }
  if (REJECT_EXACT.includes(t)) return { action: 'reject' }
  const adoptTail = afterLead(t, ADOPT_LEADS)
  if (adoptTail !== undefined) {
    const amended = rewriteOf(adoptTail.replace(/^(?:但是|但|不过)\s*/u, ''))
    return amended ? { action: 'rewrite', text: amended } : { action: 'adopt' }
  }
  const rejectTail = afterLead(t, REJECT_LEADS)
  if (rejectTail !== undefined) return rejectTail ? { action: 'reject', reason: rejectTail } : { action: 'reject' }
  return { action: 'rewrite', text: t }
}

/** A row that changes the rule (as opposed to one finalize created only to hold stats). */
function isRealOverride(rec: RuleOverrideRecord): boolean {
  return rec.status !== undefined
    || rec.severity !== undefined
    || rec.suggestion !== undefined
    || rec.draft !== undefined
    || (rec.params !== undefined && Object.keys(rec.params).length > 0)
}

export class ReviewStore {
  private readonly now: () => Date
  private readonly randomId: () => string
  private readonly docCache = new Map<string, Doc>()

  constructor(
    readonly domain: Domain<ReviewDomain>,
    readonly config: ReviewConfig,
    readonly packs: RulePack[],
    deps: StoreDeps = {},
    readonly loadErrors: RulePackLoadError[] = [],
  ) {
    this.now = deps.now ?? (() => new Date())
    this.randomId = deps.randomId ?? defaultRandomId
  }

  // ---------- rules ----------

  effectiveRules(): EffectiveRules {
    const shipped = this.packs.flatMap((p) => p.rules)
    const overrides = [...this.domain.table('rule_overrides').entries()].map(([, v]) => v)
    const { rules, warnings } = mergeRules(shipped, overrides)
    const lexicon = this.lexicon()
    const base = this.packs.map((p) => `${p.pack.id}@${p.pack.version}`).join('+') || 'none'
    const real = overrides.filter(isRealOverride).length
    const version = real ? `${base}+ov${real}` : base
    return { rules, lexicon, warnings, version }
  }

  lexicon(): Lexicon {
    const out: Lexicon = { headings: {}, placeholders: [], negations: [], families: {} }
    for (const p of this.packs) {
      for (const [k, v] of Object.entries(p.lexicon.headings)) out.headings[k] = [...new Set([...(out.headings[k] ?? []), ...v])]
      for (const [k, v] of Object.entries(p.lexicon.families)) out.families[k] = [...new Set([...(out.families[k] ?? []), ...v])]
      out.placeholders = [...new Set([...out.placeholders, ...p.lexicon.placeholders])]
      out.negations = [...new Set([...out.negations, ...p.lexicon.negations])]
    }
    return out
  }

  rulesList(filter: RulesListFilter): { rules: RuleView[]; warnings: string[]; loadErrors: RulePackLoadError[] } {
    const { rules, warnings } = this.effectiveRules()
    const overrides = this.domain.table('rule_overrides')
    const views = rules
      .filter((r) => (filter.dimension ? r.dimension === filter.dimension : true))
      .filter((r) => (filter.tier ? r.tier === filter.tier : true))
      .filter((r) => (filter.status ? r.status === filter.status : true))
      .map((r) => this.ruleView(r, overrides.get(r.id)))
    return { rules: views, warnings, loadErrors: this.loadErrors }
  }

  private ruleView(rule: Rule, override: RuleOverrideRecord | undefined): RuleView {
    return {
      ruleId: rule.id,
      title: rule.title,
      dimension: rule.dimension,
      tier: rule.tier,
      severity: rule.severity,
      status: rule.status,
      question: rule.question,
      suggestion: rule.suggestion,
      stats: override?.stats ?? emptyStats(),
      overridden: override !== undefined && isRealOverride(override),
    }
  }

  ruleDetail(ruleId: string): RuleDetailPayload {
    const rule = this.requireRule(ruleId)
    const record = this.domain.table('rule_overrides').get(ruleId)
    const shipped = this.packs.flatMap((p) => p.rules).find((r) => r.id === ruleId)
    const override: NonNullable<RuleDetail['override']> = {}
    if (record?.status !== undefined) override.status = record.status
    if (record?.severity !== undefined) override.severity = record.severity
    if (record?.suggestion !== undefined) override.suggestion = record.suggestion
    if (record?.params !== undefined && Object.keys(record.params).length > 0) override.params = record.params
    const { ruleId: _id, title: _title, ...memory } = this.memoryRecall(ruleId)
    const detail: RuleDetail = {
      question: rule.question,
      rationale: rule.rationale,
      suggestion: rule.suggestion,
      applicability: rule.applicability,
      verifier: rule.verifier,
      provenance: rule.provenance,
      ...(shipped ? { shipped: { severity: shipped.severity, status: shipped.status } } : {}),
      ...(Object.keys(override).length > 0 ? { override } : {}),
      audit: (record?.audit ?? []).slice(-10),
      memory,
    }
    return { rule: this.ruleView(rule, record), detail }
  }

  private findRule(ruleId: string): Rule | undefined {
    return this.effectiveRules().rules.find((r) => r.id === ruleId)
  }

  private requireRule(ruleId: string): Rule {
    const rule = this.findRule(ruleId)
    if (!rule) throw new ReviewToolError('RULE_NOT_FOUND', `规则 ${ruleId} 不存在；请先用 rules_list 查询有效规则`)
    return rule
  }

  async rulesPropose(input: ProposeInput): Promise<ProposeResult> {
    const who = input.who?.trim() || 'agent'
    const at = this.now().toISOString()
    const overrides = this.domain.table('rule_overrides')
    const candidates = this.domain.table('rule_candidates')

    const audit = (field: string, from: unknown, to: unknown) => ({
      who,
      at,
      ...(input.reviewId ? { reviewId: input.reviewId } : {}),
      change: { field, from, to },
    })
    const upsert = async (ruleId: string, mutate: (rec: RuleOverrideRecord) => void): Promise<RuleOverrideRecord> => {
      const current = overrides.get(ruleId)
      const next: RuleOverrideRecord = current
        ? structuredClone(current)
        : { ruleId, stats: emptyStats(), audit: [] }
      mutate(next)
      await overrides.put(ruleId, next)
      return next
    }
    const requireId = (): string => {
      if (!input.ruleId) throw new ReviewToolError('BAD_ACTION', `rules_propose(${input.action}) 需要 ruleId`)
      return input.ruleId
    }
    const view = (ruleId: string): RuleView => {
      const rule = this.requireRule(ruleId)
      return this.ruleView(rule, overrides.get(ruleId))
    }
    const warnings: string[] = []

    switch (input.action) {
      case 'disable':
      case 'enable': {
        const ruleId = requireId()
        const rule = this.requireRule(ruleId)
        const to = input.action === 'disable' ? 'retired' : 'active'
        await upsert(ruleId, (rec) => {
          rec.audit.push(audit('status', rule.status, to))
          rec.status = to
          if (rec.draft) rec.draft.status = to
        })
        return { ok: true, action: input.action, rule: view(ruleId), warnings }
      }
      case 'set_severity': {
        const ruleId = requireId()
        const rule = this.requireRule(ruleId)
        if (!input.severity || !SEVERITIES.includes(input.severity)) {
          throw new ReviewToolError('BAD_ACTION', 'set_severity 需要 severity ∈ blocker|major|minor')
        }
        const severity = input.severity
        await upsert(ruleId, (rec) => {
          rec.audit.push(audit('severity', rule.severity, severity))
          rec.severity = severity
          if (rec.draft) rec.draft.severity = severity
        })
        return { ok: true, action: input.action, rule: view(ruleId), warnings }
      }
      case 'set_param': {
        const ruleId = requireId()
        this.requireRule(ruleId)
        const param = input.param
        if (!param || typeof param.key !== 'string' || !param.key) {
          throw new ReviewToolError('BAD_ACTION', 'set_param 需要 param: { key, value }')
        }
        await upsert(ruleId, (rec) => {
          const params = (rec.params ?? {}) as Record<string, unknown>
          rec.audit.push(audit(`params.${param.key}`, params[param.key], param.value))
          params[param.key] = param.value
          rec.params = params as NonNullable<RuleOverrideRecord['params']>
        })
        warnings.push(...this.effectiveRules().warnings.filter((w) => w.startsWith(`${ruleId}:`)))
        return { ok: true, action: input.action, rule: view(ruleId), warnings }
      }
      case 'draft': {
        if (!input.draft?.trim()) throw new ReviewToolError('BAD_DRAFT', 'draft 需要规则 YAML 文本')
        let rule: Rule
        try {
          rule = parseRuleDraft(input.draft, this.lexicon())
        } catch (e) {
          if (e instanceof RulePackError) throw new ReviewToolError('BAD_DRAFT', `规则草稿不合法（${e.field ?? 'rule'}）：${e.message}`)
          throw e
        }
        if (this.packs.some((p) => p.rules.some((r) => r.id === rule.id))) {
          throw new ReviewToolError('BAD_DRAFT', `规则号 ${rule.id} 已被 shipped 规则占用`)
        }
        rule.status = 'draft'
        await upsert(rule.id, (rec) => {
          rec.audit.push(audit('draft', rec.draft?.id, rule.id))
          rec.draft = rule
          rec.status = 'draft'
        })
        if (input.candidateId) {
          const cand = this.requireCandidate(input.candidateId)
          await candidates.put(input.candidateId, { ...cand, status: 'drafted', draftRuleId: rule.id })
        }
        return { ok: true, action: input.action, rule: view(rule.id), warnings }
      }
      case 'accept_draft': {
        const ruleId = requireId()
        const current = overrides.get(ruleId)
        if (!current?.draft) throw new ReviewToolError('RULE_NOT_FOUND', `规则 ${ruleId} 没有待接受的草稿`)
        await upsert(ruleId, (rec) => {
          rec.audit.push(audit('status', 'draft', 'active'))
          rec.status = 'active'
          rec.draft!.status = 'active'
        })
        const candidateId = input.candidateId ?? [...candidates.entries()].find(([, c]) => c.draftRuleId === ruleId)?.[0]
        if (candidateId) {
          const cand = this.requireCandidate(candidateId)
          await candidates.put(candidateId, { ...cand, status: 'accepted', draftRuleId: ruleId })
        }
        return { ok: true, action: input.action, rule: view(ruleId), warnings }
      }
      case 'dismiss': {
        if (!input.candidateId) throw new ReviewToolError('BAD_ACTION', 'dismiss 需要 candidateId')
        const cand = this.requireCandidate(input.candidateId)
        const next = { ...cand, status: 'dismissed' as const }
        await candidates.put(input.candidateId, next)
        return { ok: true, action: input.action, candidate: { ...next, candidateId: input.candidateId }, warnings }
      }
      default:
        throw new ReviewToolError('BAD_ACTION', `未知 rules_propose action: ${String(input.action)}`)
    }
  }

  private requireCandidate(candidateId: string): RuleCandidateRecord {
    const cand = this.domain.table('rule_candidates').get(candidateId)
    if (!cand) throw new ReviewToolError('CANDIDATE_NOT_FOUND', `候选规则 ${candidateId} 不存在`)
    return cand
  }

  // ---------- memory ----------

  memoryRecall(ruleId: string): MemoryRecall & { ruleId: string; title: string } {
    const rule = this.requireRule(ruleId)
    const stats = this.domain.table('rule_overrides').get(ruleId)?.stats
    const exemplars = [...this.domain.table('exemplars').entries()].map(([, e]) => e)
    const feedback = [...this.domain.table('feedback').entries()].map(([, f]) => f)
    const out = recall(ruleId, stats, exemplars, feedback, this.config)
    return { ruleId, title: rule.title, ...out }
  }

  memoryRecallByDimension(dimension: Dimension): { dimension: Dimension; rules: (MemoryRecall & { ruleId: string; title: string })[] } {
    const rules = this.effectiveRules().rules.filter((r) => r.dimension === dimension)
    return { dimension, rules: rules.map((r) => this.memoryRecall(r.id)) }
  }

  /** Read model for the dashboard memory page: per-rule recall + last-five adopt series + candidates. */
  dashboardMemory(): DashboardMemory {
    const finalized = this.listReviews()
      .filter((r) => r.status === 'finalized')
      .sort((a, b) => ((a.metrics.finalizedAt ?? a.createdAt) < (b.metrics.finalizedAt ?? b.createdAt) ? -1 : 1))
    const rules = this.effectiveRules().rules.map((rule) => {
      const recall = this.memoryRecall(rule.id)
      const series: SlidingAdoptPoint[] = []
      for (const review of finalized) {
        const issues = this.issuesOf(review.reviewId).filter((i) => i.ruleId === rule.id)
        if (issues.length === 0) continue
        const adopted = issues.filter((i) => i.status === 'adopted').length
        const rejected = issues.filter((i) => i.status === 'rejected').length
        const rewritten = issues.filter((i) => i.status === 'rewritten').length
        const decided = adopted + rejected + rewritten
        series.push({
          reviewId: review.reviewId,
          at: review.metrics.finalizedAt ?? review.createdAt,
          adopted,
          rejected,
          rewritten,
          rate: decided === 0 ? null : adopted / decided,
        })
      }
      return {
        ruleId: rule.id,
        title: rule.title,
        dimension: rule.dimension,
        stats: recall.stats,
        warn: recall.warn,
        exemplars: recall.exemplars,
        recentRejectReasons: recall.recentRejectReasons,
        series: series.slice(-5),
      }
    })
    const candidates = [...this.domain.table('rule_candidates').entries()]
      .map(([candidateId, record]) => ({ ...record, candidateId }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
    return {
      rules,
      candidates,
      totals: {
        exemplars: this.domain.table('exemplars').size,
        candidates: candidates.length,
        feedback: this.domain.table('feedback').size,
      },
    }
  }

  // ---------- reviews ----------

  listReviews(): ReviewRecord[] {
    return [...this.domain.table('reviews').entries()].map(([, r]) => r).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  /** Read model for the dashboard evaluation page; the service filters the optional id set. */
  dashboardEvalRuns(): DashboardEvalRun[] {
    return [...this.domain.table('eval_runs').entries()]
      .map(([runId, record]) => ({ ...record, runId }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
  }

  requireReview(reviewId: string): ReviewRecord {
    const review = this.domain.table('reviews').get(reviewId)
    if (!review) throw new ReviewToolError('REVIEW_NOT_FOUND', `审查记录 ${reviewId} 不存在；请先 review_parse`)
    return review
  }

  issuesOf(reviewId: string): IssueRecord[] {
    return [...this.domain.table('issues').entries()]
      .map(([, i]) => i)
      .filter((i) => i.reviewId === reviewId)
      .sort((a, b) => a.seq - b.seq)
  }

  feedbackOf(reviewId: string): Feedback[] {
    return [...this.domain.table('feedback').entries()]
      .filter(([, f]) => f.reviewId === reviewId)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, f]) => f)
  }

  private docOf(review: ReviewRecord): Doc {
    const cached = this.docCache.get(review.docHash)
    if (cached) return cached
    const doc = parseMarkdown(review.source)
    if (this.docCache.size >= 8) this.docCache.delete(this.docCache.keys().next().value!)
    this.docCache.set(review.docHash, doc)
    return doc
  }

  private verdictOf(reviewId: string): { verdict: Verdict; basis: string; counts: { blocker: number; major: number; minor: number } } {
    return computeVerdict(this.issuesOf(reviewId), { minorThreshold: this.config.minorThreshold })
  }

  private async updateReview(reviewId: string, fn: (r: ReviewRecord) => void): Promise<ReviewRecord> {
    return this.domain.table('reviews').update(reviewId, (current) => {
      const next = structuredClone(current)
      fn(next)
      return next
    })
  }

  private async touch(reviewId: string, extra?: (r: ReviewRecord) => void): Promise<ReviewRecord> {
    const verdict = this.verdictOf(reviewId).verdict
    return this.updateReview(reviewId, (r) => {
      r.metrics.toolCalls += 1
      r.aiVerdict = verdict
      extra?.(r)
    })
  }

  private nextSeq(review: ReviewRecord): number {
    const issues = this.issuesOf(review.reviewId)
    const maxSeq = issues.reduce((m, i) => Math.max(m, i.seq), 0)
    return Math.max(review.nextSeq ?? 1, maxSeq + 1)
  }

  private static warningsOf(doc: Doc): string[] {
    const warnings: string[] = []
    const imageSeq =
      doc.images.some((img) => /时序/u.test(img.alt)) ||
      doc.blocks.some((b) => b.type === 'paragraph' && /时序图/u.test(b.text) && /图片|截图|图像/u.test(b.text))
    if (imageSeq) warnings.push('时序图为图片，无法校验：请以 Mermaid 时序图或文字步骤补充')
    if (doc.stats.headings === 0) warnings.push('方案没有任何标题，章节类规则将全部判为缺失')
    return warnings
  }

  async parse(input: ParseInput): Promise<ParseResult> {
    const bytes = Buffer.byteLength(input.source, 'utf8')
    if (bytes > this.config.maxSourceBytes) {
      throw new ReviewToolError(
        'SOURCE_TOO_LARGE',
        `方案 ${bytes} 字节，超过上限 ${this.config.maxSourceBytes} 字节；请拆分后再预审`,
      )
    }
    const doc = parseMarkdown(input.source)
    const title = input.title?.trim() || doc.title || '未命名方案'
    const outline = flattenHeadings(doc).map((h) => ({ path: h.path, text: h.text, depth: h.depth }))
    const warnings = ReviewStore.warningsOf(doc)
    const base = { title, outline, stats: doc.stats, warnings }

    const existing = this.listReviews().find((r) => r.docHash === doc.hash)
    if (existing && input.reuse !== false) {
      return { reviewId: existing.reviewId, existingReviewId: existing.reviewId, ...base, title: existing.title }
    }

    const reviews = this.domain.table('reviews')
    let reviewId = newReviewId(this.now(), this.randomId)
    while (reviews.get(reviewId)) reviewId = newReviewId(this.now(), this.randomId)
    const at = this.now().toISOString()
    const record: ReviewRecord = {
      reviewId,
      title,
      docHash: doc.hash,
      source: input.source,
      ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
      status: 'open',
      aiVerdict: '通过',
      versions: [],
      metrics: { startedAt: at, toolCalls: 1, gateRejects: 0 },
      createdAt: at,
      rulePackVersion: this.effectiveRules().version,
      warnings,
      nextSeq: 1,
    }
    await reviews.put(reviewId, record)
    this.docCache.set(doc.hash, doc)
    return { reviewId, ...base }
  }

  async check(reviewId: string): Promise<CheckResult> {
    const review = this.requireReview(reviewId)
    const decided = review.status === 'finalized'
      || review.versions.length > 0
      || review.finalVerdict !== undefined
      || this.feedbackOf(reviewId).length > 0
      || this.issuesOf(reviewId).some((i) => i.origin === 'expert')
    if (decided) {
      throw new ReviewToolError(
        'REVIEW_ALREADY_DECIDED',
        `审查 ${reviewId} 已有专家决定或已定稿，重跑预审会抹掉已复核的问题；方案未改请继续复核，方案已改请 review_parse(reuse: false) 开新记录`,
      )
    }
    const doc = this.docOf(review)
    const { rules, lexicon, version } = this.effectiveRules()
    const report = runCheck(doc, rules, lexicon)

    const issues = this.domain.table('issues')
    for (const old of this.issuesOf(reviewId)) {
      if (old.origin === 'verifier') await issues.delete(old.issueId)
    }
    let seq = this.nextSeq(review)
    const stored: IssueRecord[] = []
    for (const hard of report.hardIssues) {
      const issueId = issueKey(reviewId, seq)
      const record: IssueRecord = { ...hard, issueId, reviewId, seq }
      await issues.put(issueId, record)
      stored.push(record)
      seq += 1
    }

    const verdict = this.verdictOf(reviewId)
    await this.touch(reviewId, (r) => {
      r.nextSeq = seq
      r.rulePackVersion = version
      r.lastCheck = {
        at: this.now().toISOString(),
        checklist: report.checklist,
        hybridCandidates: report.hybridCandidates,
        softRules: report.softRules,
      }
    })
    return {
      hardIssues: stored,
      hybridCandidates: report.hybridCandidates,
      softRules: report.softRules,
      checklist: report.checklist,
      aiVerdict: verdict.verdict,
      basis: verdict.basis,
    }
  }

  async recordIssue(reviewId: string, input: RecordIssueInput): Promise<RecordIssueResult> {
    const review = this.requireReview(reviewId)
    const rule = input.ruleId ? this.requireRule(input.ruleId) : null
    if (rule?.tier === 'hard') {
      throw new ReviewToolError('HARD_RULE_VERIFIER_OWNED', `规则 ${rule.id} 为 hard 规则，其问题由校验器自动登记，不接受人工登记`)
    }
    const doc = this.docOf(review)
    const candidates = rule ? review.lastCheck?.hybridCandidates.find((c) => c.ruleId === rule.id)?.snippets : undefined
    const gateInputs = input.evidence.map((e) => ({
      quote: e.quote,
      ...(e.sectionPath ? { sectionPath: e.sectionPath } : {}),
    }))
    let result
    try {
      result = gate(doc, rule, gateInputs, candidates)
    } catch (e) {
      if (e instanceof HardRuleVerifierOwnedError) throw new ReviewToolError('HARD_RULE_VERIFIER_OWNED', e.message)
      throw e
    }
    const seq = this.nextSeq(review)
    const issueId = issueKey(reviewId, seq)
    const evidence: Evidence[] = result.passed
      ? result.resolved
      : input.evidence.map((e) => ({ quote: e.quote, ...(e.sectionPath ? { sectionPath: e.sectionPath } : {}), kind: 'text' as const }))
    const record: IssueRecord = {
      issueId,
      reviewId,
      ...(rule ? { ruleId: rule.id } : {}),
      severity: input.severity ?? rule?.severity ?? 'minor',
      tier: rule?.tier ?? 'soft',
      origin: 'llm',
      finding: input.finding,
      suggestion: input.suggestion,
      evidence,
      status: result.passed ? 'confirmed' : 'pending',
      gate: { passed: result.passed, reasons: result.reasons },
      seq,
    }
    await this.domain.table('issues').put(issueId, record)
    await this.touch(reviewId, (r) => {
      r.nextSeq = seq + 1
      if (!result.passed) r.metrics.gateRejects += 1
    })
    return { issueId, status: record.status, gate: record.gate, resolvedEvidence: result.resolved }
  }

  status(reviewId: string): StatusResult {
    const review = this.requireReview(reviewId)
    const issues = this.issuesOf(reviewId)
    const verdict = this.verdictOf(reviewId)
    const counts = {
      ...verdict.counts,
      pending: issues.filter((i) => i.status === 'pending').length,
      confirmed: issues.filter((i) => i.status === 'confirmed').length,
      adopted: issues.filter((i) => i.status === 'adopted').length,
      rejected: issues.filter((i) => i.status === 'rejected').length,
      rewritten: issues.filter((i) => i.status === 'rewritten').length,
      expert: issues.filter((i) => i.origin === 'expert').length,
    }
    const checklist = review.lastCheck?.checklist ?? []
    const checklistCounts: StatusResult['checklistCounts'] = {
      pass: 0, fail: 0, candidate: 0, pending: 0, 'not-applicable': 0, soft: 0, 'reviewed-no-issue': 0,
    }
    for (const c of checklist) checklistCounts[c.status] += 1
    const summary = `${verdict.verdict}——依据：${verdict.counts.blocker} 个 blocker / ${verdict.counts.major} 个 major / ${verdict.counts.minor} 个 minor；待人工 ${counts.pending} 项。仅为建议，待专家确认。`
    return {
      reviewId,
      title: review.title,
      status: review.status,
      ...(review.reviewer ? { reviewer: review.reviewer } : {}),
      aiVerdict: verdict.verdict,
      basis: verdict.basis,
      summary,
      ...(review.finalVerdict ? { finalVerdict: review.finalVerdict } : {}),
      issues,
      checklist,
      counts,
      checklistCounts,
    }
  }

  // ---------- decide ----------

  private async writeFeedback(review: ReviewRecord, issue: IssueRecord, action: Feedback['action'], extra: { reason?: string | undefined; text?: string | undefined }): Promise<void> {
    const table = this.domain.table('feedback')
    let n = 1
    while (table.get(feedbackKey(issue.issueId, n))) n += 1
    const row: Feedback = {
      reviewId: review.reviewId,
      issueId: issue.issueId,
      ...(issue.ruleId ? { ruleId: issue.ruleId } : {}),
      action,
      ...(extra.reason?.trim() ? { reason: extra.reason.trim() } : {}),
      ...(extra.text?.trim() ? { text: extra.text.trim() } : {}),
      ...(review.reviewer ? { reviewer: review.reviewer } : {}),
      at: this.now().toISOString(),
    }
    await table.put(feedbackKey(issue.issueId, n), row)
  }

  private requireIssue(reviewId: string, issueId: string | undefined): IssueRecord {
    if (!issueId) throw new ReviewToolError('BAD_ACTION', '该 action 需要 issueId')
    const issue = this.domain.table('issues').get(issueId)
    if (!issue || issue.reviewId !== reviewId) throw new ReviewToolError('ISSUE_NOT_FOUND', `问题 ${issueId} 不属于审查 ${reviewId}`)
    return issue
  }

  private async setIssueStatus(issue: IssueRecord, status: Issue['status'], rewriteText?: string): Promise<IssueRecord> {
    return this.domain.table('issues').update(issue.issueId, (current) => {
      const next = structuredClone(current)
      next.status = status
      if (rewriteText !== undefined) next.rewriteText = rewriteText
      return next
    })
  }

  async decide(reviewId: string, input: DecideInput): Promise<DecideResult> {
    const review = this.requireReview(reviewId)
    let action = input.action
    let text = input.text
    let reason = input.reason
    if (!action && input.answer !== undefined) {
      const normalized = normalizeAnswer(input.answer)
      action = normalized.action
      if (normalized.text !== undefined) text = normalized.text
      if (!reason?.trim() && normalized.reason) reason = normalized.reason
    }
    if (!action) throw new ReviewToolError('BAD_ACTION', 'review_decide 需要 action 或 answer')
    if (input.finalVerdict !== undefined && action !== 'set_final_verdict') {
      throw new ReviewToolError('FINAL_VERDICT_FORBIDDEN', '只有 review_decide(action: set_final_verdict) 可以写入最终结论')
    }

    const done = async (partial: Omit<DecideResult, 'ok' | 'action' | 'aiVerdict' | 'status' | 'needsRefinalize'>): Promise<DecideResult> => {
      const updated = await this.touch(reviewId, (r) => {
        if (r.status === 'finalized') r.status = 'open'
      })
      return {
        ok: true,
        action: action!,
        aiVerdict: updated.aiVerdict,
        ...(updated.finalVerdict ? { finalVerdict: updated.finalVerdict } : {}),
        ...(updated.reviewer ? { reviewer: updated.reviewer } : {}),
        status: updated.status,
        needsRefinalize: updated.status === 'open' && updated.versions.length > 0,
        ...partial,
      }
    }

    switch (action) {
      case 'adopt': {
        const issue = this.requireIssue(reviewId, input.issueId)
        const next = await this.setIssueStatus(issue, 'adopted')
        await this.writeFeedback(review, issue, 'adopt', {})
        return done({ issue: next })
      }
      case 'reject': {
        const issue = this.requireIssue(reviewId, input.issueId)
        const next = await this.setIssueStatus(issue, 'rejected')
        await this.writeFeedback(review, issue, 'reject', { reason })
        return done({ issue: next })
      }
      case 'rewrite': {
        const issue = this.requireIssue(reviewId, input.issueId)
        if (!text?.trim()) throw new ReviewToolError('BAD_ACTION', 'rewrite 需要 text（改写后的意见措辞）')
        const next = await this.setIssueStatus(issue, 'rewritten', text.trim())
        await this.writeFeedback(review, issue, 'rewrite', { text })
        return done({ issue: next })
      }
      case 'add': {
        if (!text?.trim()) throw new ReviewToolError('BAD_ACTION', 'add 需要 text（专家新增的意见）')
        const rule = input.ruleId ? this.requireRule(input.ruleId) : undefined
        const seq = this.nextSeq(review)
        const issueId = issueKey(reviewId, seq)
        const record: IssueRecord = {
          issueId,
          reviewId,
          ...(rule ? { ruleId: rule.id } : {}),
          severity: input.severity ?? rule?.severity ?? 'major',
          tier: 'expert',
          origin: 'expert',
          finding: text.trim(),
          suggestion: text.trim(),
          evidence: [],
          status: 'adopted',
          gate: { passed: true, reasons: [] },
          seq,
        }
        await this.domain.table('issues').put(issueId, record)
        await this.updateReview(reviewId, (r) => {
          r.nextSeq = seq + 1
        })
        return done({ issue: record })
      }
      case 'adopt_rest': {
        const affected: string[] = []
        const remainingPending: string[] = []
        for (const issue of this.issuesOf(reviewId)) {
          if (issue.status === 'pending') remainingPending.push(issue.issueId)
          if (issue.status !== 'confirmed') continue
          await this.setIssueStatus(issue, 'adopted')
          await this.writeFeedback(review, issue, 'adopt', {})
          affected.push(issue.issueId)
        }
        return done({ affected, remainingPending })
      }
      case 'set_reviewer': {
        const reviewer = input.reviewer?.trim()
        if (!reviewer) throw new ReviewToolError('BAD_ACTION', 'set_reviewer 需要 reviewer')
        await this.updateReview(reviewId, (r) => {
          r.reviewer = reviewer
        })
        return done({})
      }
      case 'set_final_verdict': {
        const finalVerdict = input.finalVerdict
        if (!finalVerdict || !VERDICTS.includes(finalVerdict)) {
          throw new ReviewToolError('BAD_ACTION', 'set_final_verdict 需要 finalVerdict ∈ 通过|建议整改|不通过')
        }
        const reviewer = review.reviewer?.trim() || input.reviewer?.trim() || this.config.defaultReviewer.trim()
        if (!reviewer) {
          throw new ReviewToolError('REVIEWER_REQUIRED', '写入最终结论前需要审核人署名：先 review_decide(action: set_reviewer)')
        }
        const ai = this.verdictOf(reviewId).verdict
        await this.updateReview(reviewId, (r) => {
          r.reviewer = reviewer
          r.finalVerdict = finalVerdict
          if (ai !== finalVerdict) r.verdictDelta = { ai, final: finalVerdict }
          else delete r.verdictDelta
        })
        return done({})
      }
      default:
        throw new ReviewToolError('BAD_ACTION', `未知 action: ${String(action)}`)
    }
  }

  // ---------- finalize ----------

  decisionCounts(reviewId: string): FinalizeResult['counts'] {
    const issues = this.issuesOf(reviewId)
    return {
      adopt: issues.filter((i) => i.status === 'adopted' && i.origin !== 'expert').length,
      reject: issues.filter((i) => i.status === 'rejected').length,
      rewrite: issues.filter((i) => i.status === 'rewritten').length,
      add: issues.filter((i) => i.origin === 'expert').length,
    }
  }

  async finalize(reviewId: string, sink: OpinionSink): Promise<FinalizeResult> {
    const review = this.requireReview(reviewId)
    if (!review.finalVerdict) {
      throw new ReviewToolError('VERDICT_NOT_SET', '尚未确认最终结论：请先完成复核并 review_decide(action: set_final_verdict)')
    }
    const reviewer = review.reviewer?.trim() || this.config.defaultReviewer.trim()
    if (!reviewer) throw new ReviewToolError('REVIEWER_REQUIRED', '定稿需要审核人署名')

    const issues = this.issuesOf(reviewId)
    const counts = this.decisionCounts(reviewId)
    const aiVerdictAtFinalize = this.verdictOf(reviewId).verdict
    const finalizedAt = this.now().toISOString()
    const version = review.versions.length + 1
    const content = renderOpinion({
      reviewId,
      title: review.title,
      reviewer,
      finalizedAt,
      finalVerdict: review.finalVerdict,
      aiVerdictAtFinalize,
      issues,
      counts,
    })

    // File first, then the record, then memory (design.md §12): a failed write leaves the domain untouched.
    const opinionPath = await sink(opinionFileName(reviewId, version), content)

    await this.updateReview(reviewId, (r) => {
      r.status = 'finalized'
      r.reviewer = reviewer
      r.aiVerdict = aiVerdictAtFinalize
      r.aiVerdictAtFinalize = aiVerdictAtFinalize
      r.opinionPath = opinionPath
      r.versions = [...r.versions, { version, path: opinionPath, at: finalizedAt }]
      r.metrics.finalizedAt = finalizedAt
      r.metrics.toolCalls += 1
    })

    const memory = await this.refreshMemory(reviewId, issues, finalizedAt)
    return { opinionPath, version, counts, memory }
  }

  /** Recompute memory tables from every finalized review, so repeated finalize runs are idempotent. */
  private async refreshMemory(reviewId: string, issues: IssueRecord[], at: string): Promise<FinalizeResult['memory']> {
    const exemplarsTable = this.domain.table('exemplars')
    const candidatesTable = this.domain.table('rule_candidates')
    const overridesTable = this.domain.table('rule_overrides')

    for (const issue of issues) {
      if (!issue.ruleId) continue
      if (issue.status !== 'adopted' && issue.status !== 'rewritten') continue
      const text = (issue.status === 'rewritten' ? issue.rewriteText?.trim() : undefined) || issue.suggestion.trim()
      if (!text) continue
      const key = exemplarKey(issue.ruleId, issue.issueId)
      const existing = exemplarsTable.get(key)
      const record: ExemplarRecord = {
        ruleId: issue.ruleId,
        kind: issue.status === 'rewritten' ? 'rewrite' : 'adopt',
        text,
        reviewId,
        at: existing?.at ?? at,
      }
      if (!existing || existing.text !== record.text || existing.kind !== record.kind) await exemplarsTable.put(key, record)
    }
    const all = [...exemplarsTable.entries()]
    const kept = new Set(trimExemplars(all.map(([, e]) => e), this.config.exemplarsPerRule))
    for (const [key, e] of all) if (!kept.has(e)) await exemplarsTable.delete(key)

    const existingByIssue = new Map([...candidatesTable.entries()].map(([k, c]) => [c.issueId, k]))
    let n = [...candidatesTable.keys()].filter((k) => k.startsWith(`rc_${reviewId}_`)).length
    for (const cand of candidatesFrom(issues)) {
      if (existingByIssue.has(cand.issueId)) continue
      n += 1
      const record: RuleCandidateRecord = {
        text: cand.text,
        ...(cand.suggestedDimension ? { suggestedDimension: cand.suggestedDimension } : {}),
        status: 'new',
        reviewId,
        issueId: cand.issueId,
        at,
      }
      await candidatesTable.put(candidateKey(reviewId, n), record)
    }

    const finalized = new Set(this.listReviews().filter((r) => r.status === 'finalized' || r.reviewId === reviewId).map((r) => r.reviewId))
    const stats = new Map<string, RuleStats>()
    for (const [, issue] of this.domain.table('issues').entries()) {
      if (!issue.ruleId || issue.origin === 'expert' || !finalized.has(issue.reviewId)) continue
      const s = stats.get(issue.ruleId) ?? emptyStats()
      s.shown += 1
      if (issue.status === 'adopted') s.adopt += 1
      else if (issue.status === 'rejected') s.reject += 1
      else if (issue.status === 'rewritten') s.rewrite += 1
      stats.set(issue.ruleId, s)
    }
    for (const [ruleId, s] of stats) {
      const current = overridesTable.get(ruleId)
      if (current && JSON.stringify(current.stats) === JSON.stringify(s)) continue
      await overridesTable.put(ruleId, current ? { ...current, stats: s } : { ruleId, stats: s, audit: [] })
    }

    return {
      exemplars: exemplarsTable.size,
      candidates: [...candidatesTable.entries()].filter(([, c]) => c.reviewId === reviewId && c.status === 'new').length,
    }
  }
}
