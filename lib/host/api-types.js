/** `stale` = reopened by a decision after finalize: the opinion file on disk no longer matches. `closed` = superseded or discarded. */
export function reviewState(review) {
    if (review.status === 'superseded' || review.status === 'discarded')
        return 'closed';
    if (review.status === 'finalized')
        return 'finalized';
    return review.versions.length > 0 ? 'stale' : 'open';
}
//# sourceMappingURL=api-types.js.map