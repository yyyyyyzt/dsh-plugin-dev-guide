// Rule-pack discovery (design.md §12 row 1): a pack that fails validation is reported and skipped, never fatal.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRulePack, RulePackError } from '../engine/rules.js'
import type { RulePack } from '../engine/types.js'

export interface RulePackLoadError {
  file: string
  message: string
  ruleId: string | null
  field: string | null
}

export interface LoadedRulePacks {
  dir: string
  packs: RulePack[]
  errors: RulePackLoadError[]
}

/** `<package root>/rules`, valid both from `src/host/` (tests) and `lib/host/` (built). */
export function shippedRulesDir(): string {
  return fileURLToPath(new URL('../../rules/', import.meta.url))
}

export function loadRulePacks(dir: string = shippedRulesDir()): LoadedRulePacks {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.rules.yaml') || f.endsWith('.rules.yml'))
    .sort()
  const packs: RulePack[] = []
  const errors: RulePackLoadError[] = []
  for (const file of files) {
    const path = join(dir, file)
    try {
      packs.push(parseRulePack(readFileSync(path, 'utf8')))
    } catch (e) {
      const err = e as Partial<RulePackError> & Error
      errors.push({
        file: path,
        message: err.message,
        ruleId: e instanceof RulePackError ? err.ruleId ?? null : null,
        field: e instanceof RulePackError ? err.field ?? null : null,
      })
    }
  }
  return { dir, packs, errors }
}
