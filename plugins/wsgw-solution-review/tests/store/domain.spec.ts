// Storage domain `wsgw_solution_review` v1 (design.md §7) over the real JSON backend.
import { readFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DOMAIN_NAME,
  DOMAIN_VERSION,
  ISSUE_ID_RE,
  IssueRecordSchema,
  REVIEW_ID_RE,
  ReviewRecordSchema,
  candidateKey,
  exemplarKey,
  feedbackKey,
  issueKey,
  newReviewId,
  reviewDomain,
} from '../../src/store/domain.js'
import { readFixture, rulesDir } from '../helpers.js'
import { fixedDeps, openDomain, openStore, removeRoot, type OpenedStore } from './harness.js'

const opened: OpenedStore[] = []
const roots: string[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) await o.close()
  for (const r of roots.splice(0)) await removeRoot(r)
})

async function store(root?: string): Promise<OpenedStore> {
  const o = await openStore({}, root)
  opened.push(o)
  if (!roots.includes(o.root)) roots.push(o.root)
  return o
}

const validReview = {
  reviewId: 'rv_20261019_k3m7qa',
  title: 'T',
  docHash: 'h',
  source: '# T',
  status: 'open',
  aiVerdict: '通过',
  versions: [],
  metrics: { startedAt: '2026-10-19T08:00:00.000Z', toolCalls: 0, gateRejects: 0 },
  createdAt: '2026-10-19T08:00:00.000Z',
  rulePackVersion: '1.0.0',
}

const validIssue = {
  issueId: 'rv_20261019_k3m7qa#1',
  reviewId: 'rv_20261019_k3m7qa',
  ruleId: 'CAP-001',
  severity: 'major',
  tier: 'hybrid',
  origin: 'llm',
  finding: 'f',
  suggestion: 's',
  evidence: [{ quote: '12345678', kind: 'text' }],
  status: 'confirmed',
  gate: { passed: true, reasons: [] },
  seq: 1,
}

describe('reviewDomain schema (T-DES-07)', () => {
  it('rejects a review record without title / docHash / status via zod', () => {
    expect(ReviewRecordSchema.safeParse(validReview).success).toBe(true)
    for (const field of ['title', 'docHash', 'status'] as const) {
      const { [field]: _omit, ...rest } = validReview
      expect(ReviewRecordSchema.safeParse(rest).success, field).toBe(false)
    }
  })

  it('rejects an issue whose status is outside the IssueStatus enum', () => {
    expect(IssueRecordSchema.safeParse(validIssue).success).toBe(true)
    expect(IssueRecordSchema.safeParse({ ...validIssue, status: 'accepted' }).success).toBe(false)
  })

  it('rejects an issue whose evidence item lacks `kind`', () => {
    expect(IssueRecordSchema.safeParse({ ...validIssue, evidence: [{ quote: '12345678' }] }).success).toBe(false)
  })

  it('review key matches ^rv_\\d{8}_[a-z2-7]{6}$', () => {
    const id = newReviewId(new Date('2026-10-19T08:00:00Z'), () => 'k3m7qa')
    expect(id).toBe('rv_20261019_k3m7qa')
    expect(id).toMatch(REVIEW_ID_RE)
    expect(() => newReviewId(new Date(), () => 'ABC')).toThrow(/base32/)
  })

  it('issue key matches ^rv_\\d{8}_[a-z2-7]{6}#\\d+$ and feedback key appends #n', () => {
    const issue = issueKey('rv_20261019_k3m7qa', 3)
    expect(issue).toBe('rv_20261019_k3m7qa#3')
    expect(issue).toMatch(ISSUE_ID_RE)
    expect(feedbackKey(issue, 2)).toBe('rv_20261019_k3m7qa#3#2')
  })

  it('exemplar key is `${ruleId}#${issueId}`; rule_overrides key is the ruleId; rule_candidates key is rc_${reviewId}_${n}', () => {
    expect(exemplarKey('CAP-001', 'rv_20261019_k3m7qa#3')).toBe('CAP-001#rv_20261019_k3m7qa#3')
    expect(candidateKey('rv_20261019_k3m7qa', 1)).toBe('rc_rv_20261019_k3m7qa_1')
    expect(Object.keys(reviewDomain.tables).sort()).toEqual(
      ['eval_runs', 'exemplars', 'feedback', 'issues', 'reviews', 'rule_candidates', 'rule_overrides'].sort(),
    )
  })

  it('domain name is wsgw_solution_review and version is 1 (bump requires migrate-domain.mjs)', () => {
    expect(DOMAIN_NAME).toBe('wsgw_solution_review')
    expect(DOMAIN_VERSION).toBe(1)
    expect(reviewDomain.name).toBe(DOMAIN_NAME)
    expect(reviewDomain.version).toBe(DOMAIN_VERSION)
  })
})

describe('store persistence (T-REQ-18)', () => {
  it('records written through the domain are readable after re-opening the same storage path', async () => {
    const first = await store()
    const { reviewId } = await first.store.parse({ source: readFixture('seed.md') })
    await first.store.check(reviewId)
    const issuesBefore = [...first.store.domain.table('issues').entries()].length
    expect(issuesBefore).toBeGreaterThan(0)
    await first.close()
    opened.splice(opened.indexOf(first), 1)

    const second = await store(first.root)
    expect(second.store.domain.table('reviews').get(reviewId)?.title).toBe('网上国网余额查询能力对AI版支付宝开放技术方案')
    expect([...second.store.domain.table('issues').entries()].length).toBe(issuesBefore)
  })

  it('entries() filtering by reviewId returns only that review’s issues / feedback', async () => {
    const o = await store()
    const a = (await o.store.parse({ source: readFixture('seed.md') })).reviewId
    const b = (await o.store.parse({ source: readFixture('seed-no-impl.md'), title: '另一份方案' })).reviewId
    await o.store.check(a)
    await o.store.check(b)
    const issuesA = o.store.issuesOf(a)
    const issuesB = o.store.issuesOf(b)
    expect(issuesA.length).toBeGreaterThan(0)
    expect(issuesA.every((i) => i.reviewId === a)).toBe(true)
    expect(issuesB.every((i) => i.reviewId === b)).toBe(true)
    expect(issuesA.length + issuesB.length).toBe(o.store.domain.table('issues').size)
  })
})

describe('rule overrides persistence (T-REQ-16, T-DES-10)', () => {
  it('rules_propose(disable) writes status=retired to rule_overrides and check() no longer emits the rule', async () => {
    const o = await store()
    const seed = readFixture('seed.md')
    const before = await o.store.check((await o.store.parse({ source: seed })).reviewId)
    expect(before.checklist.some((c) => c.ruleId === 'CAP-001')).toBe(true)

    await o.store.rulesPropose({ action: 'disable', ruleId: 'CAP-001', who: 'tester' })
    expect(o.store.domain.table('rule_overrides').get('CAP-001')?.status).toBe('retired')

    const after = await o.store.check((await o.store.parse({ source: seed, reuse: false })).reviewId)
    expect(after.checklist.some((c) => c.ruleId === 'CAP-001')).toBe(false)
    expect(after.hardIssues.some((i) => i.ruleId === 'CAP-001')).toBe(false)
  })

  it('the shipped rules YAML file content is byte-identical before and after overrides', async () => {
    const file = join(rulesDir, 'capability-open-access.rules.yaml')
    const bytes = readFileSync(file)
    const o = await store()
    await o.store.rulesPropose({ action: 'set_severity', ruleId: 'CAP-002', severity: 'minor', who: 'tester' })
    await o.store.rulesPropose({ action: 'disable', ruleId: 'CAP-003', who: 'tester' })
    expect(o.store.rulesList({}).rules.find((r) => r.ruleId === 'CAP-002')?.severity).toBe('minor')
    expect(readFileSync(file).equals(bytes)).toBe(true)
  })

  it('every override write appends an audit entry {who, at, reviewId?, change}', async () => {
    const o = await store()
    await o.store.rulesPropose({ action: 'disable', ruleId: 'CAP-001', who: 'tester' })
    await o.store.rulesPropose({ action: 'enable', ruleId: 'CAP-001', who: 'tester', reviewId: 'rv_20261019_k3m7qa' })
    const audit = o.store.domain.table('rule_overrides').get('CAP-001')?.audit ?? []
    expect(audit).toHaveLength(2)
    expect(audit[0]).toMatchObject({ who: 'tester', at: fixedDeps.now!().toISOString(), change: { field: 'status', from: 'active', to: 'retired' } })
    expect(audit[1]).toMatchObject({ who: 'tester', reviewId: 'rv_20261019_k3m7qa', change: { field: 'status', from: 'retired', to: 'active' } })
  })
})

describe('domain facility', () => {
  it('opens and closes on an empty directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wsgw-empty-'))
    roots.push(root)
    const o = await openDomain(root)
    expect(o.domain.table('reviews').size).toBe(0)
    await o.close()
  })
})
