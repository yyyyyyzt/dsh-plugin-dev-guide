#!/usr/bin/env node
// Build reviewer packets for the mock-panel simulation (paper/data/simulated/panel).
// A packet is what an expert would see in the review conversation: the proposal text,
// the findings the engine raised (with their quoted evidence) and the items left pending.
//
// Usage: node paper/scripts/panel/build-packets.mjs [--per-verdict 4] [--out paper/data/simulated/panel]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '../../..')
const pluginDir = join(repoRoot, 'plugins/hark')
const publicData = join(repoRoot, 'paper/data/public')
const outDir = join(repoRoot, 'paper/data/simulated/panel')

const engine = await import(pathToFileURL(join(pluginDir, 'lib/engine/index.js')).href)
const evalLib = await import(pathToFileURL(join(pluginDir, 'lib/eval/index.js')).href)
const pack = engine.parseRulePack(readFileSync(join(pluginDir, 'rules/capability-open-access.rules.yaml'), 'utf8'))
const ruleById = new Map(pack.rules.map((r) => [r.id, r]))

const run = JSON.parse(readFileSync(join(publicData, 'eval-runs/S-full_synthetic-v1-seed20261029_r0_2ff13abf.json'), 'utf8'))
const truth = new Map(JSON.parse(readFileSync(join(publicData, 'synthetic/truth.json'), 'utf8')).map((t) => [t.id, t]))
const cfg = { minorThreshold: run.config.minorThreshold }

// Pick an even spread over the three expected verdicts, preferring proposals with several findings.
const byVerdict = { 通过: [], 建议整改: [], 不通过: [] }
for (const p of run.perSolution) byVerdict[p.expectedVerdict].push(p)
const picks = []
for (const [verdict, list] of Object.entries(byVerdict)) {
  const sorted = [...list].sort((a, b) => b.predicted.length - a.predicted.length || a.id.localeCompare(b.id))
  const step = Math.max(1, Math.floor(sorted.length / 4))
  for (let i = 0; i < 4; i++) picks.push(sorted[Math.min(i * step, sorted.length - 1)])
}

const packets = []
for (const p of picks) {
  const md = readFileSync(join(publicData, 'synthetic/solutions', `${p.id}.md`), 'utf8')
  const doc = engine.parseMarkdown(md)
  const report = engine.check(doc, pack.rules, pack.lexicon)
  const judged = await evalLib.judgeCandidatesAsync(doc, report.hybridCandidates, pack, evalLib.flagJudge, { solutionId: p.id, gate: true })

  const findings = []
  for (const i of report.hardIssues) {
    const rule = ruleById.get(i.ruleId)
    findings.push({
      ruleId: i.ruleId,
      title: rule.title,
      tier: 'hard',
      severity: i.severity,
      question: rule.question,
      quote: i.evidence?.find((e) => e.kind === 'text')?.quote ?? '',
      absence: i.evidence?.find((e) => e.kind === 'absence') ?? null,
      finding: i.finding,
      suggestion: rule.suggestion,
    })
  }
  for (const i of judged.issues) {
    const rule = ruleById.get(i.ruleId)
    findings.push({
      ruleId: i.ruleId,
      title: rule.title,
      tier: 'hybrid',
      severity: i.severity,
      question: rule.question,
      quote: i.quote,
      absence: null,
      finding: i.finding,
      suggestion: rule.suggestion,
    })
  }
  const engineVerdict = engine.computeVerdict(
    findings.map((f) => ({ status: 'confirmed', tier: 'hard', severity: f.severity })),
    cfg,
  ).verdict

  const pending = p.pending.map((id) => {
    const rule = ruleById.get(id)
    return { ruleId: id, title: rule?.title ?? id, severity: rule?.severity ?? 'major', question: rule?.question ?? '' }
  })

  packets.push({
    id: p.id,
    expectedVerdict: p.expectedVerdict,
    truth: truth.get(p.id)?.defects ?? [],
    engineVerdict,
    findings,
    pending,
    markdown: md,
  })
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'packets.json'), JSON.stringify(packets, null, 2) + '\n')
const stats = packets.map((p) => `${p.id} engine=${p.engineVerdict} findings=${p.findings.length} pending=${p.pending.length}`)
writeFileSync(join(outDir, 'packets.md'), `# packets\n\n${stats.join('\n')}\n`)
const blind = packets.map(({ id, findings, pending, markdown }) => ({ id, findings, pending, markdown }))
writeFileSync(join(outDir, 'packets-blind.json'), JSON.stringify(blind, null, 2) + '\n')
console.log(`packets: ${packets.length} → ${outDir}/packets.json`)
for (const s of stats) console.log('  ' + s)
