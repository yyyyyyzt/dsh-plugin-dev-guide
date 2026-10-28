const COUNTING_STATUS = new Set(['confirmed', 'adopted', 'rewritten']);
const COUNTING_TIER = new Set(['hard', 'hybrid', 'expert']);
export function countsTowardVerdict(issue) {
    return COUNTING_STATUS.has(issue.status) && COUNTING_TIER.has(issue.tier);
}
export function computeVerdict(issues, cfg) {
    const counts = { blocker: 0, major: 0, minor: 0 };
    for (const issue of issues)
        if (countsTowardVerdict(issue))
            counts[issue.severity] += 1;
    if (counts.blocker > 0) {
        return { verdict: '不通过', counts, basis: `存在 ${counts.blocker} 条 blocker 级问题，判定不通过` };
    }
    if (counts.major > 0) {
        return { verdict: '建议整改', counts, basis: `存在 ${counts.major} 条 major 级问题，判定建议整改` };
    }
    if (counts.minor >= cfg.minorThreshold) {
        return {
            verdict: '建议整改',
            counts,
            basis: `minor 级问题 ${counts.minor} 条，达到阈值 ${cfg.minorThreshold}，判定建议整改`,
        };
    }
    const basis = counts.minor > 0
        ? `仅 ${counts.minor} 条 minor 级问题，未达阈值 ${cfg.minorThreshold}，判定通过`
        : '无生效问题（未确认或 soft 级问题不计入），判定通过';
    return { verdict: '通过', counts, basis };
}
//# sourceMappingURL=verdict.js.map