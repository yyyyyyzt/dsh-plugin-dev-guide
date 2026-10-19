// Text normalization shared by verifiers and the evidence gate (rule-schema.md §3.3, §5; design.md §4).
// Normalization: NFKC → strip markdown emphasis markers → collapse whitespace → trim.
// Every normalized character keeps a pointer back to the source offset so hits can be turned into ranges.
import type { Offset, Range } from './types.js'

export interface NormalizedText {
  text: string
  /** Source offset of normalized index `i`; `i === text.length` maps to the end of the consumed source. */
  toSourceOffset(i: number): number
}

interface NormalizeOptions {
  /** Keep single spaces between tokens (default true). `false` removes all whitespace, used for quote matching. */
  keepSpaces?: boolean
}

const isSpace = (ch: string): boolean => /\s/u.test(ch)
const isAsciiWord = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z0-9]/.test(ch)

function build(source: string, opts: NormalizeOptions = {}): { text: string; map: number[] } {
  const keepSpaces = opts.keepSpaces ?? true
  const chars = Array.from(source)
  const out: string[] = []
  const map: number[] = []
  let srcOffset = 0
  let pendingSpaceAt: number | null = null

  const emit = (ch: string, at: number) => {
    if (pendingSpaceAt !== null) {
      if (keepSpaces && out.length > 0) {
        out.push(' ')
        map.push(pendingSpaceAt)
      }
      pendingSpaceAt = null
    }
    out.push(ch)
    map.push(at)
  }

  for (let i = 0; i < chars.length; i++) {
    const raw = chars[i]!
    const at = srcOffset
    srcOffset += raw.length

    if (raw === '*' || raw === '`') continue
    if (raw === '_' && !(isAsciiWord(chars[i - 1]) && isAsciiWord(chars[i + 1]))) continue

    const folded = raw.normalize('NFKC')
    for (const ch of Array.from(folded)) {
      if (isSpace(ch)) {
        if (pendingSpaceAt === null) pendingSpaceAt = at
        continue
      }
      emit(ch, at)
    }
  }
  return { text: out.join(''), map }
}

export function normalizeWithMap(source: string, opts?: NormalizeOptions): NormalizedText {
  const { text, map } = build(source, opts)
  return {
    text,
    toSourceOffset(i: number): number {
      if (i <= 0) return map[0] ?? 0
      if (i >= map.length) return source.length
      return map[i]!
    },
  }
}

export function normalize(text: string): string {
  return build(text).text
}

export function offsetAt(source: string, offset: number): Offset {
  let line = 1
  let lastBreak = -1
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++
      lastBreak = i
    }
  }
  return { line, column: offset - lastBreak, offset }
}

export function rangeOf(source: string, start: number, end: number): Range {
  return { start: offsetAt(source, start), end: offsetAt(source, end) }
}

/** Source offset just after the normalized index `i - 1` (i.e. end of the source char that produced it). */
function sourceEndOf(source: string, n: NormalizedText, i: number): number {
  const startOfLast = n.toSourceOffset(i - 1)
  const cp = source.codePointAt(startOfLast)
  return startOfLast + (cp !== undefined && cp > 0xffff ? 2 : 1)
}

/**
 * Find `quote` in `source` ignoring whitespace, emphasis markers and full-width variants.
 * Returns the source range of the first hit (optionally restricted to `within`), or null.
 */
export function findQuote(source: string, quote: string, within?: Range): Range | null {
  const hits = findAllQuotes(source, quote)
  for (const r of hits) {
    if (!within) return r
    if (r.start.offset >= within.start.offset && r.end.offset <= within.end.offset) return r
  }
  return null
}

export function findAllQuotes(source: string, quote: string): Range[] {
  const q = build(quote, { keepSpaces: false }).text
  if (!q) return []
  const n = normalizeWithMap(source, { keepSpaces: false })
  const ranges: Range[] = []
  let from = 0
  for (;;) {
    const idx = n.text.indexOf(q, from)
    if (idx < 0) break
    const start = n.toSourceOffset(idx)
    const end = sourceEndOf(source, n, idx + q.length)
    ranges.push(rangeOf(source, start, end))
    from = idx + 1
  }
  return ranges
}

export interface SentencePiece {
  text: string
  start: number
  end: number
}

const SENTENCE_BREAK = /[。；;！？!?\n]/u

/** Split on sentence terminators / line breaks, trimming whitespace and keeping offsets into `text`. */
export function splitSentences(text: string): SentencePiece[] {
  const pieces: SentencePiece[] = []
  let start = 0
  const push = (s: number, e: number) => {
    while (s < e && isSpace(text[s]!)) s++
    while (e > s && isSpace(text[e - 1]!)) e--
    if (e > s) pieces.push({ text: text.slice(s, e), start: s, end: e })
  }
  for (let i = 0; i < text.length; i++) {
    if (SENTENCE_BREAK.test(text[i]!)) {
      push(start, i)
      start = i + 1
    }
  }
  push(start, text.length)
  return pieces
}
