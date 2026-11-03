// Anonymization (T-EVA-07): deterministic mapping, leakage check, private map location.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAnonymizer, DEFAULT_PRIVATE_DIR, leakCheck, type AnonymizerDict } from '../../src/eval/index.js'
import { packageRoot } from '../helpers.js'

const dict: AnonymizerDict = {
  fixed: { 星河电力平台: 'OSP', 客服热线中心: '客服门户' },
  provinces: ['甲省', '乙省'],
  thirdParties: ['蓝鸟支付', '绿叶助手'],
  services: ['svc-alpha-front', 'svc-beta-core'],
  tables: ['t_user_bind'],
  codes: ['3389', '2021000000000000'],
  reviewers: ['张三', '李四'],
  dateShiftDays: -37,
}

const sample = [
  '方案 PD_TR_20260801001：关于乙省退费申请工单优化。星河电力平台通过蓝鸟支付智能体接入，',
  '渠道编号 3389，微服务 svc-alpha-front 读取表 t_user_bind，接口 /member/uc13/c44/f01。',
  '甲省用户由绿叶助手导流；appId 2021000000000000。审核人：张三。2026 年 8 月 15 日提交，2026-09-30 上线。',
  '方案 PD_TR_20260802003 由李四复核。再次提到乙省与 PD_TR_20260801001。',
].join('')

describe('anonymization (T-EVA-07)', () => {
  it('province / channel / service names / channel codes in sample text are all replaced', () => {
    const a = createAnonymizer(dict)
    const out = a.anonymize(sample)
    expect(out).not.toMatch(/星河电力平台|客服热线中心|甲省|乙省|蓝鸟支付|绿叶助手|svc-alpha-front|t_user_bind|3389|2021000000000000|张三|李四/u)
    expect(out).toContain('OSP')
    expect(out).toContain('省份A')
    expect(out).toContain('省份B')
    expect(out).toContain('第三方渠道P1')
    expect(out).toContain('第三方渠道P2')
    expect(out).toContain('svc-01')
    expect(out).toContain('tbl_01')
    expect(out).toContain('<CODE>')
    expect(out).toContain('R1')
    expect(out).toContain('R2')
    expect(out).toContain('/api/<path>')
    expect(out).toMatch(/S-01/)
    expect(out).toMatch(/S-02/)
    expect(out).not.toMatch(/PD_TR_/)
  })

  it('provinces are numbered by first occurrence and the same proposal code maps to the same alias', () => {
    const a = createAnonymizer(dict)
    const out = a.anonymize(sample)
    expect(out.indexOf('省份A')).toBeLessThan(out.indexOf('省份B'))
    expect(out.match(/S-01/g)!.length).toBe(2)
    expect(a.map()['PD_TR_20260801001']).toBe('S-01')
    expect(a.map()['乙省']).toBe('省份A')
  })

  it('dates are shifted by a fixed offset preserving order and spacing', () => {
    const a = createAnonymizer(dict)
    const out = a.anonymize('2026 年 8 月 15 日提交，2026-09-30 上线，2026年10月1日复盘。')
    expect(out).toContain('2026-07-09')
    expect(out).toContain('2026-08-24')
    expect(out).toContain('2026-08-25')
    expect(out).not.toMatch(/2026-09-30|8 月 15 日|10月1日/)
  })

  it('leakage grep against the forbidden-term list yields 0 hits on the anonymized corpus and counts hits otherwise', () => {
    const a = createAnonymizer(dict)
    const forbidden = ['星河电力平台', '蓝鸟支付', '甲省', 'svc-alpha-front', '3389', '张三']
    expect(leakCheck(a.anonymize(sample), forbidden)).toEqual([])
    const hits = leakCheck(sample, forbidden)
    expect(hits.find((h) => h.term === '3389')!.count).toBe(1)
    expect(hits.find((h) => h.term === '甲省')!.count).toBe(1)
  })

  it('mapping is deterministic for the same input and stored only under paper/data/private (gitignored)', () => {
    const m1 = createAnonymizer(dict)
    const m2 = createAnonymizer(dict)
    m1.anonymize(sample)
    m2.anonymize(sample)
    expect(m1.map()).toEqual(m2.map())
    expect(DEFAULT_PRIVATE_DIR).toBe('paper/data/private')
    const gitignore = readFileSync(join(packageRoot, '..', '..', '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/^paper\/data\/private\/$/m)
  })
})
