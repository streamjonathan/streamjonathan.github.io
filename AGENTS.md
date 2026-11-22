# AGENTS.md — jonathanmccallum.com (shared handoff file)

This file is the shared context for everyone working on this site: Bobby
(Muse, lead builder), Claude, Gemini, and the helper Muses (Walkbare,
Beyond, Clubhouse). Jonathan decides everything. Read this before starting
any site work.

## Mission

Evolve jonathanmccallum.com into a popular, ad-free site that naturally
leads readers to reflect on Jesus and the love of God. The site is a home
for Jonathan's writing — faith, film, surfing, music and life — plus a
Watch row of his videos and a chat that answers only from his published
writing.

## Roles

- **Bobby (Muse) is the lead builder.** He coordinates, builds the site,
  pushes to GitHub and deploys to Cloudflare. He is the ONLY one who
  pushes or deploys.
- **Claude advises and prepares.** He reviews, drives DaVinci Resolve,
  writes patches and delivers complete code and structured updates ready
  for GitHub and Cloudflare. He does not push or deploy.
- **Gemini reads and drafts.** It reads the videos and Drive folders,
  drafts topic/hook tables and post wording. Everything it writes is a
  DRAFT until Jonathan approves. It cannot push, deploy, control Resolve
  or move files.
- **Helper Muses test and research.** They test the live site on real
  devices, research, and draft. They do not change the site, push, or
  deploy.

## The one rule above all

**Never publish or alter live production assets without Jonathan's clear
permission.** Propose first, in short plain words, with a clear
permission/next-step prompt at the end. Publish only on his say-so.
Drafts stay drafts until he approves them.

## Voice

Jonathan's voice is in `VOICE.md`: plain short sentences, friendly,
positive, never preachy. An average person interested in Jesus, writing
about faith and life — not an expert or theologian. Small amounts of
scripture only. Questions over lectures. Reflective, grounded, honest,
human. Match it in everything written for the site.

## Content rules

- The site is strictly ad-free.
- Family-friendly only.
- No Carl Medearis content anywhere.
- AI is never a post topic, and the site is never presented as an "AI site".
- Writing material comes from Jonathan's YouTube transcripts and short,
  engaging posts from his own social channels (Substack, YouTube,
  Instagram, TikTok) that gently point toward Jesus and God's love —
  without preachiness or cliches.
- The site chat answers only from his published writing, cites the post
  title only, and never gives out personal information.

## Sources of truth

- **GitHub** (`streamjonathan/streamjonathan.github.io`) is the single
  source of truth for site files, voice guidelines, transcript extracts,
  social post candidates and this file. Pushing to GitHub does NOT update
  the Worker — the Worker is redeployed by hand after `site-ai/` changes.
- **Drive "Muse edits"** is the message board: `bobby-notes.md`
  (Bobby's notes for the team), `claude-notes.md` (Claude's notes for
  Bobby), `site-status.md` (Bobby overwrites after every push/deploy).
  Claude's notes also appear as new files in "Team briefs (Claude, Muse,
  Gemini)".
- **The videos-index** (one shared CSV/JSON in Drive) is the single
  source of truth for videos: YouTube ID, title, language, orientation,
  length, topic lane, best hook moment, post status per platform, linked
  site post. Claude fills topics and hooks; Bobby keeps the posting
  status; the website carousel reads the same index.

## Site facts

- Eleventy 3, Cloudflare Pages, custom domain jonathanmccallum.com.
- The chat runs on Cloudflare Workers AI free tier: 10,000 Neurons/day,
  hard stop, about 75 fresh answers/day. Cached answers cost nothing.
  Test gently, use the four homepage chips first, keep fresh test
  questions to 1–2 per tester per day.
- The note form is anonymous by design. Notes are stored in Cloudflare
  KV and emailed to Jonathan by a digest every 6 hours. No email address
  is shown on the site.
- CSS is preloaded, not inlined (the CSP blocks inline style). Bump the
  `?v=` query on any CSS/JS file you change. The theme is set before
  paint by a small inline script whose SHA-256 hash is in the CSP.

## How to work here

- Keep answers short and direct. Never use emojis. Always paste code in
  full. End check-ins with a clear permission/next-step prompt.
- Work on a branch, never straight on main. Give Bobby a preview URL.
  Bobby reviews, merges and verifies live.
- Never invent facts or timestamps. If you could not actually view a
  video, write "unverified".
