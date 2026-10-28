import type { Issue, OpinionInput } from '../types.js';
/** Items that make it into the opinion: expert-confirmed (adopted / rewritten) issues, grouped per rule. */
export declare function opinionPoints(issues: Issue[]): string[];
export declare function renderOpinion(input: OpinionInput): string;
export declare function opinionFileName(reviewId: string, version: number): string;
