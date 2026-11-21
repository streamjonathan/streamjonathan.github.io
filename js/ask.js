// Ask-the-writing chat (homepage only): talks to the site AI Worker at
// /api/ask. If the Worker is not deployed yet (or is resting for the day),
// the form falls back to pointing the reader at search — nothing here
// ever breaks.
(function () {
  var form = document.getElementById("ask-form");
  var answer = document.getElementById("ask-answer");
  if (!form) return;

  // Try-it chips: tap one and the question asks itself.
  var chips = document.querySelectorAll(".chips [data-q]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.getElementById("ask-question").value = chip.getAttribute("data-q");
      form.requestSubmit();
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = document.getElementById("ask-question").value.trim();
    if (!q) return;
    var button = form.querySelector("button");
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
        a.href = "/search/";
        a.textContent = "Search the writing";
        answer.appendChild(p);
        answer.appendChild(a);
      });
  });
  // Leave a note: anonymous, no name or email asked for. Until the Worker
  // is deployed the form says so honestly and points at social media.
  var noteForm = document.getElementById("note-form");
  if (noteForm) {
    noteForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = document.getElementById("note-text").value.trim();
      var result = document.getElementById("note-result");
      if (!text) return;
      var button = noteForm.querySelector("button");
      button.disabled = true;
      result.textContent = "Leaving your note…";
      fetch("/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          button.disabled = false;
          if (data.ok) {
            result.textContent = "Thank you — your note is with Jonathan.";
            document.getElementById("note-text").value = "";
          } else {
            result.textContent = "Notes aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
          }
        })
        .catch(function () {
          button.disabled = false;
          result.textContent = "Notes aren't switched on yet — the quickest way to reach Jonathan is a message on Instagram or Threads.";
        });
    });
  }
})();
