import type { Doc, Lexicon, QuantityParams, VerifierResult } from '../types.js';
export declare const DEFAULT_UNITS: string[];
export declare function verifyQuantity(doc: Doc, params: QuantityParams, lexicon: Lexicon): VerifierResult;
