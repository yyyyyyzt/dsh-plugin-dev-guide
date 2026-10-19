import type { MermaidBlock } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export type ParsedMermaid = Pick<MermaidBlock, 'kind' | 'participants' | 'messages'>

export function parseMermaid(_raw: string): ParsedMermaid {
  throw new NotImplementedError('parseMermaid')
}
