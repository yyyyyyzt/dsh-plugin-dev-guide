import type { OpinionInput } from '../types.js'
import { NotImplementedError } from '../not-implemented.js'

export function renderOpinion(_input: OpinionInput): string {
  throw new NotImplementedError('renderOpinion')
}

export function opinionFileName(_reviewId: string, _version: number): string {
  throw new NotImplementedError('opinionFileName')
}
