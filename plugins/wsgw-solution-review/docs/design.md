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
│     ├─ index.tsx              sidebar-right tab 注册 + 四页容器（取数、写操作）
│     ├─ views.tsx              纯展示组件（props 进、元素出；测试用 react-dom/server 渲染）
│     └─ model.ts               看板数据类型（引用引擎类型）、纯函数、请求封装
├─ tests/                       S2（见 §14）
└─ docs/                        本目录
```

## 3. 组合方式

### 3.1 插件入口与服务

| 入口 | 导出 | `inject` | 注册 |
|---|---|---|---|
| `wsgw-solution-review`（`src/index.ts`） | `name`, `Config`, `apply` | `storageDomain`, `commands`, `skills`；可选 `webServer` + `connection`（`ctx.inject` 子作用域挂 `api.ts`，headless 与单测不需要） | 服务 `ctx.solutionReview`（`ReviewStore`）、命令 ×3、SkillProvider、看板路由（§10） |
| `wsgw-solution-review/tools`（`src/tools.ts`） | `name`, `apply` | `tools`, `solutionReview`, `workingDirectory`, `fs` | 9 个工具（§8）；挂在 preset 内，因此只有审查 agent 可见 |
| client（`exports["./client"]` → `lib/client.js`，源 `src/client/index.tsx`） | `name`, `inject = ['slots','sidebarRightTabs']` | — | tab 定义（`ctx.sidebarRightTabs.register`）+ `sidebar.right.pane.tab` keyed 正文 |

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
  "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-sidebar-right"] }
},
"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }
```

- `dsh-client-modules` 扫描 host Loader 已加载的包，凡声明 `dsh.client` 且 `exports["./client"]` 指向已构建 bundle 的，成为一条 client entry（entry id = 包名），由 `/plugins/??wsgw-solution-review/client.js&rev=…` 提供。
- `dsh.client.inject` 只决定**脚本到达顺序**（列出的包若不在启动图中会被跳过）；服务等待由 client 插件自身的 Cordis `inject = ['slots','sidebarRightTabs']` 负责。
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
| `reviews` | `reviewId`（`rv_<yyyymmdd>_<base32-6>`） | `title, docHash, sourcePath?, reviewer?, sessionId?, status('open'|'finalized'), aiVerdict, aiVerdictAtFinalize, finalVerdict?, verdictDelta?, opinionPath?, versions[], metrics{startedAt, finalizedAt?, toolCalls, gateRejects}, createdAt` | parse / status / decide / finalize |
| `issues` | `${reviewId}#${seq}` | §4 `Issue` 全字段 | check（hard）/ record_issue / decide(add) |
| `feedback` | `${issueId}#${n}` | `reviewId, issueId, action('adopt'|'reject'|'rewrite'), reason?, text?, reviewer?, at` | decide |
| `exemplars` | `${ruleId}#${issueId}` | `ruleId, kind('adopt'|'rewrite'), text, reviewId, at` | finalize |
| `rule_overrides` | `ruleId` | `status?, severity?, params?, stats{adopt, reject, rewrite, shown}, audit[{who, at, reviewId?, change}]` | rules_propose / finalize |
| `rule_candidates` | `rc_${reviewId}_${n}` | `text, suggestedDimension?, draft?(RuleYaml), status('new'|'drafted'|'accepted'|'dismissed'), reviewId, at` | finalize / rules_propose |
| `eval_runs` | `runId` | `config, dataset, metrics, perRule[], perSolution[], at` | 评测脚本（S5） |

- 无二级索引：按 `reviewId` 过滤用 `entries()` 快照内存筛选；数据量（百级审查、千级问题）下足够。
- 版本策略：schema 变更 → `version+1` + `scripts/migrate-domain.mjs`（S3b 起随包）；DSH 拒绝打开不匹配版本，迁移脚本在启动前由用户手动执行。
- `rule_overrides` 一行可以只有 `stats`（finalize 刷新统计时自动建行）。只有含 `status / severity / suggestion / params / draft` 之一的行才算**覆盖**：规则包版本号后缀 `+ovN` 的 N、`RuleView.overridden` 都只按这些行计算，避免「定稿一次规则包版本就变」。
- `sessionId` 字段保留但当前不写（工具执行上下文取不到稳定的会话 id）；看板「回到对话」链接推迟。

## 8. 工具契约

公共约定：参数用 `defineTool` schema 校验；`output.schema` 声明；错误用带 `code` 的 `HarnessError` 子类 `ReviewToolError`（`REVIEW_NOT_FOUND`, `REVIEW_ALREADY_DECIDED`, `SOURCE_TOO_LARGE`, `RULE_NOT_FOUND`, `HARD_RULE_VERIFIER_OWNED`, `VERDICT_NOT_SET`, `FINAL_VERDICT_FORBIDDEN`, `REVIEWER_REQUIRED`, `ISSUE_NOT_FOUND`, `CANDIDATE_NOT_FOUND`, `BAD_DRAFT`, `BAD_ACTION`）。所有工具描述里写明「本工具只记录建议；最终结论由专家在复核中确认」。

| 工具 | 参数 | 返回 | 关键行为 |
|---|---|---|---|
| `review_parse` | `source: { kind:'inline'|'path', value }`, `title?`, `reuse?: boolean` | `{ reviewId, title, outline[], stats, warnings[], existingReviewId? }` | 读文件经 `ctx.fs`；超限 `SOURCE_TOO_LARGE`；同哈希且 `reuse` 未指定 → 返回 `existingReviewId` 并提示 |
| `review_check` | `reviewId` | `{ hardIssues[], hybridCandidates[{ruleId, title, severity, snippets[{quote, sectionPath}]}], softRules[{ruleId, title, question}], checklist[], aiVerdict }` | hard 问题落 `issues`（重跑时先删旧的 verifier 问题再登记）；更新 `reviews.aiVerdict`；若该审查已有任何专家决定或已定稿 → `REVIEW_ALREADY_DECIDED`（重跑会抹掉已复核的 hard 问题），提示用 `review_parse(reuse:false)` 开新记录 |
| `review_record_issue` | `reviewId, ruleId?, severity?, finding, suggestion, evidence[{quote, sectionPath?}]` | `{ issueId, status, gate:{passed, reason}, resolvedEvidence[] }` | `ruleId` 缺省 → `tier:'soft'`（pending）；severity 缺省取规则值；门禁 §5 |
| `review_status` | `reviewId` | `{ aiVerdict, summary, issues[], checklist[], counts }` | 三层输出的结构化来源；不写库 |
| `review_decide` | `reviewId, action?('adopt'|'reject'|'rewrite'|'add'|'adopt_rest'|'set_reviewer'|'set_final_verdict'), answer?, issueId?, text?, reason?, ruleId?, severity?, finalVerdict?, reviewer?` | `{ ok, issue?, affected?, remainingPending?, aiVerdict, finalVerdict? }` | 写 `feedback` 与 `issues.status`；`add` 新建 `origin:'expert'`；`set_reviewer` 写 `reviews.reviewer`；`set_final_verdict` 唯一写 `finalVerdict` 的入口，要求 `reviewer` 已知（或配置了 `defaultReviewer`）。细则见下 |
| `review_finalize` | `reviewId, present?: boolean` | `{ opinionPath, version, counts, memory:{exemplars, candidates} }` | 无 `finalVerdict` → `VERDICT_NOT_SET`；渲染 → 写文件（`ctx.fs`）→ 更新 reviews → 刷新记忆；`present` 由 agent 随后调用 `present` 工具完成（本工具只返回路径） |
| `rules_list` | `dimension?, tier?, status?` | `{ rules[{ruleId, title, dimension, tier, severity, status, stats}] }` | 合并 shipped + overrides |
| `rules_propose` | `action('disable'|'enable'|'set_severity'|'set_param'|'draft'|'accept_draft'|'dismiss')`, `ruleId?`, `severity?`, `param?`, `candidateId?`, `draft?(RuleYaml)` | `{ ok, rule?, candidate? }` | 写 `rule_overrides` / `rule_candidates`；`draft` 由 agent 填 YAML，工具用 schema 校验 |
| `memory_recall` | `ruleId` 或 `dimension` | `{ stats{adopt,reject,rewrite,shown,rejectRatio}, warn: boolean, exemplars[], recentRejectReasons[] }` | `warn = rejectRatio ≥ cfg.rejectWarnRatio && shown ≥ cfg.rejectWarnMinSamples` |

`review_decide` 细则：

- **answer 归一化**（只传 `answer` 不传 `action` 时，`normalizeAnswer`）：去掉末尾「（推荐）」后——
 - 等于或以「采纳 / 同意 / 确认为问题 / 是 / 对」开头并紧跟标点或结束 → `adopt`；
 - 等于或以「驳回 / 不是问题 / 不对 / 不成立 / 不需要 / 否」开头并紧跟标点或结束 → `reject`，标点后的文字作为 `reason`（显式 `reason` 优先）；
 - 以「改成 / 改为 / 换成 / 写成 / 建议写成 / 建议改为 / 措辞换成 / 换个说法」加冒号开头 → `rewrite`，冒号后为改写文；
 - 其余整段文字 → `rewrite`。
- **`adopt_rest`** 只把状态为 `confirmed` 的问题批量采纳；`pending`（门禁未过或 soft）不批量处理，返回 `remainingPending[]` 让 agent 逐条请专家确认——「待人工」的含义就是要人看过。
- **定稿后再修改**：已 `finalized` 的审查上任何改动问题、审核人或最终结论的 `decide` 都会把 `reviews.status` 改回 `open`；正式意见文件不动，需再次 `review_finalize` 生成 v2。看板据此显示「需重新定稿」。

## 9. 命令（host 侧，不经模型）

| 命令 | 输入 | 输出（`CommandResult.text`） |
|---|---|---|
| `/review` | 空 或 `<reviewId>` | 本会话（或全部）审查记录列表：id / 标题 / aiVerdict / finalVerdict / 状态；带 id 时输出该记录的三层摘要 |
| `/rules` | 空 或 `<dimension|tier>` | 生效规则表（id / tier / severity / status / 采纳率） |
| `/memory` | `<ruleId>` | 该规则统计 + 最近 5 条范例 + 最近 3 条驳回原因 |

## 10. HTTP 路由（看板读 + 受限写）

前缀 `/plugins/wsgw-solution-review/api`，由 `ctx.webServer.register` 注册（`exact` / `prefix` 两种），`Content-Type: application/json`。每个请求先过 `ctx.connection.requestRejection(req)`（DSH Web 自身的访问令牌 / 局域网围栏，返回 401 / 403 时原样回绝），再校验 `Origin` 与 `Host` 同源（跨源 403）。本包不新增凭证、会话或路由框架。写请求体上限 64 KiB，必须 `application/json`（否则 415）。`ReviewToolError` 映射为 404（`*_NOT_FOUND`）或 400，其余 500。

读路由：

| 路由 | 返回 |
|---|---|
| `GET /rules` | `{ rules: RuleView[], warnings, loadErrors, version }` |
| `GET /rules/:id` | `{ rule: RuleView, detail: { question, rationale, suggestion, applicability, verifier, provenance, shipped?:{severity,status}, override?:{status?,severity?,params?}, audit[最近 10 条], memory: memory_recall 结果 } }` |
| `GET /reviews?page=N` | `{ items[review + counts], page, total }`，每页 50 条，按创建时间倒序 |
| `GET /reviews/:id` | `{ review, issues, checklist, checklistCounts, counts, basis, summary, feedback }`；不含正式意见正文（只给 `opinionPath` 与 `versions[]`，正文在文件里） |
| `GET /memory` | `{ rules[有记录的规则：stats, warn, exemplars, recentRejectReasons, series(最近 5 次定稿)], candidates[], totals }` |
| `GET /eval-runs[?ids=a,b]` | `{ runs[] }`；带 `ids` 时要求 2–7 个且全部存在（400 / 404） |

写路由（全部调用 `ReviewStore` 与工具相同的方法，审计 `who:'dashboard'`）：

| 路由 | 请求 | 等价 |
|---|---|---|
| `PATCH /rules/:id` | `{action:'disable'|'enable'|'set_severity'|'set_param', severity?, param?:{key,value}}` | `rules_propose`；`param.key` 仅白名单（§4.3 参数），越界返回 warnings |
| `POST /candidates/:id` | `{action:'accept_draft'|'dismiss'|'draft', draft?}` | `rules_propose`；`accept_draft` 取候选的 `draftRuleId`，候选尚未起草 → 400 `BAD_ACTION` |
| `POST /reviews/:id/issues/:issueId` | `{action:'adopt'|'reject'|'rewrite', text?, reason?}` | `review_decide` |
| `POST /reviews/:id/reviewer` | `{reviewer}` | `review_decide(set_reviewer)` |
| `POST /reviews/:id/final-verdict` | `{finalVerdict}` | `review_decide(set_final_verdict)`，要求审核人已知 |

不开放：删除记录、编辑正式意见正文、看板内起草规则 YAML（起草留在对话里由 agent 完成，看板只审批）、看板内定稿（定稿要写文件并 `present`，留在对话）。定稿后在看板改动任何决定 → 记录回到 `open`（§8），看板提示回对话重新 `review_finalize`。

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
| `tests/client/*.spec.ts(x)` | 单元 | 看板纯函数（筛选、标记、对比约束、请求错误归一化）与 `react-dom/server` 渲染的四页空状态 / 详情视图 |
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
| T-DES-10 | `rules_list` 合并：override 的 `status/severity` 覆盖 shipped；shipped 文件内容不变 |
| T-DES-11 | 路由：非 GET 405、跨源 403、未知 id 404、JSON 结构快照 |
| T-DES-12 | `--dump-config` 能组装 `cordis.patch.yml`（含 preset 行）且无撞名 |
| T-DES-13 | client bundle 校验脚本：banner / footer / 外部化白名单 / 不含 `react` 实体 |
| T-DES-14 | bench：200 KB 合成文档 `check` ≤ 2 s |
