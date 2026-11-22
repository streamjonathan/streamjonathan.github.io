// Ask-the-writing chat + leave-a-note (homepage hero) and the floating
// Ask panel (every page).
//
// The chat talks to the site AI Worker at /api/ask; the note box POSTs to
// /api/note. If the Worker is not deployed yet (or is resting for the
// day), both fall back to pointing the reader at search or social media —
// nothing here ever breaks.
//
// Answers stream back token by token (SSE): words appear as they are
// written, instead of a ~3s wait for the whole answer. A repeated
// question comes back as one JSON reply from the Worker's cache.
//
// Both buttons are type="button" on purpose: the forms are driven by
// JavaScript only, so there is no native submit path that can reload the
// page and lose the visitor's words. The submit listeners stay as a
// fallback for Enter-key submission, and they preventDefault too.
function bootAsk() {
  function renderSources(answerEl, sources) {
    if (!sources || !sources.length) return;
    var list = document.createElement("ul");
    sources.forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = s.url;
      a.textContent = s.title;
      li.appendChild(a);
      list.appendChild(li);
    });
    answerEl.appendChild(list);
  }

  function renderFull(p, answerEl, data) {
    p.textContent = data.answer || "No answer came back — please try the search below.";
    renderSources(answerEl, data.sources);
  }

  // Read an SSE stream: append each {delta} as it arrives, then show the
  // sources from the final {sources, done:true} event. A {refusal} event
  // replaces whatever streamed so far with the safe refusal instead.
  function streamAnswer(response, p, answerEl) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    var started = false;
    function pump() {
      return reader.read().then(function (res) {
        if (res.done) return;
        buf += decoder.decode(res.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(function (line) {
          var t = line.trim();
          if (t.indexOf("data:") !== 0) return;
          var payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") return;
          var ev;
          try {
            ev = JSON.parse(payload);
          } catch (e) {
            return;
          }
          if (ev.refusal) {
            p.textContent = ev.refusal;
            renderSources(answerEl, ev.sources);
            return;
          }
          if (ev.delta) {
            if (!started) {
              p.textContent = "";
              started = true;
            }
            p.textContent += ev.delta;
          }
          if (ev.done) renderSources(answerEl, ev.sources);
        });
        return pump();
      });
    }
    return pump();
  }

  function searchFallback(p, answerEl, q) {
    p.textContent = "The chat isn't available right now — please use the search instead.";
    var a = document.createElement("a");
    a.href = "/search/?q=" + encodeURIComponent(q);
    a.textContent = "Search the writing";
    answerEl.appendChild(a);
  }

  // Wire one ask form (hero or floating panel) to /api/ask.
  function wireAsk(formId, inputId, buttonId, answerId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var input = document.getElementById(inputId);
    var button = document.getElementById(buttonId);
    var answerEl = document.getElementById(answerId);
    if (!input || !button || !answerEl) return;

    function doAsk() {
      var q = input.value.trim();
      if (!q) return;
      button.disabled = true;
      answerEl.innerHTML = "";
      var p = document.createElement("p");
      p.textContent = "Thinking…";
      answerEl.appendChild(p);
      fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      })
        .then(function (r) {
          var ct = r.headers.get("Content-Type") || "";
          if (ct.indexOf("text/event-stream") !== -1) {
            return streamAnswer(r, p, answerEl).then(function () {
              button.disabled = false;
            });
          }
          return r.json().then(function (data) {
            button.disabled = false;
            renderFull(p, answerEl, data);
          });
        })
        .catch(function () {
          button.disabled = false;
          answerEl.innerHTML = "";
          var p2 = document.createElement("p");
          answerEl.appendChild(p2);
          searchFallback(p2, answerEl, q);
        });
    }

    button.addEventListener("click", doAsk);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      doAsk();
    });
    return doAsk;
  }

  // Homepage hero chat.
  var heroAsk = wireAsk("ask-form", "ask-question", "ask-button", "ask-answer");

  // Try-it chips: tap one and the question asks itself.
  var chips = document.querySelectorAll(".chips [data-q]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var input = document.getElementById("ask-question");
      if (!input || !heroAsk) return;
      input.value = chip.getAttribute("data-q");
      heroAsk();
    });
  });

  // Floating Ask panel: one tap from any page, full-screen on phones.
  var fab = document.getElementById("ask-fab");
  var overlay = document.getElementById("ask-overlay");
  if (fab && overlay) {
    var overlayInput = document.getElementById("ask-question-overlay");
    fab.addEventListener("click", function () {
      overlay.hidden = false;
      if (overlayInput) overlayInput.focus();
    });
    var closeBtn = document.getElementById("ask-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        overlay.hidden = true;
      });
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") overlay.hidden = true;
    });
    wireAsk("ask-form-overlay", "ask-question-overlay", "ask-button-overlay", "ask-answer-overlay");
  }

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
            result.innerHTML = "Thank you — your note is with Jonathan.<br>Want a personal reply? Find me on <a href=\"https://www.instagram.com/jonamccallum\">Instagram @jonamccallum</a> or <a href=\"https://www.threads.com/@jonamccallum\">Threads @jonamccallum</a>.";
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
