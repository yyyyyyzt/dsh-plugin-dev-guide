import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkdown } from '../src/engine/parse/markdown.js'
import { parseRulePack } from '../src/engine/rules.js'
import type { Doc, Lexicon, Rule, RulePack } from '../src/engine/types.js'

const here = dirname(fileURLToPath(import.meta.url))
export const fixturesDir = join(here, 'fixtures')
export const rulesDir = join(here, '..', 'rules')
export const packageRoot = join(here, '..')

export function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8')
}

export function readExpected<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, 'expected', name), 'utf8')) as T
}

export function loadDoc(name: string): Doc {
  return parseMarkdown(readFixture(name))
}

export function docFrom(markdown: string): Doc {
  return parseMarkdown(markdown)
}

/**
 * Build a minimal template-shaped solution: `# 标题` + one `## N、<heading>` per entry.
 * Bodies are inserted verbatim so tests can embed tables / mermaid / placeholders.
 */
export function sectionsDoc(sections: Record<string, string>, title = '测试方案'): Doc {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const parts = [`# ${title}`, '']
  Object.entries(sections).forEach(([heading, body], i) => {
    parts.push(`## ${numerals[i] ?? i + 1}、${heading}`, '', body, '')
  })
  return docFrom(parts.join('\n'))
}

let packCache: RulePack | undefined
export function shippedPack(): RulePack {
  packCache ??= parseRulePack(readFileSync(join(rulesDir, 'capability-open-access.rules.yaml'), 'utf8'))
  return packCache
}

export function shippedLexicon(): Lexicon {
  return shippedPack().lexicon
}

export function rule(id: string): Rule {
  const r = shippedPack().rules.find((x) => x.id === id)
  if (!r) throw new Error(`rule ${id} not in shipped pack`)
  return r
}

export function readRuleFixture(name: string): string {
  return readFileSync(join(fixturesDir, 'rules', name), 'utf8')
}

/** Minimal lexicon for verifier unit tests that should not depend on the shipped pack. */
export const miniLexicon: Lexicon = {
  headings: {
    background: ['工作背景'],
    approach: ['技术思路'],
    access: ['接入方式'],
    interface: ['接口设计'],
    'data-plan': ['数据规划'],
    implementation: ['实施方案'],
    resources: ['资源评估'],
    risk: ['风险评估'],
    attachments: ['附件'],
  },
  placeholders: ['/', '无', '略', '-', 'N/A'],
  negations: ['不', '未', '无需', '暂不', '没有'],
  families: {
    loadtest: ['压测', '压力测试'],
    ratelimit: ['限流', '并发控制'],
    volume: ['新增用户', '请求量', '并发'],
    authcode: ['授权码', 'auth_code'],
    openid: ['openId'],
    phone: ['手机号'],
    'bind-check': ['校验', '绑定关系'],
    login: ['登录'],
    message: ['消息推送', '订阅'],
    scale: ['扩容'],
  },
}

export interface SeedExpectation {
  aiVerdict: string
  autoRegistered: string[]
  hybridCandidates: string[]
  checklist: Record<string, string>
  candidateFlags?: Record<string, string[]>
  evidenceKinds?: Record<string, string>
  evidenceQuotes?: Record<string, string>
}

export interface VariantExpectation {
  aiVerdict?: string
  autoRegistered?: string[]
  checklist: Record<string, string>
  evidenceKinds?: Record<string, string>
  evidenceQuotes?: Record<string, string>
  absenceMentions?: Record<string, string>
  noteMentions?: Record<string, string[]>
  candidateFlagsAbsent?: Record<string, string[]>
}
