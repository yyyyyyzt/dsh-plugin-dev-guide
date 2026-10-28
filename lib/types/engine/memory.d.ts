import type { Dimension, Exemplar, Feedback, Issue, MemoryConfig, MemoryRecall, RuleCandidate, RuleStats } from './types.js';
export declare function aggregateStats(feedback: Feedback[], shownByRule: Record<string, number>): Record<string, RuleStats>;
export declare function recall(ruleId: string, stats: RuleStats | undefined, exemplars: Exemplar[], feedback: Feedback[], cfg: MemoryConfig): MemoryRecall;
/** Keep the newest `perRule` exemplars of each rule, preserving the input order of survivors. */
export declare function trimExemplars(list: Exemplar[], perRule: number): Exemplar[];
export declare function suggestDimension(text: string): Dimension | undefined;
export declare function candidatesFrom(issues: Issue[]): RuleCandidate[];
/** Per-review adoption trend: (adopt + rewrite) / decisions over the trailing `window` reviews. */
export declare function slidingAdoptRate(feedbackByReview: Feedback[][], window: number): (number | null)[];
