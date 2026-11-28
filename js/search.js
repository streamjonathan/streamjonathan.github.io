// Pagefind search UI (search page only). The index and the UI files are
// same-origin and generated at build time, so this needs no network
// beyond the site itself.
function bootSearch() {
  var wrap = document.getElementById("search");
  var status = document.getElementById("search-status");
  var ui = new PagefindUI({ element: "#search", showSubResults: true });

  // The first query used to show nothing for seconds while the index
  // loaded, which looks broken. Show "Searching…" from the first
  // keystroke (or linked query) until Pagefind renders anything.
  function setSearching(on) { if (status) status.hidden = !on; }
  function resultsShown() {
    if (!wrap) return false;
    if (wrap.querySelector(".pagefind-ui__results li")) return true;
    var msg = wrap.querySelector(".pagefind-ui__message");
    return !!(msg && msg.textContent.trim() !== "");
  }
  if (wrap && status && "MutationObserver" in window) {
    var observer = new MutationObserver(function () {
      if (resultsShown()) setSearching(false);
    });
    observer.observe(wrap, { childList: true, subtree: true });
    wrap.addEventListener("input", function (e) {
      var q = (e.target && e.target.value) || "";
      if (q.trim() && !resultsShown()) setSearching(true);
      else setSearching(false);
    });
  }

  // Warm the search index while the reader is still reading the intro,
  // so the first query does not wait on the index download. Harmless
  // when Pagefind already fetched it — the browser cache answers.
  if ("fetch" in window) {
    fetch("/pagefind/pagefind-entry.json").catch(function () {});
  }

  // Let a search be shared or linked to: /search/?q=tide fills the box
  // and runs the search. triggerSearch is PagefindUI's own API for this —
  // setting the input's value by hand and dispatching an input event does
  // NOT work: the component owns the input and wipes a hand-set value.
  // The chat's resting message links here with the visitor's question,
  // so the search keeps working when the chat rests.
  var q = new URLSearchParams(window.location.search).get("q");
  if (!q) return;
  setSearching(true);
  setTimeout(function () { ui.triggerSearch(q); }, 0);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSearch);
} else {
  bootSearch();
}
