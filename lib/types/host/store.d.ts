import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import type { ChecklistEntry, Dimension, Doc, Evidence, Feedback, HybridCandidate, Issue, Lexicon, MemoryRecall, Rule, RuleAudit, RulePack, RuleStats, Severity, Tier, Verdict } from '../engine/types.js';
import { type IssueRecord, type ReviewDomain, type EvalRunRecord, type ReviewRecord, type RuleCandidateRecord, type RuleOverrideRecord } from '../store/domain.js';
import type { ReviewConfig } from './config.js';
import type { RulePackLoadError } from './rules-loader.js';
export interface StoreDeps {
    now?: () => Date;
    randomId?: () => string;
}
/** Writes the rendered opinion and returns the path to report back (display path from ctx.fs). */
export type OpinionSink = (fileName: string, content: string) => Promise<string>;
export interface ParseInput {
    source: string;
    title?: string | undefined;
    sourcePath?: string | undefined;
    reuse?: boolean | undefined;
}
export interface ParseResult {
    reviewId: string;
    title: string;
    outline: {
        path: string;
        text: string;
        depth: number;
    }[];
    stats: Doc['stats'];
    warnings: string[];
    existingReviewId?: string;
}
export interface CheckResult {
    hardIssues: IssueRecord[];
    hybridCandidates: HybridCandidate[];
    softRules: {
        ruleId: string;
        title: string;
        question: string;
    }[];
    checklist: ChecklistEntry[];
    aiVerdict: Verdict;
    basis: string;
}
export interface RecordIssueInput {
    ruleId?: string | undefined;
    severity?: Severity | undefined;
    finding: string;
    suggestion: string;
    evidence: {
        quote: string;
        sectionPath?: string | undefined;
    }[];
}
export interface RecordIssueResult {
    issueId: string;
    status: Issue['status'];
    gate: Issue['gate'];
    resolvedEvidence: Evidence[];
}
export interface StatusResult {
    reviewId: string;
    title: string;
    status: ReviewRecord['status'];
    reviewer?: string;
    aiVerdict: Verdict;
    basis: string;
    summary: string;
    finalVerdict?: Verdict;
    issues: IssueRecord[];
    checklist: ChecklistEntry[];
    counts: {
        blocker: number;
        major: number;
        minor: number;
        pending: number;
        confirmed: number;
        adopted: number;
        rejected: number;
        rewritten: number;
        expert: number;
    };
    checklistCounts: Record<ChecklistEntry['status'], number>;
}
export type DecideAction = 'adopt' | 'reject' | 'rewrite' | 'add' | 'adopt_rest' | 'set_reviewer' | 'set_final_verdict';
export interface DecideInput {
    action?: DecideAction | undefined;
    answer?: string | undefined;
    issueId?: string | undefined;
    text?: string | undefined;
    reason?: string | undefined;
    ruleId?: string | undefined;
    severity?: Severity | undefined;
    finalVerdict?: Verdict | undefined;
    reviewer?: string | undefined;
}
export interface DecideResult {
    ok: true;
    action: DecideAction;
    issue?: IssueRecord;
    affected?: string[];
    /** adopt_rest only: pending issues left for one-by-one confirmation. */
    remainingPending?: string[];
    aiVerdict: Verdict;
    finalVerdict?: Verdict;
    reviewer?: string;
    status: ReviewRecord['status'];
    /** True when an earlier opinion file exists but decisions changed since (status went back to open). */
    needsRefinalize: boolean;
}
export interface FinalizeResult {
    opinionPath: string;
    version: number;
    counts: {
        adopt: number;
        reject: number;
        rewrite: number;
        add: number;
    };
    memory: {
        exemplars: number;
        candidates: number;
    };
}
export interface RuleView {
    ruleId: string;
    title: string;
    dimension: Dimension;
    tier: Tier;
    severity: Severity;
    status: Rule['status'];
    question: string;
    suggestion: string;
    stats: RuleStats;
    overridden: boolean;
}
export interface RuleDetail {
    question: string;
    rationale: string;
    suggestion: string;
    applicability: Rule['applicability'];
    verifier: Rule['verifier'];
    provenance: Rule['provenance'];
    shipped?: {
        severity: Severity;
        status: Rule['status'];
        suggestion: string;
    };
    override?: Partial<Pick<RuleOverrideRecord, 'status' | 'severity' | 'suggestion' | 'params'>>;
    audit: RuleAudit[];
    memory: MemoryRecall;
}
export interface RuleDetailPayload {
    rule: RuleView;
    detail: RuleDetail;
}
export interface RulesListFilter {
    dimension?: Dimension | undefined;
    tier?: Tier | undefined;
    status?: Rule['status'] | undefined;
}
export interface SlidingAdoptPoint {
    reviewId: string;
    at: string;
    adopted: number;
    rejected: number;
    rewritten: number;
    /** adopted / (adopted + rejected + rewritten), or null when nothing was decided. */
    rate: number | null;
}
export interface DashboardMemoryRule {
    ruleId: string;
    title: string;
    dimension: Dimension;
    stats: RuleStats & {
        rejectRatio: number;
    };
    warn: boolean;
    exemplars: MemoryRecall['exemplars'];
    recentRejectReasons: string[];
    /** Up to the last five finalized reviews containing this rule, oldest first. */
    series: SlidingAdoptPoint[];
}
export interface DashboardMemory {
    rules: DashboardMemoryRule[];
    candidates: (RuleCandidateRecord & {
        candidateId: string;
    })[];
    totals: {
        exemplars: number;
        candidates: number;
        feedback: number;
    };
}
export interface DashboardEvalRun extends EvalRunRecord {
    runId: string;
}
export type ProposeAction = 'disable' | 'enable' | 'set_severity' | 'set_suggestion' | 'set_param' | 'reset' | 'draft' | 'accept_draft' | 'dismiss';
export interface ProposeInput {
    action: ProposeAction;
    ruleId?: string | undefined;
    severity?: Severity | undefined;
    suggestion?: string | undefined;
    param?: {
        key: string;
        value: unknown;
    } | undefined;
    candidateId?: string | undefined;
    draft?: string | undefined;
    who?: string | undefined;
    reviewId?: string | undefined;
}
export interface ProposeResult {
    ok: true;
    action: ProposeAction;
    rule?: RuleView;
    candidate?: RuleCandidateRecord & {
        candidateId: string;
    };
    warnings: string[];
}
export interface EffectiveRules {
    rules: Rule[];
    lexicon: Lexicon;
    warnings: string[];
    version: string;
}
export declare const SUGGESTION_MAX = 500;
/**
 * Expert free text → decision (review-protocol.md §5, design.md §8). A decision word only counts when it
 * stands alone or is followed by punctuation, so 「不对外开放…」 stays a rewrite.
 */
export declare function normalizeAnswer(answer: string): {
    action: 'adopt' | 'reject' | 'rewrite';
    text?: string;
    reason?: string;
};
export declare class ReviewStore {
    readonly domain: Domain<ReviewDomain>;
    readonly config: ReviewConfig;
    readonly packs: RulePack[];
    readonly loadErrors: RulePackLoadError[];
    private readonly now;
    private readonly randomId;
    private readonly docCache;
    constructor(domain: Domain<ReviewDomain>, config: ReviewConfig, packs: RulePack[], deps?: StoreDeps, loadErrors?: RulePackLoadError[]);
    effectiveRules(): EffectiveRules;
    lexicon(): Lexicon;
    rulesList(filter: RulesListFilter): {
        rules: RuleView[];
        warnings: string[];
        loadErrors: RulePackLoadError[];
    };
    private ruleView;
    ruleDetail(ruleId: string): RuleDetailPayload;
    private shippedRule;
    private findRule;
    private requireRule;
    rulesPropose(input: ProposeInput): Promise<ProposeResult>;
    private requireCandidate;
    memoryRecall(ruleId: string): MemoryRecall & {
        ruleId: string;
        title: string;
    };
    memoryRecallByDimension(dimension: Dimension): {
        dimension: Dimension;
        rules: (MemoryRecall & {
            ruleId: string;
            title: string;
        })[];
    };
    /** Read model for the dashboard memory page: per-rule recall + last-five adopt series + candidates. */
    dashboardMemory(): DashboardMemory;
    listReviews(): ReviewRecord[];
    /** Read model for the dashboard evaluation page; the service filters the optional id set. */
    dashboardEvalRuns(): DashboardEvalRun[];
    requireReview(reviewId: string): ReviewRecord;
    issuesOf(reviewId: string): IssueRecord[];
    feedbackOf(reviewId: string): Feedback[];
    private docOf;
    private verdictOf;
    private updateReview;
    private touch;
    private nextSeq;
    private static warningsOf;
    parse(input: ParseInput): Promise<ParseResult>;
    check(reviewId: string): Promise<CheckResult>;
    recordIssue(reviewId: string, input: RecordIssueInput): Promise<RecordIssueResult>;
    status(reviewId: string): StatusResult;
    private writeFeedback;
    private requireIssue;
    private setIssueStatus;
    decide(reviewId: string, input: DecideInput): Promise<DecideResult>;
    decisionCounts(reviewId: string): FinalizeResult['counts'];
    finalize(reviewId: string, sink: OpinionSink): Promise<FinalizeResult>;
    /** Recompute memory tables from every finalized review, so repeated finalize runs are idempotent. */
    private refreshMemory;
}
