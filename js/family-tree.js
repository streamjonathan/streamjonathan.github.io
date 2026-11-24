// Family tree — language toggle, expandable person cards, and the
// "trace my line" animation (v1). The line lights up step by step from
// Jonathan at the bottom to John and Susannah at the top, with Amy
// highlighted as the key link back to Tahiti. Runs once on load; the
// button replays it. Reduced-motion readers get the full path lit at
// once, with no animation.
(function () {
  var root = document.getElementById("family-tree");
  if (!root) return;

  // Language toggle — French first, the choice remembered.
  var STORAGE_KEY = "family-tree-lang";
  var langButtons = root.querySelectorAll("[data-tree-lang-btn]");

  function setLang(lang) {
    root.setAttribute("data-tree-lang", lang);
    Array.prototype.forEach.call(langButtons, function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-tree-lang-btn") === lang ? "true" : "false"
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
      setLang(b.getAttribute("data-tree-lang-btn"));
    });
  });

  // Tap a person's card to open or close their detail.
  Array.prototype.forEach.call(
    root.querySelectorAll(".person__head"),
    function (btn) {
      btn.addEventListener("click", function () {
        var detail = document.getElementById(
          btn.getAttribute("aria-controls")
        );
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (detail) detail.hidden = open;
      });
    }
  );

  // Trace the line: every lit element carries a data-step, lowest
  // (Jonathan) first, highest (John and Susannah) last. Elements that
  // share a step — the couple — light together.
  var steps = Array.prototype.slice.call(
    root.querySelectorAll("[data-step]")
  );
  steps.sort(function (a, b) {
    return (
      parseInt(a.getAttribute("data-step"), 10) -
      parseInt(b.getAttribute("data-step"), 10)
    );
  });

  var reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var timers = [];

  function trace() {
    timers.forEach(clearTimeout);
    timers = [];
    steps.forEach(function (el) {
      el.classList.remove("is-lit");
    });
    if (reduced) {
      steps.forEach(function (el) {
        el.classList.add("is-lit");
      });
      return;
    }
    // Scroll to the start of the line (Jonathan), then follow it up as
    // each step lights — the page glides with the trace instead of the
    // progress happening off-screen.
    if (steps.length) {
      steps[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
    steps.forEach(function (el, i) {
      timers.push(
        setTimeout(function () {
          el.classList.add("is-lit");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 400 + i * 500)
      );
    });
  }

  var traceBtn = document.getElementById("trace-line");
  if (traceBtn) traceBtn.addEventListener("click", trace);

  trace();
})();
