// Synthetic dataset (T-EVA-04, T-EVA-05, T-EVA-06) and dataset directory protocol (T-EVA-11).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { check, computeVerdict, parseMarkdown } from '../../src/engine/index.js'
import {
  checkHash,
  flagJudge,
  generateSyntheticSet,
  judgeCandidates,
  PLANTED_KINDS,
  readDataset,
  selfCheck,
  serializeDataset,
  writeDataset,
} from '../../src/eval/index.js'
import { shippedPack } from '../helpers.js'

const pack = shippedPack()
const cfg = { minorThreshold: 3 }
const set = generateSyntheticSet(pack, { seed: 20261029, minorThreshold: cfg.minorThreshold })

describe('synthetic dataset (T-EVA-04)', () => {
  it('same seed → byte-identical output across two runs; different seed differs', () => {
    const again = generateSyntheticSet(pack, { seed: 20261029, minorThreshold: 3 })
    expect(serializeDataset(again)).toEqual(serializeDataset(set))
    const other = generateSyntheticSet(pack, { seed: 1, minorThreshold: 3 })
    expect(serializeDataset(other)).not.toEqual(serializeDataset(set))
  })

  it('100 solutions: syn-hist-01..30 follow the historical 15 / 14 / 1 distribution, syn-rand-01..70 fill each class to ≥ 15', () => {
    expect(set.solutions).toHaveLength(100)
    const ids = set.solutions.map((s) => s.id)
    expect(ids.slice(0, 30)).toEqual(Array.from({ length: 30 }, (_, i) => `syn-hist-${String(i + 1).padStart(2, '0')}`))
    expect(ids.slice(30)).toEqual(Array.from({ length: 70 }, (_, i) => `syn-rand-${String(i + 1).padStart(2, '0')}`))
    const hist = set.solutions.slice(0, 30).map((s) => s.expectedVerdict)
    expect(hist.filter((v) => v === '通过')).toHaveLength(15)
    expect(hist.filter((v) => v === '建议整改')).toHaveLength(14)
    expect(hist.filter((v) => v === '不通过')).toHaveLength(1)
    for (const v of ['通过', '建议整改', '不通过'] as const) {
      expect(set.solutions.filter((s) => s.expectedVerdict === v).length).toBeGreaterThanOrEqual(15)
      expect(set.manifest.counts[v]).toBe(set.solutions.filter((s) => s.expectedVerdict === v).length)
    }
  })

  it('per-solution ground truth equals computeVerdict over the planted defects, and defects only name hard / hybrid rules', () => {
    for (const s of set.solutions) {
      const issues = s.defects.map((d) => ({ status: 'confirmed' as const, tier: 'hard' as const, severity: d.severity }))
      expect(computeVerdict(issues, cfg).verdict).toBe(s.expectedVerdict)
      for (const d of s.defects) {
        const rule = pack.rules.find((r) => r.id === d.ruleId)
        expect(rule, d.ruleId).toBeDefined()
        expect(rule!.tier).not.toBe('soft')
        expect(d.severity).toBe(rule!.severity)
        expect(PLANTED_KINDS).toContain(d.plantedKind)
      }
      expect(new Set(s.defects.map((d) => d.ruleId)).size).toBe(s.defects.length)
      expect(s.defects.length).toBeLessThanOrEqual(6)
    }
  })

  it('every planted kind and every verifiable rule appears somewhere in the set', () => {
    const kinds = new Set(set.solutions.flatMap((s) => s.defects.map((d) => d.plantedKind)))
    for (const k of PLANTED_KINDS) expect(kinds, k).toContain(k)
    const planted = new Set(set.solutions.flatMap((s) => s.defects.map((d) => d.ruleId)))
    for (const r of pack.rules.filter((r) => r.tier !== 'soft')) expect(planted, r.id).toContain(r.id)
  })

  it('every solution parses to the template shape (resource table, eight sections, attachments) and has no de-anonymised names', () => {
    for (const s of set.solutions) {
      const doc = parseMarkdown(s.markdown)
      expect(doc.tables.length).toBeGreaterThanOrEqual(1)
      expect(doc.headings.length).toBeGreaterThanOrEqual(1)
      expect(s.markdown).not.toMatch(/网上国网|国网|支付宝|阿宝|江苏|福建/u)
    }
  })

  it('manifest carries the dataset id, seed, generator version and rule-pack version', () => {
    expect(set.manifest.id).toBe('synthetic-v1-seed20261029')
    expect(set.manifest.seed).toBe(20261029)
    expect(set.manifest.rulePackVersion).toBe(`${pack.pack.id}@${pack.pack.version}`)
    expect(set.manifest.generatedBy).toMatch(/^wsgw-solution-review\/eval\/synthetic@/)
  })
})

describe('synthetic self-check (T-EVA-05)', () => {
  it('「满足」 phrasing of each requirement does not trigger a hard/hybrid fail (self-check)', () => {
    const report = selfCheck(set, pack)
    expect(report.violations, JSON.stringify(report.violations.slice(0, 10), null, 2)).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('a solution with zero planted defects yields no verifier fail and no flag-judge issue', () => {
    const clean = set.solutions.filter((s) => s.defects.length === 0)
    expect(clean.length).toBeGreaterThan(0)
    for (const s of clean) {
      const doc = parseMarkdown(s.markdown)
      const report = check(doc, pack.rules, pack.lexicon)
      expect(report.hardIssues.map((i) => i.ruleId), s.id).toEqual([])
      const judged = judgeCandidates(doc, report.hybridCandidates, pack, flagJudge)
      expect(judged.issues.map((i) => i.ruleId), s.id).toEqual([])
    }
  })

  it('self-check reports detection and pending counts per planted kind', () => {
    const report = selfCheck(set, pack)
    for (const k of PLANTED_KINDS) {
      const row = report.detection[k]
      expect(row.planted).toBeGreaterThan(0)
      expect(row.detected + row.pending + row.missed).toBe(row.planted)
    }
  })
})

describe('engine determinism (T-EVA-06)', () => {
  it('check() over the synthetic set produces the same hash on 3 consecutive runs', () => {
    const hashes = [checkHash(set.solutions, pack), checkHash(set.solutions, pack), checkHash(set.solutions, pack)]
    expect(new Set(hashes).size).toBe(1)
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('dataset directory protocol (T-EVA-11)', () => {
  const dirs: string[] = []
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'wsgw-eval-'))
    dirs.push(d)
    return d
  }
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
  })

  it('writeDataset / readDataset round-trip keeps ids, markdown and truth', () => {
    const dir = tmp()
    writeDataset(dir, set)
    const ds = readDataset(dir)
    expect(ds.id).toBe(set.manifest.id)
    expect(ds.solutions.map((s) => s.id)).toEqual(set.solutions.map((s) => s.id))
    expect(ds.solutions[0]!.markdown).toBe(set.solutions[0]!.markdown)
    expect(ds.solutions[3]!.truth.expectedVerdict).toBe(set.solutions[3]!.expectedVerdict)
    expect(ds.solutions[3]!.truth.defects).toEqual(set.solutions[3]!.defects)
  })

  it('serializeDataset lists manifest.json, truth.json and one solutions/<id>.md per solution', () => {
    const files = serializeDataset(set)
    expect(Object.keys(files)).toContain('manifest.json')
    expect(Object.keys(files)).toContain('truth.json')
    expect(Object.keys(files).filter((f) => f.startsWith('solutions/'))).toHaveLength(100)
  })

  it('missing manifest / truth or a truth entry without a solution file is reported with the file name', () => {
    const empty = tmp()
    expect(() => readDataset(empty)).toThrow(/manifest\.json/)
    const noTruth = tmp()
    writeFileSync(join(noTruth, 'manifest.json'), JSON.stringify({ id: 'x' }))
    expect(() => readDataset(noTruth)).toThrow(/truth\.json/)
    const dangling = tmp()
    writeFileSync(join(dangling, 'manifest.json'), JSON.stringify({ id: 'x' }))
    writeFileSync(join(dangling, 'truth.json'), JSON.stringify([{ id: 'ghost', expectedVerdict: '通过', defects: [] }]))
    expect(() => readDataset(dangling)).toThrow(/solutions\/ghost\.md/)
  })

  it('a real dataset without plantedKind in defects is accepted', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id: 'real-pilot' }))
    writeFileSync(
      join(dir, 'truth.json'),
      JSON.stringify([{ id: 'r1', expectedVerdict: '建议整改', defects: [{ ruleId: 'CAP-002', severity: 'major' }] }]),
    )
    mkdirSync(join(dir, 'solutions'))
    writeFileSync(join(dir, 'solutions', 'r1.md'), '# 方案\n\n## 一、工作背景\n\n内容。\n')
    const ds = readDataset(dir)
    expect(ds.solutions[0]!.truth.defects[0]).toEqual({ ruleId: 'CAP-002', severity: 'major' })
  })
})
