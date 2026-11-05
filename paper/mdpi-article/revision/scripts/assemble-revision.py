import json, pathlib, hashlib, re, shutil
p=pathlib.Path('/root/research/hark-revision')
s=(p/'original-main.tex').read_text(); base=s
patches=json.loads((p/'framing-replacements.json').read_text())+json.loads((p/'related-replacement.json').read_text())
# Exact, non-overlapping source substitutions; this is editorial provenance, not an ARS authorization validator.
for start,end,f,id in [ ('\\section{Materials and Methods}','\\section{Results}', 'methods-new.tex','methods-bounded-contract'), ('\\section{Results}','\\section{Discussion}', 'results-new.tex','results-retrospective-reaggregation')]:
 a=base.index(start);b=base.index(end,a)
 patches.append({'id':id,'old':base[a:b],'new':(p/f).read_text(),'reason':'按冻结快照重构方法/结果，分离现有能力、重聚合证据与尚未实现契约。'})
extra=(pathlib.Path('/root/research/hark-audit/evidence/external-bib.tex').read_text()+'\n'+(p/'coderabbit-bib.tex').read_text())
patches.append({'id':'inline-complete-bibliography','old':'\\input{bib.tex}','new':extra,'reason':'补齐原上传缺失的17项引用定义，内联以消除bib.tex依赖；增加有证据的CodeRabbit官方文档。'})
old=base[base.index('\\noindent\\textbf{Author Contributions:}'):base.index('\\reftitle{References}')]
new=r'''% AUTHOR CHECKPOINT: replace and verify every declaration below before submission.
\noindent\textbf{Author Contributions:} [AUTHOR CONFIRMATION REQUIRED: replace the A--F placeholders with the actual CRediT contributions and confirm all authors' approval.]

\noindent\textbf{Funding:} [AUTHOR CONFIRMATION REQUIRED: identify support and grant numbers, or confirm that no external funding was received.]

\noindent\textbf{Institutional Review Board Statement:} [AUTHOR CONFIRMATION REQUIRED: determine whether the private documents, operator decisions and historical opinions require institutional review; supply approval/exemption details or a justified not-applicable statement.]

\noindent\textbf{Informed Consent Statement:} [AUTHOR CONFIRMATION REQUIRED: confirm consent or its justified non-applicability for the reported workflow records and confidential materials.]

\noindent\textbf{Data Availability Statement:} The synthetic corpus, generator, judgement traces and evaluation scripts are supplied in the artifact repository at \url{https://github.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge}; this paper identifies repository snapshot \texttt{b566b08de2976451747215af4dc874a0846f6173}. The authors report an archive at \href{https://doi.org/10.5281/zenodo.23955205}{10.5281/zenodo.23955205}; access to, and exact content correspondence of, that archive was not verified in this revision. The historical opinions and three internal proposals are private. [AUTHOR CONFIRMATION REQUIRED: verify archive access/version and rights; specify reproducible access instructions and the anonymous workflow records that can be released.]

\noindent\textbf{Acknowledgments and Generative AI Disclosure:} AI-assisted tools were used for structural revision, language editing, comparative-literature analysis, and interpretation/checking of stored evaluation records; the editing session used DeepSeek Harness with model-assisted reviewer and revision roles. These tools were not used to generate new experimental outcomes in this revision. [AUTHOR CONFIRMATION REQUIRED: identify the exact tools, model names/versions and access dates used in the original drafting and this revision; verify all suggested changes and references, and confirm the authors' responsibility for the final content.]

\noindent\textbf{Conflicts of Interest:} [AUTHOR CONFIRMATION REQUIRED: disclose relevant relationships, including the development team's involvement with the system and host, or confirm the absence of conflicts.]

'''
patches.append({'id':'author-declarations-checkpoint','old':old,'new':new,'reason':'删除未经作者确认的贡献、伦理、资助和利益声明；不臆造事实。标记归档可访问性和AI工具信息待确认。'})
# Figure node labels must agree with the rewritten caption and methods.
for id,old,new in [
 ('architecture-judge-label',r'{LLM judge\\only inside\\candidate spans}',r'{judge\\flag / model route\\candidate snippets}'),
 ('architecture-gate-label',r'{evidence gate\\quote located\\in span?}',r'{evidence gate\\quote located\\candidate overlap?}'),
 ('architecture-reviewer-label',r'{expert decisions\\accept, dismiss,\\rewrite, add}',r'{recorded decisions\\accept, dismiss,\\rewrite, add}'),
 ('build-comment','%% Build: pdflatex main && pdflatex main   (see README.md; epstopdf logo step first)','%% EDITORIAL REVISION DRAFT: author declarations and engineering validation remain open.\n%% Build: tectonic main.tex (with accompanying Definitions/ assets)')]:
 patches.append({'id':id,'old':old,'new':new,'reason':'图中路由与正文一致；标注修订稿及构建依赖。'})
positions=[]
for x in patches:
 assert base.count(x['old'])==1,(x['id'],base.count(x['old']))
 a=base.index(x['old']);positions.append((a,a+len(x['old']),x))
for (_,b,x),(c,_,y) in zip(sorted(positions),sorted(positions)[1:]): assert b<=c,(x['id'],y['id'])
for a,b,x in sorted(positions,reverse=True):s=s[:a]+x['new']+s[b:]
# Post-composition copyedits recorded against the intermediate text.
post=[('terminology-retained-brand','We present HARK (Authority-Typed Review Knowledge),','We present HARK,'),('intro-retained-brand','We present HARK (Authority-Typed Review Knowledge) as','We present HARK, retaining the prototype name without implying a verified human-gating guarantee, as'),('remove-unretained-inference','Any retained bootstrap intervals or significance tests are conditional on this corpus and its shared templates.','The earlier bootstrap intervals and significance tests are not retained as verified inference in this revision.'),('caption-typo','``Unsufaced\'\'','``Unsurfaced\'\'')]
for id,old,new in post:
 assert s.count(old)==1,(id,s.count(old));s=s.replace(old,new)
 patches.append({'id':id,'old':old,'new':new,'reason':'组装后的术语/统计状态一致性校订。','phase':'post-composition'})
# Protect source and require the copied target still to be the known original.
assert (p/'main.tex').read_text()==base
(p/'main.tex').write_text(s)
(p/'editorial-patch-manifest.json').write_text(json.dumps({'scope':'editorial draft; NOT ARS exact-authority certification','source_sha256':hashlib.sha256(base.encode()).hexdigest(),'output_sha256':hashlib.sha256(s.encode()).hexdigest(),'patches':patches},ensure_ascii=False,indent=2))
repo=pathlib.Path('/root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/paper/mdpi-article/Definitions')
shutil.copytree(repo,p/'Definitions',dirs_exist_ok=True)
print('Applied',len(patches),'recorded editorial substitutions; chars',len(base),'->',len(s))
print('Output SHA256',hashlib.sha256(s.encode()).hexdigest())
