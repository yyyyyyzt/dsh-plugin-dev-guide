# AGENTS.md — 工作区总指引

> 本文件同时被 Cursor 与 DSH（`@deepseek-ai/dsh-agent-instructions`）作为工作区指令加载。任何 agent 在本仓库动手前先读完本文，再读 `progress.md` 找到当前步骤。
> 最后更新：2026-10-19（S0 完成）。

## 0. 这个仓库现在是什么

两个并存、互不耦合的部分：

1. **DSH 插件开发指南**（原有）：`README.md`、`docs/`、`examples/hello-plugin`、`scripts/discover-plugins.mjs`、`plugins.md`。基线 `dsh-v0.1.1-rc.2`，按 `docs/maintenance.md` 维护。
2. **wsgw-solution-review**（新，本指引的主体；wsgw = 网上国网）：一个 DSH 插件，用对话完成「技术方案 AI 预审 → 专家复核 → 正式意见 → 回流记忆」，并配一个可复核规则与记忆的 dashboard；最终产出一篇偏工程实践的期刊论文（目标 *Applied Sciences* 或同类）。代码位于 `plugins/wsgw-solution-review/`，论文位于 `paper/`。

旧版 Python 原型已整体移入 `archive/legacy-review-tool/`（见 `archive/README.md`），**不再维护、不得 import**。

## 1. 仓库地图

| 路径 | 职责 | 状态 |
|---|---|---|
| `AGENTS.md` | 本文：目标、铁律、架构、研究主张、决策记录 | 持续维护 |
| `progress.md` | 步骤计划、每步状态与证据、开放问题 | 每步结束必更新 |
| `plugins/wsgw-solution-review/` | 插件工程（docs / rules / src / tests / client） | S1 起创建 |
| `plugins/wsgw-solution-review/docs/` | 需求、设计、规则 schema、对话协议、评测方案——**唯一事实来源** | S1 |
| `paper/` | 论文大纲、实验脚本、图表、稿件 | S6 |
| `archive/` | 归档（旧版原型、历史文档） | 冻结 |
| `docs/`、`examples/`、`scripts/`、`plugins.md` | DSH 插件开发指南（原有内容） | 独立维护 |

## 2. 项目目标与边界

### 2.1 目标（一句话）

专家把 Markdown 方案丢进 DSH 对话 → 插件给出**预审结论建议**（通过 / 建议整改 / 不通过）+ 逐条问题（规则号、严重级别、**可验证的原文证据**、整改建议）→ 专家在对话里逐条**采纳 / 驳回 / 改写**并补充意见 → 生成公文风格正式意见 → 专家的每个决定成为**持久记忆**（规则精确率、措辞范例、候选规则），下次审查自动受益。

### 2.2 铁律（必须遵守）

1. **只做自己的研究。** 本插件只负责：方案结构化解析、严格规则校验、证据锚定、结论策略、专家复核协议、记忆回流、评测与 dashboard。其余一律装现成插件或用 DSH 原生能力，不自研：
   | 需求 | 用什么 | 不做什么 |
   |---|---|---|
   | Word / PDF → Markdown | `@deepseek-ai/dsh-skill-office`、`@deepseek-ai/dsh-office-to-pdf`、Web 端文档预览自带的 docx 转换 | 不写任何转换脚本 |
   | 持久化 / 记忆 | `@deepseek-ai/dsh-storage` + `dsh-storage-json`（base 自带）经 `ctx.storageDomain` 使用 | 不引入数据库、向量库、MCP memory server |
   | 大模型访问 | 对话中的 agent 本身；批量评测用 `ctx.llm` | 不写 OpenAI SDK 客户端、不硬编码厂商 |
   | 向专家提问 | `ask_user_question`（`dsh-tool-ask-user`，`ctx.userQuestions`） | 不自建表单后端 |
   | 交付文件 | `present`（`dsh-tool-present`）+ Markdown 文件 | 不写 Word 生成器；需要 .docx 时让 office skill 转 |
   | 专用 agent | `dsh-agent-preset` + `dsh-persona` 组成「方案审查」preset | 不改系统提示词全局行 |
   | 审查流程指令 | DSH skill（`SKILL.md`）+ 工具描述 | 不把流程写死在代码里 |
   | 页面 | 右侧 Sidebar tab（`ctx.sidebarRightTabs`）+ 设置卡片 | 不建独立前端工程、不自建 Router |
2. **先文档，再测试用例，最后开发。** 每个步骤的顺序不可倒置：`docs/` 里的对应章节定稿 → `tests/` 里写出用例（允许先 `.todo` / 红灯）→ 实现让其变绿。没有对应文档条目的代码不合并。
3. **AI 只做初筛，不自动驳回。** 存储与输出中必须区分 `ai_verdict`（建议）与 `final_verdict`（仅专家可写）。任何未经专家确认的 LLM 判断不得进入正式意见。
4. **证据必须可验证。** 每条问题的 `evidence[].quote` 必须能在方案原文中按子串命中（归一化空白后），否则该问题降级为 `待人工`，且不参与结论计算。这条由工具侧强制，不靠提示词。
5. **结论由策略决定，不由模型一句话决定。** `ai_verdict` 是已确认问题集合上的确定性函数（§4.4）。
6. **不要越做越大。** 任何新增能力先问：能否通过安装插件/配置解决？是否在 §2.3 的不做清单里？是否对论文主张有贡献？三问有一否即不做，记入 `progress.md` 的「推迟/拒绝」表。
7. **文档同源。** 需求、设计、规则 schema 只在 `plugins/wsgw-solution-review/docs/` 维护一份；`progress.md` 只记状态与证据（测试名 / commit），不复述设计。发现冲突以 `docs/` 为准并立即修正。
8. **语言与风格。** 对话、文档用简体中文；代码标识符、commit message 用英文；不加叙述性注释。

### 2.3 明确不做（本阶段）

- 向量库 / Embedding / Rerank / 相似方案检索（决策 1）。
- 微服务台账与「方案 ↔ 微服务」运营视图（决策 5）。
- 历史图片时序图的多模态逆向（离线、不在插件内）。
- 运行时监控数据（p95/p99/流量）接入：无数据源，相关规则降为 `soft`。
- 软著说明书、Word 公文模板引擎。
- 仓库拆分（决策 6）。

### 2.4 六项决策的结论

| # | 问题 | 结论 |
|---|---|---|
| 1 | 检索还要不要 | 不要向量库。「历史同类问题提醒」改为**按规则号读取记忆**（专家采纳/驳回/改写统计 + 措辞范例），由 storage-domain 持久化。轻量、可解释、改完即生效。 |
| — | 包名 / 模型 / 格式 / 首批规则 / 历史原文 / 脱敏 / 部署（Q1–Q7，2026-10-19 用户拍板） | 包名 `wsgw-solution-review`；模型默认 DeepSeek（走 DSH provider，插件不绑定厂商）；正式意见 Markdown + 可选 `present`；首批规则从旧 24 条按可验证性分级（`docs/rule-schema.md` 附录）；历史方案原文暂不可得 → **合成（mock）方案**做离线评测并在论文中明示；论文数据匿名并给出脱敏方法（`docs/evaluation.md`）；部署为 Web profile，未来开放 ip:port 给局域网 → 看板路由只读、鉴权沿用 DSH。 |
| 2 | 硬检查合格线 | 收紧：规则按**可验证性**分三级（§4.3）。只有带结构化校验器的规则才允许 `hard`；关键词出现≠通过；否定句、占位符（`/`、`无`、`略`）要识别。 |
| 3 | 评测是否进这一版 | 进，但改口径：以**专家在对话中的采纳/驳回**作为在线标注（回流即标注），离线指标随之累积；30 条历史意见只用于结论分布校准与规则覆盖分析，不冒充 golden set。指标定义见 §5.3。 |
| 4 | 专家复核算不算 MVP | 算，且是核心：复核在对话中完成，专家回复即记忆写入。 |
| 5 | 台账 | 不进产品，不进验收。 |
| 6 | 仓库 | 不拆；旧版进 `archive/`。 |

## 3. 技术基线

- **DSH**：`deepseek-harness` tag **`dsh-v0.2.1-rc.2`**（2026-10-17，master 最新预发布）。本插件按这一版开发；`engines.dsh` 初定 `">=0.2.1-rc.2 <0.3.0"`。注意本仓库 `docs/` 指南写的是 `0.1.1-rc.2`，两者行为有差异（Web 平面已改为 agent preset 组合、新增 storage / plugin-market / sidebar-right 等），**以 0.2.1-rc.2 源码与 `docs/subsystems/*.zh.md` 为准**。
- **运行时**：Node `^22.19 || >=24`，pnpm `11.x`（DSH 根 `packageManager: pnpm@11.28.5`），TypeScript 6，vitest 4，tsdown 0.22（client bundle）。
- **本地开发回路**：克隆 deepseek-harness 并 `pnpm install && pnpm run build`；`pnpm dsh web --patch <本插件 cordis.yml>` 源码加载；或 `pnpm dsh plugin --profile web add <本插件目录>` 安装进 profile。Client 半每次 `pnpm run build` 后刷新页面（仓库外插件没有 HMR watcher）。
- **DSH 原生能力对照**（Web profile 默认已挂载，插件直接 `inject`）：

| 能力 | 服务 / 包 | 本插件用途 |
|---|---|---|
| 工具注册 | `ctx.tools`（`dsh-tools`） | `review_*`、`rules_*` 工具 |
| 持久存储 | `ctx.storageDomain`（`dsh-storage-domain`，json 后端） | 规则运行态、审查记录、专家反馈、措辞范例、候选规则、评测结果 |
| 专家提问 | `ctx.userQuestions` / `ask_user_question` | 逐条采纳 / 驳回 / 改写、结论确认 |
| 命令 | `ctx.commands`（`dsh-commands`） | `/review`、`/rules`、`/memory` |
| agent 组合 | `dsh-agent-preset-registry` + `dsh-agent-preset` + `dsh-persona` | 「方案审查专家」preset（含 persona、skill、工具白名单） |
| skill | `ctx.skills`（`dsh-skill` + `skill-filesystem`） | 审查流程 SKILL.md（审查 → 复核 → 定稿） |
| 交付 | `present` | 正式意见 Markdown |
| 会话查询 | `dsh-session-query-sqlite` | 评测时回放会话、统计耗时 |
| Web 路由 | `ctx.webServer.register` | dashboard 的 `/plugins/wsgw-solution-review/api/*` |
| 右侧栏 | `ctx.sidebarRightTabs` + `sidebar.right.pane.tab` | dashboard tab |
| 设置卡片 | `installSettingsSection` + `settings.plugin.item` | 阈值、规则包路径等即时配置 |
| 测试支撑 | `@deepseek-ai/dsh-llm-mock-server`、`dsh-llm-replay`、`agent-loop-testkit` | 对话协议的可重放测试 |

## 4. 架构概要（细节在 `plugins/wsgw-solution-review/docs/design.md`）

### 4.1 组成

```
wsgw-solution-review (bundle, cordis.patch.yml)
├─ host 平面
│  ├─ review-store      storage domain `solution_review`（规则层 / 审查 / 反馈 / 记忆 / 评测）
│  ├─ review-engine     Markdown AST + Mermaid 解析 → 规则校验器 → 证据锚定 → 结论策略（纯函数，可单测）
│  ├─ review-tools      review_parse / review_check / review_record_issue / review_status / review_decide / review_finalize / rules_list / rules_propose / memory_recall（挂在 preset 内，只有审查 agent 可见）
│  ├─ review-commands   /review, /rules, /memory —— 只做 host 侧即时查询（DSH 命令不经过模型，不能用来发起审查）
│  ├─ review-api        dashboard 只读 HTTP 路由 `/plugins/wsgw-solution-review/api/*`
│  └─ settings          阈值、规则包目录、公文模板
├─ agent preset `solution-review`
│  ├─ persona           审核专家口吻；只建议，不裁决
│  ├─ skill `solution-review`   审查三阶段 SOP + 输出格式
│  └─ 工具白名单        tool-fs(只读为主)、tool-skill、tool-ask-user、present、review-tools
└─ client 平面
   ├─ sidebar-right tab `review-dashboard`   规则 / 审查记录 / 记忆 / 评测 四页
   └─ settings card
```

### 4.2 对话协议（三阶段，一个会话内完成）

1. **预审**：专家在「方案审查」preset 的会话里粘贴 Markdown、给出文件路径或附上 Word（由 office skill 先转 Markdown），说一句「预审这份方案」即可。工具链：`review_parse` 解析 → `review_check` 跑 `hard`/`hybrid` 校验器（hard 问题自动登记，hybrid 产出候选片段）→ agent 按 skill 对 hybrid 候选与 soft 规则逐条判断并经 `review_record_issue` 登记（证据门禁在此生效）→ `review_status` 给出 `ai_verdict` 与分层意见（结论 / 明细 / 检查清单）。
2. **复核**：agent 用 `ask_user_question` 分批呈现问题，每条选项 `采纳 / 驳回 / 改写`（改写走自由文本），专家也可自然语言补充新意见；每个决定经 `review_decide` 落库。专家最后确认 `final_verdict`。
3. **定稿与回流**：`review_finalize` 生成公文风格正式意见（Markdown，`present` 交付），同时写入反馈并刷新记忆：规则级采纳率、措辞范例（改写文本）、候选规则（专家新增且未命中任何规则的意见）。

### 4.3 规则模型（严格化的核心）

规则 = `id / dimension / severity(blocker|major|minor) / tier / verifier / rationale / suggestion / status(active|draft|retired) / provenance`。

- `tier: hard`：**必须**有结构化校验器，结果确定且带证据锚点；可独立产生问题。
- `tier: hybrid`：校验器负责定位候选证据片段与否定/占位识别，LLM 只在候选片段上做语义判断；无候选片段时结果为 `待人工`，不是 `未通过`。
- `tier: soft`：纯语义规则，LLM 判断后一律标 `待人工`，不参与 `ai_verdict`。

校验器种类（首批）：`section`（章节存在且非占位、最小字数）、`table`（必需列、非占位单元格）、`statement`（断言句模式 + 否定词/占位词识别）、`quantity`（数字 + 单位）、`mermaid-sequence`（参与方、消息、必含步骤如鉴权）、`cross-ref`（正文引用的附件必须在附件清单中）。规则文件为 YAML，随包发布为 `shipped` 层；专家改动与学习结果为 `learned` 层（storage），读取时按 id 覆盖——与 DSH 补丁分层同构。

### 4.4 结论策略（确定性）

```
confirmed = 已登记且通过证据门禁的 hard 问题 ∪ hybrid 问题
ai_verdict = 不通过   若 ∃ blocker ∈ confirmed
           = 建议整改 若 ∃ major ∈ confirmed 或 |minor ∈ confirmed| ≥ minorThreshold
           = 通过     否则
```
`soft` 与 `待人工` 项只列出不计分。`final_verdict` 仅由 `review_decide`/`review_finalize` 在专家确认后写入。

### 4.5 记忆模型（持久化，取代向量库）

| 表 | 记录 | 由谁写 | 谁读 |
|---|---|---|---|
| `rules` | learned 层覆盖（status / severity 调整 / 阈值） | 专家经对话 | 引擎、dashboard |
| `reviews` | 一次审查：方案摘要、`ai_verdict`、`final_verdict`、耗时 | finalize | dashboard、评测 |
| `issues` | 每条问题及证据、来源（hard / hybrid / soft / expert） | record_issue / decide | finalize、评测 |
| `feedback` | 专家对每条的 `adopt / reject / rewrite` + 原因 + 改写文 | decide | 记忆聚合 |
| `exemplars` | 按规则号的措辞范例（来自 rewrite 与 adopt） | finalize | agent 写建议时召回 |
| `rule_candidates` | 专家新增且未命中规则的意见 → agent 起草的规则草案 | finalize / rules_propose | dashboard、专家审批 |
| `eval_runs` | 批量评测结果 | 评测脚本 | dashboard、论文 |

记忆召回是**按规则号 / 维度的精确读取**（`memory_recall`），不是语义检索。

## 5. 研究主张与评测（论文视角）

### 5.1 工程创新点（待实验验证，不夸大）

- **C1 可验证性分级规则模型**：规则的权限由可验证性决定（hard / hybrid / soft），LLM 只能在结构化校验器划定的证据范围内判断；配合工具侧证据门禁，消除「无证据意见」。
- **C2 专家决策即记忆**：复核动作（采纳 / 驳回 / 改写 / 新增）直接成为持久、可审计的记忆层，自动产出规则级精确率、措辞范例与候选规则；无需单独标注与向量库。
- **C3 插件原生架构**：整个系统是 harness 上的一组可逆插件（preset + 工具 + 存储域 + sidebar tab），无独立后端、无数据库；规则与记忆热更新；与旧版单体对照给出复杂度、部署与可维护性对比。
- **C4 对话即流程**：三阶段协议全部在一个 agent 会话内由 skill 驱动完成，专家零学习成本。

### 5.2 假设

- H1 结构化校验器 + 证据门禁相比关键词匹配显著提高问题级精确率，且不降低召回。
- H2 开启记忆层后，随审查次数增加专家采纳率上升、驳回率与改写率下降（学习曲线）。
- H3 确定性结论策略的三分类与专家最终结论的一致性（kappa）高于「模型直接给结论」。
- H4 平均单份方案出正式意见的时间低于纯人工基线（专家自报或会话时长）。

### 5.3 指标（回答「不知道需要什么指标」）

| 层 | 指标 | 数据来源 |
|---|---|---|
| 问题级 | precision / recall / F1（按 `rule_id` 对齐；blocker/major/minor 权重 3/2/1 的加权召回） | 专家采纳 = TP，驳回 = FP，专家新增 = FN（在线标注） |
| 结论级 | 三分类准确率、宏 F1、Cohen's kappa、混淆矩阵 | `ai_verdict` vs `final_verdict` |
| 证据 | 证据有效率（门禁通过 / 全部 LLM 提出）、锚点定位准确率（专家抽检） | 工具日志 |
| 记忆 | 采纳率随审查序号的趋势、规则级精确率收敛、候选规则转正数 | `feedback` 表 |
| 效率 | 会话时长、工具调用次数、token 用量 | `session-query` + token meter |
| 消融 | 关键词 vs 结构化校验器；有 / 无证据门禁；有 / 无记忆层；模型直接给结论 vs 策略 | 批量评测脚本（`ctx.llm` 路径，固定提示词与温度） |

历史 30 条意见（`archive/.../review_records.json`）的分布为 通过 15 / 建议整改 14 / 不通过 1，类别严重不均衡，因此**不用准确率单指标**，报告每类召回与 kappa；并用它做规则覆盖分析（每个意见点能否映射到现有规则）。

### 5.4 目标期刊与稿件约束

*Applied Sciences*（MDPI，Q2 Engineering Multidisciplinary，偏工程实践，开放获取）。稿件结构按其 Article 模板：Introduction / Related Work / System Design / Implementation / Evaluation / Discussion / Conclusions；强调可复现（开源插件 + 匿名化数据 + 评测脚本）。备选：*Electronics*、*Information*、*IEEE Access*。

## 6. 质量门禁

- **单元测试**（vitest）：解析器、每种校验器、结论策略、记忆聚合、证据门禁——全部纯函数，fixture 以种子方案及其变体（删章节、改否定句、去时序图）构成。
- **契约测试**：storage domain spec（zod schema、版本）；工具 `output.schema`；`cordis.patch.yml` 行与 preset 组合能被 `--dump-config` 组装。
- **协议测试**：用 `dsh-llm-mock-server` / `llm-replay` 回放一次完整「预审 → 复核 → 定稿」会话，断言落库内容与交付文件。
- **离线校验脚本**：client bundle 结构（banner / footer / 外部化白名单）、规则 YAML schema。
- 命令（S3 搭好工程后固定写入此处）：`pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm run check:bundle`。
- 每步完成的证据写入 `progress.md`：测试名、通过数、commit。

## 7. 历史与决策记录（为什么重做）

旧版（2026-08，`archive/legacy-review-tool/`）的问题经复核属实，根因是**把「规则已声明」当成「规则可验证」**，并且没有任何持久化与反馈回路：

| 现象 | 根因 | 新版对策 |
|---|---|---|
| 硬检查只扫 5 条关键词，「未做压测」也算通过，证据恒空 | 子串匹配，无结构、无否定识别 | §4.3 三级规则 + 校验器 + 证据锚点 |
| 结论完全取模型一句 `overall_verdict`，blocker 命中不影响结论 | 无结论策略 | §4.4 确定性策略 |
| 提示词互相矛盾、24 条全传、JSON 用正则抠 | LLM 承担了本应由程序承担的判断 | LLM 只在候选证据上判断；工具侧 schema 校验 |
| 经验检索只在维度已失败时加载、无历史意见复用 | 没有记忆层 | §4.5 专家决策即记忆 |
| 评测用 mock、golden set 占位、PDF 路径写死 | 没有真实标注来源 | 在线标注（回流即标注）+ 分布校准 |
| 三份文档互相打架、缺 `config.yaml` 起不来 | 多份事实来源、无工程门禁 | §2.2 第 7 条 + §6 |
| 单体 FastAPI + HTML，与 DSH 无关 | 技术栈选错 | 插件原生架构（C3） |

## 8. 给 agent 的操作约定

1. 开工前：读本文 → `progress.md` 当前步骤 → 该步骤对应的 `docs/` 章节。
2. 每个步骤按「文档 → 测试 → 代码」三个 commit 以上提交，commit message 前缀 `docs(review):` / `test(review):` / `feat(review):` / `chore(review):`。
3. 用户在对话中调整方向时：先改 `docs/`，再改 `progress.md` 的计划，最后动代码；在 `progress.md` 「决策日志」加一行。
4. 需要用户决定的事项写进 `progress.md` 「开放问题」，给出默认选项并按默认继续，不阻塞。
5. 不改 `archive/`；不改原有指南内容除非为了指向新项目（如 README 目录表）。
6. 查 DSH API 一律以 `dsh-v0.2.1-rc.2` 的 `docs/subsystems/*.zh.md` 生成区域与包 README 为准；本仓库 `docs/*.md` 的指南仅作入门参考。
