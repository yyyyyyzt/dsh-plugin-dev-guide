import * as React from 'react';
import type { ReactNode } from 'react';
import { type ReviewStamp } from './model.js';
export declare function OverviewPage(): React.ReactElement;
export interface AssistantViewProps {
    queue: ReviewStamp[];
    selected: string | null;
    onSelect: (reviewId: string) => void;
    detail: ReactNode;
    onOpenOverview: () => void;
    onRefresh: () => void;
}
export declare function AssistantView({ queue, selected, onSelect, detail, onOpenOverview, onRefresh }: AssistantViewProps): React.ReactElement;
export declare function ReviewAssistant({ openOverview }: {
    openOverview: () => void;
}): React.ReactElement;
