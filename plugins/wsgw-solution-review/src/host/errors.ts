// Tool-facing errors (design.md §8): a HarnessError subclass so the DSH tool runtime routes on `code`.
import { HarnessError } from '@deepseek-ai/dsh-llm'

export type ReviewToolErrorCode =
  | 'REVIEW_NOT_FOUND'
  | 'SOURCE_TOO_LARGE'
  | 'RULE_NOT_FOUND'
  | 'HARD_RULE_VERIFIER_OWNED'
  | 'VERDICT_NOT_SET'
  | 'FINAL_VERDICT_FORBIDDEN'
  | 'REVIEWER_REQUIRED'
  | 'ISSUE_NOT_FOUND'
  | 'BAD_ACTION'
  | 'BAD_DRAFT'
  | 'CANDIDATE_NOT_FOUND'

export class ReviewToolError extends HarnessError {
  override readonly code: ReviewToolErrorCode

  constructor(code: ReviewToolErrorCode, message: string) {
    super(message, code)
    this.code = code
    this.name = 'ReviewToolError'
  }
}
