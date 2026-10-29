// Ablation runner (evaluation.md §5): one configuration × one dataset → one eval_runs record.
import { createHash } from 'node:crypto'
import { check } from '../engine/check.js'
import { parseMarkdown } from '../engine/parse/markdown.js'
import type { GateReason, Rule, RulePack, Severity, Tier, Verdict, VerdictConfig, VerifierSpec } from '../engine/types.js'
import { computeVerdict } from '../engine/verdict.js'
import type { EvalRunRecord } from '../store/domain.js'
import { runB0 } from './baselines.js'
import type { Dataset } from './dataset.js'
import { judgeCandidatesAsync, type Judge } from './judge.js'
import { accuracy, cohenKappa, confusionMatrix, f1Of, issueMetrics, macroF1, VERDICT_ORDER, type VerdictPair } from './metrics.js'
import { promptHash } from './prompts.js'
import { bootstrapCI, holm, mcnemar, mean, stddev, wilcoxonSignedRank } from './stats.js'

export const ABLATIONS = ['B0', 'B1', 'S-full', 'S-gate', 'S-verifier', 'S-policy', 'S-memory'] as const
export type Ablation = (typeof ABLATIONS)[number]

const LLM_ONLY: ReadonlySet<Ablation> = new Set<Ablation>(['B1', 'S-gate', 'S-policy'])

export interface RunConfig {
  ablation: Ablation
  judge: string
  model: string
  promptHash: string
  repetition: number
  rulePackVersion: string
  minorThreshold: number
}

export interface PerSolution {
  id: string
  truth: string[]
  expectedVerdict: Verdict
  predicted: string[]
  predictedTiers: Record<string, Tier>
  pending: string[]
  predictedVerdict: Verdict
  f1: number
  gateRejects: number
  submitted: number
}

export interface PerRule {
  ruleId: string
  tier: Tier
  severity: Severity
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
}

export interface RunOptions {
  ablation: Ablation
  dataset: Dataset
  pack: RulePack
  cfg: VerdictConfig
  judge: Judge
  repetition: number
  now?: () => string
}

export interface EvalRun extends EvalRunRecord {
  config: RunConfig
  perSolution: PerSolution[]
  perRule: PerRule[]
}

function stripSections(spec: VerifierSpec): VerifierSpec {
  switch (spec.kind) {
    case 'statement': {
      const { sections: _s, ...rest } = spec.params
      return { kind: 'statement', params: rest }
    }
    case 'all':
    case 'first':
      return { kind: spec.kind, of: spec.of.map(stripSections) }
    default:
      return spec
  }
}

/** S-verifier: hybrid rules lose candidate localisation (whole-document statements); hard rules unchanged. */
export function withoutCandidateScoping(rules: Rule[]): Rule[] {
  return rules.map((r) => (r.tier === 'hybrid' && r.verifier ? { ...r, verifier: stripSections(r.verifier) } : r))
}

function solutionF1(predicted: string[], truth: string[]): number {
  const p = new Set(predicted)
  const t = new Set(truth)
  if (p.size === 0 && t.size === 0) return 1
  const tp = [...p].filter((x) => t.has(x)).length
  const precision = p.size ? tp / p.size : 0
  const recall = t.size ? tp / t.size : 0
  return f1Of(precision, recall)
}

async function evaluateSolution(opts: RunOptions, solution: Dataset['solutions'][number], rules: Rule[], gateReasons: Record<string, number>): Promise<PerSolution> {
  const { ablation, pack, cfg, judge } = opts
  const truth = [...new Set(solution.truth.defects.map((d) => d.ruleId))].sort()
  const base = { id: solution.id, truth, expectedVerdict: solution.truth.expectedVerdict }
  const tierOf = new Map(pack.rules.map((r) => [r.id, r.tier]))
  const severityOf = new Map(pack.rules.map((r) => [r.id, r.severity]))

  if (ablation === 'B0') {
    const r = runB0(solution.markdown, pack, cfg)
    const predicted = r.issues.map((i) => i.ruleId).sort()
    return {
      ...base,
      predicted,
      predictedTiers: Object.fromEntries(r.issues.map((i) => [i.ruleId, i.tier])),
      pending: [],
      predictedVerdict: r.verdict,
      f1: solutionF1(predicted, truth),
      gateRejects: 0,
      submitted: 0,
    }
  }

  if (ablation === 'B1') {
    if (!judge.direct) throw new Error('B1 requires a judge with direct()')
    const out = await judge.direct({ solutionId: solution.id, markdown: solution.markdown, rules })
    const predicted = [...new Set(out.issues.map((i) => i.ruleId))].sort()
    const tiers: Record<string, Tier> = {}
    for (const id of predicted) tiers[id] = tierOf.get(id) ?? 'hybrid'
    const fallback = computeVerdict(
      predicted.map((id) => ({ status: 'confirmed' as const, tier: 'hard' as const, severity: severityOf.get(id) ?? 'major' })),
      cfg,
    ).verdict
    return {
      ...base,
      predicted,
      predictedTiers: tiers,
      pending: [],
      predictedVerdict: out.verdict ?? fallback,
      f1: solutionF1(predicted, truth),
      gateRejects: 0,
      submitted: out.issues.length,
    }
  }

  const doc = parseMarkdown(solution.markdown)
  const report = check(doc, rules, pack.lexicon)
  const judged = await judgeCandidatesAsync(doc, report.hybridCandidates, pack, judge, { solutionId: solution.id, gate: ablation !== 'S-gate' })
  for (const rej of judged.rejected) for (const reason of rej.reasons) gateReasons[reason] = (gateReasons[reason] ?? 0) + 1

  const predictedTiers: Record<string, Tier> = {}
  for (const i of report.hardIssues) predictedTiers[i.ruleId!] = i.tier as Tier
  for (const i of judged.issues) predictedTiers[i.ruleId] = 'hybrid'
  const predicted = Object.keys(predictedTiers).sort()
  const pendingSet = new Set<string>()
  for (const c of report.checklist) if ((c.status === 'pending' || c.status === 'candidate') && !predictedTiers[c.ruleId]) pendingSet.add(c.ruleId)
  for (const rej of judged.rejected) pendingSet.add(rej.ruleId)

  const policyVerdict = computeVerdict(
    predicted.map((id) => ({ status: 'confirmed' as const, tier: 'hard' as const, severity: severityOf.get(id)! })),
    cfg,
  ).verdict
  let predictedVerdict = policyVerdict
  if (ablation === 'S-policy') {
    if (!judge.policy) throw new Error('S-policy requires a judge with policy()')
    const issues = predicted.map((id) => ({
      ruleId: id,
      severity: severityOf.get(id)!,
      finding: report.hardIssues.find((i) => i.ruleId === id)?.finding ?? judged.issues.find((i) => i.ruleId === id)?.finding ?? '',
    }))
    predictedVerdict = (await judge.policy({ solutionId: solution.id, issues })) ?? policyVerdict
  }

  return {
    ...base,
    predicted,
    predictedTiers,
    pending: [...pendingSet].sort(),
    predictedVerdict,
    f1: solutionF1(predicted, truth),
    gateRejects: judged.rejected.length,
    submitted: judged.submitted,
  }
}

function perRuleStats(per: PerSolution[], pack: RulePack): PerRule[] {
  const out: PerRule[] = []
  for (const rule of pack.rules) {
    if (rule.tier === 'soft') continue
    let tp = 0
    let fp = 0
    let fn = 0
    for (const p of per) {
      const predicted = p.predicted.includes(rule.id)
      const truth = p.truth.includes(rule.id)
      if (predicted && truth) tp += 1
      else if (predicted) fp += 1
      else if (truth) fn += 1
    }
    if (tp + fp + fn === 0) continue
    out.push({
      ruleId: rule.id,
      tier: rule.tier,
      severity: rule.severity,
      tp,
      fp,
      fn,
      precision: tp + fp ? tp / (tp + fp) : 0,
      recall: tp + fn ? tp / (tp + fn) : 0,
    })
  }
  return out
}

export function requiresAdapter(ablation: Ablation): boolean {
  return LLM_ONLY.has(ablation)
}

export async function runConfiguration(opts: RunOptions): Promise<EvalRun> {
  const { ablation, dataset, pack, cfg, judge, repetition } = opts
  if (ablation === 'S-memory') throw new Error('S-memory is an online-only configuration (evaluation.md §5)')
  if (requiresAdapter(ablation) && judge.id !== 'llm') throw new Error(`${ablation} requires an llm adapter judge`)

  const rules = ablation === 'S-verifier' ? withoutCandidateScoping(pack.rules) : pack.rules
  const gateReasons: Record<string, number> = {}
  const perSolution: PerSolution[] = []
  for (const s of dataset.solutions) perSolution.push(await evaluateSolution(opts, s, rules, gateReasons))

  const severityOf = (id: string): Severity => pack.rules.find((r) => r.id === id)?.severity ?? 'major'
  const tierOf = (id: string): Tier | undefined => pack.rules.find((r) => r.id === id)?.tier
  const all = issueMetrics(perSolution, severityOf)
  const byTier = (tier: Tier) =>
    issueMetrics(
      perSolution.map((p) => ({ id: p.id, predicted: p.predicted.filter((r) => tierOf(r) === tier), truth: p.truth.filter((r) => tierOf(r) === tier) })),
      severityOf,
    )
  const pairs: VerdictPair[] = perSolution.map((p) => ({ predicted: p.predictedVerdict, actual: p.expectedVerdict }))
  const confusion = confusionMatrix(pairs)
  const submitted = perSolution.reduce((s, p) => s + p.submitted, 0)
  const rejected = perSolution.reduce((s, p) => s + p.gateRejects, 0)
  const missedTruth = perSolution.flatMap((p) => p.truth.filter((r) => !p.predicted.includes(r)).map((r) => ({ p, r })))
  const pendingCovered = missedTruth.filter(({ p, r }) => p.pending.includes(r)).length

  const metrics: Record<string, unknown> = {
    precision: all.precision,
    recall: all.recall,
    f1: all.f1,
    weightedRecall: all.weightedRecall,
    tp: all.tp,
    fp: all.fp,
    fn: all.fn,
    verdictAccuracy: accuracy(confusion),
    verdictMacroF1: macroF1(confusion),
    kappa: cohenKappa(confusion),
    kappaQuadratic: cohenKappa(confusion, 'quadratic'),
    confusion,
    confusionOrder: VERDICT_ORDER,
    evidenceValidity: submitted > 0 ? (submitted - rejected) / submitted : 1,
    gateReasons,
    pendingCoverage: missedTruth.length ? pendingCovered / missedTruth.length : 0,
    perTier: { hard: byTier('hard'), hybrid: byTier('hybrid') },
    solutions: perSolution.length,
  }

  const config: RunConfig = {
    ablation,
    judge: judge.id,
    model: judge.model,
    promptHash: promptHash(),
    repetition,
    rulePackVersion: `${pack.pack.id}@${pack.pack.version}`,
    minorThreshold: cfg.minorThreshold,
  }
  const digest = createHash('sha256').update(JSON.stringify({ config, dataset: dataset.id, perSolution })).digest('hex').slice(0, 8)
  return {
    runId: `${ablation}_${dataset.id}_r${repetition}_${digest}`,
    config,
    dataset: dataset.id,
    metrics,
    perRule: perRuleStats(perSolution, pack),
    perSolution,
    at: (opts.now ?? (() => new Date().toISOString()))(),
  }
}

export interface AblationOptions {
  dataset: Dataset
  pack: RulePack
  cfg: VerdictConfig
  judge: Judge
  repetitions?: number
  ablations?: readonly Ablation[]
  onRun?: (run: EvalRun) => void | Promise<void>
}

export interface Skipped {
  ablation: Ablation
  reason: string
}

export async function runAblation(opts: AblationOptions): Promise<{ runs: EvalRun[]; skipped: Skipped[] }> {
  const repetitions = opts.repetitions ?? 3
  const runs: EvalRun[] = []
  const skipped: Skipped[] = []
  for (const ablation of opts.ablations ?? ABLATIONS) {
    if (ablation === 'S-memory') {
      skipped.push({ ablation, reason: 'online-only: no expert feedback in an offline dataset' })
      continue
    }
    if (requiresAdapter(ablation) && opts.judge.id !== 'llm') {
      skipped.push({ ablation, reason: 'requires llm adapter (--adapter <module>)' })
      continue
    }
    for (let repetition = 0; repetition < repetitions; repetition++) {
      const run = await runConfiguration({ ablation, dataset: opts.dataset, pack: opts.pack, cfg: opts.cfg, judge: opts.judge, repetition })
      runs.push(run)
      await opts.onRun?.(run)
    }
  }
  return { runs, skipped }
}

// ---------- summary (markdown) ----------

export interface SummaryOptions {
  baseline?: Ablation
  reference?: Ablation
  bootstrapSeed?: number
}

const fmt = (x: number): string => x.toFixed(3)
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

function num(run: EvalRun, key: string): number {
  const v = run.metrics[key]
  return typeof v === 'number' ? v : Number.NaN
}

export function summarize(runs: EvalRun[], skipped: Skipped[], opts: SummaryOptions = {}): string {
  const reference = opts.reference ?? 'S-full'
  const seed = opts.bootstrapSeed ?? 20261029
  const groups = new Map<Ablation, EvalRun[]>()
  for (const r of runs) {
    const list = groups.get(r.config.ablation) ?? []
    list.push(r)
    groups.set(r.config.ablation, list)
  }
  const lines: string[] = []
  lines.push('| 配置 | judge | 重复 | P | R | F1 (95% CI) | R_w | 结论准确率 | 宏 F1 | κ | κ_w | 证据有效率 | 待人工覆盖 |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  const order = [...ABLATIONS].filter((a) => groups.has(a))
  for (const a of order) {
    const g = groups.get(a)!
    const first = g[0]!
    const ci = bootstrapCI(first.perSolution, (xs) => issueMetrics(xs, (id) => severityLookup(first, id)).f1, { seed })
    const sd = g.length > 1 ? ` ±${fmt(stddev(g.map((r) => num(r, 'f1'))))}` : ''
    lines.push(
      `| ${a} | ${first.config.judge}/${first.config.model} | ${g.length} | ${fmt(mean(g.map((r) => num(r, 'precision'))))} | ${fmt(mean(g.map((r) => num(r, 'recall'))))} | ${fmt(mean(g.map((r) => num(r, 'f1'))))}${sd} [${fmt(ci.lower)}, ${fmt(ci.upper)}] | ${fmt(mean(g.map((r) => num(r, 'weightedRecall'))))} | ${pct(mean(g.map((r) => num(r, 'verdictAccuracy'))))} | ${fmt(mean(g.map((r) => num(r, 'verdictMacroF1'))))} | ${fmt(mean(g.map((r) => num(r, 'kappa'))))} | ${fmt(mean(g.map((r) => num(r, 'kappaQuadratic'))))} | ${pct(mean(g.map((r) => num(r, 'evidenceValidity'))))} | ${pct(mean(g.map((r) => num(r, 'pendingCoverage'))))} |`,
    )
  }
  for (const s of skipped) lines.push(`| ${s.ablation} | — | 0 | skipped: ${s.reason} | | | | | | | | | |`)

  const ref = groups.get(reference)?.[0]
  if (ref) {
    lines.push('', `与 ${reference} 的配对比较（按方案配对；Wilcoxon 符号秩检验用于问题级 F1，McNemar 用于结论正误；Holm 校正）：`, '')
    lines.push('| 配置 | ΔF1 | Wilcoxon p | McNemar b/c | McNemar p | Holm p (W) | Holm p (M) |')
    lines.push('|---|---|---|---|---|---|---|')
    const rows: { a: Ablation; dF1: number; w: number; b: number; c: number; m: number }[] = []
    for (const a of order) {
      if (a === reference) continue
      const run = groups.get(a)![0]!
      const byId = new Map(run.perSolution.map((p) => [p.id, p]))
      const refF1: number[] = []
      const runF1: number[] = []
      let b = 0
      let c = 0
      for (const p of ref.perSolution) {
        const q = byId.get(p.id)
        if (!q) continue
        refF1.push(p.f1)
        runF1.push(q.f1)
        const refRight = p.predictedVerdict === p.expectedVerdict
        const runRight = q.predictedVerdict === q.expectedVerdict
        if (refRight && !runRight) b += 1
        if (!refRight && runRight) c += 1
      }
      rows.push({ a, dF1: mean(runF1) - mean(refF1), w: wilcoxonSignedRank(runF1, refF1).pValue, b, c, m: mcnemar(b, c).pValue })
    }
    const hw = holm(rows.map((r) => r.w))
    const hm = holm(rows.map((r) => r.m))
    rows.forEach((r, i) => lines.push(`| ${r.a} | ${r.dF1 >= 0 ? '+' : ''}${fmt(r.dF1)} | ${fmt(r.w)} | ${r.b}/${r.c} | ${fmt(r.m)} | ${fmt(hw[i]!)} | ${fmt(hm[i]!)} |`))
  }
  return lines.join('\n') + '\n'
}

function severityLookup(run: EvalRun, ruleId: string): Severity {
  return run.perRule.find((r) => r.ruleId === ruleId)?.severity ?? 'major'
}
