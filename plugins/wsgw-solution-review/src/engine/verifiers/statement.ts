import type { Doc, Lexicon, StatementParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifyStatement(_doc: Doc, _params: StatementParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifyStatement')
}
