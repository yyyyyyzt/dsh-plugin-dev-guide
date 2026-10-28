// Bundled skill: the review SOP shipped as skills/wsgw-solution-review/SKILL.md, registered into the
// host layer of `ctx.skills` so every preset that mounts tool-skill can load it (review-protocol.md §3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill';
export const name = 'wsgw-solution-review/skill';
export const inject = ['skills'];
export const SKILL_NAME = 'wsgw-solution-review';
function skillDir() {
    return fileURLToPath(new URL(`../../skills/${SKILL_NAME}/`, import.meta.url));
}
function splitFrontmatter(raw) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
    if (!m)
        return { meta: {}, body: raw };
    const meta = {};
    for (const line of m[1].split(/\r?\n/u)) {
        const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/u.exec(line);
        if (kv)
            meta[kv[1]] = kv[2].trim();
    }
    return { meta, body: m[2].trim() + '\n' };
}
export function bundledSkill() {
    const dir = skillDir();
    const raw = readFileSync(`${dir}SKILL.md`, 'utf8');
    const { meta, body } = splitFrontmatter(raw);
    const skillName = meta['name'] ?? SKILL_NAME;
    if (skillName !== SKILL_NAME)
        throw new Error(`SKILL.md name "${skillName}" must equal ${SKILL_NAME}`);
    return {
        name: SKILL_NAME,
        description: meta['description'] ?? '网上国网技术方案 AI 预审流程',
        content: body,
        source: 'bundled',
        provider: 'wsgw-solution-review',
        invocation: { modelInvocable: true, userInvocable: true },
        resourceBase: { kind: 'directory', path: dir },
        metadata: { rank: BUNDLED_SKILL_RANK },
    };
}
export function apply(ctx) {
    ctx.skills.register(bundledSkill());
}
//# sourceMappingURL=skills.js.map