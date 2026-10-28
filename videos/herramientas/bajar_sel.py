import json,os,sys,urllib.request,urllib.parse,time,concurrent.futures as cf
UA={"User-Agent":"Mozilla/5.0"}; K=os.environ["PIXABAY_API_KEY"]
sel=json.load(open(sys.argv[1])); out=sys.argv[2]
if sys.argv[3:]: sel={k:v for k,v in sel.items() if k in sys.argv[3:]}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=120).read()
def url(ref):
    src,i=ref.split(":")
    if src=="mk":
        for r in ("720","360"):
            u=f"https://assets.mixkit.co/videos/{i}/{i}-{r}.mp4"
            try:
                urllib.request.urlopen(urllib.request.Request(u,headers={**UA,"Range":"bytes=0-10"}),timeout=30); return u, f"https://mixkit.co/free-stock-video/-{i}/ ({r}p)"
            except urllib.error.HTTPError: pass
        raise SystemExit(f"sin archivo {ref}")
    h=json.loads(get("https://pixabay.com/api/videos/?"+urllib.parse.urlencode({"key":K,"id":i})))["hits"][0]
    assert not h.get("isAiGenerated")
    vs=[v for v in h["videos"].values() if v.get("url")]; vs.sort(key=lambda v:(abs(max(v["width"],v["height"])-1920),-v["width"]))
    return vs[0]["url"], h["pageURL"]
jobs=[]
for cat,segs in sel.items():
    d=os.path.join(out,cat); os.makedirs(d,exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d,f))
    for seg,refs in segs.items():
        for n,ref in enumerate(refs): jobs.append((cat,seg,n,ref))
creds={}
def run(j):
    cat,seg,n,ref=j; u,page=url(ref)
    open(os.path.join(out,cat,f"{seg}_{n+1}.mp4"),"wb").write(get(u))
    return cat,f"{seg}_{n+1}.mp4\t{ref}\t{page}"
with cf.ThreadPoolExecutor(4) as ex:
    for cat,line in ex.map(run,jobs): creds.setdefault(cat,[]).append(line)
for cat,l in creds.items(): open(os.path.join(out,cat,"creditos.txt"),"w").write("\n".join(sorted(l))+"\n")
print(len(jobs),"clips")
