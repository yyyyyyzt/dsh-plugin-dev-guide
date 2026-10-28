import * as React from 'react';
import type { Verdict } from '../engine/types.js';
import { type DecideBody, type ReviewDetailPayload } from './model.js';
export declare function ReviewDetailView({ data, busy, onDecide, onReviewer, onVerdict, onDiscard }: {
    data: ReviewDetailPayload;
    busy: boolean;
    onDecide: (issueId: string, body: DecideBody) => void;
    onReviewer: (reviewer: string) => void;
    onVerdict: (verdict: Verdict) => void;
    onDiscard?: (reason: string) => void;
}): React.ReactElement;
/** Loads one review and wires its decisions; `onChanged` lets the caller refresh its own list. */
export declare function ReviewDetailPanel({ reviewId, version, onChanged }: {
    reviewId: string;
    version: number;
    onChanged: () => Promise<void>;
}): React.ReactElement;
