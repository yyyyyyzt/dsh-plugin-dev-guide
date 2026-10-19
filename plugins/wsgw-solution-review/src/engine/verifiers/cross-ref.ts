import type { Doc, Lexicon, CrossRefParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifyCrossRef(_doc: Doc, _params: CrossRefParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifyCrossRef')
}
