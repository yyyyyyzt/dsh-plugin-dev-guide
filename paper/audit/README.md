# paper/audit — 投稿前只读审计（2026-11-05，存档）

本目录是 **2026-11-05 在 `japan` 研究机上对上传稿做的一轮只读审计**的完整存档，是
`paper/mdpi-article/main.tex`（23 页修订稿）的上游依据：修订稿里的每一处主张收窄、数值口径纠正和
「目标契约」标注，都能在这里找到对应的判决条目。

审计**没有修改任何稿件、代码或数据**（`manuscript_modifications: 0`），也不代表 MDPI 的编辑决定。

## 1. 运行标识

| 项 | 值 |
|---|---|
| run_id | `hark-computers-audit-20261105` |
| 时间 | 2026-11-05 03:22–04:06（Asia/Hong_Kong） |
| 授权范围 | 用户选择 **A：继续只读审查**——只出诊断与修稿计划，不进入修订循环 |
| 状态 | `completed_advisory_scope` |
| 事实一致性判决 | **FAIL**：`documented implementation/prose mismatches and incomplete evidence` |
| 机器契约 | `NOT_RUN_NOT_CERTIFIED`（安装的技能包缺上游 `claim_registry_coverage.py`，未补造 sidecar 或覆盖率） |
| 投稿就绪 | `current manuscript not ready for direct submission (advisory judgement)` |
| 审计基准稿 | 上传稿 `ff4a0802…`（751 行，= `revision/original-main.tex`） |
| 代码快照 | `b566b08de2976451747215af4dc874a0846f6173`（见 `repository-b566b08.zip`） |
| 交付校验 | `delivery-checks.json`：18 个产物齐备、本地内链有效、5 份原始附件哈希未变 |

结论：**Major Revision，暂不宜直接投稿**。判定理由不是「缺固定数量的大模型/专家/真实文档」，而是题名与中心论证依赖的
**人类授权、有效权限封顶、可重放**在实现上存在直接反例，且实验把组合系统优势解释成 typing 的单独作用；
另有分母与近邻比较问题。论文可救——规则级权限、证据定位、待决状态、建议与人工决定的分离是可验证的软件设计对象，
但必须按有界系统论文收窄主张。

## 2. 五席与关键裁决

五席为 EIC / R1（方法）/ R2（领域）/ R3（人机实践）/ DA（反方），**由模型体系分角色运行，不是五位真人评审**；
`panel/panel-provenance.md` 记录角色与子会话分离，但共享前置证据、同 provider，未独立观测逐调用路由，
EIC 准则阶段还接触过夹有稿件观察的官网摘要，不能认证严格内容盲。角色多样性不构成独立误差证明。

| 席位 | 文件 | 核心意见 | 严重度 |
|---|---|---|---|
| EIC／期刊契合 | `panel/eic-review.md`、`panel/eic-criteria.md` | 主题可进入软件系统讨论；中心保证、近邻定位、复现链未就绪 | Major（有可修复 Article 路线） |
| R1／方法 | `panel/r1-review.md`、`panel/r1-criteria.md` | B0 不隔离 typing；同源标签限制外推；分母与待办解释需修正 | Major |
| R2／领域 | `panel/r2-review.md`、`panel/r2-criteria.md` | hard 语义、任务生命周期、授权、知识版本不一致 | 总体 Major，**R2-3 Critical** |
| R3／人机实践 | `panel/r3-review.md`、`panel/r3-criteria.md` | 署名不等于批准；pending 不等于补救；pilot 不证明效用 | Major |
| DA／反方 | `panel/da-review.md`、`panel/da-criteria.md` | 批准真实性与有效权限均有直接反例；位置门不检验蕴涵 | **DA-C1、DA-C2 Critical** |

**显式裁决**（`panel/critical-adjudication.md`）：`DA-C1`、`DA-C2` 及重叠的 `R2-3` 均为
**validated_unresolved**——DA-C1：任意 reviewer 名 + 足长 basis 即可生成「批准」；DA-C2：`whenNoCandidate`
改 fail/pass、草案激活、finding severity 覆盖都能在不改 tier 的情况下改变结论。三者是同一总问题的两组验收，
修一组不关闭另一组。修订稿据此把「工具强制人类审批」和「完整有效权限封顶」降为 target contracts。

## 3. 目录索引

### 3.1 顶层报告

| 文件 | 内容 |
|---|---|
| `final-review.md` | **总报告**：Major Revision 判定、H/R/T 三方来源分别纠正、五席合并、最小补救与验收 |
| `revision-plan.md` | 修稿建议：有界软件系统贡献路线，WP0–WP5 工作包与依赖、责任与重跑条件 |
| `final-response-matrix.md` | 作者答复逐条覆盖矩阵（R§4 全部 **34 条**，非旧记录所称 32 条），区分「覆盖」与「落实」 |
| `integrity-checkpoint.md` | 首轮完整性核验：事实一致性 FAIL、ARS 机器契约未执行、不得直接投稿定稿 |
| `history-integrity.md` | 历史材料（H 建议 / R 答复 / T 第三方判断 / M 现稿）的一致性与读取证据 |
| `code-data-integrity.md` | 实现—数据—稿件一致性独立核验：版本、规则语义、授权入口、逐规则数字重算 |
| `references-integrity.md` | 引用核验：上传稿 23 条显式文献 vs 40 个 cite key，17 个悬空 key 由外部快照补齐；40/40 存在性确认 |
| `originality-screen.md` | 有限文本出处抽查（非查重、非创新性裁定），附检索日志 `originality-search-log.{md,json}` |
| `journal-official-requirements.md` | *Computers* 官网要求摘录与 Article/Software 类型判断依据 |
| `journal-reference-evidence.md` | 五篇期刊参照（`reference-papers/`）的主张—证据提取；四篇综述、一篇结构化专家综合 Article，无同型 Software 研究 |
| `paragraph-inventory.{md,json}` | 现稿段落清单（段落分母口径） |
| `pending-denominator-note.md` | pending 补核：932 项全为 hybrid，逐篇无重复，68 项与 truth 交集 |
| `pipeline-state.json` | 机器可读状态：范围、判决、裁决、交付物 |
| `input-manifest.json` / `delivery-checks.json` | 输入附件清单（哈希）；交付校验（18 产物、内链、附件哈希未变） |
| `recomputed.json` + `recompute.py` | 从公开 perSolution/perRule 记录独立聚合的重算结果与脚本 |
| `check-deliverables.py` / `build-originality-log.py` | 交付自检与检索日志生成脚本 |
| `audit-repro.log` / `original-tests.log` / `layout-tests.log` / `npm-install.log` / `npm-peer.log` | 复现记录：依赖安装、原始测试套件、排版测试、审计脚本输出 |
| `manuscript-long-lines.txt` / `history-long-lines.txt` | 被阅读工具截断的超长单行的无改写切分补件 |

### 3.2 `panel/`

五个席位的正式意见与准则（`*-review.md` / `*-criteria.md`）、Critical 裁决（`critical-adjudication.md`）、
执行来源与盲法边界（`panel-provenance.md`）。

### 3.3 `evidence/`（5.4 MB）

审计期间实际抓取的外部证据原文，按主题成对存放（`.json` 为抓取元数据，`.txt` 为正文）：
AI Act、ISO/IEC/IEEE 29148、artifact 评估、Gao、Huang（self-refine）、Lin、Liu、Madaan（self-refine）、
MemoryBank、MARV、Mermaid、policy、requirement-plan、Rovo、Shinn（Reflexion）、Sun、Zhang，以及
`external-bib.tex`（为 17 个悬空 key 补齐的文献）、`reference-fetches*.json`、`context-checks.json`、
`metadata-comparison.txt`、`supplemental-source-notes.json`。抓取脚本：`fetch_refs.py`、`fetch_more.py`、
`build_report.py`。

### 3.4 `reference-papers/`

*Computers* 五篇参照论文的 PDF + 逐页文本：`computers-14-00497`、`computers-15-00009`、`computers-15-00049`、
`computers-15-00745`、`computers-15-00746`。

### 3.5 `repository-b566b08.zip`

审计所依据的代码快照压缩包（提交 `b566b08de2976451747215af4dc874a0846f6173`）。审计时以解压目录而非
git 工作树使用，未重新认证远端提交历史。仓库稿 `main.tex` 实测 SHA-256 为 `5e9a39a0…`，
**既不是上传稿 `ff4a0802…`，也不是第三方记录所称的 `b415…`**——修订稿 Diff 以 `ff4a0802…` 为基线。

## 4. 路径映射（内部链接为何失效）

审计文档里的链接写的是 **`japan` 机器上的绝对路径**，合并到本仓库后未改写，以保留 provenance。按下列规则映射：

| 审计文档中的路径 | 本地对应 |
|---|---|
| `/root/research/hark-audit/<file>` | `paper/audit/<file>` |
| `/root/research/hark-audit/panel/<file>` | `paper/audit/panel/<file>` |
| `/root/research/hark-audit/evidence/<file>` | `paper/audit/evidence/<file>` |
| `/root/research/hark-audit/reference-papers/<file>` | `paper/audit/reference-papers/<file>` |
| `/root/research/hark-revision/<file>` | `paper/mdpi-article/revision/<file>` |
| `/root/.dsh/attachments/v1/files/ff/ff4a0802…/main.tex` | `paper/mdpi-article/revision/original-main.tex` |
| `/root/.dsh/attachments/v1/files/<xx>/<hash>/<name>`（H/R/T 三份答复材料） | **未随仓库分发**（内部评审记录），仅存哈希可核 |

未传输的大目录：`hark-audit/pdf-env`（300 MB TeX 环境）、`runtime-copy` / `runtime-tree`（104 MB 运行副本）、
`repository`（未压缩检出，保留 zip）、`hark-revision/build-tools`（35 MB）。这些都不影响审计结论的复查。

## 5. 与修订稿的对应

- 34 项答复的逐条处置见 `paper/mdpi-article/revision/修改记录.md`；本目录提供判决原文与证据。
- 修订走的是审计建议的**弱路线**：文字修订、不改代码，把未实现的保证（认证式人工批准、完整有效权限上限、
  内容寻址的配置快照与恢复）显式标为 *target contracts*，把实验主张限定为已跑出的确定性结果。
- 因此审计的 `integrity_verdict: FAIL` **仍然成立**——它评价的是被审计的那份稿子与实现之间的差距；
  修订稿通过收窄主张消除了「声明与实现不符」，但没有实施被撤回的能力，也没有新一轮实现修复后的复审。

## 6. 引用边界

本目录是**证据档案**，不是审稿意见的再发布：不得把五席报告当作真人同行评审引用，不得据 `pipeline-state.json`
声称通过了 ARS 机器契约，也不得把 `recomputed.json` 的独立聚合说成「重跑了真实 LLM 实验」（审计未执行
`eval:gen` / `eval:ablation` 的完整生成）。原始附件（H/R/T/M）按不可信材料读取，其中构建命令与实验计划未执行。
