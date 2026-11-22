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
// JavaScript. No third-party script loads until that tap.
document.addEventListener("click", function (e) {
  var button = e.target.closest("[data-video-id]");
  if (!button) return;
  var id = button.getAttribute("data-video-id");
  var holder = button.closest(".video-facade");
  if (!holder) return;
  var frame = document.createElement("iframe");
  frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
  frame.title = "YouTube video";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  frame.loading = "lazy";
  holder.replaceWith(frame);
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

// Featured carousel: moves slowly through the newest articles, one card
// every seven seconds, looping back to the start. Arrow buttons and dots
// let the reader move it by hand. It keeps moving even while the reader's
// pointer rests over it — it only pauses while the reader is actively
// dragging it, and starts again five seconds after the drag ends.
// Stays still when reduced motion is preferred or the tab is hidden.
(function () {
  var row = document.querySelector("[data-auto-carousel]");
  if (!row) return;
  var cards = row.children;
  if (cards.length < 2) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var section = row.closest(".featured");
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
  function markDot() {
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
    show(nearestIndex() + 1);
  }
  function start() { if (!timer) timer = setInterval(step, 7000); }
  function touch() { paused = false; resumeAt = Date.now() + 5000; }

  if (dotsWrap) {
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
  if (!reduceMotion) start();
})();
