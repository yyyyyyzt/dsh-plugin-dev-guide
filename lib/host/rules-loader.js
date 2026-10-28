// Rule-pack discovery (design.md §12 row 1): a pack that fails validation is reported and skipped, never fatal.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRulePack, RulePackError } from '../engine/rules.js';
/** `<package root>/rules`, valid both from `src/host/` (tests) and `lib/host/` (built). */
export function shippedRulesDir() {
    return fileURLToPath(new URL('../../rules/', import.meta.url));
}
export function loadRulePacks(dir = shippedRulesDir()) {
    const files = readdirSync(dir)
        .filter((f) => f.endsWith('.rules.yaml') || f.endsWith('.rules.yml'))
        .sort();
    const packs = [];
    const errors = [];
    for (const file of files) {
        const path = join(dir, file);
        try {
            packs.push(parseRulePack(readFileSync(path, 'utf8')));
        }
        catch (e) {
            const err = e;
            errors.push({
                file: path,
                message: err.message,
                ruleId: e instanceof RulePackError ? err.ruleId ?? null : null,
                field: e instanceof RulePackError ? err.field ?? null : null,
            });
        }
    }
    return { dir, packs, errors };
}
//# sourceMappingURL=rules-loader.js.map