// T-DES-03: sequenceDiagram parsing — 6 arrow kinds, participant/actor aliases, Note/loop lines ignored.
import { beforeAll, describe, expect, it } from 'vitest'
import { parseMermaid, type ParsedMermaid } from '../../src/engine/parse/mermaid.js'

const diagram = `sequenceDiagram
    participant U as 用户
    actor F as 前端卡片
    participant UC
    Note over U,F: 用户点击卡片
    U->>F: 发起余额查询
    F-->>U: 展示加载态
    F->UC: 提交 auth_code
    UC-->F: 返回 openId
    loop 每 30 秒
        UC-xF: 心跳失败
        UC--xF: 异步失败
    end
    alt 已绑定
        UC-)F: 异步通知
    else 未绑定
        UC--)F: 异步拒绝
    end
`

describe('parseMermaid (T-DES-03)', () => {
  let parsed: ParsedMermaid
  beforeAll(() => {
    parsed = parseMermaid(diagram)
  })

  it('recognises sequenceDiagram as kind sequence', () => {
    expect(parsed.kind).toBe('sequence')
  })

  it('collects participants from participant/actor lines, using the alias display name', () => {
    expect(parsed.participants).toEqual(['用户', '前端卡片', 'UC'])
  })

  it('parses all six arrow kinds (plus async variants) and resolves aliases to display names', () => {
    const arrows = parsed.messages.map((m) => m.arrow)
    expect(arrows).toEqual(expect.arrayContaining(['->>', '-->>', '->', '-->', '-x', '--x', '-)', '--)']))
    const first = parsed.messages[0]!
    expect(first.from).toBe('用户')
    expect(first.to).toBe('前端卡片')
    expect(first.text).toBe('发起余额查询')
    expect(first.line).toBe(6)
  })

  it('ignores Note / loop / alt / else / end lines without throwing', () => {
    expect(parsed.messages).toHaveLength(8)
    expect(parsed.messages.some((m) => m.text.includes('用户点击卡片'))).toBe(false)
    expect(parsed.messages.some((m) => m.text.includes('每 30 秒'))).toBe(false)
  })

  it('adds implicit participants that only appear in messages', () => {
    const p = parseMermaid('sequenceDiagram\n  A->>B: hi\n  B-->>C: ok\n')
    expect(p.participants).toEqual(['A', 'B', 'C'])
  })

  it('reports non-sequence diagrams as other with no messages', () => {
    const p = parseMermaid('flowchart LR\n  A --> B\n')
    expect(p.kind).toBe('other')
    expect(p.messages).toEqual([])
    expect(p.participants).toEqual([])
  })

  it('tolerates an empty or whitespace-only block', () => {
    expect(() => parseMermaid('   \n')).not.toThrow()
    expect(parseMermaid('').kind).toBe('other')
  })
})
