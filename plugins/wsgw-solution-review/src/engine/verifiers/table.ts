import type { Doc, Lexicon, TableParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifyTable(_doc: Doc, _params: TableParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifyTable')
}
