import type { Range } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export interface NormalizedText {
  text: string
  toSourceOffset(normalizedIndex: number): number
}

export function normalize(_text: string): string {
  throw new NotImplementedError('normalize')
}

export function normalizeWithMap(_text: string): NormalizedText {
  throw new NotImplementedError('normalizeWithMap')
}

export function findQuote(_source: string, _quote: string, _within?: Range): Range | null {
  throw new NotImplementedError('findQuote')
}

export function splitSentences(_text: string): { text: string; start: number; end: number }[] {
  throw new NotImplementedError('splitSentences')
}
