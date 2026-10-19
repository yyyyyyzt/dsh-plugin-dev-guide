// T-RUL-04: statement verifier — negation window, decisive pass/fail, whenNoCandidate, table cells as sentences,
// requireAll, assertionOnly / causalWords flags.
import { describe, expect, it } from 'vitest'
import { verifyStatement } from '../../../src/engine/verifiers/statement.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

describe('verifyStatement (T-RUL-04)', () => {
  describe('non-decisive (hybrid) mode', () => {
    it('returns candidate snippets with sectionPath and range for every sentence hitting a family', () => {
      const doc = sectionsDoc({
        技术思路: '接口层增加限流配置。另有一句无关内容。',
        风险评估: '并发控制由网关统一承担。',
      })
      const r = verifyStatement(doc, { families: ['ratelimit'] }, miniLexicon)
      expect(r.status).toBe('candidate')
      expect(r.evidence).toEqual([])
      expect(r.candidates?.map((c) => c.quote)).toEqual(['接口层增加限流配置', '并发控制由网关统一承担'])
      expect(r.candidates?.[0]?.sectionPath).toBe('一')
      expect(r.candidates?.[1]?.sectionPath).toBe('二')
      const c = r.candidates![0]!
      expect(doc.source.slice(c.range.start.offset, c.range.end.offset)).toBe('接口层增加限流配置')
    })

    it('never returns pass: candidates existing is not satisfaction', () => {
      const doc = sectionsDoc({ 实施方案: '上线前完成压测。' })
      const r = verifyStatement(doc, { families: ['loadtest'] }, miniLexicon)
      expect(r.status).toBe('candidate')
    })

    it('restricts the search to the given sections', () => {
      const doc = sectionsDoc({ 工作背景: '历史上做过压测。', 实施方案: '分两批上线。' })
      const r = verifyStatement(
        doc,
        { families: ['loadtest'], sections: ['implementation'], whenNoCandidate: 'pending' },
        miniLexicon,
      )
      expect(r.status).toBe('pending')
      expect(r.candidates ?? []).toEqual([])
    })

    it('whenNoCandidate: fail yields an absence evidence naming the family at the end of the first section', () => {
      const doc = sectionsDoc({ 实施方案: '分两批上线。', 资源评估: '无需扩容。' })
      const r = verifyStatement(
        doc,
        { families: ['loadtest'], sections: ['implementation', 'resources'], whenNoCandidate: 'fail' },
        miniLexicon,
      )
      expect(r.status).toBe('fail')
      expect(r.evidence).toHaveLength(1)
      expect(r.evidence[0]!.kind).toBe('absence')
      expect(r.evidence[0]!.quote).toContain('loadtest')
      expect(r.evidence[0]!.sectionPath).toBe('一')
      expect(r.evidence[0]!.range!.start.offset).toBe(r.evidence[0]!.range!.end.offset)
    })

    it('whenNoCandidate: pass yields pass with no evidence requirement', () => {
      const doc = sectionsDoc({ 实施方案: '分两批上线。' })
      const r = verifyStatement(doc, { families: ['loadtest'], whenNoCandidate: 'pass' }, miniLexicon)
      expect(r.status).toBe('pass')
    })

    it('defaults whenNoCandidate to pending', () => {
      const doc = sectionsDoc({ 实施方案: '分两批上线。' })
      expect(verifyStatement(doc, { families: ['loadtest'] }, miniLexicon).status).toBe('pending')
    })

    it('flags negated when a negation word appears within negationWindow chars before the keyword', () => {
      const doc = sectionsDoc({ 实施方案: '本次为静态卡片发布，暂不开展压测。' })
      const r = verifyStatement(doc, { families: ['loadtest'] }, miniLexicon)
      expect(r.status).toBe('candidate')
      expect(r.candidates?.[0]?.flags).toContain('negated')
    })

    it('does not flag negated when the negation is outside the window', () => {
      const doc = sectionsDoc({ 实施方案: '未完成的环境搭建工作，不影响上线前按计划开展全链路压测。' })
      const r = verifyStatement(doc, { families: ['loadtest'], negationWindow: 3 }, miniLexicon)
      expect(r.candidates?.[0]?.flags ?? []).not.toContain('negated')
    })

    it('treats table cells as independent sentences', () => {
      const doc = sectionsDoc({
        实施方案: '| 阶段 | 内容 |\n|---|---|\n| 1 | 联调 |\n| 2 | 全链路压测 |',
      })
      const r = verifyStatement(doc, { families: ['loadtest'] }, miniLexicon)
      expect(r.status).toBe('candidate')
      expect(r.candidates?.[0]?.quote).toBe('全链路压测')
    })

    it('requireAll: every family must hit at least one sentence, otherwise falls to whenNoCandidate', () => {
      const doc = sectionsDoc({ 接入方式: '获取授权码后换取 openId。' })
      const partial = verifyStatement(
        doc,
        { families: ['authcode', 'openid', 'phone'], requireAll: true, whenNoCandidate: 'fail' },
        miniLexicon,
      )
      expect(partial.status).toBe('fail')
      expect(partial.evidence[0]!.kind).toBe('absence')
      expect(partial.evidence[0]!.quote).toContain('phone')

      const full = verifyStatement(
        doc,
        { families: ['authcode', 'openid'], requireAll: true, whenNoCandidate: 'fail' },
        miniLexicon,
      )
      expect(full.status).toBe('candidate')
    })

    it('flags assertion-only when an assertionOnly pattern hits and the sentence has no causal word', () => {
      const doc = sectionsDoc({ 资源评估: '静态资源 H5 卡片部署，初步评估无需扩容资源。' })
      const r = verifyStatement(
        doc,
        { families: ['scale'], assertionOnly: ['无需扩容', '不需要扩容'] },
        miniLexicon,
      )
      expect(r.candidates?.[0]?.flags).toContain('assertion-only')
    })

    it('does not flag assertion-only when a causal word is present (default causalWords)', () => {
      const doc = sectionsDoc({ 资源评估: '依据当前集群余量评估无需扩容资源。' })
      const r = verifyStatement(
        doc,
        { families: ['scale'], assertionOnly: ['无需扩容'] },
        miniLexicon,
      )
      expect(r.candidates?.[0]?.flags ?? []).not.toContain('assertion-only')
    })

    it('honours a per-rule causalWords override', () => {
      const doc = sectionsDoc({ 资源评估: '依据当前集群余量评估无需扩容资源。' })
      const r = verifyStatement(
        doc,
        { families: ['scale'], assertionOnly: ['无需扩容'], causalWords: ['实测'] },
        miniLexicon,
      )
      expect(r.candidates?.[0]?.flags).toContain('assertion-only')
    })
  })

  describe('decisive (hard) mode', () => {
    it('passes when at least one non-negated candidate exists, with that sentence as text evidence', () => {
      const doc = sectionsDoc({ 实施方案: '上线前完成压测并输出报告。' })
      const r = verifyStatement(
        doc,
        { families: ['loadtest'], sections: ['implementation'], decisive: true, whenNoCandidate: 'fail' },
        miniLexicon,
      )
      expect(r.status).toBe('pass')
      expect(r.evidence[0]!.kind).toBe('text')
      expect(r.evidence[0]!.quote).toBe('上线前完成压测并输出报告')
      expect(r.candidates).toBeUndefined()
    })

    it('fails when all candidates are negated, quoting the negated sentence', () => {
      const doc = sectionsDoc({ 实施方案: '本次为静态卡片发布，暂不开展压测。' })
      const r = verifyStatement(
        doc,
        { families: ['loadtest'], decisive: true, whenNoCandidate: 'fail' },
        miniLexicon,
      )
      expect(r.status).toBe('fail')
      expect(r.evidence[0]!.kind).toBe('text')
      expect(r.evidence[0]!.quote).toContain('暂不开展压测')
    })

    it('fails with absence when there is no candidate and whenNoCandidate is fail', () => {
      const doc = sectionsDoc({ 实施方案: '分两批上线。' })
      const r = verifyStatement(doc, { families: ['loadtest'], decisive: true, whenNoCandidate: 'fail' }, miniLexicon)
      expect(r.status).toBe('fail')
      expect(r.evidence[0]!.kind).toBe('absence')
    })

    it('passes with no candidate when whenNoCandidate is pass', () => {
      const doc = sectionsDoc({ 实施方案: '分两批上线。' })
      const r = verifyStatement(doc, { families: ['loadtest'], decisive: true, whenNoCandidate: 'pass' }, miniLexicon)
      expect(r.status).toBe('pass')
    })
  })

  it('throws on an unknown family key instead of silently matching nothing', () => {
    const doc = sectionsDoc({ 实施方案: '任意。' })
    expect(() => verifyStatement(doc, { families: ['nope'] }, miniLexicon)).toThrow(/nope/)
  })
})
