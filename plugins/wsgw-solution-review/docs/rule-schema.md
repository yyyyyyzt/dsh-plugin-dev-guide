# 规则模型与校验器规范 V1.0

> 状态：S1 定稿候选（2026-10-19）；2026-10-23 收紧 hybrid 语义：无候选 = `pending`，`whenNoCandidate: fail` 仅 hard。本文定义规则 YAML schema、三级 tier 语义、6 类校验器、证据门禁、shipped/learned 分层与生命周期；附录 A 给出旧 24 条规则的分级结果（Q4 决策），附录 B 为新增结构性规则。
> 核心思想：**规则的权限由可验证性决定**——只有能被程序确定性验证的要求才能自动产生问题；LLM 只在校验器划定的候选证据上判断；纯语义要求一律待人工。

## 1. 规则包文件

路径：`rules/<pack-id>.rules.yaml`（随包发布 = shipped 层）。一个文件一个规则包。

```yaml
pack:
  id: capability-open-access
  name: 能力开放 / 三方接入类审查规则包
  version: 1.0.0
  scenario: 能力开放 / 三方接入
  description: 面向网上国网能力对外开放、三方渠道接入类技术方案。
lexicon:            # 包级词表，规则用 key 引用（§7）
  headings: { … }
  placeholders: […]
  negations: […]
  families: { … }   # 关键词族
rules:
  - id: CAP-002
    title: 压测方案
    dimension: capacity
    severity: major
    tier: hard
    question: 上线前是否安排了压测，明确压测范围与指标？
    rationale: 对外接入类方案上线前应有压测，验证服务在新增流量下的稳定性。
    suggestion: 上线前建议开展压测，确保服务运行稳定。
    applicability: null
    verifier:
      kind: statement
      params:
        sections: [implementation, resources]
        families: [loadtest]
        decisive: true
        whenNoCandidate: fail
    status: active
    provenance:
      source: legacy:CAP-002
      examples: ["上线前建议开展压测，确保服务运行稳定。"]
```

### 1.1 规则字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `^[A-Z]{3}-\d{3}$` | 是 | 包内唯一；learned 草案用 `LRN-\d{3}` |
| `title` | string | 是 | ≤ 20 字 |
| `dimension` | `capacity|security|interface|channel|data_sync|config|monitoring|documentation` | 是 | |
| `severity` | `blocker|major|minor` | 是 | 参与结论策略 |
| `tier` | `hard|hybrid|soft` | 是 | §2 |
| `question` | string | 是 | 面向 LLM 与专家的审查问句 |
| `rationale` | string | 是 | 为什么要查 |
| `suggestion` | string | 是 | 默认整改建议（措辞范例的种子） |
| `applicability` | `null | { families?: string[]; sections?: string[]; tableRows?: {column, equals} }` | 否 | 适用性前置条件；不满足 → `not-applicable`，不列为问题。`families` 在全文（段落、标题、表格单元格）上匹配，因此族词必须足够专指（如用「消息推送」而不是「消息」） |
| `verifier` | §3 | `hard`/`hybrid` 必填；`soft` 必须为空 | |
| `status` | `active|draft|retired` | 是 | |
| `provenance` | `{ source, examples[] }` | 是 | `legacy:<id>` / `template` / `expert:<reviewId>` |

schema 校验在加载时执行（zod）；任何一条失败则整个规则包拒绝加载（`design.md` §12）。

## 2. tier 语义

| tier | 校验器 | 校验器允许的结果 | 谁能登记问题 | 计入 `ai_verdict` |
|---|---|---|---|---|
| `hard` | 必填，且 `decisive`（每个子校验器都只产生 pass / fail / not-applicable） | `pass` `fail` `not-applicable` | 只有校验器（`review_check` 自动登记）；LLM 对 hard 规则调用 `review_record_issue` 被拒绝（`HARD_RULE_VERIFIER_OWNED`） | 是 |
| `hybrid` | 必填 | `candidate` `pass` `pending` `not-applicable`（结构性子校验器仍可 `fail`） | 自动登记只允许结构性子校验器的确定性 `fail`（section / table / quantity / mermaid-sequence / cross-ref）；`statement` 无候选一律 `pending`，不得用 absence 让 hybrid 自动 fail；`candidate` 交给 LLM，LLM 登记时证据必须落在候选片段内；`pass` 只能来自结构性子校验器 | 是（结构 fail 与门禁通过的 LLM 登记） |
| `soft` | 禁止 | — | LLM 可登记，一律 `pending` | 否 |

设计约束：

- `hybrid` 的 `statement`（非 decisive）部分永不产生 `pass`：候选存在 ≠ 满足要求；LLM 不登记问题即视为该规则「未发现问题」，清单上标 `reviewed-no-issue`。结构性子校验器（如 SEC-002 的 Mermaid 鉴权链路检查）的 `pass` 是确定性验证，直接记 `pass`。
- `hard` 规则一旦 `fail`，专家仍可在复核中驳回（记入反馈，驱动规则调参）。
- 规则加载时静态检查：`hard` 的校验器树里不得出现 `whenNoCandidate: pending` 或非 decisive 的 `statement`。
- 规则加载时静态检查：`hybrid` 的 `statement` 不得 `decisive: true`，`whenNoCandidate` 只能是 `pending` / `pass`；出现 `fail` 直接拒绝加载（`HYBRID_ABSENCE_FAIL`）。
- 缺章节 / 缺关键词属于 absence，不是「原文证据」；它只能由 hard 校验器产生并计入 `ai_verdict`，hybrid 的 absence 只进 `pending`。

## 3. 校验器

统一接口（纯函数）：

```ts
type VerifierStatus = 'pass' | 'fail' | 'candidate' | 'pending' | 'not-applicable'
interface Snippet { quote: string; sectionPath: string; range: Range; flags?: ('negated'|'assertion-only'|'placeholder')[] }
interface VerifierResult {
  status: VerifierStatus
  evidence: Evidence[]          // pass/fail 的依据；fail 可为 absence 证据
  candidates?: Snippet[]        // 仅 hybrid
  note?: string                 // 面向 agent 的一句话解释
}
verify(doc: Doc, rule: Rule, lexicon: Lexicon): VerifierResult
```

`verifier` 字段可以是单个校验器 `{ kind, params }`，或组合器：

- `{ kind: 'all', of: [...] }`：全部 `pass` → `pass`；任一 `fail` → `fail`（合并证据）；否则若任一 `candidate` → `candidate`（合并候选）；全部 `not-applicable` → `not-applicable`。
- `{ kind: 'first', of: [...] }`：按序执行，第一个结果不是 `not-applicable` 的子校验器决定结果。

### 3.1 `section`

| 参数 | 默认 | 说明 |
|---|---|---|
| `heading` | 必填 | 词表 key（`lexicon.headings.*`）或别名数组 |
| `minChars` | 20 | 归一化后正文最少字数（不含子标题、表格语法符号） |
| `allowPlaceholder` | false | 正文仅为占位词（`lexicon.placeholders`）视为缺失 |

结果：标题命中且正文达标 → `pass`（证据 `kind:'heading'`）；标题缺失 → `fail`（`absence`，quote=「缺失：<期望标题>」，range=父章节末尾）；标题存在但正文不足/占位 → `fail`（证据为该节正文或占位词）。

### 3.2 `table`

| 参数 | 默认 | 说明 |
|---|---|---|
| `locate` | 必填 | `{ section?: headingKey, headerAny?: string[] }`：在某章节内找表头包含任一关键词的表 |
| `requiredColumns` | `[]` | 列别名组数组，如 `[["参数名","参数名称","字段"],["类型","数据格式"],["必填","是否非空","是否必填"]]` |
| `minRows` | 1 | |
| `placeholderCells` | `fail` | `fail`：必填列出现占位单元格即 fail；`ignore` |
| `requireRow` | — | `{ column, equalsAny }`：要求存在某行，如 返回码列含 `resultCode` |

结果：找不到表 → `fail`（absence）；缺列 / 占位 → `fail`（证据 table-cell）；达标 → `pass`。

### 3.3 `statement`

| 参数 | 默认 | 说明 |
|---|---|---|
| `sections` | 全文 | 限定章节 key 列表 |
| `families` | 必填 | 关键词族 key 列表（`lexicon.families.*`），任一命中即为候选句 |
| `requireAll` | false | 要求每个族都至少命中一句 |
| `negationWindow` | 6 | 关键词前 N 字内出现否定词（`lexicon.negations`）→ 句子标 `negated` |
| `assertionOnly` | — | 正则列表；命中且句内无因果词 → 标 `assertion-only` |
| `causalWords` | `[因为, 由于, 通过, 链路, 依据, 基于, 只与, 仅与, 不调用, 不接触]` | 判断「有依据」的词；可按规则覆盖 |
| `decisive` | false | `true`（hard 用）：存在未否定候选 → `pass`；只有否定候选 → `fail`（证据为否定句）；无候选 → 看 `whenNoCandidate` |
| `whenNoCandidate` | `pending` | `pending` / `pass`；`fail` 仅 `hard` 可用（absence 证据，quote=「未提及：<族名>」）。hybrid 设为 `fail` 会被 schema 拒绝 |

句子切分：按 `。；;！？\n` 与表格单元格边界切分，表格单元格作为独立句。

### 3.4 `quantity`

| 参数 | 默认 | 说明 |
|---|---|---|
| `sections` | 必填 | |
| `contextFamilies` | 必填 | 数量应描述的对象（如 `volume`：用户、请求、调用、并发、业务量） |
| `units` | 内置 | `万|亿|次|条|笔|人|户|QPS|TPS|/日|/天|/秒|ms|%` |
| `window` | 30 | 数字与上下文词的最大字距 |

结果：存在「数字 + 单位」且 window 内有上下文词 → `pass`；只有上下文词无数字（如「大量新增用户」）→ `fail`（证据为该句，flag `assertion-only`）；上下文词也没有 → `fail`（absence）。

### 3.5 `mermaid-sequence`

| 参数 | 默认 | 说明 |
|---|---|---|
| `sections` | 全文 | |
| `minParticipants` | 2 | |
| `minMessages` | 3 | |
| `participantFamilies` | — | 用于适用性：没有任何图的参与方命中族时 → `not-applicable`（配合 `first` 组合器回退到 `statement`） |
| `requiredMessageFamilies` | `[]` | 每个族至少在一条消息文本中命中（如鉴权：`authcode`、`openid`、`phone`、`bind-check`、`login`） |
| `treatImageAsFail` | true | 限定章节内出现图片语法或「时序图…略/见图」而无 Mermaid → `fail`，note「时序图不可验证（图片）」 |

结果：达标 → `pass`（证据为 Mermaid 块首行）；无图 / 图片 / 参与方或消息不足 / 缺关键步骤 → `fail`（证据为块或 absence，note 指出缺的族）。

### 3.6 `cross-ref`

| 参数 | 默认 | 说明 |
|---|---|---|
| `refPattern` | `附件\s*([0-9０-９一二三四五六七八九十]+)` | 正文引用 |
| `listSection` | `attachments` | 清单所在章节 key |
| `listItemPattern` | `附件\s*([0-9０-９一二三四五六七八九十]+)\s*[:：]` | 清单项 |
| `requireListNonEmpty` | true | |

结果：所有引用都能在清单中找到 → `pass`；任一找不到 → `fail`（每个悬空引用一条证据）；清单缺失 → `fail`（absence）。

## 4. 证据锚点格式

`Evidence = { quote, sectionPath?, range?, kind }`（`design.md` §4）。

- 校验器产生的证据必须带 `range`；`absence` 证据的 `range` 为零长区间（插入点）。
- LLM 提交的证据只需 `quote`（可选 `sectionPath`），`range` 由门禁回填。
- `quote` 归一化后长度 8–300 字；表格单元格证据可短至 1 字但必须带 `kind:'table-cell'`（仅校验器可产生）。
- `absence` 不是原文引文：它由校验器产生，记录缺失项与定位章节；展示时必须标注 `absence`，不得写成 `「未提及：…」` 的引文格式。LLM 提交 `kind:'absence'` 一律拒绝。
- 对话与正式意见中展示证据时格式：文本证据 `「<quote>」（<sectionPath> · 第 <line> 行）`；absence 显示为 `（<sectionPath> 下未见 <期望内容>；absence，非引文）`。

## 5. 证据门禁（`review_record_issue` 内强制）

```
输入: reviewId, ruleId?, evidence[], finding, suggestion
1. rule = resolve(ruleId)
   - 无 ruleId            → tier = soft, reason NO_RULE           → pending
   - rule.tier = soft     → reason SOFT_RULE                      → pending
   - rule.tier = hard     → 抛 HARD_RULE_VERIFIER_OWNED（不登记）
2. evidence 为空          → reason NO_EVIDENCE                     → pending
3. 对每条 evidence:
   - LLM 提交 kind='absence'，或 quote 以「未提及 / 未见 / 缺失 / 未找到 / 未说明 / 未明确 / 未提供」开头 → ABSENCE_NOT_ALLOWED（absence 不是引文）
   q = normalize(quote); len(q) < 8 → QUOTE_TOO_SHORT; > 300 → QUOTE_TOO_LONG
   在 normalize(doc.source) 中查找 q：
     - 有 sectionPath 且该章节内命中 → 取该命中
     - 否则取全文首个命中；未命中 → QUOTE_NOT_FOUND
   回填 range 与实际 sectionPath
4. rule.tier = hybrid:
   每条 evidence 的 range 必须与最近一次 review_check 中该规则的 candidates[].range 相交
   否则 → OUT_OF_CANDIDATES
5. 全部通过 → status confirmed；任一失败 → status pending，gate.reason 列出全部原因
```

- 门禁拒绝不抛错（除第 1 步 hard 情况），返回 `reason` 让 agent 可修正引文后重试一次（skill 约定）。
- `pending` 问题照常在复核中呈现，专家「确认为问题」后状态变为 `adopted` 并计入结论（专家确认即证据）。

## 6. shipped / learned 分层与生命周期

### 6.1 覆盖层（`rule_overrides` 表，key = ruleId）

允许覆盖的字段：`status`、`severity`、`suggestion`、`params`（仅白名单：`families` 的增删、`minChars`、`minMessages`、`minParticipants`、`whenNoCandidate`、`negationWindow`、`window`）。其余字段不可在运行期改；`whenNoCandidate: fail` 仅 hard 规则可设，hybrid 上设 fail 会被 schema 拒绝。`draft` 字段承载整条新规则（`LRN-*`），结构同 §1.1。

合并算法（`engine/rules.ts`）：

```
effective = shipped.map(r => override[r.id] ? merge(r, override[r.id]) : r)
          ∪ overrides.filter(o => o.draft).map(o => o.draft)
merge: 浅覆盖 status/severity/suggestion；params 按白名单逐键覆盖，families 以 add/remove 列表应用
未知 ruleId 的 override：忽略并在 /rules 与看板上警告
```

### 6.2 生命周期

```
候选意见 (rule_candidates.status=new)
  → rules_propose(draft)      agent 起草 LRN-xxx，tier 默认 soft，status=draft
  → 专家对话确认 (accept_draft) status=active
  → 运行积累 stats；专家可 set_severity / set_suggestion / set_param / disable / reset
  → disable → status=retired（保留 stats 与范例）
```

草案升级为 `hybrid`/`hard` 需要人工写校验器参数（对话中由 agent 代填，专家确认）；`soft → hybrid` 升级提示（「该规则采纳率高且有稳定关键词，可考虑升级」，只提示不自动改）计划放在总览「规则」页该规则的记忆区，暂推迟（`progress.md` §5）。

### 6.3 审计

每次 override 写入追加 `audit[]`：`{ who: reviewer, at, reviewId?, change: { field, from, to } }`。看板「规则」页展开时展示最近 10 条。`reset` 为每个被删除的覆盖字段各记一条（`to` 为 shipped 值）。

## 7. 词表（shipped 初版，可被 override 增删）

```yaml
lexicon:
  headings:
    resources-table: [资源变更清单, 资源清单]          # 文首表格（用 table 校验器定位，不靠标题）
    background:      [工作背景, 背景, 需求背景]
    approach:        [技术思路, 技术思路及实现方式, 实现方式, 技术方案]
    access:          [接入方式, 接入流程]
    interface:       [接口设计, 接口说明, 接口定义]
    data-plan:       [数据规划, 数据流转, 数据存储, 数据增长估算]
    implementation:  [实施方案, 实施计划, 上线计划]
    goal:            [上线目标]
    resources:       [资源评估, 资源需求]
    risk:            [风险评估, 风险分析]
    attachments:     [附件, 附件清单]
  placeholders: ['/', '无', '略', '-', '—', 'N/A', 'n/a', '暂无', '待定', 'TBD', '见图', '如图']
  negations: [不, 未, 无需, 不需要, 暂不, 没有, 无, 非, 免, 不会, 不做]
  families:
    ratelimit:   [限流, 流控, 并发控制, 并发量, 令牌桶, 漏桶, 熔断, 降级, QPS, TPS]
    loadtest:    [压测, 压力测试, 性能测试, 负载测试]
    scale:       [扩容, 资源评估, 容量, 服务器, 实例, 节点, CPU, 内存]
    volume:      [业务量, 请求量, 调用量, 新增用户, 用户量, 访问量, 日活, 峰值, 并发]
    riskctl:     [风控, 风险控制, 风控开关]
    crypto:      [加密, 签名, 验签, 防篡改, HTTPS, TLS, 密钥, token, 令牌, 鉴权, 加签]
    authcode:    [授权码, auth_code, authCode, code码, 一次性授权码]
    openid:      [openId, openid, OpenID, 用户标识]
    phone:       [手机号, 手机号码]
    bind-check:  [校验, 授权关系, 绑定关系, 是否已授权, 是否已注册]
    login:       [登录, 一键登录, 注册]
    realname:    [实名, 身份证, 实名信息]
    exposure:    [暴露, 数据暴露, 外泄, 泄露, 越权]
    boundary:    [异常, 边界, 不存在, 失败, 为空, 未绑定, 无绑定, 超时, 重试, 兜底]
    change:      [修改, 改造, 优化, 调整, 变更]
    existing:    [现有, 原有, 既有, 当前逻辑, 现有接口, 原逻辑]
    channel-id:  [渠道标识, 渠道编号, 渠道号, member, channel, appCode]
    idempotent:  [幂等, 重试, 重复请求, 去重, 防重]
    channel-ctl: [渠道管控, 渠道开关, 配额, 熔断, 下线, 黑名单, 白名单, 渠道限流]
    sync:        [数据同步, 同步数据, 实时同步, 异步同步, MQ, 定时任务]
    tracking:    [埋点, 打点, 数据采集]
    tracking-impl: [SDK, 上报, 接口, 字段, 事件, 实现方式, 采集方式]
    message:     [消息推送, 订阅消息, 推送, 订阅, 站内信, 消息卡片]
    ui-change:   [样式, 交互优化, 交互调整, 页面优化, 文字优化, UI, 原型, 按钮]
    prototype:   [原型, UE, 对比, 优化前后, 效果图]
```

## 8. 测试要点（供 S2）

| ID | 要点 |
|---|---|
| T-RUL-01 | 规则 YAML schema：缺字段 / 非法 id / `soft` 带 verifier / `hard` 带非 decisive statement → 拒绝加载，错误指明规则 id 与字段 |
| T-RUL-02 | `section`：缺标题 → absence；标题有但正文「略」→ fail；正文 ≥ minChars → pass |
| T-RUL-03 | `table`：资源清单表定位；占位单元格 fail / ignore 两种模式；`requireRow` 命中 |
| T-RUL-04 | `statement`：否定窗口（「暂不压测」→ negated）；`decisive` 下 pass/fail；`whenNoCandidate` 三种；表格单元格作为句子 |
| T-RUL-05 | `quantity`：「大量新增用户」→ fail(assertion-only)；「预计新增用户 50 万/月」→ pass；无上下文 → absence |
| T-RUL-06 | `mermaid-sequence`：图片替代 → fail；参与方不足 → fail；缺 `openid` 族消息 → fail 且 note 指出；完整 → pass；`participantFamilies` 不命中 → not-applicable |
| T-RUL-07 | `cross-ref`：「详情见附件 2」存在清单 → pass；「附件 4」悬空 → fail 一条证据；清单缺失 → absence |
| T-RUL-08 | 组合器 `all` / `first` 的状态合成表 |
| T-RUL-09 | 门禁：§5 每个 reason 至少一个用例；hybrid 越界 → OUT_OF_CANDIDATES；hard → 抛错 |
| T-RUL-10 | 合并：override 覆盖 status/severity；params 白名单外字段被忽略；families add/remove；未知 id 警告；draft 规则出现在 effective |
| T-RUL-11 | 适用性：`applicability.families` 不命中 → not-applicable；`tableRows` 条件（变更类型=修改）命中 |
| T-RUL-12 | 附录 A 的 28 条规则全部通过 schema 校验，且对种子方案的预期状态与附录 A「种子方案预期」列一致 |

---

## 附录 A：旧 24 条规则的分级（Q4 决策）

列「种子方案预期」为对 `tests/fixtures/seed.md`（合成种子，时序图为图片）运行 `review_check` 的期望结果，是 S2 夹具 `expected/seed.json` 的来源。原历史种子已随 archive 删除。

| id | 标题 | severity | 旧 check_method | 新 tier | 校验器要点 | 种子方案预期 |
|---|---|---|---|---|---|---|
| CAP-001 | 限流与并发控制策略 | blocker | rule+llm | **hybrid** | `statement(families: ratelimit, sections: approach/data-plan/resources/risk, whenNoCandidate: pending)` | pending（未提及限流 → 待人工，不自动登记） |
| CAP-002 | 压测方案 | major | rule | **hard** | `statement(families: loadtest, sections: implementation/resources, decisive, whenNoCandidate: fail)` | fail |
| CAP-003 | 资源扩容评估 | major | llm+data | **hybrid** | `all[ section(resources, minChars 10), statement(families: scale, sections: resources/data-plan, assertionOnly: ['无需扩容','不需要扩容'], whenNoCandidate: pending) ]` | candidate（「初步评估无需扩容资源」flag assertion-only）→ LLM 判断 |
| CAP-004 | 现有接口性能影响评估 | major | llm+data | **soft** | — | 清单列出，LLM 可登记为 pending |
| CAP-005 | 风控接入响应时间影响 | major | llm | **hybrid** | `applicability.families: [riskctl]`；`statement(families: riskctl, whenNoCandidate: pending)` | not-applicable（未提风控） |
| SEC-001 | 安全防护与加密策略 | blocker | llm | **hybrid** | `statement(families: crypto, sections: approach/interface/risk, whenNoCandidate: pending)` | candidate（命中「鉴权」「token」等）→ LLM 判断 |
| SEC-002 | 鉴权链路闭环 | blocker | llm | **hybrid** | `first[ mermaid-sequence(participantFamilies: [authcode, openid, login], requiredMessageFamilies: [authcode, openid, phone, bind-check, login]), statement(families: [authcode, openid, bind-check, login], requireAll, sections: access, whenNoCandidate: pending) ]` | mermaid not-applicable → statement candidate（文字链路完整）→ LLM 判断 |
| SEC-003 | 实名信息业务用途 | major | llm | **hybrid** | `applicability.families: [realname]`；`statement(families: realname, whenNoCandidate: pending)` | candidate（接口表「用户实名授权 code」）→ LLM 判断 |
| SEC-004 | 数据暴露面核实 | blocker | llm | **hybrid** | `all[ section(risk, minChars 10), statement(families: exposure, sections: risk, assertionOnly: ['无暴露风险','无风险'], whenNoCandidate: pending) ]` | candidate（「无暴露风险…不调用国网数据」有因果词「只与…交互」→ 不标 assertion-only）→ LLM 判断；risk 章节为占位「无」时 section 结构 fail 仍可自动登记 |
| SEC-005 | 需求必要性及合规性 | major | llm | **soft** | — | 清单 |
| INT-001 | 接口文档完整性 | major | rule | **hard** | `all[ table(locate: {section: interface, headerAny: [参数]}, requiredColumns: [[参数名,参数名称,字段],[类型,数据格式],[必填,是否非空,是否必填]]), table(locate: {section: interface, headerAny: [返回,输出]}, requireRow: {column: [字段,参数], equalsAny: [resultCode, code, 返回码]}), cross-ref ]` | pass（接口表齐全；「附件 2」可解析） |
| INT-002 | 边界逻辑覆盖 | major | llm | **hybrid** | `statement(families: boundary, sections: interface/approach, whenNoCandidate: pending)` | candidate（返回码 0101/0203 等异常码）→ LLM 判断「手机号与户号无绑定」是否覆盖 |
| INT-003 | 现有逻辑改动影响 | major | llm | **hybrid** | `applicability.tableRows: {column: 变更类型, equals: 修改}`；`statement(families: [change, existing], requireAll, whenNoCandidate: pending)` | 适用（两个微服务「修改」）→ candidate（命中「修改」「现有数据架构」）→ LLM 判断是否评估了对现有逻辑的影响 |
| INT-004 | 渠道标识规范 | minor | rule | **hard** | `statement(families: channel-id, sections: interface, decisive, whenNoCandidate: fail)` | pass（「渠道编号 3389：阿宝」「渠道标识字段」） |
| INT-005 | 幂等与重试策略 | minor | llm | **hybrid** | `statement(families: idempotent, sections: interface/approach, whenNoCandidate: pending)` | pending（只读查询，待人工） |
| CHN-001 | 渠道管控策略 | major | llm | **hybrid** | `statement(families: channel-ctl, whenNoCandidate: pending)` | pending（未提及渠道管控 → 待人工，不自动登记） |
| SYN-001 | 异步同步机制 | major | llm | **hybrid** | `applicability.families: [sync]`；`statement(families: sync, whenNoCandidate: pending)` | not-applicable（「与现有数据架构一致」不含同步族词） |
| CFG-001 | 可配置化设计 | minor | llm | **soft** | — | 清单 |
| MON-001 | 埋点实现方式 | minor | rule | **hybrid** | `applicability.families: [tracking]`；`statement(families: tracking-impl, whenNoCandidate: pending)` | not-applicable |
| DOC-001 | 时序图完整性 | major | rule | **hard** | `mermaid-sequence(sections: approach, minParticipants 2, minMessages 3, treatImageAsFail)` | fail（图片，不可验证） |
| DOC-002 | 优化前后对比 | minor | rule | **hard** | `applicability.families: [ui-change]`；`first[ cross-ref(listItemPattern 含 prototype 族), statement(families: prototype, decisive, whenNoCandidate: fail) ]` | not-applicable |
| DOC-003 | 变更原因说明 | minor | llm | **soft** | — | 清单 |
| DOC-004 | 改造逻辑明确 | major | llm | **soft** | — | 清单 |
| DOC-005 | 消息链路时序图 | major | llm | **hard** | `applicability.families: [message]`；`mermaid-sequence(participantFamilies: [message], minMessages 3)`；「解绑后仍推送原因」部分并入 INT-002 候选 | not-applicable |

统计：附录 A/B 合计 hard 10、hybrid 13、soft 5；其中附录 A 的 24 条为 hard 6、hybrid 13、soft 5，附录 B 的 CAP-006 / DOC-010 / DOC-011 / DOC-012 四条结构性规则为 hard。早先版本误记为 7/12；`llm+data` 两条（CAP-003 / CAP-004）分别改为 hybrid（数据可选）与 soft。

## 附录 B：新增结构性规则（来自模板与历史意见）

| id | 标题 | severity | tier | 校验器 | 来源 | 种子方案预期 |
|---|---|---|---|---|---|---|
| CAP-006 | 业务量估算量化 | major | **hard** | `quantity(sections: data-plan/resources, contextFamilies: [volume])` | 历史意见「建议预估明确业务量数据」「评估并补充业务增长量数据」 | fail（「大量新增用户」无数字） |
| DOC-010 | 资源变更清单表 | minor | **hard** | `table(locate: {headerAny: [资源名称, 变更类型]}, requiredColumns: [[资源名称],[变更类型],[名称]], minRows 1, placeholderCells: ignore)` + 至少一行变更类型非占位 | 模板 | pass |
| DOC-011 | 必备章节完整 | major | **hard** | `all[ section(background), section(approach), section(data-plan), section(implementation), section(resources), section(risk), section(attachments) ]` | 模板 | pass |
| DOC-012 | 附件引用一致 | minor | **hard** | `cross-ref` | 模板 | pass |

合计 28 条：hard 10、hybrid 13、soft 5（S3a 实现时按规则包逐条核对纠正，原文误记为 11/12/5；T-RUL-12 以此为准）。对种子方案的预期自动登记：CAP-002、CAP-006、DOC-001（均 major）→ 预审 `ai_verdict = 建议整改`；CAP-001、CHN-001 为 `pending`（无候选，absence 不自动 fail）；另有 CAP-003、SEC-001、SEC-002、SEC-003、SEC-004、INT-002、INT-003 七条进入 LLM 候选判断。S5 评测将报告 CAP-001 的驳回率并据此调参。
