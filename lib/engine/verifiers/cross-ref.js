// `cross-ref` verifier (rule-schema.md §3.6): every 「附件 N」 reference in the body must appear in the attachments list.
import { normalize, rangeOf } from '../normalize.js';
import { absenceEvidence, findSections, headingEvidence, inScope, sentencesIn } from './common.js';
export const DEFAULT_REF_PATTERN = '附件\\s*([0-9０-９一二三四五六七八九十]+)';
export const DEFAULT_LIST_ITEM_PATTERN = '附件\\s*([0-9０-９一二三四五六七八九十]+)\\s*[:：]';
const CJK_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function numeralValue(raw) {
    const s = normalize(raw);
    if (/^\d+$/.test(s))
        return String(Number(s));
    if (s === '十')
        return '10';
    if (/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(s)) {
        const [tens, ones] = s.split('十');
        return String((tens ? CJK_DIGITS[tens] : 1) * 10 + (ones ? CJK_DIGITS[ones] : 0));
    }
    if (/^[一二三四五六七八九]+$/.test(s))
        return Array.from(s).map((c) => CJK_DIGITS[c]).join('');
    return s;
}
export function verifyCrossRef(doc, params, lexicon) {
    const refRe = new RegExp(params.refPattern ?? DEFAULT_REF_PATTERN, 'gu');
    const itemRe = new RegExp(params.listItemPattern ?? DEFAULT_LIST_ITEM_PATTERN, 'gu');
    const listKey = params.listSection ?? 'attachments';
    const requireList = params.requireListNonEmpty ?? true;
    const listNodes = findSections(doc, lexicon, listKey);
    const listed = new Set();
    for (const n of listNodes) {
        const body = doc.source.slice(n.bodyRange.start.offset, n.bodyRange.end.offset);
        for (const m of body.matchAll(itemRe))
            listed.add(numeralValue(m[1] ?? m[0]));
    }
    if (!listNodes.length && requireList) {
        const label = lexicon.headings[listKey]?.[0] ?? listKey;
        return {
            status: 'fail',
            evidence: [absenceEvidence(doc, `缺失：${label}清单`, doc.source.length)],
            note: `未找到「${label}」章节`,
        };
    }
    const dangling = [];
    const resolved = [];
    for (const s of sentencesIn(doc, null)) {
        if (listNodes.length && inScope(s.range.start.offset, listNodes))
            continue;
        for (const m of s.quote.matchAll(refRe)) {
            const start = s.range.start.offset + (m.index ?? 0);
            const e = { quote: m[0], sectionPath: s.sectionPath, range: rangeOf(doc.source, start, start + m[0].length), kind: 'text' };
            if (listed.has(numeralValue(m[1] ?? m[0])))
                resolved.push(e);
            else
                dangling.push(e);
        }
    }
    if (dangling.length) {
        return { status: 'fail', evidence: dangling, note: `${dangling.length} 处引用在清单中不存在：${dangling.map((d) => d.quote).join('、')}` };
    }
    if (resolved.length)
        return { status: 'pass', evidence: resolved };
    const head = listNodes[0];
    return { status: 'pass', evidence: head ? [headingEvidence(head)] : [], note: '正文无附件引用' };
}
//# sourceMappingURL=cross-ref.js.map