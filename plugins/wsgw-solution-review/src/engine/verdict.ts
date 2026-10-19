import type { Issue, VerdictConfig, VerdictResult } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export type VerdictIssue = Pick<Issue, 'status' | 'tier' | 'severity'>

export function computeVerdict(_issues: VerdictIssue[], _cfg: VerdictConfig): VerdictResult {
  throw new NotImplementedError('computeVerdict')
}
