# jonathanmccallum.com

Static site for jonathanmccallum.com, built with [Eleventy](https://www.11ty.dev/) from posts and pages recovered from the Wayback Machine. Fast and text-focused: Markdown posts, one small CSS file, no JavaScript frameworks, no third-party scripts on first load.

## How it works

- Content lives in `content/` — `posts/` (179 recovered posts, 2013–2023), `pages/` (12 recovered pages), `images/` (only 38 of the original 304 images survived in the Wayback archive — 66 MB; see `RECOVERY-REPORT.md`), `index.json` (the recovery manifest).
- Posts keep their original date, title and slug in front matter and build at their original WordPress URL (e.g. `/2013/10/03/clouds/`), so old links keep working.
- Images are converted to WebP with width/height set and `loading="lazy"` by the Eleventy image plugin (see the `responsiveImages` transform in `.eleventy.js`). Images that have not been recovered yet are left as plain `<img>` tags and convert automatically on the next build once they arrive.
- YouTube links become tap-to-load facades: a thumbnail and a play button, and the `youtube-nocookie.com` iframe only loads when the reader taps play. Social links stay plain links — no platform scripts load.
- Search at `/search/` is [Pagefind](https://pagefind.app/) — built at deploy time over the published pages only, runs entirely in the reader's browser, and cannot be tricked. It grows automatically as posts go live.
- RSS feed at `/feed/`, sitemap at `/sitemap.xml`, custom 404 page at `404.html`.
- The homepage has an "Ask about the writing" chat box and a "Connect" section (Instagram, Threads, YouTube, Substack, RSS, newsletter placeholder). The chat talks to the site AI Worker in `site-ai/` — see its README. Until that Worker is deployed, the form falls back to search.

## Posts are held back as drafts

Most posts are still drafts: `content/posts/posts.11tydata.js` sets `draft: true` by default, so only published posts get pages. Six posts are live so far (see PUBLISHING.md) — one at a time, only when Jonathan says so.

- **To publish one post:** add `draft: false` to that post's front matter, rebuild, and it appears at its original URL, in the RSS feed and the sitemap.
- **To publish all posts:** change `draft: true` to `draft: false` in `content/posts/posts.11tydata.js`.

## Build and preview locally

```sh
npm install
npm run build    # output in _site/
npm run serve    # preview at http://localhost:8080
```

## Deploy — Cloudflare Pages (primary, free)

Connect the repo in the Cloudflare dashboard (Workers & Pages → Create →
Pages → Connect to Git) with: build command `npm run build`, build output
`_site`, Node 22. Settings are also recorded in `wrangler.toml`. The
`CNAME` file sets the custom domain to `jonathanmccallum.com`; Cloudflare
issues the free HTTPS certificate once DNS points at Cloudflare. Security
headers live in `_headers`, the www→apex redirect in `_redirects`.

Do **not** change DNS until the preview (e.g.
`https://jonathanmccallum-site.pages.dev`) has been checked.

## Deploy — GitHub Pages (fallback, free)

Push to the `main` branch of `streamjonathan/streamjonathan.github.io`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the site and deploys it to GitHub Pages. The repo's Pages source must be set to **GitHub Actions** (Settings > Pages > Build and deployment). The `CNAME` file sets the custom domain to `jonathanmccallum.com`; GitHub issues the HTTPS certificate automatically once DNS points at GitHub.

Do **not** change DNS until the preview at `https://streamjonathan.github.io` has been checked.

## Site AI (deployed 21 Nov 2026)

`site-ai/` holds the chat Worker: it answers visitors only from the
published posts, through Cloudflare Workers AI + Vectorize + AI Gateway
Guardrails, all on the free tier. It is a separate agent from his
personal assistant (Muse/Bobby) — separate account, separate knowledge,
no personal data. See `site-ai/README.md` for the deploy steps, the
separation rules, and the audit checklist. It went live 21 Nov 2026;
redeploys go through the Cloudflare API, not `wrangler deploy`.

## Maintenance

See `MAINTENANCE.md` — publishing posts, images/audio, checking the AI's
free limits, what to do if the chat pauses, and the fallback plan.

## JavaScript on the site (kept tiny)

Three small same-origin scripts, no frameworks, no third-party scripts on
first load: the tap-to-load video facade in the base layout, the chat form
on the homepage, and the Pagefind search UI (only on `/search/`).
