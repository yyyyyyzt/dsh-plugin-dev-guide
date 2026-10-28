# wsgw-solution-review 设计说明 V1.0

> 状态：S1 定稿候选（2026-10-19）；2026-10-27 按 `dsh-v0.2.1-rc.2` 源码逐项复核 §2、§3、§8、§10、§11、§14（client 注册、设置面、路由清单与 S4 实现对齐）。实现以本文为准；需求编号引用 `requirements.md`，规则细节见 `rule-schema.md`，对话细节见 `review-protocol.md`。
> DSH 基线 `dsh-v0.2.1-rc.2`；API 名称以其源码与 `docs/subsystems/*.zh.md` 为准（两者冲突时以源码为准，例如 sidebar tab 的 `guide` 在源码中是数组）。

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
│  ├─ store/domain.ts           defineDomain spec（表、键、zod 记录）
│  ├─ host/
│  │  ├─ store.ts               ReviewStore 服务（ctx.solutionReview）：唯一写入口
│  │  ├─ config.ts              schemastery Config
│  │  ├─ commands.ts            /review /rules /memory
│  │  ├─ api.ts                 看板 HTTP 路由（读 + 受限写；只在 webServer + connection 存在时挂载）
│  │  ├─ skills.ts              SkillProvider（随包 SKILL.md）
│  │  └─ rules-loader.ts / errors.ts / service.ts
│  └─ client/
│     ├─ index.tsx              注册：左侧栏面板行 + main 主面板 + 右侧栏复核助手（dashboard.md §2）
│     ├─ pages.tsx              主面板外框与页签、复核助手（AssistantView 纯展示 + ReviewAssistant 取数）
│     ├─ overview.tsx / rules.tsx / review-detail.tsx / eval.tsx
│     │                         每页一对：纯展示组件（props 进、元素出；测试用 react-dom/server 渲染）+ 页签容器（取数、写操作）
│     ├─ ui.tsx / data.ts       主题样式与基础件；取数 / 写操作 hooks
│     └─ model.ts               看板数据类型（引用 host / 引擎类型）、纯函数（日历、趋势、指标、筛选）、请求封装
├─ scripts/release.mjs          GitHub 发布 tag（§16）
├─ tests/                       S2（见 §14）
└─ docs/                        本目录
```

## 3. 组合方式

### 3.1 插件入口与服务

| 入口 | 导出 | `inject` | 注册 |
|---|---|---|---|
| `wsgw-solution-review`（`src/index.ts`） | `name`, `Config`, `apply` | `storageDomain`, `commands`, `skills`；可选 `webServer` + `connection`（`ctx.inject` 子作用域挂 `api.ts`，headless 与单测不需要） | 服务 `ctx.solutionReview`（`ReviewStore`）、命令 ×3、SkillProvider、看板路由（§10） |
| `wsgw-solution-review/tools`（`src/tools.ts`） | `name`, `apply` | `tools`, `solutionReview`, `workingDirectory`, `fs` | 9 个工具（§8）；挂在 preset 内，因此只有审查 agent 可见 |
| client（`exports["./client"]` → `lib/client.js`，源 `src/client/index.tsx`） | `name`, `inject = ['slots','sidebarRightTabs','layout']` | — | `sidebar.panellist` 面板行 + 同 id 的 `main` keyed 主面板；右侧栏 tab 定义（`ctx.sidebarRightTabs.register`）+ `sidebar.right.pane.tab` keyed 正文（`dashboard.md` §2） |

`ReviewStore` 用 `ctx.provide('solutionReview', …)`（Cordis 服务注册）暴露给 tools 子插件、命令与路由；它是唯一持有 domain 句柄的对象。

### 3.2 `cordis.patch.yml`

bundle 层只有两行，原文以仓库内 `cordis.patch.yml` 为准（本节不复制 YAML，避免两份事实来源）：

| 行 | 内容 |
|---|---|
| `wsgw-solution-review` | host 插件，`config` 为 §11 的全部字段默认值 |
| `preset-wsgw-solution-review` | `@deepseek-ai/dsh-agent-preset`，id `wsgw-solution-review`、名称「方案审查」；子行：persona（文本内联）、time-context、tool-bash / tool-pwsh（按平台二选一）、tool-fs、tool-fs-search、skill-filesystem、tool-skill、tool-ask-user、tool-todo（`allowParallelInProgress: false`）、present、压缩组（compaction-basic、command-compact、tool-result-pruner）、`wsgw-solution-review/tools`（置末） |

说明：

- preset 行与 Web profile 自带的 `preset-standard` 并列；`agent-preset-registry` 的 `default` 不改，用户在会话里选择「方案审查」。
- persona 文本内联在 YAML 块标量里：0.2.1 的 `!!js` 表达式环境只暴露 `process` / `ctx`，不能 `require`；`src/persona.ts` 保留同一份文本，`tests/host/bundle.spec.ts` 断言两处逐字一致。
- 不挂 `agent-instructions`（审查会话不应读取工作目录的 AGENTS.md）、`tool-web`、subagent、plan-mode；不挂 `dsh-skill-office`（不是 base / web-app 的依赖，需要 Word 转换时由用户另装，见 `review-protocol.md` §1）。
- `tool-bash` 保留是为了 office skill 的转换命令；审查工具本身不需要 shell。

### 3.3 客户端声明（`package.json`）

```jsonc
"exports": { "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" } },
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-sidebar", "@deepseek-ai/dsh-client-ui-sidebar-right"] }
},
"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }
```

- `dsh-client-modules` 扫描 host Loader 已加载的包，凡声明 `dsh.client` 且 `exports["./client"]` 指向已构建 bundle 的，成为一条 client entry（entry id = 包名），由 `/plugins/??wsgw-solution-review/client.js&rev=…` 提供。
- `dsh.client.inject` 只决定**脚本到达顺序**（列出的包若不在启动图中会被跳过）；服务等待由 client 插件自身的 Cordis `inject = ['slots','sidebarRightTabs','layout']` 负责。
- bundle 形态：CJS 闭包工厂，banner `window.__ModuleLoader__.load({ id: "wsgw-solution-review", factory: (require) => {`，footer `return module.exports; } });`，与 DSH `packages/client/tsdown.client.ts` 预设一致；`react` 外部化（平台种子表提供），其余依赖内联。

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
| `reviews` | `reviewId`（`rv_<yyyymmdd>_<base32-6>`） | `title, docHash, contentKey?, sourcePath?, reviewer?, sessionId?, status('open'|'finalized'|'superseded'|'discarded'), supersededBy?, closedAt?, closedReason?, aiVerdict, aiVerdictAtFinalize, finalVerdict?, verdictDelta?, opinionPath?, versions[], metrics{startedAt, finalizedAt?, toolCalls, gateRejects}, createdAt` | parse / status / decide / finalize |
| `issues` | `${reviewId}#${seq}` | §4 `Issue` 全字段 + `severityFrom?`（专家对这一条调过级别时的原级别） | check（hard）/ record_issue / decide(add / 带 severity 的 adopt、rewrite) |
| `feedback` | `${issueId}#${n}` | `reviewId, issueId, action('adopt'|'reject'|'rewrite'), reason?, text?, reviewer?, at` | decide |
| `exemplars` | `${ruleId}#${issueId}` | `ruleId, kind('adopt'|'rewrite'), text, reviewId, at` | finalize |
| `rule_overrides` | `ruleId` | `status?, severity?, params?, stats{adopt, reject, rewrite, shown}, audit[{who, at, reviewId?, change}]` | rules_propose / finalize |
| `rule_candidates` | `rc_${reviewId}_${n}` | `text, suggestedDimension?, draft?(RuleYaml), status('new'|'drafted'|'accepted'|'dismissed'), reviewId, at` | finalize / rules_propose |
| `eval_runs` | `runId` | `config, dataset, metrics, perRule[], perSolution[], at` | 评测脚本（S5） |

- 无二级索引：按 `reviewId` 过滤用 `entries()` 快照内存筛选；数据量（百级审查、千级问题）下足够。
- 版本策略：schema 变更 → `version+1` + `scripts/migrate-domain.mjs`（S3b 起随包）；DSH 拒绝打开不匹配版本，迁移脚本在启动前由用户手动执行。
- `rule_overrides` 一行可以只有 `stats`（finalize 刷新统计时自动建行）。只有含 `status / severity / suggestion / params / draft` 之一的行才算**覆盖**：规则包版本号后缀 `+ovN` 的 N、`RuleView.overridden` 都只按这些行计算，避免「定稿一次规则包版本就变」。对 shipped 规则执行 `enable / disable / set_severity / set_suggestion` 时，若目标值等于 shipped 原值，则删除该覆盖字段而不是写入同值（审计照记），这样「改回去」就等于撤销覆盖；`reset` 一次删除 `status / severity / suggestion / params` 全部覆盖字段（每个被删字段记一条审计，`to` 为 shipped 值），统计与审计保留。草案规则没有 shipped 原值：不做同值比较，`reset` 返回 `BAD_ACTION`。
- `sessionId` 字段保留但当前不写（工具执行上下文取不到稳定的会话 id）；看板「回到对话」链接推迟。
- **同一方案只留一条进行中的记录**：
 - `contentKey` = 原文去 BOM、换行统一为 `\n`、去行尾空白、去首尾空行后的 sha256；旧记录没有该字段时按 `source` 现算。同一份方案无论粘贴还是给路径、Word 转换多出空白，都命中同一条。
 - 「同一方案」= `contentKey` 相同，或 `sourcePath` 相同，或标题相同（「未命名方案」除外）。
 - `review_parse` 新建记录后，把同一方案里**还在进行中且没有任何专家决定**的旧记录标为 `superseded`（`supersededBy` = 新 id，`closedReason` =「被 <新 id> 取代」）。有专家决定的进行中记录保留，由专家决定继续还是作废；已定稿记录是历史版本，保留。
 - 插件启动时对存量数据做一次同样的收拢（每组按创建时间，较旧的、进行中且无专家决定的记录被下一条较新的记录取代），用来清理本规则之前产生的重复记录。
 - `discarded` 由专家主动作废（对话 `review_decide(discard)` 或看板「作废」），`closedReason` 记原因。
 - `superseded` / `discarded` 统称**已关闭**：不再接受 check / record_issue / decide / finalize（`REVIEW_CLOSED`，提示取代它的记录），不进入看板指标、日历、趋势、复核助手与 `/review` 列表，不计入规则统计；数据保留，看板「已作废」筛选可查看。
- schema 只放宽枚举、新增可选字段，旧数据仍满足 schema，`version` 不变；回退到旧版插件前须没有已关闭记录（旧 schema 不认这两个状态）。

## 8. 工具契约

公共约定：参数用 `defineTool` schema 校验；`output.schema` 声明；错误用带 `code` 的 `HarnessError` 子类 `ReviewToolError`（`REVIEW_NOT_FOUND`, `REVIEW_ALREADY_DECIDED`, `SOURCE_TOO_LARGE`, `RULE_NOT_FOUND`, `HARD_RULE_VERIFIER_OWNED`, `VERDICT_NOT_SET`, `FINAL_VERDICT_FORBIDDEN`, `REVIEWER_REQUIRED`, `ISSUE_NOT_FOUND`, `CANDIDATE_NOT_FOUND`, `BAD_DRAFT`, `BAD_ACTION`, `REVIEW_CLOSED`）。所有工具描述里写明「本工具只记录建议；最终结论由专家在复核中确认」。工具的文字输出（结论依据、计数、问题行）用中文级别名「严重 / 一般 / 轻微」（= `blocker / major / minor`），参数枚举仍是英文值；agent 面向专家时只用中文级别名。

| 工具 | 参数 | 返回 | 关键行为 |
|---|---|---|---|
| `review_parse` | `source: { kind:'inline'|'path', value }`, `title?`, `reuse?: boolean` | `{ reviewId, title, outline[], stats, warnings[], existingReviewId?, superseded?[] }` | 读文件经 `ctx.fs`；超限 `SOURCE_TOO_LARGE`；同一份方案（`contentKey` 相同，§7）已有未关闭记录且 `reuse` 未指定 → 返回 `existingReviewId`，不新建；新建时把同一方案里进行中且无专家决定的旧记录标为 `superseded` 并在 `superseded[]` 返回 |
| `review_check` | `reviewId` | `{ hardIssues[], hybridCandidates[{ruleId, title, severity, snippets[{quote, sectionPath}]}], softRules[{ruleId, title, question}], checklist[], aiVerdict }` | hard 问题落 `issues`（重跑时先删旧的 verifier 问题再登记）；更新 `reviews.aiVerdict`；若该审查已有任何专家决定或已定稿 → `REVIEW_ALREADY_DECIDED`（重跑会抹掉已复核的 hard 问题），提示用 `review_parse(reuse:false)` 开新记录 |
| `review_record_issue` | `reviewId, ruleId?, severity?, finding, suggestion, evidence[{quote, sectionPath?}]` | `{ issueId, status, gate:{passed, reason}, resolvedEvidence[] }` | `ruleId` 缺省 → `tier:'soft'`（pending）；severity 缺省取规则值；门禁 §5 |
| `review_status` | `reviewId` | `{ aiVerdict, summary, issues[], checklist[], counts }` | 三层输出的结构化来源；不写库 |
| `review_decide` | `reviewId, action?('adopt'|'reject'|'rewrite'|'add'|'adopt_rest'|'set_reviewer'|'set_final_verdict'|'discard'), answer?, issueId?, text?, reason?, ruleId?, severity?, finalVerdict?, reviewer?` | `{ ok, issue?, affected?, remainingPending?, aiVerdict, finalVerdict? }` | 写 `feedback` 与 `issues.status`；`add` 新建 `origin:'expert'`；`adopt` / `rewrite` 带 `severity` 时只改这一条问题的级别（原级别记 `severityFrom`），结论随之重算，不动规则；`set_reviewer` 写 `reviews.reviewer`；`set_final_verdict` 唯一写 `finalVerdict` 的入口，要求 `reviewer` 已知（或配置了 `defaultReviewer`）；`discard` 作废整条审查（`reason` 记入 `closedReason`）。已关闭记录上任何 action → `REVIEW_CLOSED`。细则见下 |
| `review_finalize` | `reviewId, present?: boolean` | `{ opinionPath, version, counts, memory:{exemplars, candidates} }` | 无 `finalVerdict` → `VERDICT_NOT_SET`；渲染 → 写文件（`ctx.fs`）→ 更新 reviews → 刷新记忆；`present` 由 agent 随后调用 `present` 工具完成（本工具只返回路径） |
| `rules_list` | `dimension?, tier?, status?` | `{ rules[{ruleId, title, dimension, tier, severity, status, stats}] }` | 合并 shipped + overrides |
| `rules_propose` | `action('disable'|'enable'|'set_severity'|'set_suggestion'|'set_param'|'reset'|'draft'|'accept_draft'|'dismiss')`, `ruleId?`, `severity?`, `suggestion?`, `param?`, `candidateId?`, `draft?(RuleYaml)` | `{ ok, rule?, candidate? }` | 写 `rule_overrides` / `rule_candidates`；`set_suggestion` 要求去空白后 1–500 字（否则 `BAD_ACTION`）；`reset` 恢复 shipped 值（§7）；`draft` 由 agent 填 YAML，工具用 schema 校验 |
| `memory_recall` | `ruleId` 或 `dimension` | `{ stats{adopt,reject,rewrite,shown,rejectRatio}, warn: boolean, exemplars[], recentRejectReasons[] }` | `warn = rejectRatio ≥ cfg.rejectWarnRatio && shown ≥ cfg.rejectWarnMinSamples` |

`review_decide` 细则：

- **answer 归一化**（只传 `answer` 不传 `action` 时，`normalizeAnswer`）：去掉末尾「（推荐）」后——
 - 以「改成 / 改为 / 换成 / 写成 / 建议写成 / 建议改为 / 措辞换成 / 换个说法」加冒号开头（前面可带「我」）→ `rewrite`，冒号后为改写文；
 - 恰为「是 / 是的 / 对 / 通过」，或以「要改 / 是问题 / 确认为问题 / 采纳 / 同意」开头并紧跟标点或结束 → `adopt`；标点后（去掉「但是 / 但 / 不过」）若是改写前缀，如「要改，但我换个说法：…」，按 `rewrite` 处理；若只是「我换个说法 / 换个说法 / 改写 / 自己写」而没有内容 → 返回不带 text 的 `rewrite`，`decide` 报 `BAD_ACTION`（提示 agent 追问「您想怎么写」），不写库；
 - 恰为「否」，或以「不用改 / 不是问题 / 不算问题 / 驳回 / 不对 / 不成立 / 不需要」开头并紧跟标点或结束 → `reject`，标点后的文字作为 `reason`（显式 `reason` 优先）；
 - 级别短语「算 / 按 / 降为 / 降成 / 降到 / 改为 / 调为 / 定为 / 升为 / 升到 + 严重 | 一般 | 轻微 | blocker | major | minor」：整句只有它（可带「后采纳 / 再采纳 / 采纳」），或出现在 `adopt` 引导词后的标点之后 → `adopt` + `severity`（显式 `severity` 优先）；
 - 恰为「改写 / 换个说法 / 我换个说法」→ 同上，不带 text 的 `rewrite`；
 - 引导词后不是标点（如「不对外开放…」「对接口…」）不算命中；
 - 其余整段文字 → `rewrite`。
- **单条调级别**：`adopt` / `rewrite` 带 `severity`（显式或归一化得到）且与当前级别不同 → 改该问题 `severity`，首次调整时把原级别记入 `severityFrom`；调回原级别时删除 `severityFrom`。`aiVerdict` 随之重算；`rule_overrides` 不变（改规则要专家明说「以后 / 这类」，走 `rules_propose(set_severity)`）。
- **`adopt_rest`** 只把状态为 `confirmed` 的问题批量采纳；`pending`（门禁未过或 soft）不批量处理，返回 `remainingPending[]` 让 agent 逐条请专家确认——「待人工」的含义就是要人看过。
- **定稿后再修改**：已 `finalized` 的审查上任何改动问题、审核人或最终结论的 `decide` 都会把 `reviews.status` 改回 `open`；正式意见文件不动，需再次 `review_finalize` 生成 v2。看板据此显示「需重新定稿」。

## 9. 命令（host 侧，不经模型）

| 命令 | 输入 | 输出（`CommandResult.text`） |
|---|---|---|
| `/review` | 空 或 `<reviewId>` | 未关闭的审查记录列表：id / 标题 / aiVerdict / finalVerdict / 状态；带 id 时输出该记录的三层摘要（已关闭记录也可按 id 查看） |
| `/rules` | 空 或 `<dimension|tier>` | 生效规则表（id / 判定方式 / 级别（中文）/ status / 采纳率） |
| `/memory` | `<ruleId>` | 该规则统计 + 最近 5 条范例 + 最近 3 条驳回原因 |

## 10. HTTP 路由（看板读 + 受限写）

前缀 `/plugins/wsgw-solution-review/api`，由 `ctx.webServer.register` 注册（`exact` / `prefix` 两种；DSH 先查精确表、再取最长前缀，前缀 `p` 只匹配 `p` 与 `p/…`，所以路径**不带尾部斜杠**——`prefix …/rules` 承接 `/rules/:id`，`exact …/rules` 优先承接列表；未命中会落到 DSH 自己的 `/plugins` 资源路由，表现为 404 / 405），`Content-Type: application/json`。每个请求先过 `ctx.connection.requestRejection(req)`（DSH Web 自身的访问令牌 / 局域网围栏，返回 401 / 403 时原样回绝），再校验 `Origin` 与 `Host` 同源（跨源 403）。本包不新增凭证、会话或路由框架。写请求体上限 64 KiB，必须 `application/json`（否则 415）。`ReviewToolError` 映射为 404（`*_NOT_FOUND`）或 400，其余 500。

读路由：

| 路由 | 返回 |
|---|---|
| `GET /rules` | `{ rules: RuleView[], warnings, loadErrors, version }` |
| `GET /rules/:id` | `{ rule: RuleView, detail: { question, rationale, suggestion, applicability, verifier, provenance, shipped?:{severity,status,suggestion}, override?:{status?,severity?,suggestion?,params?}, audit[最近 10 条], memory: memory_recall 结果 } }` |
| `GET /overview` | `{ items: ReviewStamp[], total, truncated, generatedAt }`：全部审查的紧凑摘要（按创建时间倒序，最多 2000 条，超出时 `truncated: true`），供主面板指标卡、日历 / 趋势与方案列表、复核助手使用。`ReviewStamp = { reviewId, title, createdAt, finalizedAt?, state:'open'|'finalized'|'stale'|'closed', aiVerdict, aiVerdictAtFinalize?, finalVerdict?, reviewer?, closedReason?, counts:{total,confirmed,pending,adopted,rejected,rewritten} }`；`stale` = `status=open` 且已有正式意见版本；`closed` = `superseded` 或 `discarded`（§7），客户端默认不展示、不计数。日期分桶由浏览器按本地时区做（`dashboard.md` §5） |
| `GET /reviews?page=N` | `{ items[review + counts], page, total }`，每页 50 条，按创建时间倒序（保留给脚本与旧客户端；主面板用 `/overview`） |
| `GET /reviews/:id` | `{ review, issues, checklist, checklistCounts, counts, basis, summary, feedback }`；不含正式意见正文（只给 `opinionPath` 与 `versions[]`，正文在文件里） |
| `GET /memory` | `{ rules[有记录的规则：stats, warn, exemplars, recentRejectReasons, series(最近 5 次定稿)], candidates[], totals }` |
| `GET /eval-runs[?ids=a,b]` | `{ runs[] }`；带 `ids` 时要求 2–7 个且全部存在（400 / 404） |

写路由（全部调用 `ReviewStore` 与工具相同的方法，审计 `who:'dashboard'`）：

| 路由 | 请求 | 等价 |
|---|---|---|
| `PATCH /rules/:id` | `{action:'disable'|'enable'|'set_severity'|'set_suggestion'|'set_param'|'reset', severity?, suggestion?, param?:{key,value}}` | `rules_propose`；`param.key` 仅白名单（§4.3 参数），越界返回 warnings；`set_suggestion` 缺字符串 → 400 `BAD_SUGGESTION`；`reset` 对草案规则 → 400 `BAD_ACTION` |
| `POST /candidates/:id` | `{action:'accept_draft'|'dismiss'|'draft', draft?}` | `rules_propose`；`accept_draft` 取候选的 `draftRuleId`，候选尚未起草 → 400 `BAD_ACTION` |
| `POST /reviews/:id/issues/:issueId` | `{action:'adopt'|'reject'|'rewrite', text?, reason?}` | `review_decide` |
| `POST /reviews/:id/reviewer` | `{reviewer}` | `review_decide(set_reviewer)` |
| `POST /reviews/:id/final-verdict` | `{finalVerdict}` | `review_decide(set_final_verdict)`，要求审核人已知 |
| `POST /reviews/:id/discard` | `{reason?}` | `review_decide(discard)`；已关闭 → 400 `REVIEW_CLOSED` |

`GET /reviews/:id` 的 `review` 含 `status`、`supersededBy?`、`closedAt?`、`closedReason?`，看板据此显示「已被 … 取代 / 已作废」。

不开放：物理删除记录（作废是保留数据的关闭）、编辑正式意见正文、看板内起草规则 YAML 或改规则的检查问题 / 依据 / 适用范围 / 校验器结构（起草留在对话里由 agent 完成，看板只审批）、看板内定稿（定稿要写文件并 `present`，留在对话）。定稿后在看板改动任何决定 → 记录回到 `open`（§8），看板提示回对话重新 `review_finalize`。

细粒度权限（只读 / 审批人 / 规则管理员）与 CSRF token 后置：同源 + DSH 连接围栏已挡住跨站与未授权来源；局域网多人使用时再加。

## 11. 配置

`Config`（schemastery）字段即 §3.2 的 `config` 行，每个字段有 `.description()`。改配置 = 改 profile 中本插件那一行的 `config`（`cordis.patch.yml` 或用户补丁），由 DSH 重新加载插件后生效。

0.2.1 的设置面板没有为第三方插件自动生成表单的通用入口（官方页面各自注册 `plugins.item` 卡片），而 §2.3 / AGENTS 铁律 6 要求「能配置解决就不新做」，所以**设置卡片推迟**：阈值类参数调整频率低，YAML 足够；需要时再按 `plugins.item` + `configForms` 接入。原 `dashboardPollSeconds` 删除——看板只在打开与手动刷新时拉取。

## 12. 错误与降级

| 情况 | 行为 |
|---|---|
| 规则 YAML 校验失败 | 启动时拒绝加载该规则包并记录错误；其余规则正常；`/rules` 显示加载错误 |
| storage 后端不可用 | 插件初始化失败（显式），不静默降级到内存 |
| 证据门禁失败 | 问题 `pending`，返回 `reason` 让 agent 可修正引文后重试（最多由 skill 约定重试 1 次） |
| 模型给出非法 ruleId | `RULE_NOT_FOUND`，提示用 `rules_list` |
| 复核中途退出 | `reviews.status` 保持 `open`；再次进入会话 `/review <id>` 可见；`review_decide` 可继续 |
| 复核开始后又要重跑 `review_check` | `REVIEW_ALREADY_DECIDED`；方案修改过就 `review_parse(reuse:false)` 开新记录 |
| 定稿后又改决定 | 记录回 `open`，旧意见文件保留；重新 `review_finalize` 产出新版本 |
| 同一方案被解析多次（粘贴 / 路径 / 重新转换 / 「重新开始」） | 内容相同 → 复用原记录；内容不同 → 新建，旧的进行中且无专家决定的记录自动「被取代」；有专家决定的旧记录保留，专家可作废（§7） |
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
| `tests/fixtures/` | 数据 | 种子方案 `seed.md` 及变体（`seed-compliant` / `seed-no-impl` / `seed-negated` / `seed-placeholder` / `seed-mermaid-ok` / `seed-mermaid-incomplete` / `seed-missing-attachment`）；规则样例 `rules/*.yaml`（1 合法 + 8 非法）；预期 `expected/*.json`、`expected/opinion-seed.md` |
| `tests/engine/**` | 单元 | parse、normalize、mermaid、6 种校验器与组合子、rules 加载、check、gate、verdict、memory、render |
| `tests/store/*` | 契约 | domain spec zod 校验、键方案、版本常量；`harness.ts` 为基于真实 `dsh-storage-json` 的临时目录存储 |
| `tests/tools/*` | 契约 | 9 个工具的参数、错误码与落库（真实 `ReviewStore` + 临时存储） |
| `tests/host/*` | 契约 | 插件装配：tools 插件、`/review` `/rules` `/memory` 命令、skill 注册、bundle 补丁与 persona 同源 |
| `tests/api/*` | 契约 | 路由：fake `webServer` / `connection` 注入后直接调 handler；鉴权、同源、405 / 404 / 415、写路由等价于工具 |
| `tests/protocol/*.e2e.ts` | 回放 | 脚本化 agent（固定工具调用序列 + 固定专家回答）跑完「预审 → 复核 → 定稿」，断言落库与正式意见快照。0.2.1 未随 npm 发布 `dsh-llm-mock-server`，因此不经真实 agent loop；真实对话由人工冒烟覆盖 |
| `tests/client/*.spec.ts(x)` | 单元 | 看板注册（面板行 / 主面板 / 右栏 tab）、纯函数（日历、趋势、指标、筛选、规则标记、对比约束、请求错误归一化）与 `react-dom/server` 渲染的主面板三页签 / 复核助手 / 复核组件 |
| `tests/client/check-bundle.mjs` | 离线 | `lib/client.js` banner / footer / 外部化白名单 / 未内联 React |
| `tests/bench/*` | 性能 | 200 KB 文档 `check` ≤ 2 s（`pnpm bench`） |

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
| T-DES-10 | `rules_list` 合并：override 的 `status/severity/suggestion` 覆盖 shipped；改回出厂值或 `reset` 即撤销覆盖；shipped 文件内容不变 |
| T-DES-11 | 路由：非 GET 405、跨源 403、未知 id 404、JSON 结构快照 |
| T-DES-12 | `--dump-config` 能组装 `cordis.patch.yml`（含 preset 行）且无撞名 |
| T-DES-13 | client bundle 校验脚本：banner / footer / 外部化白名单 / 不含 `react` 实体 |
| T-DES-14 | bench：200 KB 合成文档 `check` ≤ 2 s |
| T-DES-15 | 发布清单：去掉 `scripts`（含 `prepare`）与 `devDependencies`，保留 `dependencies` / `peerDependencies` / `engines` / `exports` / `files` / `dsh`，不改输入对象；`exports` 指向的文件都被 `files` 覆盖 |
| T-DES-16 | 发布 tag 名为 `wsgw-solution-review-v<version>`；安装地址由 `repository.url` 推出为 `https://github.com/<owner>/<repo>#<tag>` 与 `#<提交 sha>` 两种 |
| T-DES-17 | 同一方案：只差 BOM / CRLF / 行尾空白的原文复用同一条记录；同标题或同路径的新内容新建记录，旧的进行中且无决定的记录变 `superseded`，有决定的保留；启动收拢把存量重复记录收成一条 |
| T-DES-18 | 已关闭记录：check / record_issue / decide / finalize → `REVIEW_CLOSED`；`discard` 写 `closedReason`；不进 `/review` 列表与规则统计；`/overview` 中 `state='closed'` |
| T-DES-19 | `adopt` / `rewrite` 带 `severity`：只改该条问题级别并记 `severityFrom`，`aiVerdict` 重算，规则覆盖不变 |
| T-DES-20 | 工具文字输出与结论依据用「严重 / 一般 / 轻微」，不出现 blocker / major / minor |

## 16. 发布与安装

开发期仍用本地目录安装（`link:`，见 README）。给其他机器（含 Windows 桌面版）用的是 **GitHub 发布 tag**：

- `pnpm run release`（`scripts/release.mjs`）要求插件目录无未提交改动，然后构建、跑 bundle 校验、`pnpm pack`，把包内容（`lib/`、`rules/`、`skills/`、`cordis.patch.yml`、`README.md`、改写后的 `package.json`）写成一个**无父提交**的独立提交，打 tag `wsgw-solution-review-v<version>`；加 `--push` 推送该 tag。不建分支，不改当前分支与工作区。
- 发布清单去掉 `scripts` 与 `devDependencies`：没有 `prepare`，pnpm 从 git 安装时不触发构建，也就不需要在 profile 的 `allowBuilds` 里放行；运行时只从 npm 源拉 `dependencies`（纯 JS），DSH 相关包是 `peerDependencies`，由宿主提供（profile 的 `autoInstallPeers: false`）。
- 同一版本只发布一次：tag 已存在（本地或远端）即拒绝，先改 `package.json` 的 `version`。
- 安装地址填进 DSH 插件页（Web 或桌面版均可）或 `dsh plugin --profile <web|desktop> add <地址>`：
  - `https://github.com/yyyyyyzt/dsh-plugin-dev-guide#wsgw-solution-review-v<version>`：pnpm 用 `git ls-remote` 解析 tag，本机需要装有 git；
  - `https://github.com/yyyyyyzt/dsh-plugin-dev-guide#<40 位提交 sha>`：公开仓库直接下载 GitHub 归档，本机不需要 git。
- 版本门禁看 `engines.dsh`（§3.3）。桌面版 profile 只能由桌面版插件页或其自带 `dsh` 命令管理（npm 版 `dsh` 拒绝 `--profile desktop`）；命令行方式需先启动一次桌面版初始化 profile，再完全退出（Windows 关窗只是隐藏到托盘）。
- 升级：改版本号 → 提交 → `pnpm run release --push` → 在插件页卸载旧版再填新地址安装。审查记录、规则覆盖与记忆在 DSH 存储里，不随插件卸载丢失。
