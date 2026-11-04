// T-DES-02: normalize is idempotent; full-width → half-width; emphasis stripped; offsets map back.
import { describe, expect, it } from 'vitest'
import { findQuote, normalize, normalizeWithMap, splitSentences } from '../../src/engine/normalize.js'

describe('normalize (T-DES-02)', () => {
  it('collapses whitespace and trims', () => {
    expect(normalize('  上线前\n\n建议   开展压测 ')).toBe('上线前 建议 开展压测')
  })

  it('converts full-width punctuation and NFKC forms to half-width', () => {
    expect(normalize('ＱＰＳ：８００（峰值）')).toBe('QPS:800(峰值)')
  })

  it('strips markdown emphasis markers but keeps the text', () => {
    expect(normalize('**（1）用户鉴权** 与 _登录_ 以及 `token`')).toBe('(1)用户鉴权 与 登录 以及 token')
  })

  it('is idempotent', () => {
    const once = normalize('**无需扩容**　资源。')
    expect(normalize(once)).toBe(once)
  })

  it('maps normalized indices back to source offsets', () => {
    const src = 'A  **B**　C'
    const n = normalizeWithMap(src)
    expect(n.text).toBe('A B C')
    expect(n.toSourceOffset(0)).toBe(0)
    expect(src[n.toSourceOffset(2)]).toBe('B')
    expect(src[n.toSourceOffset(4)]).toBe('C')
  })
})

describe('findQuote (T-DES-02, T-DES-06)', () => {
  const source = '## 2.5 资源评估\n\n静态资源 H5 卡片部署，初步评估**无需扩容**资源。\n'

  it('finds a quote whose spacing and emphasis differ from the source', () => {
    const range = findQuote(source, '初步评估 无需扩容 资源')
    expect(range).not.toBeNull()
    expect(source.slice(range!.start.offset, range!.end.offset)).toBe('初步评估**无需扩容**资源')
    expect(range!.start.line).toBe(3)
  })

  it('returns null when the quote is not in the source', () => {
    expect(findQuote(source, '已完成压测并通过')).toBeNull()
  })

  it('restricts the search to a range when given', () => {
    const headingOnly = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 12, offset: 11 } }
    expect(findQuote(source, '无需扩容', headingOnly)).toBeNull()
  })
})

describe('splitSentences (rule-schema §3.3)', () => {
  it('splits on Chinese and ASCII sentence terminators and newlines, keeping offsets', () => {
    const text = '第一句。第二句；第三句\n第四句'
    const parts = splitSentences(text)
    expect(parts.map((p) => p.text)).toEqual(['第一句', '第二句', '第三句', '第四句'])
    expect(text.slice(parts[2]!.start, parts[2]!.end)).toBe('第三句')
  })
})
