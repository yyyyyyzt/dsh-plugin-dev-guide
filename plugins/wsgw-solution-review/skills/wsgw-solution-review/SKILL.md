---
name: wsgw-solution-review
description: 网上国网技术方案 AI 预审三阶段流程（预审 → 复核 → 定稿与回流）。专家要求审查/预审技术方案、复核意见、出具正式意见时加载。
---

# 技术方案预审流程

## 阶段一：预审
1. review_parse(source) → 记下 reviewId。若返回 existingReviewId，先问专家是继续还是重开（重开传 reuse=false）。
   若 warnings 含「时序图为图片」，在呈现结果时提醒专家：图片时序图无法校验。
   专家给的是 .docx 时，先用 skill 工具加载 office 技能把文档转为 Markdown（保存到工作目录），再 review_parse(path)。
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
   确认为问题 → adopt；不是问题 → reject。拿不准时直接传 answer=专家原话，由工具归一化。
9. 专家在对话中补充的新意见（如「还要补充幂等说明」）：先用 rules_list 找最接近的规则；能对应 → review_decide(action: add, ruleId, text)；不能对应 → review_decide(action: add, text)（不带 ruleId，进入候选规则）。向专家复述一遍登记结果。
10. 专家说「其余全部采纳」「剩下的都同意」→ review_decide(action: adopt_rest)。它只采纳「已确认」的问题；返回的 remainingPending 非空时，把这些待人工项逐条用 ask_user_question 请专家确认（确认为问题 / 不是问题），不要替专家批量确认。
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
16. 定稿后专家又改了某条决定或结论：照常 review_decide，记录会回到「进行中」；告诉专家需要重新定稿，再调用 review_finalize 生成新版本（-v2）。
17. 复核开始后专家要求「重新预审」：review_check 会返回 REVIEW_ALREADY_DECIDED。方案没改就继续复核；方案改过就 review_parse(reuse: false) 开新记录。

## 专家原话 → 决定
同意/采纳/对/这条没问题 → adopt；不对/驳回/不成立/方案里有写 → reject（原因=原话）；改成…/措辞换成… → rewrite；
还要加一条…/漏了… → add（先匹配规则）；其余都同意 → adopt_rest；结论定为… → set_final_verdict（若仍有未复核问题，先提醒还有 n 条，专家坚持则照办）；
把 X 停了 / X 降为 minor → rules_propose。「先到这」→ 不写任何决定，回复可用 /review <id> 查看进度。
指代：「第 3 条」= 当前批次第 3 条；给了规则号以规则号为准；只有一条待处理时默认指它，否则追问。

## 禁止
- 不在工具之外记录任何问题或决定。
- 不替专家选择最终结论；不把「建议结论」写成「结论」。
- 不对 hard 规则调用 review_record_issue（会被拒绝）。
- 不在一次 ask_user_question 里放超过 askBatchSize 条问题。
- 专家要求跳过复核直接出意见：拒绝，解释必须由专家确认结论，并提供「其余全部采纳 + 确认结论」两步快速路径。
