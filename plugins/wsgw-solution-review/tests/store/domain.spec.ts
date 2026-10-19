// Storage domain `wsgw_solution_review` v1 — needs @deepseek-ai/dsh-storage-domain (added in S3b).
// Specs are declared now (names = T-IDs + behaviour) and activated once src/store/domain.ts exists.
import { describe, it } from 'vitest'

describe('reviewDomain schema (T-DES-07)', () => {
  it.todo('rejects a review record without title / docHash / status via zod')
  it.todo('rejects an issue whose status is outside the IssueStatus enum')
  it.todo('rejects an issue whose evidence item lacks `kind`')
  it.todo('review key matches ^rv_\\d{8}_[a-z2-7]{6}$')
  it.todo('issue key matches ^rv_\\d{8}_[a-z2-7]{6}#\\d+$ and feedback key appends #n')
  it.todo('exemplar key is `${ruleId}#${issueId}`; rule_overrides key is the ruleId; rule_candidates key is rc_${reviewId}_${n}')
  it.todo('domain name is wsgw_solution_review and version is 1 (bump requires migrate-domain.mjs)')
})

describe('store persistence (T-REQ-18)', () => {
  it.todo('records written through the domain are readable after re-opening the same storage path')
  it.todo('entries() filtering by reviewId returns only that review’s issues / feedback')
})

describe('rule overrides persistence (T-REQ-16, T-DES-10)', () => {
  it.todo('rules_propose(disable) writes status=retired to rule_overrides and check() no longer emits the rule')
  it.todo('the shipped rules YAML file content is byte-identical before and after overrides')
  it.todo('every override write appends an audit entry {who, at, reviewId?, change}')
})
