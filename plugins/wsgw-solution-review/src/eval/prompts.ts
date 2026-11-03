// Prompts for the LLM judge paths (evaluation.md §5.1). Released with the package; promptHash pins them in eval_runs.
import { createHash } from 'node:crypto'
import type { Rule } from '../engine/types.js'

export const JUDGE_SYSTEM =
  '你是技术方案审查助手。只根据给出的原文片段判断该片段是否构成规则所述的问题。' +
  '只输出 JSON：{"issue": true|false, "quote": "<原文片段中的一段，8–300 字，必须逐字出现>", "finding": "<一句话问题描述>"}。' +
  '片段中没有问题时输出 {"issue": false}。不要编造原文，不要输出 JSON 以外的内容。'

export function judgeUser(rule: Pick<Rule, 'id' | 'title' | 'question' | 'rationale'>, snippet: string, sectionPath: string): string {
  return [
    `规则 ${rule.id}「${rule.title}」`,
    `检查问题：${rule.question}`,
    `依据：${rule.rationale}`,
    `章节：${sectionPath || '（未知）'}`,
    '原文片段：',
    snippet,
  ].join('\n')
}

export const DIRECT_SYSTEM =
  '你是技术方案审查专家。阅读完整方案与全部规则，列出方案存在的问题并给出结论。' +
  '只输出 JSON：{"issues": [{"ruleId": "<规则号>", "quote": "<支持该问题的原文>", "finding": "<问题描述>"}], "verdict": "通过"|"建议整改"|"不通过"}。'

export function directUser(markdown: string, rules: Pick<Rule, 'id' | 'title' | 'severity' | 'question'>[]): string {
  const ruleLines = rules.map((r) => `- ${r.id}（${r.severity}）${r.title}：${r.question}`)
  return ['规则清单：', ...ruleLines, '', '方案全文：', markdown].join('\n')
}

export const POLICY_SYSTEM =
  '你是技术方案审查专家。已确认的问题清单如下，请直接给出方案结论。只输出 JSON：{"verdict": "通过"|"建议整改"|"不通过"}。'

export function policyUser(issues: { ruleId: string; severity: string; finding: string }[]): string {
  if (!issues.length) return '已确认的问题：无。'
  return ['已确认的问题：', ...issues.map((i) => `- ${i.ruleId}（${i.severity}）${i.finding}`)].join('\n')
}

/** First 12 hex chars of sha256 over every prompt text; recorded as `eval_runs.config.promptHash`. */
export function promptHash(): string {
  const h = createHash('sha256')
  for (const text of [
    JUDGE_SYSTEM,
    judgeUser({ id: 'X', title: 'T', question: 'Q', rationale: 'R' }, 'S', 'P'),
    DIRECT_SYSTEM,
    directUser('M', [{ id: 'X', title: 'T', severity: 'major', question: 'Q' }]),
    POLICY_SYSTEM,
    policyUser([{ ruleId: 'X', severity: 'major', finding: 'F' }]),
  ]) {
    h.update(text)
    h.update('\u0000')
  }
  return h.digest('hex').slice(0, 12)
}
