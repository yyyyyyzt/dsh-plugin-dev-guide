// Tool layer (defineTool handlers over a mocked ctx) — needs the DSH runtime packages added in S3b.
import { describe, it } from 'vitest'

describe('review_parse (T-REQ-02, T-REQ-03)', () => {
  it.todo('inline source under maxSourceBytes (200 KB) → reviewId + outline + stats')
  it.todo('inline source over maxSourceBytes → ReviewToolError SOURCE_TOO_LARGE, nothing written')
  it.todo('path source is read through ctx.fs, not node:fs')
  it.todo('same docHash without reuse → returns existingReviewId and does not create a second review')
  it.todo('same docHash with reuse=false → creates a new reviewId and keeps the old record')
  it.todo('reviewId format rv_<yyyymmdd>_<base32-6>')
})

describe('review_check (T-REQ-06)', () => {
  it.todo('persists hard/hybrid auto-fail issues with origin verifier and updates reviews.aiVerdict')
  it.todo('returns hybridCandidates with snippets and softRules with questions; neither is persisted as an issue')
  it.todo('re-running check on the same review replaces verifier-origin issues instead of duplicating them')
  it.todo('unknown reviewId → REVIEW_NOT_FOUND')
})

describe('review_record_issue (T-REQ-07, T-RUL-09)', () => {
  it.todo('hybrid quote inside a candidate → status confirmed, gate.passed true, resolvedEvidence with range')
  it.todo('hybrid quote outside candidates → status pending, gate.reasons [OUT_OF_CANDIDATES]')
  it.todo('no ruleId → tier soft, status pending, gate.reasons [NO_RULE]')
  it.todo('soft ruleId → status pending, gate.reasons [SOFT_RULE]')
  it.todo('hard ruleId → HARD_RULE_VERIFIER_OWNED and nothing written')
  it.todo('unknown ruleId → RULE_NOT_FOUND')
  it.todo('severity defaults to the rule severity when omitted')
  it.todo('increments reviews.metrics.gateRejects on gate failure')
})

describe('review_status (T-REQ-08)', () => {
  it.todo('returns aiVerdict, one-line summary, issues[], checklist[], counts without writing')
  it.todo('aiVerdict is recomputed from current issue statuses (rejected excluded)')
})

describe('review_decide (T-REQ-09, T-REQ-12, T-REQ-13, T-PRO-04, T-PRO-05, T-DES-08)', () => {
  it.todo('adopt → issue.status adopted + feedback(adopt)')
  it.todo('reject with reason → issue.status rejected + feedback(reject, reason)')
  it.todo('rewrite with text → issue.status rewritten, rewriteText set + feedback(rewrite, text)')
  it.todo('add → new issue with origin expert, tier expert, status adopted, seq continues')
  it.todo('adopt_rest → only issues still confirmed/pending become adopted; decided ones untouched')
  it.todo('a later decision on the same issue overrides the earlier one and keeps both feedback rows')
  it.todo('set_reviewer writes reviews.reviewer')
  it.todo('set_final_verdict without reviewer and without defaultReviewer → REVIEWER_REQUIRED')
  it.todo('set_final_verdict writes finalVerdict and verdictDelta when it differs from aiVerdict')
  it.todo('set_final_verdict is the only writer: any other tool trying to set finalVerdict → FINAL_VERDICT_FORBIDDEN')
  it.todo('unknown action → BAD_ACTION; unknown issueId → ISSUE_NOT_FOUND')
  it.todo('free-text answer normalisation maps 「采纳（推荐）」→ adopt and other text → rewrite')
})

describe('review_finalize (T-DES-09, T-REQ-14, T-REQ-15)', () => {
  it.todo('without finalVerdict → VERDICT_NOT_SET')
  it.todo('writes reviews/<reviewId>.md through ctx.fs, then updates reviews (status finalized, opinionPath, versions[])')
  it.todo('when the file write fails the review record is unchanged')
  it.todo('second finalize writes -v2.md and appends to versions[]')
  it.todo('refreshes memory: exemplars (adopt/rewrite texts, capped per rule), rule_candidates from expert adds, rule_overrides.stats')
  it.todo('returns { opinionPath, version, counts, memory } and does not call present itself')
})

describe('rules_list / rules_propose / memory_recall (T-DES-10, T-REQ-10)', () => {
  it.todo('rules_list merges shipped + overrides and filters by dimension / tier / status')
  it.todo('rules_propose(draft) validates the YAML with the rule schema and stores status draft')
  it.todo('rules_propose(accept_draft) flips status to active; dismiss marks the candidate dismissed')
  it.todo('memory_recall warn = rejectRatio ≥ 0.6 && shown ≥ 5 with default config')
})
