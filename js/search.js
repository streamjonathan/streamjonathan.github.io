// Pagefind search UI (search page only). The index and the UI files are
// same-origin and generated at build time, so this needs no network
// beyond the site itself.
function bootSearch() {
  var ui = new PagefindUI({ element: "#search", showSubResults: true });
  // Let a search be shared or linked to: /search/?q=tide fills the box
  // and runs the search. triggerSearch is PagefindUI's own API for this —
  // setting the input's value by hand and dispatching an input event does
  // NOT work: the component owns the input and wipes a hand-set value.
  // The chat's resting message links here with the visitor's question,
  // so the search keeps working when the chat rests.
  var q = new URLSearchParams(window.location.search).get("q");
  if (!q) return;
  setTimeout(function () { ui.triggerSearch(q); }, 0);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSearch);
} else {
  bootSearch();
}
