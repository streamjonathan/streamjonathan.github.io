# jonathanmccallum.com — Wayback content recovery report

Recovered 2026-11-21 (evening, CET) from the Wayback Machine (web.archive.org).
Content recovery only — no DNS, IONOS, DreamHost, publishing or repo work was done.

## What was recovered

- **179 posts**, publish dates **2013-10-03 → 2023-11-24** (31 in 2013, 69 in 2014, 33 in 2015, 25 in 2016, 1 in 2020, 9 in 2021, 1 in 2022, 10 in 2023)
- **12 pages** (11 pages + homepage): sample-page, bill-and-teds-excellent-adventure, contact-jonathan, articles, artist, home, jonathan, articlesbyjonathan, cartoons, interviews, harritxu
- **55,455 words** of post text (after stripping share buttons / related-posts junk)
- **0 posts failed to parse** — every post produced text. No post was unrecoverable.
- 15 posts are photo posts with under 10 words of text (e.g. "Clouds", "Nelson Mandela") — that is their real content (image + a line such as "@peoplepoesia"), not a recovery failure.

## Completeness checks (Claude's guidance applied)

- Snapshots fetched with the raw `id_` form; images with the `im_` form.
- `/feed/`: a Dec 2022 feed snapshot exists and lists 9 posts — all 9 are in the recovered set.
- `/wp-json/wp/v2/posts`: NO snapshots exist. `sitemap.xml`: NO snapshots exist (both verified via CDX).
- Homepage snapshot 15 Apr 2026 lists 7 recent posts — all 7 are in the recovered set.
- Post URLs/slugs/dates kept exactly as the originals (needed to keep old post URLs on the rebuild).

## Files

- Index: `content/index.json` (179 posts + 12 pages; slug, title, date, original_url, wayback_url, wayback_timestamp, image URLs, word counts)
- Posts: `content/posts/YYYY-MM-DD-slug.md` (179 files, 860 KB) — front matter title/date/slug/original_url/wayback_url, body in Markdown
- Pages: `content/pages/*.md` (11 files, 48 KB) + `content/homepage.md` (7 recent posts with title, date, excerpt, local image)
- Images: `content/images/` (38 files, 66 MB)
- Working files (scripts, CDX lists, raw HTML, logs): `work/` — raw post/page HTML is 12 MB in `work/raw_posts/` + `work/raw_pages/`
- Skipped-image list: `work/images_skipped.json` (266 entries with reasons)
- Total saved content: **67 MB** (text ~1 MB + images 66 MB); whole directory incl. working files 183 MB

## Images — the big caveat

- **304 unique images** referenced by posts/pages/homepage.
- **38 downloaded (66 MB, all verified as real image files).** 33 are jonathanmccallum.com uploads, plus 1 each from blogseitb.us, Wikimedia, presearch.org, outsideonline.com, wordpress.com.
- **256 images have NO archived copy in the Wayback Machine.** Verified per image via the CDX API (exact URL, Photon i0/i1/i2 variants, and unsized-original fallback for `-1024x682`-style resized variants) — CDX returns no captures, and direct timestamped `im_` URLs return 404. The Archive captured the site's HTML pages but (almost) never captured its images.
- **10 images DO have archived copies but are over 5 MB** (skipped per the size rule; recoverable by re-running with a higher limit):
  View.jpg (2015/09), JonathanMcCallum2smaller.jpg, JonathanMcCallum3.jpg, JonathanMcCallum4smaller.jpg (2014/07), Refugee.jpg (2014/11), ApplePoemJonathanMcCallum.jpg, Natural.jpg (2015/06), BeautyInside2.jpg (2015/07), Jonathan13.jpg (2015/11)
- Effect on posts: 21 posts have all their images, 13 have some, **79 have none of their images**, 66 reference no images at all. 317 image references in the Markdown point at files that don't exist yet (46 references resolve).
- All image URLs in the Markdown now point at local `/images/<file>` paths (0 remote image URLs remain), so the rebuild only needs the files, not link fixes.
- Where the missing photos may still exist (not recoverable from Wayback): his Instagram @jonamccallum (many of the same 2013–2014 Basque/surfing photos), his PC, or Google Drive/Photos.

## Notes for the rebuild

- `content/posts/posts.11tydata.js` is an Eleventy data file that appeared in the posts folder (not created by this recovery); the 179 post files themselves are all present and match the index exactly.
- The Internet Archive was intermittently showing "Temporarily Offline" during the image download (2026-11-21 evening); the CDX "no capture" results were re-verified with direct `im_` fetches, so they are real, not outage artefacts.
- Titles were cleaned of the " – Jonathan McCallum" site-name suffix; theme comment markers (e.g. `<!-- .entry-content -->`) and share/related-posts blocks were stripped from post text.
- The Wikimedia file-page link (commons.wikimedia.org/wiki/File:Smokey3.jpg) is not an image and was left as an external link; its thumbnail image was recovered.
