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
