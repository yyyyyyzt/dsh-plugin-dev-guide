// Dashboard API payload shapes (design.md §10), shared by the host routes and the client views.
import type { ChecklistEntry, Feedback, Verdict } from '../engine/types.js'
import type { IssueRecord, ReviewRecord } from '../store/domain.js'
import type { RulePackLoadError } from './rules-loader.js'
import type { RuleView, StatusResult } from './store.js'

/** The review record as the dashboard sees it: no source text, no internal bookkeeping. */
export type ReviewView = Pick<ReviewRecord, 'reviewId' | 'title' | 'status' | 'aiVerdict' | 'versions' | 'metrics' | 'createdAt' | 'rulePackVersion'>
  & Partial<Pick<ReviewRecord, 'reviewer' | 'aiVerdictAtFinalize' | 'finalVerdict' | 'verdictDelta' | 'opinionPath' | 'warnings'>>

export interface ReviewCounts {
  total: number
  confirmed: number
  pending: number
  adopted: number
  rejected: number
  rewritten: number
}

export interface RulesPayload {
  rules: RuleView[]
  warnings: string[]
  loadErrors: RulePackLoadError[]
  version: string
}

export interface ReviewListPayload {
  items: (ReviewView & { counts: ReviewCounts })[]
  page: number
  total: number
}

export interface ReviewDetailPayload {
  review: ReviewView
  issues: IssueRecord[]
  checklist: ChecklistEntry[]
  checklistCounts: StatusResult['checklistCounts']
  counts: StatusResult['counts']
  basis: string
  summary: string
  feedback: Feedback[]
}

export type ReviewState = 'open' | 'finalized' | 'stale'

/** `stale` = reopened by a decision after finalize: the opinion file on disk no longer matches. */
export function reviewState(review: Pick<ReviewRecord, 'status' | 'versions'>): ReviewState {
  if (review.status === 'finalized') return 'finalized'
  return review.versions.length > 0 ? 'stale' : 'open'
}

export interface ReviewStamp {
  reviewId: string
  title: string
  createdAt: string
  finalizedAt?: string
  state: ReviewState
  aiVerdict: Verdict
  aiVerdictAtFinalize?: Verdict
  finalVerdict?: Verdict
  reviewer?: string
  counts: ReviewCounts
}

export interface OverviewPayload {
  items: ReviewStamp[]
  total: number
  truncated: boolean
  generatedAt: string
}
