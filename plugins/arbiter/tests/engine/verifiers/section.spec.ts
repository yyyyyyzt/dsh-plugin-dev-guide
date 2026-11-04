// T-RUL-02: section verifier — missing heading → absence; placeholder body → fail; body ≥ minChars → pass.
import { describe, expect, it } from 'vitest'
import { verifySection } from '../../../src/engine/verifiers/section.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

const body = '静态资源 H5 卡片部署，初步评估无需扩容资源，现有集群余量充足。'

describe('verifySection (T-RUL-02)', () => {
  it('passes when the heading exists and the normalized body meets minChars, with heading evidence', () => {
    const doc = sectionsDoc({ 工作背景: '背景略述。', 资源评估: body })
    const r = verifySection(doc, { heading: 'resources' }, miniLexicon)
    expect(r.status).toBe('pass')
    expect(r.evidence[0]?.kind).toBe('heading')
    expect(r.evidence[0]?.sectionPath).toBe('二')
    expect(r.evidence[0]?.quote).toContain('资源评估')
  })

  it('fails with an absence evidence naming the expected heading when the heading is missing', () => {
    const doc = sectionsDoc({ 工作背景: '背景略述。' })
    const r = verifySection(doc, { heading: 'resources' }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence).toHaveLength(1)
    expect(r.evidence[0]!.kind).toBe('absence')
    expect(r.evidence[0]!.quote).toContain('资源评估')
    const range = r.evidence[0]!.range!
    expect(range.start.offset).toBe(range.end.offset)
  })

  it('fails when the body is only a placeholder, quoting the placeholder', () => {
    const doc = sectionsDoc({ 资源评估: '略' })
    const r = verifySection(doc, { heading: 'resources' }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('text')
    expect(r.evidence[0]!.quote).toBe('略')
    expect(r.evidence[0]!.sectionPath).toBe('一')
  })

  it('accepts a placeholder body when allowPlaceholder is true', () => {
    const doc = sectionsDoc({ 资源评估: '/' })
    const r = verifySection(doc, { heading: 'resources', allowPlaceholder: true }, miniLexicon)
    expect(r.status).toBe('pass')
  })

  it('fails when the body is shorter than minChars and does not count sub-heading text or table syntax', () => {
    const doc = sectionsDoc({ 资源评估: '### 2.5.1 子节\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n短。' })
    const r = verifySection(doc, { heading: 'resources', minChars: 20 }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.note).toMatch(/minChars|字/)
  })

  it('matches any alias when heading is an array of literal titles', () => {
    const doc = sectionsDoc({ 资源需求: body })
    const r = verifySection(doc, { heading: ['资源评估', '资源需求'] }, miniLexicon)
    expect(r.status).toBe('pass')
  })

  it('matches headings whose text carries template numbering such as 「### 2.5 资源评估」', () => {
    const doc = sectionsDoc({ 技术方案: `### 2.5 资源评估\n\n${body}` })
    const r = verifySection(doc, { heading: 'resources' }, miniLexicon)
    expect(r.status).toBe('pass')
    expect(r.evidence[0]?.sectionPath).toBe('一/2.5')
  })
})
