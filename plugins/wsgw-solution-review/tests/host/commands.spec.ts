// Host-side commands (design.md §9): /review, /rules, /memory — pure text over the store, no model.
import { afterEach, describe, expect, it } from 'vitest'
import { commandHandlers } from '../../src/host/commands.js'
import { readFixture } from '../helpers.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'

const opened: OpenedStore[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) {
    await o.close()
    await removeRoot(o.root)
  }
})

async function rig() {
  const o = await openStore()
  opened.push(o)
  return { ...o, cmd: commandHandlers(o.store) }
}

describe('/review', () => {
  it('lists reviews with id / title / aiVerdict / finalVerdict / status, and shows the three-layer summary for one id', async () => {
    const r = await rig()
    const empty = await r.cmd.review('')
    expect(empty.kind).toBe('success')
    expect(empty.text).toContain('暂无')

    const { reviewId } = await r.store.parse({ source: readFixture('seed.md') })
    await r.store.check(reviewId)
    const list = await r.cmd.review('')
    expect(list.text).toContain(reviewId)
    expect(list.text).toContain('网上国网余额查询能力对AI版支付宝开放技术方案')
    expect(list.text).toContain('不通过')
    expect(list.text).toContain('open')

    const one = await r.cmd.review(` ${reviewId} `)
    expect(one.kind).toBe('success')
    expect(one.text).toContain('【预审结论（建议）】')
    expect(one.text).toContain('【问题明细】')
    expect(one.text).toContain('【检查清单】')
    expect(one.text).toContain('CAP-001')

    const missing = await r.cmd.review('rv_20261019_zzzzzz')
    expect(missing.kind).toBe('error')
  })
})

describe('/rules', () => {
  it('prints the effective rule table and filters by dimension or tier', async () => {
    const r = await rig()
    const all = await r.cmd.rules('')
    expect(all.kind).toBe('success')
    expect(all.text!.split('\n').filter((l) => /^\| [A-Z]{3}-\d{3}/.test(l))).toHaveLength(28)
    const hard = await r.cmd.rules('hard')
    expect(hard.text!.split('\n').filter((l) => /^\| [A-Z]{3}-\d{3}/.test(l))).toHaveLength(10)
    const cap = await r.cmd.rules('capacity')
    expect(cap.text).toContain('CAP-001')
    expect(cap.text).not.toContain('SEC-001')
    const bad = await r.cmd.rules('nothing-here')
    expect(bad.kind).toBe('error')
  })
})

describe('/memory', () => {
  it('shows stats, up to 5 exemplars and up to 3 recent reject reasons for a rule', async () => {
    const r = await rig()
    expect((await r.cmd.memory('')).kind).toBe('error')
    expect((await r.cmd.memory('ZZZ-000')).kind).toBe('error')
    const out = await r.cmd.memory('CAP-001')
    expect(out.kind).toBe('success')
    expect(out.text).toContain('CAP-001')
    expect(out.text).toContain('shown')
  })
})
