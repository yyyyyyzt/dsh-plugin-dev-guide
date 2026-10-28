import type { Offset, Range } from './types.js';
export interface NormalizedText {
    text: string;
    /** Source offset of normalized index `i`; `i === text.length` maps to the end of the consumed source. */
    toSourceOffset(i: number): number;
}
interface NormalizeOptions {
    /** Keep single spaces between tokens (default true). `false` removes all whitespace, used for quote matching. */
    keepSpaces?: boolean;
}
export declare function normalizeWithMap(source: string, opts?: NormalizeOptions): NormalizedText;
export declare function normalize(text: string): string;
export declare function offsetAt(source: string, offset: number): Offset;
export declare function rangeOf(source: string, start: number, end: number): Range;
/**
 * Find `quote` in `source` ignoring whitespace, emphasis markers and full-width variants.
 * Returns the source range of the first hit (optionally restricted to `within`), or null.
 */
export declare function findQuote(source: string, quote: string, within?: Range): Range | null;
export declare function findAllQuotes(source: string, quote: string): Range[];
export interface SentencePiece {
    text: string;
    start: number;
    end: number;
}
/** Split on sentence terminators / line breaks, trimming whitespace and keeping offsets into `text`. */
export declare function splitSentences(text: string): SentencePiece[];
export {};
