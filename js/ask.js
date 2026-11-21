// Ask-the-writing chat + leave-a-note (homepage only).
//
// The chat talks to the site AI Worker at /api/ask; the note box POSTs to
// /api/note. If the Worker is not deployed yet (or is resting for the
// day), both fall back to pointing the reader at search or social media —
// nothing here ever breaks.
//
// Both buttons are type="button" on purpose: the forms are driven by
// JavaScript only, so there is no native submit path that can reload the
// page and lose the visitor's words. The submit listeners stay as a
// fallback for Enter-key submission, and they preventDefault too.
function bootAsk() {
  var form = document.getElementById("ask-form");
  var answer = document.getElementById("ask-answer");
  if (!form) return;

  function doAsk() {
    var q = document.getElementById("ask-question").value.trim();
    if (!q) return;
    var button = document.getElementById("ask-button");
    button.disabled = true;
    answer.textContent = "Thinking…";
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        button.disabled = false;
        answer.innerHTML = "";
        var p = document.createElement("p");
        p.textContent = data.answer || "No answer came back — please try the search below.";
        answer.appendChild(p);
        if (data.sources && data.sources.length) {
          var list = document.createElement("ul");
          data.sources.forEach(function (s) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = s.url;
            a.textContent = s.title;
            li.appendChild(a);
            list.appendChild(li);
          });
          answer.appendChild(list);
        }
      })
      .catch(function () {
        button.disabled = false;
        answer.innerHTML = "";
        var p = document.createElement("p");
        p.textContent = "The chat isn't available right now — please use the search instead.";
        var a = document.createElement("a");
        a.href = "/search/?q=" + encodeURIComponent(q);
        a.textContent = "Search the writing";
        answer.appendChild(p);
        answer.appendChild(a);
      });
  }

  // Try-it chips: tap one and the question asks itself.
  var chips = document.querySelectorAll(".chips [data-q]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.getElementById("ask-question").value = chip.getAttribute("data-q");
      doAsk();
    });
  });

  document.getElementById("ask-button").addEventListener("click", doAsk);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    doAsk();
  });

  // Leave a note: anonymous, no name or email asked for.
  var noteForm = document.getElementById("note-form");
  if (noteForm) {
    var noteButton = document.getElementById("note-button");
    var result = document.getElementById("note-result");

    function doNote() {
      var text = document.getElementById("note-text").value.trim();
      if (!text) return;
      noteButton.disabled = true;
      result.textContent = "Leaving your note…";
      fetch("/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          noteButton.disabled = false;
          if (data.ok) {
            result.textContent = "Thank you — your note is with Jonathan.";
            document.getElementById("note-text").value = "";
          } else {
            result.textContent = "Notes aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
          }
        })
        .catch(function () {
          noteButton.disabled = false;
          result.textContent = "Notes aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
        });
    }

    noteButton.addEventListener("click", doNote);
    noteForm.addEventListener("submit", function (e) {
      e.preventDefault();
      doNote();
    });
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootAsk);
} else {
  bootAsk();
}
