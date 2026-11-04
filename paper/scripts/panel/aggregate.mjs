#!/usr/bin/env node
// Aggregate the mock-panel decisions into the numbers a "panel" section would report.
// Reads paper/data/simulated/panel/{packets.json,decisions-E*.json} and writes results.json + report.md.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const dir = resolve(here, '../../data/simulated/panel')
const packets = JSON.parse(readFileSync(join(dir, 'packets.json'), 'utf8'))
const packetById = new Map(packets.map((p) => [p.id, p]))
const findingIndex = new Map() // `${id}::${ruleId}` -> finding
for (const p of packets) for (const f of p.findings) findingIndex.set(`${p.id}::${f.ruleId}`, f)

const files = readdirSync(dir).filter((f) => /^decisions-E\d+\.json$/.test(f)).sort()
const experts = files.map((f) => {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  return { file: f, id: d.expert ?? f.match(/decisions-(E\d+)/)[1], decisions: d.decisions ?? [] }
})

const verdicts = ['通过', '建议整改', '不通过']
const counts = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})

const perExpert = []
for (const e of experts) {
  const rows = []
  for (const r of e.decisions) {
    const p = packetById.get(r.id)
    if (!p) continue
    for (const d of r.decisions ?? []) {
      const f = findingIndex.get(`${r.id}::${d.ruleId}`)
      rows.push({ id: r.id, ruleId: d.ruleId, action: d.action, tier: f?.tier ?? 'unknown', severity: f?.severity ?? 'unknown', rewrite: !!d.rewriteText })
    }
    rows.push({ id: r.id, verdictRow: true, verdict: r.verdict, added: (r.addedFindings ?? []).length })
  }
  const acts = rows.filter((r) => !r.verdictRow)
  const vrows = rows.filter((r) => r.verdictRow)
  const byTier = {}
  for (const r of acts) {
    byTier[r.tier] ??= { accept: 0, reject: 0, rewrite: 0, n: 0 }
    byTier[r.tier][r.action] = (byTier[r.tier][r.action] ?? 0) + 1
    byTier[r.tier].n += 1
  }
  const bySeverity = {}
  for (const r of acts) {
    bySeverity[r.severity] ??= { accept: 0, reject: 0, rewrite: 0, n: 0 }
    bySeverity[r.severity][r.action] = (bySeverity[r.severity][r.action] ?? 0) + 1
    bySeverity[r.severity].n += 1
  }
  const agreement = vrows.filter((v) => packetById.get(v.id)?.engineVerdict === v.verdict).length
  const matchTruth = vrows.filter((v) => packetById.get(v.id)?.expectedVerdict === v.verdict).length
  perExpert.push({
    expert: e.id,
    findings: acts.length,
    accept: acts.filter((r) => r.action === 'accept').length,
    reject: acts.filter((r) => r.action === 'reject').length,
    rewrite: acts.filter((r) => r.action === 'rewrite').length,
    acceptRate: +(acts.filter((r) => r.action === 'accept').length / acts.length).toFixed(3),
    added: vrows.reduce((n, v) => n + v.added, 0),
    verdicts: counts(vrows.map((v) => v.verdict)),
    agreeEngine: agreement,
    agreeTruth: matchTruth,
    byTier,
    bySeverity,
  })
}

// rule-level acceptance across experts (rules seen by >=2 experts)
const ruleStats = {}
for (const e of experts) {
  for (const r of e.decisions) {
    for (const d of r.decisions ?? []) {
      const f = findingIndex.get(`${r.id}::${d.ruleId}`)
      const key = d.ruleId
      ruleStats[key] ??= { ruleId: key, title: f?.title ?? '', tier: f?.tier, severity: f?.severity, accept: 0, reject: 0, rewrite: 0 }
      ruleStats[key][d.action] = (ruleStats[key][d.action] ?? 0) + 1
    }
  }
}
const rules = Object.values(ruleStats)
  .map((r) => ({ ...r, n: r.accept + r.reject + r.rewrite, acceptRate: +(r.accept / (r.accept + r.reject + r.rewrite)).toFixed(3) }))
  .sort((a, b) => a.acceptRate - b.acceptRate || b.n - a.n)

// Fleiss kappa on the binary decision (accept vs not) over findings judged by all experts
const shared = new Set()
for (const p of packets) {
  for (const f of p.findings) {
    const seen = experts.filter((e) => e.decisions.some((r) => r.id === p.id && (r.decisions ?? []).some((d) => d.ruleId === f.ruleId)))
    if (seen.length === experts.length) shared.add(`${p.id}::${f.ruleId}`)
  }
}
function fleiss(items, categories) {
  const n = items.length
  if (!n) return null
  const k = categories.length
  const P = []
  const pj = Object.fromEntries(categories.map((c) => [c, 0]))
  let total = 0
  for (const countsByCat of items) {
    const m = categories.reduce((s, c) => s + (countsByCat[c] ?? 0), 0)
    total += m
    for (const c of categories) pj[c] += countsByCat[c] ?? 0
    let sumSq = 0
    for (const c of categories) sumSq += (countsByCat[c] ?? 0) ** 2
    P.push((sumSq - m) / (m * (m - 1)))
  }
  const Pbar = P.reduce((a, b) => a + b, 0) / n
  const Pe = categories.reduce((s, c) => s + (pj[c] / total) ** 2, 0)
  return { kappa: +((Pbar - Pe) / (1 - Pe)).toFixed(3), Pbar: +Pbar.toFixed(3), Pe: +Pe.toFixed(3), items: n }
}
const items = []
for (const key of shared) {
  const [id, ruleId] = key.split('::')
  const c = { accept: 0, not: 0 }
  for (const e of experts) {
    const d = e.decisions.find((r) => r.id === id)?.decisions?.find((x) => x.ruleId === ruleId)
    if (!d) continue
    if (d.action === 'accept') c.accept += 1
    else c.not += 1
  }
  items.push(c)
}
const kappaAccept = fleiss(items, ['accept', 'not'])

// what the memory layer would learn: rules whose accept rate is low get demoted/suppressed
const learned = {
  demoteCandidates: rules.filter((r) => r.n >= 3 && r.acceptRate < 0.5).map((r) => `${r.ruleId} (${r.acceptRate}, n=${r.n})`),
  stable: rules.filter((r) => r.n >= 3 && r.acceptRate === 1).map((r) => `${r.ruleId} (n=${r.n})`),
}

const out = { experts: perExpert, rules, kappaAccept, sharedFindings: shared.size, learned, packets: packets.length }
writeFileSync(join(dir, 'results.json'), JSON.stringify(out, null, 2) + '\n')

const pct = (x) => (x * 100).toFixed(1) + '%'
const lines = []
lines.push('# Mock panel — simulated expert decisions', '')
lines.push(`packets: ${packets.length}; experts: ${experts.map((e) => e.id).join(', ')}; findings judged by at least one expert: ${rules.reduce((n, r) => n + r.n, 0)}`, '')
lines.push('| expert | findings | accept | reject | rewrite | accept rate | added | verdicts | = engine | = expected |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
for (const e of perExpert) {
  const v = verdicts.map((k) => `${k} ${e.verdicts[k] ?? 0}`).join(' / ')
  lines.push(`| ${e.expert} | ${e.findings} | ${e.accept} | ${e.reject} | ${e.rewrite} | ${pct(e.acceptRate)} | ${e.added} | ${v} | ${e.agreeEngine}/${packets.length} | ${e.agreeTruth}/${packets.length} |`)
}
lines.push('', '## By tier', '')
lines.push('| expert | hard accept | hybrid accept |', '|---|---|---|')
for (const e of perExpert) {
  const h = e.byTier.hard ? pct(e.byTier.hard.accept / e.byTier.hard.n) : '—'
  const y = e.byTier.hybrid ? pct(e.byTier.hybrid.accept / e.byTier.hybrid.n) : '—'
  lines.push(`| ${e.expert} | ${h} | ${y} |`)
}
lines.push('', '## By severity', '')
lines.push('| expert | blocker accept | major accept | minor accept |', '|---|---|---|---|')
for (const e of perExpert) {
  const g = (s) => (e.bySeverity[s] ? pct(e.bySeverity[s].accept / e.bySeverity[s].n) : '—')
  lines.push(`| ${e.expert} | ${g('blocker')} | ${g('major')} | ${g('minor')} |`)
}
lines.push('', `## Agreement on the ${shared.size} findings judged by all experts`, '')
lines.push(kappaAccept ? `Fleiss κ (accept vs not) = ${kappaAccept.kappa} (P̄ ${kappaAccept.Pbar}, Pe ${kappaAccept.Pe}, n=${kappaAccept.items})` : 'not enough overlap', '')
lines.push('## Rule-level acceptance (all experts)', '')
lines.push('| rule | tier | severity | n | accept | reject | rewrite | accept rate |')
lines.push('|---|---|---|---|---|---|---|---|')
for (const r of rules) lines.push(`| ${r.ruleId} | ${r.tier} | ${r.severity} | ${r.n} | ${r.accept} | ${r.reject} | ${r.rewrite} | ${pct(r.acceptRate)} |`)
lines.push('', '## What a memory layer would learn', '')
lines.push(`- demote/suppress candidates (accept rate < 50%, n≥3): ${learned.demoteCandidates.length ? learned.demoteCandidates.join(', ') : 'none'}`)
lines.push(`- stable rules (100% accepted, n≥3): ${learned.stable.length ? learned.stable.join(', ') : 'none'}`)
writeFileSync(join(dir, 'report.md'), lines.join('\n') + '\n')
console.log(`experts=${experts.length} rules=${rules.length} kappa=${kappaAccept?.kappa} → ${dir}/report.md`)
for (const e of perExpert) console.log(`  ${e.expert}: ${e.accept}/${e.findings} accept (${pct(e.acceptRate)}), added ${e.added}, verdicts ${JSON.stringify(e.verdicts)}`)
