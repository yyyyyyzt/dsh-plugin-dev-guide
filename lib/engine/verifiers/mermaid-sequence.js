// `mermaid-sequence` verifier (rule-schema.md §3.5).
import { normalize } from '../normalize.js';
import { absenceEvidence, absenceOffset, familyHits, inScope, sectionsFor, sentencesIn } from './common.js';
const DIAGRAM_PLACEHOLDER = /时序图|流程图|链路图/u;
function blockEvidence(b) {
    const firstLine = b.raw.split(/\r?\n/).find((l) => l.trim().length > 0) ?? 'sequenceDiagram';
    return { quote: firstLine.trim(), sectionPath: b.sectionPath, range: b.range, kind: 'mermaid' };
}
function diagramText(b) {
    return normalize([...b.participants, ...b.messages.map((m) => m.text)].join(' '));
}
export function verifyMermaidSequence(doc, params, lexicon) {
    const scope = sectionsFor(doc, lexicon, params.sections);
    const minParticipants = params.minParticipants ?? 2;
    const minMessages = params.minMessages ?? 3;
    const treatImageAsFail = params.treatImageAsFail ?? true;
    let diagrams = doc.mermaid.filter((b) => b.kind === 'sequence' && inScope(b.range.start.offset, scope));
    if (params.participantFamilies?.length) {
        diagrams = diagrams.filter((b) => {
            const text = diagramText(b);
            return params.participantFamilies.some((f) => familyHits(text, lexicon, f).length > 0);
        });
        if (!diagrams.length) {
            return { status: 'not-applicable', evidence: [], note: '无命中参与方族的时序图' };
        }
    }
    if (!diagrams.length) {
        const at = absenceOffset(doc, scope);
        const hasImage = doc.images.some((img) => inScope(img.range.start.offset, scope));
        const placeholderMention = sentencesIn(doc, scope).some((s) => DIAGRAM_PLACEHOLDER.test(s.norm) && lexicon.placeholders.some((p) => s.norm.includes(normalize(p))));
        const note = treatImageAsFail && (hasImage || placeholderMention) ? '时序图不可验证（图片或占位），需提供 Mermaid 时序图' : '缺少 Mermaid 时序图';
        return { status: 'fail', evidence: [absenceEvidence(doc, '缺失：Mermaid 时序图', at.offset, at.sectionPath)], note };
    }
    let firstFailure;
    for (const b of diagrams) {
        const problems = [];
        if (b.participants.length < minParticipants)
            problems.push(`参与方 ${b.participants.length} < ${minParticipants}`);
        if (b.messages.length < minMessages)
            problems.push(`消息 ${b.messages.length} < ${minMessages}`);
        const missing = (params.requiredMessageFamilies ?? []).filter((f) => !b.messages.some((m) => familyHits(normalize(m.text), lexicon, f).length > 0));
        if (missing.length)
            problems.push(`缺少步骤：${missing.join('、')}`);
        if (!problems.length)
            return { status: 'pass', evidence: [blockEvidence(b)] };
        firstFailure ??= { status: 'fail', evidence: [blockEvidence(b)], note: problems.join('；') };
    }
    return firstFailure;
}
//# sourceMappingURL=mermaid-sequence.js.map