# wsgw-solution-review 需求规格 V1.0

> 状态：S1 定稿候选（2026-10-19）。本文是功能与验收的唯一事实来源；设计见 `design.md`，规则见 `rule-schema.md`，对话细节见 `review-protocol.md`，评测见 `evaluation.md`，看板见 `dashboard.md`。
> 编号约定：`FR-*` 功能需求、`NFR-*` 非功能需求、`AC-*` 验收标准、`T-REQ-*` 测试要点（供 S2 取用）。

## 1. 背景与目标

网上国网（wsgw）每周有数十份技术方案需要专家预审，历史意见（30 份样本）显示问题高度集中在容量 / 安全 / 接口 / 文档四个维度，且措辞高度模板化（原 30 份 / 45 个意见点；原始数据已于 2026-10-23 随 archive 删除，仅保留分布口径）。第一版工具（Python 原型）失败的根因是「规则已声明 ≠ 规则可验证」、无证据、无记忆、无反馈闭环（`AGENTS.md` §7）。

V1.0 目标：在 DeepSeek Harness（DSH）里提供一个**对话式预审 agent**，让专家：

1. 把方案（Markdown）交给 agent，得到带**可验证证据**的预审建议；
2. 在同一会话中逐条**采纳 / 驳回 / 改写 / 新增**，确认最终结论；
3. 一键得到公文风格的**正式意见**文件；
4. 每一次决定都成为**持久记忆**，下一次审查自动受益；
5. 在右侧看板上随时**复核规则、记录、记忆与评测**。

非目标见 §12。

## 2. 用户与场景

| 角色 | 描述 | V1.0 入口 |
|---|---|---|
| 审核专家（主用户） | 技术评审岗，负责出具预审意见；熟悉业务，不一定熟悉工具 | DSH Web 会话（选择「方案审查」agent preset）+ 右侧看板 |
| 规则维护者 | 通常就是资深专家；维护规则包、审批候选规则 | 同上：对话或看板调整规则 / 审批候选 |
| 方案提交人 | 写方案的研发 | **V1.0 不直接使用**；收到正式意见 Markdown |
| 研究者 | 做评测与论文 | 看板评测页 + `paper/` 脚本 |

试点场景：**能力开放 / 三方接入**（支付宝、微信、鸿蒙等渠道接入网上国网能力）。种子方案：`tests/fixtures/seed.md`（合成，能力开放场景；原历史种子已删除）。

## 3. 术语

| 术语 | 定义 |
|---|---|
| 方案 | 一份技术方案文档，V1.0 输入格式为 Markdown（含 Mermaid） |
| 规则 | 一条可执行的审查要求，带 `tier`（hard / hybrid / soft）与 `severity`（blocker / major / minor），见 `rule-schema.md` |
| 问题（issue） | 某条规则在某份方案上的一次命中，含证据与建议 |
| 证据（evidence） | 方案原文的引用片段 + 定位锚点；必须能在原文中子串命中 |
| 证据门禁 | 工具层对证据的强制校验；不通过则问题降级为 `待人工` |
| `ai_verdict` | 由确定性策略从已确认问题算出的结论建议（通过 / 建议整改 / 不通过） |
| `final_verdict` | 专家确认的最终结论；只有专家能写 |
| 复核 | 专家对每条问题的 采纳 / 驳回 / 改写，以及新增问题 |
| 回流 | 复核结果写入记忆（反馈、措辞范例、候选规则、规则运行态） |
| shipped / learned 规则层 | 随包发布的 YAML 规则 / 运行期由专家改动与学习得到的覆盖层 |

## 4. 范围

### 4.1 包含

- 单会话内完成三阶段协议：预审 → 复核 → 定稿与回流。
- 规则引擎：Markdown + Mermaid 解析、6 类确定性校验器、证据门禁、确定性结论策略。
- 记忆：规则运行态、审查记录、问题、反馈、措辞范例、候选规则、评测结果（全部走 DSH storage domain）。
- 命令：`/review`、`/rules`、`/memory`（host 侧即时查询）。
- 右侧看板四页：规则 / 审查记录 / 记忆 / 评测。
- 设置卡片：结论阈值、输出目录、专家默认署名。
- 批量评测路径与消融实验脚本（S5）。

### 4.2 不包含（见 §12）

## 5. 输入规范

### 5.1 格式

- **FR-01** 输入为 UTF-8 Markdown 文本：会话内粘贴、给出工作目录内文件路径，或 `.docx` 文件（agent 先用 `dsh-skill-office` 转为 Markdown，再进入审查；插件不做转换）。
- **FR-02** 单份方案上限 200 KB（可配置）；超限时拒绝并提示拆分。
- **FR-03** 方案应遵循网上国网技术方案模板的章节结构（下表）；缺失章节本身就是规则命中，不是解析失败。

| 模板位置 | 期望标题（允许的别名由 `rule-schema.md` 词表定义） | 关联规则维度 |
|---|---|---|
| 文首 | 资源变更清单表（序号 / 资源名称 / 变更类型 / 名称 / 内外网位置 / 数据存储 / 备注） | 文档 |
| 一 | 工作背景 | 安全合规、文档 |
| 二 / 2.1 | 技术思路及实现方式（接入方式、时序图、接口设计） | 接口、安全、文档 |
| 二 / 2.2 | 数据规划（数据流转、数据存储、数据增长估算） | 容量、数据同步 |
| 二 / 2.3 | 实施方案 | 容量（压测） |
| 二 / 2.4 | 上线目标 | — |
| 二 / 2.5 | 资源评估 | 容量 |
| 二 / 2.6 | 风险评估 | 安全、容量 |
| 三 | 附件 | 文档（交叉引用） |

### 5.2 时序图

- **FR-04** 关键链路（鉴权、业务查询、消息推送）的时序图必须以 Mermaid `sequenceDiagram` 代码块提供，才能被校验器检查。只有图片或「略」的，`DOC-001`（时序图完整性）判定为**不可验证**并作为问题登记（severity 按规则），建议文案提示「请用 Mermaid 重绘或补充文字描述」。
- **FR-05** 时序图校验内容：参与方（participant）≥ 2、消息 ≥ 3、鉴权链路必含「授权码 / code → openId / 手机号 → 校验授权 / 绑定 → 登录」等关键步骤的消息文本（词表见 `rule-schema.md`）。

### 5.3 表格

- **FR-06** 资源清单表与接口参数表按列名识别；占位单元格（`/`、`无`、`略`、`-`、空）不算有效内容。

## 6. 功能需求：预审阶段

- **FR-10** 专家在「方案审查」preset 的会话里提交方案并要求预审；agent 按 skill SOP 依次调用 `review_parse` → `review_check` → 若干次 `review_record_issue` → `review_status`。
- **FR-11** `review_parse` 产出结构化大纲（标题树、表格、Mermaid 块、段落定位）与统计；重复提交同一文本（哈希相同）时提示已有记录并允许复用或新建。
- **FR-12** `review_check` 对全部 `active` 规则执行校验器：`hard` 规则的 `fail` 直接登记为问题（证据由校验器给出）；`hybrid` 规则产出候选片段交给 agent 判断，或在完全未提及（带 `absence` 证据）时直接登记为问题；`soft` 规则只返回规则清单；校验器判定 `not-applicable` 的规则不列为问题。
- **FR-13** agent 对每个 hybrid 候选与 soft 规则作语义判断后，通过 `review_record_issue` 登记问题；工具执行证据门禁（`rule-schema.md` §5）：
  - 引文归一化后必须在方案原文中子串命中，否则问题状态为 `pending`（待人工）；
  - `soft` 规则登记的问题一律 `pending`；
  - `hybrid` 规则登记的问题，引文必须落在校验器给出的候选片段范围内，否则 `pending`。
- **FR-14** `review_status` 返回当前 `ai_verdict`（由确定性策略计算，`design.md` §6）、三层输出（§8）与统计，agent 据此向专家呈现预审结果。
- **FR-15** 预审阶段 agent 不得写 `final_verdict`；工具层拒绝（`review_decide` 之外没有写入口）。
- **FR-16** 记忆召回：agent 在撰写建议前可调用 `memory_recall(ruleId)` 获取该规则的历史采纳率、驳回原因、措辞范例，并优先使用范例措辞；驳回率 ≥ 配置阈值（默认 0.6，且样本 ≥ 5）的规则，建议文案中标注「历史上该项常被驳回，请专家重点确认」。

## 7. 功能需求：复核阶段

- **FR-20** agent 用 `ask_user_question` 分批呈现问题，每批 ≤ 5 条（可配置），每条一个问题项：`question` = 「规则号 · 标题 · 严重级别」，`detail` = 发现 + 证据引文 + 建议，`options` = `采纳（推荐）` / `驳回` / `改写`；`改写` 与自由文本（`custom`）均视为改写。`pending` 问题同样呈现，但选项为 `确认为问题` / `不是问题`。
- **FR-21** 每个回答经 `review_decide` 落库为 `feedback`：`adopt` / `reject` / `rewrite`，可带原因；`rewrite` 必须带文本。
- **FR-22** 专家可用自然语言新增问题（如「还要补充幂等说明」）；agent 调用 `review_decide(action: 'add')`，新增问题来源标为 `expert`，可选关联规则号；无法关联时进入候选规则。
- **FR-23** 专家可在任意时刻调整：撤回之前的决定（再次 `review_decide` 覆盖，保留历史）、批量「其余全部采纳」。
- **FR-24** 复核结束时 agent 用一个 `ask_user_question` 让专家确认最终结论，选项为三分类，默认推荐 = 基于复核后的 confirmed 集合重新计算的 `ai_verdict`；专家选择即写入 `final_verdict`。
- **FR-25** 首次复核前若会话内未记录专家身份，agent 问一次姓名 / 工号（Q9 默认），写入 `reviews.reviewer`；设置卡片可配置默认署名以跳过。

## 8. 输出规范（三层）

- **FR-30** 预审结果在对话中按三层展示：
  1. **结论层**：`ai_verdict` + 一句话依据（如「2 个 major 问题」）+ 明确标注「仅为建议，待专家确认」；
  2. **明细层**：每条问题 = 规则号 / 标题 / 严重级别 / 发现 / 证据引文（带章节定位）/ 整改建议 / 状态（confirmed / pending）；
  3. **检查清单层**：全部规则的逐条状态（pass / fail / pending / not-applicable / soft-未判定），便于专家确认「哪些检查过了」。
- **FR-31** 正式意见（定稿）为 Markdown 文件，模板沿用历史意见格式（`review-protocol.md` §6）：

  ```
  # 技术方案预审意见
  方案：<标题>　编号：<可选>　审核：<reviewer>　日期：<YYYY-MM-DD>
  意见：<final_verdict>
  （1）<采纳或改写后的问题文案>
  （2）…
  附：AI 预审结论 <ai_verdict>；采纳 n 条 / 驳回 m 条 / 改写 k 条 / 专家新增 j 条。
  ```
  「通过」且无问题时正文为「（1）按当前方案技术路线开展。」。
- **FR-32** 定稿文件写入配置的输出目录（默认会话工作目录下 `reviews/<reviewId>.md`），并经 `present` 工具交付（可关闭）。

## 9. 功能需求：定稿与回流

- **FR-40** `review_finalize` 要求 `final_verdict` 已写入，否则拒绝并提示先确认结论。
- **FR-41** finalize 原子地完成：生成文件 → 写 `reviews`（含耗时、工具调用计数）→ 刷新记忆：
  - `exemplars`：按规则号追加 `adopt`（原文案）与 `rewrite`（改写文案）范例，每规则保留最近 N 条（默认 20）；
  - `rule_candidates`：专家新增且未关联规则的问题 → 一条候选，附来源 reviewId；
  - `rules`（learned 层）统计字段：adopt / reject / rewrite 计数，用于召回与看板。
- **FR-42** 同一 reviewId 重复 finalize 产生新版本文件（`-v2`），记录保留全部版本。

## 10. 功能需求：规则管理

- **FR-50** `rules_list` 返回生效规则（shipped 与 learned 合并后），支持按维度 / tier / status 过滤。
- **FR-51** 专家在对话中可：停用 / 启用规则、调整严重级别、调整阈值；经 `rules_propose(action)` 写入 learned 层并立即生效（下一次 `review_check`）。shipped YAML 不被修改。
- **FR-52** `rules_propose(action: 'draft')` 由 agent 根据候选规则起草新规则（YAML 字段齐全、tier 默认 soft），状态 `draft`；专家在对话或看板中确认后转 `active`。看板可展示候选与草案并执行 accept / dismiss。
- **FR-53** 任何规则变更写审计字段（who / when / from reviewId）。

## 11. 看板（概要，细则见 `dashboard.md`）

- **FR-60** 右侧 Sidebar tab「方案审查」四页：规则（生效规则与 tier / 严重级别 / 采纳率）、审查记录（列表 + 详情 + 正式意见预览）、记忆（范例、候选规则、规则级精确率趋势）、评测（`eval_runs` 结果与消融对比）。
- **FR-61** 看板可写：规则启停 / 严重级别 / 参数、候选规则审批、问题采纳 / 驳回 / 改写、最终结论。所有写操作走同一 `ReviewStore` 写入口并写审计；沿用 DSH 鉴权，细粒度权限后置。

## 12. 非功能需求

- **NFR-01 确定性**：解析、校验器、证据门禁、结论策略为纯函数；同一输入同一输出；无网络、无时钟依赖。
- **NFR-02 时延**：`review_check` 对 200 KB 方案 ≤ 2 s（校验器部分，不含 LLM）；一轮完整预审（含模型）目标 ≤ 3 min。
- **NFR-03 内网**：插件不发起任何外部网络请求；模型访问全部经 DSH provider（默认 DeepSeek，可换内网模型）。
- **NFR-04 持久化**：所有记忆经 `ctx.storageDomain`（json 后端）；重启后可读；domain 版本变更需迁移说明。
- **NFR-05 多用户**：Web profile 开放 ip:port 给局域网时可用；看板读写路由均同源校验、沿用 DSH 鉴权；不自建账号；写操作记录操作者到审计字段，专家身份记录在 `reviews.reviewer`。
- **NFR-06 可观测**：每次工具调用的耗时与结果计入 `reviews.metrics`；证据门禁拒绝计数可查。
- **NFR-07 安全**：工具只读取工作目录内文件（经 DSH 文件系统）；输出目录可配置；不记录模型密钥；日志不含方案全文。
- **NFR-08 可逆**：插件卸载不留服务 / 路由 / 工具；数据文件保留。
- **NFR-09 文档同源**：`docs/` 是唯一事实来源；代码注释不复述设计。

## 13. 验收标准

| # | 验收 | 对应 |
|---|---|---|
| AC-01 | 对种子方案预审，输出含 ≥ 3 条 confirmed 问题，每条证据引文可在原文中命中；`ai_verdict` 与策略一致 | FR-12/13/14 |
| AC-02 | 对「删除 2.3 实施方案」变体，`DOC-011`（必备章节）与 `CAP-002`（压测）均为 hard fail，各带 `absence` 证据 | FR-12 |
| AC-03 | 对「资源评估写『无需扩容』」变体，`CAP-003` 候选片段包含该句，agent 登记后证据门禁通过 | FR-13 |
| AC-04 | 对「时序图仅图片」变体，`DOC-001` 登记为不可验证问题 | FR-04 |
| AC-05 | 伪造引文（原文不存在）登记时状态为 `pending`，不影响 `ai_verdict` | FR-13 |
| AC-06 | 复核：对 5 条问题分别采纳 / 驳回 / 改写 / 新增 / 批量采纳后，`feedback` 表记录一致；最终结论由专家选择写入 | FR-20~24 |
| AC-07 | 定稿文件符合 FR-31 模板；`exemplars` 收到改写范例；未关联规则的新增进入 `rule_candidates` | FR-31/41 |
| AC-08 | 停用一条规则后，再次 `review_check` 不再产出该规则问题；shipped YAML 未改动 | FR-51 |
| AC-09 | 重启 DSH 后看板能列出此前的审查记录与规则运行态 | NFR-04 |
| AC-10 | mock LLM 回放一轮完整协议，落库与文件断言通过 | 全部 |

## 14. 不做清单（V1.0）

- 向量检索 / 相似方案推荐；运行时监控数据接入；微服务台账；Word 公文生成器；图片时序图识别；独立前端工程；用户账号体系；方案提交人工作流（提交 → 通知 → 整改回传）。

## 15. 测试要点（供 S2）

| ID | 要点 | 层 |
|---|---|---|
| T-REQ-01 | 种子方案解析：标题树 3 级、资源表 6 行、接口表若干、Mermaid 0 块（原文为图片） | engine/parse |
| T-REQ-02 | 200 KB 上限：超限拒绝、未超限通过 | tools/review_parse |
| T-REQ-03 | 同哈希重复提交返回已有 reviewId 提示 | tools/review_parse |
| T-REQ-04 | 时序图缺失 → DOC-001 不可验证问题（FR-04） | engine/verifier/mermaid |
| T-REQ-05 | 占位单元格不计为有效内容（FR-06） | engine/verifier/table |
| T-REQ-06 | hard fail 自动登记并带证据；hybrid 产出候选不登记；soft 只列清单（FR-12） | engine/check |
| T-REQ-07 | 证据门禁四种结果：命中 / 未命中 / soft 强制 pending / hybrid 越界 pending（FR-13） | engine/gate |
| T-REQ-08 | `review_status` 三层输出结构与 `ai_verdict`（FR-14/30） | tools/review_status |
| T-REQ-09 | 预审阶段无法写 `final_verdict`（FR-15） | tools |
| T-REQ-10 | 记忆召回标注「常被驳回」阈值行为（FR-16） | engine/memory |
| T-REQ-11 | 复核批次 ≤ 5、选项文案、pending 项选项不同（FR-20） | protocol |
| T-REQ-12 | `review_decide` 四种 action 与覆盖历史（FR-21~23） | tools/store |
| T-REQ-13 | 最终结论确认写入 `final_verdict`（FR-24） | tools |
| T-REQ-14 | 定稿模板渲染（含「通过」空问题）与版本号（FR-31/42） | engine/finalize |
| T-REQ-15 | 回流：exemplars 上限 N、候选规则生成、learned 统计（FR-41） | engine/memory + store |
| T-REQ-16 | 规则停用后 check 不产出（FR-51）；shipped 文件不变 | store + engine |
| T-REQ-17 | 校验器纯函数性能：200 KB ≤ 2 s（NFR-02） | engine/bench |
| T-REQ-18 | 重启后 domain 可读（NFR-04） | store |
| T-REQ-19 | 看板写路由：同源 + 鉴权通过才写；跨源 / 未授权拒绝（NFR-05） | api |
| T-REQ-20 | mock LLM 全协议回放（AC-10） | protocol/e2e |
