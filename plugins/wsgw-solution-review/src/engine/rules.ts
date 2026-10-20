// Rule pack loading (rule-schema.md §1–§2, §7) and shipped+override merge (design.md §12, rule-schema.md §6).
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { Lexicon, Rule, RuleOverride, RulePack, VerifierSpec } from './types.js'

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

const RULE_ID = /^[A-Z]{3}-\d{3}$/

const StringList = z.array(z.string().min(1))

const SectionParams = z.object({
  heading: z.union([z.string().min(1), StringList.min(1)]),
  minChars: z.number().int().nonnegative().optional(),
  allowPlaceholder: z.boolean().optional(),
})

const TableParams = z.object({
  locate: z.object({ section: z.string().min(1).optional(), headerAny: StringList.optional() }),
  requiredColumns: z.array(StringList.min(1)).optional(),
  minRows: z.number().int().nonnegative().optional(),
  placeholderCells: z.enum(['fail', 'ignore']).optional(),
  requireRow: z.object({ column: StringList.min(1), equalsAny: StringList.min(1) }).optional(),
})

const WhenNoCandidate = z.enum(['pass', 'fail', 'pending'])

const StatementParams = z.object({
  sections: StringList.optional(),
  families: StringList.min(1),
  requireAll: z.boolean().optional(),
  negationWindow: z.number().int().nonnegative().optional(),
  assertionOnly: StringList.optional(),
  causalWords: StringList.optional(),
  decisive: z.boolean().optional(),
  whenNoCandidate: WhenNoCandidate.optional(),
})

const QuantityParams = z.object({
  sections: StringList.min(1),
  contextFamilies: StringList.min(1),
  units: StringList.optional(),
  window: z.number().int().nonnegative().optional(),
})

const MermaidSequenceParams = z.object({
  sections: StringList.optional(),
  minParticipants: z.number().int().nonnegative().optional(),
  minMessages: z.number().int().nonnegative().optional(),
  participantFamilies: StringList.optional(),
  requiredMessageFamilies: StringList.optional(),
  treatImageAsFail: z.boolean().optional(),
})

const CrossRefParams = z.object({
  refPattern: z.string().min(1).optional(),
  listSection: z.string().min(1).optional(),
  listItemPattern: z.string().min(1).optional(),
  requireListNonEmpty: z.boolean().optional(),
})

const VerifierSchema: z.ZodType<VerifierSpec> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('section'), params: SectionParams }),
    z.object({ kind: z.literal('table'), params: TableParams }),
    z.object({ kind: z.literal('statement'), params: StatementParams }),
    z.object({ kind: z.literal('quantity'), params: QuantityParams }),
    z.object({ kind: z.literal('mermaid-sequence'), params: MermaidSequenceParams }),
    z.object({ kind: z.literal('cross-ref'), params: CrossRefParams }),
    z.object({ kind: z.literal('all'), of: z.array(VerifierSchema).min(1) }),
    z.object({ kind: z.literal('first'), of: z.array(VerifierSchema).min(1) }),
  ]),
) as z.ZodType<VerifierSpec>

export const RuleSchema = z.object({
  id: z.string().regex(RULE_ID),
  title: z.string().min(1).max(20),
  dimension: z.enum(['capacity', 'security', 'interface', 'channel', 'data_sync', 'config', 'monitoring', 'documentation']),
  severity: z.enum(['blocker', 'major', 'minor']),
  tier: z.enum(['hard', 'hybrid', 'soft']),
  question: z.string().min(1),
  rationale: z.string().min(1),
  suggestion: z.string().min(1),
  applicability: z
    .object({
      families: StringList.optional(),
      sections: StringList.optional(),
      tableRows: z.object({ column: z.string().min(1), equals: z.string().min(1) }).optional(),
    })
    .nullable()
    .default(null),
  verifier: VerifierSchema.nullable().default(null),
  status: z.enum(['active', 'draft', 'retired']),
  provenance: z.object({ source: z.string().min(1), examples: z.array(z.string()) }),
})

const LexiconSchema = z.object({
  headings: z.record(z.string(), StringList),
  placeholders: z.array(z.string()),
  negations: z.array(z.string()),
  families: z.record(z.string(), StringList),
})

const PackMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  scenario: z.string().min(1),
  description: z.string().min(1),
})

function firstIssuePath(err: z.ZodError): string {
  const issue = err.issues[0]
  if (!issue) return ''
  return issue.path.map(String).join('.')
}

function rawRuleId(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const id = (raw as { id?: unknown }).id
  return typeof id === 'string' && RULE_ID.test(id) ? id : null
}

/** Walk a verifier tree, yielding every leaf with its dotted path for error reporting. */
function* leaves(spec: VerifierSpec, path = 'verifier'): Generator<{ spec: VerifierSpec; path: string }> {
  if (spec.kind === 'all' || spec.kind === 'first') {
    for (const [i, child] of spec.of.entries()) yield* leaves(child, `${path}.of.${i}`)
    return
  }
  yield { spec, path }
}

function checkLexiconRefs(rule: Rule, lexicon: Lexicon): void {
  const fail = (field: string, msg: string): never => {
    throw new RulePackError(`${rule.id}: ${msg}`, rule.id, field)
  }
  const family = (field: string, keys: string[] | undefined): void => {
    for (const k of keys ?? []) if (!lexicon.families[k]) fail(field, `unknown lexicon family "${k}"`)
  }
  const heading = (field: string, keys: string[] | undefined): void => {
    for (const k of keys ?? []) if (!lexicon.headings[k]) fail(field, `unknown lexicon heading "${k}"`)
  }
  family('applicability.families', rule.applicability?.families)
  heading('applicability.sections', rule.applicability?.sections)
  if (!rule.verifier) return
  for (const { spec, path } of leaves(rule.verifier)) {
    switch (spec.kind) {
      case 'section':
        if (typeof spec.params.heading === 'string') heading(`${path}.params.heading`, [spec.params.heading])
        break
      case 'table':
        if (spec.params.locate.section) heading(`${path}.params.locate.section`, [spec.params.locate.section])
        break
      case 'statement':
        family(`${path}.params.families`, spec.params.families)
        heading(`${path}.params.sections`, spec.params.sections)
        break
      case 'quantity':
        family(`${path}.params.contextFamilies`, spec.params.contextFamilies)
        heading(`${path}.params.sections`, spec.params.sections)
        break
      case 'mermaid-sequence':
        family(`${path}.params.participantFamilies`, spec.params.participantFamilies)
        family(`${path}.params.requiredMessageFamilies`, spec.params.requiredMessageFamilies)
        heading(`${path}.params.sections`, spec.params.sections)
        break
      case 'cross-ref':
        if (spec.params.listSection) heading(`${path}.params.listSection`, [spec.params.listSection])
        break
      default:
        break
    }
  }
}

/** Tier invariants (rule-schema.md §2): soft has no verifier; hard/hybrid require one; hard trees are decisive. */
function checkTier(rule: Rule): void {
  const fail = (field: string, msg: string): never => {
    throw new RulePackError(`${rule.id}: ${msg}`, rule.id, field)
  }
  if (rule.tier === 'soft') {
    if (rule.verifier) fail('verifier', 'soft rules must not declare a verifier')
    return
  }
  if (!rule.verifier) fail('verifier', `${rule.tier} rules require a verifier`)
  if (rule.tier !== 'hard') return
  for (const { spec, path } of leaves(rule.verifier!)) {
    if (spec.kind !== 'statement') continue
    if (spec.params.decisive !== true) fail(`${path}.params.decisive`, 'hard rules require decisive statement verifiers')
    if (spec.params.whenNoCandidate === undefined || spec.params.whenNoCandidate === 'pending')
      fail(`${path}.params.whenNoCandidate`, 'hard rules must resolve whenNoCandidate to pass or fail')
  }
}

export function parseRulePack(yamlText: string): RulePack {
  let raw: unknown
  try {
    raw = parseYaml(yamlText)
  } catch (e) {
    throw new RulePackError(`rule pack is not valid YAML: ${(e as Error).message}`, null, 'yaml')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new RulePackError('rule pack root must be a mapping', null, 'pack')
  }
  const root = raw as { pack?: unknown; lexicon?: unknown; rules?: unknown }

  const meta = PackMetaSchema.safeParse(root.pack)
  if (!meta.success) throw new RulePackError(`invalid pack metadata: ${meta.error.message}`, null, `pack.${firstIssuePath(meta.error)}`)
  const lexicon = LexiconSchema.safeParse(root.lexicon)
  if (!lexicon.success)
    throw new RulePackError(`invalid lexicon: ${lexicon.error.message}`, null, `lexicon.${firstIssuePath(lexicon.error)}`)
  if (!Array.isArray(root.rules)) throw new RulePackError('rules must be a list', null, 'rules')

  const rules: Rule[] = []
  const seen = new Set<string>()
  for (const rawRule of root.rules) {
    const parsed = RuleSchema.safeParse(rawRule)
    if (!parsed.success) {
      const field = firstIssuePath(parsed.error) || 'rule'
      throw new RulePackError(`invalid rule (${field}): ${parsed.error.issues[0]?.message ?? ''}`, rawRuleId(rawRule), field)
    }
    const rule = parsed.data as Rule
    if (seen.has(rule.id)) throw new RulePackError(`duplicate rule id ${rule.id}`, rule.id, 'id')
    seen.add(rule.id)
    checkTier(rule)
    checkLexiconRefs(rule, lexicon.data)
    rules.push(rule)
  }
  return { pack: meta.data, lexicon: lexicon.data, rules }
}

// A single-rule YAML as the agent drafts it in `rules_propose(draft)`: status and provenance may be omitted.
const DraftRuleSchema = RuleSchema.extend({
  status: z.enum(['active', 'draft', 'retired']).default('draft'),
  provenance: z
    .object({ source: z.string().min(1), examples: z.array(z.string()) })
    .default({ source: 'expert-draft', examples: [] }),
})

export function parseRuleDraft(yamlText: string, lexicon: Lexicon): Rule {
  let raw: unknown
  try {
    raw = parseYaml(yamlText)
  } catch (e) {
    throw new RulePackError(`rule draft is not valid YAML: ${(e as Error).message}`, null, 'yaml')
  }
  const parsed = DraftRuleSchema.safeParse(raw)
  if (!parsed.success) {
    const field = firstIssuePath(parsed.error) || 'rule'
    throw new RulePackError(`invalid rule draft (${field}): ${parsed.error.issues[0]?.message ?? ''}`, rawRuleId(raw), field)
  }
  const rule = parsed.data as Rule
  checkTier(rule)
  checkLexiconRefs(rule, lexicon)
  return rule
}

// ---------- merge ----------

const NUMERIC_PARAM_KEYS = ['minChars', 'minMessages', 'minParticipants', 'negationWindow', 'window'] as const
const WHITELIST = new Set<string>(['families', 'whenNoCandidate', ...NUMERIC_PARAM_KEYS])

type Params = Record<string, unknown>

/** The param objects of every leaf in the tree that owns the given key. */
function leafParamsWith(spec: VerifierSpec, key: string): Params[] {
  const out: Params[] = []
  for (const { spec: leaf } of leaves(spec)) {
    if (!('params' in leaf)) continue
    const params = leaf.params as Params
    if (key in params) out.push(params)
  }
  return out
}

function applyParams(rule: Rule, params: NonNullable<RuleOverride['params']>, warnings: string[]): void {
  if (!rule.verifier) {
    warnings.push(`${rule.id}: params override ignored (rule has no verifier)`)
    return
  }
  for (const key of Object.keys(params)) {
    if (!WHITELIST.has(key)) warnings.push(`${rule.id}: param "${key}" is not overridable and was ignored`)
  }

  if (params.families) {
    const targets = leafParamsWith(rule.verifier, 'families')
    if (targets.length === 0) warnings.push(`${rule.id}: no statement verifier to apply families override`)
    for (const t of targets) {
      const current = t['families'] as string[]
      const remove = new Set(params.families.remove ?? [])
      const next = current.filter((f) => !remove.has(f))
      for (const add of params.families.add ?? []) if (!next.includes(add)) next.push(add)
      t['families'] = next
    }
  }

  if (params.whenNoCandidate !== undefined) {
    if (rule.tier === 'hard' && params.whenNoCandidate === 'pending') {
      warnings.push(`${rule.id}: whenNoCandidate=pending is not allowed on a hard rule; override ignored`)
    } else {
      const targets = leafParamsWith(rule.verifier, 'whenNoCandidate')
      const fallback = targets.length === 0 ? leafParamsWith(rule.verifier, 'families') : targets
      for (const t of fallback) t['whenNoCandidate'] = params.whenNoCandidate
    }
  }

  for (const key of NUMERIC_PARAM_KEYS) {
    const value = params[key]
    if (value === undefined) continue
    const targets = leafParamsWith(rule.verifier, key)
    const applicable = targets.length > 0 ? targets : leavesAccepting(rule.verifier, key)
    if (applicable.length === 0) warnings.push(`${rule.id}: no verifier accepts param "${key}"`)
    for (const t of applicable) t[key] = value
  }
}

const ACCEPTS: Record<(typeof NUMERIC_PARAM_KEYS)[number], ReadonlySet<VerifierSpec['kind']>> = {
  minChars: new Set(['section']),
  minMessages: new Set(['mermaid-sequence']),
  minParticipants: new Set(['mermaid-sequence']),
  negationWindow: new Set(['statement']),
  window: new Set(['quantity']),
}

function leavesAccepting(spec: VerifierSpec, key: (typeof NUMERIC_PARAM_KEYS)[number]): Params[] {
  const out: Params[] = []
  for (const { spec: leaf } of leaves(spec)) {
    if ('params' in leaf && ACCEPTS[key].has(leaf.kind)) out.push(leaf.params as Params)
  }
  return out
}

export function mergeRules(shipped: Rule[], overrides: RuleOverride[]): { rules: Rule[]; warnings: string[] } {
  const rules = structuredClone(shipped)
  const warnings: string[] = []
  const byId = new Map(rules.map((r) => [r.id, r]))
  const drafts: Rule[] = []

  for (const ov of overrides) {
    const target = byId.get(ov.ruleId)
    if (!target) {
      if (ov.draft) {
        const draft = structuredClone(ov.draft)
        if (draft.tier === 'hard' && draft.verifier) {
          const pending = [...leaves(draft.verifier)].some(
            ({ spec }) => spec.kind === 'statement' && (spec.params.whenNoCandidate ?? 'pending') === 'pending',
          )
          if (pending) {
            warnings.push(`${ov.ruleId}: hard draft with pending whenNoCandidate skipped`)
            continue
          }
        }
        drafts.push(draft)
        byId.set(draft.id, draft)
        continue
      }
      warnings.push(`${ov.ruleId}: unknown rule id; override ignored`)
      continue
    }
    if (ov.status !== undefined) target.status = ov.status
    if (ov.severity !== undefined) target.severity = ov.severity
    if (ov.suggestion !== undefined) target.suggestion = ov.suggestion
    if (ov.params) applyParams(target, ov.params, warnings)
  }

  return { rules: [...rules, ...drafts], warnings }
}
