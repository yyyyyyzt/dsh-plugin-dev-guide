import type { Doc, Lexicon, VerifierResult, VerifierSpec } from '../types.js';
export { verifySection } from './section.js';
export { verifyTable } from './table.js';
export { verifyStatement } from './statement.js';
export { verifyQuantity } from './quantity.js';
export { verifyMermaidSequence } from './mermaid-sequence.js';
export { verifyCrossRef } from './cross-ref.js';
export declare function verify(doc: Doc, spec: VerifierSpec, lexicon: Lexicon): VerifierResult;
