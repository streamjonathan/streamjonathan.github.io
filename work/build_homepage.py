import json, os, re
from urllib.parse import urlparse
from lxml import html as lh
import sys
sys.path.insert(0, os.path.expanduser('~/workspace/jonathanmccallum-site/work'))
from build_content import normalize_img_url, local_img_name, rewrite_img_urls
from parse_posts import clean_text

BASE=os.path.expanduser('~/workspace/jonathanmccallum-site')
WORK=os.path.join(BASE,'work')
CONTENT=os.path.join(BASE,'content')
TS='20260415100609'
URL='http://www.jonathanmccallum.com/'
doc=lh.fromstring(open(os.path.join(WORK,'raw_pages/homepage.html'),'rb').read())
def txt(el):
    return clean_text(el.text_content()) if el is not None else ''
# site tagline
tagline=''
meta_desc=doc.xpath('//meta[@name="description"]/@content')
if meta_desc: tagline=clean_text(meta_desc[0])
site_title='Jonathan McCallum'
t=doc.xpath('//title/text()')
if t: site_title=clean_text(t[0]).split('–')[0].strip()
articles=doc.xpath('//article')
lines=[]
imgs=[]
for a in articles:
    h=a.xpath('.//h2/a | .//h1/a')
    if not h: continue
    title=clean_text(h[0].text_content())
    link=h[0].get('href') or ''
    # date
    date=''
    tm=a.xpath('.//time/@datetime')
    if tm: date=tm[0][:10]
    # excerpt: entry-summary or first p
    ex=''
    s=a.xpath('.//div[contains(@class,"entry-summary")]')
    if s: ex=clean_text(s[0].text_content())
    if not ex:
        ps=a.xpath('.//p')
        if ps: ex=clean_text(ps[0].text_content())
    ex=re.sub(r'\s*\[Continue reading[^\]]*\]\s*$','',ex)
    ex=re.sub(r'\s*Continue reading.*$','',ex)
    # featured image
    im=a.xpath('.//img')
    img_md=''
    if im:
        src=im[0].get('src') or ''
        cu=normalize_img_url(src, URL)
        if cu:
            imgs.append(cu)
            alt=im[0].get('alt') or title
            img_md=f'![{alt}](/images/{local_img_name(cu)})'
    lines.append(f"### [{title}]({link})")
    if date: lines.append(f"*{date}*")
    if img_md: lines.append(img_md)
    if ex: lines.append(ex)
    lines.append('')
# also capture any intro text above the articles (site description)
intro=''
hdr=doc.xpath('//div[contains(@class,"site-description")]/text() | //p[contains(@class,"site-description")]/text()')
if hdr: intro=clean_text(hdr[0])
fm=['---','title: "Jonathan McCallum"',
    f'original_url: {URL}',
    f'wayback_url: https://web.archive.org/web/{TS}/{URL}',
    f'wayback_timestamp: {TS}',
    '---','',
    '# Jonathan McCallum','']
if intro: fm.append(intro+'\n')
if tagline and tagline!=intro: fm.append(tagline+'\n')
fm.append('## Recent posts\n')
out='\n'.join(fm)+'\n'.join(lines)
open(os.path.join(CONTENT,'homepage.md'),'w').write(out)
# register homepage images
imgs_list=json.load(open(os.path.join(WORK,'images_list.json')))
for cu in imgs:
    if cu not in imgs_list:
        imgs_list[cu]={'used_by':['homepage'],'timestamp':TS,'local':f"images/{local_img_name(cu)}"}
    elif 'homepage' not in imgs_list[cu]['used_by']:
        imgs_list[cu]['used_by'].append('homepage')
json.dump(imgs_list, open(os.path.join(WORK,'images_list.json'),'w'), indent=1)
# update index.json homepage entry
idx=json.load(open(os.path.join(CONTENT,'index.json')))
for p in idx['pages']:
    if p['name']=='homepage':
        p['title']='Jonathan McCallum'
        p['images']=[f"images/{local_img_name(cu)}" for cu in imgs]
        p['image_urls']=imgs
        p['recent_posts']=[re.sub(r'^### \[(.*)\]\(.*\)$', r'\1', l) for l in lines if l.startswith('### [')]
json.dump(idx, open(os.path.join(CONTENT,'index.json'),'w'), indent=1)
print('homepage articles:', len([l for l in lines if l.startswith('### [')]))
print('homepage images:', len(imgs))
for cu in imgs: print('  ', cu)
