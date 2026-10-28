import type { MermaidBlock } from '../types.js';
export type ParsedMermaid = Pick<MermaidBlock, 'kind' | 'participants' | 'messages'>;
export declare function parseMermaid(raw: string): ParsedMermaid;
