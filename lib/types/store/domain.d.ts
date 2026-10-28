import { z } from 'zod';
import type { ChecklistEntry, Evidence, Exemplar, Feedback, HybridCandidate, Issue, Rule, RuleOverride, Verdict } from '../engine/types.js';
export declare const DOMAIN_NAME = "wsgw_solution_review";
export declare const DOMAIN_VERSION = 1;
export declare const REVIEW_ID_RE: RegExp;
export declare const ISSUE_ID_RE: RegExp;
export declare function newReviewId(now: Date, randomId: () => string): string;
export declare const issueKey: (reviewId: string, seq: number) => string;
export declare const feedbackKey: (issueId: string, n: number) => string;
export declare const exemplarKey: (ruleId: string, issueId: string) => string;
export declare const candidateKey: (reviewId: string, n: number) => string;
declare const DimensionSchema: z.ZodEnum<{
    capacity: "capacity";
    security: "security";
    interface: "interface";
    channel: "channel";
    data_sync: "data_sync";
    config: "config";
    monitoring: "monitoring";
    documentation: "documentation";
}>;
export declare const EvidenceSchema: z.ZodObject<{
    quote: z.ZodString;
    sectionPath: z.ZodOptional<z.ZodString>;
    range: z.ZodOptional<z.ZodObject<{
        start: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            offset: z.ZodNumber;
        }, z.core.$strip>;
        end: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            offset: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    kind: z.ZodEnum<{
        heading: "heading";
        mermaid: "mermaid";
        text: "text";
        "table-cell": "table-cell";
        absence: "absence";
    }>;
}, z.core.$strip>;
export declare const LastCheckSchema: z.ZodObject<{
    at: z.ZodString;
    checklist: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        title: z.ZodString;
        tier: z.ZodEnum<{
            hard: "hard";
            hybrid: "hybrid";
            soft: "soft";
        }>;
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
        }>;
        status: z.ZodEnum<{
            soft: "soft";
            pending: "pending";
            pass: "pass";
            fail: "fail";
            candidate: "candidate";
            "not-applicable": "not-applicable";
            "reviewed-no-issue": "reviewed-no-issue";
        }>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    hybridCandidates: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        title: z.ZodString;
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
        }>;
        question: z.ZodString;
        snippets: z.ZodArray<z.ZodObject<{
            quote: z.ZodString;
            sectionPath: z.ZodString;
            range: z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    offset: z.ZodNumber;
                }, z.core.$strip>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    offset: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>;
            flags: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                negated: "negated";
                "assertion-only": "assertion-only";
                placeholder: "placeholder";
            }>>>;
        }, z.core.$strip>>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    softRules: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        title: z.ZodString;
        question: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ReviewRecordSchema: z.ZodObject<{
    reviewId: z.ZodString;
    title: z.ZodString;
    docHash: z.ZodString;
    contentKey: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    sourcePath: z.ZodOptional<z.ZodString>;
    reviewer: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        open: "open";
        finalized: "finalized";
        superseded: "superseded";
        discarded: "discarded";
    }>;
    supersededBy: z.ZodOptional<z.ZodString>;
    closedAt: z.ZodOptional<z.ZodString>;
    closedReason: z.ZodOptional<z.ZodString>;
    aiVerdict: z.ZodEnum<{
        通过: "通过";
        建议整改: "建议整改";
        不通过: "不通过";
    }>;
    aiVerdictAtFinalize: z.ZodOptional<z.ZodEnum<{
        通过: "通过";
        建议整改: "建议整改";
        不通过: "不通过";
    }>>;
    finalVerdict: z.ZodOptional<z.ZodEnum<{
        通过: "通过";
        建议整改: "建议整改";
        不通过: "不通过";
    }>>;
    verdictDelta: z.ZodOptional<z.ZodObject<{
        ai: z.ZodEnum<{
            通过: "通过";
            建议整改: "建议整改";
            不通过: "不通过";
        }>;
        final: z.ZodEnum<{
            通过: "通过";
            建议整改: "建议整改";
            不通过: "不通过";
        }>;
    }, z.core.$strip>>;
    opinionPath: z.ZodOptional<z.ZodString>;
    versions: z.ZodArray<z.ZodObject<{
        version: z.ZodNumber;
        path: z.ZodString;
        at: z.ZodString;
    }, z.core.$strip>>;
    metrics: z.ZodObject<{
        startedAt: z.ZodString;
        finalizedAt: z.ZodOptional<z.ZodString>;
        toolCalls: z.ZodNumber;
        gateRejects: z.ZodNumber;
    }, z.core.$strip>;
    createdAt: z.ZodString;
    rulePackVersion: z.ZodString;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
    lastCheck: z.ZodOptional<z.ZodObject<{
        at: z.ZodString;
        checklist: z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            tier: z.ZodEnum<{
                hard: "hard";
                hybrid: "hybrid";
                soft: "soft";
            }>;
            severity: z.ZodEnum<{
                blocker: "blocker";
                major: "major";
                minor: "minor";
            }>;
            status: z.ZodEnum<{
                soft: "soft";
                pending: "pending";
                pass: "pass";
                fail: "fail";
                candidate: "candidate";
                "not-applicable": "not-applicable";
                "reviewed-no-issue": "reviewed-no-issue";
            }>;
            note: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        hybridCandidates: z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            severity: z.ZodEnum<{
                blocker: "blocker";
                major: "major";
                minor: "minor";
            }>;
            question: z.ZodString;
            snippets: z.ZodArray<z.ZodObject<{
                quote: z.ZodString;
                sectionPath: z.ZodString;
                range: z.ZodObject<{
                    start: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        offset: z.ZodNumber;
                    }, z.core.$strip>;
                    end: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        offset: z.ZodNumber;
                    }, z.core.$strip>;
                }, z.core.$strip>;
                flags: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    negated: "negated";
                    "assertion-only": "assertion-only";
                    placeholder: "placeholder";
                }>>>;
            }, z.core.$strip>>;
            note: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        softRules: z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            title: z.ZodString;
            question: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    nextSeq: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const IssueRecordSchema: z.ZodObject<{
    issueId: z.ZodString;
    reviewId: z.ZodString;
    ruleId: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<{
        blocker: "blocker";
        major: "major";
        minor: "minor";
    }>;
    tier: z.ZodEnum<{
        hard: "hard";
        hybrid: "hybrid";
        soft: "soft";
        expert: "expert";
    }>;
    origin: z.ZodEnum<{
        expert: "expert";
        verifier: "verifier";
        llm: "llm";
    }>;
    finding: z.ZodString;
    suggestion: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        quote: z.ZodString;
        sectionPath: z.ZodOptional<z.ZodString>;
        range: z.ZodOptional<z.ZodObject<{
            start: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                offset: z.ZodNumber;
            }, z.core.$strip>;
            end: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                offset: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        kind: z.ZodEnum<{
            heading: "heading";
            mermaid: "mermaid";
            text: "text";
            "table-cell": "table-cell";
            absence: "absence";
        }>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        confirmed: "confirmed";
        pending: "pending";
        rejected: "rejected";
        adopted: "adopted";
        rewritten: "rewritten";
    }>;
    gate: z.ZodObject<{
        passed: z.ZodBoolean;
        reasons: z.ZodArray<z.ZodEnum<{
            NO_RULE: "NO_RULE";
            SOFT_RULE: "SOFT_RULE";
            NO_EVIDENCE: "NO_EVIDENCE";
            QUOTE_TOO_SHORT: "QUOTE_TOO_SHORT";
            QUOTE_TOO_LONG: "QUOTE_TOO_LONG";
            QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND";
            OUT_OF_CANDIDATES: "OUT_OF_CANDIDATES";
            ABSENCE_NOT_ALLOWED: "ABSENCE_NOT_ALLOWED";
        }>>;
    }, z.core.$strip>;
    rewriteText: z.ZodOptional<z.ZodString>;
    severityFrom: z.ZodOptional<z.ZodEnum<{
        blocker: "blocker";
        major: "major";
        minor: "minor";
    }>>;
    seq: z.ZodNumber;
}, z.core.$strip>;
export declare const FeedbackRecordSchema: z.ZodObject<{
    reviewId: z.ZodString;
    issueId: z.ZodString;
    ruleId: z.ZodOptional<z.ZodString>;
    action: z.ZodEnum<{
        adopt: "adopt";
        reject: "reject";
        rewrite: "rewrite";
    }>;
    reason: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    reviewer: z.ZodOptional<z.ZodString>;
    at: z.ZodString;
}, z.core.$strip>;
export declare const ExemplarRecordSchema: z.ZodObject<{
    ruleId: z.ZodString;
    kind: z.ZodEnum<{
        adopt: "adopt";
        rewrite: "rewrite";
    }>;
    text: z.ZodString;
    reviewId: z.ZodString;
    at: z.ZodString;
}, z.core.$strip>;
export declare const RuleOverrideRecordSchema: z.ZodObject<{
    ruleId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        retired: "retired";
    }>>;
    severity: z.ZodOptional<z.ZodEnum<{
        blocker: "blocker";
        major: "major";
        minor: "minor";
    }>>;
    suggestion: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodObject<{
        families: z.ZodOptional<z.ZodObject<{
            add: z.ZodOptional<z.ZodArray<z.ZodString>>;
            remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        minChars: z.ZodOptional<z.ZodNumber>;
        minMessages: z.ZodOptional<z.ZodNumber>;
        minParticipants: z.ZodOptional<z.ZodNumber>;
        whenNoCandidate: z.ZodOptional<z.ZodEnum<{
            pending: "pending";
            pass: "pass";
            fail: "fail";
        }>>;
        negationWindow: z.ZodOptional<z.ZodNumber>;
        window: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    draft: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        dimension: z.ZodEnum<{
            capacity: "capacity";
            security: "security";
            interface: "interface";
            channel: "channel";
            data_sync: "data_sync";
            config: "config";
            monitoring: "monitoring";
            documentation: "documentation";
        }>;
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
        }>;
        tier: z.ZodEnum<{
            hard: "hard";
            hybrid: "hybrid";
            soft: "soft";
        }>;
        question: z.ZodString;
        rationale: z.ZodString;
        suggestion: z.ZodString;
        applicability: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            families: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sections: z.ZodOptional<z.ZodArray<z.ZodString>>;
            tableRows: z.ZodOptional<z.ZodObject<{
                column: z.ZodString;
                equals: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        verifier: z.ZodDefault<z.ZodNullable<z.ZodType<import("../engine/types.js").VerifierSpec, unknown, z.core.$ZodTypeInternals<import("../engine/types.js").VerifierSpec, unknown>>>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            retired: "retired";
        }>;
        provenance: z.ZodObject<{
            source: z.ZodString;
            examples: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    stats: z.ZodObject<{
        shown: z.ZodNumber;
        adopt: z.ZodNumber;
        reject: z.ZodNumber;
        rewrite: z.ZodNumber;
    }, z.core.$strip>;
    audit: z.ZodArray<z.ZodObject<{
        who: z.ZodString;
        at: z.ZodString;
        reviewId: z.ZodOptional<z.ZodString>;
        change: z.ZodObject<{
            field: z.ZodString;
            from: z.ZodUnknown;
            to: z.ZodUnknown;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const RuleCandidateRecordSchema: z.ZodObject<{
    text: z.ZodString;
    suggestedDimension: z.ZodOptional<z.ZodEnum<{
        capacity: "capacity";
        security: "security";
        interface: "interface";
        channel: "channel";
        data_sync: "data_sync";
        config: "config";
        monitoring: "monitoring";
        documentation: "documentation";
    }>>;
    draftRuleId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        new: "new";
        drafted: "drafted";
        accepted: "accepted";
        dismissed: "dismissed";
    }>;
    reviewId: z.ZodString;
    issueId: z.ZodString;
    at: z.ZodString;
}, z.core.$strip>;
export declare const EvalRunRecordSchema: z.ZodObject<{
    runId: z.ZodString;
    config: z.ZodUnknown;
    dataset: z.ZodString;
    metrics: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    perRule: z.ZodArray<z.ZodUnknown>;
    perSolution: z.ZodArray<z.ZodUnknown>;
    at: z.ZodString;
}, z.core.$strip>;
export interface LastCheck {
    at: string;
    checklist: ChecklistEntry[];
    hybridCandidates: HybridCandidate[];
    softRules: {
        ruleId: string;
        title: string;
        question: string;
    }[];
}
export type ReviewStatus = 'open' | 'finalized' | 'superseded' | 'discarded';
export declare const isClosed: (r: Pick<ReviewRecord, "status">) => boolean;
export interface ReviewRecord {
    reviewId: string;
    title: string;
    docHash: string;
    contentKey?: string;
    source: string;
    sourcePath?: string;
    reviewer?: string;
    sessionId?: string;
    status: ReviewStatus;
    supersededBy?: string;
    closedAt?: string;
    closedReason?: string;
    aiVerdict: Verdict;
    aiVerdictAtFinalize?: Verdict;
    finalVerdict?: Verdict;
    verdictDelta?: {
        ai: Verdict;
        final: Verdict;
    };
    opinionPath?: string;
    versions: {
        version: number;
        path: string;
        at: string;
    }[];
    metrics: {
        startedAt: string;
        finalizedAt?: string;
        toolCalls: number;
        gateRejects: number;
    };
    createdAt: string;
    rulePackVersion: string;
    warnings?: string[];
    lastCheck?: LastCheck;
    nextSeq?: number;
}
export type IssueRecord = Issue & {
    evidence: Evidence[];
};
export type FeedbackRecord = Feedback;
export type ExemplarRecord = Exemplar;
export type RuleOverrideRecord = RuleOverride & {
    draft?: Rule;
};
export interface RuleCandidateRecord {
    text: string;
    suggestedDimension?: z.infer<typeof DimensionSchema>;
    draftRuleId?: string;
    status: 'new' | 'drafted' | 'accepted' | 'dismissed';
    reviewId: string;
    issueId: string;
    at: string;
}
export type EvalRunRecord = z.infer<typeof EvalRunRecordSchema>;
export declare const reviewDomain: {
    name: string;
    version: number;
    tables: {
        reviews: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, ReviewRecord>;
        issues: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, IssueRecord>;
        feedback: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, Feedback>;
        exemplars: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, Exemplar>;
        rule_overrides: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, RuleOverrideRecord>;
        rule_candidates: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, RuleCandidateRecord>;
        eval_runs: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, {
            runId: string;
            config: unknown;
            dataset: string;
            metrics: Record<string, unknown>;
            perRule: unknown[];
            perSolution: unknown[];
            at: string;
        }>;
    };
};
export type ReviewDomain = typeof reviewDomain;
export {};
