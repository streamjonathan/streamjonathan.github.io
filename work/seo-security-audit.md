# SEO + security audit — jonathanmccallum.com

Done 21 Nov 2026, on the local repo (commit 5e30a13 + these fixes, not yet
pushed). The site is a static Eleventy site on Cloudflare Pages. No Carl
Medearis content anywhere. Nothing third-party was added.

## What was already good

- **Static only.** No server code, no database, no login form, no comment
  form that writes anywhere. The newsletter form is a placeholder (it never
  sends anything); the chat form only POSTs to `/api/ask`. There is nothing
  to log into and nothing to deface except by replacing files in GitHub.
- **Sitemap** listed published posts only (just "to sea") plus the pages.
  **Feed** was already valid RSS with the real post text.
- **Pagefind search** only indexes what is built — drafts are never
  searchable. Verified below.
- **The AI Worker** (`site-ai/src/index.js`): no tools, no web access, no
  memory, no history, no cookies. It only reads the Vectorize index of
  published posts. Input is capped at 500 chars; the answer is checked in
  code (short, no email/phone/address pattern, must cite a source) and
  anything failing is replaced with the fixed warm refusal. Per-IP rate
  limit (10/min) plus the AI Gateway limit. The system prompt holds no
  personal data — only the public byline. The homepage already labels the
  chat "an AI guide to his published writing — it is not Jonathan himself."
- **No secrets in the repo.** Scanned every file except `node_modules`,
  `_site` and `.git`: no API keys, tokens, passwords or private keys. The
  only things matching were the words "secret" in old post prose and
  `CF_ACCOUNT_ID` / `CF_API_TOKEN` named as environment variables in
  comments and docs — never given a value. No `.env` or `.dev.vars` file
  exists, and `.gitignore` covers both, plus `.wrangler/` and
  `site-ai/index/`. The only email addresses in the content are the public
  `safety@periscope.tv` in an old post and the `you@example.com`
  placeholder in the newsletter form — neither is anyone's private address.
- **Dependencies are current.** Installed = latest on the registry:
  Eleventy 3.1.8, eleventy-img 7.1.1, Pagefind 1.6.0. (`npm audit` itself
  could not run here — the VM blocks the audit endpoint with a 403
  policy error — so re-run `npm audit` once from a normal network. No
  upgrade was made.)

## What I fixed

- **`_includes/layouts/base.njk`** — every page now gets: a per-page meta
  description (first ~150 characters of the page's own real text, never
  invented; homepage keeps the site description), canonical URL, Open
  Graph tags (title, description, url, type, article date, image) and
  Twitter card tags. JSON-LD added: `WebSite` + `Person` on the homepage
  (name, site, public Instagram / Threads / YouTube / Substack only — no
  email, no personal details), `BlogPosting` on post pages (headline,
  description, dates, author, image), `WebPage` elsewhere.
- **`_includes/layouts/base.njk`, `index.njk`, `search.njk`, `js/`** —
  the three inline scripts are now external same-origin files
  (`js/main.js` video facades, `js/ask.js` chat + newsletter,
  `js/search.js` Pagefind init). The site works exactly as before, but
  there is no inline executable script left on any page.
- **`_headers`** — added HSTS (`max-age=63072000; includeSubDomains`,
  deliberately WITHOUT preload — see below) and tightened the CSP to
  `script-src 'self'; style-src 'self'` (no `unsafe-inline` anywhere),
  `img-src 'self' https://i.ytimg.com`, `frame-src` only
  youtube-nocookie, `connect-src 'self'`, `form-action 'self'`,
  `frame-ancestors 'self'`, `object-src 'none'`. Kept
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- **`robots.njk`** (new) — `/robots.txt`: allow all, points to the
  sitemap.
- **`sitemap.njk`** — posts now carry `<lastmod>` (their publish date).
- **`_redirects`** — the www → apex line was invalid (Cloudflare Pages
  `_redirects` only takes path sources, not full URLs — that is what the
  first deploy log meant by "invalid redirect lines"). The file now says
  so and the redirect is a dashboard rule instead (see below).
- **`scripts/build-share-image.mjs`** (new, wired into `postbuild`) —
  builds a 1200×630 share image from Jonathan's own wave photo
  (`content/images/2015-08-WaveJMcCallum.jpg`) at build time. Every page
  uses it as its `og:image` / Twitter image (~94 KB JPEG, not the 3.7 MB
  original).

## Verified (local build + python server)

Build passes (`npm run build`, 18 files + Pagefind + share image). All
200: `/`, `/2014/03/12/timetogotosea/`, `/sitemap.xml`, `/robots.txt`,
`/feed/`, `/search/`, `/images/share.jpg`, `/js/main.js`, `/js/ask.js`,
`/js/search.js`. Homepage meta description, canonical and JSON-LD
(`WebSite` + `Person`) present. Post description is the poem's own first
lines; `BlogPosting` with `datePublished: 2014-03-12` present. Sitemap
lists the homepage, 11 pages and only the one published post. Feed parses
as valid XML with 1 item ("to sea"). Pagefind confirmed: the compressed
index fragment for `/2014/03/12/timetogotosea/` contains the full poem
text, title and word count. No inline executable script remains in the
built HTML.

Honest limit: a local python server does NOT apply `_headers`, so the
headers above were verified by reading the file, not by a live response.
Check them live after the next deploy with
`curl -I https://jonathanmccallum.com/` — expect HSTS, nosniff and the
CSP above.

## Still needs the Cloudflare dashboard (Bobby — not code)

1. **www → apex redirect:** Rules → Redirect Rules → match
   `www.jonathanmccallum.com/*` → `https://jonathanmccallum.com/$1`,
   status 301. (Replaces the invalid `_redirects` line.)
2. **Bot Fight Mode:** Security → Bots → turn ON (free).
3. **WAF managed ruleset:** Security → WAF → Managed rules → turn ON
   (free).
4. **DNSSEC:** DNS → Settings → DNSSEC → Enable — only AFTER the DNS
   switch, then add the DS record it shows at IONOS.
5. **HSTS preload:** leave OFF for now. Add `; preload` to the header
   and submit to hstspreload.org only after the site has served HTTPS
   stably for a few weeks — preload is a one-way commitment for the
   whole domain including subdomains.
6. **After the next deploy**, confirm with `curl -I` that the headers
   above are actually served, and that the www redirect works.

## For Jonathan, once the domain is live

- **Google Search Console:** add the property `jonathanmccallum.com`
  and submit the sitemap (`https://jonathanmccallum.com/sitemap.xml`).
  That is how Google finds the site and how you see what people search
  for to reach it. (Bing Webmaster Tools is the same idea, optional.)
  Do this only after the DNS switch — search engines cannot treat the
  `pages.dev` preview as the real site.
- **Nothing else to do for security.** There is no password to the site
  itself, nothing to log into, and nothing stored about visitors. The
  one account to protect is the Cloudflare account itself: keep its
  password in the vault and turn on its two-factor authentication when
  asked (only Jonathan can do that step).

## Small notes (not blockers)

- The Worker's in-memory per-IP rate-limit map never prunes entries for
  IPs that stop visiting; harmless at this size, but if it ever matters
  the AI Gateway rate limit is the real enforcement anyway.
- When the Worker has no matching post, its refusal ends with "here's a
  post you might like:" and no post follows. One-line copy fix for later;
  the refusal itself is safe.
- Per-post share images are not done: every page shares the wave photo.
  If a post should share its own photo later, add an `image:` field to
  that post's front matter and wire it into `base.njk`.
