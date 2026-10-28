import type { Doc, HeadingNode } from '../types.js';
/** Path segment of a heading: template numbering (「一」「2.1.1」) when present, else the heading text. */
export declare function headingSegment(text: string): string;
/** Heading text with template numbering removed (used for alias matching). */
export declare function headingTitle(text: string): string;
export declare function parseMarkdown(source: string): Doc;
/** Depth-first list of all heading nodes. */
export declare function flattenHeadings(doc: Doc): HeadingNode[];
