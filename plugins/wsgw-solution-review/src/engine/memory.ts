// Memory pure functions (design.md §8, review-protocol.md §6): stats, recall, exemplar cap, candidate rules, trend.
import type {
  Dimension,
  Exemplar,
  Feedback,
  Issue,
  MemoryConfig,
  MemoryRecall,
  RuleCandidate,
  RuleStats,
} from './types.js'

const emptyStats = (): RuleStats => ({ shown: 0, adopt: 0, reject: 0, rewrite: 0 })

export function aggregateStats(feedback: Feedback[], shownByRule: Record<string, number>): Record<string, RuleStats> {
  const out: Record<string, RuleStats> = {}
  const get = (ruleId: string): RuleStats => (out[ruleId] ??= emptyStats())
  for (const [ruleId, shown] of Object.entries(shownByRule)) get(ruleId).shown = shown
  for (const f of feedback) {
    if (!f.ruleId) continue
    get(f.ruleId)[f.action] += 1
  }
  return out
}

const byNewest = (a: { at: string }, b: { at: string }) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)

export function recall(
  ruleId: string,
  stats: RuleStats | undefined,
  exemplars: Exemplar[],
  feedback: Feedback[],
  cfg: MemoryConfig,
): MemoryRecall {
  const s = stats ?? emptyStats()
  const rejectRatio = s.shown > 0 ? s.reject / s.shown : 0
  const warn = s.shown >= cfg.rejectWarnMinSamples && rejectRatio >= cfg.rejectWarnRatio

  const own = exemplars.filter((e) => e.ruleId === ruleId).sort(byNewest)

  const recentRejectReasons = feedback
    .filter((f) => f.ruleId === ruleId && f.action === 'reject' && f.reason && f.reason.trim())
    .sort(byNewest)
    .slice(0, 3)
    .map((f) => f.reason!.trim())

  return { stats: { ...s, rejectRatio }, warn, exemplars: own, recentRejectReasons }
}

/** Keep the newest `perRule` exemplars of each rule, preserving the input order of survivors. */
export function trimExemplars(list: Exemplar[], perRule: number): Exemplar[] {
  const keep = new Set<Exemplar>()
  const groups = new Map<string, Exemplar[]>()
  for (const e of list) (groups.get(e.ruleId) ?? groups.set(e.ruleId, []).get(e.ruleId)!).push(e)
  for (const group of groups.values()) {
    for (const e of [...group].sort(byNewest).slice(0, Math.max(0, perRule))) keep.add(e)
  }
  return list.filter((e) => keep.has(e))
}

// Keyword cues for guessing the dimension of an expert-added finding. Order matters: earlier entries win ties.
const DIMENSION_CUES: [Dimension, string[]][] = [
  ['capacity', ['限流', '压测', '并发', '容量', '扩容', '业务量', '性能']],
  ['security', ['加密', '鉴权', '签名', '实名', '泄露', '越权', '安全', '授权']],
  ['interface', ['接口', '字段', '参数', '幂等', '边界', '渠道标识']],
  ['channel', ['渠道管控', '渠道开关', '配额', '黑名单', '白名单']],
  ['data_sync', ['同步', 'MQ', '定时任务', '数据一致']],
  ['config', ['配置', '开关', '可配置']],
  ['monitoring', ['埋点', '监控', '告警', '日志']],
  ['documentation', ['时序图', '附件', '章节', '说明', '文档', '对比']],
]

export function suggestDimension(text: string): Dimension | undefined {
  let best: { dim: Dimension; score: number } | undefined
  for (const [dim, cues] of DIMENSION_CUES) {
    const score = cues.filter((c) => text.includes(c)).length
    if (score > 0 && (!best || score > best.score)) best = { dim, score }
  }
  return best?.dim
}

export function candidatesFrom(issues: Issue[]): RuleCandidate[] {
  const out: RuleCandidate[] = []
  for (const issue of issues) {
    if (issue.origin !== 'expert' || issue.ruleId) continue
    const text = issue.rewriteText?.trim() || issue.finding
    const dim = suggestDimension(`${issue.finding} ${issue.suggestion}`)
    const cand: RuleCandidate = { text, reviewId: issue.reviewId, issueId: issue.issueId }
    if (dim) cand.suggestedDimension = dim
    out.push(cand)
  }
  return out
}

/** Per-review adoption trend: (adopt + rewrite) / decisions over the trailing `window` reviews. */
export function slidingAdoptRate(feedbackByReview: Feedback[][], window: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < feedbackByReview.length; i++) {
    if (i + 1 < window) {
      out.push(null)
      continue
    }
    let adopted = 0
    let decisions = 0
    for (const review of feedbackByReview.slice(i + 1 - window, i + 1)) {
      for (const f of review) {
        decisions += 1
        if (f.action === 'adopt' || f.action === 'rewrite') adopted += 1
      }
    }
    out.push(decisions === 0 ? null : adopted / decisions)
  }
  return out
}
