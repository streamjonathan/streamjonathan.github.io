import json, os, re, sys
from urllib.parse import urlparse, unquote
sys.path.insert(0, os.path.expanduser('~/workspace/jonathanmccallum-site/work'))
from parse_posts import parse_file, clean_text

BASE=os.path.expanduser('~/workspace/jonathanmccallum-site')
WORK=os.path.join(BASE,'work')
CONTENT=os.path.join(BASE,'content')
POSTS_DIR=os.path.join(CONTENT,'posts')
PAGES_DIR=os.path.join(CONTENT,'pages')
os.makedirs(POSTS_DIR, exist_ok=True)
os.makedirs(PAGES_DIR, exist_ok=True)

def normalize_img_url(src, page_url):
    """Return canonical original image URL or None."""
    if not src: return None
    src=src.strip()
    if src.startswith('data:'): return None
    if src.startswith('//'): src='https:'+src
    if src.startswith('/'):
        src='https://www.jonathanmccallum.com'+src
    # strip wayback prefix if any leaked in
    m=re.search(r'web\.archive\.org/web/\d+(?:im_)?/(https?://.*)$', src)
    if m: src=m.group(1)
    # photon CDN: i0/i1/i2.wp.com/<host>/<path> -> https://<host>/<path>
    m=re.match(r'https?://i\d\.wp\.com/([^/]+)/(.*)$', src)
    if m:
        src=f"https://{m.group(1)}/{m.group(2)}"
    # strip query string
    src=src.split('?')[0].split('#')[0]
    # must be an image file
    if not re.search(r'\.(jpe?g|png|gif|webp|svg)$', src, re.I):
        return None
    return src

def local_img_name(url):
    p=urlparse(url).path
    host=urlparse(url).netloc
    base=os.path.basename(p)
    if host not in ('www.jonathanmccallum.com','jonathanmccallum.com'):
        slug=re.sub(r'[^a-z0-9]+','-',host.lower()).strip('-')
        return f"ext-{slug}-{base}"
    m=re.search(r'/uploads/(\d{4})/(\d{2})/', p)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{base}"
    return base

def rewrite_img_urls(body, imgs):
    for cu in imgs:
        u=urlparse(cu)
        host=u.netloc
        path=u.path
        local=f"/images/{local_img_name(cu)}"
        pat=(r'https?://(?:i\d\.wp\.com/'+re.escape(host)+r'|'+re.escape(host)+r')'
             + re.escape(path) + r'[^\s)]*')
        body=re.sub(pat, local, body)
    return body


def fm_escape(s):
    s=(s or '').replace('"','\\"')
    return f'"{s}"'

posts=json.load(open(os.path.join(WORK,'download_list.json')))
pages=json.load(open(os.path.join(WORK,'pages_list.json')))
index={'site':'jonathanmccallum.com','posts':[],'pages':[]}
problems=[]
all_images={}  # canonical url -> {posts:[slugs], timestamp}
for i,p in enumerate(posts):
    raw=f"{WORK}/raw_posts/{i:03d}_{p['slug']}.html"
    r, st = parse_file(raw)
    if r is None:
        problems.append({'slug':p['slug'],'issue':st,'original_url':p['original_url']})
        continue
    title=r.get('title') or p['slug'].replace('-',' ').title()
    date=r.get('date') or p['date']
    body=r.get('body_md','')
    if not body.strip():
        problems.append({'slug':p['slug'],'issue':'empty body text','original_url':p['original_url'],'wayback_timestamp':p['timestamp']})
    imgs=[]
    for src in (r.get('images') or []):
        cu=normalize_img_url(src, p['original_url'])
        if cu:
            imgs.append(cu)
            all_images.setdefault(cu, {'posts':[], 'timestamp':p['timestamp']})
            if p['slug'] not in all_images[cu]['posts']:
                all_images[cu]['posts'].append(p['slug'])
    # rewrite image urls in body to local paths (any scheme, photon or direct, any query)
    body=rewrite_img_urls(body, imgs)
    fm=[ '---',
        f"title: {fm_escape(title)}",
        f"date: {date}",
        f"slug: {p['slug']}",
        f"original_url: {p['original_url']}",
        f"wayback_url: https://web.archive.org/web/{p['timestamp']}/{p['original_url']}",
        f"wayback_timestamp: {p['timestamp']}",
    ]
    if r.get('categories'): fm.append(f"categories: {json.dumps(r['categories'])}")
    if r.get('tags'): fm.append(f"tags: {json.dumps(r['tags'])}")
    fm.append('---\n')
    fname=f"{date}-{p['slug']}.md"
    open(os.path.join(POSTS_DIR,fname),'w').write('\n'.join(fm)+body+'\n')
    index['posts'].append({
        'slug':p['slug'],'title':title,'date':date,
        'original_url':p['original_url'],
        'wayback_url':f"https://web.archive.org/web/{p['timestamp']}/{p['original_url']}",
        'wayback_timestamp':p['timestamp'],
        'file':f"posts/{fname}",
        'images':[f"images/{local_img_name(cu)}" for cu in imgs],
        'image_urls':imgs,
        'categories':r.get('categories') or [],
        'tags':r.get('tags') or [],
        'word_count':len(body.split()),
    })

# pages (excluding homepage which gets its own file)
for pg in pages:
    raw=f"{WORK}/raw_pages/{pg['name']}.html"
    r, st = parse_file(raw)
    if pg['name']=='homepage':
        # save full text version
        body=r.get('body_md','') if r else ''
        title=r.get('title') if r else 'Jonathan McCallum'
        hp=[ '---',
            f"title: {fm_escape(title)}",
            f"original_url: {pg['original_url']}",
            f"wayback_url: https://web.archive.org/web/{pg['timestamp']}/{pg['original_url']}",
            f"wayback_timestamp: {pg['timestamp']}",
            '---\n']
        open(os.path.join(CONTENT,'homepage.md'),'w').write('\n'.join(hp)+body+'\n')
        index['pages'].append({'name':'homepage','title':title,'original_url':pg['original_url'],
            'wayback_url':f"https://web.archive.org/web/{pg['timestamp']}/{pg['original_url']}",
            'wayback_timestamp':pg['timestamp'],'file':'homepage.md'})
        continue
    if r is None:
        problems.append({'slug':pg['name'],'issue':st,'original_url':pg['original_url']})
        continue
    title=r.get('title') or pg['name']
    body=r.get('body_md','')
    imgs=[]
    for src in (r.get('images') or []):
        cu=normalize_img_url(src, pg['original_url'])
        if cu:
            imgs.append(cu)
            all_images.setdefault(cu, {'posts':[], 'timestamp':pg['timestamp']})
            if pg['name'] not in all_images[cu]['posts']:
                all_images[cu]['posts'].append(pg['name'])
    body=rewrite_img_urls(body, imgs)
    fm=['---',f"title: {fm_escape(title)}",f"slug: {pg['name']}",
        f"original_url: {pg['original_url']}",
        f"wayback_url: https://web.archive.org/web/{pg['timestamp']}/{pg['original_url']}",
        f"wayback_timestamp: {pg['timestamp']}",'---\n']
    fname=f"{pg['name']}.md"
    open(os.path.join(PAGES_DIR,fname),'w').write('\n'.join(fm)+body+'\n')
    index['pages'].append({'name':pg['name'],'title':title,'original_url':pg['original_url'],
        'wayback_url':f"https://web.archive.org/web/{pg['timestamp']}/{pg['original_url']}",
        'wayback_timestamp':pg['timestamp'],'file':f"pages/{fname}",
        'images':[f"images/{local_img_name(cu)}" for cu in imgs],'image_urls':imgs})

index['problems']=problems
index['image_count']=len(all_images)
json.dump(index, open(os.path.join(CONTENT,'index.json'),'w'), indent=1)
json.dump({u:{'used_by':v['posts'],'timestamp':v['timestamp'],'local':f"images/{local_img_name(u)}"} for u,v in sorted(all_images.items())},
          open(os.path.join(WORK,'images_list.json'),'w'), indent=1)
print('posts written:', len(index['posts']))
print('pages written:', len(index['pages']))
print('unique images:', len(all_images))
print('problems:', len(problems))
for pb in problems: print('  PROBLEM:', pb)
print('total words:', sum(p['word_count'] for p in index['posts']))
empty=[p for p in index['posts'] if p['word_count']<10]
print('posts with <10 words:', len(empty))
for p in empty: print('  SHORT:', p['slug'], p['word_count'], p['wayback_timestamp'])
