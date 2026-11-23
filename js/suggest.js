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
  //
  // One delegated listener per carousel, not one per card, so cards
  // added later by progressive loading work the same way.
  function onPick(pick) {
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
  }

  var carousels = document.querySelectorAll(".suggest-carousel");
  carousels.forEach(function (carousel) {
    carousel.addEventListener("click", function (e) {
      var pick = e.target.closest ? e.target.closest(".suggest-pick") : null;
      if (pick && carousel.contains(pick)) onPick(pick);
    });
  });

  // Progressive loading (homepage only): the first 30 cards are
  // rendered by Eleventy; the rest ride along as JSON in
  // #suggest-carousel-data and are appended in batches of 30 as the
  // visitor scrolls towards the end of the loaded set. All 121 stay
  // reachable — nothing is removed, it just loads in batches, and the
  // delegated tap listener above covers the new cards too.
  function bootProgressiveCarousel() {
    var carousel = document.querySelector(".suggest-carousel[data-progressive]");
    var dataEl = document.getElementById("suggest-carousel-data");
    if (!carousel || !dataEl) return;
    var all;
    try {
      all = JSON.parse(dataEl.textContent);
    } catch (err) {
      return;
    }
    if (!all || !all.length) return;
    var rest = all.slice(carousel.querySelectorAll(".suggest-pick").length);
    if (!rest.length) return;
    var BATCH = 30;

    function makeCard(artist) {
      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "suggest-pick";
      pick.setAttribute("role", "listitem");
      pick.setAttribute("data-artist", artist.name || "");
      pick.setAttribute("data-link", artist.profile || "");
      pick.title = "Suggest " + (artist.name || "");
      var img = document.createElement("img");
      img.src = artist.img || "";
      img.alt = artist.name || "";
      img.loading = "lazy";
      img.width = 150;
      img.height = 150;
      var name = document.createElement("span");
      name.className = "suggest-pick__name";
      name.textContent = artist.name || "";
      var note = document.createElement("span");
      note.className = "suggest-pick__note";
      note.textContent = artist.note || "";
      pick.appendChild(img);
      pick.appendChild(name);
      pick.appendChild(note);
      return pick;
    }

    var sentinel = document.createElement("span");
    sentinel.className = "suggest-carousel__sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    carousel.appendChild(sentinel);

    function loadNextBatch() {
      if (!rest.length) return false;
      var batch = rest.splice(0, BATCH);
      batch.forEach(function (artist) {
        carousel.insertBefore(makeCard(artist), sentinel);
      });
      if (!rest.length) sentinel.remove();
      return true;
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadNextBatch();
          if (!rest.length) observer.disconnect();
        });
      }, { root: carousel, rootMargin: "0px 500px 0px 0px" });
      observer.observe(sentinel);
    } else {
      // No IntersectionObserver: load the next batch when the visitor
      // scrolls near the end of what is loaded so far.
      carousel.addEventListener("scroll", function () {
        if (carousel.scrollLeft + carousel.clientWidth > carousel.scrollWidth - 500) loadNextBatch();
      }, { passive: true });
    }
  }

  bootProgressiveCarousel();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSuggest);
} else {
  bootSuggest();
}
