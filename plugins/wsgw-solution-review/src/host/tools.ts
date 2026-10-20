// The nine model-facing tools (design.md §8). Thin wrappers: argument schema → ReviewStore → JSON result.
// File IO is injected so the host entry can route it through ctx.fs while specs use a fake.
import { defineTool, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Dimension, Severity, Tier, Verdict } from '../engine/types.js'
import type { DecideAction, ProposeAction, ReviewStore } from './store.js'

export interface ToolIo {
  /** Read a Markdown source by the path the expert gave (resolved against the session working directory). */
  readText(path: string, exec: ToolRunContext): Promise<string>
  /** Write the opinion under `config.outputDir` and return the path to report. */
  writeOpinion(fileName: string, content: string, exec: ToolRunContext): Promise<string>
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

const SUGGEST_ONLY = '本工具只记录建议；最终结论由专家在复核中确认。'
const SEVERITY = ['blocker', 'major', 'minor'] as const
const TIER = ['hard', 'hybrid', 'soft'] as const
const DIMENSION = ['capacity', 'security', 'interface', 'channel', 'data_sync', 'config', 'monitoring', 'documentation'] as const
const VERDICT = ['通过', '建议整改', '不通过'] as const
const DECIDE_ACTIONS = ['adopt', 'reject', 'rewrite', 'add', 'adopt_rest', 'set_reviewer', 'set_final_verdict'] as const
const PROPOSE_ACTIONS = ['disable', 'enable', 'set_severity', 'set_param', 'draft', 'accept_draft', 'dismiss'] as const

const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json
const text = (s: string): ContentBlock[] => [{ type: 'text', text: s }]
const JSON_OUTPUT = { type: 'json' } as const

export function createReviewTools(store: ReviewStore, io: ToolIo): ToolDefinition[] {
  const reviewParse = defineTool({
    name: 'review_parse',
    description:
      `解析待预审的技术方案（Markdown），创建审查记录并返回 reviewId、章节大纲与统计。${SUGGEST_ONLY}` +
      ' 同一份方案已有记录时返回 existingReviewId（不新建）；要重新开始请传 reuse=false。方案超过配置上限会被拒绝。',
    parameters: {
      source: {
        type: 'object',
        required: true,
        additionalProperties: false,
        description: '方案来源：inline 直接给 Markdown 文本；path 给工作目录内的文件路径（经 DSH 文件系统读取）。',
        properties: {
          kind: { type: 'string', required: true, enum: ['inline', 'path'] },
          value: { type: 'string', required: true, description: 'Markdown 文本或文件路径' },
        },
      },
      title: { type: 'string', description: '方案标题；缺省取 Markdown 一级标题' },
      reuse: { type: 'boolean', description: '同哈希方案已有记录时：true/缺省 = 复用已有记录；false = 新建记录' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { reviewId: string; title: string; existingReviewId?: string; warnings: string[] }
        const head = v.existingReviewId ? `已有审查记录 ${v.reviewId}（${v.title}），未新建。` : `已创建审查记录 ${v.reviewId}（${v.title}）。`
        return text(v.warnings.length ? `${head}\n提示：${v.warnings.join('；')}` : head)
      },
    },
    async execute(args, exec) {
      const source = args.source.kind === 'path' ? await io.readText(args.source.value, exec) : args.source.value
      const out = await store.parse({
        source,
        title: args.title,
        sourcePath: args.source.kind === 'path' ? args.source.value : undefined,
        reuse: args.reuse,
      })
      return json(out)
    },
  })

  const reviewCheck = defineTool({
    name: 'review_check',
    description:
      `对审查记录运行规则集：hard 规则的未满足项自动登记为问题（origin=verifier），hybrid 规则返回候选片段供你判断，soft 规则返回问题清单。${SUGGEST_ONLY}` +
      ' 重复调用会替换此前自动登记的问题，不会重复。',
    parameters: {
      reviewId: { type: 'string', required: true, description: 'review_parse 返回的 reviewId' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { hardIssues: unknown[]; hybridCandidates: unknown[]; softRules: unknown[]; aiVerdict: string; basis: string }
        return text(
          `自动登记 ${v.hardIssues.length} 条问题；待判断候选 ${v.hybridCandidates.length} 条；软规则 ${v.softRules.length} 条。` +
            `预审结论（建议）：${v.aiVerdict}（${v.basis}）。仅为建议，待专家确认。`,
        )
      },
    },
    async execute(args) {
      return json(await store.check(args.reviewId))
    },
  })

  const reviewRecordIssue = defineTool({
    name: 'review_record_issue',
    description:
      `登记一条你依据 hybrid 候选片段判断出的问题（或规则未覆盖的待人工意见）。引文必须逐字来自方案原文（8–300 字）并落在候选片段内，否则问题进入 pending 并返回 gate.reasons。${SUGGEST_ONLY}` +
      ' hard 规则的问题由 review_check 自动登记，不接受人工登记。',
    parameters: {
      reviewId: { type: 'string', required: true },
      ruleId: { type: 'string', description: '规则号（rules_list 可查）；缺省表示规则未覆盖，作为待人工项登记' },
      severity: { type: 'string', enum: [...SEVERITY], description: '缺省取规则级别' },
      finding: { type: 'string', required: true, description: '发现了什么（一句话，公文口吻）' },
      suggestion: { type: 'string', required: true, description: '建议怎么改（优先使用 memory_recall 返回的范例措辞）' },
      evidence: {
        type: 'array',
        required: true,
        description: '原文证据；quote 逐字摘自方案',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            quote: { type: 'string', required: true },
            sectionPath: { type: 'string', description: '章节路径，如 二/2.3' },
          },
        },
      },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { issueId: string; status: string; gate: { passed: boolean; reasons: string[] } }
        return text(
          v.gate.passed
            ? `已登记 ${v.issueId}（${v.status}）。`
            : `已登记 ${v.issueId} 为 pending：证据门禁未通过（${v.gate.reasons.join(', ')}）。请对照候选片段逐字修正引文后重试一次。`,
        )
      },
    },
    async execute(args) {
      return json(
        await store.recordIssue(args.reviewId, {
          ruleId: args.ruleId,
          severity: args.severity as Severity | undefined,
          finding: args.finding,
          suggestion: args.suggestion,
          evidence: args.evidence,
        }),
      )
    },
  })

  const reviewStatus = defineTool({
    name: 'review_status',
    description: `读取审查记录的当前状态：预审结论（建议）、一句话摘要、问题明细、检查清单与计数。不写库。${SUGGEST_ONLY}`,
    parameters: {
      reviewId: { type: 'string', required: true },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => text((value as { summary: string }).summary),
    },
    async execute(args) {
      return json(store.status(args.reviewId))
    },
  })

  const reviewDecide = defineTool({
    name: 'review_decide',
    description:
      '记录专家在复核中的决定：adopt / reject / rewrite 针对单条问题；add 登记专家新增意见；adopt_rest 采纳其余未决问题；' +
      'set_reviewer 记录审核人；set_final_verdict 是写入最终结论的唯一入口（需先有审核人）。' +
      '也可只传 answer（专家原话），由工具按「采纳 / 驳回 / 其他文本=改写」归一化。' + SUGGEST_ONLY,
    parameters: {
      reviewId: { type: 'string', required: true },
      action: { type: 'string', enum: [...DECIDE_ACTIONS] },
      answer: { type: 'string', description: '专家对某条问题的原话；与 action 二选一' },
      issueId: { type: 'string', description: 'adopt / reject / rewrite / answer 需要' },
      text: { type: 'string', description: 'rewrite 的改写文本；add 的新增意见' },
      reason: { type: 'string', description: 'reject 的原因（专家原话）' },
      ruleId: { type: 'string', description: 'add 时可对应的规则号' },
      severity: { type: 'string', enum: [...SEVERITY], description: 'add 时的级别，缺省 major' },
      finalVerdict: { type: 'string', enum: [...VERDICT], description: '仅 set_final_verdict 使用' },
      reviewer: { type: 'string', description: 'set_reviewer 使用' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { action: string; issue?: { issueId: string; status: string }; affected?: string[]; aiVerdict: string; finalVerdict?: string }
        if (v.action === 'set_final_verdict') return text(`最终结论已记录：${v.finalVerdict}（复核后建议结论 ${v.aiVerdict}）。`)
        if (v.action === 'adopt_rest') return text(`其余 ${v.affected?.length ?? 0} 条已采纳；复核后建议结论 ${v.aiVerdict}。`)
        if (v.issue) return text(`${v.issue.issueId} → ${v.issue.status}；复核后建议结论 ${v.aiVerdict}。`)
        return text(`已记录（${v.action}）。`)
      },
    },
    async execute(args) {
      return json(
        await store.decide(args.reviewId, {
          action: args.action as DecideAction | undefined,
          answer: args.answer,
          issueId: args.issueId,
          text: args.text,
          reason: args.reason,
          ruleId: args.ruleId,
          severity: args.severity as Severity | undefined,
          finalVerdict: args.finalVerdict as Verdict | undefined,
          reviewer: args.reviewer,
        }),
      )
    },
  })

  const reviewFinalize = defineTool({
    name: 'review_finalize',
    description:
      `按专家确认的最终结论渲染《技术方案预审意见》并写入输出目录，然后把采纳/改写措辞与专家新增意见回流到记忆。需要已 set_final_verdict。${SUGGEST_ONLY}` +
      ' 本工具只返回文件路径；如需展示文件请随后调用 present。',
    parameters: {
      reviewId: { type: 'string', required: true },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { opinionPath: string; version: number; counts: { adopt: number; reject: number; rewrite: number; add: number }; memory: { candidates: number } }
        return text(
          `已生成 ${v.opinionPath}（第 ${v.version} 版）：采纳 ${v.counts.adopt} / 驳回 ${v.counts.reject} / 改写 ${v.counts.rewrite} / 新增 ${v.counts.add}；` +
            `新增候选规则 ${v.memory.candidates} 条。`,
        )
      },
    },
    async execute(args, exec) {
      return json(await store.finalize(args.reviewId, (fileName, content) => io.writeOpinion(fileName, content, exec)))
    },
  })

  const rulesList = defineTool({
    name: 'rules_list',
    description: `列出当前生效的审查规则（shipped 规则 + 专家调整），含级别、层级、状态与历史采纳统计。${SUGGEST_ONLY}`,
    parameters: {
      dimension: { type: 'string', enum: [...DIMENSION] },
      tier: { type: 'string', enum: [...TIER] },
      status: { type: 'string', enum: ['active', 'draft', 'retired'] },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => text(`共 ${(value as { rules: unknown[] }).rules.length} 条规则。`),
    },
    async execute(args) {
      return json(
        store.rulesList({
          dimension: args.dimension as Dimension | undefined,
          tier: args.tier as Tier | undefined,
          status: args.status as 'active' | 'draft' | 'retired' | undefined,
        }),
      )
    },
  })

  const rulesPropose = defineTool({
    name: 'rules_propose',
    description:
      '按专家要求调整规则：disable / enable / set_severity / set_param 修改规则生效方式（不改 shipped 文件）；' +
      'draft 把候选规则写成规则 YAML（工具用规则 schema 校验）；accept_draft 使草稿生效；dismiss 关闭候选。只在专家明确要求时调用。',
    parameters: {
      action: { type: 'string', required: true, enum: [...PROPOSE_ACTIONS] },
      ruleId: { type: 'string' },
      severity: { type: 'string', enum: [...SEVERITY] },
      param: {
        type: 'object',
        additionalProperties: false,
        description: 'set_param：可调参数（families.add/remove、minChars、minMessages、minParticipants、whenNoCandidate、negationWindow、window）',
        properties: {
          key: { type: 'string', required: true },
          value: { type: 'json', required: true },
        },
      },
      candidateId: { type: 'string', description: 'rc_<reviewId>_<n>' },
      draft: { type: 'string', description: '单条规则的 YAML 文本（id/title/dimension/severity/tier/question/rationale/suggestion[/verifier]）' },
      who: { type: 'string', description: '审计记录的操作人（专家姓名/工号）' },
      reviewId: { type: 'string', description: '关联的审查记录' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { action: string; rule?: { ruleId: string; status: string; severity: string }; candidate?: { candidateId: string; status: string }; warnings: string[] }
        const head = v.rule
          ? `${v.rule.ruleId} 现为 ${v.rule.status} / ${v.rule.severity}（${v.action}）。`
          : v.candidate
            ? `候选 ${v.candidate.candidateId} → ${v.candidate.status}。`
            : `已执行 ${v.action}。`
        return text(v.warnings.length ? `${head}\n提示：${v.warnings.join('；')}` : head)
      },
    },
    async execute(args) {
      return json(
        await store.rulesPropose({
          action: args.action as ProposeAction,
          ruleId: args.ruleId,
          severity: args.severity as Severity | undefined,
          param: args.param,
          candidateId: args.candidateId,
          draft: args.draft,
          who: args.who,
          reviewId: args.reviewId,
        }),
      )
    },
  })

  const memoryRecall = defineTool({
    name: 'memory_recall',
    description:
      '查询某条规则（或某个维度下全部规则）的历史复核记忆：采纳/驳回统计、warn（驳回率过高）、范例措辞与最近驳回原因。' +
      '登记 hybrid 问题前先查，warn=true 的规则需在建议中提醒专家重点确认。' + SUGGEST_ONLY,
    parameters: {
      ruleId: { type: 'string' },
      dimension: { type: 'string', enum: [...DIMENSION] },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { ruleId?: string; warn?: boolean; stats?: { shown: number; rejectRatio: number }; rules?: unknown[] }
        if (v.ruleId && v.stats) {
          return text(`${v.ruleId}：呈现 ${v.stats.shown} 次，驳回率 ${(v.stats.rejectRatio * 100).toFixed(0)}%${v.warn ? '（历史上常被驳回，请重点确认）' : ''}。`)
        }
        return text(`已返回 ${v.rules?.length ?? 0} 条规则的记忆。`)
      },
    },
    async execute(args) {
      if (args.ruleId) return json(store.memoryRecall(args.ruleId))
      if (args.dimension) return json(store.memoryRecallByDimension(args.dimension as Dimension))
      throw new Error('memory_recall 需要 ruleId 或 dimension')
    },
  })

  return [reviewParse, reviewCheck, reviewRecordIssue, reviewStatus, reviewDecide, reviewFinalize, rulesList, rulesPropose, memoryRecall]
}
