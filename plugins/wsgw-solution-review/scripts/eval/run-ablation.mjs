#!/usr/bin/env node
// Run the ablation configurations (docs/evaluation.md §5) over a dataset directory and write eval_runs + summary.
// Usage: node scripts/eval/run-ablation.mjs [--dataset paper/data/public/synthetic] [--out paper/data/public]
//          [--repetitions 3] [--ablations B0,S-full,S-verifier] [--adapter ./my-adapter.mjs] [--minor-threshold 3] [--pack rules.yaml]
// Without --adapter only the deterministic configurations run (B0 / S-full / S-verifier, flag judge); B1 / S-gate / S-policy are marked skipped.
import { join } from 'node:path'
import { fromRoot, loadAdapter, loadEngine, loadEval, loadPack, parseArgs, publicDataDir, writeJson, writeText } from './common.mjs'

const args = parseArgs(process.argv.slice(2), {
  dataset: join(publicDataDir, 'synthetic'),
  out: publicDataDir,
  repetitions: '3',
  ablations: '',
  adapter: '',
  'minor-threshold': '3',
  pack: '',
})

const engine = await loadEngine()
const evalLib = await loadEval()
const { pack, path: packPath } = await loadPack(engine, args.pack || undefined)
const dataset = evalLib.readDataset(fromRoot(args.dataset))
const adapter = await loadAdapter(args.adapter || undefined)
const judge = adapter ? evalLib.llmJudge(adapter) : evalLib.flagJudge
const repetitions = Number(args.repetitions)
const ablations = args.ablations ? args.ablations.split(',').map((s) => s.trim()).filter(Boolean) : undefined
const cfg = { minorThreshold: Number(args['minor-threshold']) }
const outDir = fromRoot(args.out)
const runsDir = join(outDir, 'eval-runs')

console.log(`rule pack: ${packPath} (${pack.rules.length} rules, version ${pack.pack.version})`)
console.log(`dataset: ${dataset.id} (${dataset.solutions.length} solutions)`)
console.log(`judge: ${judge.id} / model ${judge.model}; repetitions ${repetitions}`)

const started = Date.now()
const { runs, skipped } = await evalLib.runAblation({
  dataset,
  pack,
  cfg,
  judge,
  repetitions,
  ...(ablations ? { ablations } : {}),
  onRun: (run) => {
    writeJson(join(runsDir, `${run.runId}.json`), run)
    const m = run.metrics
    console.log(
      `  ${run.config.ablation.padEnd(10)} r${run.config.repetition} P=${m.precision.toFixed(3)} R=${m.recall.toFixed(3)} F1=${m.f1.toFixed(3)} ` +
        `verdictAcc=${m.verdictAccuracy.toFixed(3)} kappa=${m.kappa.toFixed(3)} evidence=${m.evidenceValidity.toFixed(3)} pending=${m.pendingCoverage.toFixed(3)}`,
    )
  },
})
for (const s of skipped) console.log(`  ${s.ablation.padEnd(10)} skipped: ${s.reason}`)

const summary = evalLib.summarize(runs, skipped, { baseline: 'B0', reference: 'S-full' })
const header = [
  `# Ablation summary`,
  ``,
  `- dataset: \`${dataset.id}\` (${dataset.solutions.length} solutions)`,
  `- rule pack: \`${packPath.replace(/\\/g, '/').split('/').slice(-1)[0]}\` (${pack.rules.length} rules)`,
  `- judge: \`${judge.id}\` / model \`${judge.model}\`; repetitions ${repetitions}; minorThreshold ${cfg.minorThreshold}`,
  `- generated: ${new Date().toISOString()} in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  ``,
].join('\n')
writeText(join(outDir, 'summary.md'), header + summary + '\n')
writeJson(join(outDir, 'skipped.json'), skipped)
console.log(`wrote ${runs.length} eval_runs → ${runsDir}; summary → ${join(outDir, 'summary.md')}`)
