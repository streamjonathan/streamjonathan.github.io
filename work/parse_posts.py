import json, os, re, sys
from urllib.parse import urlparse, unquote
from lxml import html as lh

BASE=os.path.expanduser('~/workspace/jonathanmccallum-site')
WORK=os.path.join(BASE,'work')
CONTENT=os.path.join(BASE,'content')
os.makedirs(os.path.join(CONTENT,'posts'), exist_ok=True)

def clean_text(t):
    return re.sub(r'\s+', ' ', t or '').strip()

def md_escape(s):
    return s

def node_to_md(el, images, depth=0):
    """Convert an lxml element (entry-content subtree) to Markdown lines."""
    out=[]
    tag=el.tag if isinstance(el.tag, str) else ''
    if tag in ('script','style','noscript','form'):
        return out
    # text before children
    if el.text and el.text.strip():
        out.append(el.text.strip())
    for child in el:
        ctag=child.tag if isinstance(child.tag, str) else ''
        if ctag in ('script','style','noscript','form'):
            continue
        if ctag == 'p':
            txt=inline_md(child, images)
            if txt: out.append(txt+'\n')
        elif ctag in ('h1','h2','h3','h4'):
            txt=inline_md(child, images)
            if txt: out.append('#'*int(ctag[1])+' '+txt+'\n')
        elif ctag == 'blockquote':
            txt=inline_md(child, images)
            if txt: out.append('> '+txt.replace('\n','\n> ')+'\n')
        elif ctag in ('ul','ol'):
            for li in child.findall('li'):
                txt=inline_md(li, images)
                if txt: out.append(('- ' if ctag=='ul' else '1. ')+txt)
            out.append('')
        elif ctag == 'img':
            src=child.get('src') or ''
            alt=child.get('alt') or ''
            if src:
                images.append(src)
                out.append(f'![{alt}]({src})\n')
        elif ctag == 'a':
            href=child.get('href') or ''
            txt=inline_md(child, images)
            if href and re.search(r'\.(jpe?g|png|gif|webp)(\?|#|$)', href, re.I) and ('wp-content/uploads' in href or 'wp.com' in href) and '/wiki/' not in href:
                images.append(href)
            if href and ('youtube.com' in href or 'youtu.be' in href):
                out.append(f'[YouTube video]({href})\n')
            elif txt and href:
                out.append(f'[{txt}]({href})')
            elif txt:
                out.append(txt)
        elif ctag == 'iframe':
            src=child.get('src') or ''
            if src:
                out.append(f'[Embedded media]({src})\n')
        elif ctag == 'hr':
            out.append('---\n')
        elif ctag == 'br':
            out.append('')
        elif ctag == 'div':
            out.extend(node_to_md(child, images, depth+1))
        elif ctag == 'figure':
            out.extend(node_to_md(child, images, depth+1))
        elif ctag == 'figcaption':
            txt=inline_md(child, images)
            if txt: out.append('*'+txt+'*\n')
        else:
            txt=inline_md(child, images)
            if txt: out.append(txt)
        if child.tail and child.tail.strip():
            out.append(child.tail.strip())
    return out

def inline_md(el, images):
    parts=[]
    if el.text and el.text.strip():
        parts.append(el.text.strip())
    for child in el:
        ctag=child.tag if isinstance(child.tag, str) else ''
        if ctag in ('script','style'):
            continue
        if ctag == 'a':
            href=child.get('href') or ''
            txt=inline_md(child, images)
            if href and re.search(r'\.(jpe?g|png|gif|webp)(\?|#|$)', href, re.I) and ('wp-content/uploads' in href or 'wp.com' in href) and '/wiki/' not in href:
                images.append(href)
            if href and ('youtube.com' in href or 'youtu.be' in href):
                parts.append(f'[YouTube video]({href})')
            elif txt and href:
                parts.append(f'[{txt}]({href})')
            elif txt:
                parts.append(txt)
        elif ctag in ('strong','b'):
            txt=inline_md(child, images)
            parts.append(f'**{txt}**' if txt else '')
        elif ctag in ('em','i'):
            txt=inline_md(child, images)
            parts.append(f'*{txt}*' if txt else '')
        elif ctag == 'img':
            src=child.get('src') or ''
            alt=child.get('alt') or ''
            if src:
                images.append(src)
                parts.append(f'![{alt}]({src})')
        elif ctag == 'br':
            parts.append('\n')
        elif ctag == 'iframe':
            src=child.get('src') or ''
            if src:
                parts.append(f'[Embedded media]({src})')
        else:
            txt=inline_md(child, images)
            if txt: parts.append(txt)
        if child.tail and child.tail.strip():
            parts.append(child.tail.strip())
    return ' '.join(p for p in parts if p).strip()

def parse_file(path):
    raw=open(path,'rb').read()
    if len(raw)<2000: return None,'too small'
    try:
        doc=lh.fromstring(raw)
    except Exception as e:
        return None, f'parse error {e}'
    # strip HTML comments (theme markers like <!-- .entry-content --> leak into text)
    for c in doc.xpath('//comment()'):
        p=c.getparent()
        if p is not None: p.remove(c)
    # title
    title=None
    h1=doc.xpath('//h1[contains(@class,"entry-title")]')
    if h1: title=clean_text(h1[0].text_content())
    if not title:
        og=doc.xpath('//meta[@property="og:title"]/@content')
        if og:
            title=clean_text(og[0])
            for suf in (' - Jonathan McCallum',' \u2013 Jonathan McCallum',' | Jonathan McCallum'):
                if title.endswith(suf):
                    title=title[:-len(suf)]
            title=title.strip()
    if not title:
        t=doc.xpath('//title/text()')
        if t:
            title=clean_text(t[0]).split('|')[0].strip()
            for suf in (' - Jonathan McCallum',' – Jonathan McCallum'):
                if title.endswith(suf):
                    title=title[:-len(suf)]
            title=title.strip()
    # date
    date=None
    tm=doc.xpath('//time[contains(@class,"entry-date")]/@datetime')
    if tm: date=tm[0][:10]
    if not date:
        tm=doc.xpath('//time/@datetime')
        if tm: date=tm[0][:10]
    # content
    content_el=None
    for xp in ('//div[contains(@class,"entry-content")]',
               '//div[contains(@class,"post-content")]',
               '//article//div[contains(@class,"content")]',
               '//article'):
        els=doc.xpath(xp)
        if els:
            content_el=els[0]; break
    if content_el is None:
        return {'title':title,'date':date,'body_md':'','images':[],'empty':True}, 'no content element'
    # strip share buttons, recommendations, author boxes, tracking pixels
    for junk in content_el.xpath('.//div[contains(@class,"sharedaddy") or contains(@class,"shareaholic") or contains(@class,"jp-relatedposts") or contains(@class,"sd-block") or contains(@class,"wpcnt") or contains(@class,"author-info") or contains(@class,"post-author")]'):
        p=junk.getparent()
        if p is not None: p.remove(junk)
    for img in content_el.xpath('.//img'):
        s=(img.get('src') or '')
        if 'pixel.wp.com' in s or 'stats.wp.com' in s or img.get('width')=='1' or img.get('height')=='1':
            p=img.getparent()
            if p is not None: p.remove(img)
    images=[]
    lines=node_to_md(content_el, images)
    body='\n'.join(l for l in lines if l is not None).strip()
    body=re.sub(r'\n{3,}','\n\n',body)
    # categories/tags
    cats=[clean_text(c) for c in doc.xpath('//span[contains(@class,"cat-links")]//a/text()')]
    tags=[clean_text(c) for c in doc.xpath('//span[contains(@class,"tag-links")]//a/text()')]
    return {'title':title,'date':date,'body_md':body,'images':images,'categories':cats,'tags':tags}, 'ok'

if __name__=='__main__':
    # quick self-test on first downloaded file
    import glob
    fs=sorted(glob.glob(os.path.join(WORK,'raw_posts','*.html')))
    print('files:', len(fs))
    if fs:
        r, st = parse_file(fs[0])
        print('status:', st)
        print('title:', r.get('title') if r else None)
        print('date:', r.get('date') if r else None)
        print('body chars:', len(r.get('body_md','')) if r else 0)
        print('images:', r.get('images') if r else None)
        print('--- body preview ---')
        print((r.get('body_md','') if r else '')[:800])
