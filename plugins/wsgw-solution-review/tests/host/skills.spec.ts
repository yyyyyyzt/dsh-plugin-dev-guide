// Bundled skill (T-PRO-01): SKILL.md discoverable through ctx.skills, name + description from frontmatter.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as skillsPlugin from '../../src/host/skills.js'
import { SKILL_NAME, bundledSkill } from '../../src/host/skills.js'
import { rulesDir } from '../helpers.js'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

describe('bundled skill', () => {
  it('reads skills/wsgw-solution-review/SKILL.md: frontmatter name/description, body < 8192 chars', () => {
    const skill = bundledSkill()
    expect(skill.name).toBe(SKILL_NAME)
    expect(skill.name).toBe('wsgw-solution-review')
    expect(skill.description).toContain('预审')
    expect(skill.content.length).toBeLessThan(8192)
    expect(skill.content).toContain('## 阶段一')
    expect(skill.content).toContain('review_finalize')
    expect(skill.content).not.toMatch(/^---/)
    const raw = readFileSync(join(rulesDir, '..', 'skills', 'wsgw-solution-review', 'SKILL.md'), 'utf8')
    expect(raw.startsWith('---\n')).toBe(true)
  })

  it('body equals review-protocol.md §3 and speaks plain Chinese levels (T-PRO-01)', () => {
    const doc = readFileSync(join(rulesDir, '..', 'docs', 'review-protocol.md'), 'utf8')
    const section = /## 3\. skill SOP[\s\S]*?```\n([\s\S]*?)```/u.exec(doc)?.[1]
    expect(section).toBeDefined()
    expect(bundledSkill().content.trim()).toBe(section!.trim())
    expect(bundledSkill().content).toContain('要改，按这个建议（推荐）')
    expect(bundledSkill().content).not.toMatch(/blocker|major|minor →|采纳（推荐）」「驳回」「改写/)
  })

  it('is discoverable through ctx.skills once the host plugin registers it', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(skillsPlugin)
    const found = await ctx.skills.get(SKILL_NAME)
    expect(found?.source).toBe('bundled')
    expect(found?.invocation).toEqual({ modelInvocable: true, userInvocable: true })
    expect(found?.resourceBase).toMatchObject({ kind: 'directory' })
    const listed = await ctx.skills.list()
    expect(listed.map((s) => s.name)).toContain(SKILL_NAME)
  })
})
