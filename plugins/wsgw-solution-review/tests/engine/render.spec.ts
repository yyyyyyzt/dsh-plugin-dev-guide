// T-REQ-14 / T-PRO-08: formal opinion rendering — template, merge same-rule items, rewrite precedence,
// 「通过」 empty-issue sentence, trailing punctuation, de-duplicated 「建议」 prefix, versioned file names.
import { describe, expect, it } from 'vitest'
import { opinionFileName, renderOpinion } from '../../src/engine/render/opinion.js'
import type { Issue, OpinionInput } from '../../src/engine/types.js'

let seq = 0
const issue = (patch: Partial<Issue> & Pick<Issue, 'severity' | 'status'>): Issue => ({
  issueId: `rv_20261019_abc123#${++seq}`,
  reviewId: 'rv_20261019_abc123',
  tier: 'hybrid',
  origin: 'llm',
  finding: '发现',
  suggestion: '建议补充。',
  evidence: [],
  gate: { passed: true, reasons: [] },
  seq,
  ...patch,
})

const base: OpinionInput = {
  reviewId: 'rv_20261019_abc123',
  title: '网上国网余额查询能力对AI版支付宝开放技术方案',
  reviewer: '张三',
  finalizedAt: '2026-10-19T09:30:00+08:00',
  finalVerdict: '建议整改',
  aiVerdictAtFinalize: '不通过',
  issues: [],
  counts: { adopt: 0, reject: 0, rewrite: 0, add: 0 },
}

describe('renderOpinion (T-REQ-14, T-PRO-08)', () => {
  it('renders the header table, verdict line and the footer summary', () => {
    const md = renderOpinion({ ...base, counts: { adopt: 3, reject: 1, rewrite: 1, add: 1 } })
    expect(md.startsWith('# 技术方案预审意见')).toBe(true)
    expect(md).toContain(`| 方案 | ${base.title} |`)
    expect(md).toContain('| 编号 | rv_20261019_abc123 |')
    expect(md).toContain('| 审核 | 张三 |')
    expect(md).toContain('| 日期 | 2026-10-19 |')
    expect(md).toContain('意见：建议整改')
    expect(md).toContain('附：AI 预审建议结论「不通过」；复核采纳 3 条、驳回 1 条、改写 1 条、专家新增 1 条。')
  })

  it('orders items blocker → major → minor → expert-added, same level by seq', () => {
    const md = renderOpinion({
      ...base,
      issues: [
        issue({ severity: 'minor', status: 'adopted', ruleId: 'INT-004', suggestion: '建议统一渠道标识。' }),
        issue({ severity: 'major', status: 'adopted', ruleId: 'CAP-002', suggestion: '建议上线前开展压测。' }),
        issue({ severity: 'major', status: 'adopted', tier: 'expert', origin: 'expert', suggestion: '建议补充解绑后停止推送的说明。' }),
        issue({ severity: 'blocker', status: 'adopted', ruleId: 'CAP-001', suggestion: '建议补充限流策略。' }),
      ],
    })
    const order = ['限流策略', '开展压测', '渠道标识', '解绑后停止推送'].map((s) => md.indexOf(s))
    expect(order.every((v) => v >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(md).toMatch(/（1）建议补充限流策略。\n（2）建议上线前开展压测。\n（3）建议统一渠道标识。\n（4）建议补充解绑后停止推送的说明。/)
  })

  it('uses rewriteText for rewritten issues and suggestion otherwise; skips rejected / pending / confirmed-only', () => {
    const md = renderOpinion({
      ...base,
      issues: [
        issue({ severity: 'major', status: 'rewritten', ruleId: 'CAP-002', suggestion: '原建议。', rewriteText: '请在 10 月底前完成全链路压测' }),
        issue({ severity: 'major', status: 'rejected', ruleId: 'CHN-001', suggestion: '被驳回的建议。' }),
        issue({ severity: 'major', status: 'pending', ruleId: 'SEC-001', suggestion: '待定的建议。' }),
        issue({ severity: 'major', status: 'confirmed', ruleId: 'SEC-004', suggestion: '未复核的建议。' }),
      ],
    })
    expect(md).toContain('（1）请在 10 月底前完成全链路压测。')
    expect(md).not.toContain('原建议')
    expect(md).not.toContain('被驳回')
    expect(md).not.toContain('待定的建议')
    expect(md).not.toContain('未复核的建议')
  })

  it('merges multiple items of the same rule into one point joined by 「；」', () => {
    const md = renderOpinion({
      ...base,
      issues: [
        issue({ severity: 'major', status: 'adopted', ruleId: 'INT-002', suggestion: '建议补充手机号未绑定的处理。' }),
        issue({ severity: 'major', status: 'rewritten', ruleId: 'INT-002', suggestion: 'x', rewriteText: '补充解绑后的返回码说明' }),
      ],
    })
    expect(md).toContain('（1）建议补充手机号未绑定的处理；补充解绑后的返回码说明。')
    expect(md).not.toContain('（2）')
  })

  it('normalizes trailing punctuation to a single 「。」 and removes a doubled 「建议建议」 prefix', () => {
    const md = renderOpinion({
      ...base,
      issues: [
        issue({ severity: 'minor', status: 'adopted', ruleId: 'INT-004', suggestion: '建议建议统一渠道标识' }),
        issue({ severity: 'minor', status: 'adopted', ruleId: 'INT-005', suggestion: '建议补充幂等设计。。' }),
        issue({ severity: 'minor', status: 'adopted', ruleId: 'CFG-001', suggestion: '建议参数可配置；' }),
      ],
    })
    expect(md).toContain('（1）建议统一渠道标识。')
    expect(md).toContain('（2）建议补充幂等设计。')
    expect(md).toContain('（3）建议参数可配置。')
    expect(md).not.toContain('建议建议')
  })

  it('renders the historical empty-issue sentence when finalVerdict is 通过 and no points remain', () => {
    const md = renderOpinion({ ...base, finalVerdict: '通过', aiVerdictAtFinalize: '通过', issues: [issue({ severity: 'major', status: 'rejected' })] })
    expect(md).toContain('意见：通过')
    expect(md).toContain('（1）按当前方案技术路线开展。')
  })

  it('does not insert the empty-issue sentence for non-通过 verdicts with no points', () => {
    const md = renderOpinion({ ...base, finalVerdict: '不通过' })
    expect(md).not.toContain('按当前方案技术路线开展')
  })

  it('escapes pipe characters in the title so the header table stays valid', () => {
    const md = renderOpinion({ ...base, title: 'A | B' })
    expect(md).toContain('| 方案 | A \\| B |')
  })
})

describe('opinionFileName (T-PRO-08)', () => {
  it('uses <reviewId>.md for the first version and -vN for later versions', () => {
    expect(opinionFileName('rv_20261019_abc123', 1)).toBe('rv_20261019_abc123.md')
    expect(opinionFileName('rv_20261019_abc123', 2)).toBe('rv_20261019_abc123-v2.md')
    expect(opinionFileName('rv_20261019_abc123', 10)).toBe('rv_20261019_abc123-v10.md')
  })

  it('rejects versions below 1', () => {
    expect(() => opinionFileName('rv_x', 0)).toThrow(/version/)
  })
})
