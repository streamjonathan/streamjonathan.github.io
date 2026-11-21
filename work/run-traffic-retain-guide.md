# Running jonathanmccallum.com — a plain guide

*For Jonathan. Short sentences, no jargon. The site is yours now, and it is meant to be easy.*

## What "Average Surfer" is

Your Substack is called **Jonathan, Average Surfer**. The line under it says: "An average surfer viewing faith in Jesus."

That is the whole idea in one line. You are not writing as an expert or a theologian. You are an average person who surfs, reads, and follows Jesus — and you write about faith and life from there. Keep that on the site too. It is the reason people trust it.

What I could see on the public pages: sections called Home, Podcast, Notes, English with Jonathan, Faith for Today, Archive, and About. Recent posts include "My reaction to SonReal's new video" (19 Nov), "The New Narnia Movie, Lewis and the nature of God" (18 Nov), and "Quotes from C. S. Lewis" (17 Nov). Before that, posts from August and September 2026, many of them short videos. You post in bursts — a few in one week, then a quiet spell. I could not see subscriber numbers, and I could not confirm from the public pages whether any posts are paid — nothing I read was behind a paywall.

Readers find you there by email. They subscribe, a new piece lands in their inbox, and they can reply and comment. That is the habit the site needs to copy.

## 1. Running the site day to day

**Writing a new post.** Write it the way you already write — a scene, a memory, a question, then one clear sentence to land on. A little scripture goes a long way; one line, in your own words, is enough.

**Publishing a post.** Each post is a small text file in `content/posts/` in your repo. To publish one, open it in GitHub Desktop and add one line at the top: `draft: false`. Then commit and push. Cloudflare rebuilds the site by itself in about a minute, and the post appears in the search, the RSS feed, and the sitemap.

**Unpublishing.** Change that line back to `draft: true` and push again. The post comes down.

**What is live now.** Only your poem "to sea" is up, as a test. The other 179 old posts are drafts until you read each one and say yes — a few a week is plenty.

**How often to post.** One piece a week is a good, gentle rhythm. It is enough for readers to remember you. If a week is busy, skip it. A burst of three in one week is fine too — that is already how you post on Substack.

**Checking the site.** Open the homepage. It should load in under a second. Click a post, try the search, ask the chat a question.

## 2. Driving traffic to it

People will not find the site by accident at first — you bring them, one link at a time.

**Instagram.** Put jonathanmccallum.com in your bio. When a new post goes up, share it in a story or a reel the same day, with one honest line about what it is. One habit: every new post gets one story that day.

**Threads.** Same thing, in words. Post the first line of the piece and the link, and ask the question the piece asks. One habit: one Threads post per new piece.

**YouTube.** Put the site link in the description of every video, near the top. When a video and a post are about the same thing, say so in the video and link the post. One habit: mention the site out loud in one video a week — "I wrote about this, the link is below."

**Substack.** Every Substack post can end with one line: "I keep the older writing at jonathanmccallum.com." And when a new site post goes up, mention it in your next Substack note. One habit: one line at the end of each Substack post.

**Your bios — the main way people find the site.** Put the link in all five bios: Instagram, Threads, YouTube (channel About and links), TikTok, and Substack. Use the same short line everywhere: "An average surfer viewing faith in Jesus — jonathanmccallum.com". And say it in your videos, in your own words: "I wrote about this on my site — the link is in my bio and below." One line, said the same way each time, is enough for people to remember it.

**Wait before you update the bios.** Do not put the link in any bio until the domain is live. Right now the old domain shows an error page, so anyone who taps the link would land on a dead page. The moment the site is up on jonathanmccallum.com, update all five bios in one go — it takes five minutes.

**What the site already does for search.** It has a sitemap, an RSS feed, and a search page. Search engines will find your posts over time, slowly. The fastest traffic at the start is you, pointing people there.

## 3. Talking with readers

**The chat on the homepage.** A visitor can ask a question about your writing. They have a choice: ask anonymously, with no name at all — or leave their Instagram or Threads handle if they would like a personal reply from you. Nothing is collected unless they offer it. The chat only answers from your published posts, and it always links to the post it used.

**When someone leaves a handle.** Reply to them yourself, on that platform, in your own words. Short and warm.

**When someone asks a good question.** That is your next post, or your next video. If three people ask the same thing, that is definitely your next post — and say so when you write it: "A few of you asked me this."

**The Connect links.** Instagram, Threads, YouTube, Substack and RSS are all on the homepage. Keep them up to date.

## 4. Keeping readers, like Substack does

**Email.** For now, the newsletter stays on Substack — that is where your subscribers already are. The site points there, and Substack sends the emails. Later, if you ever want the newsletter to live on the site itself, that is a small change, not a rebuild.

**A rhythm they can trust.** One piece a week, same kind of voice, same kind of ending — a question, or a blessing. Readers come back for a voice they know.

**Series.** A few posts on one thread keep people reading. You already have the threads: Narnia and Lewis, the sea and surfing, Japan, the 90s, books that helped you. Link the others at the end of each post: "Read next…".

**Welcome new readers.** The homepage says who you are in one line: an average surfer viewing faith in Jesus. A new reader should know in five seconds what they will find.

**RSS.** Some readers follow by RSS instead of email. The feed is at `/feed/` and updates itself every time you publish.

## 5. Showing "Average Surfer" on the site

Three ways to do it.

**Option A — the Writing section starts with Average Surfer.** The homepage lists your posts, and the first ones shown are your Substack pieces. Your site becomes the home of Average Surfer, and Substack stays the email sender. *What it needs from you:* your say-so, and a choice of which Substack posts to copy onto the site. Nothing gets copied without you saying so.

**Option B — a dedicated Average Surfer page.** One page on the site that says what it is in your words and links to the Substack for the full posts and the email signup. The site holds the archive of your older writing; Substack holds the new writing. *What it needs from you:* almost nothing — a few sentences for the page.

**Option C — the site and Substack stay side by side.** The site is the archive of your writing from 2013 onwards. Substack is where new writing goes first. Each one links to the other, and readers choose. *What it needs from you:* nothing at all.

**I recommend Option A.** The name is the truest thing about how you write — average person, faith, life, the sea — and it gives the site a clear centre. But start small: pick five or six Substack posts you are proudest of, copy those in first, and see how it feels. The rest can follow one by one.

And whichever option you pick, the positioning stays the same: an average person interested in Jesus, writing about faith and life. Not an expert. Not a theologian. Small amounts of scripture, in your own words.

## The short version

- Write one piece a week, if you can. Short is fine.
- Publish by flipping `draft: false` and pushing in GitHub Desktop.
- Tell people the same day, on Instagram, Threads, YouTube and Substack.
- Answer readers yourself when they leave a handle. Turn good questions into new posts.
- Keep the newsletter on Substack for now. Let the site be the home of Average Surfer.
- Thanks for reading. What will you write first?
