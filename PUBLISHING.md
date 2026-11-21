# Publishing — how a post goes live

The whole flow is three steps, and the third one is one command.

## 1. Write the draft

A post is one Markdown file in `content/posts/`, named
`YYYY-MM-DD-slug.md`, starting with:

```yaml
---
title: "The title"
date: 2026-11-19
slug: the-title
draft: true
---
```

Write it yourself, or ask Claude (on the PC, in the local repo clone) to
draft it from your Substack post or notes. Drafts never appear on the site
until step 3 — that is the rule, so nothing goes live unreviewed.

## 2. Read it back

Open the file and read it. Check it sounds like you, the facts are right,
and there is nothing personal in it (no addresses, no private details
about where you live, no one else's private information).

## 3. Publish it

Tell Bobby "publish <the post>" — or run it yourself:

```sh
scripts/publish-post.sh content/posts/2026-11-19-my-reaction-to-sonreals-new-video.md
```

That flips `draft: true` to `draft: false`, builds the site, commits, and
pushes. Cloudflare Pages rebuilds from the repo and the post is live at
`jonathanmccallum.com/2026/11/19/<slug>/` in about a minute. If the build
fails, the script puts the draft flag back and stops — nothing half-live.

## After publishing: teach the chat the new post

The chat answers from an index of the published posts. After a new post
goes live, rebuild the index and redeploy the Worker so it can answer
from the new writing:

```sh
node site-ai/scripts/build-index.mjs
npx --prefix site-ai wrangler deploy
```

(Deploying needs the Cloudflare API token — see the Secure Vault entry
for Cloudflare. Until the Worker is deployed, the chat and the note box
show their honest "resting" messages and search keeps working.)

## How fast the site runs

- Local build: about 0.1 seconds.
- Live homepage: about 1 second to load, 5 KB of HTML, one 4 KB
  stylesheet, no webfonts, no tracking scripts, no cookies.
- Cloudflare serves the site from its global network, so it stays that
  fast everywhere. Nothing on the page loads from a third party until a
  reader taps a video.

## Rules that stay

- Drafts stay drafts until Jonathan says publish, one post at a time.
- The Carl Medearis post and the AI-topic post are deleted — never
  re-publish them.
- No AI as a post topic. The chat helper stays, quietly, as "Interact
  with Jonathan's writing".
- Keep the site to one page: no header, no nav tabs, no newsletter form
  until the mailing list is decided.
