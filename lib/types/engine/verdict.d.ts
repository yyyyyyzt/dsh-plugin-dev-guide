import type { Issue, VerdictConfig, VerdictResult } from './types.js';
export type VerdictIssue = Pick<Issue, 'status' | 'tier' | 'severity'>;
export declare function countsTowardVerdict(issue: VerdictIssue): boolean;
export declare function computeVerdict(issues: VerdictIssue[], cfg: VerdictConfig): VerdictResult;
