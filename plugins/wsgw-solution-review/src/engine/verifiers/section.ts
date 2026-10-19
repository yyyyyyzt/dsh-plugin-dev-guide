import type { Doc, Lexicon, SectionParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifySection(_doc: Doc, _params: SectionParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifySection')
}
