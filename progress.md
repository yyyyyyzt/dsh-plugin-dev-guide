# progress.md — wsgw-solution-review 进度

> 只记状态、证据与决策，不复述设计（设计见 `AGENTS.md` 与 `plugins/wsgw-solution-review/docs/`）。
> 更新：2026-10-27　|　当前步骤：**S4 收口（2026-10-27 复核：文档对齐 0.2.1、修 8 处缺陷、client 改 TSX、headless 真机冒烟通过；待用户本机 GUI 冒烟，清单见 §7）**

## 1. 步骤总览

每一步都按「文档 → 测试用例 → 开发」推进；一步未达「完成定义」不进入下一步。用户可在任何步骤调整方向，调整先落文档。

| 步骤 | 内容 | 完成定义 | 状态 |
|---|---|---|---|
| S0 | 建立 `AGENTS.md` / `progress.md`；旧版已删除 | 两份指引可读；PR 已开 | ✅ 2026-10-19（2026-10-23 旧版全删） |
| S1 | 文档定稿：需求 V1.0、设计 V1.0、规则 schema、对话协议、评测方案、dashboard 规格 | 六份文档互不矛盾，用户确认；每份文档末尾有「测试要点」清单供 S2 取用 | 🟡 2026-10-19 六份已写出（测试要点共 74 条）；用户「继续开发」视为默认确认，三处细节仍可改（见 §7） |
| S2 | 测试用例：工程骨架 + fixtures + 全部用例（红灯 / todo） | `pnpm test` 能跑，用例数与 S1 测试要点一一对应 | ✅ 2026-10-19 `pnpm test`：184 条引擎用例红灯（全部 `NotImplementedError`）、107 条 todo；`pnpm typecheck` 通过 |
| S3a | Host 引擎（纯函数）：Markdown/Mermaid 解析、6 种校验器、证据门禁、结论策略、记忆聚合 | S2 对应用例全绿；无 I/O | ✅ 2026-10-19 `pnpm test:engine` 214 passed；`pnpm bench` 200 KB 0.54 s；`pnpm typecheck` 通过 |
| S3b | Host 存储与工具：storage domain、`review_*` / `rules_*` / `memory_recall` 工具、命令、设置 | 契约测试绿；`--dump-config` 能组装 | ✅ 2026-10-20 `pnpm test` 284 passed（store 12 / tools 45 / host 13 条由 todo 转为断言）；`--dump-config` 出现两行 |
| S3c | agent preset + persona + skill + `cordis.patch.yml`；协议回放测试 | 用 mock LLM 回放「预审→复核→定稿」全程，落库与交付文件断言通过；真机 `dsh web` 走通种子方案 | ✅ 2026-10-20 preset / persona / skill / patch 已交付；`pnpm dsh:install` 一条命令装进 `web` profile，真机 `dsh web` 中预设、插件页、三条命令均可用（见 §6）。2026-10-23 脚本化协议回放 11 条全绿（`tests/protocol/protocol.e2e.ts`，快照 `tests/fixtures/expected/opinion-seed.md`）；同日真机 `rv_20261023_xnhfjz`：10 条问题、全部采纳、finalized、意见 `reviews/rv_20261023_xnhfjz.md` |
| S4 | Client dashboard（sidebar-right tab 四页）+ 可写 API（规则 / 候选 / 复核）；设置卡片推迟 | bundle 校验脚本通过；页面展示并可修改规则 / 记录 / 记忆 / 评测；录屏 | 🟡 2026-10-27：API + client（TSX 四页）完成，`pnpm test` 337 passed / 15 todo；`build` / `check:bundle` 通过（46,552 bytes）；headless 真机：boot 预加载含插件 client、API 读写与围栏全部按文档返回（§6）。设置卡片推迟。剩余：用户本机 GUI 冒烟（§7 清单）与录屏 |
| S5 | 数据迁移与评测：24 条规则重写入新 schema；原 30 条历史意见已删除（仅保留 45 个意见点的分布口径），覆盖分析改用合成方案；批量评测路径（`ctx.llm`）；消融实验脚本 | `eval_runs` 有首批结果；消融四组可一键复现 | ⬜ |
| S6 | 论文：大纲 → 实验 → 稿件（MDPI *Computers* 模板） | 稿件初稿 + 图表 + 可复现包 | ⬜ |

## 2. 各步骤交付清单

### S1 文档（`plugins/wsgw-solution-review/docs/`）

| 文件 | 内容要点 |
|---|---|
| `requirements.md` | V1.0：用户与场景、三阶段流程、输入规范（Markdown + Mermaid 强制）、输出三层结构、复核与回流、非功能（时延、内网、可观测）、验收标准、不做清单 |
| `design.md` | 插件组成、`cordis.patch.yml` 与 preset 行、服务与 inject、数据模型（storage domain spec 草案）、工具清单与 schema、命令、HTTP 路由、错误与降级、安全（路由同源校验、文件只读） |
| `rule-schema.md` | 规则 YAML schema、三级 tier 语义、6 种校验器的输入 / 输出 / 证据锚点格式、否定词与占位词表、shipped/learned 分层与覆盖规则、规则生命周期（draft→active→retired） |
| `review-protocol.md` | 对话协议：命令与触发、skill SOP 文本初稿、`ask_user_question` 批次与选项文案、专家自然语言意见的归一化、定稿模板（公文风格，取自历史意见格式）、异常路径（无证据、专家中途退出、重复审查） |
| `evaluation.md` | 指标定义（`AGENTS.md` §5.3 展开）、在线标注规则、离线评测集构建、消融设计、统计方法、数据脱敏 |
| `dashboard.md` | 四页信息架构、每页数据来源（表 / 聚合）、交互（规则启停、候选审批、复核决定可写）、空状态、slot 与 tab 注册 |

### S2 测试（`plugins/wsgw-solution-review/tests/`）✅

| 位置 | 内容 | 状态 |
|---|---|---|
| `package.json` / `tsconfig*.json` / `vitest.config.ts` | 工程骨架：strict TS（`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`）、vitest 3；**暂不依赖 DSH 包**（S3b 加入） | ✅ |
| `src/engine/types.ts` + 各单元 stub | 引擎全部类型；每个函数抛 `NotImplementedError`，保证红灯而非编译失败 | ✅ |
| `rules/capability-open-access.rules.yaml` | 28 条 shipped 规则（附录 A/B）+ 词表。**S5 的「规则迁移」提前到 S2**，因 T-RUL-12 需要 | ✅ |
| `fixtures/` | `seed.md` + 7 个变体（no-impl / negated / placeholder / missing-attachment / mermaid-incomplete / mermaid-ok / compliant）；`expected/seed.json`（28 条清单预期）与 `expected/variants.json`；8 个规则 YAML 样例（1 合法 7 非法） | ✅ |
| `engine/*.spec.ts`（184 条） | normalize 9、parse 12、mermaid 7、section 7、table 9、statement 18、quantity 6、mermaid-sequence 10、cross-ref 7、combinators 24、check 33、gate 15、verdict 11、memory 15、rules 21、render 10（含 `it.each` 展开） | ✅ 全绿（S3a） |
| `store/` `tools/` `api/` `client/` `protocol/` `eval/`（107 条 `it.todo`） | 以 T-ID 命名的占位用例；需要 DSH 运行时或 S4/S5 产物 | ⬜ todo |
| `bench/check.bench.spec.ts` | 200 KB 合成文档 ≤ 2 s（默认不跑，`pnpm bench`） | ✅ 0.54 s |
| `client/check-bundle.mjs` | banner / footer / 外部化白名单 / 未内联 React / 体积 | 待 S4 有 bundle 后运行 |

覆盖对照：74 条测试要点全部有对应用例（T-REQ 20 / T-DES 14 / T-RUL 12 / T-PRO 10 / T-EVA 9 / T-DSH 9），其中需运行时的以 todo 占位。

### S3a（引擎实现，2026-10-19）

| 位置 | 内容 | 状态 |
|---|---|---|
| `src/engine/normalize.ts` | NFKC + 去强调符 + 空白折叠，带源偏移映射；`findQuote/findAllQuotes`（忽略空白匹配）、`splitSentences`、行号索引（二分） | ✅ |
| `src/engine/parse/markdown.ts` `parse/mermaid.ts` | mdast+gfm：标题树与 path（H1 为标题不入 path）、bodyRange、表格 cellRanges、Mermaid 时序图参与者/消息、图片、sha256、stats | ✅ |
| `src/engine/verifiers/*` | section / table / statement / quantity / mermaid-sequence / cross-ref + `all`/`first`；公共层 `common.ts`（章节定位、句子切分与缓存、族词命中、占位符、缺失证据） | ✅ |
| `src/engine/rules.ts` | zod schema + 静态约束（soft 无校验器、hard 必须 decisive 且 `whenNoCandidate≠pending`、词表 key 存在、id 唯一）；`mergeRules` 白名单覆盖、草案追加、hard+pending 拒绝 | ✅ |
| `src/engine/check.ts` `gate.ts` `verdict.ts` | 适用性判定、tier 分流与清单；证据门禁七类原因、候选内优先定位；结论策略（仅 confirmed/adopted/rewritten × hard/hybrid/expert 计数） | ✅ |
| `src/engine/memory.ts` `render/opinion.ts` | 统计聚合、召回与「常被驳回」告警、范例上限、专家新增→候选规则（维度猜测）、滑动采纳率；正式意见渲染与版本文件名 | ✅ |

实现中对 S2 产物的两处修正：(1) 附录 A/B 合计数原文误记 11/12/5，按逐条分级实为 **hard 10 / hybrid 13 / soft 5**，文档与 `rules.spec.ts` 同步改正；(2) `check.spec.ts` 对 pass 规则的「预期引文」改为也接受清单 `note`（pass 无 issue/candidate，可引用的证据只在 note 里），`quantity` 的 pass note 改为引用「上下文词 + 数字」片段。

### S3b（存储与工具，2026-10-20）

| 位置 | 内容 | 状态 |
|---|---|---|
| `src/store/domain.ts` | storage domain `wsgw_solution_review` v1：zod 记录 schema（reviews / issues / feedback / exemplars / rule_overrides / rule_candidates / eval_runs）、键规则 `rv_<yyyymmdd>_<base32-6>`、`#seq`、`rc_<id>_n` | ✅ |
| `src/host/store.ts` | `ReviewStore`：`parse` / `check` / `recordIssue`（走 `gate`，hard 规则抛 `HARD_RULE_VERIFIER_OWNED`）/ `status` / `decide`（含自然语言 `answer` 归一化）/ `finalize`（先写文件再更新记录，再幂等刷新记忆）/ `rulesList` / `rulesPropose`（disable/enable/set_severity/set_param/draft/accept_draft/dismiss + 审计）/ `memoryRecall`；规则包有效版本 `pack@ver+ovN` 写入 `reviews.rulePackVersion` | ✅ |
| `src/host/config.ts` `errors.ts` `rules-loader.ts` `service.ts` | schemastery `Config`（11 项，含描述）；`ReviewToolError(code)` 11 种码；`*.rules.yaml` 目录加载（单包失败不影响其他）；`ctx.solutionReview` 服务声明 | ✅ |
| `src/host/tools.ts` + `src/tools.ts` | 9 个 `defineTool`（描述均含「只记录建议；最终结论由专家确认」）；预设子入口 `wsgw-solution-review/tools`，文件读写只经 `ctx.fs`（cwd 取自 `ctx.workingDirectory`） | ✅ |
| `src/engine/rules.ts` | 新增 `parseRuleDraft`（专家草案 YAML → 规则，status 默认 draft） | ✅ |
| `tests/store/harness.ts` | 真实栈：`Context` + `Storage` + `JsonStorageBackend` + `DomainFacility`，固定时钟与 base32 id | ✅ |

### S3c（预设、技能、命令、安装，2026-10-20）

| 位置 | 内容 | 状态 |
|---|---|---|
| `src/index.ts` | host 入口：`inject = [storageDomain, commands, skills]`，`provide = [solutionReview]`；打开 domain、挂命令与技能子插件 | ✅ |
| `src/host/commands.ts` | `/review [编号]`（列表 / 三层摘要）、`/rules [维度\|层级]`、`/memory <规则号>`；均不经模型 | ✅ |
| `src/host/skills.ts` + `skills/wsgw-solution-review/SKILL.md` | 内置技能（`source: bundled`），三阶段 SOP 来自 `review-protocol.md` §3 | ✅ |
| `src/persona.ts` + `cordis.patch.yml` | host 行（默认配置）+ `preset-wsgw-solution-review`（方案审查：persona、time-context、bash/pwsh、fs、fs-search、skill-filesystem、tool-skill、ask-user、todo、present、压缩组、`wsgw-solution-review/tools` 置末） | ✅ |
| `package.json` | `dsh.bundle.patch`、`exports`（`.` / `./tools` / `./persona` / `./cordis.patch.yml`）、`engines.dsh >=0.2.1-rc.2 <0.3.0`、peer=dev 的 `@deepseek-ai/*`、`prepare` 构建、`dsh:install` / `dsh:verify` | ✅ |
| `tests/host/*.spec.ts` | bundle 契约（manifest、patch 行、persona 一致）、技能可发现、命令输出、预设子入口挂载（桩服务） | ✅ 13 条 |
| `README.md`（插件） | 一条命令安装、装后清单、配置表 | ✅ |
| `tests/protocol/protocol.e2e.ts` | 脚本化 agent 回放「预审 → 复核 → 定稿」：11 条断言、参数快照、5/5/1 批次、署名、结论偏差、4 条异常路径、正式意见快照 | ✅ 11 条 |

### S4–S6

按 §1 表格；细目在各自开始时补入本文件。

## 3. 决策日志

| 日期 | 决策 | 依据 / 备注 |
|---|---|---|
| 2026-10-19 | 旧版 Python 原型整体归档，不复用代码；复用 30 条历史意见、种子方案、24 条规则语义 | 用户决策 6；问题分析见 `AGENTS.md` §7 |
| 2026-10-19 | 技术栈改为 DSH 插件，基线 `dsh-v0.2.1-rc.2` | 用户要求「当前 github 仓库最新版」；查证 master 最新 tag 为该版本 |
| 2026-10-19 | 不用向量库；记忆 = storage domain 的按规则号精确读取 | 用户决策 1 |
| 2026-10-19 | 规则按可验证性分 hard / hybrid / soft；证据门禁由工具强制 | 用户决策 2（更严格） |
| 2026-10-19 | 评测口径：在线标注（专家采纳 / 驳回 = 标签）为主，历史 30 条只做分布校准与覆盖分析 | 用户决策 3（指标待定）→ 给出 §5.3 指标集 |
| 2026-10-19 | 专家复核进 MVP，通过 `ask_user_question` 在对话中完成，回复即记忆 | 用户决策 4 |
| 2026-10-19 | 台账不进产品 | 用户决策 5 |
| 2026-10-19 | Word/PDF 转换、LLM 客户端、表单、Word 生成一律不自研，用 DSH 原生插件 | 用户铁律「能装插件就装插件」 |
| 2026-10-19 | 指引文件命名为 `AGENTS.md`（而非 `agent.md`） | DSH `agent-instructions` 与 Cursor 均按此名自动加载；语义等同用户所说的 agent.md |
| 2026-10-19 | 包名与目录 `wsgw-solution-review`（wsgw = 网上国网） | 用户拍板 Q1 |
| 2026-10-19 | 模型默认 DeepSeek；插件只经 DSH provider / agent 访问模型，不绑定厂商；评测走 `ctx.llm`，温度 0 | 用户拍板 Q2 |
| 2026-10-19 | 正式意见 = Markdown 文件 + 可选 `present` 交付；格式沿用历史意见「意见：<结论>（1）（2）…」 | 用户拍板 Q3 |
| 2026-10-19 | 首批规则：旧 24 条按可验证性分级，分级结果定稿在 `docs/rule-schema.md` 附录 A | 用户拍板 Q4 |
| 2026-10-19 | 历史方案原文不可得：离线评测用**合成方案**（按 30 条历史意见反向植入缺陷），论文中明示为 synthetic；真实原文到位后替换 | 用户拍板 Q5 |
| 2026-10-19 | 论文数据匿名；脱敏方法定稿在 `docs/evaluation.md` §7 | 用户拍板 Q6 |
| 2026-10-19 | 部署 Web profile；未来开放 ip:port 到局域网 → 看板 API 只读、鉴权沿用 DSH、不自建用户体系；专家身份通过会话内一次性提问记录 | 用户拍板 Q7 |
| 2026-10-19 | 论文：产品全部脱敏为「能源互联网平台」；目标期刊改为 MDPI *Computers*（按 ReqPlan-Eval 先例写法）；试点预计上百份；不做第二模型复跑 | 用户决定（S2 后） |
| 2026-10-19 | 论文叙事从「准确率提升」改为「审查知识引入问题 + 知识编译器视角」；方法允许为组合与微改；实现与论文叙事分离 | 用户否决 v0.1；`paper/innovation-notes.md` v0.2 |
| 2026-10-19 | `/review` `/rules` `/memory` 命令只做 host 侧即时查询；发起审查用自然语言 | DSH `ctx.commands` 的 handler 不经过模型（见 `docs/subsystems/commands.zh.md`） |
| 2026-10-19 | 规则分级合计以附录 A/B 逐条为准（hard 10 / hybrid 13 / soft 5），不为凑数改任何规则的 tier | S3a 实现时发现统计误记；MON-001 旧 check_method 为 rule 但校验器是非 decisive statement，维持 hybrid |
| 2026-10-19 | 门禁定位同一引文多次出现时：先取落在候选片段内的命中，再取声明章节内的，最后取首个 | T-DES-06 用例揭示同一章节内重复句的情形 |
| 2026-10-20 | 安装形态：本地目录 `dsh plugin --profile web add <目录>`（pnpm `link:`），`prepare` 构建 `lib/`；不走 git 安装（需 `allowBuilds`），npm 发布留到 S5 后 | 用户要求「`dsh web` 启动后一条命令装好」；真机验证 `link:` 可被 DSH 的 `@deepseek-ai/*` 解析拦截层正常加载 |
| 2026-10-20 | `zod` 精确钉 `4.4.3` 与 `dsh-storage-domain` 一致 | 两份 zod 导致 `defineDomain` 类型不兼容 |
| 2026-10-20 | persona 文本在 `cordis.patch.yml` 内联（块标量），`src/persona.ts` 保留同一份供测试比对 | DSH patch 的 `!!js` 不能 `require`；bundle 测试断言两处逐字一致 |
| 2026-10-20 | 预设不含 `dsh-skill-office`（不是 base/web-app bundle 的依赖）与 `agent-instructions` / `tool-web` | Word/PDF 转换按铁律交给用户另行安装的插件；预审不需要联网 |
| 2026-10-20 | `tool-todo` 显式配 `allowParallelInProgress: false` | 该插件 Config 无默认值，缺省会使预设行加载失败 |
| 2026-10-20 | `rule_overrides.stats.shown` 语义 = 该规则在已定稿审查中被提出（含 verifier 与专家登记）的次数；`adopt/reject/rewrite` 取最后一次决定 | 复核多次改口只算最终决定；统计在 `finalize` 时整体重算，幂等 |
| 2026-10-20 | `review_decide` 增加 `answer` 参数（专家原话归一化：采纳 / 驳回 / 改成…），与结构化 `action` 并存 | T-PRO-04/05：`ask_user_question` 的自由回复不应由模型二次解释 |
| 2026-10-20 | 错误码新增 `BAD_DRAFT`、`CANDIDATE_NOT_FOUND` | `rules_propose(draft / accept_draft / dismiss)` 需要 |
| 2026-10-23 | `archive/` 全删（34 个 path）；30 条历史意见 / 45 个意见点不再随仓库分发；论文只引用聚合口径 | 用户决策「直接全删」；原始数据可由 git 历史恢复 |
| 2026-10-23 | 看板从只读改为**可写**：规则启停 / 级别 / 参数、候选审批、复核决定；沿用 DSH 鉴权，细粒度权限后置 | 用户决策「允许改写，前期降低维护成本」；统一走 store 写入口，避免两套逻辑 |
| 2026-10-23 | 文档基线字符串直接改 `dsh-v0.2.1-rc.2` / `pnpm@11.28.5`；行为章节标「待逐章复核」 | 用户决策「直接改」；只改字符串不等于已验证 0.2.1 行为 |
| 2026-10-23 | P0：hybrid 无候选一律 `pending`；`whenNoCandidate: fail` 仅 hard；absence 只由校验器产生并显式标注「非引文」；工具输出返回明细而非摘要 | 2026-10-23 审查复盘：hybrid 自动 fail、证据伪装、工具只回计数 |
| 2026-10-23 | S3c 协议回放用**脚本化 agent**，不引入 `dsh-llm-mock-server` | DSH 未随 profile 提供该包；`progress.md` §7 允许脚本化 agent；脚本仍走真实 store/tools，断言落库与文件 |
| 2026-10-27 | 设置卡片推迟；删除 `dashboardPollSeconds`，看板只在打开 / 切页 / 手动 / 写后刷新 | 0.2.1 无第三方插件自动设置表单入口（`installSettingsSection` / `settings.plugin.item` 是 0.1.x 指南写法）；阈值改动低频，YAML 足够（铁律 6） |
| 2026-10-27 | `adopt_rest` 只采纳 `confirmed`；`pending` 必须逐条确认 | 原实现把门禁未过 / soft 的「待人工」项也批量采纳，违背「待人工 = 要人看过」与铁律 3 |
| 2026-10-27 | 已有专家决定或已定稿的审查拒绝重跑 `review_check`（`REVIEW_ALREADY_DECIDED`） | 重跑会删除已复核的 verifier 问题及其决定状态，反馈记录变成孤儿 |
| 2026-10-27 | 定稿后再 `decide` → 记录回 `open`，需重新 finalize（v2） | 否则看板 / 记录显示「已定稿」但意见文件已过期 |
| 2026-10-27 | 仅含 `stats` 的 override 行不算覆盖：不计入 `+ovN`、不标「已覆盖」 | 原实现每次定稿都改变规则包版本号，`rulePackVersion` 失去复现意义 |
| 2026-10-27 | 看板候选「接受草案」按候选的 `draftRuleId` 接受；未起草的候选只能忽略或回对话起草 | 原路由只传 candidateId，`accept_draft` 必然 400 |
| 2026-10-27 | Client 改为 TSX（`index.tsx` + `views.tsx` + `model.ts`），类型直接引用引擎类型；样式只用 DSH 主题变量；改写在行内输入 | 原 client 自造维度枚举（与引擎不一致导致筛选全空）、候选字段错位、`window.prompt`、硬编码颜色 |
| 2026-10-27 | 看板载荷类型拆到 `src/host/api-types.ts`，host 与 client 共用 | client 直接 import `api.ts` 会把 host 路由代码拉进 client 声明构建（缺 `ctx.solutionReview` 增强而报错） |
| 2026-10-27 | `prefix` 路由不带尾部斜杠；路由测试桩按 dsh-webserver 的「精确优先 + 最长前缀、`p` 只匹配 `p` 与 `p/…`」实现 | headless 冒烟发现 `/rules/:id`、`/reviews/:id/*`、`/candidates/:id` 在真机全部落到 DSH `/plugins` 资源路由（404 / 405）；原测试桩用 `startsWith` 掩盖了问题 |
| 2026-10-27 | 对 shipped 规则改回出厂值（启用 / 原严重级别）即删除该覆盖字段，审计保留 | 否则「改回去」仍显示「已覆盖」且版本号带 `+ovN` |

## 4. 开放问题（给出默认值，不阻塞）

| # | 问题 | 结论（2026-10-19 用户拍板） | 状态 |
|---|---|---|---|
| Q1 | 插件包名 | `wsgw-solution-review`；npm scope 发布前再定 | ✅ |
| Q2 | 模型与接入 | 默认 DeepSeek，走 DSH provider；插件不感知厂商 | ✅ |
| Q3 | 正式意见格式 | Markdown + 可选 `present`；沿用历史意见格式 | ✅ |
| Q4 | 首批规则范围 | 旧 24 条按可验证性分级（`docs/rule-schema.md` 附录 A） | ✅ |
| Q5 | 历史方案原文 | 暂不可得；S5 用合成方案；论文明示 synthetic | ✅ |
| Q6 | 论文数据脱敏与署名 | 匿名；脱敏方法见 `docs/evaluation.md` §7；署名单位 S6 再定 | ✅（署名待定） |
| Q7 | 部署形态 | Web profile；未来局域网开放 ip:port；看板可写（规则 / 候选 / 复核）、鉴权沿用 DSH；细粒度权限后置 | ✅ 2026-10-23 修订 |
| Q8 | 正式公文模板样例 | 若有正式红头/表单模板，提供样例后在 `review-protocol.md` §6 增加模板变体；默认沿用历史意见格式 | ⬜ 不阻塞 |
| Q9 | 专家身份 | 局域网多人使用时如何区分专家：默认每个会话首次复核前用 `ask_user_question` 问一次姓名/工号并写入 `reviews.reviewer`；不自建账号体系 | ⬜ 不阻塞，按默认 |
| Q10 | S3c 真机种子审查 | 2026-10-23 已跑通：`rv_20261023_xnhfjz`，10 条、全部采纳、`finalVerdict=不通过`、意见文件已生成；使用 `DEEPSEEK_API_KEY` 走 headless，无需 web 登录 | ✅ |

## 5. 推迟 / 拒绝

| 事项 | 处理 | 原因 |
|---|---|---|
| 相似方案向量检索 | 拒绝 | 决策 1；与「改完即生效」「可解释」冲突 |
| 运行时 p95/p99 数据接入 | 推迟 | 无数据源；相关规则降为 soft |
| 历史图片时序图多模态逆向 | 推迟（离线、插件外） | 不在在线审查路径 |
| 台账 / 运营视图 | 拒绝 | 决策 5 |
| Word 公文生成器 | 拒绝 | 用 office skill 转换 Markdown |
| 软著说明书 | 推迟 | 与研究无关 |
| 看板设置卡片 | 推迟 | 见决策日志 2026-10-27；需要时按 `plugins.item` + `configForms` 接入 |
| 看板起草规则 YAML / 看板定稿 | 拒绝 | 起草需要模型理解上下文，定稿要写文件并 `present`，都留在对话；看板只审批与复核 |
| 看板「回到对话」链接 | 推迟 | 工具上下文取不到稳定 sessionId |
| 看板细粒度权限 / CSRF token | 推迟 | 同源 + DSH 连接围栏已覆盖单人 / 小范围局域网 |

## 6. 证据

| 步骤 | 证据 |
|---|---|
| S0 | 2026-10-23 按用户决策 `git rm -r archive`（34 path）；`AGENTS.md`、`progress.md` 保留；README 目录表移除归档行 |
| S2 | `plugins/wsgw-solution-review/`：`pnpm install && pnpm typecheck && pnpm test` → `Tests 117 failed | 97 skipped | 107 todo (321)`（failed/skipped 全部源于 `NotImplementedError`，skipped 为 `beforeAll` 内 stub 抛错连带）；三次提交 `chore(review)` / `feat(review)` / `test(review)` | 
| S3a | `pnpm test` → `Tests 214 passed | 107 todo (321)`；`pnpm bench` → 200 KB `check()` 0.54 s（首版 19.6 s，`offsetAt` 每句重扫源文件为 O(n²)，改为行号索引 + 按 Doc 缓存句子/全文后修复）；`pnpm typecheck` 通过；五次提交 `feat(review)` ×4 / `perf(review)` ×1 |
| S3b / S3c | `pnpm typecheck` 通过；`pnpm test` → `Tests 284 passed | 53 todo (337)`；`pnpm build` 生成 `lib/`。真机（Node v22.23.3，隔离 `DSH_HOME`）：`npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web add .` → `+ wsgw-solution-review link:…`，`dsh.profile.bundles` 追加；`--profile web --dump-config` 第 1230–1308 行为 `wsgw-solution-review` 与 `preset-wsgw-solution-review` 两行；`dsh web --no-open` 启动无告警，浏览器中：模式下拉出现「方案审查」、Plugins 页列出插件（启用）、`/` 面板列出 memory / review / rules，`/rules hard` 返回 10 行（CAP-002 CAP-006 INT-001 INT-004 DOC-001 DOC-002 DOC-005 DOC-010 DOC-011 DOC-012），`/review` 返回「暂无审查记录…」，`/memory CAP-001` 返回统计 0/0/0/0。已知 UI 现象：在「新会话」页直接回车命令不会切到会话视图，结果在会话创建后一并显示；带参数提示的命令需回车两次（第一次只是接受补全） |
| P0（2026-10-23） | `pnpm typecheck` 通过；`pnpm test` → `Tests 288 passed | 53 todo (341)`；`pnpm build` 通过。工具输出已含自动登记问题/候选原文/soft 规则/检查清单与计数（`review_check`、`review_status`、`rules_list`）；hybrid 无候选一律 `pending`，`whenNoCandidate: fail` 仅允许 hard；LLM 的 absence 伪引文被 `ABSENCE_NOT_ALLOWED` 拒绝，校验器 absence 统一标注「非引文」。新增 `invalid-hybrid-fail.yaml`、renderer / gate / hybrid 断言；`review_check` 种子期望改为 `建议整改`（3 条 hard 自动登记，CAP-001 / CHN-001 转 pending）。 |
| S3c 协议回放（2026-10-23） | `pnpm test` → `Tests 299 passed | 37 todo (336)`（较 P0 +11）；`pnpm typecheck` / `pnpm build` 通过。`tests/protocol/protocol.e2e.ts` 用脚本化 agent 跑通 parse → check（3 hard / 7 candidates / 1 pending）→ memory_recall ×7 → record_issue ×8 → status（11 条）→ 批次 5/5/1 → decide ×14 → set_reviewer → set_final_verdict → finalize；正式意见与 `tests/fixtures/expected/opinion-seed.md` 归一化后逐字相等。真机：`DEEPSEEK_API_KEY` + headless + 插件 tools，真实模型完成 `rv_20261023_xnhfjz`（10 条、全部采纳、finalized、`reviews/rv_20261023_xnhfjz.md`）；headless 临时安装已移除。 |
| S4（2026-10-27） | `pnpm typecheck` / `pnpm build` / `pnpm check:bundle` 通过（`lib/client.js` 46,552 bytes，仅外部化 `react`，无 host 代码）；`pnpm test` → `Tests 337 passed | 15 todo (352)`。`tests/api/routes.spec.ts` 16 passed / 1 todo（路由可匹配性、连接围栏 401/403 透传、规则详情、候选接受草案、配置默认值与 patch 行一致）；`tests/client/dashboard.spec.tsx` 17 passed（tab 定义、纯函数、SSR 渲染四页标记、无 web storage / prompt / 硬编码颜色）；`tests/tools/tools.spec.ts` 51 passed（重复 check 拒绝、adopt_rest 只采纳 confirmed、答案归一化、定稿后修改回 open、stats-only 不算覆盖、改回出厂值撤销覆盖）。headless 真机（Node v22.23.4，隔离 `DSH_HOME`，`npx @deepseek-ai/dsh@0.2.1-rc.2`）：`plugin --profile web add` 成功；`--dump-config` 第 1230 行起为插件行与 preset 行；`dsh web --no-open --port 7788` 首页预加载组含 `wsgw-solution-review/client.js`（位于 sidebar-right 之后），带 rev 请求返回 200 / 46,594 bytes 且以 `window.__ModuleLoader__.load({ id: "wsgw-solution-review"` 开头；API：`GET /rules` 28 条、`/rules/CAP-001` 详情含 shipped 与 verifier、PATCH 改级 → `+ov1`、改回 → 覆盖清空版本复原、坏参数 400、跨源 403、无 cookie 401、未知审查 / 候选返回插件 JSON 404；重启后审计保留。修复前 `/rules/:id` 为空 404、PATCH 为 405。 |
| S1 | `plugins/wsgw-solution-review/docs/` 六份文档：requirements（FR 31 条 / NFR 9 / AC 10 / T-REQ 20）、design（T-DES 14）、rule-schema（28 条规则分级：hard 10 / hybrid 13 / soft 5；T-RUL 12）、review-protocol（SKILL.md 与 persona 初稿；T-PRO 10）、evaluation（指标 / 合成集 / 消融 7 组 / 脱敏；T-EVA 9）、dashboard（T-DSH 9）。测试要点合计 74 条 |

## 7. 下一步

S3c 已于 2026-10-23 收口：脚本化协议回放 11 条全绿；真机 `rv_20261023_xnhfjz` 用 `DEEPSEEK_API_KEY` 走通（10 条、全部采纳、finalized、意见文件已生成），headless 临时安装已移除。

S4 当前 🟡：自动化与 headless 真机已过，剩用户本机 GUI 冒烟。完成后进入 P1：按文档类型 / 变更类型决定规则适用范围（用户最初的核心痛点）。

**GUI 冒烟清单（用户本机执行，结果回填 §6）**

准备：`git pull` → `cd plugins/wsgw-solution-review && pnpm install && pnpm run build` → 已装过的 profile 只需重启 `dsh web`（link 安装，`lib/` 即时生效）；未装过用 `pnpm dsh:install`。client 改动后刷新页面即可，host 改动需重启。

1. 入口：右侧栏引导页出现「方案审查看板」（描述「规则 · 审查记录 · 记忆 · 评测」）；点开后 chip 标题「方案审查」，默认页「审查记录」。切换会话后看板仍在（`keepMounted`）。
2. 预审：模式切到「方案审查」，粘贴 `tests/fixtures/seed.md`（或任意方案）说「预审这份方案」；完成后点看板「刷新」，列表出现新记录，状态「进行中」。
3. 复核（看板内）：进入记录 → 对一条问题点「采纳」、一条点「驳回」并填原因、一条点「改写」填文本；每次写后数字与「当前预审建议」随之变化；不出现浏览器原生弹窗。
4. 结论：未署名时「确认最终结论」给出需要署名的提示；填审核人 →「保存署名」→ 选结论 →「确认最终结论」。
5. 定稿与过期：回对话让 agent `review_finalize`；看板刷新后为「已定稿」。再在看板改一条决定 → 状态变「需重新定稿」并出现「旧意见文件已过期」提示；回对话再定稿得到 v2。
6. 对话复核：在对话里回答「驳回：方案 3.2 已说明」「采纳，但改成：…」，看板中分别显示为驳回（原因已记）与改写。
7. 规则页：维度 / 层级 / 状态筛选有结果；展开一条看到问题、依据、校验器、适用范围；「停用」后标「已覆盖」，再「启用」后「已覆盖」消失；改严重级别同理。
8. 记忆页：定稿过的规则出现采纳 / 驳回 / 改写计数与范例；专家新增意见出现在候选区，未起草的只有「忽略」，起草后出现「接受草案」。
9. 评测页：无数据时显示「尚无评测结果…」。
10. 主题与异常：切深色主题文字与边框可读；停掉 `dsh web` 后点「刷新」出现错误条与「重试」，重启后重试恢复。
11. 回填：每项 ✅ / ❌ + 截图或一句现象；录一段 1–2 分钟操作录屏留作 S4 验收证据。

S5 的 npm 发布仍只支持本地目录安装。

论文侧（暂停中）：`paper/innovation-notes.md` v0.2；S3b 已落实「规则包有效版本号」反向要求（`reviews.rulePackVersion = pack@ver+ovN`）。

环境备注：本机 Node 需 ≥ 22.19（已用 nvm 装 v22.23.3）；`DSH_HOME` 可指向任意目录做隔离验证。
