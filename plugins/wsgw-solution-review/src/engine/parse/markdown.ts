// Markdown → Doc (design.md §4, T-REQ-01, T-DES-01). Built on mdast + GFM tables; positions come from mdast.
import { createHash } from 'node:crypto'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { Nodes, Parent, RootContent, Table } from 'mdast'
import type { Block, Doc, HeadingNode, ImageRef, MermaidBlock, Range, TableBlock } from '../types.js'
import { parseMermaid } from './mermaid.js'

const CJK_NUMBER = /^([一二三四五六七八九十百]+)\s*[、.．:：]\s*/
const ARABIC_NUMBER = /^(\d+(?:\.\d+)*)[.、]?\s+/

/** Path segment of a heading: template numbering (「一」「2.1.1」) when present, else the heading text. */
export function headingSegment(text: string): string {
  const t = text.trim()
  const cjk = CJK_NUMBER.exec(t)
  if (cjk) return cjk[1]!
  const num = ARABIC_NUMBER.exec(t)
  if (num) return num[1]!
  return t
}

/** Heading text with template numbering removed (used for alias matching). */
export function headingTitle(text: string): string {
  return text.trim().replace(CJK_NUMBER, '').replace(ARABIC_NUMBER, '').trim()
}

function textOf(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if (node.type === 'image') return ''
  if (node.type === 'break') return '\n'
  if ('children' in node) return (node as Parent).children.map((c) => textOf(c as Nodes)).join('')
  return ''
}

function rangeOfNode(node: Nodes, source: string): Range {
  const p = node.position
  if (!p) {
    const end = { line: 1, column: 1, offset: 0 }
    return { start: end, end }
  }
  return {
    start: { line: p.start.line, column: p.start.column, offset: p.start.offset ?? 0 },
    end: { line: p.end.line, column: p.end.column, offset: p.end.offset ?? source.length },
  }
}

function collectImages(node: Nodes, sectionPath: string, source: string, out: ImageRef[]): void {
  if (node.type === 'image') {
    out.push({ alt: node.alt ?? '', range: rangeOfNode(node, source), sectionPath })
    return
  }
  if ('children' in node) for (const c of (node as Parent).children) collectImages(c as Nodes, sectionPath, source, out)
}

function tableBlock(node: Table, sectionPath: string, source: string): TableBlock {
  const rows = node.children.map((row) => row.children.map((cell) => textOf(cell as Nodes).trim()))
  const cellRanges = node.children.map((row) => row.children.map((cell) => rangeOfNode(cell as Nodes, source)))
  return {
    header: rows[0] ?? [],
    rows: rows.slice(1),
    range: rangeOfNode(node, source),
    cellRanges,
    sectionPath,
  }
}

export function parseMarkdown(source: string): Doc {
  const tree = fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const endOffset = { line: source.split('\n').length, column: 1, offset: source.length }

  const blocks: Block[] = []
  const roots: HeadingNode[] = []
  const tables: TableBlock[] = []
  const mermaid: MermaidBlock[] = []
  const images: ImageRef[] = []
  const stack: HeadingNode[] = []
  const allHeadings: HeadingNode[] = []
  let title = ''
  let paragraphs = 0

  const currentPath = (): string => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.depth >= 2) return stack[i]!.path
    return ''
  }

  const closeHeadings = (upToDepth: number, at: Range['start']) => {
    while (stack.length && stack[stack.length - 1]!.depth >= upToDepth) {
      const h = stack.pop()!
      h.bodyRange.end = at
    }
  }

  for (const node of tree.children as RootContent[]) {
    if (node.type === 'heading') {
      const range = rangeOfNode(node, source)
      const text = textOf(node).trim()
      closeHeadings(node.depth, range.start)
      const parent = stack[stack.length - 1]
      const seg = headingSegment(text)
      const prefix = currentPath()
      const path = node.depth === 1 ? '' : prefix ? `${prefix}/${seg}` : seg
      const h: HeadingNode = {
        depth: node.depth,
        text,
        path,
        range,
        bodyRange: { start: range.end, end: endOffset },
        children: [],
      }
      if (node.depth === 1 && !title) title = text
      if (parent) parent.children.push(h)
      else roots.push(h)
      stack.push(h)
      allHeadings.push(h)
      blocks.push({ type: 'heading', node: h })
      continue
    }

    const sectionPath = currentPath()
    const range = rangeOfNode(node, source)

    if (node.type === 'table') {
      const t = tableBlock(node, sectionPath, source)
      tables.push(t)
      blocks.push({ type: 'table', table: t })
      continue
    }
    if (node.type === 'code') {
      if ((node.lang ?? '').toLowerCase() === 'mermaid') {
        const parsed = parseMermaid(node.value)
        const block: MermaidBlock = { ...parsed, range, sectionPath, raw: node.value }
        mermaid.push(block)
        blocks.push({ type: 'mermaid', block })
      } else {
        blocks.push({ type: 'code', lang: node.lang ?? null, range, sectionPath })
      }
      continue
    }

    const before = images.length
    collectImages(node, sectionPath, source, images)
    for (const img of images.slice(before)) blocks.push({ type: 'image', image: img })

    const text = textOf(node).trim()
    if (text) {
      paragraphs++
      blocks.push({ type: 'paragraph', text, range, sectionPath })
    }
  }
  closeHeadings(0, endOffset)

  return {
    hash: createHash('sha256').update(source, 'utf8').digest('hex'),
    title,
    source,
    blocks,
    headings: roots,
    tables,
    mermaid,
    images,
    stats: {
      bytes: Buffer.byteLength(source, 'utf8'),
      headings: allHeadings.length,
      tables: tables.length,
      mermaid: mermaid.length,
      paragraphs,
      images: images.length,
    },
  }
}

/** Depth-first list of all heading nodes. */
export function flattenHeadings(doc: Doc): HeadingNode[] {
  const out: HeadingNode[] = []
  const walk = (nodes: HeadingNode[]) => {
    for (const n of nodes) {
      out.push(n)
      walk(n.children)
    }
  }
  walk(doc.headings)
  return out
}
