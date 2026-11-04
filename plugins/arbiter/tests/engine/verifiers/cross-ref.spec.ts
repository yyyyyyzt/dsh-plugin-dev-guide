// T-RUL-07: cross-ref verifier — resolvable references pass; dangling 「附件 4」 fails with one evidence per
// dangling ref; missing list section → absence.
import { describe, expect, it } from 'vitest'
import { verifyCrossRef } from '../../../src/engine/verifiers/cross-ref.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

const list = '附件 1：UE 图；附件 2：接口文档；附件 3：MCP 服务托管配置。'

describe('verifyCrossRef (T-RUL-07)', () => {
  it('passes when every body reference resolves to a list item', () => {
    const doc = sectionsDoc({ 接口设计: '提供首页余额查询接口，详情见附件 2。', 附件: list })
    const r = verifyCrossRef(doc, {}, miniLexicon)
    expect(r.status).toBe('pass')
    expect(r.evidence.length).toBeGreaterThanOrEqual(1)
  })

  it('fails with one text evidence per dangling reference, quoting the reference', () => {
    const doc = sectionsDoc({
      接口设计: '详情见附件 2，字段说明见附件 4。',
      风险评估: '风险清单见附件 5。',
      附件: list,
    })
    const r = verifyCrossRef(doc, {}, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence).toHaveLength(2)
    expect(r.evidence.map((e) => e.quote)).toEqual(['附件 4', '附件 5'])
    expect(r.evidence[0]!.kind).toBe('text')
    expect(r.evidence[0]!.sectionPath).toBe('一')
    expect(r.evidence[1]!.sectionPath).toBe('二')
  })

  it('does not treat list items themselves as references', () => {
    const doc = sectionsDoc({ 工作背景: '无引用。', 附件: list })
    expect(verifyCrossRef(doc, {}, miniLexicon).status).toBe('pass')
  })

  it('fails with absence when the attachments section is missing and requireListNonEmpty is true', () => {
    const doc = sectionsDoc({ 接口设计: '详情见附件 2。' })
    const r = verifyCrossRef(doc, {}, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('absence')
    expect(r.evidence[0]!.quote).toContain('附件')
  })

  it('passes without a list when there are no references and requireListNonEmpty is false', () => {
    const doc = sectionsDoc({ 接口设计: '无引用。' })
    expect(verifyCrossRef(doc, { requireListNonEmpty: false }, miniLexicon).status).toBe('pass')
  })

  it('matches Chinese and full-width numerals in references and list items', () => {
    const doc = sectionsDoc({ 接口设计: '详见附件二与附件３。', 附件: '附件2：接口文档；附件 3：配置。' })
    const r = verifyCrossRef(doc, {}, miniLexicon)
    expect(r.status).toBe('pass')
  })

  it('accepts custom patterns (prototype list for DOC-002)', () => {
    const doc = sectionsDoc({ 技术思路: '优化前后对比见原型 1。', 附件: '原型 1：首页改版对比图。' })
    const r = verifyCrossRef(
      doc,
      { refPattern: '原型\\s*([0-9]+)', listItemPattern: '原型\\s*([0-9]+)\\s*[:：]' },
      miniLexicon,
    )
    expect(r.status).toBe('pass')
  })
})
