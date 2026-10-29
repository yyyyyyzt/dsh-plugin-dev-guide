# progress.md — wsgw-solution-review 进度

> 只记状态、证据与决策，不复述设计（设计见 `AGENTS.md` 与 `plugins/wsgw-solution-review/docs/`）。
> 更新：2026-10-29　|　当前步骤：**S4 看板 V2 + 第二轮反馈（口语化复核、中文级别、同一方案只留一条记录）已实现并发布 `wsgw-solution-review-v0.1.0-dev.1`；待用户本机 GUI 冒烟，清单见 §7。论文侧 2026-10-29 完成创新点复审 v0.3 与英文初稿（S6 🟡），结果章节待 S5 数据**

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
| S4 | 看板 V2（`dashboard.md` V2.0）：左侧栏主面板（审查 / 规则 / 评测）+ 右侧栏复核助手 + 可写 API（规则含建议 / 恢复出厂、候选、复核）；设置卡片推迟 | bundle 校验脚本通过；主面板可看审查量、展开复核、编辑规则；录屏 | 🟡 2026-10-28：V2 完成，`pnpm test` 355 passed / 15 todo；`build` / `check:bundle` 通过（76,607 bytes）；headless 真机 API + Chrome 无头浏览器走查（§6）。V1（右栏四页，2026-10-27）已被替换。剩余：用户本机 GUI 冒烟（§7 清单）与录屏 |
| S5 | 数据迁移与评测：24 条规则重写入新 schema；原 30 条历史意见已删除（仅保留 45 个意见点的分布口径），覆盖分析改用合成方案；批量评测路径（`ctx.llm`）；消融实验脚本 | `eval_runs` 有首批结果；消融四组可一键复现 | ⬜ |
| S6 | 论文：大纲 → 实验 → 稿件（候选 *Frontiers in Computer Science* Software 栏目，备选 MDPI *Computers*；正式切换待用户确认，见 Q11） | 稿件初稿 + 图表 + 可复现包 | 🟡 2026-10-29 创新点复审 v0.3（`paper/innovation-notes.md` §10）+ 英文初稿 `paper/draft-en.md`（Frontiers Original Research 结构；§1–3、§5–6 成文，§4.3–4.5 结果与 8 幅图为 `[[TBD]]` 占位，待 S5 评测与 ≥30 份真实试点数据） |

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
| 2026-10-28 | 看板拆成两个入口：左侧栏全局面板「方案审查」（`sidebar.panellist` + `main`）做总览 / 全局规则 / 评测；右侧栏 tab 收窄为「复核助手」 | 用户反馈「不是我想要的 dashboard」：要左侧总览、每天审查量的日历或折线、方案点开即看结果、可编辑全局规则。右栏宽度放不下图表与规则表；DSH 已有同类一级页面机制，不需自建路由 |
| 2026-10-28 | 记忆并入规则行（展开即见统计、范例、驳回原因），不再单独成页 | 记忆本来就按规则号组织（决策 1），单独一页让专家在两处找同一条规则 |
| 2026-10-28 | 新增 `GET /overview`（全部审查紧凑摘要，≤ 2000 条）；日期分桶在浏览器按本地时区做 | 指标卡、日历、趋势、列表共用一份数据；Host 时区与专家时区可能不同 |
| 2026-10-28 | 规则全局编辑新增 `set_suggestion` 与 `reset`（`rules_propose` 与 `PATCH /rules/:id` 同步）；检查问题 / 依据 / 适用范围 / 校验器结构不在看板改 | 整改建议措辞是专家最常想改、且直接进入正式意见的字段；改语义等于新规则，应走起草 → 接受 |
| 2026-10-28 | 图表用内联 SVG，不引入图表库；热力图分级用 `color-mix` + 主题变量 | 铁律 6；bundle 外部化白名单只有 react / react-dom / cordis；深色主题自动适配 |
| 2026-10-28 | 对外分发改为 GitHub 发布 tag `wsgw-solution-review-v<version>`（无父提交，内容 = `pnpm pack` 产物 + 去掉 `scripts` / `devDependencies` 的清单），DSH 插件页填 `https://github.com/…#<tag>` 安装；本地目录 `link:` 只留给开发；取代 2026-10-20 的「不走 git 安装」 | 用户要在 Windows 桌面版上装：桌面版插件页支持包名 / Git 地址 / 本地路径，npm 版 `dsh` 拒绝管理 desktop profile；直接装仓库会在目标机上跑 `prepare` 构建（需 `allowBuilds`、拉 100 MB 开发依赖），且插件在子目录、`lib/` 不进 git。tag 不是分支，不改 main 内容；npm 发布仍推迟 |
| 2026-10-28 | 复核改为口语化：每条问题用大白话问（「…，要改吗？」+ 原文 + 建议改成），选项「要改，按这个建议 / 不用改 / 要改，但我换个说法」；登记的问题与建议要求具体可执行；`ask_user_question` 不存在的 `detail` 字段从协议中删除 | 用户反馈 agent 问「按降为 minor 后采纳处理，请确认整改建议措辞（级别调整需在规则层另行调整）」太抽象；根因是协议用规则术语和英文级别、单条问题不能调级别、只选「改写」不给内容时会把「改写」两个字存成改写文 |
| 2026-10-28 | `review_decide` 的 `adopt` / `rewrite` 可带 `severity` 只调这一条问题（记 `severityFrom`），归一化识别「算轻微」「降为 minor 后采纳」；改规则级别仍走 `rules_propose`，要专家明说「以后 / 这类」 | 专家对单个方案的判断不应顺带改全局规则；也不应被要求去「规则层另行调整」 |
| 2026-10-28 | 级别与判定方式统一用中文业务名：严重 / 一般 / 轻微、程序检查 / AI 辅助 / 人工判断（工具文字输出、看板、话术）；数据与参数仍是英文值；规则页去掉「来源」行与「不在看板修改」提示，改为一行级别说明 | 用户：「major、minor 没人能理解」「冗余提示删掉」。不改 schema，只改呈现 |
| 2026-10-28 | 同一方案只留一条进行中记录：`contentKey`（去 BOM / 统一换行 / 去行尾空白）判重；新建时把同 contentKey / 路径 / 标题的「进行中且无决定」旧记录标 `superseded`；启动时收拢存量；新增 `discarded`（对话或看板作废）。已关闭记录保留、默认隐藏、不计数；schema 只放宽，`version` 不变 | 用户实测同一文件出现 3 条记录（1 条定稿 + 2 条进行中、都在 16:47）：原哈希按原始字节算，粘贴 / 路径 / 转换的空白差异即成新记录；协议又让「重开」保留旧记录。只做软关闭不物理删除：记录是审计与论文数据 |
| 2026-10-29 | 论文候选期刊改为 *Frontiers in Computer Science*（Software 栏目；WoS **ESCI** 非 SCIE、IF 3.4、JCR Q3、中科院 2025 升级版 4 区 / 2026-03 新锐 3 区），MDPI *Computers*（同为 ESCI，IF 5.2、JCR Q2）降为备选；文章类型按数据量定：≥30 份真实定稿审查投 Original Research，不足则 Technology and Code；叙事改动：编译器隐喻降为框架视角、RSI 只进讨论、RQ1–RQ4 对应四性质、标题不提「编译」；v0.2 创新点判定为「够用但需真实试点数据」，补充低成本方向 D1–D7（首选 D1 规则可验证性审计：28 条仅 10 条 hard、4 条 blocker 全为 hybrid）。`AGENTS.md` §5.4 待用户确认后同步 | 用户 2026-10-29 要求复审创新点是否够 SCI 3/4 区、是否合该刊风格并写英文初稿；结论与依据见 `paper/innovation-notes.md` §10，初稿见 `paper/draft-en.md` |

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
| Q11 | 论文目标期刊是否正式切换 | 默认：候选 *Frontiers in Computer Science*（Software），*Computers* 备选，`AGENTS.md` §5.4 暂不改；用户确认后同步。前置：单位对「SCI 3/4 区」的认定是否接受 ESCI（两刊均为 ESCI，中科院分区均有收录）；试点最低线 ≥30 份真实定稿审查，不足则改投 Technology and Code | ⬜ 不阻塞，按默认 |

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
| soft → hybrid 升级提示 | 推迟 | `rule-schema.md` §6.2 原计划；需要稳定关键词的统计口径，S5 评测后再定 |
| 看板编辑规则的检查问题 / 依据 / 适用范围 / 校验器 | 拒绝 | 改语义即新规则，走对话起草 → 接受，保证审计与可复现 |

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
| S4 V2（2026-10-28） | 提交 `32454c4` docs → `d15758d` test（红灯 5 条：`/overview` 未注册、`set_suggestion` / `reset` 不在枚举、client 模块缺失）→ `06e5864` host → `10677ae` client → `fb8f225` 走查后修正。`pnpm typecheck` / `pnpm build` / `pnpm check:bundle` 通过（76,607 bytes，仅外部化 `react`，sourcemap 只含 `src/client/*` 与纯类型模块 `src/host/api-types.ts`）；`pnpm test` → `Tests 355 passed | 15 todo (370)`：`dashboard.spec.tsx` 31（三处注册与 `openOverview → layout.selectPanel`、按本地日分桶、53×7 日历与级别、30 天趋势、五项指标、列表筛选、助手队列、建议校验与恢复出厂可用性、范例去重、SSR 各视图）；`routes.spec.ts` +2（`GET /overview` 顺序 / 状态 / 计数 / 无原文；PATCH `set_suggestion` 400 `BAD_SUGGESTION` / 成功 / `reset` 恢复与审计、草案 400）；`tools.spec.ts` +2（建议改写影响后续登记、改回出厂撤销；`reset` 一步恢复、保留统计、逐字段审计、草案拒绝）。headless 真机（`/opt/cursor/artifacts/headless-smoke.log`）：`/overview` 200、PATCH 新动作往返、无 cookie 401；合并脚本含新 client。Chrome 无头走查（种子 23 条，`v2-browser-walk.log`）：左侧栏出现「方案审查」并打开主面板；371 格、21 格非零；指标 23 / 18 / 3（需重新定稿 1）/ 89% / 90%；点 10月28日 → 2 行；趋势 2 条线；展开进行中记录 9 个复核按钮；规则 28 行；深色主题可读；控制台 0 错误。走查发现并修正：空格子在浅色主题不可见、行内计数被截断、同一范例重复 12 行、审计字段为英文、采纳率列换行。复核助手需要真实会话（右侧栏随会话出现），未在无头环境覆盖，列入 §7。 |
| 分发（2026-10-28） | 提交 `3e81552` docs → `2a8915d` test（红灯：`scripts/release.mjs` 缺失）→ `ff7985e` feat → `185986c` 修正。`pnpm typecheck` 通过；`pnpm test` → `Tests 361 passed | 15 todo (376)`（`tests/host/release.spec.ts` 6：清单去 `scripts` / `devDependencies`、无 `prepare`、`exports` 均被 `files` 覆盖、tag 名、GitHub 安装地址、非 GitHub 拒绝）。`pnpm run release` → tag `wsgw-solution-review-v0.1.0-dev.0` → 提交 `94002e6`（无父提交），已推送。隔离 `DSH_HOME` 真机（`/opt/cursor/artifacts/github-release-install.log`）：tag 地址安装 65 个依赖、无构建；git 不可用时 sha 地址安装成功、tag 地址失败（pnpm 需 `git ls-remote` 解析 tag）；启动后 client 200 / 79,579 bytes、`/overview` 200、规则 28 条、preset 行存在。Windows 桌面版插件页安装待用户验证 |
| 第二轮反馈（2026-10-28） | 提交 `e06202d` / `4534cc5` docs → `6e1fbeb` test（红灯 30 条：去重 / 作废 / `REVIEW_CLOSED` / 单条调级别 / 口语答复归一化 / 中文级别 / 看板已作废与规则说明条）→ `f06e587` test 校正（回放 `review_decide` 计 15 次含一次「只说换个说法」被拒、同标题夹具改名、`/review` 状态中文）→ `1054178` feat → `cccca99` 版本 0.1.0-dev.1。`pnpm typecheck` / `pnpm build` / `pnpm run check:bundle` 通过（80,614 bytes，仅外部化 `react`）；`pnpm test` → `Tests 386 passed | 15 todo (401)`。headless 真机（`/opt/cursor/artifacts/headless-smoke.log`）：在存储里放两条与已有记录同文的「进行中、无决定」副本（其一为 CRLF 换行）后重启 → 两条均 `closed`「被 rv_… 取代」；`POST /reviews/:id/discard` 200、重复作废 400 `REVIEW_CLOSED`；对已取代记录写入 400 并提示新编号；`GET /rules` 带 `minorThreshold`。发布：`pnpm run release --push` → tag `wsgw-solution-review-v0.1.0-dev.1` → 提交 `c38bfbd`；在装有 dev.0 的隔离 `DSH_HOME` 里 `dsh plugin add <tag 地址>` 原地升级（+1 包），启动后 `/overview` 200、规则 28 条、client 83,988 bytes 含新文案（`github-release-install.log` 末段） |
| S1 | `plugins/wsgw-solution-review/docs/` 六份文档：requirements（FR 31 条 / NFR 9 / AC 10 / T-REQ 20）、design（T-DES 14）、rule-schema（28 条规则分级：hard 10 / hybrid 13 / soft 5；T-RUL 12）、review-protocol（SKILL.md 与 persona 初稿；T-PRO 10）、evaluation（指标 / 合成集 / 消融 7 组 / 脱敏；T-EVA 9）、dashboard（T-DSH 9）。测试要点合计 74 条 |
| S6 预备（2026-10-29） | 提交 `8259c65`（`paper/innovation-notes.md` §10 复审）→ 英文初稿 `paper/draft-en.md`。初稿体检（脚本，仓库外）：摘要 349 词（刊限 350）；正文约 7,600 词不含表 / 8,500 词含表（刊限 12,000，结果章节占位将再加 1,500–2,500）；参考文献 27 条，在文列表与文内引用双向一致，其中 2025–2026 年 10 条与 2 个脚注网页来源已逐条核实存在；`[[TBD]]` 占位 32 处（摘要 3、§3.9 模型与伦理 2、§4.3–4.6 结果 5、§5 / §6 4、文末声明 5、图 8、作者 2 等）；表 1–9、图 1–8 按首次出现编号；脱敏扫描（网上国网 / 国网 / 支付宝 / state grid / wsgw / deepseek / 江苏 等）无命中。规则分布数字（tier × severity：blocker 0/4/0、major 6/7/3、minor 4/2/2；校验器用量 section 9 / table 3 / statement 16 / quantity 1 / mermaid 3 / cross-ref 3）由 `rules/capability-open-access.rules.yaml` 用 PyYAML 现算 |

## 7. 下一步

S3c 已于 2026-10-23 收口：脚本化协议回放 11 条全绿；真机 `rv_20261023_xnhfjz` 用 `DEEPSEEK_API_KEY` 走通（10 条、全部采纳、finalized、意见文件已生成），headless 临时安装已移除。

S4 当前 🟡：看板 V2 自动化、headless API 与无头浏览器走查已过，剩用户本机 GUI 冒烟（重点：复核助手、真实会话里的刷新时机、窄窗口）。完成后进入 P1：按文档类型 / 变更类型决定规则适用范围（用户最初的核心痛点）。

**GUI 冒烟清单 V2（用户本机执行，结果回填 §6）**

准备：`git pull` → `cd plugins/wsgw-solution-review && pnpm install && pnpm run build` → 重启 `dsh web`（本次有 host 改动：`/overview` 与规则建议 / 恢复出厂）；之后只改 client 时刷新页面即可。

1. 入口：左侧栏「定时任务」下方出现「方案审查」（剪贴板图标），点开占据中间主区域，标题「方案审查」+「刷新」，页签「审查 / 规则 / 评测」，默认「审查」。点任一会话回到对话，再点「方案审查」回来。
2. 预审：新会话模式选「方案审查」，粘贴 `tests/fixtures/seed.md` 说「预审这份方案」；完成后回主面板点「刷新」：累计 +1、待处理 +1，日历今天的格子变深，列表首行为新方案「进行中」。
3. 日历 / 趋势：悬停格子显示「M月D日 · n 份（已定稿 k）」；点今天 → 列表只剩今天的方案，筛选条出现「M月D日 ×」；再点同一格或点 × 取消。切「趋势」看到两条线（发起实线、定稿虚线），悬停显示当天数字。
4. 指标卡：点「待处理」→ 状态筛选切到「待处理」且卡片描边高亮，再点取消；「问题采纳率」「结论一致率」在第一次定稿后出现数值。
5. 展开复核：点新方案整行 → 行下就地展开结果；对一条「采纳」、一条「驳回」填原因、一条「改写」；每次写后行内计数（待复核 / 采纳 / 驳回 / 改写）与指标卡同步变化；同一时刻只展开一行；无浏览器原生弹窗。
6. 署名与结论：未署名时有提示；填审核人 → 保存 → 选结论 → 确认；行内「最终」从「未定」变为所选结论。
7. 定稿与过期：回对话让 agent 定稿 → 刷新后行状态「已定稿」，结论一致率出现；再在展开行改一条决定 → 状态「需重新定稿」（橙色）+ 过期提示，「待处理」卡副文「需重新定稿 1」。
8. 规则编辑：「规则」页签 → 搜索 `CAP-002` → 展开：左「内容」、中「编辑（全局生效）」、右「记忆」。改「整改建议」→「保存建议」→ 行出现「已覆盖」，中栏显示「已覆盖出厂值 / 整改建议：已修改（出厂：…）」，最近变更显示「整改建议：旧 → 新」；再预审一份方案，CAP-002 的问题建议是新文本。点「恢复出厂」→ 出现「确认恢复 / 取消」→ 确认后「已覆盖」消失。「只看已覆盖」胶囊可筛出被改过的规则。
9. 停用 / 级别：停用一条规则 → 行变灰「停用」，下一次预审不再出现该规则的问题；启用复原；改级别后行内级别颜色变化。
10. 候选规则：在对话里补充一条不对应任何规则的意见并定稿 → 「规则」页签顶部出现「候选规则」，未起草只有「忽略」；让 agent 起草后出现「接受草案 RULE-ID」，接受后该规则出现在表格中为「启用」。
11. 复核助手：在「方案审查」会话里打开右侧栏引导页「方案审查 · 复核助手」：列出进行中 / 需重新定稿的审查（多于一条时有下拉），可直接采纳 / 驳回 / 改写；「打开总览」切到左侧主面板；无待处理时显示空状态与「打开总览」。
12. 主题与异常：切深色主题，日历、折线、胶囊、文字可读；停掉 `dsh web` 后点「刷新」出现错误条与「重试」，重启后重试恢复；窄窗口下指标卡换行、日历可横向滚动。
13. 回填：每项 ✅ / ❌ + 截图或一句现象；录一段 1–2 分钟操作录屏留作 S4 验收证据。

**第二轮补充冒烟（0.1.0-dev.1）**

升级：插件页填 `https://github.com/yyyyyyzt/dsh-plugin-dev-guide#wsgw-solution-review-v0.1.0-dev.1`（无 git 用 `#c38bfbd2d3405980f29a38a8c48e0ede5707c2fa`）→ 重启 DSH。

14. 重复记录：重启后「审查」列表里原来同一文件的 3 条只剩 1 条（已定稿那条）；筛选条出现「已作废」，点开能看到另外 2 条「已被 rv_… 取代」，只读、无按钮；指标卡与日历不再计入它们。
15. 再预审同一文件（粘贴或路径均可）：agent 说「这份方案之前审过，接着上次的进度来」，列表不新增记录；明确说「从头再审」才新建，旧的未决记录自动变「已作废」。
16. 作废：展开任一未关闭记录，底部「作废这条记录」→ 填原因 →「确认作废」→ 该行移入「已作废」。
17. 口语化复核：每条问题形如「第 n 条 · 一般」+「……，要改吗？」+ 原文 + 建议改成；选项「要改，按这个建议（推荐）/ 不用改 / 要改，但我换个说法」；只选「换个说法」时 agent 追问「您想怎么写」；说「算轻微」只改这一条级别，看板显示「一般 → 轻微」，规则页不变。
18. 规则页：表格上方一行说明「严重：出现一条就建议不通过 · 一般：出现一条就建议整改 · 轻微：累计 3 条才建议整改」与判定方式说明；列名「判定方式」、级别显示中文；展开后没有「来源：」和「不在看板修改」提示。

分发：其他机器（含 Windows 桌面版）用 GitHub 发布 tag 安装，见 `plugins/wsgw-solution-review/docs/design.md` §16 与插件 README；npm 发布仍推迟。

论文侧（S6 🟡，2026-10-29）：`paper/innovation-notes.md` v0.2 + §10 复审；英文初稿 `paper/draft-en.md`（Frontiers in Computer Science Original Research 结构，文内 `<!-- DRAFT STATUS -->` 块记录版本、改投 Technology and Code 的改法与脱敏约定）。S3b 已落实「规则包有效版本号」反向要求（`reviews.rulePackVersion = pack@ver+ovN`）。待办按先后：① 用户拍板 Q11（期刊切换 / ESCI 认定 / 试点最低线），确认后同步 `AGENTS.md` §5.4；② S5 评测跑出 `eval_runs` 后填 §4.3 与图 7 消融部分；③ 真实试点累计 ≥30 份定稿审查后填 §4.4–4.5、图 7–8、摘要与结论中的 `[[TBD]]`；④ 补 §3.9 模型名与版本、伦理 / 同意措辞、作者与 CRediT、Generative AI 声明、数据仓库 DOI（公开仓库名含产品缩写，需决定是否从中性命名的镜像发布）；⑤ 2024 年以前的参考文献逐条核对卷期页码 DOI；⑥ 绘图 1–5（引入路线、可验证性谱与三层、审查流水线、复核即反馈、插件架构）与看板脱敏截图（图 6）。

环境备注：本机 Node 需 ≥ 22.19（已用 nvm 装 v22.23.3）；`DSH_HOME` 可指向任意目录做隔离验证。
