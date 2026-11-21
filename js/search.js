// Pagefind search UI (search page only). The index and the UI files are
// same-origin and generated at build time, so this needs no network
// beyond the site itself.
window.addEventListener("DOMContentLoaded", function () {
  new PagefindUI({ element: "#search", showSubResults: true });
});
