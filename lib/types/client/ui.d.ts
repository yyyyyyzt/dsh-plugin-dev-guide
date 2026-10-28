import * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Severity, Verdict } from '../engine/types.js';
import type { ReviewState } from './model.js';
export declare const C: {
    label: string;
    secondary: string;
    tertiary: string;
    border: string;
    borderStrong: string;
    base: string;
    layer1: string;
    layer2: string;
    hover: string;
    brand: string;
    success: string;
    warn: string;
    error: string;
};
export declare const brandMix: (percent: number) => string;
export declare const EMPTY_CELL: string;
/** Hover and focus rings need selectors; everything else stays inline. */
export declare const SCOPED_CSS: string;
export declare const S: Record<string, CSSProperties>;
export declare const VERDICT_COLOR: Record<Verdict, string>;
export declare const SEVERITY_COLOR: Record<Severity, string>;
export declare const STATE_COLOR: Record<ReviewState, string | undefined>;
export declare function Pill({ children, color }: {
    children: ReactNode;
    color?: string | undefined;
}): React.ReactElement;
export declare function VerdictPill({ verdict, prefix }: {
    verdict: Verdict;
    prefix?: string;
}): React.ReactElement;
export declare function Chip({ on, onClick, children, ...rest }: {
    on: boolean;
    onClick: () => void;
    children: ReactNode;
} & Record<`data-${string}`, string>): React.ReactElement;
export declare function Empty({ children }: {
    children: ReactNode;
}): React.ReactElement;
export declare function ErrorBar({ message, onRetry }: {
    message: string;
    onRetry?: (() => void) | undefined;
}): React.ReactElement;
