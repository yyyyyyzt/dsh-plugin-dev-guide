// T-RUL-03 / T-REQ-05: table verifier — locate by header/section, placeholder cells, requireRow.
import { describe, expect, it } from 'vitest'
import { verifyTable } from '../../../src/engine/verifiers/table.js'
import { docFrom, miniLexicon, sectionsDoc } from '../../helpers.js'

const resourcesTable = `| 序号 | 资源名称 | 变更类型 | 名称 | 网络区域 | 备注 | 负责人 |
|---|---|---|---|---|---|---|
| 1 | 微服务 | 新增 | emss-uia-balance | 外网 | / | / |
| 2 | 微服务 | 修改 | emss-uia-channel-front | 外网 | / | / |
| 3 | 数据库 | / | / | / | / | / |`

const paramTable = `| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| openId | String | 是 | 用户标识 |
| channelCode | String | / | 渠道编号 |`

const resultTable = `| 字段 | 类型 | 说明 |
|---|---|---|
| resultCode | String | 返回码 |
| data | Object | 余额信息 |`

describe('verifyTable (T-RUL-03, T-REQ-05)', () => {
  it('locates the resources table anywhere in the doc by headerAny and passes with placeholderCells: ignore', () => {
    const doc = docFrom(`# 方案\n\n${resourcesTable}\n\n## 一、工作背景\n\n正文。`)
    const r = verifyTable(
      doc,
      {
        locate: { headerAny: ['资源名称', '变更类型'] },
        requiredColumns: [['资源名称'], ['变更类型'], ['名称']],
        minRows: 1,
        placeholderCells: 'ignore',
      },
      miniLexicon,
    )
    expect(r.status).toBe('pass')
    expect(r.evidence[0]?.kind).toBe('table-cell')
  })

  it('fails on placeholder cells in required columns when placeholderCells is fail (default), quoting the cell', () => {
    const doc = docFrom(`# 方案\n\n${resourcesTable}`)
    const r = verifyTable(
      doc,
      { locate: { headerAny: ['资源名称'] }, requiredColumns: [['变更类型'], ['名称']] },
      miniLexicon,
    )
    expect(r.status).toBe('fail')
    expect(r.evidence.length).toBeGreaterThanOrEqual(1)
    expect(r.evidence.every((e) => e.kind === 'table-cell')).toBe(true)
    expect(r.evidence[0]!.quote).toBe('/')
    expect(r.evidence[0]!.range).toBeDefined()
  })

  it('fails with absence evidence when no table matches locate.section + headerAny', () => {
    const doc = sectionsDoc({ 接口设计: '接口说明见附件。', 资源评估: resourcesTable })
    const r = verifyTable(doc, { locate: { section: 'interface', headerAny: ['参数'] } }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('absence')
    expect(r.evidence[0]!.sectionPath).toBe('一')
  })

  it('fails when a required column group has no alias in the header, naming the group', () => {
    const doc = sectionsDoc({ 接口设计: paramTable })
    const r = verifyTable(
      doc,
      {
        locate: { section: 'interface', headerAny: ['参数'] },
        requiredColumns: [['参数名', '字段'], ['类型'], ['默认值', '缺省值']],
        placeholderCells: 'ignore',
      },
      miniLexicon,
    )
    expect(r.status).toBe('fail')
    expect(r.note).toMatch(/默认值/)
  })

  it('accepts column aliases from requiredColumns groups', () => {
    const doc = sectionsDoc({ 接口设计: paramTable.replace('参数名', '参数名称').replace('必填', '是否非空') })
    const r = verifyTable(
      doc,
      {
        locate: { section: 'interface', headerAny: ['参数'] },
        requiredColumns: [['参数名', '参数名称', '字段'], ['类型', '数据格式'], ['必填', '是否非空', '是否必填']],
        placeholderCells: 'ignore',
      },
      miniLexicon,
    )
    expect(r.status).toBe('pass')
  })

  it('fails when the table has fewer than minRows data rows', () => {
    const doc = sectionsDoc({ 接口设计: '| 参数名 | 类型 |\n|---|---|' })
    const r = verifyTable(doc, { locate: { section: 'interface', headerAny: ['参数'] }, minRows: 1 }, miniLexicon)
    expect(r.status).toBe('fail')
  })

  it('requireRow passes when some row has one of equalsAny in the named column', () => {
    const doc = sectionsDoc({ 接口设计: `${paramTable}\n\n返回：\n\n${resultTable}` })
    const r = verifyTable(
      doc,
      {
        locate: { section: 'interface', headerAny: ['返回', '输出', '字段'] },
        requireRow: { column: ['字段', '参数'], equalsAny: ['resultCode', 'code', '返回码'] },
      },
      miniLexicon,
    )
    expect(r.status).toBe('pass')
    expect(r.evidence[0]!.quote).toBe('resultCode')
  })

  it('requireRow fails when no row matches', () => {
    const doc = sectionsDoc({ 接口设计: resultTable.replace('resultCode', 'status') })
    const r = verifyTable(
      doc,
      {
        locate: { section: 'interface', headerAny: ['字段'] },
        requireRow: { column: ['字段'], equalsAny: ['resultCode'] },
      },
      miniLexicon,
    )
    expect(r.status).toBe('fail')
    expect(r.note).toMatch(/resultCode/)
  })

  it('compares header cells after normalization (full-width / emphasis)', () => {
    const doc = sectionsDoc({ 接口设计: paramTable.replace('| 参数名 |', '| **参数名** |') })
    const r = verifyTable(
      doc,
      { locate: { section: 'interface', headerAny: ['参数'] }, requiredColumns: [['参数名']], placeholderCells: 'ignore' },
      miniLexicon,
    )
    expect(r.status).toBe('pass')
  })
})
