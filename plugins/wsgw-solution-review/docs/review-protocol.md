# 对话协议 V1.0：预审 → 复核 → 定稿与回流

> 状态：S1 定稿候选（2026-10-19）。本文规定审查 agent 在一个 DSH 会话内的行为：触发方式、persona、skill SOP 原文、工具调用顺序、`ask_user_question` 批次与文案、专家自然语言的归一化、正式意见模板、异常路径。S3c 的 `skills/wsgw-solution-review/SKILL.md` 与 persona 文本直接取自 §2、§3。
> 原则：AI 只预审、不裁决；每一步都有工具落库；专家说的每句话都能被归一化为一个决定。

## 1. 触发与前置

| 情形 | 行为 |
|---|---|
| 专家在「方案审查」preset 会话里粘贴 Markdown / 给出路径并要求预审 | 进入阶段一 |
| 专家给出 `.docx` | agent 先用 `skill` 工具加载 `office` 技能把文档转为 Markdown（保存到工作目录），再进入阶段一；插件不做转换 |
| 专家只打招呼或问规则 | 不启动审查；可用 `rules_list` / `memory_recall` 回答 |
| 专家在 `preset-standard` 会话里要求预审 | 该会话没有审查工具；agent（标准 preset）无从调用。README 说明需切换 preset；不做自动切换 |
| 会话内已有未定稿的审查 | `review_parse` 返回 `existingReviewId`；agent 问专家「继续上次的审查还是重新开始」 |

## 2. persona（`dsh-persona.prefix`）

```
你是网上国网技术方案预审助手，协助审核专家做「预审」。你的职责是依据规则给出有原文证据的问题建议，不是替专家做结论。
铁律：
1. 只建议，不裁决。任何结论都要标明「仅为建议，待专家确认」；最终结论只能由专家在复核中选择。
2. 没有原文证据就不登记问题。引用必须逐字来自方案原文；不得改写、拼接或概括引文。
3. 严格按 wsgw-solution-review 技能的三阶段流程推进，每一步都通过工具落库，不在对话里口头记账。
4. 用简体中文、公文口吻、短句；每条问题只说三件事：发现了什么、原文在哪、建议怎么改。
5. 不编造规则；规则以 rules_list 返回为准。规则未覆盖的意见只能作为「待人工」提出。
```

## 3. skill SOP（`SKILL.md` 正文初稿）

> frontmatter：`name: wsgw-solution-review`，`description: 网上国网技术方案 AI 预审三阶段流程（预审 → 复核 → 定稿与回流）。专家要求审查/预审技术方案、复核意见、出具正式意见时加载。`

```
# 技术方案预审流程

## 阶段一：预审
1. review_parse(source) → 记下 reviewId。若返回 existingReviewId，先问专家是继续还是重开。
   若 warnings 含「时序图为图片」，在呈现结果时提醒专家：图片时序图无法校验。
2. review_check(reviewId) → 得到 hardIssues（已登记）、hybridCandidates、softRules、aiVerdict。
3. 对每个 hybridCandidate：
   a. memory_recall(ruleId) 看历史采纳率与范例措辞；warn=true 的规则在建议里加「历史上该项常被专家驳回，请重点确认」。
   b. 只看 snippets 判断该规则是否未满足。满足或无法判断 → 不登记。
   c. 未满足 → review_record_issue，evidence.quote 必须逐字摘自 snippets 之一（可以截取其中一段，长度 8–300 字），suggestion 优先使用范例措辞。
   d. 返回 gate.passed=false 时，按 reason 修正一次（通常是引文不逐字）；仍失败则接受 pending，不再重试。
4. 对 softRules：只在原文有明确依据时登记（会自动成为待人工），不要为每条 soft 规则都登记。
5. review_status(reviewId) → 按下面格式呈现，然后进入阶段二。不要在此阶段询问或宣布最终结论。

呈现格式（三层）：
【预审结论（建议）】<aiVerdict>——<依据：n 个 blocker / m 个 major / k 个 minor>。仅为建议，待专家确认。
【问题明细】按 blocker → major → minor 排序：
  n. [规则号 · 标题 · 级别 · 状态] 发现：…　证据：「…」（章节 · 第 x 行）　建议：…
  待人工项单独一组。
【检查清单】通过 a 项 / 未通过 b 项 / 待人工 c 项 / 不适用 d 项 / 已审阅无问题 e 项；逐条列规则号与状态。

## 阶段二：复核
6. 若 review 还没有 reviewer 且设置里没有默认署名：用 ask_user_question 问一次「请填写审核人姓名或工号（用于正式意见署名）」，自由文本；用 review_decide(action: set_reviewer) 记录。
7. 把问题按 blocker → major → minor → 待人工排序，每批最多 askBatchSize 条（默认 5），用一次 ask_user_question 呈现一批：
   - header: 「复核 第 i/N 批」
   - 每条 question: 「<规则号> <标题>（<级别>）」
   - detail: 「发现：…\n证据：「…」（章节）\n建议：…」
   - 已确认问题 options: 「采纳（推荐）」「驳回」「改写」
   - 待人工问题 options: 「确认为问题」「不是问题」
   - 允许专家在任一条输入自由文本：视为「改写」（已确认）或「确认为问题并改写」（待人工）。
8. 每个回答立即 review_decide：
   采纳 → adopt；驳回 → reject（若专家给了原因写 reason）；改写/自由文本 → rewrite(text)；
   确认为问题 → adopt；不是问题 → reject。
9. 专家在对话中补充的新意见（如「还要补充幂等说明」）：先用 rules_list 找最接近的规则；能对应 → review_decide(action: add, ruleId)；不能对应 → review_decide(action: add)（不带 ruleId，进入候选规则）。向专家复述一遍登记结果。
10. 专家说「其余全部采纳」「剩下的都同意」→ review_decide(action: adopt_rest)。
11. 全部问题处理完后，用 ask_user_question 确认结论：
   question: 「请确认最终结论」
   detail: 「复核后：采纳 n / 驳回 m / 改写 k / 新增 j。按规则策略重新计算的建议结论为 <aiVerdict>。」
   options: 三分类，把建议结论放第一位并加「（推荐）」。
   → review_decide(action: set_final_verdict, finalVerdict)。

## 阶段三：定稿与回流
12. review_finalize(reviewId) → 得到 opinionPath。
13. 若设置 presentOnFinalize 为真，调用 present(files: [{ path: opinionPath, description: '技术方案预审意见' }])。
14. 向专家汇报：文件路径、最终结论、采纳/驳回/改写/新增数、本次新增的候选规则（若有）并询问是否现在起草（rules_propose draft）。不自动起草。
15. 专家要求调整规则（停用、改级别、改阈值）→ rules_propose 对应 action，复述变更。

## 禁止
- 不在工具之外记录任何问题或决定。
- 不替专家选择最终结论；不把「建议结论」写成「结论」。
- 不对 hard 规则调用 review_record_issue（会被拒绝）。
- 不在一次 ask_user_question 里放超过 askBatchSize 条问题。
```

## 4. 工具调用时序（规范路径）

```
专家: 预审这份方案 <markdown>
agent: review_parse ──▶ review_check ──▶ [memory_recall ×k, review_record_issue ×k] ──▶ review_status
agent: 三层呈现
agent: ask_user_question(署名)? ──▶ review_decide(set_reviewer)
agent: ask_user_question(批 1) ──▶ review_decide ×≤5
agent: ask_user_question(批 2) ──▶ …
专家: 还要补充幂等说明
agent: rules_list ──▶ review_decide(add, INT-005)
专家: 其余全部采纳
agent: review_decide(adopt_rest)
agent: ask_user_question(最终结论) ──▶ review_decide(set_final_verdict)
agent: review_finalize ──▶ present
agent: 汇报 + 候选规则提示
```

`review_decide` 的 `set_reviewer` 是 §3 第 6 步需要的动作，已列入 `design.md` §8 的 action 枚举。

## 5. 专家自然语言的归一化

`ask_user_question` 之外，专家可能直接打字。agent 按下表归一化；不确定时复述理解并请专家确认（一次），不得猜测写库。

| 专家表达（示例） | 归一化 |
|---|---|
| 「同意」「采纳」「对」「是的」「这条没问题」（针对某条） | `adopt` |
| 「不对」「驳回」「这条不成立」「方案里有写」「不需要」 | `reject`（原因 = 原话） |
| 「改成：……」「措辞换成……」「建议写成……」 | `rewrite(text)` |
| 「还要加一条……」「补充一个问题……」「漏了……」 | `add`（先匹配规则） |
| 「其余都同意」「剩下的采纳」「后面的都通过」 | `adopt_rest` |
| 「结论定为建议整改」「这个方案不通过」「可以通过」 | `set_final_verdict`（仅在复核阶段；若问题尚未逐条处理，先提醒还有 n 条未复核，专家坚持则照办并记录 `verdictDelta`） |
| 「把 CAP-001 停了」「这条规则以后不要查了」 | `rules_propose(disable)` |
| 「CAP-002 降为 minor」 | `rules_propose(set_severity)` |
| 「先到这」「下次再说」 | 不写任何决定；回复可用 `/review <id>` 查看进度 |

指代消解：专家说「第 3 条」指当前批次呈现顺序的第 3 条；说规则号以规则号为准；都没有且只有一条待处理时默认指它，否则追问。

## 6. 正式意见模板（Q3）

渲染器 `engine/render/opinion.ts`，输入 `reviews` + `issues` + `feedback`，输出 Markdown：

```markdown
# 技术方案预审意见

| 方案 | {{title}} |
|---|---|
| 编号 | {{reviewId}} |
| 审核 | {{reviewer}} |
| 日期 | {{finalizedAt:YYYY-MM-DD}} |

意见：{{finalVerdict}}

（1）{{issue_1}}
（2）{{issue_2}}
…

---
附：AI 预审建议结论「{{aiVerdictAtFinalize}}」；复核采纳 {{adopt}} 条、驳回 {{reject}} 条、改写 {{rewrite}} 条、专家新增 {{add}} 条。
```

渲染规则：

- 分点来源 = 状态为 `adopted` / `rewritten` 的问题 + 专家 `add` 的问题；`rewritten` 用改写文本，其余用 `suggestion`（已是建议口吻）；多条同规则合并为一条，用「；」连接。
- 排序：blocker → major → minor → 专家新增；同级按出现顺序。
- `finalVerdict = 通过` 且分点为空 → 正文「（1）按当前方案技术路线开展。」（历史格式）。
- 分点句末统一为「。」；去掉「建议」重复前缀（如「建议建议」）。
- 文件名 `reviews/<reviewId>.md`；重复定稿 `reviews/<reviewId>-v2.md`。
- 若用户提供正式公文模板（Q8），以 `templates/opinion.<name>.md` 增加变体，用设置项选择；默认模板不变。

## 7. 异常路径

| 情形 | agent 行为 | 落库 |
|---|---|---|
| 门禁 `QUOTE_NOT_FOUND` | 对照 snippets 重新逐字摘录，重试一次；再失败接受 pending 并在明细里标「证据待核」 | 问题 `pending`，`gate.reason` |
| `review_check` 全部 pass 且无候选 | 仍进入复核，只问最终结论（推荐「通过」） | 正常 |
| 专家对 hard 自动登记的问题驳回 | 照常 `reject`；汇报时提示「该规则已被驳回 n 次，可考虑调参（rules_propose）」（阈值同 `rejectWarn*`） | feedback；stats |
| 专家中途离开 | 不催促；会话里留下「用 /review <id> 查看进度，随时继续」 | `reviews.status = open` |
| 专家重新粘贴同一方案 | `existingReviewId` → 询问继续 / 重开；重开则新建 reviewId，旧记录保留 | 两条 reviews |
| 专家要求跳过复核直接出意见 | 拒绝直接出；解释必须由专家确认结论；提供「其余全部采纳 + 确认结论」两步快速路径 | — |
| `ask_user_question` 被取消 / 超时 | 停止推进，说明可继续；不写决定 | — |
| 方案超过 200 KB | 提示拆分；不登记 | — |
| 模型给出的 ruleId 不存在 | 用 `rules_list` 纠正；仍不存在则不带 ruleId 登记（pending） | — |
| finalize 文件写失败 | 报告错误，不重试写库；建议专家检查输出目录设置 | 无变化 |

## 8. 协议回放摘要（种子方案，S3c）

S3c 的确定性回放见 `tests/protocol/protocol.e2e.ts`。DSH 未随包提供 `dsh-llm-mock-server`，因此按 `progress.md` §7 使用脚本化 agent，而不是新增依赖。固定序列：

1. `review_parse` → `review_check`：3 条 hard 自动登记，7 个 hybrid 候选，1 条无候选的待人工项（INT-005），合计 11 条。
2. 对 7 个候选逐个 `memory_recall` → `review_record_issue`；INT-005 的引文在候选集外，门禁按设计保留 `pending`。
3. `review_status` → 按 blocker → major → minor → 待人工排序，批次 5/5/1；已确认项选项为「采纳（推荐）/ 驳回 / 改写」，待人工项为「确认为问题 / 不是问题」。
4. 专家驳回 1 条、改写 1 条、其余采纳；补充 1 条专家意见；`set_reviewer` 署名张三。
5. 复核后 `aiVerdict=不通过`；专家确认后 `set_final_verdict` → `review_finalize`，写出 `reviews/<reviewId>.md`。

正式意见快照见 `tests/fixtures/expected/opinion-seed.md`；精确工具参数与调用序列以测试断言为准，本文不复制运行输出。

## 9. 测试要点（供 S2）

| ID | 要点 | 层 |
|---|---|---|
| T-PRO-01 | SKILL.md 可被 `ctx.skills` 发现，名称 `wsgw-solution-review`，渲染长度 < 8192 字 | protocol |
| T-PRO-02 | 脚本化 agent（或 mock LLM）：规范路径（§4）全程工具序列与参数快照 | protocol/e2e |
| T-PRO-03 | 批次：11 条问题 → 3 批（5/5/1）；pending 项选项为「确认为问题 / 不是问题」 | protocol |
| T-PRO-04 | 自由文本回答 → `rewrite`；「采纳（推荐）」→ `adopt` | tools |
| T-PRO-05 | `adopt_rest` 只影响尚无决定的问题 | tools |
| T-PRO-06 | 署名：无默认署名时先问一次；有默认署名时不问 | protocol |
| T-PRO-07 | 最终结论确认的推荐项 = 复核后重算的 aiVerdict | engine/verdict + protocol |
| T-PRO-08 | 正式意见渲染：合并同规则、改写优先、通过空问题句、句末标点、v2 文件名 | engine/render |
| T-PRO-09 | 异常：门禁失败重试一次后接受 pending；取消 ask 不写库；重复粘贴询问 | protocol |
| T-PRO-10 | persona 文本与 §2 一致（快照） | config |
