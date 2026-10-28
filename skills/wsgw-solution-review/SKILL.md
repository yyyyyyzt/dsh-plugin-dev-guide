---
name: wsgw-solution-review
description: 网上国网技术方案 AI 预审三阶段流程（预审 → 复核 → 定稿与回流）。专家要求审查/预审技术方案、复核意见、出具正式意见时加载。
---

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
