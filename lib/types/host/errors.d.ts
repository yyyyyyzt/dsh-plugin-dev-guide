import { HarnessError } from '@deepseek-ai/dsh-llm';
export type ReviewToolErrorCode = 'REVIEW_NOT_FOUND' | 'REVIEW_ALREADY_DECIDED' | 'SOURCE_TOO_LARGE' | 'RULE_NOT_FOUND' | 'HARD_RULE_VERIFIER_OWNED' | 'VERDICT_NOT_SET' | 'FINAL_VERDICT_FORBIDDEN' | 'REVIEWER_REQUIRED' | 'ISSUE_NOT_FOUND' | 'BAD_ACTION' | 'BAD_DRAFT' | 'CANDIDATE_NOT_FOUND';
export declare class ReviewToolError extends HarnessError {
    readonly code: ReviewToolErrorCode;
    constructor(code: ReviewToolErrorCode, message: string);
}
