import type { Doc, Lexicon, StatementParams, VerifierResult } from '../types.js';
export declare const DEFAULT_CAUSAL_WORDS: string[];
export declare function verifyStatement(doc: Doc, params: StatementParams, lexicon: Lexicon): VerifierResult;
