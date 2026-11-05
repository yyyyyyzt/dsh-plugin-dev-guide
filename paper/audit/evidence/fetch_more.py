exec(open('/root/research/hark-audit/evidence/fetch_refs.py').read().split("b=fetch(")[0])
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,d):self.parts.append(d)
rs=json.loads((D/'reference-fetches.json').read_text());out=[]
for r in rs:
 if r.get('fetch',{}).get('error'):
  a=fetch('https://api.crossref.org/works?filter=doi:'+urllib.parse.quote(r['query'],safe='')+'&rows=1');r['retry']=a
  if a.get('status')==200:
   try:r['confirmed_metadata']=json.loads(a['body'])['message']['items'][0]
   except:pass
(D/'reference-fetches-retry.json').write_text(json.dumps(rs,ensure_ascii=False,indent=2))
urls={'huang2024self':'https://openreview.net/forum?id=IkmD3fKBPQ','madaan2023':'https://neurips.cc/virtual/2023/poster/71632','shinn2023':'https://neurips.cc/virtual/2023/poster/70114','iso29148':'https://www.iso.org/standard/72089.html','aiact2024':'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng','mermaid':'https://mermaid.js.org/','artifact':'https://github.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge','policy-full':'https://arxiv.org/html/2606.32004v1','sun-full':'https://arxiv.org/html/2501.15134v1','lin-full':'https://arxiv.org/html/2607.03316v1','rovo-full':'https://arxiv.org/html/2601.01129v2','zhang-full':'https://arxiv.org/html/2609.15964v1','reqplan-full':'https://www.mdpi.com/2073-431X/15/9/608','gao-full':'https://aclanthology.org/2023.emnlp-main.398/','liu-full':'https://aclanthology.org/2024.tacl-1.9/','memory-full':'https://aclanthology.org/2025.acl-long.1227/','marv':'https://urn.fi/URN:NBN:fi:tuni-202507297873'}
def work(kv):
 k,u=kv;a=fetch(u);(D/(k+'.json')).write_text(json.dumps(a,ensure_ascii=False));p=Text();p.feed(a.get('body',''));(D/(k+'.txt')).write_text('\n'.join(t.strip() for t in p.parts if t.strip()));return (k,a.get('status'),a.get('error'),len(a.get('body','')))
for v in concurrent.futures.ThreadPoolExecutor(max_workers=5).map(work,urls.items()):print(v)
for r in rs:print(r['key'],r.get('confirmed_metadata',{}).get('title'),r.get('retry',{}).get('error'))
