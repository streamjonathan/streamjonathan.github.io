// Ask-the-writing chat (homepage only): talks to the site AI Worker at
// /api/ask. If the Worker is not deployed yet (or is resting for the day),
// the form falls back to pointing the reader at search — nothing here
// ever breaks. The newsletter form is a placeholder until the mailing
// list is set up.
(function () {
  var form = document.getElementById("ask-form");
  var answer = document.getElementById("ask-answer");
  if (!form) return;
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

  // Newsletter signup is a placeholder until the mailing list is set up.
  var news = document.getElementById("newsletter-form");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      document.getElementById("newsletter-note").textContent =
        "Newsletter signup opens soon — for now, Substack is the best place to follow along.";
    });
  }
})();
