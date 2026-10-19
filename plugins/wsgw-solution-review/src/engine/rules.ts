import type { Rule, RuleOverride, RulePack } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export class RulePackError extends Error {
  constructor(
    message: string,
    readonly ruleId: string | null,
    readonly field: string | null,
  ) {
    super(message)
    this.name = 'RulePackError'
  }
}

export function parseRulePack(_yamlText: string): RulePack {
  throw new NotImplementedError('parseRulePack')
}

export function mergeRules(_shipped: Rule[], _overrides: RuleOverride[]): { rules: Rule[]; warnings: string[] } {
  throw new NotImplementedError('mergeRules')
}
