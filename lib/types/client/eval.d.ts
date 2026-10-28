import * as React from 'react';
import { type DashboardEvalRun, type EvalRunsPayload } from './model.js';
export declare function EvalView({ data, selected, notice, compared, onToggle, onCompare }: {
    data: EvalRunsPayload;
    selected: string[];
    notice: string | null;
    compared: DashboardEvalRun[] | null;
    onToggle: (runId: string) => void;
    onCompare: () => void;
}): React.ReactElement;
export declare function EvalTab({ version }: {
    version: number;
}): React.ReactElement;
