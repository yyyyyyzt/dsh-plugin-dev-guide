import type { Dimension, IssueOrigin, IssueStatus, RuleStats, Severity, Tier, Verdict, ChecklistStatus, RuleStatus } from '../engine/types.js';
import type { OverviewPayload, ReviewDetailPayload, RulesPayload, ReviewStamp, ReviewState, ReviewView } from '../host/api-types.js';
import type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, RuleDetailPayload, RuleView, SlidingAdoptPoint } from '../host/store.js';
import type { RuleCandidateRecord } from '../store/domain.js';
export { reviewState } from '../host/api-types.js';
export type { DashboardEvalRun, DashboardMemory, DashboardMemoryRule, OverviewPayload, ReviewDetailPayload, ReviewStamp, ReviewState, ReviewView, RuleDetailPayload, RulesPayload, RuleView };
export declare const API_PREFIX = "/plugins/wsgw-solution-review/api";
export declare const PAGE_SIZE = 50;
export declare const MAX_COMPARE = 7;
export declare const SUGGESTION_MAX = 500;
export interface EvalRunsPayload {
    runs: DashboardEvalRun[];
}
export interface RuleFilter {
    dimension?: Dimension | undefined;
    tier?: Tier | undefined;
    status?: RuleStatus | undefined;
    query?: string | undefined;
    overriddenOnly?: boolean | undefined;
}
export type DecideBody = {
    action: 'adopt';
} | {
    action: 'reject';
    reason?: string;
} | {
    action: 'rewrite';
    text: string;
};
export type RuleAction = {
    action: 'disable';
} | {
    action: 'enable';
} | {
    action: 'set_severity';
    severity: Severity;
} | {
    action: 'set_suggestion';
    suggestion: string;
} | {
    action: 'reset';
};
export type CandidateAction = 'accept_draft' | 'dismiss';
export declare const DIMENSION_LABEL: Record<Dimension, string>;
export declare const TIER_LABEL: Record<Tier, string>;
export declare const SEVERITY_LABEL: Record<Severity, string>;
export declare const RULE_STATUS_LABEL: Record<RuleStatus, string>;
export declare const ISSUE_STATUS_LABEL: Record<IssueStatus, string>;
export declare const ORIGIN_LABEL: Record<IssueOrigin, string>;
export declare const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string>;
export declare const CANDIDATE_STATUS_LABEL: Record<RuleCandidateRecord['status'], string>;
export declare const REVIEW_STATE_LABEL: Record<ReviewState, string>;
export declare const VERDICTS: readonly Verdict[];
export declare const GATE_REASON_LABEL: Record<string, string>;
/** Severity in plain words for the rules legend; minorThreshold comes from GET /rules. */
export declare function severityLegend(minorThreshold: number): {
    severity: Severity;
    text: string;
}[];
export declare const TIER_HINT: Record<Tier, string>;
export declare function filterRules(rules: RuleView[], filter: RuleFilter): RuleView[];
/** Same defaults as memory_recall.warn (rejectWarnRatio 0.6, rejectWarnMinSamples 5); the browser does not read Host config. */
export declare function markFrequentlyRejected(stats: RuleStats, cfg?: {
    minShown?: number;
    ratio?: number;
}): boolean;
export declare function slidingAdoptRate(series: SlidingAdoptPoint[]): {
    rate: number | null;
    sample: number;
    insufficient: boolean;
};
export declare function memoryByRule(memory: DashboardMemory | null): Map<string, DashboardMemoryRule>;
export declare function countDistinct(texts: string[]): {
    text: string;
    times: number;
}[];
/** Same wording adopted again and again is one exemplar, not many. */
export declare function dedupeExemplars<T extends {
    kind: string;
    text: string;
}>(exemplars: T[]): (T & {
    times: number;
})[];
export declare function openCandidates(memory: DashboardMemory | null): DashboardMemory['candidates'];
export declare function validateSuggestion(text: string): string | null;
/** Reset only makes sense for a shipped rule that currently carries a learned-layer override. */
export declare function canReset(detail: RuleDetailPayload): boolean;
export declare function candidateActions(candidate: Pick<RuleCandidateRecord, 'status' | 'draftRuleId'>): CandidateAction[];
export declare function toggleCompare(selected: string[], runId: string): {
    selected: string[];
    notice?: string;
};
export declare function compareNotice(selected: string[]): string | null;
export declare function evalMetricRows(runs: DashboardEvalRun[]): {
    metric: string;
    values: (number | null)[];
}[];
export declare function formatRate(rate: number | null): string;
export declare function dayKeyOf(date: Date): string;
/** The browser-local calendar day of an ISO timestamp (the host only stores UTC instants). */
export declare function localDayKey(iso: string): string;
export declare function formatDay(key: string): string;
export declare function formatShortDay(key: string): string;
export declare function formatDateTime(iso: string): string;
export interface CalendarCell {
    date: string;
    count: number;
    finalized: number;
    level: 0 | 1 | 2 | 3 | 4;
    future: boolean;
}
export interface Calendar {
    /** Columns oldest → newest; each column is Monday … Sunday. */
    weeks: CalendarCell[][];
    max: number;
    total: number;
    months: {
        index: number;
        label: string;
    }[];
}
export declare function heatLevel(count: number, max: number): CalendarCell['level'];
export declare function buildCalendar(items: ReviewStamp[], today: Date, weeks?: number): Calendar;
export interface TrendPoint {
    date: string;
    created: number;
    finalized: number;
}
export declare function trendSeries(items: ReviewStamp[], today: Date, days?: number): TrendPoint[];
export interface OverviewKpis {
    total: number;
    last30: number;
    pending: number;
    stale: number;
    adoptRate: number | null;
    decided: number;
    agreement: number | null;
    agreementSample: number;
}
export declare function overviewKpis(all: ReviewStamp[], today: Date): OverviewKpis;
export type StateFilter = ReviewState | 'pending';
export interface ReviewFilter {
    state?: StateFilter | undefined;
    verdict?: Verdict | undefined;
    query?: string | undefined;
    day?: string | undefined;
}
export declare const STATE_FILTERS: [StateFilter | undefined, string][];
export declare function effectiveVerdict(stamp: Pick<ReviewStamp, 'aiVerdict' | 'finalVerdict'>): Verdict;
export declare function filterStamps(items: ReviewStamp[], filter: ReviewFilter): ReviewStamp[];
export declare function assistantQueue(items: ReviewStamp[]): ReviewStamp[];
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export declare function requestJson<T>(path: string, init?: RequestInit, fetchImpl?: FetchLike): Promise<T>;
