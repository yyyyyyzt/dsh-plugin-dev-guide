import json,pathlib,hashlib,collections
out=pathlib.Path('/root/research/hark-audit')
rows=json.loads((out/'paragraph-inventory.json').read_text())
# Exact queries submitted to web_search, in call order; selected returned candidates only.
data=[
('P004','Three ingestion routes dominate practice, and each loses a different property',['https://medium.com/@aiwithakashgoyal/the-complete-guide-to-knowledge-graph-ingestion-3-techniques-that-will-transform-your-graphrag-cea250f6f32e?sk=e64bbc0fd253cf7c8c915a7cd2acaeca','https://fredk8.dev/blog/document-ingestion-is-not-a-side-effect']),
('P005','The less verifiable a requirement, the more it needs a model',['https://arxiv.org/pdf/2609.12039','https://medium.com/@daniel.dahlin/how-i-made-llm-extracted-requirements-verifiable-1777e0c3d75d']),
('P004','knowledge is reassembled at every query and never consolidated',['https://blog.gopenai.com/your-llm-has-been-forgetting-everything-karpathys-wiki-pattern-is-the-fix-6931ad90017b','https://particula.tech/blog/karpathy-llm-wiki-compiled-knowledge-vs-rag']),
('P010','Checklist-based reading has been the backbone of document and code inspection',['https://sciencedirect.com/science/article/abs/pii/S0164121200000522','https://doi.org/10.1109/32.922713']),
('P012','PolicyGuard compiles organisational policy into typed relational logic rules',['https://arxiv.org/html/2606.32004v1','https://alphaxiv.org/abs/2606.32004']),
('P013','Reviewing a proposal is machine teaching whether or not anyone',['https://arxiv.org/pdf/2603.08281v1','https://arxiv.org/html/1707.06742v3']),
('P022','A tier decides who may speak; it does not decide',['https://miscsubjects.com/api/articles/export?all=1','https://jeff-breece.github.io/homelab/engineering/ai/2026/08/03/helen-tier-system.html']),
('P024','a package is rejected as a whole if a rule',['https://raw.githubusercontent.com/ailev/FPF/main/FPF-Spec.md','https://nikaia-lang.org/CHANGELOG.html']),
('P027','Six verifier families and two combinators cover the package',['https://link.springer.com/article/10.1007/11787006','https://usenix.org/system/files/usenixsecurity25-cai-yi.pdf']),
('P029','The LLM writes findings only through one tool whose implementation',['https://aclanthology.org/2026.acl-long.1951.pdf','https://arxiv.org/html/2608.30696']),
('P031','The suggested verdict is a function of the confirmed findings',['https://pubmed.ncbi.nlm.nih.gov/22490096','https://arxiv.org/html/2609.24200v1']),
('P036','Not every learned edit is a parameter tuning',['https://arxiv.org/pdf/2509.22072','https://arxiv.org/html/2406.01436v2']),
('P039','the review cost is dominated by the number of candidate spans',['https://raw.githubusercontent.com/ailev/FPF/main/FPF-Spec.md','https://arxiv.org/html/2606.28362v1']),
('P042','The self-check also caught a defect in the shipped package',['https://github.com/KritankSingh/Terminal_Bench_Science_v0.2/blob/main/MASTER_CHECKLIST_TBSCI.md','https://arxiv.org/pdf/2608.23616v4']),
('P045','The aggregate hides an asymmetry that matters more than F1',['https://bestaiweb.ai/optimizing-for-the-wrong-number-how-f1-score-masks-disparate-impact-in-high-stakes-classification','https://arxiv.org/pdf/2510.24884']),
('P048','The severity rows carry a warning for the organisation',['https://pmc.ncbi.nlm.nih.gov/articles/PMC7432676','https://routebase.dev/guides/api-governance/api-rule-severity-and-enforcement']),
('P051','The deterministic judge submitted 53 hybrid findings; 42 passed',['https://arxiv.org/html/2605.11907v1','https://arxiv.org/html/2609.02246v1']),
('P056','The walkthrough also shows what the design does not claim',['https://techcrunch.com/2013/01/05/in-defense-of-the-humble-walkthrough','http://columbus.exp.sis.pitt.edu/socialreader/readings/books/lewis/4-1-2.html']),
('P059','Typing removed the failure mode rather than merely reducing it',['https://raskincenter.org/ideas/modes-are-harmful','https://arxiv.org/html/2604.19884']),
('P060','The gate did not make the mechanism more accurate',['https://archive.org/stream/sim_electrical-west_1928-05-15_60_6/sim_electrical-west_1928-05-15_60_6_djvu.txt','https://llmmart.ai/artifacts/agent-optimize']),
('P062','A false finding costs reviewer trust and, if it reaches',['https://augmentcode.com/guides/ai-code-review-accuracy','https://prquorum.com/blog/reduce-ai-code-review-false-positives']),
('P070',"Twenty-eight rules covering one capability's review checklist are not",['https://github.com/microsoft/fabric-architecture-review/blob/main/config/review-checklist.yaml','https://github.com/w00fx/spec-anchored-agentic-development/blob/main/GUIDELINE.md']),
('P072','Both are study designs, not implementation gaps, and both belong',['https://pmc.ncbi.nlm.nih.gov/articles/PMC3731143','https://pubmed.ncbi.nlm.nih.gov/36925811']),
('P073','its unit of authority is the tier, and its unit',['https://github.com/jaydubya818/ai-software-factory-mastery/blob/main/guide/appendix/glossary.md','https://docs.findex.io'])]
source='/root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex'
lookup={r['id']:r for r in rows}; logs=[]
for n,(pid,q,urls) in enumerate(data,1):
 assert 8<=len(q.split())<=12,(n,q,len(q.split()))
 r=lookup[pid]
 assert q in r['text'],(pid,q)
 result='not_found_in_search'; note='Returned snippets contain no quoted feature-string match; topical/keyword candidates only. Not fetched; not a full-page exclusion.'; fetch=[]
 if n in (3,4):
  note='Related-topic candidate, but full-text verification unavailable (web_fetch HTTP 403); no verbatim match established from snippets. This candidate remains unverified.'
  fetch=[{'url':urls[0],'tool':'web_fetch','status':'HTTP 403 / fetch failed'}]
 if n==5:
  result='cited_paraphrase_or_shared_technical_terms'
  note='web_fetch HTTP200 verifies source abstract describes an executable review engine consisting of typed relational logic rules and atom-level extraction questions. Shared five-word technical term typed relational logic rules (four words) and source-specific conceptual paraphrase; no exact full query match established. Manuscript sentence cites malik2026, so not evidence of unattributed copying.'
  note=note.replace('Shared five-word technical term typed relational logic rules (four words)','Shared four-word technical term typed relational logic rules')
  fetch=[{'url':urls[0],'tool':'web_fetch','status':'HTTP 200; visible abstract/introduction inspected; tool output truncated elsewhere'}]
 if n==21:
  note='web_fetch HTTP200: thematically similar false-positive/trust discussion, but feature quotation not found in returned body; conceptual overlap alone does not establish copying.'
  fetch=[{'url':urls[0],'final_url':'https://www.augmentcode.com/guides/ai-code-review-accuracy','tool':'web_fetch','status':'HTTP 200; relevant sections inspected; output has truncation warning'}]
 logs.append(dict(query_id=f'Q{n:02}',paragraph_id=pid,section=r['section'],lines=[r['start'],r['end']],quote=q,word_count=len(q.split()),query='"'+q+'"',tool='web_search',reported_engine='Keenable',returned_candidate_count=8,candidate_urls_retained=urls,retention='Selected representative candidates, not exhaustive eight-result dump',result=result,note=note,fetch=fetch,date_utc='2026-11-05'))
(out/'originality-search-log.json').write_text(json.dumps(logs,ensure_ascii=False,indent=2))
md=['# ARS Stage2.5 检索清单','', '日期：2026-11-05 UTC。24次真实 web_search 调用，23个不同段落。所有调用报告 Keenable 返回8个结果；配置偏好为 Bing，未人为改变，实际工具自动路由。每条保留1–2个代表性候选URL（非全部8个的完整导出）。搜索引号不保证引擎执行严格短语匹配。未抓取页只作摘要筛选；无匹配统一为 `not_found_in_search`，绝非原创认证。','']
for x in logs:
 md += [f"## {x['query_id']} / {x['paragraph_id']} — {x['section']}",f"- 原文：[main.tex:{x['lines'][0]}–{x['lines'][1]}](<{source}#L{x['lines'][0]}-L{x['lines'][1]}>)",f"- 特征引文（{x['word_count']}词）及真实 query：`{x['query']}`",'- 候选URL：'+ '; '.join(f'<{u}>' for u in x['candidate_urls_retained']),f"- 结果：`{x['result']}`",f"- 核查说明：{x['note']}"]
 for f in x['fetch']:md.append(f"- web_fetch：<{f['url']}> — {f['status']}")
 md.append('')
(out/'originality-search-log.md').write_text('\n'.join(md))
selected={x['paragraph_id'] for x in logs}; inv=['# 正文分母登记','', '空行分块，保留正文叙述，标题和LaTeX标记剥离；编号清单的叙述作为其所在空行块计入（P007/P018），不按item另分。公式不计入叙述，但公式前后同属一个空行块的文字仍算一块（P031）。','', '| ID | 章 | 原文行 | 已查询 | 段首 |','|---|---|---|---|---|']
for r in rows:inv.append(f"| {r['id']} | {r['section']} | [L{r['start']}–{r['end']}](<{source}#L{r['start']}-L{r['end']}>) | {'yes' if r['id'] in selected else 'no'} | {r['text'][:100]} |")
(out/'paragraph-inventory.md').write_text('\n'.join(inv))
print('paragraphs',len(rows),'unique searched',len(selected),'coverage',len(selected)/len(rows),'queries',len(logs))
print('sha256',hashlib.sha256(pathlib.Path(source).read_bytes()).hexdigest())
print(collections.Counter(lookup[p]['section'] for p in selected))
