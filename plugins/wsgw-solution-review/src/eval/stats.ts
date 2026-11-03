// Statistics for small-sample evaluation (evaluation.md §6): seeded RNG, bootstrap CI, Wilcoxon, McNemar, Holm.

/** splitmix32-derived generator: deterministic across platforms, good enough for resampling. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x9e3779b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
    z = (z ^ (z >>> 15)) >>> 0
    return z / 4294967296
  }
}

export interface BootstrapOptions {
  resamples?: number
  seed?: number
  alpha?: number
}

export interface BootstrapResult {
  estimate: number
  lower: number
  upper: number
  resamples: number
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return Number.NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const w = pos - lo
  return sorted[lo]! * (1 - w) + sorted[hi]! * w
}

/** Percentile bootstrap over `items` (resampling unit = one item, e.g. one solution). */
export function bootstrapCI<T>(items: T[], statistic: (sample: T[]) => number, opts: BootstrapOptions = {}): BootstrapResult {
  const resamples = opts.resamples ?? 1000
  const alpha = opts.alpha ?? 0.05
  const estimate = statistic(items)
  if (items.length === 0) return { estimate, lower: estimate, upper: estimate, resamples }
  const rand = seededRandom(opts.seed ?? 1)
  const values: number[] = []
  for (let i = 0; i < resamples; i++) {
    const sample: T[] = []
    for (let j = 0; j < items.length; j++) sample.push(items[Math.floor(rand() * items.length)]!)
    const v = statistic(sample)
    if (Number.isFinite(v)) values.push(v)
  }
  values.sort((a, b) => a - b)
  return { estimate, lower: quantile(values, alpha / 2), upper: quantile(values, 1 - alpha / 2), resamples }
}

function erfc(x: number): number {
  // Numerical Recipes erfc approximation (fractional error < 1.2e-7).
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? r : 2 - r
}

export function normalTwoSidedP(z: number): number {
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2))
}

export interface WilcoxonResult {
  n: number
  statistic: number
  z: number
  pValue: number
}

/** Paired Wilcoxon signed-rank test (normal approximation with tie correction; zero differences dropped). */
export function wilcoxonSignedRank(a: number[], b: number[]): WilcoxonResult {
  if (a.length !== b.length) throw new Error('wilcoxonSignedRank: paired samples must have equal length')
  const diffs = a.map((x, i) => x - b[i]!).filter((d) => d !== 0)
  const n = diffs.length
  if (n === 0) return { n: 0, statistic: 0, z: 0, pValue: 1 }

  const abs = diffs.map((d, i) => ({ v: Math.abs(d), i })).sort((x, y) => x.v - y.v)
  const ranks = new Array<number>(n)
  let tieCorrection = 0
  let k = 0
  while (k < n) {
    let m = k
    while (m + 1 < n && abs[m + 1]!.v === abs[k]!.v) m++
    const avg = (k + m + 2) / 2
    for (let j = k; j <= m; j++) ranks[abs[j]!.i] = avg
    const t = m - k + 1
    if (t > 1) tieCorrection += t ** 3 - t
    k = m + 1
  }
  let wPlus = 0
  let wMinus = 0
  diffs.forEach((d, i) => {
    if (d > 0) wPlus += ranks[i]!
    else wMinus += ranks[i]!
  })
  const statistic = Math.min(wPlus, wMinus)
  const mean = (n * (n + 1)) / 4
  const variance = (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48
  const z = variance > 0 ? (statistic - mean) / Math.sqrt(variance) : 0
  return { n, statistic, z, pValue: variance > 0 ? normalTwoSidedP(z) : 1 }
}

export interface McNemarResult {
  b: number
  c: number
  method: 'exact' | 'chi2'
  statistic: number
  pValue: number
}

function logChoose(n: number, k: number): number {
  let r = 0
  for (let i = 1; i <= k; i++) r += Math.log(n - k + i) - Math.log(i)
  return r
}

function chi2OneDfP(x: number): number {
  return erfc(Math.sqrt(x) / Math.SQRT2)
}

/** McNemar test on discordant counts b (A right, B wrong) and c (A wrong, B right). */
export function mcnemar(b: number, c: number): McNemarResult {
  const n = b + c
  if (n === 0) return { b, c, method: 'exact', statistic: 0, pValue: 1 }
  if (n < 25) {
    const k = Math.min(b, c)
    let p = 0
    for (let i = 0; i <= k; i++) p += Math.exp(logChoose(n, i) - n * Math.LN2)
    return { b, c, method: 'exact', statistic: k, pValue: Math.min(1, 2 * p) }
  }
  const statistic = (Math.abs(b - c) - 1) ** 2 / n
  return { b, c, method: 'chi2', statistic, pValue: chi2OneDfP(statistic) }
}

/** Holm step-down adjusted p-values (same order as input). */
export function holm(pValues: number[]): number[] {
  const m = pValues.length
  const order = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p)
  const adjusted = new Array<number>(m)
  let running = 0
  order.forEach(({ p, i }, rank) => {
    const v = Math.min(1, (m - rank) * p)
    running = Math.max(running, v)
    adjusted[i] = running
  })
  return adjusted
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
