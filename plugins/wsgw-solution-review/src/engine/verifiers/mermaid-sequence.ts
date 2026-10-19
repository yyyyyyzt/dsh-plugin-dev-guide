import type { Doc, Lexicon, MermaidSequenceParams, VerifierResult } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function verifyMermaidSequence(_doc: Doc, _params: MermaidSequenceParams, _lexicon: Lexicon): VerifierResult {
  throw new NotImplementedError('verifyMermaidSequence')
}
