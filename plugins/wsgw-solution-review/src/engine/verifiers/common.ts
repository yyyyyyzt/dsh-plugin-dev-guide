// Shared helpers for verifiers: heading resolution, sentence extraction, family matching, evidence builders.
import { flattenHeadings, headingTitle } from '../parse/markdown.js'
import { normalize, rangeOf, splitSentences } from '../normalize.js'
import type { Doc, Evidence, HeadingNode, Lexicon, Range, TableBlock } from '../types.js'

export function headingAliases(lexicon: Lexicon, heading: string | string[]): string[] {
  if (Array.isArray(heading)) return heading
  return lexicon.headings[heading] ?? [heading]
}

export function headingMatches(node: HeadingNode, aliases: string[]): boolean {
  const title = normalize(headingTitle(node.text))
  return aliases.some((a) => title.includes(normalize(a)))
}

/** Heading nodes (depth ≥ 2) whose title matches any alias of the key. */
export function findSections(doc: Doc, lexicon: Lexicon, heading: string | string[]): HeadingNode[] {
  const aliases = headingAliases(lexicon, heading)
  return flattenHeadings(doc).filter((h) => h.depth >= 2 && headingMatches(h, aliases))
}

export function sectionsFor(doc: Doc, lexicon: Lexicon, keys: string[] | undefined): HeadingNode[] | null {
  if (!keys || keys.length === 0) return null
  const out: HeadingNode[] = []
  for (const k of keys) for (const h of findSections(doc, lexicon, k)) if (!out.includes(h)) out.push(h)
  return out
}

export function inRange(offset: number, range: Range): boolean {
  return offset >= range.start.offset && offset < range.end.offset
}

export function inScope(offset: number, scope: HeadingNode[] | null): boolean {
  if (scope === null) return true
  return scope.some((h) => inRange(offset, h.bodyRange))
}

export function overlaps(a: Range, b: Range): boolean {
  return a.start.offset < b.end.offset && b.start.offset < a.end.offset
}

export interface Sentence {
  quote: string
  norm: string
  sectionPath: string
  range: Range
  /** true when the sentence is a table cell */
  cell: boolean
}

function sentenceAt(doc: Doc, start: number, end: number, sectionPath: string, cell: boolean): Sentence | null {
  let s = start
  let e = end
  // mdast cell positions may include the surrounding `|` delimiters
  const edge = cell ? /[\s|]/u : /\s/u
  while (s < e && edge.test(doc.source[s]!)) s++
  while (e > s && edge.test(doc.source[e - 1]!)) e--
  if (e <= s) return null
  const quote = doc.source.slice(s, e)
  return { quote, norm: normalize(quote), sectionPath, range: rangeOf(doc.source, s, e), cell }
}

/** Sentences (paragraph pieces + table cells) inside `scope` (null = whole document), in document order. */
export function sentencesIn(doc: Doc, scope: HeadingNode[] | null): Sentence[] {
  const out: Sentence[] = []
  for (const b of doc.blocks) {
    if (b.type === 'paragraph') {
      if (!inScope(b.range.start.offset, scope)) continue
      const raw = doc.source.slice(b.range.start.offset, b.range.end.offset)
      for (const p of splitSentences(raw)) {
        const s = sentenceAt(doc, b.range.start.offset + p.start, b.range.start.offset + p.end, b.sectionPath, false)
        if (s) out.push(s)
      }
    } else if (b.type === 'table') {
      if (!inScope(b.table.range.start.offset, scope)) continue
      b.table.cellRanges.forEach((row, ri) => {
        if (ri === 0) return
        for (const r of row) {
          const s = sentenceAt(doc, r.start.offset, r.end.offset, b.table.sectionPath, true)
          if (s) out.push(s)
        }
      })
    }
  }
  return out
}

export function tablesIn(doc: Doc, scope: HeadingNode[] | null): TableBlock[] {
  return doc.tables.filter((t) => inScope(t.range.start.offset, scope))
}

export function familyWords(lexicon: Lexicon, key: string): string[] {
  const words = lexicon.families[key]
  if (!words) throw new Error(`unknown lexicon family: ${key}`)
  return words
}

const ASCII_WORD = /^[A-Za-z0-9_./-]+$/

/** Index of the first occurrence of `word` in normalized `text`, respecting ASCII word boundaries. */
export function indexOfWord(text: string, word: string): number {
  const w = normalize(word)
  if (!w) return -1
  if (ASCII_WORD.test(w)) {
    const re = new RegExp(`(?<![A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}(?![A-Za-z0-9])`, 'i')
    const m = re.exec(text)
    return m ? m.index : -1
  }
  return text.indexOf(w)
}

export interface WordHit {
  word: string
  index: number
}

export function hitsOf(text: string, words: string[]): WordHit[] {
  const hits: WordHit[] = []
  for (const word of words) {
    const idx = indexOfWord(text, word)
    if (idx >= 0) hits.push({ word, index: idx })
  }
  return hits
}

export function familyHits(text: string, lexicon: Lexicon, family: string): WordHit[] {
  return hitsOf(text, familyWords(lexicon, family))
}

export function isPlaceholder(text: string, lexicon: Lexicon): boolean {
  const t = normalize(text).replace(/\s+/g, '')
  if (!t) return true
  return lexicon.placeholders.some((p) => normalize(p).replace(/\s+/g, '') === t)
}

export function absenceEvidence(doc: Doc, quote: string, offset: number, sectionPath?: string): Evidence {
  const at = Math.max(0, Math.min(offset, doc.source.length))
  const e: Evidence = { quote, kind: 'absence', range: rangeOf(doc.source, at, at) }
  if (sectionPath !== undefined) e.sectionPath = sectionPath
  return e
}

export function textEvidence(s: Sentence): Evidence {
  return { quote: s.quote, sectionPath: s.sectionPath, range: s.range, kind: s.cell ? 'table-cell' : 'text' }
}

export function headingEvidence(h: HeadingNode): Evidence {
  return { quote: h.text, sectionPath: h.path, range: h.range, kind: 'heading' }
}

/** Insertion point for absence evidence: end of the first scoped section, else end of document. */
export function absenceOffset(doc: Doc, scope: HeadingNode[] | null): { offset: number; sectionPath?: string } {
  const first = scope?.[0]
  if (first) return { offset: first.bodyRange.end.offset, sectionPath: first.path }
  return { offset: doc.source.length }
}

/** Path of the deepest heading (depth ≥ 2) whose body contains `offset`, or ''. */
export function sectionPathAt(doc: Doc, offset: number): string {
  let best: HeadingNode | undefined
  for (const h of flattenHeadings(doc)) {
    if (h.depth < 2) continue
    if (inRange(offset, h.bodyRange) || inRange(offset, h.range)) {
      if (!best || h.depth > best.depth) best = h
    }
  }
  return best?.path ?? ''
}
