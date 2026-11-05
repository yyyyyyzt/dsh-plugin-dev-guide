# Pending分母小补核（只读）

2026-11-05；固定快照b566b08de2976451747215af4dc874a0846f6173。仅解析原始JSON及规则包，无新模型/评测实验，无修改原稿或快照。

## 结果

**932项全部是hybrid；不含500个soft项。每篇pending数组无重复，932代表932个唯一(document, rule)对，不是932个candidate span。**

| tier | pending对数 | 与本篇truth交集 | 与本篇predicted交集 |
|---|---:|---:|---:|
| hard | 0 | 0 | 0 |
| hybrid | 932 | 68 | 0 |
| soft | 0 | 0 | 0 |
| 未识别规则 | 0 | 0 | 0 |

逐规则数量：CAP-001 97、CAP-003 95、CHN-001 98、INT-002 96、INT-003 40、MON-001 47、SEC-001 100、SEC-003 55、SEC-004 97、SYN-001 51、INT-005 95、CAP-005 47、SEC-002 14（合计932）。五个soft规则CAP-004、SEC-005、CFG-001、DOC-003、DOC-004没有出现在pending列表。

## 如何解释68/932

68/932=**7.296%**可以准确称为“本合成数据、按(document, rule)计的pending集合中植入缺陷标签占比”，或“待办集合的植入缺陷命中率”。剩余864个pending对不在truth缺陷列表。

它不是confirmed finding precision，更不是人工复核的真实阳性率/实际工时收益。pending包括未判定的正常候选、无候选待人工与gate拒绝项，本来不是系统对缺陷的阳性断言。若明确将“转交人工的rule-document对”定义为检索输出，可称**相对本合成标签的转交集合precision**，但须明确对象、标签及单位；不能裸写“系统precision只有7.3%”，也不宜将864项直接叫864次误报。

932不只是一个无法比较的总工作量数：它与68使用相同(document, rule)单位，因此该占比在此数据上可计算；但932仅反映待审规则对数量，不测审阅时长或专家逐项处理次数。候选片段可以多对一地折叠进同一rule条目，跨文档同规则重复是有意的配对单位而非重复计数。

另一个不同指标是68/85=80%：**漏检缺陷中被pending覆盖的比例**。两者分别衡量待办集合标签密度和漏检覆盖，不能互换。

## 原始证据与操作

- 数据：[S-full r0原始JSON](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/paper/data/public/eval-runs/S-full_synthetic-v1-seed20261029_r0_2ff13abf.json>)的100个perSolution记录。
- tier来源：[原始规则包](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/rules/capability-open-access.rules.yaml>)。
- 生成逻辑：[ablation.ts:148–175](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L148-L175>)使用Set按ruleId去重；收录checklist status为pending/candidate且未预测的规则，再加入gate rejected规则；不收录soft状态。
- 本次运行`node --input-type=module`，用已安装yaml解析规则包；遍历每篇pending，以ruleId连接tier，分别累计`truth.includes(id)`、`predicted.includes(id)`及`pending.length-new Set(pending).size`。退出0，重复数0。
