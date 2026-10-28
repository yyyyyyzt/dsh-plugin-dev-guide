const isSpace = (ch) => /\s/u.test(ch);
const isAsciiWord = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);
function build(source, opts = {}) {
    const keepSpaces = opts.keepSpaces ?? true;
    const chars = Array.from(source);
    const out = [];
    const map = [];
    let srcOffset = 0;
    let pendingSpaceAt = null;
    const emit = (ch, at) => {
        if (pendingSpaceAt !== null) {
            if (keepSpaces && out.length > 0) {
                out.push(' ');
                map.push(pendingSpaceAt);
            }
            pendingSpaceAt = null;
        }
        out.push(ch);
        map.push(at);
    };
    for (let i = 0; i < chars.length; i++) {
        const raw = chars[i];
        const at = srcOffset;
        srcOffset += raw.length;
        if (raw === '*' || raw === '`')
            continue;
        if (raw === '_' && !(isAsciiWord(chars[i - 1]) && isAsciiWord(chars[i + 1])))
            continue;
        const folded = raw.normalize('NFKC');
        for (const ch of Array.from(folded)) {
            if (isSpace(ch)) {
                if (pendingSpaceAt === null)
                    pendingSpaceAt = at;
                continue;
            }
            emit(ch, at);
        }
    }
    return { text: out.join(''), map };
}
export function normalizeWithMap(source, opts) {
    const { text, map } = build(source, opts);
    return {
        text,
        toSourceOffset(i) {
            if (i <= 0)
                return map[0] ?? 0;
            if (i >= map.length)
                return source.length;
            return map[i];
        },
    };
}
export function normalize(text) {
    return build(text).text;
}
// Line-start table per source so offset → line/column is a binary search instead of a rescan
// (a 200 KB document yields thousands of sentences; rescanning per sentence is quadratic).
let lineIndexSource;
let lineIndex = [];
function lineStarts(source) {
    if (source === lineIndexSource)
        return lineIndex;
    const starts = [0];
    for (let i = 0; i < source.length; i++)
        if (source.charCodeAt(i) === 10)
            starts.push(i + 1);
    lineIndexSource = source;
    lineIndex = starts;
    return starts;
}
export function offsetAt(source, offset) {
    const clamped = Math.max(0, Math.min(offset, source.length));
    const starts = lineStarts(source);
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= clamped)
            lo = mid;
        else
            hi = mid - 1;
    }
    return { line: lo + 1, column: clamped - starts[lo] + 1, offset };
}
export function rangeOf(source, start, end) {
    return { start: offsetAt(source, start), end: offsetAt(source, end) };
}
/** Source offset just after the normalized index `i - 1` (i.e. end of the source char that produced it). */
function sourceEndOf(source, n, i) {
    const startOfLast = n.toSourceOffset(i - 1);
    const cp = source.codePointAt(startOfLast);
    return startOfLast + (cp !== undefined && cp > 0xffff ? 2 : 1);
}
/**
 * Find `quote` in `source` ignoring whitespace, emphasis markers and full-width variants.
 * Returns the source range of the first hit (optionally restricted to `within`), or null.
 */
export function findQuote(source, quote, within) {
    const hits = findAllQuotes(source, quote);
    for (const r of hits) {
        if (!within)
            return r;
        if (r.start.offset >= within.start.offset && r.end.offset <= within.end.offset)
            return r;
    }
    return null;
}
export function findAllQuotes(source, quote) {
    const q = build(quote, { keepSpaces: false }).text;
    if (!q)
        return [];
    const n = normalizeWithMap(source, { keepSpaces: false });
    const ranges = [];
    let from = 0;
    for (;;) {
        const idx = n.text.indexOf(q, from);
        if (idx < 0)
            break;
        const start = n.toSourceOffset(idx);
        const end = sourceEndOf(source, n, idx + q.length);
        ranges.push(rangeOf(source, start, end));
        from = idx + 1;
    }
    return ranges;
}
const SENTENCE_BREAK = /[。；;！？!?\n]/u;
/** Split on sentence terminators / line breaks, trimming whitespace and keeping offsets into `text`. */
export function splitSentences(text) {
    const pieces = [];
    let start = 0;
    const push = (s, e) => {
        while (s < e && isSpace(text[s]))
            s++;
        while (e > s && isSpace(text[e - 1]))
            e--;
        if (e > s)
            pieces.push({ text: text.slice(s, e), start: s, end: e });
    };
    for (let i = 0; i < text.length; i++) {
        if (SENTENCE_BREAK.test(text[i])) {
            push(start, i);
            start = i + 1;
        }
    }
    push(start, text.length);
    return pieces;
}
//# sourceMappingURL=normalize.js.map