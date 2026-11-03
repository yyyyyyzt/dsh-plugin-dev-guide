#!/usr/bin/env node
// Generate the synthetic evaluation set (docs/evaluation.md §2.3) and its self-check report.
// Usage: node scripts/eval/gen-synthetic.mjs [--seed 20261029] [--minor-threshold 3] [--out paper/data/public/synthetic] [--pack rules.yaml]
import { join } from 'node:path'
import { fromRoot, loadEngine, loadEval, loadPack, parseArgs, publicDataDir, writeJson } from './common.mjs'

const args = parseArgs(process.argv.slice(2), {
  seed: '20261029',
  'minor-threshold': '3',
  out: join(publicDataDir, 'synthetic'),
  pack: '',
})

const engine = await loadEngine()
const evalLib = await loadEval()
const { pack, path: packPath } = await loadPack(engine, args.pack || undefined)
const seed = Number(args.seed)
const minorThreshold = Number(args['minor-threshold'])
const outDir = fromRoot(args.out)

const set = evalLib.generateSyntheticSet(pack, { seed, minorThreshold })
const files = evalLib.writeDataset(outDir, set)
const report = evalLib.selfCheck(set, pack)
writeJson(join(outDir, 'selfcheck.json'), report)

const dist = set.manifest.counts
const defects = set.solutions.reduce((n, s) => n + s.defects.length, 0)

console.log(`rule pack: ${packPath} (${pack.rules.length} rules)`)
console.log(`dataset ${set.manifest.id}: ${set.solutions.length} solutions, ${defects} planted defects, ${files.length} files → ${outDir}`)
console.log(`expected verdicts: ${JSON.stringify(dist)}`)
console.log(`self-check: ok=${report.ok} violations=${report.violations.length}`)
for (const [kind, d] of Object.entries(report.detection)) {
  console.log(`  ${kind.padEnd(12)} planted=${d.planted} detected=${d.detected} pending=${d.pending} missed=${d.missed}`)
}
if (!report.ok) {
  for (const v of report.violations.slice(0, 20)) console.log(`  ! ${v.solutionId} ${v.ruleId} ${v.status} ${v.note ?? ''}`)
  process.exitCode = 1
}
