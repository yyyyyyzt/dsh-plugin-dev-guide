// Evaluation harness (S5): metrics, labelling, synthetic generator, anonymization, baselines, eval_runs.
import { describe, it } from 'vitest'

describe('metrics (T-EVA-01, T-EVA-02)', () => {
  it.todo('precision / recall / F1 / severity-weighted recall on 3 hand-built solutions match hand computation')
  it.todo('Cohen kappa (unweighted) and quadratic-weighted kappa on a known 3×3 confusion matrix match reference values')
  it.todo('macro F1 over the three verdict classes matches reference')
})

describe('online labels (T-EVA-03)', () => {
  it.todo('adopt → TP, rewrite → TP, reject → FP, add → FN, pending confirmed by expert → TP (reported separately)')
})

describe('synthetic dataset (T-EVA-04, T-EVA-05, T-EVA-06)', () => {
  it.todo('same seed → byte-identical output across two runs')
  it.todo('100 solutions with each verdict class ≥ 15; per-solution ground truth equals computeVerdict over injected defects')
  it.todo('「满足」 phrasing of each requirement does not trigger a hard/hybrid fail (self-check)')
  it.todo('check() over the synthetic set produces the same hash on 3 consecutive runs')
})

describe('anonymization (T-EVA-07)', () => {
  it.todo('province / channel / service names / channel codes in sample text are all replaced')
  it.todo('leakage grep against the forbidden-term list yields 0 hits on the anonymized corpus')
  it.todo('mapping is deterministic for the same input and stored only under paper/data/private (gitignored)')
})

describe('baselines (T-EVA-08)', () => {
  it.todo('B0 keyword baseline passes 「关键词在但内容空」 phrases (reproduces the legacy defect)')
  it.todo('B1 LLM-direct baseline runs without the verifier/gate/policy modules')
})

describe('eval_runs records (T-EVA-09)', () => {
  it.todo('each run stores config (ablation id), dataset id, model, promptHash, repetition index, metrics, perRule[], perSolution[]')
})
