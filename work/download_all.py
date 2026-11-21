import json, os, subprocess, time, sys
os.chdir(os.path.expanduser('~/workspace/jonathanmccallum-site/work'))
os.makedirs('raw_posts', exist_ok=True)
os.makedirs('raw_pages', exist_ok=True)
posts=json.load(open('download_list.json'))
pages=json.load(open('pages_list.json'))
def fetch(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 2000:
        return 'cached'
    for attempt in range(4):
        r=subprocess.run(['curl','-s','--max-time','90','-A','Mozilla/5.0 (content-recovery; contact jonathanmccallum.com)','-o',out,'-w','%{http_code}',url],
                         capture_output=True, text=True)
        code=r.stdout.strip()
        if os.path.exists(out) and os.path.getsize(out) > 2000 and code in ('200',):
            return f'ok({code})'
        if os.path.exists(out) and os.path.getsize(out) > 2000:
            return f'ok-size({code})'
        time.sleep(5*(attempt+1))
    return f'FAIL({code})'
log=open('download_log.txt','a')
n=0
for i,p in enumerate(posts):
    out=f"raw_posts/{i:03d}_{p['slug']}.html"
    res=fetch(p['wayback_url'], out)
    n+=1
    if n%20==0:
        print(f"{n}/{len(posts)} posts: last {p['slug']} {res}", flush=True)
    log.write(f"post {p['slug']} {p['timestamp']} {res}\n"); log.flush()
    time.sleep(1.5)
for pg in pages:
    out=f"raw_pages/{pg['name']}.html"
    res=fetch(pg['wayback_url'], out)
    print(f"page {pg['name']}: {res}", flush=True)
    log.write(f"page {pg['name']} {pg['timestamp']} {res}\n"); log.flush()
    time.sleep(1.5)
print('DONE', flush=True)
log.close()
