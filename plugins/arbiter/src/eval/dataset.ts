// Dataset directory protocol (evaluation.md §2.5): synthetic and real datasets share one shape.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { Severity, Verdict } from '../engine/types.js'
import type { SyntheticSet } from './synthetic.js'

export interface TruthDefect {
  ruleId: string
  severity: Severity
  plantedKind?: string
}

export interface SolutionTruth {
  expectedVerdict: Verdict
  defects: TruthDefect[]
}

export interface DatasetSolution {
  id: string
  markdown: string
  truth: SolutionTruth
}

export interface Dataset {
  id: string
  manifest: Record<string, unknown>
  solutions: DatasetSolution[]
}

const ManifestSchema = z.object({ id: z.string().min(1) }).passthrough()
const TruthSchema = z.array(
  z.object({
    id: z.string().min(1),
    expectedVerdict: z.enum(['通过', '建议整改', '不通过']),
    defects: z.array(
      z.object({
        ruleId: z.string().min(1),
        severity: z.enum(['blocker', 'major', 'minor']),
        plantedKind: z.string().optional(),
      }),
    ),
  }),
)

export function toDataset(set: SyntheticSet): Dataset {
  return {
    id: set.manifest.id,
    manifest: { ...set.manifest },
    solutions: set.solutions.map((s) => ({ id: s.id, markdown: s.markdown, truth: { expectedVerdict: s.expectedVerdict, defects: s.defects } })),
  }
}

/** File map (relative path → contents) for a synthetic set; used for byte-identity checks and writing. */
export function serializeDataset(set: SyntheticSet): Record<string, string> {
  const files: Record<string, string> = {}
  files['manifest.json'] = JSON.stringify(set.manifest, null, 2) + '\n'
  files['truth.json'] =
    JSON.stringify(
      set.solutions.map((s) => ({ id: s.id, expectedVerdict: s.expectedVerdict, defects: s.defects, features: s.features })),
      null,
      2,
    ) + '\n'
  for (const s of set.solutions) files[`solutions/${s.id}.md`] = s.markdown
  return files
}

export function writeDataset(dir: string, set: SyntheticSet): string[] {
  const files = serializeDataset(set)
  const written: string[] = []
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf8')
    written.push(path)
  }
  return written
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`dataset: missing ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`dataset: ${path} is not valid JSON (${(e as Error).message})`)
  }
}

export function readDataset(dir: string): Dataset {
  const manifestPath = join(dir, 'manifest.json')
  const manifest = ManifestSchema.safeParse(readJson(manifestPath))
  if (!manifest.success) throw new Error(`dataset: ${manifestPath} invalid: ${manifest.error.message}`)
  const truthPath = join(dir, 'truth.json')
  const truth = TruthSchema.safeParse(readJson(truthPath))
  if (!truth.success) throw new Error(`dataset: ${truthPath} invalid: ${truth.error.message}`)

  const solutions: DatasetSolution[] = truth.data.map((t) => {
    const rel = `solutions/${t.id}.md`
    const path = join(dir, rel)
    if (!existsSync(path)) throw new Error(`dataset: truth.json references ${t.id} but ${rel} is missing`)
    return {
      id: t.id,
      markdown: readFileSync(path, 'utf8'),
      truth: {
        expectedVerdict: t.expectedVerdict,
        defects: t.defects.map((d): TruthDefect => (d.plantedKind === undefined ? { ruleId: d.ruleId, severity: d.severity } : { ruleId: d.ruleId, severity: d.severity, plantedKind: d.plantedKind })),
      },
    }
  })
  return { id: manifest.data.id, manifest: manifest.data, solutions }
}
