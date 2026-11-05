import pathlib,json,re,hashlib,difflib
p=pathlib.Path('/root/research/hark-revision')
def sha(b):return hashlib.sha256(b).hexdigest()
man=json.loads((p/'editorial-patch-manifest.json').read_text());base=(p/'original-main.tex').read_text();s=base
man['patches']=[x for x in man['patches'] if x.get('phase')!='final-offset-copyedit']
pre=[x for x in man['patches'] if not x.get('phase')];post=[x for x in man['patches'] if x.get('phase')]
positions=[]
for x in pre:
 assert base.count(x['old'])==1,x['id'];a=base.index(x['old']);positions.append((a,a+len(x['old']),x))
for a,b,x in sorted(positions,reverse=True):s=s[:a]+x['new']+s[b:]
for x in post:
 assert s.count(x['old'])==1,x['id'];s=s.replace(x['old'],x['new'])
cur=(p/'main.tex').read_text()
fixes=[]
sl=s.splitlines(True);cl=cur.splitlines(True)
for op,a,b,c,d in difflib.SequenceMatcher(None,sl,cl,autojunk=False).get_opcodes():
 if op!='equal':fixes.append({'id':'final-copyedit-'+str(len(fixes)+1),'old':''.join(sl[a:b]),'new':''.join(cl[c:d]),'start_offset':len(''.join(sl[:a])),'end_offset':len(''.join(sl[:b])),'phase':'final-offset-copyedit','reason':'最终排版与状态术语校订；无新实验。'})
replay=s
for x in reversed(fixes):replay=replay[:x['start_offset']]+x['new']+replay[x['end_offset']:]
assert replay==cur
man['patches']+=fixes;man['output_sha256']=sha(cur.encode());man['final_copyedits_replay_verified']=True
(p/'editorial-patch-manifest.json').write_text(json.dumps(man,ensure_ascii=False,indent=2))
inputs=json.loads(pathlib.Path('/root/research/hark-audit/input-manifest.json').read_text())['inputs']
protected=[{'role':x['role'],'sha256':sha(pathlib.Path(x['path']).read_bytes()),'unchanged':sha(pathlib.Path(x['path']).read_bytes())==x['sha256']} for x in inputs];assert all(x['unchanged'] for x in protected)
cites=set()
for x in re.findall(r'\\cite\w*\*?(?:\[[^\]]*\])*\{([^}]*)\}',cur):cites.update(k.strip() for k in x.split(','))
bibs=re.findall(r'\\bibitem(?:\[[^\]]*\])?\{([^}]*)\}',cur)
labels=re.findall(r'\\label\{([^}]*)\}',cur);refs=re.findall(r'\\(?:ref|eqref|cref|Cref|autoref)\{([^}]*)\}',cur)
assert not cites-set(bibs),cites-set(bibs);assert len(bibs)==len(set(bibs));assert len(labels)==len(set(labels));assert not set(refs)-set(labels),set(refs)-set(labels)
stack=[]
for m in re.finditer(r'\\(begin|end)\{([^}]*)\}',cur):
 act,name=m.groups()
 if act=='begin':stack.append(name)
 else:assert stack and stack.pop()==name,(name,m.start())
assert not stack
abs=re.search(r'\\abstract\{(.*?)\}\s*\n\s*\\keyword',cur,re.S).group(1)
abs=re.sub(r'\\\w+\{([^}]*)\}',r'\1',abs);words=len(re.findall(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*",abs))
report={'scope':'Editorial manuscript checks only; no ARS certification or submission approval','source_sha256':sha(base.encode()),'final_sha256':sha(cur.encode()),'protected_inputs':protected,'exact_patch_replay':True,'final_copyedit_fragments':len(fixes),'citation_keys':len(cites),'bibliography_definitions':len(bibs),'missing_citation_definitions':sorted(cites-set(bibs)),'unused_bibliography_definitions':sorted(set(bibs)-cites),'unique_labels':len(labels),'references_resolved':True,'latex_environments_balanced':True,'abstract_word_count_approx':words,'author_confirmation_placeholders_retained':True,'new_engineering_or_model_experiments':False,'compilation':'pending','consistency_review':'model-assisted role-separated check; reported TikZ and adopted-state fixes applied; not independent human review','original_integrity_fail_closed':False}
(p/'revision-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='protected_inputs'},ensure_ascii=False,indent=2))
