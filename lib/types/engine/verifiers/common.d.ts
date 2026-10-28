import type { Doc, Evidence, HeadingNode, Lexicon, Range, TableBlock } from '../types.js';
export declare function headingAliases(lexicon: Lexicon, heading: string | string[]): string[];
export declare function headingMatches(node: HeadingNode, aliases: string[]): boolean;
/** Heading nodes (depth ≥ 2) whose title matches any alias of the key. */
export declare function findSections(doc: Doc, lexicon: Lexicon, heading: string | string[]): HeadingNode[];
export declare function sectionsFor(doc: Doc, lexicon: Lexicon, keys: string[] | undefined): HeadingNode[] | null;
export declare function inRange(offset: number, range: Range): boolean;
export declare function inScope(offset: number, scope: HeadingNode[] | null): boolean;
export declare function overlaps(a: Range, b: Range): boolean;
export interface Sentence {
    quote: string;
    norm: string;
    sectionPath: string;
    range: Range;
    /** true when the sentence is a table cell */
    cell: boolean;
}
/** Sentences (paragraph pieces + table cells) inside `scope` (null = whole document), in document order. */
export declare function sentencesIn(doc: Doc, scope: HeadingNode[] | null): Sentence[];
export declare function tablesIn(doc: Doc, scope: HeadingNode[] | null): TableBlock[];
export declare function familyWords(lexicon: Lexicon, key: string): string[];
/** Index of the first occurrence of `word` in normalized `text`, respecting ASCII word boundaries. */
export declare function indexOfWord(text: string, word: string): number;
export interface WordHit {
    word: string;
    index: number;
}
export declare function hitsOf(text: string, words: string[]): WordHit[];
export declare function familyHits(text: string, lexicon: Lexicon, family: string): WordHit[];
export declare function isPlaceholder(text: string, lexicon: Lexicon): boolean;
export declare function absenceEvidence(doc: Doc, quote: string, offset: number, sectionPath?: string): Evidence;
export declare function textEvidence(s: Sentence): Evidence;
export declare function headingEvidence(h: HeadingNode): Evidence;
/** Insertion point for absence evidence: end of the first scoped section, else end of document. */
export declare function absenceOffset(doc: Doc, scope: HeadingNode[] | null): {
    offset: number;
    sectionPath?: string;
};
/** Path of the deepest heading (depth ≥ 2) whose body contains `offset`, or ''. */
export declare function sectionPathAt(doc: Doc, offset: number): string;
