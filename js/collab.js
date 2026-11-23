// Collab with me: proposal form + takedown request form.
//
// Both forms post to the Worker (same origin on the live site, where
// /api/* routes to the Worker; on a Pages preview the form's
// data-collab-api points at the test Worker instead — see
// _data/site.json). Nothing here publishes anything: a proposal is
// stored pending + unverified, and a takedown request is stored for
// Jonathan to act on. The Worker answers a proposal with a short
// verification code — the artist sends it in a DM from the social
// account they linked, which proves the account is really theirs.

(function () {
  function apiBase(form) {
    var base = form.getAttribute("data-collab-api") || "";
    return base.replace(/\/$/, "");
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json();
    });
  }

  function boot() {
    // Propose a collab.
    var form = document.getElementById("collab-form");
    if (form) {
      var button = document.getElementById("collab-button");
      var result = document.getElementById("collab-result");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("collab-name").value.trim();
        var social = document.getElementById("collab-social").value.trim();
        var social2 = document.getElementById("collab-social2").value.trim();
        var kinds = [];
        var boxes = form.querySelectorAll('input[name="kind"]:checked');
        for (var i = 0; i < boxes.length; i++) kinds.push(boxes[i].value);
        var bring = document.getElementById("collab-bring").value.trim();
        var idea = document.getElementById("collab-idea").value.trim();
        var age18 = document.getElementById("collab-age").checked;
        var permission = document.getElementById("collab-permission").checked;
        if (!name || !social || !kinds.length || !bring || !idea || !age18 || !permission) {
          result.textContent =
            "Please fill in your name, your social profile, at least one kind of collab, what you would bring, your idea, and tick both boxes.";
          return;
        }
        button.disabled = true;
        result.textContent = "Sending your collab idea…";
        postJson(apiBase(form) + "/api/collab", {
          name: name,
          social: social,
          social2: social2,
          kinds: kinds,
          bring: bring,
          idea: idea,
          age18: age18,
          permission: permission,
        })
          .then(function (data) {
            button.disabled = false;
            if (data.ok && data.code) {
              form.hidden = true;
              result.innerHTML =
                "Thank you — your collab idea is with Jonathan.<br><br>One last step, so I know the account is really yours. Your code is:<br><span class=\"collab-code\">" +
                data.code +
                "</span><br><br>Send that code in a message to <a href=\"https://www.instagram.com/jonamccallum\">@jonamccallum on Instagram</a> from the account you linked — or put it in your bio for a day. Nothing is published until Jonathan has seen your message and said yes.";
            } else if (data.error) {
              result.textContent = data.error;
            } else {
              result.textContent =
                "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
            }
          })
          .catch(function () {
            button.disabled = false;
            result.textContent =
              "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
          });
      });
    }

    // Ask for a collab to be taken down.
    var takeForm = document.getElementById("collab-takedown-form");
    if (takeForm) {
      var takeButton = document.getElementById("takedown-button");
      var takeResult = document.getElementById("takedown-result");
      takeForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("takedown-name").value.trim();
        var social = document.getElementById("takedown-social").value.trim();
        var target = document.getElementById("takedown-target").value.trim();
        var reason = document.getElementById("takedown-reason").value.trim();
        if (!name || !social || !target) {
          takeResult.textContent =
            "Please fill in your name, your social profile, and which collab should come down.";
          return;
        }
        takeButton.disabled = true;
        takeResult.textContent = "Sending your request…";
        postJson(apiBase(takeForm) + "/api/collab/takedown", {
          name: name,
          social: social,
          target: target,
          reason: reason,
        })
          .then(function (data) {
            takeButton.disabled = false;
            if (data.ok) {
              takeForm.hidden = true;
              takeResult.textContent =
                "Thank you — your request is with Jonathan, and the piece will come down. If you would rather talk about it first, message him on Instagram or Threads.";
            } else if (data.error) {
              takeResult.textContent = data.error;
            } else {
              takeResult.textContent =
                "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
            }
          })
          .catch(function () {
            takeButton.disabled = false;
            takeResult.textContent =
              "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
          });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
