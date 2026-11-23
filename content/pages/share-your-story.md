---
title: "Share your story"
slug: share-your-story
original_url: https://www.jonathanmccallum.com/share-your-story/
---

I love hearing from people who follow Jesus and make things — music, art, poems, films, anything creative. This site has no advertising. It is here so we can learn from each other about following Jesus in creative areas of life. If that is you, I would love to hear from you.

Three questions below. Click each one to open it, and take your time — there is plenty of room. When you send this, you give me permission to share your answers as an article on this site. Nothing is published until I have read it and said yes.

<section class="interview-signin" id="interview-signin" data-google-client-id="{{ site.googleClientId }}">
  <h2>First, sign in</h2>
  <p>Please sign in with one of your accounts, so I know the story is really from you. Signing in only confirms your name and profile — it lets the site check you are who you say you are. It cannot post anything for you, read your messages, or see anything private. Your login stays between you and Instagram or Google; this site never sees your password.</p>
  <p>
    <a class="interview-ig-button" id="interview-ig-signin" href="/api/interview/auth/instagram">Sign in with Instagram</a>
  </p>
  <p class="field-note" id="interview-ig-note">Instagram sign-in is the simplest way — it also confirms your Instagram profile in one step. It works for Business and Creator accounts.</p>
  <p>
    <a class="interview-ig-button" id="interview-line-signin" href="/api/interview/auth/line">Sign in with LINE</a>
  </p>
  <p class="field-note" id="interview-line-note">For LINE users — it confirms your name. Your main social link is still asked for below.</p>
  <div id="interview-google-signin"></div>
  <p class="field-note" id="interview-google-note">Or sign in with Google — the same login as YouTube. It confirms you are a real person; your Instagram link is then checked against the message you send me (see below).</p>
  <p id="interview-signin-status" aria-live="polite"></p>
  <p id="interview-signedin" hidden>
    <span id="interview-signedin-text"></span>
    <a href="/api/interview/auth/signout">Sign out</a>
  </p>
</section>

<form id="interview-form" class="interview-form">
  <label for="interview-name">Your name</label>
  <input id="interview-name" name="name" type="text" maxlength="100" autocomplete="name" placeholder="Your name" required>

  <label for="interview-social">Your main social profile — the one people can find you on</label>
  <input id="interview-social" name="social" type="url" maxlength="300" placeholder="https://www.instagram.com/yourname" required>
  <p class="field-note" id="interview-social-note">Instagram, X, Threads, YouTube, Facebook or TikTok. Paste the link to your profile, not just your username.</p>

  <label for="interview-social2">Another social profile (optional)</label>
  <input id="interview-social2" name="social2" type="url" maxlength="300" placeholder="https://www.youtube.com/@yourname">

  <details class="interview-question" id="interview-q1-details">
    <summary>Tell us about yourself and the music or art you make. What do you love making, and why?</summary>
    <textarea id="interview-q1" name="q1" rows="8" maxlength="5000" placeholder="Take your time…" required></textarea>
  </details>

  <details class="interview-question" id="interview-q2-details">
    <summary>What would you like the world to know about your faith in Jesus — and how does it shape what you create?</summary>
    <textarea id="interview-q2" name="q2" rows="8" maxlength="5000" placeholder="Take your time…" required></textarea>
  </details>

  <details class="interview-question" id="interview-q3-details">
    <summary>Tell us a story from your life. It doesn't have to be deep — it can be funny, or just interesting. What's a moment that says something about who you are?</summary>
    <textarea id="interview-q3" name="q3" rows="8" maxlength="5000" placeholder="Take your time…" required></textarea>
  </details>

  <h2>Your full reply</h2>
  <p>Here is everything you wrote, together. You can copy it before you send it, if you would like to keep it.</p>
  <textarea id="interview-copy" rows="10" readonly aria-label="Your full reply, all three answers together"></textarea>
  <p>
    <button id="interview-copy-button" type="button">Copy my reply</button>
    <span id="interview-copy-result" aria-live="polite"></span>
  </p>

  <h2>One more thing, if you can</h2>
  <p>When you send this, your reply is copied for you, and a message to me on Instagram opens — just paste it in and send it. It gives me a copy there, and it helps me publish the article. Your reply stays here too, so you can keep a copy if you like.</p>

  <label class="permission" for="interview-permission">
    <input id="interview-permission" name="permission" type="checkbox" required>
    <span>By sending this, you give permission for Jonathan to share your answers as an article on jonathanmccallum.com. There is no advertising on this site. The goal is to learn more about people following Jesus in creative areas of life.</span>
  </label>

  <button id="interview-button" type="submit">Send my story</button>
  <p id="interview-result" aria-live="polite"></p>
</form>

<section id="interview-done" hidden>
  <h2>Thank you — your story is with me</h2>
  <p>I will read it, and if it fits, I will draft it as an article for you to approve before anything is published.</p>

  <h2>Want to keep a copy?</h2>
  <p>Everything you wrote is here — this is yours to keep.</p>
  <textarea id="interview-done-copy" rows="10" readonly aria-label="Your full reply, all three answers together"></textarea>
  <p>
    <button id="interview-done-copy-button" type="button">Copy my reply</button>
    <span id="interview-done-copy-result" aria-live="polite"></span>
  </p>

  <h2>One more thing — sending it to me on Instagram really helps</h2>
  <p>Your reply is already copied, so just paste it into the message and send it. It gives me a copy there, and it helps me publish the article. This page can't send the message for you — you still tap send yourself.</p>
  <p>
    <a class="interview-ig-button" href="https://ig.me/m/jonamccallum" target="_blank" rel="noopener">Open Instagram to paste it</a>
  </p>
  <p id="interview-done-note" aria-live="polite"></p>
</section>
