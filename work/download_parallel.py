import json, os, time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
os.chdir(os.path.expanduser('~/workspace/jonathanmccallum-site/work'))
os.makedirs('raw_posts', exist_ok=True)
os.makedirs('raw_pages', exist_ok=True)
posts=json.load(open('download_list.json'))
pages=json.load(open('pages_list.json'))
HEAD={'User-Agent':'Mozilla/5.0 (content-recovery; jonathanmccallum.com rebuild)'}
def fetch(item, outdir, fn):
    out=os.path.join(outdir, fn)
    if os.path.exists(out) and os.path.getsize(out) > 2000:
        return (fn, 'cached')
    last=''
    for attempt in range(4):
        try:
            r=requests.get(item['wayback_url'], headers=HEAD, timeout=60)
            if r.status_code==200 and len(r.content) > 2000:
                open(out,'wb').write(r.content)
                return (fn, f'ok({len(r.content)})')
            last=f'http{r.status_code}/{len(r.content)}'
        except Exception as e:
            last=f'err:{type(e).__name__}'
        time.sleep(4*(attempt+1))
    return (fn, f'FAIL {last}')
jobs=[]
for i,p in enumerate(posts):
    jobs.append((p, 'raw_posts', f"{i:03d}_{p['slug']}.html"))
for pg in pages:
    jobs.append((pg, 'raw_pages', f"{pg['name']}.html"))
log=open('download_log2.txt','a')
done=0
with ThreadPoolExecutor(max_workers=6) as ex:
    futs={ex.submit(fetch, it, od, fn): fn for it, od, fn in jobs}
    for f in as_completed(futs):
        fn, res = f.result()
        done+=1
        log.write(f"{fn} {res}\n"); log.flush()
        if done % 25 == 0:
            print(f"{done}/{len(jobs)}: last {fn} {res}", flush=True)
print('DONE', flush=True)
log.close()
