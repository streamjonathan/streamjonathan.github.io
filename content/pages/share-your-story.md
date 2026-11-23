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
  <p>Would you also paste your reply in a message to Jonathan on Instagram? It gives him a copy there, and it helps confirm the account is really yours. Just copy your reply above, then <a href="https://ig.me/m/jonamccallum">message @jonamccallum on Instagram</a> and paste it in.</p>

  <label class="permission" for="interview-permission">
    <input id="interview-permission" name="permission" type="checkbox" required>
    <span>By sending this, you give permission for Jonathan to share your answers as an article on jonathanmccallum.com. There is no advertising on this site. The goal is to learn more about people following Jesus in creative areas of life.</span>
  </label>

  <button id="interview-button" type="submit">Send my story</button>
  <p id="interview-result" aria-live="polite"></p>
</form>
