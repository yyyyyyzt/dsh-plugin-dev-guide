import * as React from 'react';
import { type CandidateAction, type DashboardMemory, type RuleAction, type RuleDetailPayload, type RuleFilter, type RulesPayload } from './model.js';
export interface RulesViewProps {
    data: RulesPayload;
    memory: DashboardMemory | null;
    filter: RuleFilter;
    onFilter: (filter: RuleFilter) => void;
    expanded: string | null;
    detail: RuleDetailPayload | null;
    busy: string | null;
    onToggle: (ruleId: string) => void;
    onAct: (ruleId: string, action: RuleAction) => void;
    onCandidate: (candidateId: string, action: CandidateAction) => void;
}
export declare function RulesView({ data, memory, filter, onFilter, expanded, detail, busy, onToggle, onAct, onCandidate }: RulesViewProps): React.ReactElement;
export declare function RulesTab({ version }: {
    version: number;
}): React.ReactElement;
