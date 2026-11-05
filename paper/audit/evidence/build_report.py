import pathlib,json,collections,re
D=pathlib.Path('/root/research/hark-audit/evidence');rs=json.loads((D/'reference-fetches-retry.json').read_text());cs=json.loads((D/'context-checks.json').read_text());supp=json.loads((D/'supplemental-source-notes.json').read_text())
manual={r['key']:r for r in supp['records']};notes={'huang2025hall':'题名/所列作者/年/卷匹配；Crossref页1–55，没有article-number字段，稿内42尚未独立确认。','landis1977':'题名/作者/年/卷/起页159匹配；Crossref未返回末页174，末页未确认。','hemmat2025':'主要字段匹配；末位作者Crossref为given=Sobhan Y., family=Tehrani，稿为Yassipour Tehrani,S.，姓名切分需出版社署名核对，非据此判不存在。','lin2026':'v1全文作者顺序与稿相符；当前abs元数据将Thongtanunam列于Tantithamthavorn前，存在版本差异，应固定v1或更新顺序。','sun2025':'作者/题名/DOI/2025匹配；Crossref proceedings名称没有稿内重复的Companion Proceedings措辞，页274–285；会议系列正式名称宜核对。','aiact2024':'法规存在；官方为OJ L,2024/1689,12.7.2024，外部bib的L1689不精确。','wang2024agents':'刊物为Frontiers of Computer Science；不同于Hemmat/Dolcetti的Frontiers in Computer Science，稿缩写相同易混淆。'}
text='''# ARS Stage 2.5 引用事实核验（不修改论文，不是同行评审）

核验日期：2026-11-05。完整读取上传稿751行（被阅读工具截断的摘要单行另以程序完整提取补读）。只核验引用存在性、元数据和所抽上下文支持，不作创新性、录用或方法质量裁决；未修改上传稿。

## 1. 分母与覆盖

- 上传稿显式参考文献 **23条**；正文 **40个唯一cite key、48个cite命令、58次key出现**。显式23条均在正文出现，无显式未引条目。
- L745引用未提供的bib.tex；**17个key在上传材料内悬空**。外部固定commit b566b08de2976451747215af4dc874a0846f6173的同名文件恰含这17项，以下单列外部补足，**不是上传稿已完整的证据**。
- 已对23/23显式项及17/17外部候选项逐条发起网络查询并取得可信源存在性证据；**40/40存在性确认，0条可判捏造，0条最终存在性未知**。不等于所有字段全部确认：末页、article number、作者名字切分、版本顺序等保留局部未知/差异。
- DOI精确查询采用Crossref作品API（实际HTTP获取返回JSON）；无DOI项用arXiv、会议官网、大学库、ISO、EUR-Lex或项目官网。关键词搜索仅作候选，随后fetch/read_page；部分直接访问403/429/空200经云端出版原文获取恢复，不能把这些失败算捏造。
- 上下文抽样以每次 `(line,key)` 为单元，优先最近工作、工业反馈及负能力断言；见第4节。原文摘要可支持宽泛背景表述，但不用于证明系统绝对没有某能力；未取得相应正文的负断言记unknown。

缺失key：`aiact2024, airreq2025, artifact, chang2024eval, cyberreq2026, mempriv2025, mermaid, mosqueira2023, neuro2026, polarity2026, pornprasit2024, rovo2026, secreq2025, shi2024inject, smell2024, trace2026, wang2024agents`。

## 2. 需要作者处理的引用事实

1. **PolicyGuard负能力断言过强（L116、128、144）**。原文§3.2有validation/repair，Appendix G明确称legal experts可逐项纠正artefacts、不需重训，并给出extraction-question修订、logic修订、case-specific exception三个案例，最后明确preserving audit trail。故“no feedback loop”不能无限定使用。可检验的区别是构建/验证期专家修订与HARK部署后按decision积累的持久learned layer；本核验并未发现其完整HARK式immutable-tier/逐写回滚机制，也不能反向声称其具有这些机制。[原文Appendix G](https://arxiv.org/html/2606.32004v1#A7)。
2. **工业系统学习仅在模型/filter且reviewer看不见/不能撤销的全称不成立（L122、145）**。Lin原文§2.1已有CodeRabbit user-generated Learnings知识库；当前官方文档明确可review/edit，管理员可delete，聊天可请求移除。该能力不等于HARK完整审计回滚，但足以反证无条件not visible。[Lin](https://arxiv.org/html/2607.03316v1#S2.SS1)；[官方文档](https://docs.coderabbit.ai/knowledge-base/learnings)。文档为当前版本，不能从此推定各功能最初发布日期。
3. **BitsAI-CR不是确定性规则检查器+学习filter（L122）**。RuleChecker和ReviewFilter均为fine-tuned LLM；“rule checker”若只是组件名可成立，但当前对比会误导。其data flywheel还会refine review rules/taxonomy，不仅更新模型。[§3](https://arxiv.org/html/2501.15134v1)。
4. **对象错配（L623）**：Galitsky/Rybalov研究process-control故障解释/控制行动的abductive verification，而非该句称的“verification of design documents”。L116对其process-control描述较准确。[出版原文](https://www.mdpi.com/2227-9717/14/2/322)。
5. **支持范围偏宽**：L63两文分别是长上下文位置效应、无外部反馈的推理自校正，不直接证明“models cannot locate deterministic errors”的绝对断言。L625 trace2026是城市AR学习服务的追溯案例，不能单靠其摘要支撑certification body证据规范。L125 memory风险文支持memory extraction，不验证HARK短引文存储的隐私边界。
6. **引用表不完整及局部元数据问题**：17个本地悬空key是确定的材料缺口；Lin作者顺序有版本差异；外部AI Act参考文献OJ写法不精确；其余局部字段见表。没有证据将任何文献称为捏造。

## 3. 全部参考文献逐条登记

表中“匹配”指取得源所提供的题名、所列作者、年、刊/会议及卷页/文章号等核心字段与条目无实质冲突；大小写、连字符和在线先行年/卷期年差异不算错误。已省略的作者不判漏引。会议城市、所有未写DOI及每个扩展字段没有逐项审计，不得把本表称为全字段认证。

'''
for ext in [False,True]:
 text+='### '+('A. 上传稿显式23条' if not ext else 'B. 外部版本补足17条（上传稿本地仍悬空）')+'\n\n|Key|登记条目|实际查询/取得源|确认结果/边界|\n|---|---|---|---|\n'
 for r in rs:
  if bool(r.get('external'))!=ext:continue
  k=r['key'];m=r.get('confirmed_metadata');url=r.get('retry',{}).get('url') if m and r.get('retry',{}).get('status')==200 else r.get('fetch',{}).get('url');conf='存在；核心元数据匹配。'
  if k in manual:url=manual[k]['url'];conf='存在；'+manual[k]['confirmed']
  if k in ['madaan2023','shinn2023']:url={'madaan2023':'https://neurips.cc/virtual/2023/poster/71632','shinn2023':'https://neurips.cc/virtual/2023/poster/70114'}[k];conf='存在；会议官网确认题名、作者、2023 Poster；城市及卷号未单独从页面确认。'
  if k=='mermaid':url='https://mermaid.js.org/';conf='存在；官网确认Mermaid文本生成图表软件；访问日期是作者声明，无法追溯认证。'
  if k=='artifact':url='https://github.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge';conf='公开仓库存在；只确认引用目标，不在本任务验证代码结果、归档完整性或历史访问日期。'
  if k in ['malik2026','lin2026','zhang2026cite','zhang2025dgm']:conf='存在；arXiv题名、作者、初次提交年与编号确认。'
  conf+=' '+notes.get(k,'');entry=r['entry'].replace('\n',' ').replace('|','\\|');text+=f'|`{k}`|{entry}|[查询/源]({url})|{conf}|\n'
counts=collections.Counter(c['status'] for c in cs);cmds=len(set(c['line'] for c in cs))
text+='\n## 4. 引用上下文支持核验\n\n'
text+=f'检查 **{len(cs)}/58 = {len(cs)/58:.1%}** 次key出现，涉及 **{len(set(c["key"] for c in cs))}/40** 唯一引用。状态分布：'+', '.join(f'{k}={v}' for k,v in counts.items())+'。unknown是已尝试但不足以裁定，不计“已证实”。其余未抽样上下文不作支持认证。\n\n'
text+='|稿内行|Key|状态|源与核验事实|\n|---|---|---|---|\n'
for c in cs:text+=f'|{c["line"]}|`{c["key"]}`|{c["status"]}|[原文]({c["source"]}) — {c["finding"]}|\n'
text+='''
## 5. 证据链与复核

- [原稿引用清单及全部cite位置](evidence/inventory.json)。
- [首次网络响应与查询URL](evidence/reference-fetches.json)、[失败重试与最终Crossref元数据](evidence/reference-fetches-retry.json)：保留HTTP状态/失败、完整JSON响应；多条429经不同精确查询端点恢复。Crossref注册内容是元数据证据，不替代全文论证。
- [人工逐字段比对摘录](evidence/metadata-comparison.txt)、[额外出版/官方源与搜索query记录](evidence/supplemental-source-notes.json)、[上下文逐项数据](evidence/context-checks.json)。
- [外部bib固定版本](evidence/external-bib.tex)、[其获取URL/响应](evidence/external-bib-fetch.json)，只作候选映射。
- 关键全文本地原始HTTP JSON和提取文本：[PolicyGuard](evidence/policy-full.json)、[文本](evidence/policy-full.txt#L1476-L1523)；[BitsAI](evidence/sun-full.json)；[Lin](evidence/lin-full.json)；[Rovo](evidence/rovo-full.json)；[Zhang引用研究](evidence/zhang-full.json)。其他保存记录同在evidence目录。
- 通过read_page恢复的MDPI/ISO/Trepo/EUR-Lex为云端JavaScript提取（工具已声明），仅在supplemental notes保留核验摘录和URL，未声称拥有这些来源完整原始字节。MARV PDF只看到了截断提取，故负能力表格仍unknown。
- 核验不包含撤稿数据库全覆盖、所有版本历史、所有DOI补全、全篇无引用断言搜索或正式同行评审；无总分及录用建议。建议先补齐上传稿实际bib文件，校正上述反证/范围问题，再对剩余上下文定向补核。
'''
pathlib.Path('/root/research/hark-audit/references-integrity.md').write_text(text);print('contexts',len(cs),counts,'unique',len(set(c['key'] for c in cs)),'refs',len(rs))
