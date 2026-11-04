// B0 keyword baseline (evaluation.md §5): the legacy mechanism — substring presence, no negation, no structure, no evidence.
import { isApplicable } from '../engine/check.js'
import { normalize } from '../engine/normalize.js'
import { parseMarkdown } from '../engine/parse/markdown.js'
import type { Rule, RulePack, Severity, Verdict, VerdictConfig, VerifierSpec } from '../engine/types.js'
import { computeVerdict } from '../engine/verdict.js'

const STRUCTURAL_KEYWORDS: Record<string, string[]> = {
  'INT-001': ['接口地址', '参数', '返回码', 'resultCode'],
  'SEC-002': ['授权码', 'openId', '手机号', '校验', '登录'],
  'CAP-003': ['扩容', '容量', '资源评估', '实例'],
  'SEC-004': ['暴露', '泄露', '越权', '风险'],
  'DOC-001': ['时序图', 'sequenceDiagram', '链路'],
  'DOC-002': ['原型', '对比', '效果图'],
  'DOC-005': ['时序图', '消息', '推送'],
  'DOC-010': ['资源变更清单', '变更类型', '资源名称'],
  'DOC-011': ['工作背景', '技术思路', '数据规划', '实施方案', '风险评估'],
  'DOC-012': ['附件', '清单', '引用'],
  'CAP-006': ['业务量', '请求量', '新增用户', '峰值', '并发'],
}

function familiesOf(spec: VerifierSpec | null): string[] {
  if (!spec) return []
  switch (spec.kind) {
    case 'statement':
      return spec.params.families
    case 'quantity':
      return spec.params.contextFamilies
    case 'mermaid-sequence':
      return [...(spec.params.participantFamilies ?? []), ...(spec.params.requiredMessageFamilies ?? [])]
    case 'all':
    case 'first':
      return spec.of.flatMap(familiesOf)
    default:
      return []
  }
}

/** 3–5 substrings per verifiable rule: the first words of its lexicon families, or a structural override. */
export function b0Keywords(pack: RulePack): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const rule of pack.rules) {
    if (rule.tier === 'soft' || !rule.verifier) continue
    const override = STRUCTURAL_KEYWORDS[rule.id]
    if (override) {
      out[rule.id] = override.slice(0, 5)
      continue
    }
    const words: string[] = []
    for (const f of familiesOf(rule.verifier)) {
      for (const w of pack.lexicon.families[f] ?? []) if (!words.includes(w)) words.push(w)
    }
    if (words.length < 3) for (const w of rule.title.split(/[与/、\s]+/u)) if (w && !words.includes(w)) words.push(w)
    out[rule.id] = words.slice(0, 5)
  }
  return out
}

export interface B0Result {
  issues: { ruleId: string; severity: Severity; tier: Rule['tier'] }[]
  verdict: Verdict
  keywords: Record<string, string[]>
}

/** A rule passes when any of its keywords occurs anywhere in the text (applicability is honoured, in the baseline's favour). */
export function runB0(markdown: string, pack: RulePack, cfg: VerdictConfig, keywords: Record<string, string[]> = b0Keywords(pack)): B0Result {
  const doc = parseMarkdown(markdown)
  const text = normalize(markdown).toLowerCase()
  const issues: B0Result['issues'] = []
  for (const rule of pack.rules) {
    if (rule.status !== 'active' || rule.tier === 'soft' || !rule.verifier) continue
    if (!isApplicable(doc, rule, pack.lexicon)) continue
    const words = keywords[rule.id] ?? []
    const present = words.some((w) => text.includes(normalize(w).toLowerCase()))
    if (!present) issues.push({ ruleId: rule.id, severity: rule.severity, tier: rule.tier })
  }
  const verdict = computeVerdict(
    issues.map((i) => ({ status: 'confirmed' as const, tier: 'hard' as const, severity: i.severity })),
    cfg,
  ).verdict
  return { issues, verdict, keywords }
}
