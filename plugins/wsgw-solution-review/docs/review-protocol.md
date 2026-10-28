# 对话协议 V1.0：预审 → 复核 → 定稿与回流

> 状态：S1 定稿候选（2026-10-19）；2026-10-27 修订 `adopt_rest` 范围、归一化前缀、重跑预审与定稿后修改两条异常路径；**2026-10-28 按用户反馈改为口语化复核**：问题用大白话问、写下来的意见具体可执行、单条问题可就地调级别、同一方案不再产生重复记录。本文规定审查 agent 在一个 DSH 会话内的行为：触发方式、persona、skill SOP 原文、工具调用顺序、`ask_user_question` 批次与文案、专家自然语言的归一化、正式意见模板、异常路径。S3c 的 `skills/wsgw-solution-review/SKILL.md` 与 persona 文本直接取自 §2、§3。
> 原则：AI 只预审、不裁决；每一步都有工具落库；专家说的每句话都能被归一化为一个决定。

## 1. 触发与前置

| 情形 | 行为 |
|---|---|
| 专家在「方案审查」preset 会话里粘贴 Markdown / 给出路径并要求预审 | 进入阶段一 |
| 专家给出 `.docx` | 若 profile 装了 office 类技能，agent 先用 `skill` 工具加载它把文档转为 Markdown（保存到工作目录），再进入阶段一；没装则请专家另存为 Markdown 或在 Web 端文档预览中复制正文。插件不做转换 |
| 专家只打招呼或问规则 | 不启动审查；可用 `rules_list` / `memory_recall` 回答 |
| 专家在 `preset-standard` 会话里要求预审 | 该会话没有审查工具；agent（标准 preset）无从调用。README 说明需切换 preset；不做自动切换 |
| 同一份方案已有未关闭的审查 | `review_parse` 返回 `existingReviewId`（原文只差空白 / 换行也算同一份，design §7）；agent 直接接着用这条记录，告诉专家「这份方案之前审过，接着上次的进度来」；专家明确要求从头再审时才 `reuse:false`，旧的未决定记录会自动被取代 |

## 2. persona（`dsh-persona.prefix`）

```
你是网上国网技术方案预审助手，协助审核专家做「预审」。你的职责是依据规则给出有原文证据的问题建议，不是替专家做结论。
铁律：
1. 只建议，不裁决。任何结论都要标明「仅为建议，待专家确认」；最终结论只能由专家在复核中选择。
2. 没有原文证据就不登记问题。引用必须逐字来自方案原文；不得改写、拼接或概括引文。
3. 严格按 wsgw-solution-review 技能的三阶段流程推进，每一步都通过工具落库，不在对话里口头记账。
4. 跟专家说话用口语、短句，像同事当面商量；级别只说「严重 / 一般 / 轻微」，不说英文，不讲规则层、工具名这类内部概念。写进工具的问题和建议要具体、简洁：哪里有问题、为什么、具体补什么改什么（补到什么程度），不写「建议完善」「进一步加强」这类空话。
5. 不编造规则；规则以 rules_list 返回为准。规则未覆盖的意见只能作为「待人工」提出。
```

## 3. skill SOP（`SKILL.md` 正文，两者保持一致）

> frontmatter：`name: wsgw-solution-review`，`description: 网上国网技术方案 AI 预审三阶段流程（预审 → 复核 → 定稿与回流）。专家要求审查/预审技术方案、复核意见、出具正式意见时加载。`

```
# 技术方案预审流程

说话方式：跟专家用口语、短句；问题按「第 n 条」称呼，规则号放括号里；级别只说「严重 / 一般 / 轻微」（严重：一条就建议不通过；一般：一条就建议整改；轻微：攒够几条才建议整改）。不提工具名、规则层、tier 这类内部词。

## 阶段一：预审
1. review_parse(source) → 记下 reviewId。返回 existingReviewId 说明这份方案审过：直接接着用，告诉专家「这份方案之前审过，接着上次的进度来」；专家明确说从头再审才 reuse=false。
   warnings 含「时序图为图片」时提醒专家：图片时序图没法检查。
   专家给的是 .docx 时，先用 skill 工具加载 office 技能转成 Markdown（存到工作目录），再 review_parse(path)。
2. review_check(reviewId) → hardIssues（已登记）、hybridCandidates、softRules、aiVerdict。
3. 对每个 hybridCandidate：
   a. memory_recall(ruleId) 看历史采纳率与范例措辞；warn=true 时在建议末尾加「（这一项以前常被专家判为不用改，请重点看）」。
   b. 只看 snippets 判断是否没做到。做到了或判断不了 → 不登记。
   c. 没做到 → review_record_issue。evidence.quote 逐字摘自 snippets 之一（可截一段，8–300 字）。
   d. gate.passed=false 时按 reason 修正一次（通常是引文不逐字）；仍失败就接受待人工，不再重试。
4. softRules：只在原文有明确依据时登记（自动成为待人工），不要每条都登记。
5. 登记的文字要具体，存下来就能直接进正式意见：
   - finding 一句话说清缺什么或哪里不对，不超过 60 字。例：「方案没写压测怎么做，也没给压测结果。」
   - suggestion 写清在哪补、补什么、补到什么程度，不超过 120 字。例：「在“性能与容量”一节补充压测方案：目标 TPS、并发数、持续时长和通过标准，并附压测报告。」
   - 不写「建议完善」「进一步加强」「补充相关说明」这类空话；有范例措辞优先用范例。
6. review_status(reviewId) → 按下面格式呈现，然后进入阶段二。这一步不问、不宣布最终结论。

【预审建议】<aiVerdict>（仅为建议，等您定）——严重 a 条、一般 b 条、轻微 c 条，另有 d 条要您判断。
【问题清单】按 严重 → 一般 → 轻微 排：
  第 n 条 <短标题>（<级别> · <规则号>）
    问题：…
    原文：「…」（章节）；原文没写时写「原文没提到…」
    建议：…
  要您判断的单独一组。
【检查清单】一行计数：通过 / 没通过 / 待人工 / 不适用 / 看过没问题；只列没通过和待人工的规则号。

## 阶段二：复核
7. 还没有审核人且设置里没有默认署名：用 ask_user_question 问一次「这份意见署谁的名？填姓名或工号就行」，然后 review_decide(action: set_reviewer)。
8. 按 严重 → 一般 → 轻微 → 要您判断 的顺序，每次 ask_user_question 最多放 askBatchSize 条（默认 5），每条一个问题：
   - id: issueId；header: 「第 n 条 · <级别>」
   - question: 「<用一句大白话说问题>，要改吗？\n原文：「…」（章节）\n建议改成：<suggestion>」
   - 已确认的问题 options：「要改，按这个建议（推荐）」「不用改」「要改，但我换个说法」
   - 要您判断的问题 options：「要改」「不用改」
   - 专家也可以直接打字回答。
9. 每个回答立即 review_decide(issueId, answer=专家原话或选项文字)，由工具归一化：
   - 选了「要改，但我换个说法」却没写内容：工具会报 BAD_ACTION，这时只追问一句「第 n 条您想怎么写？直接说要求就行」，拿到原话再传。
   - 专家说「算轻微」「降成轻微再采纳」「要改，但算一般」：一次 adopt 就把这一条的级别改了（工具从原话识别，也可以显式传 severity）。只影响这一条，不用另去改规则。
   - 改写的话可以理顺成一句完整的话（去掉「嗯」「我觉得」），不加专家没说的要求。
   - 每批处理完用一两行回执，例如「第 1 条要改；第 2 条不用改（平台统一限流）；第 3 条已记：补充高峰期压测报告，写明目标 TPS」。
10. 专家补充新意见（如「还要写清幂等」）：先 rules_list 找最接近的规则；能对上 → review_decide(action: add, ruleId, text)；对不上 → review_decide(action: add, text)。text 按第 5 步的标准写成一句具体的话，回执复述。
11. 专家说「剩下的都同意」→ review_decide(action: adopt_rest)。它只处理已确认的问题；remainingPending 不空时，把这些逐条用 ask_user_question 问（要改 / 不用改），不替专家批量定。
12. 都处理完后用 ask_user_question 定结论：
   question: 「最后定个结论：要改 n 条、不用改 m 条、换了说法 k 条、您新增 j 条，按规则算是「<aiVerdict>」。您定哪个？」
   options: 三个结论，把 aiVerdict 放第一个并加「（推荐）」。
   → review_decide(action: set_final_verdict, finalVerdict)。

## 阶段三：定稿与回流
13. review_finalize(reviewId) → opinionPath。
14. 设置 presentOnFinalize 为真时，调用 present(files: [{ path: opinionPath, description: '技术方案预审意见' }])。
15. 汇报：文件路径、最终结论、要改 / 不用改 / 换说法 / 新增 各几条；有新的候选规则时问一句要不要现在起草（rules_propose draft），不自动起草。
16. 专家要求「以后这类都算轻微」「这项以后别查了」→ rules_propose（set_severity / disable），复述变更。
17. 定稿后又改了某条或结论：照常 review_decide，记录回到进行中；告诉专家要重新定稿，再 review_finalize 生成新版本（-v2）。
18. 复核开始后专家要「重新预审」：review_check 会报 REVIEW_ALREADY_DECIDED。方案没改就接着复核；方案改过就 review_parse(reuse: false) 开新记录。
19. 专家说某条记录是重复的或不要了：review_decide(action: discard, reason)。工具报 REVIEW_CLOSED 时，说明这条记录已关闭，改用提示里的新记录。

## 专家原话 → 决定
要改 / 是问题 / 同意 / 采纳 / 对 → adopt；不用改 / 不是问题 / 不对 / 驳回 / 方案里有写 → reject（后面的话记为原因）；
改成：… / 我换个说法：… → rewrite；算轻微 / 降为一般 → adopt + 级别；还要加一条… / 漏了… → add（先匹配规则）；
剩下的都同意 → adopt_rest；结论定为… → set_final_verdict（还有没复核的先提醒还剩 n 条，专家坚持就照办）；
「没问题」有歧义（可能是「问题成立」也可能是「方案没问题」），复述一次再记。「先到这」→ 不写任何决定，告诉专家用 /review <id> 看进度。
指代：「第 3 条」= 你呈现时的编号；给了规则号以规则号为准；只剩一条待处理时默认指它，否则追问。

## 禁止
- 不在工具之外记录任何问题或决定。
- 不替专家定最终结论；不把「建议结论」说成「结论」。
- 不对程序检查（hard）规则调用 review_record_issue（会被拒绝）。
- 一次 ask_user_question 不超过 askBatchSize 条。
- 专家要求跳过复核直接出意见：不行，解释结论必须由专家定，并给「剩下的都同意 + 定结论」两步快速路径。
```

`ask_user_question` 的参数只有 `id / question / header / options[{label, description}] / multi_select`，专家总能输入自定义回答；问题的原文与建议都写在 `question` 里，不存在单独的 detail 字段。

## 4. 工具调用时序（规范路径）

```
专家: 预审这份方案 <markdown>
agent: review_parse ──▶ review_check ──▶ [memory_recall ×k, review_record_issue ×k] ──▶ review_status
agent: 三层呈现
agent: ask_user_question(署名)? ──▶ review_decide(set_reviewer)
agent: ask_user_question(第 1–5 条) ──▶ review_decide ×≤5 ──▶ 一行回执
agent: ask_user_question(第 6–10 条) ──▶ …
专家: 还要写清幂等
agent: rules_list ──▶ review_decide(add, INT-005)
专家: 剩下的都同意
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
| 「要改」「是问题」「同意」「采纳」「对」「是的」「要改，按这个建议」 | `adopt` |
| 「不用改」「不是问题」「不对」「驳回」「这条不成立」「不需要」「不用改，3.2 写了」「驳回：已在 3.2 说明」 | `reject`（引导词后、标点之后的文字即原因） |
| 「改成：……」「我换个说法：……」「建议写成：……」「要改，但我换个说法：……」 | `rewrite(text)`（冒号后的文字为改写文） |
| 「要改，但我换个说法」「改写」「换个说法」（没有内容） | 不写库：工具返回 `BAD_ACTION`，agent 追问一句「您想怎么写？」 |
| 「算轻微」「降成轻微再采纳」「降为 minor 后采纳」「要改，但算一般」「同意，升为严重」 | `adopt` + `severity`（只改这一条问题的级别，结论重算；规则不变） |
| 「没问题」「这条没问题」 | 有歧义（问题成立 / 方案没问题），复述一次再记 |
| 「还要加一条……」「补充一个问题……」「漏了……」 | `add`（先匹配规则；text 写成一句具体的话） |
| 「剩下的都同意」「其余都采纳」「后面的都通过」 | `adopt_rest`（只作用于已确认问题；待人工项仍逐条问） |
| 「结论定为建议整改」「这个方案不通过」「可以通过」 | `set_final_verdict`（仅在复核阶段；若问题尚未逐条处理，先提醒还有 n 条未复核，专家坚持则照办并记录 `verdictDelta`） |
| 「把 CAP-001 停了」「这项以后别查了」 | `rules_propose(disable)` |
| 「以后这类都算轻微」「CAP-002 以后按轻微」 | `rules_propose(set_severity)`（与上面「只改这一条」区分：说了「以后 / 都 / 这类」才改规则） |
| 「这条记录重复了」「这次不算，作废」 | `review_decide(discard, reason)` |
| 「先到这」「下次再说」 | 不写任何决定；回复可用 `/review <id>` 查看进度 |

指代消解：专家说「第 3 条」指 agent 呈现时的编号；说规则号以规则号为准；都没有且只有一条待处理时默认指它，否则追问。

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
| 门禁 `QUOTE_NOT_FOUND` | 对照 snippets 重新逐字摘录，重试一次；再失败接受 pending 并在清单里归入「要您判断」 | 问题 `pending`，`gate.reason` |
| `review_check` 全部 pass 且无候选 | 仍进入复核，只问最终结论（推荐「通过」） | 正常 |
| 专家对 hard 自动登记的问题驳回 | 照常 `reject`；汇报时提示「该规则已被驳回 n 次，可考虑调参（rules_propose）」（阈值同 `rejectWarn*`） | feedback；stats |
| 专家中途离开 | 不催促；会话里留下「用 /review <id> 查看进度，随时继续」 | `reviews.status = open` |
| 专家重新粘贴 / 重新给路径 / 重新转换同一方案 | 内容相同（只差空白换行）→ `existingReviewId`，直接接着复核；专家坚持从头再审 → `reuse:false` 新建 | 内容相同只有一条；新建时旧的进行中且无决定的记录自动 `superseded`（design §7） |
| 方案改过后再预审（同标题或同路径） | 新建记录；旧的进行中且无决定的记录自动被取代；旧记录已有决定时告诉专家，问要不要作废旧的 | 新记录 + 旧记录 `superseded` 或保留 |
| 专家要作废某条记录 | `review_decide(discard, reason)`；之后对该记录的任何操作返回 `REVIEW_CLOSED` | `status = discarded`，数据保留 |
| 专家要求跳过复核直接出意见 | 拒绝直接出；解释必须由专家确认结论；提供「其余全部采纳 + 确认结论」两步快速路径 | — |
| `ask_user_question` 被取消 / 超时 | 停止推进，说明可继续；不写决定 | — |
| 方案超过 200 KB | 提示拆分；不登记 | — |
| 模型给出的 ruleId 不存在 | 用 `rules_list` 纠正；仍不存在则不带 ruleId 登记（pending） | — |
| finalize 文件写失败 | 报告错误，不重试写库；建议专家检查输出目录设置 | 无变化 |
| 复核开始后要求「重新预审」 | `review_check` 返回 `REVIEW_ALREADY_DECIDED`；方案未改就继续复核；方案改过则 `review_parse(reuse:false)` 开新记录 | 旧记录保留 |
| 定稿后专家又改某条决定或结论（对话或看板） | 照常 `review_decide`；记录回到 `open`；提示需重新定稿，再次 `review_finalize` 生成 `-v2` 文件 | `reviews.status = open`，旧文件保留 |

## 8. 协议回放摘要（种子方案，S3c）

S3c 的确定性回放见 `tests/protocol/protocol.e2e.ts`。DSH 未随包提供 `dsh-llm-mock-server`，因此按 `progress.md` §7 使用脚本化 agent，而不是新增依赖。固定序列：

1. `review_parse` → `review_check`：3 条 hard 自动登记，7 个 hybrid 候选，1 条无候选的待人工项（INT-005），合计 11 条。
2. 对 7 个候选逐个 `memory_recall` → `review_record_issue`；INT-005 的引文在候选集外，门禁按设计保留 `pending`。
3. `review_status` → 按 严重 → 一般 → 轻微 → 待人工排序，批次 5/5/1；已确认项选项为「要改，按这个建议（推荐）/ 不用改 / 要改，但我换个说法」，待人工项为「要改 / 不用改」；每条 `question` 含「原文：」与「建议改成：」。
4. 专家驳回 1 条（不用改）、改写 1 条（我换个说法：…）、调级别采纳 1 条（算轻微）、其余采纳；补充 1 条专家意见；`set_reviewer` 署名张三。
5. 复核后 `aiVerdict=不通过`；专家确认后 `set_final_verdict` → `review_finalize`，写出 `reviews/<reviewId>.md`。

正式意见快照见 `tests/fixtures/expected/opinion-seed.md`；精确工具参数与调用序列以测试断言为准，本文不复制运行输出。

## 9. 测试要点（供 S2）

| ID | 要点 | 层 |
|---|---|---|
| T-PRO-01 | SKILL.md 可被 `ctx.skills` 发现，名称 `wsgw-solution-review`，渲染长度 < 8192 字 | protocol |
| T-PRO-02 | 脚本化 agent（或 mock LLM）：规范路径（§4）全程工具序列与参数快照 | protocol/e2e |
| T-PRO-03 | 批次：11 条问题 → 3 批（5/5/1）；已确认项选项为「要改，按这个建议（推荐）/ 不用改 / 要改，但我换个说法」，pending 项为「要改 / 不用改」；`question` 含原文与建议，不含 blocker / major / minor | protocol |
| T-PRO-04 | 自由文本回答 → `rewrite`；「要改，按这个建议（推荐）」「采纳（推荐）」→ `adopt` | tools |
| T-PRO-05 | `adopt_rest` 只采纳 `confirmed` 问题；`pending` 保持并在 `remainingPending` 返回 | tools |
| T-PRO-11 | 归一化：「驳回：原因」→ reject + reason；「采纳。」→ adopt；「改成：…」→ rewrite | tools |
| T-PRO-12 | 已有决定时重跑 `review_check` → `REVIEW_ALREADY_DECIDED`；定稿后 `decide` → 记录回 `open`，再定稿得 v2 | tools |
| T-PRO-13 | 口语归一化：「要改」「是问题」→ adopt；「不用改，3.2 写了」→ reject + 原因；「算轻微」「降为 minor 后采纳」「要改，但算轻微」→ adopt + minor；「要改，但我换个说法：…」→ rewrite；只有「要改，但我换个说法」/「改写」→ `BAD_ACTION`，不写库 | tools |
| T-PRO-06 | 署名：无默认署名时先问一次；有默认署名时不问 | protocol |
| T-PRO-07 | 最终结论确认的推荐项 = 复核后重算的 aiVerdict | engine/verdict + protocol |
| T-PRO-08 | 正式意见渲染：合并同规则、改写优先、通过空问题句、句末标点、v2 文件名 | engine/render |
| T-PRO-09 | 异常：门禁失败重试一次后接受 pending；取消 ask 不写库；重复粘贴询问 | protocol |
| T-PRO-10 | persona 文本与 §2 一致（快照） | config |
