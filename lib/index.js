import { Config, resolveConfig } from './host/config.js';
import * as apiPlugin from './host/api.js';
import * as commandsPlugin from './host/commands.js';
import { loadRulePacks, shippedRulesDir } from './host/rules-loader.js';
import * as skillsPlugin from './host/skills.js';
import { ReviewStore } from './host/store.js';
import { reviewDomain } from './store/domain.js';
export const name = 'wsgw-solution-review';
export const inject = ['storageDomain', 'commands', 'skills'];
export const provide = ['solutionReview'];
export { Config };
export { ReviewStore } from './host/store.js';
export { ReviewToolError } from './host/errors.js';
export { reviewDomain, DOMAIN_NAME, DOMAIN_VERSION } from './store/domain.js';
export async function apply(ctx, rawConfig = {}) {
    const config = resolveConfig(rawConfig);
    const rulesDir = config.rulesDir ?? shippedRulesDir();
    const loaded = loadRulePacks(rulesDir);
    for (const e of loaded.errors)
        ctx.logger.error(`rule pack ${e.file} rejected (${e.field ?? 'pack'}): ${e.message}`);
    if (loaded.packs.length === 0)
        ctx.logger.warn(`no valid rule pack found in ${rulesDir}; reviews will have no rules`);
    const domain = await ctx.storageDomain.open(reviewDomain);
    ctx.effect(() => () => domain.close(), 'wsgw-solution-review.domainClose');
    const store = new ReviewStore(domain, config, loaded.packs, {}, loaded.errors);
    const collapsed = await store.supersedeStale();
    if (collapsed.length > 0)
        ctx.logger.info(`wsgw-solution-review: ${collapsed.length} duplicate open review(s) superseded: ${collapsed.join(', ')}`);
    ctx.provide('solutionReview', store);
    ctx.logger.info(`wsgw-solution-review ready: ${loaded.packs.reduce((n, p) => n + p.rules.length, 0)} rules from ${loaded.packs.length} pack(s), ` +
        `${domain.table('reviews').size} review(s) on disk`);
    ctx.plugin(commandsPlugin);
    ctx.plugin(skillsPlugin);
    // Optional web plane: headless and unit tests still load the host without webServer/connection.
    ctx.inject(['webServer', 'connection'], (apiCtx) => {
        apiCtx.plugin(apiPlugin);
    });
}
//# sourceMappingURL=index.js.map