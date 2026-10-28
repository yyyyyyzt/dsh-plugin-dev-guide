// Shared helpers for verifiers: heading resolution, sentence extraction, family matching, evidence builders.
import { flattenHeadings, headingTitle } from '../parse/markdown.js';
import { normalize, rangeOf, splitSentences } from '../normalize.js';
export function headingAliases(lexicon, heading) {
    if (Array.isArray(heading))
        return heading;
    return lexicon.headings[heading] ?? [heading];
}
export function headingMatches(node, aliases) {
    const title = normalize(headingTitle(node.text));
    return aliases.some((a) => title.includes(normalize(a)));
}
/** Heading nodes (depth ≥ 2) whose title matches any alias of the key. */
export function findSections(doc, lexicon, heading) {
    const aliases = headingAliases(lexicon, heading);
    return flattenHeadings(doc).filter((h) => h.depth >= 2 && headingMatches(h, aliases));
}
export function sectionsFor(doc, lexicon, keys) {
    if (!keys || keys.length === 0)
        return null;
    const out = [];
    for (const k of keys)
        for (const h of findSections(doc, lexicon, k))
            if (!out.includes(h))
                out.push(h);
    return out;
}
export function inRange(offset, range) {
    return offset >= range.start.offset && offset < range.end.offset;
}
export function inScope(offset, scope) {
    if (scope === null)
        return true;
    return scope.some((h) => inRange(offset, h.bodyRange));
}
export function overlaps(a, b) {
    return a.start.offset < b.end.offset && b.start.offset < a.end.offset;
}
function sentenceAt(doc, start, end, sectionPath, cell) {
    let s = start;
    let e = end;
    // mdast cell positions may include the surrounding `|` delimiters
    const edge = cell ? /[\s|]/u : /\s/u;
    while (s < e && edge.test(doc.source[s]))
        s++;
    while (e > s && edge.test(doc.source[e - 1]))
        e--;
    if (e <= s)
        return null;
    const quote = doc.source.slice(s, e);
    return { quote, norm: normalize(quote), sectionPath, range: rangeOf(doc.source, s, e), cell };
}
// Every verifier leaf asks for sentences; split and normalize each document once.
const sentenceCache = new WeakMap();
function allSentences(doc) {
    const cached = sentenceCache.get(doc);
    if (cached)
        return cached;
    const out = [];
    for (const b of doc.blocks) {
        if (b.type === 'paragraph') {
            const raw = doc.source.slice(b.range.start.offset, b.range.end.offset);
            for (const p of splitSentences(raw)) {
                const s = sentenceAt(doc, b.range.start.offset + p.start, b.range.start.offset + p.end, b.sectionPath, false);
                if (s)
                    out.push(s);
            }
        }
        else if (b.type === 'table') {
            b.table.cellRanges.forEach((row, ri) => {
                if (ri === 0)
                    return;
                for (const r of row) {
                    const s = sentenceAt(doc, r.start.offset, r.end.offset, b.table.sectionPath, true);
                    if (s)
                        out.push(s);
                }
            });
        }
    }
    sentenceCache.set(doc, out);
    return out;
}
/** Sentences (paragraph pieces + table cells) inside `scope` (null = whole document), in document order. */
export function sentencesIn(doc, scope) {
    const all = allSentences(doc);
    if (scope === null)
        return all;
    return all.filter((s) => inScope(s.range.start.offset, scope));
}
export function tablesIn(doc, scope) {
    return doc.tables.filter((t) => inScope(t.range.start.offset, scope));
}
export function familyWords(lexicon, key) {
    const words = lexicon.families[key];
    if (!words)
        throw new Error(`unknown lexicon family: ${key}`);
    return words;
}
const ASCII_WORD = /^[A-Za-z0-9_./-]+$/;
/** Index of the first occurrence of `word` in normalized `text`, respecting ASCII word boundaries. */
export function indexOfWord(text, word) {
    const w = normalize(word);
    if (!w)
        return -1;
    if (ASCII_WORD.test(w)) {
        const re = new RegExp(`(?<![A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}(?![A-Za-z0-9])`, 'i');
        const m = re.exec(text);
        return m ? m.index : -1;
    }
    return text.indexOf(w);
}
export function hitsOf(text, words) {
    const hits = [];
    for (const word of words) {
        const idx = indexOfWord(text, word);
        if (idx >= 0)
            hits.push({ word, index: idx });
    }
    return hits;
}
export function familyHits(text, lexicon, family) {
    return hitsOf(text, familyWords(lexicon, family));
}
export function isPlaceholder(text, lexicon) {
    const t = normalize(text).replace(/\s+/g, '');
    if (!t)
        return true;
    return lexicon.placeholders.some((p) => normalize(p).replace(/\s+/g, '') === t);
}
export function absenceEvidence(doc, quote, offset, sectionPath) {
    const at = Math.max(0, Math.min(offset, doc.source.length));
    const e = { quote, kind: 'absence', range: rangeOf(doc.source, at, at) };
    if (sectionPath !== undefined)
        e.sectionPath = sectionPath;
    return e;
}
export function textEvidence(s) {
    return { quote: s.quote, sectionPath: s.sectionPath, range: s.range, kind: s.cell ? 'table-cell' : 'text' };
}
export function headingEvidence(h) {
    return { quote: h.text, sectionPath: h.path, range: h.range, kind: 'heading' };
}
/** Insertion point for absence evidence: end of the first scoped section, else end of document. */
export function absenceOffset(doc, scope) {
    const first = scope?.[0];
    if (first)
        return { offset: first.bodyRange.end.offset, sectionPath: first.path };
    return { offset: doc.source.length };
}
/** Path of the deepest heading (depth ≥ 2) whose body contains `offset`, or ''. */
export function sectionPathAt(doc, offset) {
    let best;
    for (const h of flattenHeadings(doc)) {
        if (h.depth < 2)
            continue;
        if (inRange(offset, h.bodyRange) || inRange(offset, h.range)) {
            if (!best || h.depth > best.depth)
                best = h;
        }
    }
    return best?.path ?? '';
}
//# sourceMappingURL=common.js.map