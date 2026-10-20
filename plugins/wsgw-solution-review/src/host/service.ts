// Service declaration: `ctx.solutionReview` is the ReviewStore the host entry provides (design.md §3.1).
import type { ReviewStore } from './store.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    solutionReview: ReviewStore
  }
}

export type { ReviewStore }
