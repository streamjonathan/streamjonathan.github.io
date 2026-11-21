#!/usr/bin/env python3
"""Fetch the 10 over-5MB images skipped by the Wayback recovery.
Same CDX + im_ method as download_images3.py, but with a 25 MB cap.
Max 2 attempts per step (one retry). Results to work/big_images_fetch.log.
"""
import json, os, time
import requests

BASE = os.path.expanduser('~/workspace/jonathanmccallum-site')
IMGDIR = os.path.join(BASE, 'content', 'images')
os.makedirs(IMGDIR, exist_ok=True)
HEAD = {'User-Agent': 'Mozilla/5.0 (content-recovery; jonathanmccallum.com rebuild)'}
CDX = 'https://web.archive.org/cdx/search/cdx'
MAX_BYTES = 25 * 1024 * 1024

imgs = json.load(open(os.path.join(BASE, 'work', 'images_list.json')))
skipped = json.load(open(os.path.join(BASE, 'work', 'images_skipped.json')))
targets = [u for u, r in skipped if 'too big' in r]
print(f"{len(targets)} targets")

def cdx(url):
    for _ in range(2):
        try:
            r = requests.get(CDX, params={'url': url, 'output': 'json',
                'filter': 'statuscode:200', 'fl': 'timestamp',
                'collapse': 'digest'}, headers=HEAD, timeout=25)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list) and data:
                    return [row[0] for row in data[1:] if row]
                return []
        except Exception:
            pass
        time.sleep(3)
    return None

def download(wb_url, local):
    for _ in range(2):
        try:
            r = requests.get(wb_url, headers=HEAD, timeout=60, stream=True)
            if r.status_code == 200:
                ct = r.headers.get('content-type', '')
                if 'image' not in ct and 'octet-stream' not in ct:
                    return f'not-image:{ct}'
                size = 0
                with open(local, 'wb') as f:
                    for chunk in r.iter_content(65536):
                        size += len(chunk)
                        if size > MAX_BYTES:
                            break
                        f.write(chunk)
                if size > MAX_BYTES:
                    os.remove(local)
                    return 'too big (>25MB)'
                if size > 500:
                    return ('ok', size)
                return f'tiny:{size}'
            return f'http:{r.status_code}'
        except Exception as e:
            time.sleep(3)
    return 'download failed'

results = []
for url in targets:
    info = imgs[url]
    local = os.path.join(IMGDIR, os.path.basename(info['local']))
    if os.path.exists(local) and os.path.getsize(local) > 500:
        results.append((url, 'cached', os.path.getsize(local), info['local']))
        print(f"cached {info['local']}")
        continue
    caps = cdx(url)
    if caps is None:
        results.append((url, 'FAIL cdx unavailable', 0, info['local']))
        print(f"FAIL cdx {url}")
        continue
    if not caps:
        results.append((url, 'FAIL no archived copy found', 0, info['local']))
        print(f"FAIL no capture {url}")
        continue
    best = min(caps, key=lambda t: abs(int(t) - int(info['timestamp'])))
    res = download(f"https://web.archive.org/web/{best}im_/{url}", local)
    if isinstance(res, tuple):
        results.append((url, 'ok', res[1], info['local']))
        print(f"ok {res[1]} {info['local']}")
    else:
        results.append((url, res, 0, info['local']))
        print(f"{res} {url}")

log = open(os.path.join(BASE, 'work', 'big_images_fetch.log'), 'w')
for url, res, size, local in results:
    log.write(f"{res} {size} {local} {url}\n")
log.close()
ok = sum(1 for _, r, _, _ in results if r in ('ok', 'cached'))
print(f"DONE: {ok}/{len(results)} ok")
