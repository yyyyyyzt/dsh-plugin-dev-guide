// Storage domain `wsgw_solution_review` v1 (design.md §7). Record schemas are zod (domain layer contract);
// plugin Config stays schemastery. Bumping DOMAIN_VERSION requires scripts/migrate-domain.mjs.
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import { RuleSchema } from '../engine/rules.js';
export const DOMAIN_NAME = 'wsgw_solution_review';
export const DOMAIN_VERSION = 1;
export const REVIEW_ID_RE = /^rv_\d{8}_[a-z2-7]{6}$/;
export const ISSUE_ID_RE = /^rv_\d{8}_[a-z2-7]{6}#\d+$/;
const BASE32_RE = /^[a-z2-7]{6}$/;
// ---------- key helpers ----------
export function newReviewId(now, randomId) {
    const rand = randomId();
    if (!BASE32_RE.test(rand))
        throw new Error(`review id suffix must be 6 base32 chars [a-z2-7], got ${JSON.stringify(rand)}`);
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `rv_${y}${m}${d}_${rand}`;
}
export const issueKey = (reviewId, seq) => `${reviewId}#${seq}`;
export const feedbackKey = (issueId, n) => `${issueId}#${n}`;
export const exemplarKey = (ruleId, issueId) => `${ruleId}#${issueId}`;
export const candidateKey = (reviewId, n) => `rc_${reviewId}_${n}`;
// ---------- zod records ----------
const Offset = z.object({ line: z.number().int(), column: z.number().int(), offset: z.number().int() });
const Range = z.object({ start: Offset, end: Offset });
const VerdictSchema = z.enum(['通过', '建议整改', '不通过']);
const SeveritySchema = z.enum(['blocker', 'major', 'minor']);
const TierSchema = z.enum(['hard', 'hybrid', 'soft']);
const IssueTierSchema = z.enum(['hard', 'hybrid', 'soft', 'expert']);
const IssueStatusSchema = z.enum(['confirmed', 'pending', 'rejected', 'adopted', 'rewritten']);
const GateReasonSchema = z.enum([
    'NO_RULE', 'SOFT_RULE', 'NO_EVIDENCE', 'QUOTE_TOO_SHORT', 'QUOTE_TOO_LONG', 'QUOTE_NOT_FOUND', 'OUT_OF_CANDIDATES', 'ABSENCE_NOT_ALLOWED',
]);
const DimensionSchema = z.enum(['capacity', 'security', 'interface', 'channel', 'data_sync', 'config', 'monitoring', 'documentation']);
export const EvidenceSchema = z.object({
    quote: z.string(),
    sectionPath: z.string().optional(),
    range: Range.optional(),
    kind: z.enum(['text', 'table-cell', 'mermaid', 'heading', 'absence']),
});
const SnippetSchema = z.object({
    quote: z.string(),
    sectionPath: z.string(),
    range: Range,
    flags: z.array(z.enum(['negated', 'assertion-only', 'placeholder'])).optional(),
});
const ChecklistEntrySchema = z.object({
    ruleId: z.string(),
    title: z.string(),
    tier: TierSchema,
    severity: SeveritySchema,
    status: z.enum(['pass', 'fail', 'candidate', 'pending', 'not-applicable', 'soft', 'reviewed-no-issue']),
    note: z.string().optional(),
});
const HybridCandidateSchema = z.object({
    ruleId: z.string(),
    title: z.string(),
    severity: SeveritySchema,
    question: z.string(),
    snippets: z.array(SnippetSchema),
    note: z.string().optional(),
});
export const LastCheckSchema = z.object({
    at: z.string(),
    checklist: z.array(ChecklistEntrySchema),
    hybridCandidates: z.array(HybridCandidateSchema),
    softRules: z.array(z.object({ ruleId: z.string(), title: z.string(), question: z.string() })),
});
export const ReviewRecordSchema = z.object({
    reviewId: z.string().regex(REVIEW_ID_RE),
    title: z.string(),
    docHash: z.string(),
    contentKey: z.string().optional(),
    source: z.string(),
    sourcePath: z.string().optional(),
    reviewer: z.string().optional(),
    sessionId: z.string().optional(),
    status: z.enum(['open', 'finalized', 'superseded', 'discarded']),
    supersededBy: z.string().optional(),
    closedAt: z.string().optional(),
    closedReason: z.string().optional(),
    aiVerdict: VerdictSchema,
    aiVerdictAtFinalize: VerdictSchema.optional(),
    finalVerdict: VerdictSchema.optional(),
    verdictDelta: z.object({ ai: VerdictSchema, final: VerdictSchema }).optional(),
    opinionPath: z.string().optional(),
    versions: z.array(z.object({ version: z.number().int(), path: z.string(), at: z.string() })),
    metrics: z.object({
        startedAt: z.string(),
        finalizedAt: z.string().optional(),
        toolCalls: z.number().int(),
        gateRejects: z.number().int(),
    }),
    createdAt: z.string(),
    rulePackVersion: z.string(),
    warnings: z.array(z.string()).optional(),
    lastCheck: LastCheckSchema.optional(),
    nextSeq: z.number().int().optional(),
});
export const IssueRecordSchema = z.object({
    issueId: z.string().regex(ISSUE_ID_RE),
    reviewId: z.string(),
    ruleId: z.string().optional(),
    severity: SeveritySchema,
    tier: IssueTierSchema,
    origin: z.enum(['verifier', 'llm', 'expert']),
    finding: z.string(),
    suggestion: z.string(),
    evidence: z.array(EvidenceSchema),
    status: IssueStatusSchema,
    gate: z.object({ passed: z.boolean(), reasons: z.array(GateReasonSchema) }),
    rewriteText: z.string().optional(),
    severityFrom: SeveritySchema.optional(),
    seq: z.number().int(),
});
export const FeedbackRecordSchema = z.object({
    reviewId: z.string(),
    issueId: z.string(),
    ruleId: z.string().optional(),
    action: z.enum(['adopt', 'reject', 'rewrite']),
    reason: z.string().optional(),
    text: z.string().optional(),
    reviewer: z.string().optional(),
    at: z.string(),
});
export const ExemplarRecordSchema = z.object({
    ruleId: z.string(),
    kind: z.enum(['adopt', 'rewrite']),
    text: z.string(),
    reviewId: z.string(),
    at: z.string(),
});
const RuleStatsSchema = z.object({
    shown: z.number().int(),
    adopt: z.number().int(),
    reject: z.number().int(),
    rewrite: z.number().int(),
});
export const RuleOverrideRecordSchema = z.object({
    ruleId: z.string(),
    status: z.enum(['active', 'draft', 'retired']).optional(),
    severity: SeveritySchema.optional(),
    suggestion: z.string().optional(),
    params: z
        .object({
        families: z.object({ add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() }).optional(),
        minChars: z.number().optional(),
        minMessages: z.number().optional(),
        minParticipants: z.number().optional(),
        whenNoCandidate: z.enum(['pass', 'fail', 'pending']).optional(),
        negationWindow: z.number().optional(),
        window: z.number().optional(),
    })
        .optional(),
    draft: RuleSchema.optional(),
    stats: RuleStatsSchema,
    audit: z.array(z.object({
        who: z.string(),
        at: z.string(),
        reviewId: z.string().optional(),
        change: z.object({ field: z.string(), from: z.unknown(), to: z.unknown() }),
    })),
});
export const RuleCandidateRecordSchema = z.object({
    text: z.string(),
    suggestedDimension: DimensionSchema.optional(),
    draftRuleId: z.string().optional(),
    status: z.enum(['new', 'drafted', 'accepted', 'dismissed']),
    reviewId: z.string(),
    issueId: z.string(),
    at: z.string(),
});
export const EvalRunRecordSchema = z.object({
    runId: z.string(),
    config: z.unknown(),
    dataset: z.string(),
    metrics: z.record(z.string(), z.unknown()),
    perRule: z.array(z.unknown()),
    perSolution: z.array(z.unknown()),
    at: z.string(),
});
export const isClosed = (r) => r.status === 'superseded' || r.status === 'discarded';
export const reviewDomain = defineDomain({
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    tables: {
        reviews: domainTable(ReviewRecordSchema),
        issues: domainTable(IssueRecordSchema),
        feedback: domainTable(FeedbackRecordSchema),
        exemplars: domainTable(ExemplarRecordSchema),
        rule_overrides: domainTable(RuleOverrideRecordSchema),
        rule_candidates: domainTable(RuleCandidateRecordSchema),
        eval_runs: domainTable(EvalRunRecordSchema),
    },
});
//# sourceMappingURL=domain.js.map