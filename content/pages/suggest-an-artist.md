---
title: "Suggest an artist"
slug: suggest-an-artist
---

I love hearing about musicians and artists who follow Jesus. If you know someone I should write about, interview, or make a reaction video about, tell me here.

A name and a link is enough — and a few words about why them. I read everything that comes in. Thanks so much.

Know someone already? Tap their photo and the form fills itself in — then just add a few words about why them, and send.

<div class="suggest-carousel" role="list" aria-label="Musicians and artists you can suggest">
{% for artist in suggest_carousel %}
  <button type="button" class="suggest-pick" role="listitem" data-artist="{{ artist.name }}" data-link="{{ artist.profile }}" title="Suggest {{ artist.name }}">
    <img src="{{ artist.img }}" alt="{{ artist.name }}" loading="lazy" width="150" height="150">
    <span class="suggest-pick__name">{{ artist.name }}</span>
    <span class="suggest-pick__note">{{ artist.note }}</span>
  </button>
{% endfor %}
</div>

<p class="suggest-carousel__more">Or suggest someone new below — anyone you think I should hear.</p>

<p class="suggest-optout">If you're featured here and would rather not be, please <a href="https://www.instagram.com/jonamccallum/">message Jonathan on Instagram</a> and he'll remove you.</p>

<form id="suggest-form" class="suggest-form">
  <label for="suggest-artist">Artist's name</label>
  <input id="suggest-artist" name="artist" type="text" maxlength="200" placeholder="Who should I look up?" required>

  <label for="suggest-link">Their social profile link</label>
  <input id="suggest-link" name="link" type="url" maxlength="500" placeholder="https://www.instagram.com/…" required>

  <fieldset class="suggest-kinds">
    <legend>What should I do with them?</legend>
    <label><input type="checkbox" name="kind" value="write"> Write about them</label>
    <label><input type="checkbox" name="kind" value="interview"> Interview them</label>
    <label><input type="checkbox" name="kind" value="reaction"> Make a reaction video about them</label>
  </fieldset>

  <label for="suggest-why">Why them?</label>
  <textarea id="suggest-why" name="why" rows="3" maxlength="500" placeholder="A few words is plenty…"></textarea>

  <label for="suggest-name">Your name <span class="optional">(optional)</span></label>
  <input id="suggest-name" name="fromName" type="text" maxlength="100" placeholder="So I can thank you">

  <label for="suggest-from-link">Your social profile link <span class="optional">(optional)</span></label>
  <input id="suggest-from-link" name="fromLink" type="url" maxlength="500" placeholder="https://www.instagram.com/…">

  <button id="suggest-button" type="button">Send the suggestion</button>

  <p id="suggest-result" aria-live="polite"></p>
</form>
