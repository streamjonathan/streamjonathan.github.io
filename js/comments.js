// Comments under each article: sign in with Google, read and post.
//
// The section carries everything this script needs as data attributes:
// the post slug, the language, the API base (empty = same origin), and
// the Google OAuth client id (empty = sign-in not set up yet; the list
// still shows). The ID token is kept in memory only, never in storage.
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
  var videoField = document.getElementById("comments-video");
  var result = document.getElementById("comments-result");
  var token = null;
  var myName = "";

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
      li.className = "comment";

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

      if (c.videoId) {
        var videoWrap = document.createElement("div");
        videoWrap.className = "comment__video";
        videoWrap.appendChild(facadeEl(c.videoId));
        li.appendChild(videoWrap);
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
    if (!clientId) {
      if (note) note.textContent = "Comments open soon — sign-in with Google is being set up.";
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
    window.google.accounts.id.initialize({ client_id: clientId, callback: onSignedIn });
    if (signinBox) {
      window.google.accounts.id.renderButton(signinBox, { theme: "outline", size: "large" });
    }
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!token) {
        say("Sign in with Google first.");
        return;
      }
      var text = textField.value.trim();
      var video = videoField.value.trim();
      if (!text) {
        say("Write a comment first.");
        return;
      }
      say("Posting…");
      fetch(api("/api/comment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: token, post: thread, text: text, video: video }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          textField.value = "";
          videoField.value = "";
          say("Posted — thank you.");
          load();
        })
        .catch(function (err) { say(err.message || "That comment did not post — please try again."); });
    });
  }

  load();
  startSignIn();
})();
