import type { Exemplar, Feedback, Issue, MemoryConfig, MemoryRecall, RuleCandidate, RuleStats } from './types.js'
import { NotImplementedError } from './not-implemented.js'

export function aggregateStats(_feedback: Feedback[], _shownByRule: Record<string, number>): Record<string, RuleStats> {
  throw new NotImplementedError('aggregateStats')
}

export function recall(
  _ruleId: string,
  _stats: RuleStats | undefined,
  _exemplars: Exemplar[],
  _feedback: Feedback[],
  _cfg: MemoryConfig,
): MemoryRecall {
  throw new NotImplementedError('recall')
}

export function trimExemplars(_list: Exemplar[], _perRule: number): Exemplar[] {
  throw new NotImplementedError('trimExemplars')
}

export function candidatesFrom(_issues: Issue[]): RuleCandidate[] {
  throw new NotImplementedError('candidatesFrom')
}

export function slidingAdoptRate(_feedbackByReview: Feedback[][], _window: number): (number | null)[] {
  throw new NotImplementedError('slidingAdoptRate')
}
