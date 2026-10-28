// Host-side slash commands (design.md §9): deterministic text over the store, never through the model.
import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import type { Dimension, Severity, Tier } from '../engine/types.js'
import { isClosed, type IssueRecord, type ReviewRecord } from '../store/domain.js'
import { SEVERITY_NAME, type ReviewStore } from './store.js'
import type {} from './service.js'

export const name = 'wsgw-solution-review/commands'
export const inject = ['commands', 'solutionReview']

const DIMENSIONS: readonly Dimension[] = ['capacity', 'security', 'interface', 'channel', 'data_sync', 'config', 'monitoring', 'documentation']
const TIERS: readonly Tier[] = ['hard', 'hybrid', 'soft']
const SEVERITY_RANK: Record<Severity, number> = { blocker: 0, major: 1, minor: 2 }
const TIER_NAME: Record<Tier, string> = { hard: '程序检查', hybrid: 'AI 辅助', soft: '人工判断' }
const REVIEW_STATUS_LABEL: Record<ReviewRecord['status'], string> = { open: '进行中', finalized: '已定稿', superseded: '已作废', discarded: '已作废' }
const RULE_STATUS_LABEL: Record<string, string> = { active: '启用', draft: '草案', retired: '停用' }
const STATUS_LABEL: Record<IssueRecord['status'], string> = {
  confirmed: '已确认',
  pending: '待人工',
  rejected: '已驳回',
  adopted: '已采纳',
  rewritten: '已改写',
}

const ok = (text: string): CommandResult => ({ kind: 'success', text })
const err = (text: string): CommandResult => ({ kind: 'error', text })

function issueLine(n: number, i: IssueRecord): string {
  const ev = i.evidence[0]
  const where = ev ? `「${ev.quote.slice(0, 60)}${ev.quote.length > 60 ? '…' : ''}」${ev.sectionPath ? `（${ev.sectionPath}${ev.range ? ` · 第 ${ev.range.start.line} 行` : ''}）` : ''}` : '（无）'
  const text = i.status === 'rewritten' && i.rewriteText ? i.rewriteText : i.suggestion
  return `${n}. [${i.ruleId ?? '待人工'} · ${SEVERITY_NAME[i.severity]} · ${STATUS_LABEL[i.status]}] 发现：${i.finding}　证据：${where}　建议：${text}`
}

export function renderReviewSummary(store: ReviewStore, reviewId: string): string {
  const s = store.status(reviewId)
  const review = store.requireReview(reviewId)
  const ranked = [...s.issues].sort((a, b) => {
    const pa = a.status === 'pending' ? 1 : 0
    const pb = b.status === 'pending' ? 1 : 0
    if (pa !== pb) return pa - pb
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    return a.seq - b.seq
  })
  const lines = [
    `# ${s.title}（${s.reviewId}）`,
    `状态：${REVIEW_STATUS_LABEL[review.status]}${s.reviewer ? `　审核：${s.reviewer}` : ''}${s.finalVerdict ? `　最终结论：${s.finalVerdict}` : ''}`,
    ...(isClosed(review)
      ? [review.supersededBy ? `这条记录已被 ${review.supersededBy} 取代，只读；请看 /review ${review.supersededBy}` : `这条记录已作废（${review.closedReason ?? '专家作废'}），只读`]
      : []),
    '',
    `【预审结论（建议）】${s.summary}`,
    '【问题明细】',
    ...(ranked.length ? ranked.map((i, idx) => issueLine(idx + 1, i)) : ['（无）']),
    `【检查清单】通过 ${s.checklistCounts.pass} 项 / 未通过 ${s.checklistCounts.fail} 项 / 待人工 ${s.checklistCounts.candidate + s.checklistCounts.pending + s.checklistCounts.soft} 项 / 不适用 ${s.checklistCounts['not-applicable']} 项 / 已审阅无问题 ${s.checklistCounts['reviewed-no-issue']} 项`,
    ...s.checklist.map((c) => `- ${c.ruleId} ${c.title}：${c.status}${c.note ? `（${c.note}）` : ''}`),
  ]
  return lines.join('\n')
}

export function commandHandlers(store: ReviewStore) {
  return {
    async review(rawInput: string): Promise<CommandResult> {
      const id = rawInput.trim()
      if (id) {
        if (!store.domain.table('reviews').get(id)) return err(`审查记录 ${id} 不存在；输入 /review 查看全部记录`)
        return ok(renderReviewSummary(store, id))
      }
      const reviews = store.listReviews().filter((r) => !isClosed(r))
      if (!reviews.length) return ok('暂无审查记录。在「方案审查」会话里粘贴 Markdown 方案并要求预审即可开始。')
      const rows = reviews.map(
        (r) => `| ${r.reviewId} | ${r.title.replace(/\|/g, '\\|')} | ${r.aiVerdict} | ${r.finalVerdict ?? '—'} | ${REVIEW_STATUS_LABEL[r.status]} | ${r.createdAt.slice(0, 10)} |`,
      )
      return ok(['| 编号 | 方案 | 预审建议 | 最终结论 | 状态 | 日期 |', '|---|---|---|---|---|---|', ...rows].join('\n'))
    },

    async rules(rawInput: string): Promise<CommandResult> {
      const arg = rawInput.trim()
      const filter: { dimension?: Dimension; tier?: Tier } = {}
      if (arg) {
        if ((DIMENSIONS as readonly string[]).includes(arg)) filter.dimension = arg as Dimension
        else if ((TIERS as readonly string[]).includes(arg)) filter.tier = arg as Tier
        else if (TIERS.some((t) => TIER_NAME[t] === arg)) filter.tier = TIERS.find((t) => TIER_NAME[t] === arg)!
        else return err(`未知过滤条件 ${arg}；可用维度 ${DIMENSIONS.join('/')} 或判定方式 ${TIERS.map((t) => `${t}（${TIER_NAME[t]}）`).join('/')}`)
      }
      const { rules, warnings, loadErrors } = store.rulesList(filter)
      const rate = (s: { shown: number; adopt: number; rewrite: number }) => (s.shown ? `${Math.round(((s.adopt + s.rewrite) / s.shown) * 100)}%` : '—')
      const lines = [
        '| 规则 | 标题 | 维度 | 判定方式 | 级别 | 状态 | 采纳率 |',
        '|---|---|---|---|---|---|---|',
        ...rules.map((r) => `| ${r.ruleId} | ${r.title} | ${r.dimension} | ${TIER_NAME[r.tier]} | ${SEVERITY_NAME[r.severity]} | ${RULE_STATUS_LABEL[r.status] ?? r.status} | ${rate(r.stats)} |`),
      ]
      if (warnings.length) lines.push('', `提示：${warnings.join('；')}`)
      if (loadErrors.length) lines.push('', `规则包加载错误：${loadErrors.map((e) => `${e.file}: ${e.message}`).join('；')}`)
      return ok(lines.join('\n'))
    },

    async memory(rawInput: string): Promise<CommandResult> {
      const ruleId = rawInput.trim()
      if (!ruleId) return err('用法：/memory <规则号>，例如 /memory CAP-001')
      if (!store.rulesList({}).rules.some((r) => r.ruleId === ruleId)) return err(`规则 ${ruleId} 不存在`)
      const m = store.memoryRecall(ruleId)
      const lines = [
        `# ${m.ruleId} ${m.title}`,
        `shown ${m.stats.shown} / adopt ${m.stats.adopt} / reject ${m.stats.reject} / rewrite ${m.stats.rewrite}；驳回率 ${(m.stats.rejectRatio * 100).toFixed(0)}%${m.warn ? '（warn：历史上常被驳回）' : ''}`,
        '',
        '范例措辞（最新 5 条）：',
        ...(m.exemplars.length ? m.exemplars.slice(0, 5).map((e) => `- [${e.kind}] ${e.text}（${e.reviewId}）`) : ['- （无）']),
        '',
        '最近驳回原因：',
        ...(m.recentRejectReasons.length ? m.recentRejectReasons.map((r) => `- ${r}`) : ['- （无）']),
      ]
      return ok(lines.join('\n'))
    },
  }
}

export function apply(ctx: Context): void {
  const handlers = commandHandlers(ctx.solutionReview)
  ctx.commands.register({
    name: 'review',
    description: '列出技术方案审查记录；/review <编号> 查看某条记录的三层摘要',
    input: { hint: '[reviewId]' },
    handler: ({ rawInput }) => handlers.review(rawInput),
  })
  ctx.commands.register({
    name: 'rules',
    description: '查看生效的审查规则；可按维度或判定方式过滤',
    input: { hint: '[dimension|tier]' },
    handler: ({ rawInput }) => handlers.rules(rawInput),
  })
  ctx.commands.register({
    name: 'memory',
    description: '查看某条规则的复核统计、范例措辞与最近驳回原因',
    input: { hint: '<ruleId>' },
    handler: ({ rawInput }) => handlers.memory(rawInput),
  })
}
