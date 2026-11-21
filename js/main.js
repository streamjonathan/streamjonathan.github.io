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
