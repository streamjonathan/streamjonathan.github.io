// Pagefind search UI (search page only). The index and the UI files are
// same-origin and generated at build time, so this needs no network
// beyond the site itself.
window.addEventListener("DOMContentLoaded", function () {
  new PagefindUI({ element: "#search", showSubResults: true });
  // Let a search be shared or linked to: /search/?q=tide fills the box
  // and runs the search. The chat's resting message links here with the
  // visitor's question, so the search keeps working when the chat rests.
  var q = new URLSearchParams(window.location.search).get("q");
  if (!q) return;
  var input = document.querySelector("#search input");
  if (!input) return;
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
