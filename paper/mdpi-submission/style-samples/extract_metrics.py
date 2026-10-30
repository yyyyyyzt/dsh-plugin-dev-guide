import re, json, glob, os, subprocess, statistics, collections

def run(a): return subprocess.run(a,capture_output=True,text=True).stdout
def layout(p): return run(['pdftotext','-layout','-q',p,'-'])
def plain(p): return run(['pdftotext','-q',p,'-'])

DECLS=['Author Contributions','Funding','Institutional Review Board Statement',
       'Informed Consent Statement','Data Availability Statement','Acknowledgments',
       'Conflicts of Interest','Supplementary Materials','Abbreviations']

def body_end(t):
    i=None
    for m in re.finditer(r'(?m)^\s*References\s*$',t): i=m.start()
    return i if i else len(t)

def refs(t):
    s=t[body_end(t):]
    s=re.split(r'©\s*20\d\d by the authors',s)[0]
    parts=re.split(r'(?m)^\s*(\d{1,3})\.\s+', '\n'+s)
    out={}; it=iter(parts[1:])
    for n,b in zip(it,it):
        b=re.sub(r'\s+',' ',b).strip()
        if n.isdigit() and len(b)>25: out.setdefault(int(n),b)
    return [out[k] for k in sorted(out)]

def caps(t, kind):
    """return list of (number, caption) for figures/tables, caption = first 220 chars"""
    out={}
    for m in re.finditer(r'(?m)^\s*'+kind+r'\s+(\d{1,2})\.\s*(.{0,300})', t):
        n=int(m.group(1)); c=re.sub(r'\s+',' ',m.group(2)).strip()
        if n not in out and c:
            out[n]=c
    return [(k,out[k]) for k in sorted(out)]

def abstract(P):
    m=re.search(r'\bAbstract\s*\n(.+?)\n\s*Keywords:',P,re.S)
    return re.sub(r'\s+',' ',m.group(1)).strip() if m else ''

def keywords(P):
    m=re.search(r'Keywords:\s*(.+?)\n\s*(?:\n|Academic Editor|Received:)',P,re.S)
    if not m:
        m=re.search(r'Keywords:\s*(.+?)\n\s*\n',P,re.S)
    if not m: return []
    s=re.sub(r'\s*\n\s*',' ',m.group(1))
    return [k.strip(' .') for k in s.split(';') if k.strip(' .')]

def sections(L):
    b=L[:body_end(L)]; top={}; sub=set()
    for m in re.finditer(r'(?m)^\s*(\d{1,2})\.\s+([A-Z][^\n]{1,70}?)\s*$',b):
        top.setdefault(int(m.group(1)), m.group(2).strip())
    for m in re.finditer(r'(?m)^\s*(\d{1,2})\.(\d{1,2})\.?\s+[A-Z][^\n]{1,70}?\s*$',b):
        sub.add((int(m.group(1)),int(m.group(2))))
    return top, len(sub)

def meta(P):
    doi=re.search(r'10\.3390/computers\d+',P)
    head=[l.strip() for l in P.split('\n')[:14] if l.strip()]
    kind=head[0] if head else ''
    title=' '.join(head[1:3]) if len(head)>2 else ''
    au=re.search(r'Author Contributions',P)
    dates={k:(re.search(k+r':\s*([0-9]{1,2} [A-Z][a-z]+ 20\d\d)',P).group(1)
                 if re.search(k+r':\s*([0-9]{1,2} [A-Z][a-z]+ 20\d\d)',P) else None)
           for k in ['Received','Revised','Accepted','Published']}
    authors=[]
    blk=re.search(r'((?:[A-Z][a-zżé]+(?: [A-Z][a-z\.\-]+){0,3} \d(?:,\*|,\d)?\s*\*?,?\s*){2,})',P)
    return dict(doi=doi.group(0) if doi else None, kind=kind, title=title, dates=dates)

M=['January','February','March','April','May','June','July','August','September','October','November','December']
def d2i(s):
    if not s: return None
    d,mo,y=s.split(); return __import__('datetime').date(int(y),M.index(mo)+1,int(d))

rows=[]
for pdf in sorted(glob.glob('/tmp/mdpi/computers-*.pdf')):
    pid=os.path.basename(pdf)[:-4]
    L=layout(pdf);P=plain(pdf)
    B=L[:body_end(L)]
    R=refs(L)
    ys=[int(re.findall(r'\b(19\d\d|20[0-2]\d)\b',r)[0]) for r in R if re.findall(r'\b(19\d\d|20[0-2]\d)\b',r)]
    fg=caps(B,'Figure'); tb=caps(B,'Table'); top,sub=sections(L); m=meta(P)
    rec=dict(
        id=pid, doi=m['doi'], kind=m['kind'], title=m['title'],
        pages=int(re.search(r'Pages:\s+(\d+)',run(['pdfinfo',pdf])).group(1)),
        body_words=len(B.split()), abstract_words=len(abstract(P).split()),
        n_keywords=len(keywords(P)), keywords=keywords(P),
        nrefs=len(R), refs=R,
        n_doi=sum(1 for r in R if 'doi.org' in r),
        n_mdpi=sum(1 for r in R if re.search(r'\b(Computers|Sensors|Electronics|Mathematics|Applied Sciences|IEEE Access|Future Internet|Information|Symmetry|Energies|Applied Sciences)\b',r)),
        n_arxiv=sum(1 for r in R if 'arXiv' in r),
        n_proc=sum(1 for r in R if re.search(r'In Proceedings of|Conference|Symposium|Workshop',r)),
        n_book=sum(1 for r in R if re.search(r'Press|Springer|Wiley|Elsevier|CRC|Kluwer',r)),
        yr_min=min(ys) if ys else None, yr_max=max(ys) if ys else None,
        yr_med=statistics.median(ys) if ys else None,
        pct_2021plus=round(100*sum(1 for y in ys if y>=2021)/len(ys)) if ys else None,
        pct_2023plus=round(100*sum(1 for y in ys if y>=2023)/len(ys)) if ys else None,
        figs=len(fg), tables=len(tb), fig_caps=fg, tab_caps=tb,
        top_sections=top, n_subsections=sub,
        decls={d:(d in P) for d in DECLS},
        dates=m['dates'],
        turnaround=(d2i(m['dates']['Published'])-d2i(m['dates']['Received'])).days if (d2i(m['dates']['Published']) and d2i(m['dates']['Received'])) else None,
        review_time=(d2i(m['dates']['Accepted'])-d2i(m['dates']['Received'])).days if (d2i(m['dates']['Accepted']) and d2i(m['dates']['Received'])) else None,
        github=P.count('github'),
        data_avail=re.sub(r'\s+',' ',(re.search(r'Data Availability Statement:\s*(.{0,260})',re.sub(r'\s+',' ',P)) or [0,None])[1] or ''),
        funding=re.sub(r'\s+',' ',(re.search(r'Funding:\s*(.{0,200})',re.sub(r'\s+',' ',P)) or [0,None])[1] or ''),
        contrib=re.sub(r'\s+',' ',(re.search(r'Author Contributions:\s*(.{0,400})',re.sub(r'\s+',' ',P)) or [0,None])[1] or ''),
        total_words=len(P.split()),
    )
    rows.append(rec)
json.dump(rows,open('/tmp/mdpi/final.json','w'),indent=1,ensure_ascii=False)
print('articles',len(rows))
print(f"{'id':20}{'pg':>4}{'bodyW':>7}{'abs':>5}{'kw':>3}{'refs':>5}{'doi':>5}{'mdpi':>5}{'arx':>4}{'proc':>5}{'book':>5}{'yrs':>12}{'%21':>4}{'%23':>4}{'fig':>4}{'tab':>4}{'sub':>4}{'rev':>4}{'turn':>5}")
for r in rows:
    print(f"{r['id']:20}{r['pages']:4}{r['body_words']:7}{r['abstract_words']:5}{r['n_keywords']:3}{r['nrefs']:5}{r['n_doi']:5}{r['n_mdpi']:5}{r['n_arxiv']:4}{r['n_proc']:5}{r['n_book']:5}{str(r['yr_min'])+'-'+str(r['yr_max']):>12}{r['pct_2021plus']:4}{r['pct_2023plus']:4}{r['figs']:4}{r['tables']:4}{r['n_subsections']:4}{str(r['review_time']):>4}{str(r['turnaround']):>5}")
