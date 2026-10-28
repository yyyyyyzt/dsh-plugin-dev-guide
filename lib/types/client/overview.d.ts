import * as React from 'react';
import type { ReactNode } from 'react';
import { type OverviewPayload, type ReviewFilter, type ReviewStamp } from './model.js';
export type ChartMode = 'calendar' | 'trend';
export declare function KpiCards({ data, today, pendingOn, onPending }: {
    data: OverviewPayload;
    today: Date;
    pendingOn: boolean;
    onPending: () => void;
}): React.ReactElement;
export declare function CalendarHeatmap({ items, today, selectedDay, onDay }: {
    items: ReviewStamp[];
    today: Date;
    selectedDay: string | undefined;
    onDay: (day: string | undefined) => void;
}): React.ReactElement;
export declare function TrendChart({ items, today }: {
    items: ReviewStamp[];
    today: Date;
}): React.ReactElement;
export interface ReviewsViewProps {
    data: OverviewPayload;
    today: Date;
    filter: ReviewFilter;
    onFilter: (filter: ReviewFilter) => void;
    chart: ChartMode;
    onChart: (mode: ChartMode) => void;
    expanded: string | null;
    onToggle: (reviewId: string) => void;
    detail: ReactNode;
    limit: number;
    onMore: () => void;
}
export declare function ReviewsView({ data, today, filter, onFilter, chart, onChart, expanded, onToggle, detail, limit, onMore }: ReviewsViewProps): React.ReactElement;
export declare function ReviewsTab({ version }: {
    version: number;
}): React.ReactElement;
