// Minimal Mermaid sequenceDiagram reader (rule-schema.md §3.5, T-DES-03). Only what the verifiers need:
// participants (with alias resolution) and messages with arrow kind, text and line number.
import type { MermaidBlock, MermaidMessage } from '../types.js'

export type ParsedMermaid = Pick<MermaidBlock, 'kind' | 'participants' | 'messages'>

const PARTICIPANT = /^\s*(?:participant|actor)\s+(.+?)(?:\s+as\s+(.+?))?\s*$/
// Longest arrows first so `-->>` is not read as `--` + `>>`.
const MESSAGE = /^\s*([^\s:]+?)\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?\s*([^\s:]+?)\s*:\s*(.*?)\s*$/

export function parseMermaid(raw: string): ParsedMermaid {
  const lines = raw.split(/\r?\n/)
  const firstContent = lines.find((l) => l.trim().length > 0)
  if (!firstContent || !/^\s*sequenceDiagram\b/.test(firstContent)) {
    return { kind: 'other', participants: [], messages: [] }
  }

  const alias = new Map<string, string>()
  const participants: string[] = []
  const messages: MermaidMessage[] = []

  const nameOf = (id: string): string => alias.get(id) ?? id
  const ensure = (id: string): void => {
    const name = nameOf(id)
    if (!participants.includes(name)) participants.push(name)
  }

  lines.forEach((line, idx) => {
    const p = PARTICIPANT.exec(line)
    if (p) {
      const id = p[1]!.trim()
      const display = (p[2] ?? id).trim()
      alias.set(id, display)
      if (!participants.includes(display)) participants.push(display)
      return
    }
    const m = MESSAGE.exec(line)
    if (!m) return
    const [, from, arrow, to, text] = m
    ensure(from!)
    ensure(to!)
    messages.push({ from: nameOf(from!), to: nameOf(to!), arrow: arrow!, text: text ?? '', line: idx + 1 })
  })

  return { kind: 'sequence', participants, messages }
}
