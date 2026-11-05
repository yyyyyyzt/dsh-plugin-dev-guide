import urllib.request,urllib.parse,json,re,pathlib,concurrent.futures
D=pathlib.Path('/root/research/hark-audit/evidence')
def fetch(url):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CitationAudit/1.0'}),timeout=45) as r:return {'url':url,'status':r.status,'body':r.read().decode('utf-8','replace')}
 except Exception as e:return {'url':url,'error':str(e)}
b=fetch('https://raw.githubusercontent.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge/b566b08de2976451747215af4dc874a0846f6173/paper/mdpi-article/bib.tex');(D/'external-bib-fetch.json').write_text(json.dumps(b));s=b.get('body','');(D/'external-bib.tex').write_text(s)
x=json.loads((D/'inventory.json').read_text());refs=x['refs']+[{'key':m.group(1),'entry':m.group(2).strip(),'external':True} for m in re.finditer(r'\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}\s*(.*?)(?=\\bibitem|\Z)',s,re.S)]
def work(r):
 text=r['entry'].replace('\\_','_');doi=re.search(r'https://doi.org/(\S+)',text)
 if doi:
  q=doi.group(1).rstrip('.');a=fetch('https://api.crossref.org/works/'+urllib.parse.quote(q,safe=''));r['query']=q;r['fetch']=a
  if a.get('status')==200:
   try:
    m=json.loads(a['body'])['message'];r['confirmed_metadata']={k:m.get(k) for k in ['title','author','published','published-print','published-online','container-title','volume','issue','page','article-number','DOI','abstract']}
   except Exception:pass
 else:
  ar=re.search(r'arXiv:(\d+\.\d+)',text)
  if ar:r['query']=ar.group(1);r['fetch']=fetch('https://arxiv.org/abs/'+ar.group(1))
 return r
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=10).map(work,refs));(D/'reference-fetches.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));
for r in results:
 m=r.get('confirmed_metadata',{});print(r['key'],r.get('fetch',{}).get('status',r.get('fetch',{}).get('error','NO DOI')),json.dumps(m,ensure_ascii=False)[:1800])
