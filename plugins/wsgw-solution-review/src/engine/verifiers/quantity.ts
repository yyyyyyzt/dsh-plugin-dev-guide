import type { Doc, Lexicon, QuantityParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifyQuantity(_doc: Doc, _params: QuantityParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifyQuantity')
}
