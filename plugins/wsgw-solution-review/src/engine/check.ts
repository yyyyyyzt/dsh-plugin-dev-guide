import type { CheckReport, Doc, Lexicon, Rule } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export function isApplicable(_doc: Doc, _rule: Rule, _lexicon: Lexicon): boolean {
  throw new NotImplementedError('isApplicable')
}

export function check(_doc: Doc, _rules: Rule[], _lexicon: Lexicon): CheckReport {
  throw new NotImplementedError('check')
}
