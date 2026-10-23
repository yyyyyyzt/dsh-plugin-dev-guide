# wsgw-solution-review 设计说明 V1.0

> 状态：S1 定稿候选（2026-10-19）。实现以本文为准；需求编号引用 `requirements.md`，规则细节见 `rule-schema.md`，对话细节见 `review-protocol.md`。
> DSH 基线 `dsh-v0.2.1-rc.2`；API 名称以其 `docs/subsystems/*.zh.md` 与包 README 为准。

## 1. 设计原则

1. **能力复用优先**：持久化、提问、交付、skill、persona、看板席位、Word 转换全部来自 DSH 已有插件（`AGENTS.md` §2.2 表）。本包只写「审查引擎 + 存储域 + 工具 + 命令 + 路由 + 一个看板 tab」。
2. **引擎纯函数**：`src/engine/**` 不依赖 Cordis、不做 I/O、不读时钟；所有副作用集中在 `src/host/**` 的工具与服务里。单测只测引擎，契约测试测工具。
3. **工具即门禁**：模型只能通过工具写入；证据校验、tier 规则、`final_verdict` 写权限都在工具 `execute` 内强制，不依赖提示词。
4. **一个存储域，若干表**：全部记忆在一个 storage domain `wsgw_solution_review` 内，便于备份、迁移、看板读取。
5. **模型无关**：不出现任何厂商 SDK；对话用 agent 本身，批量评测用 `ctx.llm`（S5）。

## 2. 包结构

```
plugins/wsgw-solution-review/
├─ package.json                 name=wsgw-solution-review, dsh.bundle + dsh.client
├─ cordis.patch.yml             host 行 + preset 行（§3.2）
├─ tsconfig.json / tsdown.config.ts
├─ rules/
│  └─ capability-open-access.rules.yaml     shipped 规则包（rule-schema.md）
├─ skills/
│  └─ wsgw-solution-review/SKILL.md         审查 SOP（review-protocol.md §3）
├─ src/
│  ├─ index.ts                  host 入口：组合 §3.1 的 host 子插件
│  ├─ tools.ts                  preset 子插件入口：注册 9 个工具（inject: tools, solutionReview）
│  ├─ engine/                   纯函数
│  │  ├─ types.ts               Doc / Rule / Issue / Evidence / Verdict 类型
│  │  ├─ parse/markdown.ts      Markdown → Doc（mdast + gfm，保留 position）
│  │  ├─ parse/mermaid.ts       sequenceDiagram 最小解析
│  │  ├─ normalize.ts           文本归一化（证据门禁与词表匹配共用）
│  │  ├─ verifiers/{section,table,statement,quantity,mermaid-sequence,cross-ref}.ts
│  │  ├─ check.ts               运行规则集 → CheckReport
│  │  ├─ gate.ts                证据门禁
│  │  ├─ verdict.ts             结论策略
│  │  ├─ memory.ts              反馈聚合、范例裁剪、候选规则生成
│  │  ├─ rules.ts               shipped + learned 合并、YAML schema 校验
│  │  └─ render/opinion.ts      正式意见 Markdown 渲染
│  ├─ host/
│  │  ├─ store.ts               defineDomain spec + ReviewStore 服务（ctx.solutionReview）
│  │  ├─ config.ts              schemastery Config
│  │  ├─ commands.ts            /review /rules /memory
│  │  ├─ api.ts                 HTTP 路由（读 + 受限写）
│  │  ├─ skills.ts              SkillProvider（随包 SKILL.md）
│  │  └─ settings.ts            installSettingsSection
│  └─ client/
│     ├─ index.ts               sidebar-right tab + settings card 注册
│     └─ pages/{rules,reviews,memory,eval}.tsx
├─ tests/                       S2（见 §14）
└─ docs/                        本目录
```

## 3. 组合方式

### 3.1 插件入口与服务

| 入口 | 导出 | `inject` | 注册 |
|---|---|---|---|
| `wsgw-solution-review`（`src/index.ts`） | `name`, `Config`, `apply` | `storageDomain`, `commands`, `webServer`, `skills`, `settings`（可选 `sessionQuery`） | 服务 `ctx.solutionReview`（`ReviewStore`）、命令 ×3、路由 ×5、SkillProvider、设置分区 |
| `wsgw-solution-review/tools`（`src/tools.ts`） | `name`, `apply` | `tools`, `solutionReview`, `workingDirectory`, `fs` | 9 个工具（§8）；挂在 preset 内，因此只有审查 agent 可见 |
| `wsgw-solution-review/client`（`src/client/index.ts`） | `name`, `inject = ['slots','sidebarRightTabs','locale']` | — | tab 定义 + `sidebar.right.pane.tab` 正文 + `settings.plugin.item` 卡片 |

`ReviewStore` 用 `ctx.provide('solutionReview', …)`（Cordis 服务注册）暴露给 tools 子插件、命令与路由；它是唯一持有 domain 句柄的对象。

### 3.2 `cordis.patch.yml`

```yaml
- insert:
    - id: wsgw-solution-review
      name: wsgw-solution-review
      config:
        rulesDir: null              # null = 包内 rules/
        outputDir: reviews          # 相对会话工作目录
        minorThreshold: 3
        askBatchSize: 5
        rejectWarnRatio: 0.6
        rejectWarnMinSamples: 5
        exemplarsPerRule: 20
        maxSourceBytes: 204800
        presentOnFinalize: true
        defaultReviewer: ''
        dashboardPollSeconds: 0
    - id: preset-wsgw-solution-review
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: wsgw-solution-review
        name: 方案审查
        description: 网上国网技术方案 AI 预审（只建议，不裁决）
        order: 20
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: !!js require('wsgw-solution-review/persona').prefix
          - id: time-context
            name: '@deepseek-ai/dsh-time-context'
          - id: tool-bash
            name: '@deepseek-ai/dsh-tool-bash'
          - id: tool-fs
            name: '@deepseek-ai/dsh-tool-fs'
          - id: tool-fs-search
            name: '@deepseek-ai/dsh-tool-fs-search'
          - id: skill-filesystem
            name: '@deepseek-ai/dsh-skill-filesystem'
          - id: skill-office
            name: '@deepseek-ai/dsh-skill-office'
          - id: tool-skill
            name: '@deepseek-ai/dsh-tool-skill'
          - id: tool-ask-user
            name: '@deepseek-ai/dsh-tool-ask-user'
          - id: tool-todo
            name: '@deepseek-ai/dsh-tool-todo'
          - id: present
            name: '@deepseek-ai/dsh-tool-present'
          - id: compaction
            name: cordis:group
            group: true
            isolate: { compaction: true, toolResultPruner: true }
            config:
              - id: compaction-basic
                name: '@deepseek-ai/dsh-compaction-basic'
              - id: tool-result-pruner
                name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
                config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 }
          - id: review-tools
            name: wsgw-solution-review/tools
```

说明：

- preset 行与 Web profile 自带的 `preset-standard` 并列；`agent-preset-registry` 的 `default` 不改，用户在会话里选择「方案审查」。
- `persona.prefix` 若 `!!js require` 在 0.2.1 的 YAML 表达式环境不可用，则退化为把 persona 文本直接写入 YAML（S3c 验证后二选一，文本来源仍是 `review-protocol.md` §2）。
- 不挂 `agent-instructions`：审查会话不应读取工作目录的 AGENTS.md；不挂 `tool-web`、subagent、plan-mode。
- `tool-bash` 保留是为了 office skill 的转换命令；审查工具本身不需要 shell。

### 3.3 客户端声明（`package.json`）

```jsonc
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "platform": "web",
    "inject": [
      "@deepseek-ai/dsh-client-runtime",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-sidebar-right",
      "@deepseek-ai/dsh-client-ui-settings-plugins"
    ]
  }
},
"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }
```

## 4. 引擎数据模型（`src/engine/types.ts`）

```ts
interface Doc {
  hash: string                       // sha256(normalized source)
  title: string
  source: string                     // 原文
  blocks: Block[]                    // 顺序块
  headings: HeadingNode[]            // 树；每节点含 path '二/2.1/2.1.1' 与 range
  tables: TableBlock[]               // header[], rows[][], range, sectionPath
  mermaid: MermaidBlock[]            // kind:'sequence'|'other', participants[], messages[], range
  stats: { bytes: number; headings: number; tables: number; mermaid: number; paragraphs: number }
}
type Range = { start: Offset; end: Offset }           // Offset = { line, column, offset }

interface Evidence {
  quote: string                      // 原文片段（≤ 300 字，≥ 8 字）
  sectionPath?: string
  range?: Range                      // 校验器给出；LLM 登记时由门禁回填
  kind: 'text' | 'table-cell' | 'mermaid' | 'heading' | 'absence'
}
// kind='absence'：章节/表格/图缺失时的证据，quote 为「缺失：<期望标题>」，range 指向应出现的位置（父章节末尾）

interface Issue {
  issueId: string; reviewId: string; ruleId?: string
  severity: 'blocker' | 'major' | 'minor'
  tier: 'hard' | 'hybrid' | 'soft' | 'expert'
  origin: 'verifier' | 'llm' | 'expert'
  finding: string; suggestion: string
  evidence: Evidence[]
  status: 'confirmed' | 'pending' | 'rejected' | 'adopted' | 'rewritten'
  gate: { passed: boolean; reason?: GateReason }
  seq: number
}

type Verdict = '通过' | '建议整改' | '不通过'
```

## 5. 引擎流水线

```
source ──parse──▶ Doc ──check(rules)──▶ CheckReport { hardIssues, hybridCandidates, softRules, checklist }
                                   │
          agent 登记 ──record──▶ gate(doc, rule, evidence) ──▶ Issue(status)
                                   │
                         verdict(issues, cfg) ──▶ ai_verdict
                                   │
   expert decide ──▶ feedback ──finalize──▶ opinion.md + memory.aggregate(...)
```

- `parse`：`mdast-util-from-markdown` + `mdast-util-gfm`（表格）；Mermaid 代码块由 `parse/mermaid.ts` 识别 `sequenceDiagram`，抽取 `participant|actor` 与 `A->>B: text` 形式消息（支持 `->>`, `-->>`, `->`, `-->`, `-x`, `-)`）；其他图类型记 `kind:'other'`。
- `normalize(text)`：NFKC → 全角标点转半角 → 去 Markdown 强调符（`*`, `_`, `` ` ``）→ 连续空白折叠为单空格 → trim。门禁与词表匹配均在归一化文本上进行，并维护归一化偏移到原文偏移的映射以回填 `range`。
- `check(doc, rules, cfg)`：对每条 `active` 规则调用其 `verifier`（`rule-schema.md` §4），得到 `VerifierResult`；汇总为 `CheckReport`。`hard` 且 `fail` → 直接构造 Issue（`origin:'verifier'`, `status:'confirmed'`）；`hybrid` → `candidates[]`；`soft` → 规则摘要；`not-applicable` → 清单标注。
- `gate(doc, rule, evidence[])`（`rule-schema.md` §5）：返回 `{ passed, reason, resolved: Evidence[] }`。
- `verdict(issues, cfg)`（§6）。
- `memory.aggregate(feedback[], issues[])`：按规则号统计 adopt / reject / rewrite；`memory.trimExemplars(list, N)`；`memory.candidatesFrom(issues)`（`origin:'expert' && !ruleId`）。
- `render/opinion.ts`：`requirements.md` FR-31 模板。

## 6. 结论策略

```
confirmed(issues) = { i | i.status ∈ {confirmed, adopted, rewritten} ∧ i.tier ∈ {hard, hybrid, expert} }
ai_verdict:
  不通过   若 ∃ i ∈ confirmed: severity = blocker
  建议整改 若 ∃ i ∈ confirmed: severity = major
          或 |{ i ∈ confirmed: severity = minor }| ≥ cfg.minorThreshold
  通过     否则
```

- 预审阶段（无专家决定）只看 `confirmed`；复核后 `rejected` 不计、`adopted/rewritten` 计入、专家 `add` 的 `expert` 问题计入。
- `soft` 与 `pending` 永不计入。
- 推荐给专家的最终结论 = 复核后重新计算的 `ai_verdict`；专家可改任何值，差异记录在 `reviews.verdictDelta`。

## 7. 存储域

```ts
export const reviewDomain = defineDomain({
  name: 'wsgw_solution_review',
  version: 1,
  tables: {
    reviews:         domainTable(reviewSchema),
    issues:          domainTable(issueSchema),
    feedback:        domainTable(feedbackSchema),
    exemplars:       domainTable(exemplarSchema),
    rule_overrides:  domainTable(ruleOverrideSchema),
    rule_candidates: domainTable(ruleCandidateSchema),
    eval_runs:       domainTable(evalRunSchema),
  },
})
```

| 表 | key | 主要字段 | 写入者 |
|---|---|---|---|
| `reviews` | `reviewId`（`rv_<yyyymmdd>_<base32-6>`） | `title, docHash, sourcePath?, reviewer?, sessionId?, status('open'|'finalized'), aiVerdict, aiVerdictAtFinalize, finalVerdict?, verdictDelta?, opinionPath?, versions[], metrics{startedAt, finalizedAt?, toolCalls, gateRejects}, createdAt` | parse / status / decide / finalize |
| `issues` | `${reviewId}#${seq}` | §4 `Issue` 全字段 | check（hard）/ record_issue / decide(add) |
| `feedback` | `${issueId}#${n}` | `reviewId, issueId, action('adopt'|'reject'|'rewrite'), reason?, text?, reviewer?, at` | decide |
| `exemplars` | `${ruleId}#${issueId}` | `ruleId, kind('adopt'|'rewrite'), text, reviewId, at` | finalize |
| `rule_overrides` | `ruleId` | `status?, severity?, params?, stats{adopt, reject, rewrite, shown}, audit[{who, at, reviewId?, change}]` | rules_propose / finalize |
| `rule_candidates` | `rc_${reviewId}_${n}` | `text, suggestedDimension?, draft?(RuleYaml), status('new'|'drafted'|'accepted'|'dismissed'), reviewId, at` | finalize / rules_propose |
| `eval_runs` | `runId` | `config, dataset, metrics, perRule[], perSolution[], at` | 评测脚本（S5） |

- 无二级索引：按 `reviewId` 过滤用 `entries()` 快照内存筛选；数据量（百级审查、千级问题）下足够。
- 版本策略：schema 变更 → `version+1` + `scripts/migrate-domain.mjs`（S3b 起随包）；DSH 拒绝打开不匹配版本，迁移脚本在启动前由用户手动执行。
- `sessionId` 来自工具执行时的 agent 上下文（若可取），用于看板「回到对话」链接；取不到留空。

## 8. 工具契约

公共约定：参数用 `defineTool` schema 校验；`output.schema` 声明；错误用带 `code` 的 `HarnessError` 子类 `ReviewToolError`（`REVIEW_NOT_FOUND`, `SOURCE_TOO_LARGE`, `RULE_NOT_FOUND`, `HARD_RULE_VERIFIER_OWNED`, `VERDICT_NOT_SET`, `FINAL_VERDICT_FORBIDDEN`, `REVIEWER_REQUIRED`, `ISSUE_NOT_FOUND`, `BAD_ACTION`）。所有工具描述里写明「本工具只记录建议；最终结论由专家在复核中确认」。

| 工具 | 参数 | 返回 | 关键行为 |
|---|---|---|---|
| `review_parse` | `source: { kind:'inline'|'path', value }`, `title?`, `reuse?: boolean` | `{ reviewId, title, outline[], stats, warnings[], existingReviewId? }` | 读文件经 `ctx.fs`；超限 `SOURCE_TOO_LARGE`；同哈希且 `reuse` 未指定 → 返回 `existingReviewId` 并提示 |
| `review_check` | `reviewId` | `{ hardIssues[], hybridCandidates[{ruleId, title, severity, snippets[{quote, sectionPath}]}], softRules[{ruleId, title, question}], checklist[], aiVerdict }` | hard 问题落 `issues`；更新 `reviews.aiVerdict` |
| `review_record_issue` | `reviewId, ruleId?, severity?, finding, suggestion, evidence[{quote, sectionPath?}]` | `{ issueId, status, gate:{passed, reason}, resolvedEvidence[] }` | `ruleId` 缺省 → `tier:'soft'`（pending）；severity 缺省取规则值；门禁 §5 |
| `review_status` | `reviewId` | `{ aiVerdict, summary, issues[], checklist[], counts }` | 三层输出的结构化来源；不写库 |
| `review_decide` | `reviewId, action('adopt'|'reject'|'rewrite'|'add'|'adopt_rest'|'set_reviewer'|'set_final_verdict'), issueId?, text?, reason?, ruleId?, severity?, finalVerdict?, reviewer?` | `{ ok, issue?, aiVerdict, finalVerdict? }` | 写 `feedback` 与 `issues.status`；`add` 新建 `origin:'expert'`；`set_reviewer` 写 `reviews.reviewer`；`set_final_verdict` 唯一写 `finalVerdict` 的入口，要求 `reviewer` 已知（或配置了 `defaultReviewer`） |
| `review_finalize` | `reviewId, present?: boolean` | `{ opinionPath, version, counts, memory:{exemplars, candidates} }` | 无 `finalVerdict` → `VERDICT_NOT_SET`；渲染 → 写文件（`ctx.fs`）→ 更新 reviews → 刷新记忆；`present` 由 agent 随后调用 `present` 工具完成（本工具只返回路径） |
| `rules_list` | `dimension?, tier?, status?` | `{ rules[{ruleId, title, dimension, tier, severity, status, stats}] }` | 合并 shipped + overrides |
| `rules_propose` | `action('disable'|'enable'|'set_severity'|'set_param'|'draft'|'accept_draft'|'dismiss')`, `ruleId?`, `severity?`, `param?`, `candidateId?`, `draft?(RuleYaml)` | `{ ok, rule?, candidate? }` | 写 `rule_overrides` / `rule_candidates`；`draft` 由 agent 填 YAML，工具用 schema 校验 |
| `memory_recall` | `ruleId` 或 `dimension` | `{ stats{adopt,reject,rewrite,shown,rejectRatio}, warn: boolean, exemplars[], recentRejectReasons[] }` | `warn = rejectRatio ≥ cfg.rejectWarnRatio && shown ≥ cfg.rejectWarnMinSamples` |

## 9. 命令（host 侧，不经模型）

| 命令 | 输入 | 输出（`CommandResult.text`） |
|---|---|---|
| `/review` | 空 或 `<reviewId>` | 本会话（或全部）审查记录列表：id / 标题 / aiVerdict / finalVerdict / 状态；带 id 时输出该记录的三层摘要 |
| `/rules` | 空 或 `<dimension|tier>` | 生效规则表（id / tier / severity / status / 采纳率） |
| `/memory` | `<ruleId>` | 该规则统计 + 最近 5 条范例 + 最近 3 条驳回原因 |

## 10. HTTP 路由（看板读 + 受限写）

前缀 `/plugins/wsgw-solution-review/api`，`Content-Type: application/json`。`GET` 读；`POST` / `PATCH` 写。所有路由校验 `Origin`/`Host` 同源（跨源 403），写路由沿用 DSH Web 鉴权（未授权 401），并记录审计（who / when / reviewId）。

| 路由 | 返回 |
|---|---|
| `/rules` | `rules_list` 同构 + 每条规则的 `stats` |
| `/reviews?limit&offset&status` | 列表 |
| `/reviews/:id`（prefix 路由） | 记录 + issues + feedback + 正式意见文本 |
| `/memory` | 按规则号聚合：stats、范例数、候选规则、趋势序列（按审查序号的 adopt 率） |
| `/eval` | `eval_runs` 列表与最新一轮明细 |

写路由：

| 路由 | 请求 | 行为 |
|---|---|---|
| `PATCH /rules/:id` | `{status?, severity?, params?}` | 写 `rule_overrides`；`params` 仅白名单；审计 |
| `POST /rule-candidates/:id` | `{action:'accept'|'dismiss'}` | 审批候选；等价 `rules_propose` |
| `POST /reviews/:id/issues/:issueId` | `{action:'adopt'|'reject'|'rewrite', text?, reason?}` | 写 `feedback` 与 `issues.status`；等价 `review_decide` |
| `POST /reviews/:id/reviewer` | `{reviewer}` | 写 `reviews.reviewer` |
| `POST /reviews/:id/final-verdict` | `{finalVerdict, reviewer?}` | 唯一看板写最终结论入口；要求 reviewer 已知 |

所有写操作走 `ReviewStore` 的同一方法，不复制业务逻辑；写后返回最新聚合。删除记录、直接编辑正式意见正文不开放。

鉴权沿用 DSH Web 本身（路由在同一 `node:http` 载体后面，受同一访问控制）；本包不新增凭证。局域网开放时建议在 DSH 层配置 TLS 与访问令牌（S3c 验证并写入 README）。细粒度权限（只读 / 审批人 / 规则管理员）后置。

## 11. 配置与设置

`Config`（schemastery）字段即 §3.2 的 `config`；每个字段有 `.description()`。`installSettingsSection('wsgw-solution-review', …)` 暴露 `minorThreshold / askBatchSize / rejectWarnRatio / presentOnFinalize / defaultReviewer / outputDir`，Client 设置卡片用 `ctx.settingsScope.bind` 读写，改动即时生效（下一次工具调用读取）。`rulesDir`、`maxSourceBytes` 只在 YAML 配置。

## 12. 错误与降级

| 情况 | 行为 |
|---|---|
| 规则 YAML 校验失败 | 启动时拒绝加载该规则包并记录错误；其余规则正常；`/rules` 显示加载错误 |
| storage 后端不可用 | 插件初始化失败（显式），不静默降级到内存 |
| 证据门禁失败 | 问题 `pending`，返回 `reason` 让 agent 可修正引文后重试（最多由 skill 约定重试 1 次） |
| 模型给出非法 ruleId | `RULE_NOT_FOUND`，提示用 `rules_list` |
| 复核中途退出 | `reviews.status` 保持 `open`；再次进入会话 `/review <id>` 可见；`review_decide` 可继续 |
| `ask_user_question` 被取消 | agent 停止推进复核，提示专家稍后继续；不写任何决定 |
| finalize 文件写失败 | 不更新 `reviews`、不刷新记忆（先写文件后落库） |

## 13. 安全

- 文件读取只经 `ctx.fs`（受 DSH 文件系统策略），不直接 `node:fs` 读用户路径；输出目录在工作目录内（绝对路径需在配置显式允许）。
- 路由同源校验；写路由需 DSH 鉴权并写审计；删除记录与正文编辑不开放。
- 日志不输出方案全文与证据原文（只输出 reviewId / ruleId / 长度）。
- 不收集、不上传任何数据；评测脚本只在本机运行。

## 14. 测试策略映射

| 目录 | 类型 | 覆盖 |
|---|---|---|
| `tests/fixtures/` | 数据 | 种子方案 `seed.md`；变体 `seed-no-impl.md`（删 2.3）、`seed-no-scale.md`（资源评估「无需扩容」）、`seed-img-seq.md`（时序图图片）、`seed-mermaid-ok.md`（含合规 Mermaid）、`seed-placeholder-table.md`、`seed-missing-attachment.md`；规则样例 `rules.sample.yaml`；预期 `expected/*.json` |
| `tests/engine/*.spec.ts` | 单元 | parse、normalize、6 校验器、check、gate、verdict、memory、render |
| `tests/store/*.spec.ts` | 契约 | domain spec zod 校验、键方案、版本常量 |
| `tests/tools/*.spec.ts` | 契约 | 每个工具的参数 schema、错误码、对 store 的写入（用内存版 `ReviewStore` 替身） |
| `tests/protocol/*.e2e.ts` | 回放 | `dsh-llm-mock-server` 脚本化模型输出，跑完「预审 → 复核 → 定稿」，断言落库与文件 |
| `tests/client/check-bundle.mjs` | 离线 | `lib/client.js` banner/footer/externals |
| `tests/bench/check.bench.ts` | 性能 | 200 KB 文档 `check` ≤ 2 s |

## 15. 测试要点（供 S2）

| ID | 要点 |
|---|---|
| T-DES-01 | `parse` 对种子方案给出的 headings path 与 range 正确（抽查「二/2.1/2.1.1」范围覆盖鉴权段） |
| T-DES-02 | `normalize` 幂等；全角→半角；强调符去除；偏移映射能把归一化命中回填为原文 range |
| T-DES-03 | `mermaid` 解析 6 种箭头、`participant`/`actor` 别名、忽略 `Note`/`loop` 行不报错 |
| T-DES-04 | `check` 输出的 checklist 覆盖全部 active 规则，状态枚举完整 |
| T-DES-05 | `verdict` 边界：1 blocker→不通过；1 major→建议整改；minor=threshold→建议整改；minor=threshold-1→通过；rejected 不计 |
| T-DES-06 | `gate` 回填 range 并把 `sectionPath` 修正为实际命中章节 |
| T-DES-07 | domain spec：非法记录被 zod 拒绝；键格式正则 |
| T-DES-08 | `review_decide(set_final_verdict)` 是唯一能改 `finalVerdict` 的路径；其他工具尝试写入抛 `FINAL_VERDICT_FORBIDDEN` |
| T-DES-09 | `review_finalize` 先写文件后落库；文件写失败时库无变化 |
| T-DES-10 | `rules_list` 合并：override 的 `status/severity` 覆盖 shipped；shipped 文件内容不变 |
| T-DES-11 | 路由：非 GET 405、跨源 403、未知 id 404、JSON 结构快照 |
| T-DES-12 | `--dump-config` 能组装 `cordis.patch.yml`（含 preset 行）且无撞名 |
| T-DES-13 | client bundle 校验脚本：banner / footer / 外部化白名单 / 不含 `react` 实体 |
| T-DES-14 | bench：200 KB 合成文档 `check` ≤ 2 s |
