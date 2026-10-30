// Issue-level and verdict-level metrics (evaluation.md §4.1–§4.2) and online label mapping (§3).
import type { Severity, Verdict } from '../engine/types.js'

export const VERDICT_ORDER: readonly Verdict[] = ['通过', '建议整改', '不通过']
export const SEVERITY_WEIGHT: Record<Severity, number> = { blocker: 3, major: 2, minor: 1 }

export interface SolutionAlignment {
  id: string
  predicted: string[]
  truth: string[]
}

export interface IssueMetrics {
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
  f1: number
  weightedRecall: number
}

const ratio = (num: number, den: number): number => (den > 0 ? num / den : 0)

export function f1Of(precision: number, recall: number): number {
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
}

/** Alignment granularity is (solution, rule): duplicates inside one solution collapse to one. */
export function issueMetrics(rows: SolutionAlignment[], severityOf: (ruleId: string) => Severity): IssueMetrics {
  let tp = 0
  let fp = 0
  let fn = 0
  let wHit = 0
  let wAll = 0
  for (const row of rows) {
    const predicted = new Set(row.predicted)
    const truth = new Set(row.truth)
    for (const r of predicted) {
      if (truth.has(r)) tp += 1
      else fp += 1
    }
    for (const r of truth) {
      const w = SEVERITY_WEIGHT[severityOf(r)]
      wAll += w
      if (predicted.has(r)) wHit += w
      else fn += 1
    }
  }
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  return { tp, fp, fn, precision, recall, f1: f1Of(precision, recall), weightedRecall: ratio(wHit, wAll) }
}

export interface VerdictPair {
  predicted: Verdict
  actual: Verdict
}

/** Rows = actual, columns = predicted, both in VERDICT_ORDER. */
export function confusionMatrix(pairs: VerdictPair[]): number[][] {
  const k = VERDICT_ORDER.length
  const m = Array.from({ length: k }, () => new Array<number>(k).fill(0))
  for (const p of pairs) {
    const i = VERDICT_ORDER.indexOf(p.actual)
    const j = VERDICT_ORDER.indexOf(p.predicted)
    if (i < 0 || j < 0) throw new Error(`unknown verdict in pair: ${p.actual} / ${p.predicted}`)
    m[i]![j]! += 1
  }
  return m
}

function total(matrix: number[][]): number {
  return matrix.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0)
}

export function accuracy(matrix: number[][]): number {
  const n = total(matrix)
  return ratio(matrix.reduce((s, row, i) => s + (row[i] ?? 0), 0), n)
}

export function cohenKappa(matrix: number[][], weights: 'none' | 'quadratic' = 'none'): number {
  const k = matrix.length
  const n = total(matrix)
  if (n === 0) return 0
  const rowSum = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const colSum = matrix[0]!.map((_, j) => matrix.reduce((s, row) => s + row[j]!, 0))
  const w = (i: number, j: number): number => (weights === 'none' ? (i === j ? 0 : 1) : (i - j) ** 2 / (k - 1) ** 2)
  let observed = 0
  let expected = 0
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      observed += w(i, j) * matrix[i]![j]!
      expected += (w(i, j) * rowSum[i]! * colSum[j]!) / n
    }
  }
  if (expected === 0) return observed === 0 ? 1 : 0
  return 1 - observed / expected
}

export function macroF1(matrix: number[][]): number {
  const k = matrix.length
  let sum = 0
  for (let c = 0; c < k; c++) {
    const tp = matrix[c]![c]!
    const fp = matrix.reduce((s, row, i) => (i === c ? s : s + row[c]!), 0)
    const fn = matrix[c]!.reduce((s, v, j) => (j === c ? s : s + v), 0)
    sum += f1Of(ratio(tp, tp + fp), ratio(tp, tp + fn))
  }
  return k ? sum / k : 0
}

// ---------- online labels (evaluation.md §3) ----------

export type OnlineAction = 'adopt' | 'reject' | 'rewrite' | 'add'
export type IssueLabel = 'TP' | 'FP' | 'FN' | 'TP-pending' | 'FP-pending'

export function labelOf(input: { action: OnlineAction; wasPending?: boolean }): IssueLabel {
  switch (input.action) {
    case 'adopt':
    case 'rewrite':
      return input.wasPending ? 'TP-pending' : 'TP'
    case 'reject':
      return input.wasPending ? 'FP-pending' : 'FP'
    case 'add':
      return 'FN'
  }
}
