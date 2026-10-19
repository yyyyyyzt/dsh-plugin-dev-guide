// T-RUL-05: quantity verifier — qualitative volume → fail(assertion-only); number+unit near context → pass; no context → absence.
import { describe, expect, it } from 'vitest'
import { verifyQuantity } from '../../../src/engine/verifiers/quantity.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

const params = { sections: ['data-plan', 'resources'], contextFamilies: ['volume'] }

describe('verifyQuantity (T-RUL-05)', () => {
  it('fails on 「大量新增用户」 with the sentence as text evidence and note mentioning assertion-only', () => {
    const doc = sectionsDoc({
      数据规划: '数据增长估算：支付宝智能体通过授权方式给网上国网带来新增用户，上线前期会带来大量新增用户。',
    })
    const r = verifyQuantity(doc, params, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('text')
    expect(r.evidence[0]!.quote).toContain('上线前期会带来大量新增用户')
    expect(r.note).toMatch(/assertion-only|无数字|未量化/)
  })

  it('passes on a number + unit within window of a context word', () => {
    const doc = sectionsDoc({ 数据规划: '预计上线首月新增用户 50 万，日均余额查询请求量 120 万次，峰值并发 800 QPS。' })
    const r = verifyQuantity(doc, params, miniLexicon)
    expect(r.status).toBe('pass')
    expect(r.evidence[0]!.kind).toBe('text')
    expect(r.evidence[0]!.quote).toContain('新增用户 50 万')
  })

  it('fails with absence when no context family word appears in the sections', () => {
    const doc = sectionsDoc({ 数据规划: '数据流转与现有架构一致。', 资源评估: '无需扩容。' })
    const r = verifyQuantity(doc, params, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('absence')
    expect(r.evidence[0]!.quote).toContain('volume')
  })

  it('does not count numbers that are farther than window from the context word', () => {
    const doc = sectionsDoc({
      数据规划: `新增用户${'的规模尚不明确，'.repeat(6)}版本号为 2.0 次迭代。`,
    })
    const r = verifyQuantity(doc, { ...params, window: 10 }, miniLexicon)
    expect(r.status).toBe('fail')
  })

  it('accepts full-width digits and custom units', () => {
    const doc = sectionsDoc({ 资源评估: '预计并发 ８００ 路。' })
    expect(verifyQuantity(doc, { ...params, units: ['路'] }, miniLexicon).status).toBe('pass')
    expect(verifyQuantity(doc, params, miniLexicon).status).toBe('fail')
  })

  it('ignores sections outside params.sections', () => {
    const doc = sectionsDoc({ 工作背景: '目前用户量 300 万。', 数据规划: '新增用户较多。' })
    expect(verifyQuantity(doc, params, miniLexicon).status).toBe('fail')
  })
})
