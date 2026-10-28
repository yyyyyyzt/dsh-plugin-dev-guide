import { z } from 'zod';
import type { Lexicon, Rule, RuleOverride, RulePack, VerifierSpec } from './types.js';
export declare class RulePackError extends Error {
    readonly ruleId: string | null;
    readonly field: string | null;
    constructor(message: string, ruleId: string | null, field: string | null);
}
export declare const RuleSchema: z.ZodObject<{
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
    verifier: z.ZodDefault<z.ZodNullable<z.ZodType<VerifierSpec, unknown, z.core.$ZodTypeInternals<VerifierSpec, unknown>>>>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        retired: "retired";
    }>;
    provenance: z.ZodObject<{
        source: z.ZodString;
        examples: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare function parseRulePack(yamlText: string): RulePack;
export declare function parseRuleDraft(yamlText: string, lexicon: Lexicon): Rule;
export declare function mergeRules(shipped: Rule[], overrides: RuleOverride[]): {
    rules: Rule[];
    warnings: string[];
};
