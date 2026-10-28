import type { RulePack } from '../engine/types.js';
export interface RulePackLoadError {
    file: string;
    message: string;
    ruleId: string | null;
    field: string | null;
}
export interface LoadedRulePacks {
    dir: string;
    packs: RulePack[];
    errors: RulePackLoadError[];
}
/** `<package root>/rules`, valid both from `src/host/` (tests) and `lib/host/` (built). */
export declare function shippedRulesDir(): string;
export declare function loadRulePacks(dir?: string): LoadedRulePacks;
