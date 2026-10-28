import type { CheckReport, Doc, Lexicon, Rule } from './types.js';
export declare function isApplicable(doc: Doc, rule: Rule, lexicon: Lexicon): boolean;
export declare function check(doc: Doc, rules: Rule[], lexicon: Lexicon): CheckReport;
