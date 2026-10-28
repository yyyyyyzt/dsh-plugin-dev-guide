import type { ReviewStore } from './store.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        solutionReview: ReviewStore;
    }
}
export type { ReviewStore };
