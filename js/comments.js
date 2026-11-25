// Comments under each article: sign in, read and post.
//
// Sign-in is the same interview session the interview form uses
// (Google, Instagram, LINE, or email). If the reader is already
// signed in, they can post straight away — no Google token needed.
// Otherwise the Google sign-in button is shown, plus a line pointing
// to the email option on /share-your-story/.
//
// The section carries everything this script needs as data attributes:
// the post slug, the language, the API base (empty = same origin), and
// the Google OAuth client id (empty = sign-in not set up yet; the list
// still shows). The ID token is kept in memory only, never in storage.
// The session stays in its HttpOnly cookie; no email address, session
// id, or token is ever stored in localStorage.
//
// Comments render as plain text — no HTML from readers is ever inserted.
// A comment with a video gets the same tap-to-load facade the articles
// use (same classes, so the click handler in main.js swaps it for the
// youtube-nocookie iframe only when the reader taps play).
(function () {
  var section = document.querySelector("[data-comments]");
  if (!section) return;

  var post = section.getAttribute("data-comments-post") || "";
  var lang = section.getAttribute("data-comments-lang") || "en";
  var apiBase = section.getAttribute("data-comments-api") || "";
  var clientId = section.getAttribute("data-comments-client-id") || "";
  var thread = lang + ":" + post;

  var list = document.getElementById("comments-list");
  var note = document.getElementById("comments-note");
  var signinBox = document.getElementById("comments-signin");
  var form = document.getElementById("comments-form");
  var asLine = document.getElementById("comments-as");
  var textField = document.getElementById("comments-text");
  var socialField = document.getElementById("comments-social");
  var videoField = document.getElementById("comments-video");
  var result = document.getElementById("comments-result");
  var token = null;
  var myName = "";
  // True when the reader is signed in via the interview session
  // (Google, Instagram, LINE, or email) — they can post without a
  // Google token, and the Worker reads the session cookie.
  var sessionSignedIn = false;

  function api(path) {
    return apiBase + path;
  }

  function say(msg) {
    if (result) result.textContent = msg;
  }

  // Plain-text rendering: text nodes only, line breaks as <br>.
  function textEl(text) {
    var span = document.createElement("span");
    var lines = String(text || "").split("\n");
    lines.forEach(function (line, i) {
      if (i) span.appendChild(document.createElement("br"));
      span.appendChild(document.createTextNode(line));
    });
    return span;
  }

  function timeEl(iso) {
    var time = document.createElement("time");
    time.setAttribute("datetime", iso || "");
    var d = new Date(iso || "");
    time.textContent = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    return time;
  }

  function facadeEl(videoId) {
    var holder = document.createElement("div");
    holder.className = "video-facade";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "video-facade__button";
    button.setAttribute("data-video-id", videoId);
    button.setAttribute("aria-label", "Play video on YouTube");
    var img = document.createElement("img");
    img.className = "video-facade__thumb";
    img.src = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
    img.alt = "";
    img.loading = "lazy";
    img.width = 480;
    img.height = 360;
    var play = document.createElement("span");
    play.className = "video-facade__play";
    play.setAttribute("aria-hidden", "true");
    play.textContent = "\u25b6";
    button.appendChild(img);
    button.appendChild(play);
    holder.appendChild(button);
    return holder;
  }

  function render(comments) {
    list.textContent = "";
    if (!comments.length) {
      var empty = document.createElement("li");
      empty.className = "comments-empty";
      empty.textContent = "No comments yet — be the first.";
      list.appendChild(empty);
      return;
    }
    comments.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "comment" + (c.kind === "update" ? " comment--update" : "") + (c.pending ? " comment--pending" : "");

      if (c.kind === "update") {
        var updateLabel = document.createElement("p");
        updateLabel.className = "comment__update-label";
        updateLabel.textContent = "Update from Jonathan's social media";
        li.appendChild(updateLabel);
      }

      var head = document.createElement("div");
      head.className = "comment__head";
      if (c.avatar) {
        var img = document.createElement("img");
        img.className = "comment__avatar";
        img.src = c.avatar;
        img.alt = "";
        img.loading = "lazy";
        img.setAttribute("referrerpolicy", "no-referrer");
        head.appendChild(img);
      } else {
        var initial = document.createElement("span");
        initial.className = "comment__avatar comment__avatar--initial";
        initial.textContent = (c.name || "?").slice(0, 1);
        head.appendChild(initial);
      }
      var name = document.createElement("span");
      name.className = "comment__name";
      name.textContent = c.name || "A reader";
      head.appendChild(name);
      if (c.social) {
        var social = document.createElement("a");
        social.className = "comment__social";
        social.href = c.social;
        social.target = "_blank";
        social.rel = "noopener";
        social.textContent = "on " + (c.socialLabel || "social media");
        head.appendChild(social);
      }
      if (c.author) {
        var badge = document.createElement("span");
        badge.className = "comment__author";
        badge.textContent = "Author";
        head.appendChild(badge);
      }
      head.appendChild(timeEl(c.at));
      li.appendChild(head);

      var body = document.createElement("p");
      body.className = "comment__text";
      body.appendChild(textEl(c.text));
      li.appendChild(body);

      if (c.kind === "update" && c.source) {
        var source = document.createElement("p");
        source.className = "comment__source";
        var sourceLink = document.createElement("a");
        sourceLink.href = c.source;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener";
        sourceLink.textContent = "See the post on " + (c.sourceLabel || "social media");
        source.appendChild(sourceLink);
        li.appendChild(source);
      }

      if (c.videoId) {
        var videoWrap = document.createElement("div");
        videoWrap.className = "comment__video";
        videoWrap.appendChild(facadeEl(c.videoId));
        li.appendChild(videoWrap);
      }

      if (c.pending) {
        var waiting = document.createElement("p");
        waiting.className = "comment__waiting";
        waiting.textContent = "Waiting for approval — only you can see this.";
        li.appendChild(waiting);
      }

      if (c.canApprove) {
        var approve = document.createElement("button");
        approve.type = "button";
        approve.className = "comment__approve";
        approve.textContent = "Approve";
        approve.addEventListener("click", function () {
          approveComment(c.id);
        });
        li.appendChild(approve);
      }

      if (c.canDelete) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "comment__delete";
        del.textContent = "Delete";
        del.addEventListener("click", function () {
          deleteComment(c.id);
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    });
  }

  function load() {
    var headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(api("/api/comments?post=" + encodeURIComponent(thread)), { headers: headers })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        render(data.comments || []);
      })
      .catch(function () {
        if (!list.children.length) {
          var li = document.createElement("li");
          li.className = "comments-empty";
          li.textContent = "Comments did not load — please try again later.";
          list.appendChild(li);
        }
      });
  }

  function deleteComment(id) {
    if (!token) return;
    fetch(api("/api/comment?id=" + encodeURIComponent(id)), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        load();
      })
      .catch(function (err) { say(err.message || "That comment could not be deleted."); });
  }

  function approveComment(id) {
    if (!token) return;
    fetch(api("/api/comment/approve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: token, id: id }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        load();
      })
      .catch(function (err) { say(err.message || "That comment could not be approved."); });
  }

  function decodePayload(jwt) {
    try {
      var payload = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch (e) {
      return {};
    }
  }

  function onSignedIn(response) {
    token = response.credential;
    var payload = decodePayload(token);
    myName = payload.name || "You";
    if (note) note.textContent = "Signed in — comments show your real name and photo.";
    if (signinBox) signinBox.textContent = "";
    if (asLine) asLine.textContent = "Commenting as " + myName + ".";
    if (form) form.hidden = false;
    load();
  }

  function startSignIn() {
    // Already signed in via the interview session (Google, Instagram,
    // LINE, or email)? Then no Google button is needed — the reader
    // can post straight away, and the Worker reads the session cookie.
    fetch("/api/interview/me")
      .then(function (res) { return res.json(); })
      .then(function (me) {
        if (me && me.signedIn) {
          sessionSignedIn = true;
          // "Signed in with email" when an email session has no name.
          myName = me.name || (me.provider === "email" ? "Signed in with email" : "You");
          if (note) note.textContent = "Signed in — comments show your real name.";
          if (signinBox) signinBox.textContent = "";
          if (asLine) asLine.textContent = "Commenting as " + myName + ".";
          if (form) form.hidden = false;
          return;
        }
        showGoogleOrEmail();
      })
      .catch(function () { showGoogleOrEmail(); });
  }

  function googleConsent() {
    if (window.JMConsent && window.JMConsent.choice) return window.JMConsent.choice();
    try { return localStorage.getItem("cookie-consent"); } catch (e) { return null; }
  }

  function showGoogleOrEmail() {
    // Not signed in by any method: the Google button, plus a line
    // pointing to the email option on /share-your-story/.
    if (note) {
      note.textContent = "Sign in to comment — with Google below, or with email on the Share your story page (a code is sent to your address).";
    }
    if (!clientId) {
      if (note) note.textContent = "Comments open soon — sign-in with Google is being set up.";
      return;
    }
    // Google's sign-in button loads a script from accounts.google.com
    // and Google may set its own cookies, so it only loads after the
    // visitor accepts cookies (same rule as the interview form in
    // js/ask.js, and as the privacy page promises). Instagram, LINE
    // and email sign-in load nothing from a third party, so they work
    // either way — the note points at them instead.
    if (googleConsent() !== "accepted") {
      if (note) note.textContent = "Google sign-in needs cookies — accept cookies to use it, or sign in with Instagram, LINE or email on the Share your story page. You can change your mind with “Cookie settings” at the bottom of the page.";
      return;
    }
    if (window.google && window.google.accounts && window.google.accounts.id) {
      showButton();
      return;
    }
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = showButton;
    s.onerror = function () {
      if (note) note.textContent = "Sign-in did not load — check the connection and try again.";
    };
    document.head.appendChild(s);
  }

  function showButton() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
    if (signinBox && signinBox.children.length) return; // already rendered
    window.google.accounts.id.initialize({ client_id: clientId, callback: onSignedIn });
    if (signinBox) {
      window.google.accounts.id.renderButton(signinBox, { theme: "outline", size: "large" });
    }
  }

  // If the visitor accepts cookies later, load the Google button then
  // (same pattern as the interview form in js/ask.js).
  window.addEventListener("cookie-consent", function (e) {
    if (e.detail !== "accepted") return;
    if (token || sessionSignedIn) return; // already signed in
    if (signinBox && signinBox.children.length) return; // button already there
    if (form && !form.hidden) return; // form already showing
    showGoogleOrEmail();
  });

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!token && !sessionSignedIn) {
        say("Sign in first — with Google, Instagram, LINE, or email — so the site knows the comment is really yours.");
        return;
      }
      var text = textField.value.trim();
      var social = socialField ? socialField.value.trim() : "";
      var video = videoField.value.trim();
      if (!text) {
        say("Write a comment first.");
        return;
      }
      say("Posting…");
      // A Google token goes in the body when there is one; otherwise
      // the Worker reads the interview session cookie.
      var payload = { post: thread, text: text, social: social, video: video };
      if (token) payload.credential = token;
      fetch(api("/api/comment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          textField.value = "";
          if (socialField) socialField.value = "";
          videoField.value = "";
          say(data.comment && data.comment.status === "pending"
            ? "Posted — it will show here once Jonathan has had a look at it."
            : "Posted — thank you.");
          load();
        })
        .catch(function (err) { say(err.message || "That comment did not post — please try again."); });
    });
  }

  load();
  startSignIn();
})();
