import type { Doc, Lexicon, VerifierResult, VerifierSpec } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export { verifySection } from './section.js'
export { verifyTable } from './table.js'
export { verifyStatement } from './statement.js'
export { verifyQuantity } from './quantity.js'
export { verifyMermaidSequence } from './mermaid-sequence.js'
export { verifyCrossRef } from './cross-ref.js'

export function verify(_doc: Doc, _spec: VerifierSpec, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verify')
}
