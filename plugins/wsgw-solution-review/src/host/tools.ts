// The nine model-facing tools (design.md §8). Thin wrappers: argument schema → ReviewStore → JSON result.
// File IO is injected so the host entry can route it through ctx.fs while specs use a fake.
import { defineTool, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ChecklistEntry, Dimension, Evidence, Issue, IssueTier, Severity, Tier, Verdict } from '../engine/types.js'
import { SEVERITY_NAME, type CheckResult, type DecideAction, type ProposeAction, type ReviewStore, type RuleView, type StatusResult } from './store.js'

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
const DECIDE_ACTIONS = ['adopt', 'reject', 'rewrite', 'add', 'adopt_rest', 'set_reviewer', 'set_final_verdict', 'discard'] as const
const TIER_NAME: Record<IssueTier, string> = { hard: '程序检查', hybrid: 'AI 辅助', soft: '人工判断', expert: '专家' }
const ORIGIN_NAME: Record<Issue['origin'], string> = { verifier: '程序', llm: 'AI', expert: '专家' }
const levelOf = (severity: Severity, from?: Severity): string => (from && from !== severity ? `${SEVERITY_NAME[severity]}（原${SEVERITY_NAME[from]}）` : SEVERITY_NAME[severity])
const PROPOSE_ACTIONS = ['disable', 'enable', 'set_severity', 'set_suggestion', 'set_param', 'reset', 'draft', 'accept_draft', 'dismiss'] as const

const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json
const text = (s: string): ContentBlock[] => [{ type: 'text', text: s }]
const JSON_OUTPUT = { type: 'json' } as const

const CHECK_LABEL: Record<ChecklistEntry['status'], string> = {
  pass: '通过',
  fail: '未通过',
  candidate: '待判断',
  pending: '待人工',
  'not-applicable': '不适用',
  soft: '人工判断',
  'reviewed-no-issue': '已审阅无问题',
}
const CHECK_ORDER: ChecklistEntry['status'][] = [
  'fail',
  'candidate',
  'pending',
  'soft',
  'not-applicable',
  'pass',
  'reviewed-no-issue',
]

const clip = (value: string, max = 180): string => {
  const one = value.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const evidenceLine = (evidence: Evidence, index: number): string => {
  const where = evidence.sectionPath ? `；${evidence.sectionPath}` : ''
  if (evidence.kind === 'absence') return `  证据${index + 1}（absence·非引文${where}）${clip(evidence.quote, 100)}`
  return `  证据${index + 1}（${evidence.kind}${where}）「${clip(evidence.quote)}」`
}

const renderIssue = (issue: Issue, withStatus: boolean): string => {
  const status = withStatus ? ` [${issue.status}]` : ''
  const lines = [
    `- ${issue.issueId}${status} ${levelOf(issue.severity, issue.severityFrom)}·${TIER_NAME[issue.tier]}·${ORIGIN_NAME[issue.origin]} ${issue.ruleId ?? '无规则'}｜${clip(issue.finding)}`,
    `  建议：${clip(issue.suggestion)}`,
  ]
  for (const [i, evidence] of issue.evidence.slice(0, 3).entries()) lines.push(evidenceLine(evidence, i))
  if (issue.evidence.length > 3) lines.push(`  …另有 ${issue.evidence.length - 3} 条证据`)
  if (!issue.gate.passed && issue.gate.reasons.length) lines.push(`  门禁：${issue.gate.reasons.join(', ')}`)
  if (issue.status === 'pending') lines.push('  待人工：未计入预审结论。')
  return lines.join('\n')
}

const renderChecklist = (checklist: ChecklistEntry[], withNotes: boolean): string => {
  const groups = CHECK_ORDER.map((status) => {
    const rows = checklist.filter((row) => row.status === status)
    if (!rows.length) return ''
    const items = rows.map((row) => (withNotes && row.note ? `${row.ruleId}（${clip(row.note, 50)}）` : row.ruleId)).join('、')
    return `${CHECK_LABEL[status]}：${items}`
  }).filter(Boolean)
  const counts = CHECK_ORDER.map((status) => `${CHECK_LABEL[status]} ${checklist.filter((row) => row.status === status).length}`).join(' / ')
  return [`检查清单：${counts}`, ...groups].join('\n')
}

const renderCheck = (value: CheckResult): string => {
  const lines = [
    `自动登记 ${value.hardIssues.length} 条问题；待判断候选 ${value.hybridCandidates.length} 条；人工判断规则 ${value.softRules.length} 条。`,
    `预审结论（建议）：${value.aiVerdict}（${value.basis}）。仅为建议，待专家确认。`,
  ]
  if (value.hardIssues.length) lines.push('', `【自动登记问题（${value.hardIssues.length}）】`, ...value.hardIssues.map((issue) => renderIssue(issue, false)))
  if (value.hybridCandidates.length) {
    lines.push('', `【待判断候选（${value.hybridCandidates.length}）】`)
    for (const candidate of value.hybridCandidates) {
      lines.push(`- ${candidate.ruleId} ${SEVERITY_NAME[candidate.severity]}·AI 辅助｜${candidate.title}：${clip(candidate.question)}`)
      if (candidate.note) lines.push(`  说明：${clip(candidate.note, 120)}`)
      for (const [i, snippet] of candidate.snippets.slice(0, 3).entries()) {
        const flags = snippet.flags?.length ? `；标记 ${snippet.flags.join('/')}` : ''
        lines.push(`  候选${i + 1}（${snippet.sectionPath}${flags}）「${clip(snippet.quote)}」`)
      }
      if (candidate.snippets.length > 3) lines.push(`  …另有 ${candidate.snippets.length - 3} 处候选`)
    }
  }
  if (value.softRules.length) {
    lines.push('', `【人工判断规则（${value.softRules.length}，仅提示不计分）】`)
    for (const soft of value.softRules) lines.push(`- ${soft.ruleId}｜${soft.title}：${clip(soft.question)}`)
  }
  lines.push('', renderChecklist(value.checklist, false))
  lines.push('', '下一步：对候选逐条判断后用 review_record_issue 登记；absence 不是原文引文，不得作为引用。')
  return lines.join('\n')
}

const renderStatus = (value: StatusResult): string => {
  const lines = [
    `${value.reviewId}｜${value.title}`,
    `状态：${value.status}${value.reviewer ? `；审核人：${value.reviewer}` : ''}；预审：${value.aiVerdict}${value.finalVerdict ? `；最终：${value.finalVerdict}` : ''}`,
    `摘要：${value.summary}`,
    `计数：严重 ${value.counts.blocker} / 一般 ${value.counts.major} / 轻微 ${value.counts.minor}；confirmed ${value.counts.confirmed} / pending ${value.counts.pending} / adopted ${value.counts.adopted} / rejected ${value.counts.rejected} / rewritten ${value.counts.rewritten} / expert ${value.counts.expert}`,
  ]
  if (value.issues.length) lines.push('', `【问题明细（${value.issues.length}）】`, ...value.issues.map((issue) => renderIssue(issue, true)))
  else lines.push('', '【问题明细】暂无。')
  lines.push('', renderChecklist(value.checklist, true))
  return lines.join('\n')
}

const renderRules = (value: { rules: RuleView[]; warnings: string[]; loadErrors: { file: string; message: string }[] }): string => {
  const lines = [`共 ${value.rules.length} 条规则。`]
  if (value.warnings.length) lines.push(`加载警告：${value.warnings.join('；')}`)
  if (value.loadErrors.length) lines.push(`加载错误：${value.loadErrors.map((error) => `${error.file}: ${error.message}`).join('；')}`)
  for (const rule of value.rules) {
    lines.push(
      `- ${rule.ruleId}｜${SEVERITY_NAME[rule.severity]}/${TIER_NAME[rule.tier]}｜${rule.status}${rule.overridden ? '｜learned' : ''}｜${rule.title}｜展示 ${rule.stats.shown} / 采纳 ${rule.stats.adopt} / 驳回 ${rule.stats.reject} / 改写 ${rule.stats.rewrite}`,
    )
  }
  return lines.join('\n')
}

export function createReviewTools(store: ReviewStore, io: ToolIo): ToolDefinition[] {
  const reviewParse = defineTool({
    name: 'review_parse',
    description:
      `解析待预审的技术方案（Markdown），创建审查记录并返回 reviewId、章节大纲与统计。${SUGGEST_ONLY}` +
      ' 同一份方案（只差空白换行也算）已有未关闭记录时返回 existingReviewId，不新建，直接接着用；专家明确要从头再审才传 reuse=false。' +
      '新建时，同一方案（同内容 / 同路径 / 同标题）里还在进行中且没有专家决定的旧记录会被标为「被取代」，在 superseded 返回。方案超过配置上限会被拒绝。',
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
      reuse: { type: 'boolean', description: '同一份方案已有记录时：true/缺省 = 复用已有记录；false = 新建记录（旧的未决定记录被取代）' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as { reviewId: string; title: string; existingReviewId?: string; superseded?: string[]; warnings: string[] }
        const head = v.existingReviewId ? `这份方案已有审查记录 ${v.reviewId}（${v.title}），接着用它，未新建。` : `已创建审查记录 ${v.reviewId}（${v.title}）。`
        const closed = v.superseded?.length ? `\n同一方案的旧记录已标为被取代：${v.superseded.join('、')}。` : ''
        return text(`${head}${closed}${v.warnings.length ? `\n提示：${v.warnings.join('；')}` : ''}`)
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
      ' 返回每条问题的 ruleId / 级别（严重 / 一般 / 轻微）/ 证据（absence 会标注为非引文）、候选原文、检查清单与计数；重复调用会替换此前自动登记的问题，不会重复。',
    parameters: {
      reviewId: { type: 'string', required: true, description: 'review_parse 返回的 reviewId' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => text(renderCheck(value as unknown as CheckResult)),
    },
    async execute(args) {
      return json(await store.check(args.reviewId))
    },
  })

  const reviewRecordIssue = defineTool({
    name: 'review_record_issue',
    description:
      `登记一条你依据 hybrid 候选片段判断出的问题（或规则未覆盖的待人工意见）。引文必须逐字来自方案原文（8–300 字）并落在候选片段内，否则问题进入 pending 并返回 gate.reasons。${SUGGEST_ONLY}` +
      ' hard 规则的问题由 review_check 自动登记，不接受人工登记；不得提交 absence 或以「未提及 / 未见 / 缺失」开头的伪引文（返回 ABSENCE_NOT_ALLOWED）。',
    parameters: {
      reviewId: { type: 'string', required: true },
      ruleId: { type: 'string', description: '规则号（rules_list 可查）；缺省表示规则未覆盖，作为待人工项登记' },
      severity: { type: 'string', enum: [...SEVERITY], description: '缺省取规则级别' },
      finding: { type: 'string', required: true, description: '一句话说清缺什么或哪里不对（≤ 60 字），如「方案没写压测怎么做，也没给压测结果。」' },
      suggestion: { type: 'string', required: true, description: '写清在哪补、补什么、补到什么程度（≤ 120 字），不写「建议完善」类空话；有 memory_recall 范例措辞优先用' },
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
    description: `读取审查记录的当前状态：预审结论（建议）、一句话摘要、问题明细（含证据与门禁）、检查清单与计数。不写库。${SUGGEST_ONLY}`,
    parameters: {
      reviewId: { type: 'string', required: true },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => text(renderStatus(value as unknown as StatusResult)),
    },
    async execute(args) {
      return json(store.status(args.reviewId))
    },
  })

  const reviewDecide = defineTool({
    name: 'review_decide',
    description:
      '记录专家在复核中的决定：adopt / reject / rewrite 针对单条问题（adopt / rewrite 可带 severity，只改这一条的级别，不动规则）；add 登记专家新增意见；adopt_rest 只采纳其余「已确认」问题，待人工项会在 remainingPending 返回、须逐条请专家确认；' +
      'set_reviewer 记录审核人；set_final_verdict 是写入最终结论的唯一入口（需先有审核人）；discard 作废整条审查记录（reason 写原因），之后该记录只读。' +
      '也可只传 answer（专家原话或选项文字），由工具归一化：「要改 / 是问题 / 采纳」= adopt，「不用改 / 不是问题 / 驳回[，原因]」= reject，「我换个说法：…」= rewrite，「算轻微 / 降为一般」= adopt 并调级别；' +
      '只说「换个说法」不给内容会返回 BAD_ACTION，请追问专家想怎么写。定稿后再做任何决定，记录回到进行中，需重新 review_finalize。' + SUGGEST_ONLY,
    parameters: {
      reviewId: { type: 'string', required: true },
      action: { type: 'string', enum: [...DECIDE_ACTIONS] },
      answer: { type: 'string', description: '专家对某条问题的原话；与 action 二选一' },
      issueId: { type: 'string', description: 'adopt / reject / rewrite / answer 需要' },
      text: { type: 'string', description: 'rewrite 的改写文本；add 的新增意见' },
      reason: { type: 'string', description: 'reject 的原因（专家原话）；discard 的作废原因' },
      ruleId: { type: 'string', description: 'add 时可对应的规则号' },
      severity: { type: 'string', enum: [...SEVERITY], description: 'blocker=严重 / major=一般 / minor=轻微。adopt / rewrite 时只调这一条问题的级别；add 时缺省 major' },
      finalVerdict: { type: 'string', enum: [...VERDICT], description: '仅 set_final_verdict 使用' },
      reviewer: { type: 'string', description: 'set_reviewer 使用' },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => {
        const v = value as {
          action: string
          issue?: { issueId: string; status: string; severity: Severity; severityFrom?: Severity }
          affected?: string[]
          remainingPending?: string[]
          aiVerdict: string
          finalVerdict?: string
          needsRefinalize?: boolean
        }
        if (v.action === 'discard') return text(`${_args.reviewId} 已作废，之后只读；需要重新审查请 review_parse。`)
        const reopen = v.needsRefinalize ? '\n记录已回到进行中：旧意见文件已过期，需重新定稿（review_finalize）。' : ''
        if (v.action === 'set_final_verdict') return text(`最终结论已记录：${v.finalVerdict}（复核后建议结论 ${v.aiVerdict}）。${reopen}`)
        if (v.action === 'adopt_rest') {
          const pending = v.remainingPending ?? []
          const tail = pending.length ? `；还有 ${pending.length} 条待人工需逐条请专家确认：${pending.join('、')}` : ''
          return text(`其余 ${v.affected?.length ?? 0} 条已确认问题已采纳${tail}；复核后建议结论 ${v.aiVerdict}。${reopen}`)
        }
        if (v.issue) return text(`${v.issue.issueId} → ${v.issue.status}（${levelOf(v.issue.severity, v.issue.severityFrom)}）；复核后建议结论 ${v.aiVerdict}。${reopen}`)
        return text(`已记录（${v.action}）。${reopen}`)
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
    description: `列出当前生效的审查规则（shipped 规则 + 专家调整），含 id / 标题 / 级别 / 层级 / 状态 / 历史采纳统计。${SUGGEST_ONLY}`,
    parameters: {
      dimension: { type: 'string', enum: [...DIMENSION] },
      tier: { type: 'string', enum: [...TIER] },
      status: { type: 'string', enum: ['active', 'draft', 'retired'] },
    },
    output: {
      schema: JSON_OUTPUT,
      render: (_args, value) => text(renderRules(value as unknown as { rules: RuleView[]; warnings: string[]; loadErrors: { file: string; message: string }[] })),
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
      '按专家要求调整规则：disable / enable / set_severity / set_suggestion / set_param 修改规则生效方式（不改 shipped 文件），reset 恢复出厂值；' +
      'draft 把候选规则写成规则 YAML（工具用规则 schema 校验）；accept_draft 使草稿生效；dismiss 关闭候选。只在专家明确要求时调用。',
    parameters: {
      action: { type: 'string', required: true, enum: [...PROPOSE_ACTIONS] },
      ruleId: { type: 'string' },
      severity: { type: 'string', enum: [...SEVERITY] },
      suggestion: { type: 'string', description: 'set_suggestion：新的整改建议（1–500 字）' },
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
        const v = value as { action: string; rule?: { ruleId: string; status: string; severity: Severity }; candidate?: { candidateId: string; status: string }; warnings: string[] }
        const head = v.rule
          ? `${v.rule.ruleId} 现为 ${v.rule.status} / ${SEVERITY_NAME[v.rule.severity]}（${v.action}）。`
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
          suggestion: args.suggestion,
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
