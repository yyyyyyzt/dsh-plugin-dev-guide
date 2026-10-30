#!/usr/bin/env node
// Anonymize a real dataset directory (docs/evaluation.md §2.5 / §7) with a private dictionary and write the public copy.
// Usage: node scripts/eval/anonymize.mjs --in paper/data/private/real --out paper/data/public/real [--dict paper/data/private/dictionary.json]
// dictionary.json: { fixed: {原名: 别名}, provinces: [], thirdParties: [], services: [], tables: [], codes: [], reviewers: [], dateShiftDays: -37 }
// The mapping file (original → alias) is written next to the dictionary and must stay private (paper/data/private is gitignored).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fromRoot, loadEval, parseArgs, repoRoot, writeJson } from './common.mjs'

const args = parseArgs(process.argv.slice(2), {
  in: '',
  out: '',
  dict: join(repoRoot, 'paper/data/private/dictionary.json'),
})
if (!args.in || !args.out) {
  console.error('usage: anonymize.mjs --in <dataset dir> --out <public dir> [--dict dictionary.json]')
  process.exit(2)
}

const evalLib = await loadEval()
const dictPath = fromRoot(args.dict)
if (!existsSync(dictPath)) {
  console.error(`dictionary not found: ${dictPath}`)
  process.exit(2)
}
const dict = JSON.parse(readFileSync(dictPath, 'utf8'))
const anonymizer = evalLib.createAnonymizer(dict)
const inDir = fromRoot(args.in)
const outDir = fromRoot(args.out)

const forbidden = [
  ...Object.keys(dict.fixed ?? {}),
  ...(dict.provinces ?? []),
  ...(dict.thirdParties ?? []),
  ...(dict.services ?? []),
  ...(dict.tables ?? []),
  ...(dict.codes ?? []),
  ...(dict.reviewers ?? []),
]

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
}

const leaks = []
let count = 0
for (const file of walk(inDir)) {
  if (!/\.(md|json|txt|csv)$/i.test(file)) continue
  const rel = file.slice(inDir.length + 1)
  const out = anonymizer.anonymize(readFileSync(file, 'utf8'))
  for (const hit of evalLib.leakCheck(out, forbidden)) leaks.push({ file: rel, ...hit })
  const target = join(outDir, rel)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, out)
  count++
}

const mapPath = join(dictPath, '..', 'mapping.json')
writeJson(mapPath, anonymizer.map())
console.log(`anonymized ${count} files → ${outDir}; mapping → ${mapPath} (private)`)
if (leaks.length > 0) {
  console.error(`leak check failed: ${leaks.length} hits`)
  for (const l of leaks.slice(0, 30)) console.error(`  ${l.file}: ${l.term} ×${l.count}`)
  process.exitCode = 1
} else {
  console.log('leak check: clean')
}
