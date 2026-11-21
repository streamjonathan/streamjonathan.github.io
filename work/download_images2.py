import json, os, re, time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, quote
BASE=os.path.expanduser('~/workspace/jonathanmccallum-site')
IMGDIR=os.path.join(BASE,'content','images')
os.makedirs(IMGDIR, exist_ok=True)
imgs=json.load(open('images_list.json'))
HEAD={'User-Agent':'Mozilla/5.0 (content-recovery; jonathanmccallum.com rebuild)'}
MAX_BYTES=5*1024*1024
CDX='https://web.archive.org/cdx/search/cdx'

def cdx(url):
    """Return list of capture timestamps (str) with status 200, or None on transient error."""
    for attempt in range(4):
        try:
            r=requests.get(CDX, params={'url':url,'output':'json','filter':'statuscode:200',
                'fl':'timestamp','collapse':'digest'}, headers=HEAD, timeout=45)
            if r.status_code==200:
                data=r.json()
                if isinstance(data,list) and data:
                    return [row[0] for row in data[1:] if row]
                return []
            time.sleep(5*(attempt+1))
        except Exception:
            time.sleep(5*(attempt+1))
    return None

def candidates(url):
    out=[url]
    u=urlparse(url)
    # photon -> direct and direct -> photon
    m=re.match(r'i\d\.wp\.com$', u.netloc)
    if m:
        out.append(f"https://{u.path.lstrip('/')}")
    elif u.path.startswith('/'):
        pass
    # unsized original: strip -NNNxMMM before extension
    m2=re.search(r'-\d+x\d+(\.[a-z]+)(\?.*)?$', url, re.I)
    if m2:
        out.append(re.sub(r'-\d+x\d+(\.[a-z]+)', r'\1', url, flags=re.I))
    # wikimedia thumb -> original
    m3=re.match(r'https://upload\.wikimedia\.org/wikipedia/commons/thumb/([0-9a-f]/[0-9a-f]{2})/([^/]+)/\d+px-\2$', url)
    if m3:
        out.append(f"https://upload.wikimedia.org/wikipedia/commons/{m3.group(1)}/{m3.group(2)}")
    # photon variants of the direct url
    if not m:
        for i in ('i0','i1','i2'):
            out.append(f"https://{i}.wp.com/{u.netloc}{u.path}")
    seen=set(); res=[]
    for c in out:
        if c not in seen:
            seen.add(c); res.append(c)
    return res

def download(wb_url, local):
    for attempt in range(3):
        try:
            r=requests.get(wb_url, headers=HEAD, timeout=60, stream=True)
            if r.status_code==200:
                ct=r.headers.get('content-type','')
                if 'image' not in ct and 'octet-stream' not in ct:
                    return f'not-image:{ct}'
                size=0
                with open(local,'wb') as f:
                    for chunk in r.iter_content(65536):
                        size+=len(chunk)
                        if size>MAX_BYTES: break
                        f.write(chunk)
                if size>MAX_BYTES:
                    os.remove(local); return 'too big (>5MB)'
                if size>500: return ('ok', size)
                return f'tiny:{size}'
            time.sleep(4*(attempt+1))
        except Exception as e:
            time.sleep(4*(attempt+1))
    return 'download failed'

def fetch(url, info):
    local=os.path.join(IMGDIR, os.path.basename(info['local']))
    if os.path.exists(local) and os.path.getsize(local)>500:
        return (url,'cached',os.path.getsize(local))
    target=int(info['timestamp'])
    tried_cdx=False
    for cand in candidates(url):
        caps=cdx(cand)
        if caps is None:
            continue  # transient CDX failure; try next candidate
        tried_cdx=True
        if not caps:
            continue
        best=min(caps, key=lambda t: abs(int(t)-target))
        res=download(f"https://web.archive.org/web/{best}im_/{cand}", local)
        if isinstance(res, tuple):
            return (url,'ok',res[1])
        if res=='too big (>5MB)':
            return (url,'SKIP too big (>5MB)',0)
        # otherwise try next candidate
    if not tried_cdx:
        return (url,'FAIL cdx unavailable',0)
    return (url,'FAIL no archived copy found',0)

log=open('image_download_log2.txt','w')
skipped=[]; done=0; okbytes=0
with ThreadPoolExecutor(max_workers=6) as ex:
    futs={ex.submit(fetch,u,info):u for u,info in imgs.items()}
    for f in as_completed(futs):
        url,res,size=f.result()
        done+=1
        if res=='ok': okbytes+=size
        log.write(f"{res} {size} {url}\n"); log.flush()
        if res not in ('ok','cached'):
            skipped.append((url,res))
        if done%25==0: print(f"{done}/{len(imgs)}", flush=True)
print('DONE')
print('ok bytes:', okbytes)
json.dump(skipped, open('images_skipped.json','w'), indent=1)
print('skipped/failed:', len(skipped))
for u,r in skipped: print('  ',r,u)
log.close()
