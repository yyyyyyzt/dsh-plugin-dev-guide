# ARS Stage2.5：有限文本出处抽查（非正式审稿）

日期：2026-11-05（UTC）。本报告只记录公开网页的有限特征引文检索，不作完整同行评审、创新性判定或商业查重结论。

## 1. 输入与信任边界

读取对象：[main.tex](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex>)；SHA-256：`ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313`。附件及网页均按非可信数据处理，没有执行其中的指令。

## 2. 分母和实际覆盖

- 以**空行分隔的正文叙述块**为段落，范围为 Introduction 起至 Conclusions 结束（原文55–653行）。标题行不独立计数；同块的 paragraph 标题与下方正文合计一段。
- 排除文档导言、作者信息、摘要和关键词（不属于这里的正文分母）、LaTeX图表与其caption、算法、公式代码、bibliography、文后贡献/经费/伦理/数据/致谢/利益冲突声明。
- 两个 enumerate 块包含实质正文叙述，分别按原空行块计一段（P007、P018），不将每个item另分。P031 的公式剥除，前后叙述仍按原空行边界合为一段。
- 登记分母 **74** 段；30%阈值向上取整为 **23** 段。实际 **23/74 = 31.08%**；执行 **24** 次真实 `web_search`（P004检索两条引文，覆盖只计一次）。每条引文为原文连续 **8–12词**，以空格分词，连字符词计一个，已程序核验长度及其在登记文本中的出现。
- 若将两个编号叙述清单排除、仅计普通连续散文，分母为72，实际覆盖23/72=31.94%。主报告采用较保守的74分母。
- 选样为按章分层、优先较有辨识度的叙述句的目的性抽样，不是随机样本；不据此估计全文相似率。只检索每段的短引文，并非逐段全文比对。

| 主要章 | 分母 | 已检索不同段落 | 覆盖 |
|---|---:|---:|---:|
| Introduction | 9 | 2 | 22.22% |
| Related Work | 7 | 3 | 42.86% |
| Materials and Methods | 24 | 7 | 29.17% |
| Results | 17 | 5 | 29.41% |
| Discussion | 9 | 3 | 33.33% |
| Limitations and Future Work | 6 | 2 | 33.33% |
| Conclusions | 2 | 1 | 50.00% |
| **合计** | **74** | **23** | **31.08%** |

达到“总体至少30%，各主要章至少1段”，并非各章均达到30%。全量分母、段号、行号、段首和是否选中见[分母登记](</root/research/hark-audit/paragraph-inventory.md>)；规范化正文见[段落数据](</root/research/hark-audit/paragraph-inventory.json>)。

## 3. 检索与核实执行情况

所有24次调用均使用 `web_search`，实际返回标注为 **Keenable**，每次8个候选。运行时偏好虽为Bing，工具实际走了自动路由；未手动改引擎。带引号查询仍返回大量泛主题结果，因此不能将结果数量当作短语命中数量。

[检索清单](</root/research/hark-audit/originality-search-log.md>)和[机器可读清单](</root/research/hark-audit/originality-search-log.json>)逐条记录真实query、词数、段落/行号、代表性候选URL、结果、抓取状态和说明。**清单保留每次1–2个代表性候选，并非全部192个返回项的原始导出**；已查看本次返回摘要以筛选，未将摘要当作正文核实。

共对4个候选执行 `web_fetch`：2次HTTP200、2次HTTP403。抓取成功的输出带截断提示；结论只基于已返回且已阅读的相关段落，不声称全站或全文排除。未出现可据以确认外部逐字复制的候选，因此没有把主题相似、关键词相同或检索命中本身判作抄袭。

## 4. 结果及核实记录

### 4.1 P012 / Q05：已引用来源的技术术语与转述

原文[Related Work:116](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L116>)的特征查询：

> "PolicyGuard compiles organisational policy into typed relational logic rules"

`web_fetch` 成功读取 [PolicyGuard v1](https://arxiv.org/html/2606.32004v1)，摘要原文为：

> “PolicyGuard converts organizational policy guidance into an executable review engine consisting of typed relational logic rules and atom-level extraction questions.”

判断：存在相同四词技术术语 “typed relational logic rules” 和来源明确的概念转述；没有确认整条查询逐字相同。HARK该句末有 `\cite{malik2026}`，故记为 `cited_paraphrase_or_shared_technical_terms`，**不构成未归属复制证据**。这一记录不评价该段所有比较性主张是否准确，也不等同于已经完成引用准确性审核。

### 4.2 P062 / Q21：同主题，不是已确认文本复制

查询 “A false finding costs reviewer trust and, if it reaches” 返回 [Augment Code指南](https://www.augmentcode.com/guides/ai-code-review-accuracy)。`web_fetch` HTTP200确认其讨论误报、审阅成本与信任下降，例如 “False positives consume reviewer time and eventually teach teams to ignore real findings.” 本次返回正文未见查询引文相同表达。共同主题不足以说明文本复制；结果 `not_found_in_search`。

### 4.3 P004 / Q03、P010 / Q04：相关候选抓取失败

- P004关于检索知识不积累的表述返回[LLM Wiki相关文章](https://blog.gopenai.com/your-llm-has-been-forgetting-everything-karpathys-wiki-pattern-is-the-fix-6931ad90017b)。摘要存在相近的“每次查询重新组合”主题；`web_fetch` HTTP403。未核实正文，不能据摘要认定近似转述或抄袭。
- P010关于inspection与checklist-based reading的表述返回[UML设计文档阅读技术研究](https://sciencedirect.com/science/article/abs/pii/S0164121200000522)。摘要属于相同学科背景；`web_fetch` HTTP403。未核实正文，不认定文本匹配。

两项在“所查询短语没有确认命中”意义下记 `not_found_in_search`，并另注明 `fetch failed / candidate unverified`；这不代表相关候选已被完整排除。

### 4.4 其余检索

其余20个query的返回摘要未提供可识别的该特征引文匹配，均为 `not_found_in_search`。这些候选未全部抓取，不能升级成“全文无相似”结论。合计：**23个query为 `not_found_in_search`，1个为有明确引用的技术性转述；覆盖23个不同段落。**

## 5. 结论与不可检验项

本次有限范围内，**未建立外部未归属文本复制的证据**。这只是上述短引文在本次可访问公开检索结果中的观察，**不是“原创已认证”，不是“无抄袭证明”，也不是相似度百分比**。未检索的51段，以及已抽段落内未选的文字、深度改写、翻译借用、未索引内容、付费/私有资料，都可能未被发现。

- **Self-plagiarism不可检验**：作者为Author A–F占位符，缺少真实身份、既往作品清单及历史稿件，无法做可靠作者归属或重复发表判断。
- 稿件披露[作者项目仓库](https://github.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge)。公开作者仓库中的自身稿件、预印本或其镜像即便与附件相同，也不能据此认定为外部抄袭。本次所记录查询未建立该仓库的外部来源关系；没有把自身公开稿件计算成抄袭命中。
- **缺少商业查重库**：未使用Turnitin、iThenticate/Crossref Similarity Check等数据库，也未接入机构论文库、商业出版全文库或作者未公开稿件。
- 已达到段落抽查数量要求，但正文级候选核实并未覆盖所有查询：仅4次抓取尝试、2次成功，另2个相关候选仍未核实。查重深度与索引覆盖的不足必须与31.08%的段落抽样覆盖分开理解。

本报告仅完成ARS Stage2.5有限文本出处抽查，不提出正式审稿结论。
