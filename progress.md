# progress.md — dsh-solution-review 进度

> 只记状态、证据与决策，不复述设计（设计见 `AGENTS.md` 与 `plugins/dsh-solution-review/docs/`）。
> 更新：2026-10-19　|　当前步骤：**S0 完成，S1 待开始**

## 1. 步骤总览

每一步都按「文档 → 测试用例 → 开发」推进；一步未达「完成定义」不进入下一步。用户可在任何步骤调整方向，调整先落文档。

| 步骤 | 内容 | 完成定义 | 状态 |
|---|---|---|---|
| S0 | 归档旧版、建立 `AGENTS.md` / `progress.md` | 旧 32 文件在 `archive/`；两份指引可读；PR 已开 | ✅ 2026-10-19 |
| S1 | 文档定稿：需求 V1.0、设计 V1.0、规则 schema、对话协议、评测方案、dashboard 规格 | 六份文档互不矛盾，用户确认；每份文档末尾有「测试要点」清单供 S2 取用 | ⬜ |
| S2 | 测试用例：工程骨架 + fixtures + 全部用例（红灯 / todo） | `pnpm test` 能跑，用例数与 S1 测试要点一一对应 | ⬜ |
| S3a | Host 引擎（纯函数）：Markdown/Mermaid 解析、6 种校验器、证据门禁、结论策略、记忆聚合 | S2 对应用例全绿；无 I/O | ⬜ |
| S3b | Host 存储与工具：storage domain、`review_*` / `rules_*` / `memory_recall` 工具、命令、设置 | 契约测试绿；`--dump-config` 能组装 | ⬜ |
| S3c | agent preset + persona + skill + `cordis.patch.yml`；协议回放测试 | 用 mock LLM 回放「预审→复核→定稿」全程，落库与交付文件断言通过；真机 `dsh web` 走通种子方案 | ⬜ |
| S4 | Client dashboard（sidebar-right tab 四页）+ 设置卡片 + 只读 API | bundle 校验脚本通过；页面展示规则 / 记录 / 记忆 / 评测；录屏 | ⬜ |
| S5 | 数据迁移与评测：24 条规则重写入新 schema；30 条历史意见做覆盖分析与分布校准；批量评测路径（`ctx.llm`）；消融实验脚本 | `eval_runs` 有首批结果；消融四组可一键复现 | ⬜ |
| S6 | 论文：大纲 → 实验 → 稿件（Applied Sciences 模板） | 稿件初稿 + 图表 + 可复现包 | ⬜ |

## 2. 各步骤交付清单

### S1 文档（`plugins/dsh-solution-review/docs/`）

| 文件 | 内容要点 |
|---|---|
| `requirements.md` | V1.0：用户与场景、三阶段流程、输入规范（Markdown + Mermaid 强制）、输出三层结构、复核与回流、非功能（时延、内网、可观测）、验收标准、不做清单 |
| `design.md` | 插件组成、`cordis.patch.yml` 与 preset 行、服务与 inject、数据模型（storage domain spec 草案）、工具清单与 schema、命令、HTTP 路由、错误与降级、安全（路由同源校验、文件只读） |
| `rule-schema.md` | 规则 YAML schema、三级 tier 语义、6 种校验器的输入 / 输出 / 证据锚点格式、否定词与占位词表、shipped/learned 分层与覆盖规则、规则生命周期（draft→active→retired） |
| `review-protocol.md` | 对话协议：命令与触发、skill SOP 文本初稿、`ask_user_question` 批次与选项文案、专家自然语言意见的归一化、定稿模板（公文风格，取自历史意见格式）、异常路径（无证据、专家中途退出、重复审查） |
| `evaluation.md` | 指标定义（`AGENTS.md` §5.3 展开）、在线标注规则、离线评测集构建、消融设计、统计方法、数据脱敏 |
| `dashboard.md` | 四页信息架构、每页数据来源（表 / 聚合）、交互（规则启停、候选规则审批入口只读 + 跳转对话）、空状态、slot 与 tab 注册 |

### S2 测试（`plugins/dsh-solution-review/tests/`）

- `fixtures/`：种子方案 + 变体（缺压测、否定句、无 Mermaid、附件引用缺失、占位表格）、规则 YAML 样例、预期问题清单。
- `engine/*.spec.ts`：解析器、每种校验器、证据门禁、结论策略、记忆聚合。
- `store/*.spec.ts`：domain spec、读写、版本。
- `tools/*.spec.ts`：工具 schema 与 execute 契约。
- `protocol/*.e2e.ts`：mock LLM 回放。
- `client/check-bundle.mjs`：bundle 结构校验。

### S3–S6

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

## 4. 开放问题（给出默认值，不阻塞）

| # | 问题 | 默认 | 需要用户何时拍板 |
|---|---|---|---|
| Q1 | 插件包名 | 目录与包名暂用 `dsh-solution-review`；发布前再决定是否加 npm scope | S4 前 |
| Q2 | 模型与接入 | 走 DSH 自带 provider（DeepSeek 账号 / API key）；内网模型通过 DSH 的自定义 provider 配置，插件不感知 | S3c 真机验证前 |
| Q3 | 正式意见格式 | 采用历史意见格式：`意见：<结论>` + `（1）（2）…` 分点；如有正式公文模板请提供样例 | S1 `review-protocol.md` |
| Q4 | 首批规则范围 | 从 24 条中迁移：有结构可验证的进 hard / hybrid（预计 15 条左右），`llm+data` 两条退役，其余 soft | S1 `rule-schema.md` 定稿后、S5 迁移时 |
| Q5 | 历史方案原文 | 若能拿到 30 条意见对应的方案 Markdown（或 Word，用 office skill 转），离线评测可提前到 S5 初；否则只做在线标注 | S5 前 |
| Q6 | 论文数据脱敏与署名 | 方案与意见脱敏后作为匿名数据集随稿件开源；署名、单位待定 | S6 |
| Q7 | 部署形态 | DSH Web（`dsh web`）单机；Desktop 不单独验证 | S3c |

## 5. 推迟 / 拒绝

| 事项 | 处理 | 原因 |
|---|---|---|
| 相似方案向量检索 | 拒绝 | 决策 1；与「改完即生效」「可解释」冲突 |
| 运行时 p95/p99 数据接入 | 推迟 | 无数据源；相关规则降为 soft |
| 历史图片时序图多模态逆向 | 推迟（离线、插件外） | 不在在线审查路径 |
| 台账 / 运营视图 | 拒绝 | 决策 5 |
| Word 公文生成器 | 拒绝 | 用 office skill 转换 Markdown |
| 软著说明书 | 推迟 | 与研究无关 |

## 6. 证据

| 步骤 | 证据 |
|---|---|
| S0 | `git mv` 32 个文件到 `archive/legacy-review-tool/`（见 commit）；`AGENTS.md`、`progress.md`、`archive/README.md` 新建；README 目录表指向新项目 |

## 7. 下一步

S1 第一份文档：`plugins/dsh-solution-review/docs/requirements.md`（V1.0）。写法：以 `AGENTS.md` §2、§4 为纲，逐条给出验收标准与测试要点；完成后请用户确认，再写 `design.md`。
