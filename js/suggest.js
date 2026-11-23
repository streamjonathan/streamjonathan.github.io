// Suggest an artist (/suggest-an-artist/): a short reader form.
//
// POSTs to /api/suggest on the site Worker, which stores the suggestion
// in KV until Jonathan reads it (emailed by the digest, tagged
// [ARTIST IDEA]). No sign-in, no name or email needed — the suggester's
// name and link are optional, so Jonathan can thank them.
//
// Same pattern as the note box in ask.js: the button is type="button"
// on purpose, so there is no native submit path that reloads the page
// and loses the visitor's words. The submit listener stays as a
// fallback for Enter-key submission, and it preventDefaults too. If the
// Worker is not deployed yet, the form falls back to pointing the
// reader at social media — nothing here ever breaks.
function bootSuggest() {
  var form = document.getElementById("suggest-form");
  if (!form) return;
  var button = document.getElementById("suggest-button");
  var result = document.getElementById("suggest-result");
  if (!button || !result) return;

  function doSuggest() {
    var artist = document.getElementById("suggest-artist").value.trim();
    var link = document.getElementById("suggest-link").value.trim();
    var why = document.getElementById("suggest-why").value.trim();
    var fromName = document.getElementById("suggest-name").value.trim();
    var fromLink = document.getElementById("suggest-from-link").value.trim();
    var kinds = [];
    var boxes = form.querySelectorAll('input[name="kind"]:checked');
    boxes.forEach(function (box) {
      kinds.push(box.value);
    });
    if (!artist || !link) return;
    if (kinds.length === 0) {
      result.textContent = "Pick at least one — write about them, interview them, or a reaction video.";
      return;
    }
    button.disabled = true;
    result.textContent = "Sending your suggestion…";
    fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: artist,
        link: link,
        kinds: kinds,
        why: why,
        fromName: fromName,
        fromLink: fromLink,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        button.disabled = false;
        if (data.ok) {
          result.textContent = "Thank you — your suggestion is with Jonathan. He reads everything that comes in.";
          form.reset();
        } else {
          result.textContent = "Suggestions aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
        }
      })
      .catch(function () {
        button.disabled = false;
        result.textContent = "Suggestions aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
      });
  }

  button.addEventListener("click", doSuggest);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    doSuggest();
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSuggest);
} else {
  bootSuggest();
}
