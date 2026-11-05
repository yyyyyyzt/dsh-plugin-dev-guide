# ARS Stage2.5 检索清单

日期：2026-11-05 UTC。24次真实 web_search 调用，23个不同段落。所有调用报告 Keenable 返回8个结果；配置偏好为 Bing，未人为改变，实际工具自动路由。每条保留1–2个代表性候选URL（非全部8个的完整导出）。搜索引号不保证引擎执行严格短语匹配。未抓取页只作摘要筛选；无匹配统一为 `not_found_in_search`，绝非原创认证。

## Q01 / P004 — Introduction
- 原文：[main.tex:61–61](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L61-L61>)
- 特征引文（11词）及真实 query：`"Three ingestion routes dominate practice, and each loses a different property"`
- 候选URL：<https://medium.com/@aiwithakashgoyal/the-complete-guide-to-knowledge-graph-ingestion-3-techniques-that-will-transform-your-graphrag-cea250f6f32e?sk=e64bbc0fd253cf7c8c915a7cd2acaeca>; <https://fredk8.dev/blog/document-ingestion-is-not-a-side-effect>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q02 / P005 — Introduction
- 原文：[main.tex:63–63](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L63-L63>)
- 特征引文（11词）及真实 query：`"The less verifiable a requirement, the more it needs a model"`
- 候选URL：<https://arxiv.org/pdf/2609.12039>; <https://medium.com/@daniel.dahlin/how-i-made-llm-extracted-requirements-verifiable-1777e0c3d75d>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q03 / P004 — Introduction
- 原文：[main.tex:61–61](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L61-L61>)
- 特征引文（9词）及真实 query：`"knowledge is reassembled at every query and never consolidated"`
- 候选URL：<https://blog.gopenai.com/your-llm-has-been-forgetting-everything-karpathys-wiki-pattern-is-the-fix-6931ad90017b>; <https://particula.tech/blog/karpathy-llm-wiki-compiled-knowledge-vs-rag>
- 结果：`not_found_in_search`
- 核查说明：Related-topic candidate, but full-text verification unavailable (web_fetch HTTP 403); no verbatim match established from snippets. This candidate remains unverified.
- web_fetch：<https://blog.gopenai.com/your-llm-has-been-forgetting-everything-karpathys-wiki-pattern-is-the-fix-6931ad90017b> — HTTP 403 / fetch failed

## Q04 / P010 — Related Work
- 原文：[main.tex:109–110](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L109-L110>)
- 特征引文（11词）及真实 query：`"Checklist-based reading has been the backbone of document and code inspection"`
- 候选URL：<https://sciencedirect.com/science/article/abs/pii/S0164121200000522>; <https://doi.org/10.1109/32.922713>
- 结果：`not_found_in_search`
- 核查说明：Related-topic candidate, but full-text verification unavailable (web_fetch HTTP 403); no verbatim match established from snippets. This candidate remains unverified.
- web_fetch：<https://sciencedirect.com/science/article/abs/pii/S0164121200000522> — HTTP 403 / fetch failed

## Q05 / P012 — Related Work
- 原文：[main.tex:115–116](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L115-L116>)
- 特征引文（9词）及真实 query：`"PolicyGuard compiles organisational policy into typed relational logic rules"`
- 候选URL：<https://arxiv.org/html/2606.32004v1>; <https://alphaxiv.org/abs/2606.32004>
- 结果：`cited_paraphrase_or_shared_technical_terms`
- 核查说明：web_fetch HTTP200 verifies source abstract describes an executable review engine consisting of typed relational logic rules and atom-level extraction questions. Shared four-word technical term typed relational logic rules and source-specific conceptual paraphrase; no exact full query match established. Manuscript sentence cites malik2026, so not evidence of unattributed copying.
- web_fetch：<https://arxiv.org/html/2606.32004v1> — HTTP 200; visible abstract/introduction inspected; tool output truncated elsewhere

## Q06 / P013 — Related Work
- 原文：[main.tex:118–119](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L118-L119>)
- 特征引文（10词）及真实 query：`"Reviewing a proposal is machine teaching whether or not anyone"`
- 候选URL：<https://arxiv.org/pdf/2603.08281v1>; <https://arxiv.org/html/1707.06742v3>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q07 / P022 — Materials and Methods
- 原文：[main.tex:191–191](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L191-L191>)
- 特征引文（10词）及真实 query：`"A tier decides who may speak; it does not decide"`
- 候选URL：<https://miscsubjects.com/api/articles/export?all=1>; <https://jeff-breece.github.io/homelab/engineering/ai/2026/08/03/helen-tier-system.html>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q08 / P024 — Materials and Methods
- 原文：[main.tex:239–239](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L239-L239>)
- 特征引文（10词）及真实 query：`"a package is rejected as a whole if a rule"`
- 候选URL：<https://raw.githubusercontent.com/ailev/FPF/main/FPF-Spec.md>; <https://nikaia-lang.org/CHANGELOG.html>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q09 / P027 — Materials and Methods
- 原文：[main.tex:271–271](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L271-L271>)
- 特征引文（9词）及真实 query：`"Six verifier families and two combinators cover the package"`
- 候选URL：<https://link.springer.com/article/10.1007/11787006>; <https://usenix.org/system/files/usenixsecurity25-cai-yi.pdf>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q10 / P029 — Materials and Methods
- 原文：[main.tex:300–300](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L300-L300>)
- 特征引文（10词）及真实 query：`"The LLM writes findings only through one tool whose implementation"`
- 候选URL：<https://aclanthology.org/2026.acl-long.1951.pdf>; <https://arxiv.org/html/2608.30696>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q11 / P031 — Materials and Methods
- 原文：[main.tex:328–341](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L328-L341>)
- 特征引文（10词）及真实 query：`"The suggested verdict is a function of the confirmed findings"`
- 候选URL：<https://pubmed.ncbi.nlm.nih.gov/22490096>; <https://arxiv.org/html/2609.24200v1>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q12 / P036 — Materials and Methods
- 原文：[main.tex:353–353](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L353-L353>)
- 特征引文（8词）及真实 query：`"Not every learned edit is a parameter tuning"`
- 候选URL：<https://arxiv.org/pdf/2509.22072>; <https://arxiv.org/html/2406.01436v2>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q13 / P039 — Materials and Methods
- 原文：[main.tex:403–403](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L403-L403>)
- 特征引文（11词）及真实 query：`"the review cost is dominated by the number of candidate spans"`
- 候选URL：<https://raw.githubusercontent.com/ailev/FPF/main/FPF-Spec.md>; <https://arxiv.org/html/2606.28362v1>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q14 / P042 — Results
- 原文：[main.tex:415–416](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L415-L416>)
- 特征引文（10词）及真实 query：`"The self-check also caught a defect in the shipped package"`
- 候选URL：<https://github.com/KritankSingh/Terminal_Bench_Science_v0.2/blob/main/MASTER_CHECKLIST_TBSCI.md>; <https://arxiv.org/pdf/2608.23616v4>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q15 / P045 — Results
- 原文：[main.tex:462–462](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L462-L462>)
- 特征引文（10词）及真实 query：`"The aggregate hides an asymmetry that matters more than F1"`
- 候选URL：<https://bestaiweb.ai/optimizing-for-the-wrong-number-how-f1-score-masks-disparate-impact-in-high-stakes-classification>; <https://arxiv.org/pdf/2510.24884>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q16 / P048 — Results
- 原文：[main.tex:492–492](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L492-L492>)
- 特征引文（9词）及真实 query：`"The severity rows carry a warning for the organisation"`
- 候选URL：<https://pmc.ncbi.nlm.nih.gov/articles/PMC7432676>; <https://routebase.dev/guides/api-governance/api-rule-severity-and-enforcement>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q17 / P051 — Results
- 原文：[main.tex:541–541](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L541-L541>)
- 特征引文（9词）及真实 query：`"The deterministic judge submitted 53 hybrid findings; 42 passed"`
- 候选URL：<https://arxiv.org/html/2605.11907v1>; <https://arxiv.org/html/2609.02246v1>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q18 / P056 — Results
- 原文：[main.tex:592–592](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L592-L592>)
- 特征引文（10词）及真实 query：`"The walkthrough also shows what the design does not claim"`
- 候选URL：<https://techcrunch.com/2013/01/05/in-defense-of-the-humble-walkthrough>; <http://columbus.exp.sis.pitt.edu/socialreader/readings/books/lewis/4-1-2.html>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q19 / P059 — Discussion
- 原文：[main.tex:606–607](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L606-L607>)
- 特征引文（10词）及真实 query：`"Typing removed the failure mode rather than merely reducing it"`
- 候选URL：<https://raskincenter.org/ideas/modes-are-harmful>; <https://arxiv.org/html/2604.19884>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q20 / P060 — Discussion
- 原文：[main.tex:609–610](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L609-L610>)
- 特征引文（9词）及真实 query：`"The gate did not make the mechanism more accurate"`
- 候选URL：<https://archive.org/stream/sim_electrical-west_1928-05-15_60_6/sim_electrical-west_1928-05-15_60_6_djvu.txt>; <https://llmmart.ai/artifacts/agent-optimize>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q21 / P062 — Discussion
- 原文：[main.tex:617–617](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L617-L617>)
- 特征引文（10词）及真实 query：`"A false finding costs reviewer trust and, if it reaches"`
- 候选URL：<https://augmentcode.com/guides/ai-code-review-accuracy>; <https://prquorum.com/blog/reduce-ai-code-review-false-positives>
- 结果：`not_found_in_search`
- 核查说明：web_fetch HTTP200: thematically similar false-positive/trust discussion, but feature quotation not found in returned body; conceptual overlap alone does not establish copying.
- web_fetch：<https://augmentcode.com/guides/ai-code-review-accuracy> — HTTP 200; relevant sections inspected; output has truncation warning

## Q22 / P070 — Limitations and Future Work
- 原文：[main.tex:640–641](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L640-L641>)
- 特征引文（9词）及真实 query：`"Twenty-eight rules covering one capability's review checklist are not"`
- 候选URL：<https://github.com/microsoft/fabric-architecture-review/blob/main/config/review-checklist.yaml>; <https://github.com/w00fx/spec-anchored-agentic-development/blob/main/GUIDELINE.md>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q23 / P072 — Limitations and Future Work
- 原文：[main.tex:646–647](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L646-L647>)
- 特征引文（10词）及真实 query：`"Both are study designs, not implementation gaps, and both belong"`
- 候选URL：<https://pmc.ncbi.nlm.nih.gov/articles/PMC3731143>; <https://pubmed.ncbi.nlm.nih.gov/36925811>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.

## Q24 / P073 — Conclusions
- 原文：[main.tex:651–651](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L651-L651>)
- 特征引文（10词）及真实 query：`"its unit of authority is the tier, and its unit"`
- 候选URL：<https://github.com/jaydubya818/ai-software-factory-mastery/blob/main/guide/appendix/glossary.md>; <https://docs.findex.io>
- 结果：`not_found_in_search`
- 核查说明：Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.
