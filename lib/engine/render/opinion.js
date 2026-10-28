const SEVERITY_RANK = { blocker: 0, major: 1, minor: 2 };
const EMPTY_PASS_SENTENCE = '按当前方案技术路线开展。';
const escapeCell = (s) => s.replace(/\|/g, '\\|');
function pointText(issue) {
    const text = issue.status === 'rewritten' && issue.rewriteText?.trim() ? issue.rewriteText : issue.suggestion;
    return text.trim().replace(/[。；;，,.!！\s]+$/u, '');
}
function finishSentence(text) {
    return `${text.replace(/^(建议)+建议/u, '建议')}。`;
}
/** Items that make it into the opinion: expert-confirmed (adopted / rewritten) issues, grouped per rule. */
export function opinionPoints(issues) {
    const kept = issues
        .filter((i) => i.status === 'adopted' || i.status === 'rewritten')
        .sort((a, b) => {
        const expertA = a.tier === 'expert' ? 1 : 0;
        const expertB = b.tier === 'expert' ? 1 : 0;
        if (expertA !== expertB)
            return expertA - expertB;
        if (expertA === 0 && SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity])
            return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return a.seq - b.seq;
    });
    const groups = [];
    for (const issue of kept) {
        const text = pointText(issue);
        if (!text)
            continue;
        const key = issue.ruleId ?? `#${issue.issueId}`;
        const group = issue.ruleId ? groups.find((g) => g.key === key) : undefined;
        if (group) {
            if (!group.parts.includes(text))
                group.parts.push(text);
        }
        else {
            groups.push({ key, parts: [text] });
        }
    }
    return groups.map((g) => finishSentence(g.parts.join('；')));
}
export function renderOpinion(input) {
    const points = opinionPoints(input.issues);
    if (points.length === 0 && input.finalVerdict === '通过')
        points.push(EMPTY_PASS_SENTENCE);
    const lines = [
        '# 技术方案预审意见',
        '',
        `| 方案 | ${escapeCell(input.title)} |`,
        '|---|---|',
        `| 编号 | ${escapeCell(input.reviewId)} |`,
        `| 审核 | ${escapeCell(input.reviewer)} |`,
        `| 日期 | ${input.finalizedAt.slice(0, 10)} |`,
        '',
        `意见：${input.finalVerdict}`,
        '',
    ];
    if (points.length) {
        lines.push(points.map((p, i) => `（${i + 1}）${p}`).join('\n'), '');
    }
    const c = input.counts;
    lines.push('---', `附：AI 预审建议结论「${input.aiVerdictAtFinalize}」；复核采纳 ${c.adopt} 条、驳回 ${c.reject} 条、改写 ${c.rewrite} 条、专家新增 ${c.add} 条。`, '');
    return lines.join('\n');
}
export function opinionFileName(reviewId, version) {
    if (!Number.isInteger(version) || version < 1)
        throw new Error(`opinion version must be a positive integer, got ${version}`);
    return version === 1 ? `${reviewId}.md` : `${reviewId}-v${version}.md`;
}
//# sourceMappingURL=opinion.js.map