import type { Doc, Evidence, GateReason, Rule, Snippet } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export interface GateInput {
  quote: string
  sectionPath?: string
}

export interface GateResult {
  passed: boolean
  reasons: GateReason[]
  resolved: Evidence[]
}

export class HardRuleVerifierOwnedError extends Error {
  readonly code = 'HARD_RULE_VERIFIER_OWNED'
  constructor(ruleId: string) {
    super(`rule ${ruleId} is hard: issues are registered by its verifier only`)
    this.name = 'HardRuleVerifierOwnedError'
  }
}

export function gate(
  _doc: Doc,
  _rule: Rule | null,
  _evidence: GateInput[],
  _candidates: Snippet[] | undefined,
): GateResult {
  throw new NotImplementedError('gate')
}
