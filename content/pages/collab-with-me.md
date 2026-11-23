---
title: "Collab with me"
slug: collab-with-me
original_url: https://www.jonathanmccallum.com/collab-with-me/
---

I love making things with other people who follow Jesus — music, art, poems, films, anything creative. This site has no advertising. It is here so we can learn from each other about following Jesus in creative areas of life.

A collab means we make something together and share it here, with both our names on it. Here are the kinds of collabs I have in mind:

- **We write an article together** — you write your part, I write mine.
- **You write a guest post** — your words, and I introduce it.
- **We interview each other** — you ask me, I ask you.
- **I react to your song or video** — a reaction video, and an article to go with it.
- **We cross-post** — the piece lives here, and a post on your social, each linking the other.
- **We answer questions together** — readers ask, we answer.
- **A song feature** — your song, in your own words, and what it means to you.
- **A shared photo or video post** — both our names, and we both share it.

Something else in mind? Say so in the form — the list above is a start, not a limit.

## What we agree

Before you send a collab idea, here is what we agree — in plain words, not legal language. This is a record of what we agreed, not a lawyer's document. If you would like a lawyer to look at it, that is fine — ask me first and we will wait.

- What you share is yours, or you have permission to share it. Only send music, photos or videos you own or have permission for.
- You keep owning your work. You give this site permission to publish it here. That permission is non-exclusive, which means you can share it anywhere else too.
- Your name and a link to your social profile will show with the piece, and what each of us brought to it.
- Either of us can ask for it to be taken down at any time. Use the form at the bottom of this page, or message me, and it will come down from this site and the language versions.
- Nothing here is advertising. This site has no ads, and a collab is never an ad.
- You are 18 or older.
- No personal details beyond what you agree to share here — no address, phone number or email on this page. The form does not ask for them.

## Propose a collab

<form id="collab-form" class="collab-form" data-collab-api="{{ site.collabApi }}">
  <label for="collab-name">Your name</label>
  <input id="collab-name" name="name" type="text" maxlength="100" autocomplete="name" placeholder="Your name" required>

  <label for="collab-social">Your main social profile — the one people can find you on</label>
  <input id="collab-social" name="social" type="url" maxlength="300" placeholder="https://www.instagram.com/yourname" required>
  <p class="field-note">Instagram, X, Threads, YouTube, Facebook or TikTok. Paste the link to your profile, not just your username.</p>

  <label for="collab-social2">Another social profile (optional)</label>
  <input id="collab-social2" name="social2" type="url" maxlength="300" placeholder="https://www.youtube.com/@yourname">

  <fieldset class="collab-kinds">
    <legend>What kind of collab? Tick all that fit.</legend>
    <label><input type="checkbox" name="kind" value="co-written"> We write an article together</label>
    <label><input type="checkbox" name="kind" value="guest-post"> You write a guest post</label>
    <label><input type="checkbox" name="kind" value="joint-interview"> We interview each other</label>
    <label><input type="checkbox" name="kind" value="reaction"> I react to your song or video</label>
    <label><input type="checkbox" name="kind" value="cross-post"> We cross-post</label>
    <label><input type="checkbox" name="kind" value="qa"> We answer questions together</label>
    <label><input type="checkbox" name="kind" value="song-feature"> A song feature, in your own words</label>
    <label><input type="checkbox" name="kind" value="shared-post"> A shared photo or video post</label>
  </fieldset>

  <label for="collab-bring">What would you bring to the collab?</label>
  <textarea id="collab-bring" name="bring" rows="4" maxlength="2000" placeholder="Your song, your story, your photos — whatever you would bring." required></textarea>

  <label for="collab-idea">Your idea in a few sentences — what would we make together?</label>
  <textarea id="collab-idea" name="idea" rows="6" maxlength="2000" placeholder="Take your time…" required></textarea>

  <label class="permission" for="collab-age">
    <input id="collab-age" name="age18" type="checkbox" required>
    <span>I am 18 or older.</span>
  </label>

  <label class="permission" for="collab-permission">
    <input id="collab-permission" name="permission" type="checkbox" required>
    <span>By sending this, I agree to the terms above: what I share is mine or I have permission to share it, I keep owning my work, and this site may publish it here. Either of us can ask for it to be taken down at any time.</span>
  </label>

  <button id="collab-button" type="submit">Send my collab idea</button>
  <p id="collab-result" aria-live="polite"></p>
</form>

## Changed your mind?

If we made something together and you would like it taken down, ask here and it will come down. You do not need a reason — but it helps me find the right piece if you say which one it is.

<form id="collab-takedown-form" class="collab-form" data-collab-api="{{ site.collabApi }}">
  <label for="takedown-name">Your name</label>
  <input id="takedown-name" name="name" type="text" maxlength="100" autocomplete="name" placeholder="Your name" required>

  <label for="takedown-social">Your social profile — the one linked on the piece</label>
  <input id="takedown-social" name="social" type="url" maxlength="300" placeholder="https://www.instagram.com/yourname" required>

  <label for="takedown-target">Which collab should come down? Give the title or the link.</label>
  <input id="takedown-target" name="target" type="text" maxlength="300" placeholder="Title or link to the article" required>

  <label for="takedown-reason">A reason, if you would like to give one (optional)</label>
  <textarea id="takedown-reason" name="reason" rows="3" maxlength="1000" placeholder="Optional — you do not need a reason."></textarea>

  <button id="takedown-button" type="submit">Ask for it to be taken down</button>
  <p id="takedown-result" aria-live="polite"></p>
</form>

If the form does not work for you, the quickest way to reach me is a message on [Instagram](https://www.instagram.com/jonamccallum) or [Threads](https://www.threads.com/@jonamccallum).
