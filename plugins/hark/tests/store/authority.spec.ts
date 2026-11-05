// Authority-changing rule edits (2026-11-05, plan B): severity and status may only move on a quoted
// expert instruction, and the quotation is written to the audit trail.
import { afterEach, describe, expect, it } from 'vitest'
import { openStore, removeRoot, type OpenedStore } from './harness.js'

const opened: OpenedStore[] = []
const roots: string[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) await o.close()
  for (const r of roots.splice(0)) await removeRoot(r)
})

const open = async (): Promise<OpenedStore> => {
  const o = await openStore()
  opened.push(o)
  roots.push(o.root)
  return o
}

const QUOTE = '把 SEC-003 的严重级别提到 major，这条必须拦。'

describe('authority-changing rule edits require a quotable instruction', () => {
  it('refuses set_severity without a basis quote', async () => {
    const o = await open()
    await expect(
      o.store.rulesPropose({ action: 'set_severity', ruleId: 'SEC-003', severity: 'major', who: 'agent' }),
    ).rejects.toMatchObject({ code: 'AUTHORITY_UNCONFIRMED' })
    expect(o.store.ruleDetail('SEC-003').detail.override?.severity).toBeUndefined()
  })

  it('refuses a basis quote shorter than eight characters', async () => {
    const o = await open()
    await expect(
      o.store.rulesPropose({
        action: 'set_severity',
        ruleId: 'SEC-003',
        severity: 'major',
        basis: { quote: '  改 major  ' },
        who: 'agent',
      }),
    ).rejects.toMatchObject({ code: 'AUTHORITY_UNCONFIRMED' })
  })

  it('refuses disable without a basis quote and leaves the rule active', async () => {
    const o = await open()
    await expect(
      o.store.rulesPropose({ action: 'disable', ruleId: 'CFG-001', who: 'agent' }),
    ).rejects.toMatchObject({ code: 'AUTHORITY_UNCONFIRMED' })
    expect(o.store.ruleDetail('CFG-001').rule.status).toBe('active')
  })

  it('applies the change and records the quotation when the expert said so', async () => {
    const o = await open()
    const result = await o.store.rulesPropose({
      action: 'set_severity',
      ruleId: 'SEC-003',
      severity: 'blocker',
      basis: { quote: QUOTE },
      who: 'reviewer-07',
    })
    expect(result.rule.severity).toBe('blocker')

    const detail = o.store.ruleDetail('SEC-003')
    expect(detail.detail.override?.severity).toBe('blocker')
    const last = detail.detail.audit.at(-1)
    expect(last?.who).toBe('reviewer-07')
    expect(last?.basis).toBe(QUOTE.trim())
    expect(last?.change).toMatchObject({ field: 'severity', to: 'blocker' })
  })

  it('does not ask for a basis on edits that widen nothing', async () => {
    const o = await open()
    const result = await o.store.rulesPropose({
      action: 'set_suggestion',
      ruleId: 'SEC-003',
      suggestion: '说明实名认证的两次校验时机与失败回退路径。',
      who: 'agent',
    })
    expect(result.ok).toBe(true)
    expect(o.store.ruleDetail('SEC-003').detail.audit.at(-1)?.basis).toBeUndefined()
  })
})
