// `table` verifier (rule-schema.md §3.2). Among the located tables, the rule passes if any table satisfies
// every check; otherwise the first candidate's failures are reported.
import { normalize } from '../normalize.js'
import type { Doc, Evidence, Lexicon, TableBlock, TableParams, VerifierResult } from '../types.js'
import { absenceEvidence, absenceOffset, isPlaceholder, sectionsFor, tablesIn } from './common.js'

function cellEvidence(table: TableBlock, row: number, col: number): Evidence {
  const text = row === 0 ? table.header[col] : table.rows[row - 1]?.[col]
  const range = table.cellRanges[row]?.[col] ?? table.range
  return { quote: text ?? '', sectionPath: table.sectionPath, range, kind: 'table-cell' }
}

function columnIndex(table: TableBlock, aliases: string[]): number {
  const header = table.header.map((h) => normalize(h))
  for (const alias of aliases) {
    const a = normalize(alias)
    const idx = header.findIndex((h) => h === a || h.includes(a))
    if (idx >= 0) return idx
  }
  return -1
}

interface Outcome {
  ok: boolean
  evidence: Evidence[]
  note?: string
}

function evaluate(table: TableBlock, params: TableParams, lexicon: Lexicon): Outcome {
  const minRows = params.minRows ?? 1
  if (table.rows.length < minRows) {
    return { ok: false, evidence: [cellEvidence(table, 0, 0)], note: `表格仅 ${table.rows.length} 行，少于 minRows ${minRows}` }
  }

  const missing: string[] = []
  const colIdx: number[] = []
  for (const group of params.requiredColumns ?? []) {
    const idx = columnIndex(table, group)
    if (idx < 0) missing.push(group.join('/'))
    else colIdx.push(idx)
  }
  if (missing.length) {
    return { ok: false, evidence: [cellEvidence(table, 0, 0)], note: `缺少列：${missing.join('、')}` }
  }

  if ((params.placeholderCells ?? 'fail') === 'fail' && colIdx.length) {
    const bad: Evidence[] = []
    table.rows.forEach((row, ri) => {
      for (const ci of colIdx) if (isPlaceholder(row[ci] ?? '', lexicon)) bad.push(cellEvidence(table, ri + 1, ci))
    })
    if (bad.length) return { ok: false, evidence: bad, note: `必填列存在 ${bad.length} 个占位单元格` }
  }

  if (params.requireRow) {
    const ci = columnIndex(table, params.requireRow.column)
    if (ci < 0) {
      return { ok: false, evidence: [cellEvidence(table, 0, 0)], note: `缺少列：${params.requireRow.column.join('/')}` }
    }
    const wanted = params.requireRow.equalsAny.map((v) => normalize(v).toLowerCase())
    const ri = table.rows.findIndex((row) => wanted.includes(normalize(row[ci] ?? '').toLowerCase()))
    if (ri < 0) {
      return {
        ok: false,
        evidence: [cellEvidence(table, 0, ci)],
        note: `未找到「${params.requireRow.column[0]}」列值为 ${params.requireRow.equalsAny.join(' / ')} 的行`,
      }
    }
    return { ok: true, evidence: [cellEvidence(table, ri + 1, ci)] }
  }

  const headerEvidence: Evidence = {
    quote: table.header.join(' | '),
    sectionPath: table.sectionPath,
    range: table.cellRanges[0]?.[0] ?? table.range,
    kind: 'table-cell',
  }
  return { ok: true, evidence: [headerEvidence] }
}

export function verifyTable(doc: Doc, params: TableParams, lexicon: Lexicon): VerifierResult {
  const scope = params.locate.section ? sectionsFor(doc, lexicon, [params.locate.section]) : null
  const headerAny = (params.locate.headerAny ?? []).map((h) => normalize(h))
  const candidates = tablesIn(doc, scope).filter((t) => {
    if (!headerAny.length) return true
    const header = t.header.map((h) => normalize(h))
    return headerAny.some((k) => header.some((h) => h.includes(k)))
  })

  if (!candidates.length) {
    const label = params.locate.headerAny?.join('/') ?? params.locate.section ?? '表格'
    const at = absenceOffset(doc, scope)
    return {
      status: 'fail',
      evidence: [absenceEvidence(doc, `缺失：表格（${label}）`, at.offset, at.sectionPath)],
      note: `未找到表头含「${label}」的表格`,
    }
  }

  let firstFailure: Outcome | undefined
  for (const t of candidates) {
    const o = evaluate(t, params, lexicon)
    if (o.ok) return { status: 'pass', evidence: o.evidence }
    firstFailure ??= o
  }
  const f = firstFailure!
  return f.note !== undefined ? { status: 'fail', evidence: f.evidence, note: f.note } : { status: 'fail', evidence: f.evidence }
}
