// Mind Poems — open a day's poem in a pop-up dialog (v1).
// Tap a filled day to open it; close with the ×, the backdrop, or Escape.
// Previous / Next flip between poems without closing.
(function () {
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
