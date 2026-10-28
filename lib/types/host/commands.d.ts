import type { Context } from '@deepseek-ai/cordis';
import type { CommandResult } from '@deepseek-ai/dsh-commands';
import { type ReviewStore } from './store.js';
export declare const name = "wsgw-solution-review/commands";
export declare const inject: string[];
export declare function renderReviewSummary(store: ReviewStore, reviewId: string): string;
export declare function commandHandlers(store: ReviewStore): {
    review(rawInput: string): Promise<CommandResult>;
    rules(rawInput: string): Promise<CommandResult>;
    memory(rawInput: string): Promise<CommandResult>;
};
export declare function apply(ctx: Context): void;
