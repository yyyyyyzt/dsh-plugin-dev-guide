import type { Doc } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function parseMarkdown(_source: string): Doc {
  throw new NotImplementedError('parseMarkdown')
}
