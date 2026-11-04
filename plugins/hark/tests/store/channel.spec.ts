// Output channel split (2026-11-04, plan A): status grouping, bulk checklist adoption, dimension subscription.
import { afterEach, describe, expect, it } from 'vitest'
import { readFixture } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from './harness.js'

const opened: OpenedStore[] = []
const roots: string[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) await o.close()
  for (const r of roots.splice(0)) await removeRoot(r)
})

const open = async (overrides = {}): Promise<OpenedStore> => {
  const o = await openStore(overrides)
  opened.push(o)
  roots.push(o.root)
  return o
}

const CHECKLIST_RULES = new Set(['DOC-001', 'DOC-002', 'DOC-005', 'DOC-010', 'DOC-011', 'DOC-012'])

describe('review_status channel grouping (2026-11-04, plan A)', () => {
  it('splits issues into opinion and checklist without overlap or loss', async () => {
    const o = await open()
    const { reviewId } = await o.store.parse({ source: readFixture('seed.md') })
    await o.store.check(reviewId)
    const status = o.store.status(reviewId)

    const all = new Set(status.issues.map((i) => i.issueId))
    const opinion = new Set(status.opinionIssues)
    const checklist = new Set(status.checklistIssues)

    expect(checklist.size).toBeGreaterThan(0)
    for (const id of checklist) expect(opinion.has(id)).toBe(false)
    expect(new Set([...opinion, ...checklist]).size).toBe(all.size)
    expect(new Set([...opinion, ...checklist])).toEqual(all)
    for (const issue of status.issues.filter((i) => checklist.has(i.issueId))) {
      expect(CHECKLIST_RULES.has(issue.ruleId ?? '')).toBe(true)
    }
  })

  it('adopt_checklist adopts correction items only and leaves opinion items confirmed', async () => {
    const o = await open()
    const { reviewId } = await o.store.parse({ source: readFixture('seed.md') })
    await o.store.check(reviewId)
    const before = o.store.status(reviewId)

    const res = await o.store.decide(reviewId, { action: 'adopt_checklist' })
    expect(res.affected?.length).toBe(before.checklistIssues.length)
    expect(res.remainingOpinion?.length).toBe(before.opinionIssues.length)

    const after = o.store.status(reviewId)
    const byId = new Map(after.issues.map((i) => [i.issueId, i]))
    for (const id of after.checklistIssues) expect(byId.get(id)?.status).toBe('adopted')
    for (const id of after.opinionIssues) expect(byId.get(id)?.status).toBe('confirmed')
  })
})

describe('reviewDimensions subscription (2026-11-04, plan A)', () => {
  it('keeps only the subscribed dimensions in a review', async () => {
    const o = await open({ reviewDimensions: ['security'] })
    const { reviewId } = await o.store.parse({ source: readFixture('seed.md') })
    const report = await o.store.check(reviewId)

    const dimOf = new Map(o.store.effectiveRules().rules.map((r) => [r.id, r.dimension]))
    for (const issue of report.hardIssues) expect(dimOf.get(issue.ruleId ?? '')).toBe('security')
    const ruleIds = new Set(report.checklist.map((c) => c.ruleId))
    for (const ruleId of ruleIds) expect(dimOf.get(ruleId)).toBe('security')
  })

  it('checks every dimension when the list is empty', async () => {
    const o = await open({ reviewDimensions: [] })
    const { reviewId } = await o.store.parse({ source: readFixture('seed.md') })
    const report = await o.store.check(reviewId)
    const dims = new Set(report.checklist.map((c) => o.store.effectiveRules().rules.find((r) => r.id === c.ruleId)?.dimension))
    expect(dims.size).toBeGreaterThan(1)
  })
})
