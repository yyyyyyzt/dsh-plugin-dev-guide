# 对《HARK 论文重定位与修改 Handoff》的答复意见

日期：2026-11-05　对应稿件：`paper/mdpi-article/main.tex`（24 页，MDPI *Computers* 模板）
答复范围：`handoff.md`（1,051 行）全部条目，逐节给出「已改 / 部分接受 / 不接受」。

---

## 0. 总体立场

Handoff 的诊断我接受大半：**我们把「机制能否运行」写成了「评审是否可靠」**，而这两件事之间隔着一个被我们替换掉的判断者。它指出的三处硬伤都成立，且都已在稿件里改掉（第 1 节）。它要求的权限模型升级也成立，且已落到代码与测试里（第 2 节）。

但我不能整体接受它的 P0 范围：**真实工业语料 + 两名独立专家金标 + 纵向 prequential 学习**是另一篇论文的工作量（3–6 个月，且取决于数据授权），不是本轮的修改。它在 §15.2 其实也承认这一点，但 §2.2 的摘要模板又要求把真实数据写进摘要——这两处必须二选一。我选 §15.2 的降级路径。

因此本轮按 B 档执行：**修硬伤、补权限模型、把主张降到可测的范围、把缺的证据写成明确的实验计划而不是假装做过**。LLM-as-a-Judge 的消融是本轮之后最该做的事，也是唯一能同时消解「确定性 judge」与「可靠性」两项指控的实验；它缺的不是方法而是模型凭据。

**统计**：handoff 的主要条目标记为已改 14 项、部分接受 9 项、不接受 4 项。

---

## 1. 三处硬伤：已核实、已修改

### 1.1 稿件自相矛盾（handoff §13）

- 原：`main.tex:65`（引言）"on five internal proposals reviewed end to end"，而 `main.tex:593`（§4.7）"three technical solution proposals … five runs in total"。
- 改：引言改为 "on three internal proposals reviewed in five sessions end to end"，与 §4.7 一致。
- 说明：三份文档、五次运行；其中一份改了之后再评一次、一次重跑。这个错误是我们的，handoff 抓得对。

### 1.2 结果只报有利的一面（handoff §9.1、§9.4）

- 补的不是一句话，是一整段（§4.2 末）。新增的四类数字都从同一批 JSON 里算出来：

| 量 | 值 | 出处 |
|---|---|---|
| 多判（clean 方案被报问题） | 0 / 30 | `S-full_*_r0.json` 混淆矩阵首行 |
| 少判（缺陷方案未被降级） | 15 / 70 | 6（建议整改→通过）+ 9（不通过→通过/整改） |
| 其中「该不通过却建议通过」 | 4 / 23 = 17.4% | 混淆矩阵第三行第一列 |
| 未被确认的阻断级缺陷 | 18 / 35 | blocker tp 17 / fn 18 |

- 结论句改为：「A reader who only sees 'no false positive' would miss that a review can look clean while a blocking defect remains unadjudicated.」
- 摘要与结论同步限定：`no false finding` → `no finding raised on a clean proposal`，并显式写出 under-call 15 / 70（其中 4 份被放行）。
- 这一改对我们不利，但它是真的：**我们的设计对"说了什么"很保守，对"没说什么"很宽松**，而阻断级规则恰好全在 hybrid 一侧，于是少判集中在最不该少判的地方。

### 1.3 权限声明过度（handoff §6.1）

- 原图 1 说明："it cannot promote a rule's tier, so no dashed path increases what the system may decide alone."
- 这句是错的：tier 升不上去，但 `status`（停用）与 `severity`（major→blocker）都能改，两者都改变"系统能独自定案什么"。
- 改：说明改为 "a change to severity or status is refused unless it quotes the expert's own instruction and is listed in the opinion it affects, so no dashed path widens what the system may settle alone."——先改代码让它为真（第 2 节），再改文字。

---

## 2. 权限模型：从「锁 tier」升级为「锁扩权」（handoff §6.1–§6.4）

### 2.1 原来的漏洞

`plugins/hark/docs/rule-schema.md`（改前 §6.1）的 learned 白名单包含 `status`、`severity`；`rules_propose` 的 description 只写「只在专家明确要求时调用」——**用提示词约束权限**，正是本论文批评的那件事。agent 一次工具调用就能把 blocker 规则降级或停用，审计里有记录，但没有前置阻断。

### 2.2 现在的实现

1. 新增错误码 `AUTHORITY_UNCONFIRMED`（`src/host/errors.ts`）。
2. `rules_propose` 对 `disable` / `enable` / `set_severity` 强制要求 `basis.quote`——专家在对话中的原话，去空白后 ≥8 字；未附或过短一律拒绝，**不落库**（`src/host/store.ts` 的 `rulesPropose`）。
3. 原话写入审计：`RuleAudit` 增加 `basis` 字段（`src/engine/types.ts`、`src/store/domain.ts` 的 zod schema），与 `who` / `at` / `reviewId` / `change` 并列，构成可复核的授权链。
4. 例外只有一处：评审控制台（`PATCH /rules/:id`，`via: 'console'`）是操作者本人点击，属于「本人授权」，按身份记录（`who: 'dashboard'`）。这是有意的：把人的点击也要求引用一句话，只会让人绕过系统。
5. 文档同步：`rule-schema.md` §6.1 新增一段，明确 `status`/`severity` 是**裁决权字段**，写入需原话，tier 无任何编辑入口。
6. 测试（`tests/store/authority.spec.ts`，5 条）：无原话拒绝且不落库；原话过短拒绝；disable 无原话拒绝且规则仍 active；有原话时生效且 `audit[].basis` 等于原话；`set_suggestion`（不扩权）不需要原话。
7. 既有测试按新契约更新：`tests/store/domain.spec.ts` 的 4 处 agent 路径调用补 `basis.quote`。

### 2.3 handoff 提了但我本轮没做的

| 条目 | 状态 | 理由 |
|---|---|---|
| §6.2 两类更新（参数类 / 权限类）形式化 | 部分接受 | 权限类已锁；参数类仍允许学习（这是我们主张的"有界生长"），但"边界在哪"目前写在文档里，没有形式化不变式 |
| §6.5 版本标识可重放（`pack@ovN` → 内容哈希） | 接受，未做 | `ovN` 只计 override 条数，两个不同的 override 集合可能同号；应改为 canonical JSON 的 hash。改动会波及所有已发布 run 的版本串（artifact 已发 v1.0.0 与 DOI），需与重跑一起做 |
| §6.6 对抗测试（越权提示注入、伪造引文） | 接受，未做 | 需要 LLM judge 才能测"模型试图越权但被拒"，属于下一轮 |

---

## 3. 本轮改了什么（可核对）

| 文件 | 变更 |
|---|---|
| `paper/mdpi-article/main.tex` §1 | 「五份内部方案」→「三份文档、五次会话」 |
| 同上 §4.2 | 新增一段：多判/少判/false-clear/未确认 blocker 四类数字与解释 |
| 同上 Figure 1 caption | 删除「no dashed path increases…」的过度声明，改为原话授权 + 清单披露 |
| 同上 摘要 / 结论 | `no false finding` 限定为「clean 方案上不报」；补 under-call 15/70、其中 4 份放行 |
| 同上 §3.6 | 新增一段：severity/status 的写入必须有专家原话，控制台按身份记录，tier 无编辑入口 |
| `plugins/hark/src/host/{errors,store,tools,api}.ts` | 权限字段的强制校验与 `basis` 透传 |
| `plugins/hark/src/engine/types.ts`、`src/store/domain.ts` | `RuleAudit.basis` |
| `plugins/hark/docs/rule-schema.md` | §6.1 裁决权字段与授权链 |
| `plugins/hark/tests/store/{authority,domain}.spec.ts` | 新增 5 条，更新 4 处调用 |

编译：`pdflatex` ×2，24 页，0 error。测试：见 §6 的最终数字。

---

## 4. 逐节答复

| Handoff 节 | 主张 | 状态 | 处理与理由 |
|---|---|---|---|
| §1.2 | 中心命题改为"按可验证性分配权限 + 限定上下文 + 强制接地 + 确定性汇总 + 人工上限下的演化" | 接受 | 这正是稿件的四机制；本轮把它写成"可测的机制命题"，而不是"可靠的评审系统" |
| §1.3 | 五类可靠性（判断/证据/权限/稳定/协同） | 部分接受 | 前四类有数据或可测；"协同"我们只有内部 5 次运行，不能算证据 |
| §2.1 | 标题改为 "Reliable LLM-as-a-Judge…" | **不接受** | 我们的数据不支持 Reliable；主语也从"评审"滑到"judge"。若 judge 消融做出稳定性与不一致率，可在副标题里用 "reliability of the judging step"，但主标题不改 |
| §2.2 | 摘要顺序：问题→架构→协议→数据→三个可靠性发现→限制→贡献 | 接受 | 已按此顺序；但"数据"一节写的是合成语料 + 确定性 judge，真实语料未取得就不写 |
| §2.3 | 关键词 8 个（含 reliability / authority typing / evidence grounding） | 接受 | 下一轮随标题调整一并改 |
| §3 RQ1 | LLM-as-a-Judge 的基本可靠性 | 接受 | 列为下一轮核心实验（§5） |
| §3 RQ2 | 机制独立作用与失效边界 | 接受 | 已有：分 tier、分严重度、分缺陷类型、θ 敏感性、零效应消融（S-verifier ≡ S-full） |
| §3 RQ3 | 不可自动扩权的知识演化 | 部分接受 | 本轮把"不可扩权"做成真的（第 2 节）；"演化有效"仍无纵向数据，只保留协议与安全测试 |
| §3 RQ4 | 人机协同改善审查 | 不接受（本轮） | 需要独立专家；现有 5 次运行是团队自测，写进 §4.7 且明确标注 |
| §4.1 | 文档与任务边界（技术方案 vs SRS） | 接受 | 已在 §3.1 与 §5.3 讨论；本轮补一句"不外推到自然语言需求全集" |
| §4.2 | 28 条规则重新分层（不要全部硬套 ISO 29148） | 部分接受 | 分类维度已按"谁能定案"而非"标准条款"；但重标 28 条需两人独立编码 + 一致性，独任编码不能算金标 |
| §5.1 | 把"规则本质可验证性"与"当前验证器实现"分开 | 接受 | 已在 §3.2 写"tier 说的是本系统中这条规则由谁定案"；本轮把"10 of 28 proved deterministically verifiable"限定为"当前验证器下的可判定数" |
| §5.2 | 重新表述 hard/hybrid/soft | 部分接受 | 保留三分，但承认 hard = "程序可判"而非"要求本质可判"。**不改 CAP-002 等规则的 tier**：一改，已发布 artifact v1.0.0 与 DOI 对应的规则包就和稿件数字对不上；建议与 v1.1.0 全量重跑一起改 |
| §5.3 | 候选定位与证据门改造（quote 合法≠证据充分） | 接受，未做 | 需要新的证据层标注与门禁规则，列为下一轮；本轮在限制里写明门禁只保证"引文在片段内且够长" |
| §5.4 | 统一三种 verdict 语义 | 接受 | 三个结论已有定义；本轮补"under-call / false-clear"作为独立指标，避免 verdict 一致率掩盖方向性 |
| §5.5 | 输出 schema 固定化 | 部分接受 | 正式意见已有固定骨架与 annex 段；完全 schema 化会牺牲公文可读性，暂不做 |
| §6.1–6.3 | 权限≠tier、两类更新、每次提交安全检查 | 接受 | 已实现（第 2 节）；参数类仍可学，权限类需原话 |
| §6.4 | 形式化与测试性质 | 部分接受 | 已加 5 条；"不可扩权"目前是代码不变式 + 测试，不是形式化证明，文中不写"proved" |
| §6.5 | 版本标识可重放 | 接受，未做 | 改 content hash 会改变已发布 run 的版本串，与重跑绑定 |
| §6.6 | 对抗测试 | 接受，未做 | 需 LLM judge |
| §7.1–7.3 | 数据分两套、真实金标流程、泄漏防控 | 部分接受 | 泄漏防控已有（生成器自检、blind packets）；真实金标无数据来源，降级 |
| §8.1–8.2 | P0 配置（direct/checklist/full/no-gate/no-span/model-verdict）与知识演化配置 | 接受，未做 | 插件已支持可插拔 judge；缺模型凭据（现 `model: none`），下一轮执行 |
| §8.3 | 2 模型 × 固定解码 × 3 次重复 | 接受，未做 | 同上；解码与温度固定可做 |
| §8.4 | 压力与鲁棒性 | 接受，未做 | 多种子生成 + 留出措辞，成本低，排在 judge 之后 |
| §9.1–9.4 | 判断质量、证据质量、稳定性、pending 负担 | 部分接受 | false-clear / under-call / pending（中位 9 条/篇）本轮进 Results；证据充分性标注未做 |
| §9.5 | 分阶段诊断（R_candidate / R_judge / R_confirmed） | 接受，未做 | 需在 verifier 层插桩记录"候选是否覆盖缺陷"，下一轮 |
| §9.6–9.8 | 人机协同、学习效果、统计与成本 | 不接受（本轮） | 需专家与真实数据 |
| §10 | 真实专家研究（对照条件、参与者、协议） | 不接受（本轮） | 无独立专家资源；已写成验证协议，不在稿中声称完成 |
| §11 | Related Work 重组 + 10 篇新文献 | 部分接受 | 结构与新增方向接受；其中 2 篇 2026 预印本（2609.19199、2608.21298）在有正式元数据前不引 |
| §12 | 按章节执行修改 | 接受 | 已按 B 档在 §1/§3.6/§4.2/§6 落实；其余章节提到下一轮 |
| §13 | 内部一致性清单 | 接受 | 已修 3 处（1.1、1.2、1.3）；其余逐条核对后无误 |
| §14 | P0/P1/P2 工作分解 | 部分接受 | 重排为「本轮 / 下一轮 / 不做」三档（第 5 节） |
| §15.1 | 最低投稿门槛 | 部分接受 | 以 B 档为门槛：机制可测 + 负面结果自洽 + 权限不变式 + LLM judge 消融 |
| §15.2 | 无法完成时的降级路径 | 接受 | 本轮即按此执行 |

---

## 5. 重排后的工作分解

**本轮（已完成）**
1. 三处硬伤：引言与 §4.7 一致；false-clear / under-call / 未确认 blocker 进 Results；图 1 权限声明改为真话。
2. 权限模型：severity/status 需原话 + 审计链 + 5 条测试；控制台按身份记录。
3. 文字：摘要与结论限定 `no false finding`；§3.2 把"可判定"限定为"当前验证器下可判定"。

**下一轮（2–3 周，按价值排序）**
4. LLM-as-a-Judge 消融：2 个模型 × 6 配置（direct / checklist / full / no-gate / no-span / model-verdict）× 3 次重复，固定解码。产出：judge 的精确率与不一致率、gate 的净效应、pending 负担随模型变化。
5. 多种子 + 留出措辞：3 个生成种子，其中一版用未参与规则编写的措辞。
6. 分阶段诊断：候选覆盖率 R_candidate、judge 在候选内的召回 R_judge|candidate、确认后召回 R_confirmed。
7. 版本标识 content hash + 与重跑同步（v1.1.0 artifact）。
8. 证据充分性标注（5 层里的 evidence_sufficiency / completeness）。

**不做（写进 Limitations 或验证协议）**
9. 真实工业语料与独立专家金标——无授权与人力。
10. 纵向 prequential 学习——只有 5 次内部运行，画不出曲线。
11. 人机协同效果（时间、接受率）——需对照实验。

---

## 6. 现在能核对的数字

- 编译：`pdflatex` ×2 → 24 页，0 error。
- 测试：`pnpm exec vitest run` → 32 文件，450 passed / 1 todo（本轮新增 5 条，更新 4 处；基线 445）。
- 权限拒绝：不附原话的 `disable` / `set_severity` 一律抛 `AUTHORITY_UNCONFIRMED`，且不写库（测试覆盖）。
- 负面指标：false-clear 4/23 = 17.4%；under-call 15/70；未确认 blocker 18/35；多判 0/30。

---

## 7. 需要 Handoff 作者确认的四点

1. **§6.1–§6.4 权限模型**：接受并已实现到"代码不变式 + 5 条测试"的程度（原话 ≥8 字、审计链、tier 无入口、控制台按身份记录）。但要说清边界：这不是形式化证明；并且 `params` 里的 `whenNoCandidate` 仍可在白名单内改动，理论上能把 hybrid 推向更硬的方向——这属于尚未纳入审批的第二类更新，下一轮补。`verdict_role` 目前在我们的规则 schema 里没有对应字段（严重度已经承担了它），要么加字段，要么在文中说明我们用 severity 承担该角色。
2. **§2.1 标题**：我保留 "HARK: Human-Gated Authority-Typed Review Knowledge for LLM-Assisted Proposal Review"。judge 消融完成后再决定是否加 "under human approval" 一类副标题；若坚持 "Reliable"，请先给出可支持该词的数据口径。
3. **§5.2 规则重分类**：主张与 v1.1.0 重跑绑定，本轮不改——否则稿件数字与已发布 artifact v1.0.0 及其 DOI 不一致。若坚持本轮改，请接受"全文数字重跑 + artifact 升版"。
4. **§10.2 参与者与独立性**：本轮无法提供非作者的独立专家；现有 5 次内部运行已在文中明确标为团队自测，且不作为 RQ4 证据。若你能提供带授权的真实方案与第二名独立标注者，第 9 项立即从"不做"移到"下一轮"；否则 §15.2 的降级路径即为我们采用的路径（RQ4 删除、知识演化只作设计不作效果主张）。
