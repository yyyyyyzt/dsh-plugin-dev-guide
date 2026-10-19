// T-REQ-01 / T-DES-01: Markdown → Doc with heading paths, ranges, tables, mermaid, images, stats.
import { beforeAll, describe, expect, it } from 'vitest'
import { docFrom, loadDoc } from '../helpers.js'
import type { Doc } from '../../src/engine/types.js'

describe('parseMarkdown on the seed solution (T-REQ-01)', () => {
  let doc: Doc
  beforeAll(() => {
    doc = loadDoc('seed.md')
  })

  it('takes the title from the first H1', () => {
    expect(doc.title).toBe('网上国网余额查询能力对AI版支付宝开放技术方案')
  })

  it('builds a three-level heading tree with template paths', () => {
    const paths = new Set<string>()
    const walk = (nodes: typeof doc.headings) => {
      for (const n of nodes) {
        paths.add(n.path)
        walk(n.children)
      }
    }
    walk(doc.headings)
    expect(paths).toContain('一')
    expect(paths).toContain('二')
    expect(paths).toContain('二/2.1')
    expect(paths).toContain('二/2.1/2.1.1')
    expect(paths).toContain('二/2.5')
    expect(paths).toContain('三')
    expect(doc.stats.headings).toBe(12)
  })

  it('finds the resources table with 6 data rows and the interface tables', () => {
    const resources = doc.tables.find((t) => t.header.includes('变更类型'))
    expect(resources).toBeDefined()
    expect(resources!.rows).toHaveLength(6)
    expect(resources!.rows[1]).toEqual(['2', '微服务', '修改', 'emss-uia-channel-front', '外网', '/', '/'])
    expect(resources!.sectionPath).toBe('')
    const paramTables = doc.tables.filter((t) => t.sectionPath.startsWith('二/2.1/2.1.2'))
    expect(paramTables.length).toBeGreaterThanOrEqual(4)
  })

  it('has no mermaid block (the seed uses images described in prose)', () => {
    expect(doc.mermaid).toHaveLength(0)
    expect(doc.stats.mermaid).toBe(0)
  })

  it('computes a stable content hash', () => {
    expect(doc.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(loadDoc('seed.md').hash).toBe(doc.hash)
    expect(loadDoc('seed-no-impl.md').hash).not.toBe(doc.hash)
  })

  it('keeps the original source verbatim', () => {
    expect(doc.source.startsWith('# 网上国网余额查询能力对AI版支付宝开放技术方案')).toBe(true)
    expect(doc.stats.bytes).toBe(Buffer.byteLength(doc.source, 'utf8'))
  })
})

describe('heading ranges (T-DES-01)', () => {
  let doc: Doc
  beforeAll(() => {
    doc = loadDoc('seed.md')
  })

  function find(path: string) {
    const stack = [...doc.headings]
    while (stack.length) {
      const n = stack.pop()!
      if (n.path === path) return n
      stack.push(...n.children)
    }
    throw new Error(`no heading ${path}`)
  }

  it('bodyRange of 二/2.1/2.1.1 covers the auth paragraph and ends before 2.1.2', () => {
    const node = find('二/2.1/2.1.1')
    const body = doc.source.slice(node.bodyRange.start.offset, node.bodyRange.end.offset)
    expect(body).toContain('用户中心依据客户端获取阿宝的一次性授权码')
    expect(body).not.toContain('#### 2.1.2 接口设计')
  })

  it('bodyRange of a parent includes its children', () => {
    const parent = find('二/2.1')
    const child = find('二/2.1/2.1.2')
    expect(parent.bodyRange.start.offset).toBeLessThanOrEqual(child.range.start.offset)
    expect(parent.bodyRange.end.offset).toBeGreaterThanOrEqual(child.bodyRange.end.offset)
  })

  it('assigns sectionPath to paragraphs and tables', () => {
    const para = doc.blocks.find((b) => b.type === 'paragraph' && b.text.includes('静态资源 H5 卡片部署'))
    expect(para && para.type === 'paragraph' ? para.sectionPath : undefined).toBe('二/2.5')
  })
})

describe('parseMarkdown on small inputs', () => {
  it('records images with their section', () => {
    const doc = docFrom('## 技术思路\n\n![时序图](seq.png)\n')
    expect(doc.images).toHaveLength(1)
    expect(doc.images[0]!.alt).toBe('时序图')
    expect(doc.images[0]!.sectionPath).toBe('技术思路')
    expect(doc.stats.images).toBe(1)
  })

  it('separates mermaid from other fenced code', () => {
    const doc = docFrom('```mermaid\nsequenceDiagram\n  A->>B: hi\n  B-->>A: yo\n```\n\n```json\n{}\n```\n')
    expect(doc.mermaid).toHaveLength(1)
    expect(doc.mermaid[0]!.kind).toBe('sequence')
    expect(doc.blocks.filter((b) => b.type === 'code')).toHaveLength(1)
  })

  it('uses heading text as path when the template numbering is absent', () => {
    const doc = docFrom('# T\n\n## 背景\n\n### 细节\n\n正文\n')
    const para = doc.blocks.find((b) => b.type === 'paragraph')
    expect(para && para.type === 'paragraph' ? para.sectionPath : undefined).toBe('背景/细节')
  })
})
