import type { Doc, Evidence, GateReason, Rule, Snippet } from './types.js';
export interface GateInput {
    quote: string;
    sectionPath?: string;
}
export interface GateResult {
    passed: boolean;
    reasons: GateReason[];
    resolved: Evidence[];
}
export declare const QUOTE_MIN_CHARS = 8;
export declare const QUOTE_MAX_CHARS = 300;
export declare class HardRuleVerifierOwnedError extends Error {
    readonly code = "HARD_RULE_VERIFIER_OWNED";
    constructor(ruleId: string);
}
export declare function gate(doc: Doc, rule: Rule | null, evidence: GateInput[], candidates: Snippet[] | undefined): GateResult;
