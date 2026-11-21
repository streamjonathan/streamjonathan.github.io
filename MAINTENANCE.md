# Maintenance — keeping jonathanmccallum.com running, stress-free

The site is a static Eleventy site on **Cloudflare Pages (free)**,
with **GitHub Pages as the fallback** (same repo, same build). There is
no server to patch, no database to back up, and no WordPress to update.
The repo is the backup: everything that makes the site is in git.

## Publishing a post (the normal job)

1. Put the post's Markdown file in `content/posts/` (or edit an existing
   one). Keep the front matter: `title`, `date`, `slug`, `original_url`.
2. To publish it, add `draft: false` to that post's front matter.
   (All 179 recovered posts are drafts until reviewed one by one.)
3. Push to the `main` branch. Cloudflare Pages rebuilds itself
   (about a minute) and the post appears at its original URL, in the
   RSS feed, the sitemap, and the search index.
4. If the post should also be answerable by the site AI, re-index:
   `node site-ai/scripts/build-index.mjs`, then
   `CF_ACCOUNT_ID=... CF_API_TOKEN=... node site-ai/scripts/embed-and-insert.mjs`
   (see `site-ai/README.md`). Skip this if the chat is not live yet.

To publish **all** posts at once: change `draft: true` to `draft: false`
in `content/posts/posts.11tydata.js` and push.

## Adding images or audio

- **Images:** drop the file in `content/images/`, reference it from the
  post as `/images/name.jpg`. The build converts it to WebP with set
  sizes and lazy loading. Keep images under 25 MB each (Cloudflare Pages
  file limit) — in practice, resize photos to ~1600 px wide first.
  Note: only 38 of the original 304 images survived in the Wayback
  archive (66 MB). Missing photos may still exist on Instagram, his PC,
  or Google Drive/Photos — add them the same way when found.
- **Audio:** put audio files on a separate "listen" page and load them
  only when the reader presses play (`preload="none"`). Large audio
  belongs in Cloudflare R2 (10 GB free, no egress fees), not in the repo.

## Checking the site AI is within its free limits

Dashboard → Workers & Pages → your Worker → Metrics, and AI Gateway →
your gateway → Analytics. Watch two numbers:

| Number | Free limit | What it means |
|---|---|---|
| Neurons/day | 10,000, resets midnight UTC | The AI budget. A chat answer costs roughly 66 neurons, so ~75–150 answers/day with guardrails on (estimate, not a guarantee). |
| Requests/day | 100,000 | Total Worker calls. The site itself does not count — only `/api/ask` calls. |

**If the chat pauses:** that is normal and by design. When the daily
neurons run out, the chat shows "The chat is resting until tomorrow —
please try searching the writing instead", and the Pagefind search keeps
working. Nothing bills, nothing breaks. It resumes automatically at
midnight UTC. Do nothing.

**If the chat is being abused** (nonsense questions flooding in):
Dashboard → your Worker → Settings → disable the `/api/ask` route.
The site carries on with search alone. Re-enable it when ready.

## Checking the site is up

- Homepage: https://jonathanmccallum.com — should load in under a second.
- A published post at its original URL, e.g. `/2013/10/03/clouds/`
  (only after that post is published).
- Search: https://jonathanmccallum.com/search/
- Feed: https://jonathanmccallum.com/feed/ — should list published posts.

## If a deploy fails

Cloudflare Pages → your project → Deployments → click the failed deploy
→ read the build log. The usual causes: a typo in a post's front matter
(missing closing `---`), or `npm install` failing. Fix, push again.
The previous good deploy keeps serving while you fix it — visitors
never see a broken site.

## If Cloudflare ever goes away or the free plan changes

The fallback is already built: the same repo deploys to GitHub Pages
via `.github/workflows/deploy.yml` (repo `streamjonathan.github.io`).
Point the domain's DNS at GitHub's Pages addresses and the site is back
with the same content. Nothing is locked to Cloudflare except the AI
Worker — and the Pagefind search works on any host.

## Things only Jonathan can do

- Sign into Cloudflare (free account) the first time; create the Pages
  project, the AI Gateway, and the Vectorize index.
- Approve posts going live (they are drafts until he says so).
- Sign into IONOS if DNS ever needs changing.
- Turn on 2FA on GitHub, Google, and IONOS (only he can, with his phone).

## What never needs doing

- No software updates to install (Eleventy rebuilds from the pinned
  versions in `package.json`).
- No backups to run (the git repo + the Drive text backup are the copies).
- No comment spam to moderate (there are no comments on the site).
- No renewals to pay (Cloudflare Pages free, GitHub Pages free; the only
  existing cost is the domain itself, paid to 17 Mar 2027).
