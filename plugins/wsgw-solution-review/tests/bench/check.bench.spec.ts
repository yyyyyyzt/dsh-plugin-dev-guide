// T-REQ-17 / T-DES-14 / NFR-02: check() over a ~200 KB synthetic solution must finish within 2 s.
// Excluded from `pnpm test` (vitest.config.ts); run with `pnpm bench`.
import { describe, expect, it } from 'vitest'
import { check } from '../../src/engine/check.js'
import { parseMarkdown } from '../../src/engine/parse/markdown.js'
import { readFixture, shippedPack } from '../helpers.js'

function synthesize(targetBytes: number): string {
  const seed = readFixture('seed-compliant.md')
  const filler = [
    '',
    '#### 2.1.3 补充说明',
    '',
    '| 参数名 | 类型 | 必填 | 说明 |',
    '|---|---|---|---|',
    ...Array.from({ length: 40 }, (_, i) => `| field${i} | String | 是 | 字段 ${i} 的说明，含校验与边界说明。 |`),
    '',
    '接口在高并发下通过网关限流保护，峰值并发 800 QPS；异常返回码 0203 表示手机号与户号无绑定关系，前端提示用户先完成绑定。'.repeat(20),
    '',
  ].join('\n')
  let out = seed
  while (Buffer.byteLength(out, 'utf8') < targetBytes) out = out.replace('### 2.2 数据规划', `${filler}\n\n### 2.2 数据规划`)
  return out
}

describe('check() performance (T-REQ-17, T-DES-14)', () => {
  it('parses and checks a 200 KB document in under 2 s', () => {
    const source = synthesize(200 * 1024)
    expect(Buffer.byteLength(source, 'utf8')).toBeGreaterThanOrEqual(200 * 1024)
    const pack = shippedPack()
    // warm-up (module init / regex compile)
    check(parseMarkdown(readFixture('seed.md')), pack.rules, pack.lexicon)

    const t0 = performance.now()
    const report = check(parseMarkdown(source), pack.rules, pack.lexicon)
    const ms = performance.now() - t0

    expect(report.checklist.length).toBe(28)
    expect(ms).toBeLessThan(2000)
  })
})
