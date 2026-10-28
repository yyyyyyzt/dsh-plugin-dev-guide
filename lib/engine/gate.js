// Evidence gate for LLM-submitted issues (rule-schema.md §5).
import { findAllQuotes, normalize } from './normalize.js';
import { overlaps, sectionPathAt } from './verifiers/common.js';
export const QUOTE_MIN_CHARS = 8;
export const QUOTE_MAX_CHARS = 300;
const ABSENCE_QUOTE = /^(未提及|未见|未发现|缺失|未找到|没有提及|未说明|未明确|未提供)/;
export class HardRuleVerifierOwnedError extends Error {
    code = 'HARD_RULE_VERIFIER_OWNED';
    constructor(ruleId) {
        super(`rule ${ruleId} is hard: issues are registered by its verifier only`);
        this.name = 'HardRuleVerifierOwnedError';
    }
}
export function gate(doc, rule, evidence, candidates) {
    const reasons = [];
    const add = (r) => {
        if (!reasons.includes(r))
            reasons.push(r);
    };
    if (!rule)
        add('NO_RULE');
    else if (rule.tier === 'soft')
        add('SOFT_RULE');
    else if (rule.tier === 'hard')
        throw new HardRuleVerifierOwnedError(rule.id);
    if (!evidence.length)
        add('NO_EVIDENCE');
    const resolved = [];
    for (const e of evidence) {
        const compact = normalize(e.quote).replace(/\s+/g, '');
        if (ABSENCE_QUOTE.test(compact)) {
            add('ABSENCE_NOT_ALLOWED');
            continue;
        }
        if (compact.length < QUOTE_MIN_CHARS) {
            add('QUOTE_TOO_SHORT');
            continue;
        }
        if (compact.length > QUOTE_MAX_CHARS) {
            add('QUOTE_TOO_LONG');
            continue;
        }
        const hits = findAllQuotes(doc.source, e.quote);
        if (!hits.length) {
            add('QUOTE_NOT_FOUND');
            continue;
        }
        // A quote may repeat inside one section: prefer the hit that sits in a candidate, then the declared section.
        const inCandidate = (h) => (candidates ?? []).some((c) => overlaps(c.range, h));
        const inSection = (h) => e.sectionPath !== undefined && sectionPathAt(doc, h.start.offset) === e.sectionPath;
        const range = hits.find((h) => inCandidate(h) && inSection(h)) ?? hits.find(inCandidate) ?? hits.find(inSection) ?? hits[0];
        const actual = {
            quote: doc.source.slice(range.start.offset, range.end.offset),
            sectionPath: sectionPathAt(doc, range.start.offset),
            range,
            kind: 'text',
        };
        if (rule?.tier === 'hybrid') {
            const inside = (candidates ?? []).some((c) => overlaps(c.range, range));
            if (!inside)
                add('OUT_OF_CANDIDATES');
        }
        resolved.push(actual);
    }
    return { passed: reasons.length === 0, reasons, resolved };
}
//# sourceMappingURL=gate.js.map