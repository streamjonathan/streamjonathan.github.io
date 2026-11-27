// Theme: night is the start. The small Dark / Light button at the top
// switches to the greyish day theme and saves the choice on this device.
(function () {
  var root = document.documentElement;
  var button = document.getElementById("theme-toggle");
  var stored = null;
  try { stored = localStorage.getItem("theme"); } catch (e) {}
  if (stored === "light") root.setAttribute("data-theme", "light");
  function effective() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  var themeColor = document.querySelector('meta[name="theme-color"]');
  function paint() {
    if (button) button.textContent = effective() === "dark" ? "Light" : "Dark";
    if (themeColor) themeColor.setAttribute("content", effective() === "dark" ? "#121212" : "#faf9f6");
  }
  if (button) {
    button.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      if (next === "light") root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      try { localStorage.setItem("theme", next); } catch (e) {}
      paint();
    });
  }
  paint();
})();

// Swipe between posts: on a post page, swipe left for the next post and
// swipe right for the previous one. Only runs when those links exist.
(function () {
  var nav = document.querySelector(".post-nav");
  if (!nav) return;
  var startX = null, startY = null;
  document.addEventListener("touchstart", function (e) {
    var t = e.changedTouches[0];
    startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - startX, dy = t.clientY - startY;
    startX = null; startY = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    var link = nav.querySelector(dx < 0 ? ".post-nav__next" : ".post-nav__prev");
    if (link) window.location.href = link.href;
  }, { passive: true });
})();

// Tap-to-load video facades: swap the thumbnail for the youtube-nocookie
// iframe only when the reader taps play. This is the site's only global
// JavaScript. No third-party script loads until that tap. TikTok embeds
// work the same way: the iframe loads only after a tap (data-tiktok-id).
document.addEventListener("click", function (e) {
  var button = e.target.closest("[data-video-id]");
  if (button) {
    var id = button.getAttribute("data-video-id");
    var start = button.getAttribute("data-video-start");
    var holder = button.closest(".video-facade");
    if (!holder) return;
    var frame = document.createElement("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0" + (start ? "&start=" + start : "");
    frame.title = "YouTube video";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    holder.replaceWith(frame);
    return;
  }
  var tiktok = e.target.closest("[data-tiktok-id]");
  if (!tiktok) return;
  var tid = tiktok.getAttribute("data-tiktok-id");
  var tholder = tiktok.closest(".video-facade");
  if (!tholder) return;
  var tframe = document.createElement("iframe");
  tframe.src = "https://www.tiktok.com/embed/v2/" + tid;
  tframe.title = "TikTok video";
  tframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  tframe.allowFullscreen = true;
  tframe.loading = "lazy";
  tholder.replaceWith(tframe);
});

// Gentle fade-in as sections enter view. Skipped entirely when the
// reader prefers reduced motion. The .js-fade class on <html> is what
// lets the CSS hide sections first; without JS nothing is hidden.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var items = document.querySelectorAll("[data-fade]");
  if (!items.length || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-fade");
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });
  items.forEach(function (item) { observer.observe(item); });
})();

// Auto carousels (featured + writing): each row moves through its cards,
// one card every four seconds, looping back to the start. The first card
// moves about a second after the page loads, so it is moving from the
// start — it does not sit still for a whole interval first. Arrow buttons
// and dots let the reader move it by hand. It keeps moving even while the
// reader's pointer rests over it — it only pauses while the reader is
// actively dragging it, and starts again five seconds after the drag ends.
// Stays still when reduced motion is preferred or the tab is hidden.
(function () {
  var rows = document.querySelectorAll("[data-auto-carousel]");
  if (!rows.length) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Array.prototype.forEach.call(rows, function (row) {
  var cards = row.children;
  if (cards.length < 2) return;
  var section = row.closest("section, article");
  var dotsWrap = section ? section.querySelector(".featured-dots") : null;
  var prev = section ? section.querySelector("[data-carousel-prev]") : null;
  var next = section ? section.querySelector("[data-carousel-next]") : null;
  var dots = [];
  var index = 0, timer = null, paused = false, resumeAt = 0;

  function nearestIndex() {
    var rowRect = row.getBoundingClientRect();
    var best = 0, bestDist = Infinity;
    Array.prototype.forEach.call(cards, function (card, i) {
      var dist = Math.abs(card.getBoundingClientRect().left - rowRect.left);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }
  // Long rows get a progress bar + "3 of 94" counter instead of one
  // dot per slide — a hundred dots would run the page heaps wide.
  var useProgress = cards.length > 12;
  var progressBar = null, progressFill = null, countEl = null;
  function markDot() {
    if (useProgress) {
      if (progressFill) progressFill.style.width = ((index + 1) / cards.length * 100) + "%";
      if (countEl) countEl.textContent = (index + 1) + " of " + cards.length;
      if (progressBar) progressBar.setAttribute("aria-valuenow", String(index + 1));
      return;
    }
    dots.forEach(function (dot, i) {
      if (i === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }
  function show(i) {
    index = ((i % cards.length) + cards.length) % cards.length;
    var card = cards[index];
    var rowRect = row.getBoundingClientRect();
    var cardRect = card.getBoundingClientRect();
    row.scrollTo({ left: row.scrollLeft + (cardRect.left - rowRect.left), behavior: reduceMotion ? "auto" : "smooth" });
    markDot();
  }
  function step() {
    if (paused || document.hidden || Date.now() < resumeAt) return;
    // Loop back to the first card at the end. The row's maximum scroll
    // stops short of bringing the last card to the left edge (two cards
    // are visible), so nearestIndex() never returns the last card — it
    // keeps returning the second-to-last one, and show(last) scrolls to
    // the same clamped position forever. Detect the end by the scroll
    // position itself (within a couple of pixels of maximum scroll), with
    // the last-card check as well for narrow viewports where only one
    // card is visible and the last card does reach the left edge.
    var current = nearestIndex();
    var atEnd = current >= cards.length - 1 || row.scrollLeft >= row.scrollWidth - row.clientWidth - 2;
    if (atEnd) show(0);
    else show(current + 1);
  }
  function start() {
    if (timer) return;
    timer = setInterval(step, 4000);
    setTimeout(step, 1200);
  }
  function touch() { paused = false; resumeAt = Date.now() + 5000; }

  if (dotsWrap) {
    if (useProgress) {
      dotsWrap.classList.add("featured-dots--progress");
      dotsWrap.removeAttribute("role");
      var label = dotsWrap.getAttribute("aria-label") || "Position in list";
      dotsWrap.removeAttribute("aria-label");
      progressBar = document.createElement("div");
      progressBar.className = "featured-progress";
      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-label", label);
      progressBar.setAttribute("aria-valuemin", "1");
      progressBar.setAttribute("aria-valuemax", String(cards.length));
      progressFill = document.createElement("span");
      progressFill.className = "featured-progress__fill";
      progressBar.appendChild(progressFill);
      dotsWrap.appendChild(progressBar);
      countEl = document.createElement("span");
      countEl.className = "featured-count";
      dotsWrap.appendChild(countEl);
    } else {
      for (var d = 0; d < cards.length; d++) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "featured-dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", "Go to article " + (d + 1));
        (function (i) {
          dot.addEventListener("click", function () { show(i); touch(); });
        })(d);
        dotsWrap.appendChild(dot);
        dots.push(dot);
      }
    }
  }
  row.addEventListener("pointerdown", function () { paused = true; });
  row.addEventListener("pointerup", function () { touch(); });
  row.addEventListener("wheel", function () { touch(); }, { passive: true });
  row.addEventListener("touchend", function () { touch(); }, { passive: true });
  if (prev) prev.addEventListener("click", function () { show(nearestIndex() - 1); touch(); });
  if (next) next.addEventListener("click", function () { show(nearestIndex() + 1); touch(); });
  var scrollTimer = null;
  row.addEventListener("scroll", function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      index = nearestIndex();
      markDot();
    }, 150);
  }, { passive: true });
  if (section) section.classList.add("is-ready");
  markDot();
  // Rows marked data-no-auto stay still until the reader moves them:
  // the newest-writing row sits under a lead card that already carries
  // the motion, and a row that slides away while the reader is reading
  // an excerpt is a tap missed.
  if (!reduceMotion && !row.hasAttribute("data-no-auto")) start();
  });
})();

// Share: copy the post link to the clipboard.
(function () {
  var btn = document.getElementById("copy-link");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var url = btn.getAttribute("data-url");
    function done() {
      btn.textContent = "Copied";
      var note = document.getElementById("copy-feedback");
      if (note) note.hidden = false;
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, fallback);
    } else {
      fallback();
    }
  });
})();

// Glowing dropdowns (Connect on the homepage, Comments under articles):
// a tap outside, or Escape, shuts an open one. The panels themselves
// are plain <details>, so they open and shut with no JavaScript at all.
(function () {
  function closeOpen() {
    Array.prototype.forEach.call(document.querySelectorAll("details.social-dropdown[open], details.comments-dropdown[open]"), function (d) {
      d.removeAttribute("open");
    });
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest("details.social-dropdown, details.comments-dropdown")) closeOpen();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOpen();
  });
})();
