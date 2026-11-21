import json, os, time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
BASE=os.path.expanduser('~/workspace/jonathanmccallum-site')
IMGDIR=os.path.join(BASE,'content','images')
os.makedirs(IMGDIR, exist_ok=True)
imgs=json.load(open('images_list.json'))
HEAD={'User-Agent':'Mozilla/5.0 (content-recovery; jonathanmccallum.com rebuild)'}
MAX_BYTES=5*1024*1024
def fetch(url, info):
    local=os.path.join(IMGDIR, os.path.basename(info['local']))
    if os.path.exists(local) and os.path.getsize(local) > 500:
        return (url, 'cached', os.path.getsize(local))
    wb=f"https://web.archive.org/web/{info['timestamp']}im_/{url}"
    last=''
    for attempt in range(3):
        try:
            r=requests.get(wb, headers=HEAD, timeout=60, stream=True)
            if r.status_code==200:
                ct=r.headers.get('content-type','')
                if 'image' not in ct and 'octet-stream' not in ct:
                    last=f'not-image:{ct}'
                    continue
                size=0
                with open(local,'wb') as f:
                    for chunk in r.iter_content(65536):
                        size+=len(chunk)
                        if size>MAX_BYTES:
                            break
                        f.write(chunk)
                if size>MAX_BYTES:
                    os.remove(local)
                    return (url, 'SKIP too big (>5MB)', size)
                if size>500:
                    return (url, 'ok', size)
                last=f'tiny:{size}'
            else:
                last=f'http{r.status_code}'
        except Exception as e:
            last=f'err:{type(e).__name__}'
        time.sleep(3*(attempt+1))
    if os.path.exists(local) and os.path.getsize(local)<=500:
        os.remove(local)
    return (url, f'FAIL {last}', 0)
log=open('image_download_log.txt','w')
skipped=[]
done=0; total_bytes=0
with ThreadPoolExecutor(max_workers=6) as ex:
    futs={ex.submit(fetch, u, info): u for u, info in imgs.items()}
    for f in as_completed(futs):
        url, res, size = f.result()
        done+=1
        total_bytes+=size if res=='ok' else 0
        log.write(f"{res} {size} {url}\n"); log.flush()
        if res!='ok' and res!='cached':
            skipped.append((url,res))
        if done % 50 == 0:
            print(f"{done}/{len(imgs)}", flush=True)
print('DONE', flush=True)
print('total bytes ok:', total_bytes)
json.dump(skipped, open('images_skipped.json','w'), indent=1)
print('skipped/failed:', len(skipped))
for u,r in skipped: print('  ', r, u)
log.close()
