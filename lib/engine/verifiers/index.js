import { verifyCrossRef } from './cross-ref.js';
import { verifyMermaidSequence } from './mermaid-sequence.js';
import { verifyQuantity } from './quantity.js';
import { verifySection } from './section.js';
import { verifyStatement } from './statement.js';
import { verifyTable } from './table.js';
export { verifySection } from './section.js';
export { verifyTable } from './table.js';
export { verifyStatement } from './statement.js';
export { verifyQuantity } from './quantity.js';
export { verifyMermaidSequence } from './mermaid-sequence.js';
export { verifyCrossRef } from './cross-ref.js';
function withNote(r, notes) {
    const note = notes.filter((n) => !!n).join('；');
    return note ? { ...r, note } : r;
}
function all(results) {
    const live = results.filter((r) => r.status !== 'not-applicable');
    if (!live.length)
        return { status: 'not-applicable', evidence: [] };
    const fails = live.filter((r) => r.status === 'fail');
    if (fails.length)
        return withNote({ status: 'fail', evidence: fails.flatMap((r) => r.evidence) }, fails.map((r) => r.note));
    if (live.every((r) => r.status === 'pass'))
        return { status: 'pass', evidence: live.flatMap((r) => r.evidence) };
    const cands = live.filter((r) => r.status === 'candidate');
    if (cands.length) {
        const candidates = cands.flatMap((r) => r.candidates ?? []);
        return withNote({ status: 'candidate', evidence: [], candidates }, cands.map((r) => r.note));
    }
    const pendings = live.filter((r) => r.status === 'pending');
    return withNote({ status: 'pending', evidence: [] }, pendings.map((r) => r.note));
}
export function verify(doc, spec, lexicon) {
    switch (spec.kind) {
        case 'section':
            return verifySection(doc, spec.params, lexicon);
        case 'table':
            return verifyTable(doc, spec.params, lexicon);
        case 'statement':
            return verifyStatement(doc, spec.params, lexicon);
        case 'quantity':
            return verifyQuantity(doc, spec.params, lexicon);
        case 'mermaid-sequence':
            return verifyMermaidSequence(doc, spec.params, lexicon);
        case 'cross-ref':
            return verifyCrossRef(doc, spec.params, lexicon);
        case 'all':
            return all(spec.of.map((s) => verify(doc, s, lexicon)));
        case 'first': {
            for (const s of spec.of) {
                const r = verify(doc, s, lexicon);
                if (r.status !== 'not-applicable')
                    return r;
            }
            return { status: 'not-applicable', evidence: [] };
        }
    }
}
//# sourceMappingURL=index.js.map