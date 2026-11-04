// Deterministic verdict policy (design.md §6): only expert-confirmed, verifiable-tier issues count.
import type { Issue, VerdictConfig, VerdictResult } from './types.js'

export type VerdictIssue = Pick<Issue, 'status' | 'tier' | 'severity'>

const COUNTING_STATUS = new Set<VerdictIssue['status']>(['confirmed', 'adopted', 'rewritten'])
const COUNTING_TIER = new Set<VerdictIssue['tier']>(['hard', 'hybrid', 'expert'])

export function countsTowardVerdict(issue: VerdictIssue): boolean {
  return COUNTING_STATUS.has(issue.status) && COUNTING_TIER.has(issue.tier)
}

export function computeVerdict(issues: VerdictIssue[], cfg: VerdictConfig): VerdictResult {
  const counts = { blocker: 0, major: 0, minor: 0 }
  for (const issue of issues) if (countsTowardVerdict(issue)) counts[issue.severity] += 1

  if (counts.blocker > 0) {
    return { verdict: '不通过', counts, basis: `有 ${counts.blocker} 条严重问题，建议不通过` }
  }
  if (counts.major > 0) {
    return { verdict: '建议整改', counts, basis: `有 ${counts.major} 条一般问题，建议整改` }
  }
  if (counts.minor >= cfg.minorThreshold) {
    return {
      verdict: '建议整改',
      counts,
      basis: `轻微问题 ${counts.minor} 条，达到 ${cfg.minorThreshold} 条，建议整改`,
    }
  }
  const basis =
    counts.minor > 0
      ? `只有 ${counts.minor} 条轻微问题，不到 ${cfg.minorThreshold} 条，建议通过`
      : '没有计入结论的问题（待人工判断的不计入），建议通过'
  return { verdict: '通过', counts, basis }
}
