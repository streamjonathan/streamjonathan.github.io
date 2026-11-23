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

  // Share your story: artist interview form. Sign-in first (Instagram
  // or Google) — the sign-in is what proves the account is really
  // theirs. Questions are <details> accordions; a live copy area holds
  // the full reply; the DM prompt asks them to also paste it to
  // @jonamccallum on Instagram.
  var interviewForm = document.getElementById("interview-form");
  if (interviewForm) {
    var signinBox = document.getElementById("interview-signin");
    var googleClientId = signinBox ? (signinBox.getAttribute("data-google-client-id") || "") : "";
    var igButton = document.getElementById("interview-ig-signin");
    var igNote = document.getElementById("interview-ig-note");
    var googleBox = document.getElementById("interview-google-signin");
    var googleNote = document.getElementById("interview-google-note");
    var emailBox = document.getElementById("interview-email-signin");
    var emailField = document.getElementById("interview-email");
    var emailSendButton = document.getElementById("interview-email-send");
    var emailCodeRow = document.getElementById("interview-email-code-row");
    var emailCodeField = document.getElementById("interview-email-code");
    var emailVerifyButton = document.getElementById("interview-email-verify");
    var emailNote = document.getElementById("interview-email-note");
    var signinStatus = document.getElementById("interview-signin-status");
    var signedinLine = document.getElementById("interview-signedin");
    var signedinText = document.getElementById("interview-signedin-text");
    var nameField = document.getElementById("interview-name");
    var socialField = document.getElementById("interview-social");
    var socialNote = document.getElementById("interview-social-note");
    var copyArea = document.getElementById("interview-copy");
    var copyButton = document.getElementById("interview-copy-button");
    var copyResult = document.getElementById("interview-copy-result");
    var interviewButton = document.getElementById("interview-button");
    var interviewResult = document.getElementById("interview-result");
    var signedIn = null;

    function fullReplyText() {
      var lines = [];
      var name = nameField.value.trim();
      var social = socialField.value.trim();
      if (name) lines.push(name);
      if (social) lines.push(social);
      lines.push("");
      lines.push("Tell us about yourself and the music or art you make. What do you love making, and why?");
      lines.push(document.getElementById("interview-q1").value.trim());
      lines.push("");
      lines.push("What would you like the world to know about your faith in Jesus — and how does it shape what you create?");
      lines.push(document.getElementById("interview-q2").value.trim());
      lines.push("");
      lines.push("Tell us a story from your life. It doesn't have to be deep — it can be funny, or just interesting. What's a moment that says something about who you are?");
      lines.push(document.getElementById("interview-q3").value.trim());
      return lines.join("\n");
    }

    function updateCopy() {
      copyArea.value = fullReplyText();
    }

    ["interview-name", "interview-social", "interview-social2", "interview-q1", "interview-q2", "interview-q3"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", updateCopy);
    });

    function copyReplyText(text, area, done) {
      function ok() { done(); }
      function fallback() {
        try {
          area.select();
          document.execCommand("copy");
        } catch (e) {}
        done();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
      } else {
        fallback();
      }
    }

    copyButton.addEventListener("click", function () {
      updateCopy();
      var text = copyArea.value;
      if (!text.trim()) {
        copyResult.textContent = "Write your answers first, then copy them here.";
        return;
      }
      copyReplyText(text, copyArea, function () {
        copyResult.textContent = "Copied — your full reply is on the clipboard.";
      });
    });

    function applySignedIn(me) {
      signedIn = me;
      if (me.signedIn) {
        if (signinStatus) signinStatus.textContent = "";
        if (signedinText) {
          signedinText.textContent = me.provider === "instagram"
            ? "Signed in as @" + me.username + " (Instagram). "
            : me.provider === "email"
              ? "Signed in with email" + (me.name ? " as " + me.name : "") + ". "
              : "Signed in with Google" + (me.name ? " as " + me.name : "") + ". ";
        }
        if (signedinLine) signedinLine.hidden = false;
        if (me.name && !nameField.value) nameField.value = me.name;
        if (me.provider === "instagram" && me.profileUrl) {
          socialField.value = me.profileUrl;
          socialField.readOnly = true;
          if (socialNote) socialNote.textContent = "Taken from your Instagram sign-in — this is the account the site verified.";
        } else if (socialNote) {
          socialNote.textContent = "Paste the link to your profile, not just your username. Jonathan will check it against the message you send him on Instagram.";
        }
      } else {
        if (signedinLine) signedinLine.hidden = true;
        socialField.readOnly = false;
      }
      updateCopy();
    }

    function loadGoogleButton() {
      if (!googleClientId) {
        if (googleNote) googleNote.textContent = "Google sign-in is being set up — check back soon.";
        return;
      }
      if (window.google && window.google.accounts && window.google.accounts.id) {
        showGoogleButton();
        return;
      }
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = showGoogleButton;
      s.onerror = function () {
        if (googleNote) googleNote.textContent = "Google sign-in did not load — check the connection and try again.";
      };
      document.head.appendChild(s);
    }

    function showGoogleButton() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: onGoogleSignedIn });
      if (googleBox) {
        window.google.accounts.id.renderButton(googleBox, { theme: "outline", size: "large" });
      }
    }

    function onGoogleSignedIn(resp) {
      if (!resp || !resp.credential) return;
      if (signinStatus) signinStatus.textContent = "Signing in…";
      fetch("/api/interview/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: resp.credential }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            refreshMe();
          } else {
            if (signinStatus) signinStatus.textContent = data.error || "That Google sign-in did not work — please try again.";
          }
        })
        .catch(function () {
          if (signinStatus) signinStatus.textContent = "That Google sign-in did not work — please try again.";
        });
    }

    // Email sign-in: two steps. First the reader asks for a code; then
    // they type the 6-digit code the site sent them. The address stays
    // in the box between steps — it is never stored in the browser.
    function requestEmailCode() {
      var email = emailField ? emailField.value.trim() : "";
      if (!email || email.indexOf("@") < 1) {
        if (emailNote) emailNote.textContent = "Please give a real email address.";
        return;
      }
      if (emailSendButton) emailSendButton.disabled = true;
      if (emailNote) emailNote.textContent = "Sending your code…";
      fetch("/api/interview/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (emailSendButton) emailSendButton.disabled = false;
          if (data.ok) {
            if (emailCodeRow) emailCodeRow.hidden = false;
            if (emailNote) emailNote.textContent = "Your code is on its way — check your inbox (and the spam folder, just in case). It expires in 10 minutes.";
            if (emailCodeField) emailCodeField.focus();
          } else {
            if (emailNote) emailNote.textContent = data.error || "That code did not send — please try again in a minute.";
          }
        })
        .catch(function () {
          if (emailSendButton) emailSendButton.disabled = false;
          if (emailNote) emailNote.textContent = "That code did not send — please try again in a minute.";
        });
    }

    function verifyEmailCode() {
      var email = emailField ? emailField.value.trim() : "";
      var code = emailCodeField ? emailCodeField.value.trim() : "";
      if (!email || code.length !== 6) {
        if (emailNote) emailNote.textContent = "Type the 6-digit code from the email.";
        return;
      }
      if (emailVerifyButton) emailVerifyButton.disabled = true;
      if (emailNote) emailNote.textContent = "Checking your code…";
      fetch("/api/interview/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, code: code }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (emailVerifyButton) emailVerifyButton.disabled = false;
          if (data.ok) {
            if (emailNote) emailNote.textContent = "";
            refreshMe();
          } else {
            if (emailNote) emailNote.textContent = data.error || "That code did not check out — please try again.";
          }
        })
        .catch(function () {
          if (emailVerifyButton) emailVerifyButton.disabled = false;
          if (emailNote) emailNote.textContent = "That code did not check out — please try again.";
        });
    }

    if (emailSendButton) emailSendButton.addEventListener("click", requestEmailCode);
    if (emailVerifyButton) emailVerifyButton.addEventListener("click", verifyEmailCode);
    if (emailCodeField) {
      emailCodeField.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          verifyEmailCode();
        }
      });
    }

    function refreshMe() {
      fetch("/api/interview/me")
        .then(function (r) { return r.json(); })
        .then(function (me) {
          if (!me.instagramConfigured && igButton) {
            igButton.style.display = "none";
            if (igNote) igNote.textContent = "Instagram sign-in is being set up — check back soon, or sign in with Google below.";
          }
          if (!me.emailConfigured && emailBox) {
            // Hide the inputs but keep the box and its note visible, so
            // the reader sees why email sign-in is not there.
            if (emailField && emailField.parentElement) emailField.parentElement.hidden = true;
            if (emailCodeRow) emailCodeRow.hidden = true;
            if (emailNote) emailNote.textContent = "Email sign-in is being set up — check back soon, or sign in with Google or Instagram above.";
          }
          applySignedIn(me);
          if (!me.signedIn) loadGoogleButton();
        })
        .catch(function () {
          loadGoogleButton();
        });
    }

    // Sign-in result from the Instagram redirect.
    var params = new URLSearchParams(window.location.search);
    if (params.get("signedin") === "instagram" && signinStatus) {
      signinStatus.textContent = "Signed in with Instagram — thank you. Now tell your story below.";
    }
    if (params.get("signin") === "failed" && signinStatus) {
      signinStatus.textContent = "That sign-in did not go through — please try again, or sign in with Google.";
    }

    refreshMe();

    interviewForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!signedIn || !signedIn.signedIn) {
        interviewResult.textContent = "Please sign in first — that is how the site knows the account is really yours.";
        return;
      }
      var qIds = [["interview-q1", "interview-q1-details"], ["interview-q2", "interview-q2-details"], ["interview-q3", "interview-q3-details"]];
      for (var i = 0; i < qIds.length; i++) {
        var field = document.getElementById(qIds[i][0]);
        var details = document.getElementById(qIds[i][1]);
        if (field.value.trim().length < 10) {
          if (details) details.open = true;
          field.focus();
          interviewResult.textContent = "Please answer all three questions — a few sentences each is plenty.";
          return;
        }
      }
      var permission = document.getElementById("interview-permission").checked;
      if (!nameField.value.trim() || !socialField.value.trim() || !permission) {
        interviewResult.textContent = "Please fill in your name, your social profile, and tick the permission box.";
        return;
      }
      interviewButton.disabled = true;
      interviewResult.textContent = "Sending your story…";
      fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameField.value.trim(),
          social: socialField.value.trim(),
          social2: document.getElementById("interview-social2").value.trim(),
          q1: document.getElementById("interview-q1").value.trim(),
          q2: document.getElementById("interview-q2").value.trim(),
          q3: document.getElementById("interview-q3").value.trim(),
          permission: permission,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          interviewButton.disabled = false;
          if (data.ok) {
            // Sent. Now: copy the reply for them, and open the
            // Instagram DM so they can paste it in. A website cannot
            // send an Instagram DM itself — the person still taps
            // send in Instagram. The auto-open may be blocked by the
            // browser (the submit happened a moment ago), so the
            // button below always opens it in one tap as well.
            var donePanel = document.getElementById("interview-done");
            var doneCopy = document.getElementById("interview-done-copy");
            var doneCopyButton = document.getElementById("interview-done-copy-button");
            var doneCopyResult = document.getElementById("interview-done-copy-result");
            var doneNote = document.getElementById("interview-done-note");
            updateCopy();
            var text = copyArea.value;
            if (doneCopy) doneCopy.value = text;
            interviewForm.hidden = true;
            if (donePanel) donePanel.hidden = false;
            copyReplyText(text, doneCopy || copyArea, function () {
              if (doneCopyResult) doneCopyResult.textContent = "Copied — your full reply is on the clipboard.";
            });
            var dm = null;
            try { dm = window.open("https://ig.me/m/jonamccallum", "_blank"); } catch (e) {}
            if (doneNote) {
              doneNote.textContent = dm
                ? "The message to Jonathan should have opened in a new tab — just paste your reply in and send it."
                : "Tap the button above to open the message to Jonathan, then paste your reply in and send it.";
            }
            if (doneCopyButton) {
              doneCopyButton.addEventListener("click", function () {
                copyReplyText(doneCopy.value, doneCopy, function () {
                  if (doneCopyResult) doneCopyResult.textContent = "Copied — your full reply is on the clipboard.";
                });
              });
            }
            if (donePanel) donePanel.scrollIntoView();
          } else if (data.error) {
            interviewResult.textContent = data.error;
          } else {
            interviewResult.textContent = "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
          }
        })
        .catch(function () {
          interviewButton.disabled = false;
          interviewResult.textContent = "That did not go through — the quickest way to reach Jonathan is a message on Instagram or Threads.";
        });
    });
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootAsk);
} else {
  bootAsk();
}
