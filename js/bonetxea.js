// Domingo Bonetxea page — language toggle, French first, the choice
// remembered. Same pattern as the family tree page.
(function () {
  var root = document.getElementById("bonetxea");
  if (!root) return;

  var STORAGE_KEY = "bonetxea-lang";
  var langButtons = root.querySelectorAll("[data-lang-btn]");

  function setLang(lang) {
    root.setAttribute("data-lang", lang);
    Array.prototype.forEach.call(langButtons, function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-lang-btn") === lang ? "true" : "false"
      );
    });
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") setLang(saved);
  } catch (e) {}

  Array.prototype.forEach.call(langButtons, function (b) {
    b.addEventListener("click", function () {
      setLang(b.getAttribute("data-lang-btn"));
    });
  });
})();
