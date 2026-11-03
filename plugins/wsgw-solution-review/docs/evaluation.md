# 评测方案 V1.0

> 状态：S1 定稿候选（2026-10-19）；**2026-10-29 S5 开工修订**（§2.3 短语池细则、§2.5 真实数据集替换、§5.1 judge 抽象与运行模式、§8 脚本落点、§9 用例调整）。本文展开 `AGENTS.md` §5.3 的指标，规定在线标注规则、离线评测集（合成，Q5）、消融设计、统计方法、数据脱敏（Q6）与可复现包。S5 的脚本与 `eval_runs` 表字段以本文为准。
> 诚实原则：历史方案原文不可得，离线集为**合成数据**，论文中必须明示；合成集只回答「机制是否正确、相对基线是否更好」，真实效果由在线标注回答。

## 1. 研究问题与假设的对应

| 假设（`AGENTS.md` §5.2） | 回答它的数据 | 主要指标 |
|---|---|---|
| H1 校验器 + 证据门禁 vs 关键词匹配：精确率↑且召回不降 | 合成集消融 B0 vs S-full；在线集 FP 率 | 问题级 P / R / F1、加权召回 |
| H2 记忆层带来学习曲线 | 在线集按审查序号 | 采纳率趋势、规则级精确率收敛 |
| H3 策略结论 vs 模型直接结论 | 合成集 B1 vs S-full；在线集 `ai_verdict` vs `final_verdict` | kappa、宏 F1、混淆矩阵 |
| H4 出意见时间低于人工 | 在线集会话指标 + 专家自报 | 分钟 / 份、工具调用数、token |

## 2. 数据集

### 2.1 在线集（主要，真实）

来源：生产会话中 `reviews` / `issues` / `feedback` 表（`design.md` §7）。每完成一次 finalize 即新增一个样本。目标规模：试点期 ≥ 20 份方案；论文投稿前 ≥ 40 份。

### 2.2 历史意见集（校准，真实）

原 `archive/legacy-review-tool/data/eval/review_records.json`：30 份意见（通过 15 / 建议整改 14 / 不通过 1，共 45 个意见点）。原始数据已于 2026-10-23 随 archive 删除，以下仅保留分布口径与当时的分析结论。用途：

1. **结论分布校准**：报告系统在在线集上的三分类分布与历史分布的差异（卡方）。
2. **规则覆盖分析**：原 45 个意见点的映射结果保留在讨论中；原始意见已删除，S5 改为用合成方案复现覆盖缺口，并在论文中注明历史集不可复现。

不作为 golden set（没有方案原文，无法计算问题级指标）。

### 2.3 合成集（离线，Q5）

**构造方法**（`src/eval/synthetic.ts`，CLI `pnpm run eval:gen`，确定性、带种子）：

1. 以网上国网技术方案模板（`requirements.md` §5.1 表）为骨架，每份方案 8 个章节 + 资源表 + 1–3 个接口表 + 0–2 个 Mermaid 时序图。
2. 每个章节的内容来自**短语池**：每个规则对应「满足」「不满足—缺失」「不满足—否定句」「不满足—占位」「不满足—关键词在但内容空」（对应旧版失效模式）五类短语各 ≥ 3 种写法，其中至少 1 种写法**不含**词表关键词（测召回）。
3. 对历史 30 份意见逐一生成一份方案：映射到规则的意见点 → 植入对应「不满足」短语；其余规则植入「满足」短语；结论标签 = 历史结论。得到 `syn-hist-01..30`。
4. 另生成 70 份随机组合（每份随机植入 0–6 条缺陷，严重级别分层抽样，保证三分类各 ≥ 15 份）：`syn-rand-01..70`。
5. 每份带 ground truth：`{ ruleId, severity, plantedKind, expectedVerdict }`，由策略函数从植入缺陷算出（与系统策略同一实现，避免实现偏差；该点在论文中说明为「策略一致性假设」）。
6. 生成后用引擎自检：hard/hybrid 规则在「满足」短语上不得 fail（否则短语池修正），记录自检报告。

规模 100 份，全部公开。合成集**不能**衡量 LLM 对真实业务语义的判断能力，只能衡量：校验器正确性、门禁有效性、基线对比、策略一致性。

**短语池细则（2026-10-29，S5 实现口径）**

| 校验器族 | 适用的缺陷类 | 说明 |
|---|---|---|
| `statement`（hard decisive：CAP-002、INT-004） | 缺失 / 否定句 / 占位 / 关键词在但内容空 | 否定词必须落在关键词前 ≤ 6 字（与 `negationWindow` 一致）；「占位」「内容空」两类在 decisive 校验器下**预期漏检**（校验器只看否定），作为结果如实报告，不为凑数改校验器 |
| `statement`（hybrid） | 同上 | 「缺失」无候选 → `pending`（待人工），系统**不**自动登记，计入 §4.3 的待人工覆盖率而非 TP；否定 / 占位 / 内容空靠 judge（§5.1）在候选片段上判定 |
| `quantity`（CAP-006） | 缺失 / 定性无数字（= 否定句位） / 占位 / 内容空 | 「满足」必须含数字 + 单位且与业务量词同句 |
| `table`（INT-001、DOC-010） | 缺失 / 占位 / 内容空 | 无否定句类；「内容空」= 只有「见附件」类文字无表 |
| `section`（DOC-011、CAP-003 / SEC-004 的前置） | 缺失 / 占位 / 内容空（低于 `minChars`） | — |
| `mermaid-sequence`（DOC-001、SEC-002、DOC-005） | 缺失（无图或图片占位） / 内容空（参与方或消息不足、缺必含步骤） | 无否定句类 |
| `cross-ref`（DOC-012、INT-001 / DOC-002 的组成） | 缺失（悬空引用） | — |

- **不含词表关键词的「满足」写法只用于 hybrid 规则**：hybrid 无候选 → `pending`，不产生误报；hard 规则的词表由校验器定义，缺词即 `fail`，属学习层 `families.add` 要修的词表缺口，不进自检集（否则 T-EVA-05 必红）。
- 带适用性条件的规则（CAP-005 风控、SEC-003 实名、INT-003 资源表「修改」行、SYN-001 同步、MON-001 埋点、DOC-002 样式、DOC-005 消息）：生成器按种子决定该特性是否出现；出现时再决定满足或缺陷；不出现时规则 `not-applicable`，不进真值。
- soft 规则不植入（不可验证），真值只含 hard / hybrid 规则。
- 真值中的 `expectedVerdict` 视所有植入缺陷为已确认问题；系统侧因 hybrid「缺失」只能 pending，结论级指标天然偏向「系统更宽松」，论文据此报告「待人工项全部被专家确认」的上界与「全部驳回」的下界。

### 2.5 替换为真实数据集（用户本地）

所有脚本对数据集只认一个目录结构，合成集与真实集同构：

```
<dataset-dir>/
├─ manifest.json        { "id": "<dataset-id>", "generatedBy"?: ..., "seed"?: ... }
├─ solutions/<id>.md    方案原文（Markdown；Word / PDF 先用 office skill 转）
└─ truth.json           [{ "id", "expectedVerdict", "defects": [{ "ruleId", "severity", "plantedKind"? }] }]
```

- `truth.json` 的 `defects` 对真实数据来自专家的在线标注导出（`feedback` 表：adopt / rewrite → 该规则为真缺陷；专家新增且关联规则 → 亦为真缺陷），`expectedVerdict` = `final_verdict`；`plantedKind` 可省略。
- `pnpm run eval:ablation --dataset <dir>` 不区分合成 / 真实；`eval_runs.dataset` 记录 `manifest.id`。
- 真实数据集与导出的映射字典放 `paper/data/private/`（gitignored），公开前经 §7 脱敏。

### 2.4 变体集（单元级）

`tests/fixtures/` 的种子方案及其变体（`design.md` §14），用于 T-* 测试；不进指标。

## 3. 在线标注规则

每条问题的最终标签由专家动作决定，无需额外标注：

| 专家动作 | 问题级标签 | 备注 |
|---|---|---|
| `adopt` | TP | |
| `rewrite` | TP（内容对、措辞改） | 单独统计改写率，作为措辞质量指标 |
| `reject` | FP | `reason` 文本做主题归类（S5 人工编码） |
| `add`（专家新增） | FN | 关联到规则则记该规则 FN；未关联记「规则外 FN」 |
| 待人工被「确认为问题」 | TP（来源 LLM-soft 或 gate-pending） | 分开报告：门禁拒绝但专家确认的比例 = 门禁过严度 |
| 待人工被「不是问题」 | FP（不计入 `ai_verdict` 的 FP，单独报告） | |

对齐粒度：`(reviewId, ruleId)`；同一规则多条问题合并计一次。专家新增且无规则的问题只计入「规则外 FN」计数，不进 P/R 分母（否则 R 无上界定义）；论文同时报告含与不含规则外 FN 的召回。

## 4. 指标定义

### 4.1 问题级

对一份方案 \(s\)，预测集 \(P_s\)（confirmed 且 tier ∈ {hard, hybrid}）与真值集 \(G_s\)（在线：TP ∪ FN；合成：植入缺陷）：

\[
\text{Precision} = \frac{\sum_s |P_s \cap G_s|}{\sum_s |P_s|},\quad
\text{Recall} = \frac{\sum_s |P_s \cap G_s|}{\sum_s |G_s|},\quad
F_1 = \frac{2PR}{P+R}
\]

加权召回：\(w(\text{blocker})=3, w(\text{major})=2, w(\text{minor})=1\)，

\[
\text{Recall}_w = \frac{\sum_s \sum_{r \in P_s \cap G_s} w(r)}{\sum_s \sum_{r \in G_s} w(r)}
\]

另按 tier 分组报告（hard / hybrid），按规则报告（规则级精确率 = adopt+rewrite / shown，`rule_overrides.stats`）。

### 4.2 结论级

`ai_verdict`（finalize 时冻结的 `aiVerdictAtFinalize`，即复核前的建议）vs `final_verdict`：准确率、宏 F1、3×3 混淆矩阵、Cohen's kappa（无权重）与二次加权 kappa（三分类有序：通过 < 建议整改 < 不通过）。同时报告「复核后重算的 aiVerdict」vs `final_verdict`，衡量专家对策略本身的改动（`verdictDelta`）。

### 4.3 证据

- 证据有效率 = 门禁通过的 LLM 登记 / LLM 登记总数（`reviews.metrics.gateRejects`）。
- 门禁过严度 = pending 后被专家确认为问题 / pending 总数。
- 锚点准确率：从在线集随机抽 30 条 confirmed 问题，专家二次判断「引文是否支持发现」（是 / 部分 / 否）；报告「是」比例。
- absence 证据正确率：合成集上 absence 类 fail 与植入「缺失」缺陷的一致率。

### 4.4 记忆与学习

- 采纳率曲线：按 finalize 序号 \(t\) 的滑动窗口（窗 5）采纳率 \(a_t\)；拟合线性趋势并报告斜率与 95% CI。
- 规则级精确率收敛：每条规则 shown ≥ 10 后的精确率与前 10 次的差值。
- 范例使用率：suggestion 与某条 exemplar 文本相似（归一化后编辑距离 ≤ 10%）的问题占比。
- 候选规则：产生数、起草数、转正数。
- 消融 S−memory：同一合成集上关闭 `memory_recall` 与范例注入，比较改写率（合成集无专家 → 用「与历史意见措辞的编辑距离」近似）。

### 4.5 效率

- 会话时长：`reviews.metrics.startedAt → finalizedAt`（含专家思考时间；另报告去除 ask 等待后的「机器时间」= 工具调用耗时之和 + 模型耗时）。
- 工具调用数、模型请求数、输入 / 输出 token（DSH token meter，S3c 验证可取性）。
- 人工基线：专家自报「不用工具时一份方案平均耗时」（问卷，n ≥ 3），作为参考值而非对照实验。

### 4.6 确定性与稳定性

- 引擎确定性：合成集跑 3 次，`check` 输出哈希一致率必须为 100%。
- LLM 路径稳定性：S-full 在合成集跑 3 次（温度 0），问题级 F1 的标准差。

## 5. 消融与基线（`src/eval/ablation.ts`，CLI `pnpm run eval:ablation`）

| 代号 | 配置 | 对应主张 | 运行模式 |
|---|---|---|---|
| B0 关键词基线 | 复刻旧版机制：每条规则 3–5 个关键词子串匹配即通过，无否定、无结构、无证据；结论 = 对「关键词缺失」的规则集合套用同一策略函数（blocker 缺失 → 不通过；major 缺失 → 建议整改；minor 达阈值 → 建议整改）。比旧版「只看 blocker」更宽容，是对基线有利的复刻 | H1 | 确定性 |
| B1 模型直接审 | 全文 + 28 条规则一次性交给模型，模型输出问题列表与结论（旧版 LLM 路径）；无校验器、无门禁、无策略 | H1、H3 | 需 LLM judge |
| S-full | 本系统：校验器 + 候选 + 门禁 + 策略（+ 记忆） | — | 确定性 judge 可跑（hybrid 判定由 flag judge 代替）；LLM judge 为正式口径 |
| S−gate | 关闭证据门禁（LLM 登记一律 confirmed） | 证据有效率对 P 的贡献 | 需 LLM judge（确定性 judge 的引文恒为原文片段，门禁恒通过，与 S-full 等价，不单列） |
| S−verifier | hybrid 规则不给候选，judge 看全文判断；hard 规则保留 | 候选划定对 P/R 的贡献 | 确定性 judge 可跑：实现为去掉 hybrid 规则 `statement` 的 `sections` 限定（全文范围出候选） |
| S−policy | 结论由模型一句话给出，问题集合不变 | H3 | 需 LLM judge |
| S−memory | 关闭 `memory_recall` 与范例 | H2（近似） | 仅在线（合成集无专家反馈，离线差异为 0，不单列） |

### 5.1 judge 抽象（2026-10-29）

hybrid 候选片段上的「语义判断」在系统里由对话 agent 承担；离线评测把它抽象为 `Judge`（`src/eval/judge.ts`）：

```ts
interface Judge {
  id: string                      // 写入 eval_runs.config.judge
  judge(input: JudgeInput): Promise<JudgeOutput>   // 一条 hybrid 候选 → { issue: boolean, quote?: string, finding?: string }
  direct?(input: DirectInput): Promise<DirectOutput> // B1 / S−policy 用：全文 + 规则 → 问题列表 + 结论
}
```

| judge | 实现 | 用途 |
|---|---|---|
| `flag` | 确定性：候选片段带 `negated` / `assertion-only` / `placeholder` 标记，或句尾为「：<占位词>」→ 判为问题，引文 = 片段原文；否则不是问题 | 无 key 环境、CI、引擎机制评测；**不是** LLM 能力的代理，论文中标注 |
| `replay` | 从 JSONL 回放历史 judge 输出（按 `datasetId/solutionId/ruleId/snippetHash` 键） | 复现论文数字、离线重算指标 |
| `llm` | 调用外部 **adapter** 模块（`--adapter <path>`，导出 `complete(messages, opts) → Promise<string>`）；提示词在 `src/eval/prompts.ts` 随包公开；输出经 zod 校验后进门禁 | 正式口径；adapter 由运行者提供（例如在 DSH 内用 `ctx.llm`，或任何客户端）。插件本体不含模型客户端（`AGENTS.md` 铁律 1） |

运行约束：模型固定（记录 adapter 报告的模型名与版本）、温度 0、提示词固定并随包公开（`promptHash` = 提示词文件 sha256 前 12 位）、每配置 3 次重复（`repetition` 0..2；确定性配置 3 次结果必须逐字节一致，见 §4.6）。每次运行写一条 `eval_runs`（`runId, config{ablation, judge, model, promptHash, repetition, rulePackVersion}, dataset, metrics, perRule[], perSolution[], at`），同时写到 `paper/data/public/eval-runs/<runId>.json`；导入看板用 `--import <storage-dir>`（可选）。

无 LLM adapter 时脚本只跑 B0、S-full（flag）、S−verifier（flag），并在汇总表里把 B1 / S−gate / S−policy 标为 `skipped: requires llm adapter`，不得用 flag 结果冒充。

## 6. 统计方法

- 样本量小（在线 20–40，合成 100）：所有比例类指标给 bootstrap 95% CI（1000 次重采样，按方案为单位）。
- 配置间比较（同一方案集）：问题级 F1 用 Wilcoxon 符号秩检验（按方案配对）；结论级准确率用 McNemar 检验；显著性水平 0.05，报告效应量（F1 差值与 CI）。
- 学习曲线：对 \(a_t\) 做线性回归，报告斜率、CI 与 Spearman 相关；不声称因果，讨论混杂（专家熟练度、方案难度漂移）。
- kappa 的 CI 用 bootstrap。
- 多重比较：消融 6 组比较用 Holm 校正。

## 7. 数据脱敏（Q6）

### 7.1 原则

论文与公开数据包中不出现：真实单位与系统名、省份、第三方平台名、微服务 / 表 / 字段 / 模板编码等内部标识、人名工号、真实日期、原始方案编号。合成集由模板生成，本身不含真实内容，但短语池来自历史意见，同样过脱敏。

### 7.2 规则（`src/eval/anonymize.ts`，CLI `pnpm run eval:anonymize`，确定性映射）

| 对象 | 处理 |
|---|---|
| 方案编号 `PD_TR_2026xxxxxx` | 顺序重编 `S-01…S-30`（映射表不公开） |
| 方案标题 | 规则化改写：保留业务动词与对象类别，去省份与渠道名，如「关于江苏退费申请工单优化…」→「省级退费工单流程优化方案」 |
| 单位 / 产品名（网上国网、国网营销部、运管平台、95598 等） | 固定替换：`OSP`（online service platform）、`业务主管部门`、`运营管理平台`、`客服门户` |
| 省份 / 地市 | `省份A`、`省份B`…（按首次出现顺序） |
| 第三方平台（支付宝、阿宝、微信、鸿蒙、华为…） | `第三方渠道P1`、`智能体A1`、`第三方渠道P2`… |
| 微服务名、表名、字段名、配置表名 | `svc-01`、`tbl_01`、`fld_01`；通用技术词（openId、token、resultCode）保留 |
| 数字编码（模板编码、渠道编号 3389 等） | `<CODE>` |
| URL / 接口路径 | `/api/<path>` |
| 人名 / 工号（reviewer） | `R1…Rn` |
| 日期 | 整体平移固定偏移（保留先后与间隔）；论文只报告相对时间 |
| 驳回原因自由文本 | 人工复核后发布；含上述实体者先经映射替换 |

### 7.3 流程与校验

1. 映射字典 `paper/data/private/anonymize.map.json` 本地生成，**gitignore**，不进仓库与数据包。
2. 脚本输出到 `paper/data/public/`；输出后运行泄漏检查：对「禁词表」（真实名称列表，同样私有）全文 grep，命中数必须为 0 才允许提交。
3. 公开字段白名单：`reviews`（去 sourcePath、sessionId、reviewer 原值）、`issues`（finding / suggestion / evidence.quote 经映射）、`feedback`（action、reason 经映射）、`rule_overrides.stats`、`eval_runs`。
4. 伦理说明：数据为工作文档评审记录，不含个人敏感信息；专家以角色代号出现；论文致谢与署名 S6 决定（Q6 署名待定）。

## 8. 可复现包（随稿件）

- 插件源码（tag）+ 规则包 YAML + 提示词（`src/eval/prompts.ts`）+ 评测模块 `src/eval/*` + CLI `scripts/eval/*.mjs`（经 `lib/eval/` 运行，先 `pnpm run build`）。
- `paper/data/public/`：`synthetic/`（合成集 100 份 + `truth.json` + `selfcheck.json` + `manifest.json`）；`eval-runs/`（每次运行一个 JSON）；`summary.md`（配置 × 指标表，含 CI 与检验）；脱敏后的在线反馈导出（真实试点后）。
- `paper/REPRODUCE.md`：`pnpm install && pnpm run build` → `pnpm run eval:gen` → `pnpm run eval:ablation`（确定性配置；LLM 配置加 `--adapter`）→ `pnpm run eval:anonymize`（真实数据时）。
- 不含：真实方案、映射字典、禁词表（`paper/data/private/`，gitignored）。

## 9. 测试要点（供 S2 / S5）

| ID | 要点 |
|---|---|
| T-EVA-01 | 指标函数：P / R / F1 / 加权召回在手工构造的 3 份方案上与手算一致 |
| T-EVA-02 | kappa（无权 / 二次加权）与宏 F1 对已知混淆矩阵的值与参考实现一致 |
| T-EVA-03 | 在线标签映射：adopt→TP、rewrite→TP、reject→FP、add→FN、pending 确认→TP(分组) |
| T-EVA-04 | 合成生成器：同种子两次输出字节一致；100 份三分类各 ≥ 15；每份真值与策略函数一致 |
| T-EVA-05 | 合成自检：「满足」短语不触发 hard/hybrid fail |
| T-EVA-06 | 引擎确定性：合成集 3 次 `check` 哈希一致 |
| T-EVA-07 | 脱敏脚本：示例文本中省份 / 渠道 / 服务名 / 编码全部替换；泄漏检查对禁词表 0 命中；映射确定性 |
| T-EVA-08 | B0 基线复刻：在「关键词在但内容空」短语上判通过（重现旧版缺陷）；B1 / S−policy 经注入的假 adapter 跑通且不调用校验器 / 门禁 / 策略模块；无 adapter 时这些配置标 `skipped` |
| T-EVA-09 | `eval_runs` 记录字段完整（`config.ablation / judge / model / promptHash / repetition / rulePackVersion`、`dataset`、`metrics`、`perRule[]`、`perSolution[]`、`at`）且通过 `EvalRunRecordSchema` |
| T-EVA-10 | 统计：bootstrap CI 带种子可复现且覆盖点估计；Wilcoxon / McNemar 对手算小样本与参考值一致；Holm 校正顺序正确 |
| T-EVA-11 | 数据集目录协议（§2.5）：缺 `manifest.json` / `truth.json` 或 `truth` 引用不存在的方案时报错并指出文件 |
