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
//
// The carousel also appears on the homepage, where there is no form:
// tapping a photo there goes to /suggest-an-artist/?artist=NAME&link=
// PROFILE, and the pre-fill below picks those params up on load.
function bootSuggest() {
  var form = document.getElementById("suggest-form");
  var button = document.getElementById("suggest-button");
  var result = document.getElementById("suggest-result");

  // Query-param pre-fill: a tap on the homepage carousel lands here
  // with ?artist=NAME&link=PROFILE. Fill the fields in, show the same
  // "Suggesting …" line the on-page tap shows, and move the reader to
  // the "why" box. Nothing is sent until they press "Send the
  // suggestion".
  function prefillFromParams() {
    var params = new URLSearchParams(window.location.search);
    var name = params.get("artist");
    var profile = params.get("link");
    if (!name && !profile) return;
    var artist = document.getElementById("suggest-artist");
    var link = document.getElementById("suggest-link");
    var why = document.getElementById("suggest-why");
    if (!artist || !link || !why) return;
    if (name) artist.value = name;
    if (profile) link.value = profile;
    if (name) {
      result.textContent = "Suggesting " + name + " — just add a few words about why them, and send.";
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    why.focus({ preventScroll: true });
  }

  if (form && button && result) {
    prefillFromParams();

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

  // Carousel picks: on the suggest page, tapping a circle photo fills
  // the form in with that artist's name and profile link, then moves
  // the reader to the "why" box. On the homepage there is no form, so
  // the tap goes to the suggest page with the artist in the URL
  // instead. Nothing is sent until they press "Send the suggestion".
  var picks = document.querySelectorAll(".suggest-pick");
  picks.forEach(function (pick) {
    pick.addEventListener("click", function () {
      var name = pick.getAttribute("data-artist") || "";
      var profile = pick.getAttribute("data-link") || "";
      if (!form) {
        window.location.href = "/suggest-an-artist/?artist=" + encodeURIComponent(name) + "&link=" + encodeURIComponent(profile);
        return;
      }
      var artist = document.getElementById("suggest-artist");
      var link = document.getElementById("suggest-link");
      var why = document.getElementById("suggest-why");
      if (!artist || !link || !why || !result) return;
      artist.value = name;
      link.value = profile;
      result.textContent = "Suggesting " + artist.value + " — just add a few words about why them, and send.";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      why.focus({ preventScroll: true });
    });
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSuggest);
} else {
  bootSuggest();
}
