// Mind Poems — one poem a day, with the full calendar one tap away (v2).
// Only days with a poem are "today": if today has a poem it shows;
// if not, the latest poem shows instead, labelled with its date, so
// the page never shows a stale "today". Previous / Next day step
// through the poems and wrap around.
// The calendar is hidden on load (JS only); without JS it stays visible
// below today's poem, and the server-rendered poem is still shown.
// Tap a filled day to open it in a pop-up; close with the ×, the
// backdrop, or Escape. Previous / Next flip between poems in the pop-up.
(function () {
  // --- Today's poem ---
  var articles = document.querySelectorAll("[data-today-poem]");
  var label = document.querySelector("[data-today-label]");
  var defaultLabel = (label && label.getAttribute("data-default-label")) || "Today's poem";
  var current = -1;
  var todayIndex = -1;

  function show(i) {
    if (!articles.length) return;
    current = (((i % articles.length) + articles.length) % articles.length);
    Array.prototype.forEach.call(articles, function (el, idx) {
      el.hidden = idx !== current;
    });
    if (label) {
      label.textContent =
        current === todayIndex ? defaultLabel : "Browsing the poems";
    }
  }

  if (articles.length) {
    // Correct the build-date default to the reader's own clock: today
    // if it has a poem, otherwise the latest poem.
    var day = new Date().getDate();
    todayIndex = -1;
    Array.prototype.forEach.call(articles, function (el, idx) {
      if (parseInt(el.getAttribute("data-today-poem"), 10) === day) todayIndex = idx;
    });
    if (todayIndex < 0) todayIndex = articles.length - 1;
    show(todayIndex);
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-today-prev]"),
      function (btn) {
        btn.addEventListener("click", function () {
          show(current - 1);
        });
      }
    );
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-today-next]"),
      function (btn) {
        btn.addEventListener("click", function () {
          show(current + 1);
        });
      }
    );
  }

  // --- Full calendar toggle ---
  var toggle = document.querySelector("[data-calendar-toggle]");
  var calendar = document.getElementById("mind-poems-calendar");
  if (toggle && calendar) {
    calendar.hidden = true; // JS only: without JS the calendar stays visible
    toggle.addEventListener("click", function () {
      var open = calendar.hidden;
      calendar.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open
        ? "Hide the calendar"
        : "View the full calendar";
    });
  }

  // --- Pop-up dialogs ---
  var openers = document.querySelectorAll("[data-poem]");
  if (!openers.length) return;

  function openDialog(day) {
    var dlg = document.getElementById("mind-poem-" + day);
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  Array.prototype.forEach.call(openers, function (btn) {
    btn.addEventListener("click", function () {
      openDialog(btn.getAttribute("data-poem"));
    });
  });

  Array.prototype.forEach.call(
    document.querySelectorAll(".mind-poems__dialog"),
    function (dlg) {
      // Tap the backdrop to close.
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) dlg.close();
      });
      Array.prototype.forEach.call(
        dlg.querySelectorAll("[data-close]"),
        function (btn) {
          btn.addEventListener("click", function () {
            dlg.close();
          });
        }
      );
      Array.prototype.forEach.call(
        dlg.querySelectorAll("[data-open]"),
        function (btn) {
          btn.addEventListener("click", function () {
            var day = btn.getAttribute("data-open");
            dlg.close();
            openDialog(day);
          });
        }
      );
    }
  );
})();
