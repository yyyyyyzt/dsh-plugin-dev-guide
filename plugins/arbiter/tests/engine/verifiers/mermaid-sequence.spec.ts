// T-RUL-06 / T-REQ-04: mermaid-sequence verifier — image → fail; too few participants → fail; missing
// required family → fail with note; complete → pass; participantFamilies miss → not-applicable.
import { describe, expect, it } from 'vitest'
import { verifyMermaidSequence } from '../../../src/engine/verifiers/mermaid-sequence.js'
import { miniLexicon, sectionsDoc } from '../../helpers.js'

const fullAuth = `\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端卡片
    participant UC as 用户中心
    participant AP as 阿宝服务端
    U->>F: 发起余额查询
    F->>F: 调用 JSAPI 获取一次性授权码 auth_code
    F->>UC: 提交 auth_code
    UC->>AP: 以授权码换取 openId
    AP-->>UC: 返回 openId
    UC->>AP: 以 openId 换取手机号
    AP-->>UC: 返回手机号
    UC->>UC: 校验是否已完成国网内部授权 / 绑定关系
    UC-->>F: 一键登录成功，返回 token
\`\`\``

const incompleteAuth = `\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端卡片
    participant UC as 用户中心
    participant AP as 阿宝服务端
    U->>F: 发起余额查询
    F->>UC: 提交授权码
    UC->>AP: 换取用户信息
    UC->>UC: 校验绑定关系
    UC-->>F: 登录成功
\`\`\``

const authParams = {
  participantFamilies: ['authcode', 'openid', 'login'],
  requiredMessageFamilies: ['authcode', 'openid', 'phone', 'bind-check', 'login'],
}

describe('verifyMermaidSequence (T-RUL-06, T-REQ-04)', () => {
  it('passes a complete diagram with the block first line as mermaid evidence', () => {
    const doc = sectionsDoc({ 技术思路: `鉴权流程如下：\n\n${fullAuth}` })
    const r = verifyMermaidSequence(doc, { sections: ['approach'], minParticipants: 2, minMessages: 3 }, miniLexicon)
    expect(r.status).toBe('pass')
    expect(r.evidence[0]!.kind).toBe('mermaid')
    expect(r.evidence[0]!.quote).toContain('sequenceDiagram')
    expect(r.evidence[0]!.sectionPath).toBe('一')
  })

  it('fails when the section only has an image (treatImageAsFail default), with a note about images', () => {
    const doc = sectionsDoc({ 技术思路: '时序图如下：\n\n![时序图](./seq.png)' })
    const r = verifyMermaidSequence(doc, { sections: ['approach'] }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.note).toMatch(/图片/)
    expect(r.evidence[0]!.kind).toBe('absence')
  })

  it('fails on 「时序图见图」/「略」 wording with no mermaid', () => {
    const doc = sectionsDoc({ 技术思路: '鉴权时序图：略。' })
    const r = verifyMermaidSequence(doc, { sections: ['approach'] }, miniLexicon)
    expect(r.status).toBe('fail')
  })

  it('does not fail on images when treatImageAsFail is false and no mermaid exists → absence fail without image note', () => {
    const doc = sectionsDoc({ 技术思路: '![时序图](./seq.png)' })
    const r = verifyMermaidSequence(doc, { sections: ['approach'], treatImageAsFail: false }, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.note ?? '').not.toMatch(/图片/)
  })

  it('fails when participants or messages are below the minimum', () => {
    const doc = sectionsDoc({
      技术思路: '```mermaid\nsequenceDiagram\n  A->>B: 一\n  B-->>A: 二\n```',
    })
    expect(verifyMermaidSequence(doc, { minParticipants: 3 }, miniLexicon).status).toBe('fail')
    expect(verifyMermaidSequence(doc, { minMessages: 3 }, miniLexicon).status).toBe('fail')
    expect(verifyMermaidSequence(doc, { minParticipants: 2, minMessages: 2 }, miniLexicon).status).toBe('pass')
  })

  it('fails when a required message family is missing and names the missing families in note', () => {
    const doc = sectionsDoc({ 接入方式: incompleteAuth })
    const r = verifyMermaidSequence(doc, authParams, miniLexicon)
    expect(r.status).toBe('fail')
    expect(r.evidence[0]!.kind).toBe('mermaid')
    expect(r.note).toMatch(/openid/)
    expect(r.note).toMatch(/phone/)
    expect(r.note).not.toMatch(/bind-check/)
  })

  it('passes when every required message family appears in at least one message', () => {
    const doc = sectionsDoc({ 接入方式: fullAuth })
    expect(verifyMermaidSequence(doc, authParams, miniLexicon).status).toBe('pass')
  })

  it('returns not-applicable when participantFamilies hit no participant or message of any diagram', () => {
    const doc = sectionsDoc({
      技术思路: '```mermaid\nsequenceDiagram\n  participant S as 调度\n  participant J as 任务\n  S->>J: 启动\n  J-->>S: 完成\n  S->>J: 停止\n```',
    })
    const r = verifyMermaidSequence(doc, authParams, miniLexicon)
    expect(r.status).toBe('not-applicable')
  })

  it('returns not-applicable (not fail) when participantFamilies is set and there is no diagram at all', () => {
    const doc = sectionsDoc({ 接入方式: '文字描述的鉴权链路：获取授权码、换取 openId、校验绑定关系后登录。' })
    expect(verifyMermaidSequence(doc, authParams, miniLexicon).status).toBe('not-applicable')
  })

  it('ignores non-sequence mermaid blocks', () => {
    const doc = sectionsDoc({ 技术思路: '```mermaid\nflowchart LR\n  A --> B\n```' })
    expect(verifyMermaidSequence(doc, { sections: ['approach'] }, miniLexicon).status).toBe('fail')
  })
})
