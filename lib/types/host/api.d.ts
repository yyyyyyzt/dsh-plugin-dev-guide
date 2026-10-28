import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { type OverviewPayload, type ReviewDetailPayload, type ReviewListPayload, type RulesPayload } from './api-types.js';
import type { ReviewStore } from './store.js';
export type { OverviewPayload, ReviewCounts, ReviewDetailPayload, ReviewListPayload, ReviewStamp, ReviewView, RulesPayload } from './api-types.js';
export declare const name = "wsgw-solution-review-api";
export declare const inject: string[];
export declare const API_PREFIX = "/plugins/wsgw-solution-review/api";
interface Route {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
interface WebServer {
    register(route: Route): () => void;
}
interface Connection {
    requestRejection(req: IncomingMessage): 401 | 403 | undefined;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        webServer: WebServer;
        connection: Connection;
    }
}
export declare function overviewPayload(store: ReviewStore): OverviewPayload;
export declare function rulesPayload(store: ReviewStore): RulesPayload;
export declare function reviewListPayload(store: ReviewStore, page: number): ReviewListPayload;
export declare function reviewDetailPayload(store: ReviewStore, reviewId: string): ReviewDetailPayload;
export declare function apply(ctx: Context): void;
