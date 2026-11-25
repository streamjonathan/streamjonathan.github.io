// Family tree — language toggle, expandable person cards, the
// "trace my line" animation (v2), the Tahiti expand control (v3) and
// the ancestor search (v3). The search reads the tree data embedded in
// the page (no hard-coded list) and works out, from the parent links,
// how the person found is related to Jonathan, in French and English.
// Reduced-motion readers get everything lit at once, with no animation.
(function () {
  var root = document.getElementById("family-tree");
  if (!root) return;

  var dataEl = document.getElementById("family-tree-data");
  var DATA = null;
  try {
    DATA = dataEl ? JSON.parse(dataEl.textContent) : null;
  } catch (e) {
    DATA = null;
  }
  var PEOPLE = (DATA && DATA.people) || {};

  function personName(p, lang) {
    if (!p) return "";
    if (typeof p.name === "string") return p.name;
    return (p.name && (p.name[lang] || p.name.en)) || "";
  }

  function personLine(p, lang) {
    if (!p || !p.line) return "";
    return typeof p.line === "string" ? p.line : p.line[lang] || p.line.en || "";
  }

  function personStatus(p) {
    return (p && p.status) || "";
  }

  // Language toggle — French first, the choice remembered.
  var STORAGE_KEY = "family-tree-lang";
  var langButtons = root.querySelectorAll("[data-tree-lang-btn]");
  var searchInput = document.getElementById("ancestor-search-input");

  function setLang(lang) {
    root.setAttribute("data-tree-lang", lang);
    Array.prototype.forEach.call(langButtons, function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-tree-lang-btn") === lang ? "true" : "false"
      );
    });
    if (searchInput) {
      searchInput.setAttribute(
        "placeholder",
        searchInput.getAttribute("data-placeholder-" + lang) ||
          searchInput.getAttribute("placeholder")
      );
    }
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }

  function currentLang() {
    return root.getAttribute("data-tree-lang") || "fr";
  }

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") setLang(saved);
  } catch (e) {}

  Array.prototype.forEach.call(langButtons, function (b) {
    b.addEventListener("click", function () {
      setLang(b.getAttribute("data-tree-lang-btn"));
    });
  });

  // Tap a person's card to open or close their detail.
  Array.prototype.forEach.call(
    root.querySelectorAll(".person__head"),
    function (btn) {
      btn.addEventListener("click", function () {
        var detail = document.getElementById(
          btn.getAttribute("aria-controls")
        );
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (detail) detail.hidden = open;
      });
    }
  );

  // Trace the line: every lit element carries a data-step, lowest
  // (Jonathan) first, highest (John and Susannah) last. Elements that
  // share a step — the couple — light together.
  var steps = Array.prototype.slice.call(
    root.querySelectorAll("[data-step]")
  );
  steps.sort(function (a, b) {
    return (
      parseInt(a.getAttribute("data-step"), 10) -
      parseInt(b.getAttribute("data-step"), 10)
    );
  });

  var reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var timers = [];

  function trace() {
    timers.forEach(clearTimeout);
    timers = [];
    steps.forEach(function (el) {
      el.classList.remove("is-lit");
    });
    if (reduced) {
      steps.forEach(function (el) {
        el.classList.add("is-lit");
      });
      return;
    }
    if (steps.length) {
      steps[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
    steps.forEach(function (el, i) {
      timers.push(
        setTimeout(function () {
          el.classList.add("is-lit");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 400 + i * 500)
      );
    });
  }

  var traceBtn = document.getElementById("trace-line");
  if (traceBtn) traceBtn.addEventListener("click", trace);

  // The Tahiti control: open every Tahitian generation group, light
  // John and Susannah and the Tahiti branch with the same gold glow as
  // the trace, and scroll to it. Reduced motion: same, all at once.
  var tahitiBtn = document.getElementById("tahiti-expand");
  var tahitiSection = document.getElementById("tahiti-descendants");
  function expandTahiti() {
    if (!tahitiSection) return;
    Array.prototype.forEach.call(
      tahitiSection.querySelectorAll("details.tahiti-subgroup"),
      function (d) {
        d.open = true;
      }
    );
    // Light John and Susannah (the couple above the Tahiti section)
    // and every Tahiti group, so the whole branch glows at once.
    var couple = root.querySelector(
      '.family-tree__couple [data-person="john"]'
    );
    if (couple && couple.parentElement) {
      couple.parentElement.classList.add("is-lit");
    }
    ["john", "susannah"].forEach(function (id) {
      var card = root.querySelector('[data-person="' + id + '"]');
      if (card) card.classList.add("is-lit");
    });
    Array.prototype.forEach.call(
      tahitiSection.querySelectorAll(".tahiti-group"),
      function (g) {
        g.classList.add("is-lit");
      }
    );
    tahitiSection.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }
  if (tahitiBtn) tahitiBtn.addEventListener("click", expandTahiti);

  trace();

  // ---------------------------------------------------------- ancestor search
  if (!DATA) return;

  var matchesBox = document.getElementById("ancestor-search-matches");
  var resultBox = document.getElementById("ancestor-search-result");
  var SEARCH = DATA.search || {};
  function searchText(key, lang) {
    var v = SEARCH[key];
    if (!v) return "";
    return typeof v === "string" ? v : v[lang] || v.en || "";
  }

  function norm(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’`]/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Every query word must appear in the person's name. Accents and
  // case do not matter; "hunter" matches a family name, "thomas
  // hunter" a full name.
  function findMatches(q) {
    var tokens = norm(q).split(" ").filter(Boolean);
    if (!tokens.length) return [];
    var out = [];
    Object.keys(PEOPLE).forEach(function (id) {
      var p = PEOPLE[id];
      if (p.status === "private") return;
      var name = norm(personName(p, "en") + " " + personName(p, "fr"));
      var ok = tokens.every(function (t) {
        return name.indexOf(t) !== -1;
      });
      if (ok) out.push(id);
    });
    return out;
  }

  // Ancestor map: id -> distance (steps up through parent links).
  function ancestorDist(id) {
    var dist = {};
    var queue = [{ id: id, d: 0 }];
    dist[id] = 0;
    while (queue.length) {
      var cur = queue.shift();
      var p = PEOPLE[cur.id];
      if (!p || !p.parents) continue;
      p.parents.forEach(function (par) {
        if (dist[par] === undefined && PEOPLE[par]) {
          dist[par] = cur.d + 1;
          queue.push({ id: par, d: cur.d + 1 });
        }
      });
    }
    return dist;
  }

  var JONATHAN = "jonathan";
  var jonDist = ancestorDist(JONATHAN);

  // The shared ancestor closest to both people, with the two distances.
  function sharedAncestor(id) {
    var mine = ancestorDist(id);
    var best = null;
    Object.keys(mine).forEach(function (a) {
      if (jonDist[a] === undefined) return;
      var total = mine[a] + jonDist[a];
      if (!best || total < best.total) {
        best = { ancestor: a, dP: mine[a], dJ: jonDist[a] };
      }
    });
    return best;
  }

  // Path of ids from person P up to A, then down from A to Jonathan.
  function pathChain(id, a) {
    var up = [id];
    var cur = id;
    while (cur !== a) {
      var p = PEOPLE[cur];
      if (!p || !p.parents) break;
      // Follow the parent that leads to A (shortest distance).
      var next = null;
      var best = Infinity;
      p.parents.forEach(function (par) {
        var d = ancestorDist(par)[a];
        if (d !== undefined && d < best) {
          best = d;
          next = par;
        }
      });
      if (!next) break;
      up.push(next);
      cur = next;
    }
    var down = [];
    cur = JONATHAN;
    var seen = {};
    while (cur !== a && !seen[cur]) {
      seen[cur] = true;
      down.unshift(cur);
      var p2 = PEOPLE[cur];
      if (!p2 || !p2.parents) break;
      var next2 = null;
      var best2 = Infinity;
      p2.parents.forEach(function (par) {
        var d2 = ancestorDist(par)[a];
        if (d2 !== undefined && d2 < best2) {
          best2 = d2;
          next2 = par;
        }
      });
      if (!next2) break;
      cur = next2;
    }
    return up.concat(down);
  }

  var ORDINAL_EN = [
    "first", "second", "third", "fourth", "fifth",
    "sixth", "seventh", "eighth", "ninth", "tenth",
  ];
  var ORDINAL_FR = [
    "premier", "deuxième", "troisième", "quatrième", "cinquième",
    "sixième", "septième", "huitième", "neuvième", "dixième",
  ];
  function ordinal(n, lang) {
    var list = lang === "fr" ? ORDINAL_FR : ORDINAL_EN;
    return list[n - 1] || (lang === "fr" ? n + "e" : n + "th");
  }
  function greats(n, lang, word) {
    // word: "grandfather"/"grandmother"/"uncle"/"aunt" base already
    // includes "grand-"; n = number of "great"s.
    if (lang === "fr") {
      var prefix = "";
      for (var i = 0; i < n; i++) prefix += "arrière-";
      return prefix + word;
    }
    var g = "";
    for (var j = 0; j < n; j++) g += "great-";
    return g + word;
  }

  function frArticle(nounFr, female) {
    if (/^[aeiouàâéèê]/i.test(nounFr)) return "l'";
    return female ? "la " : "le ";
  }

  // Kinship of person P to Jonathan, in both languages.
  // Returns { en, fr } or null when no blood link is found.
  function kinship(id) {
    var p = PEOPLE[id];
    if (!p) return null;
    if (id === JONATHAN) {
      return {
        en: "That is Jonathan himself.",
        fr: "C'est Jonathan lui-même.",
      };
    }
    // A spouse is described through their partner.
    if (p.partnerOf && PEOPLE[p.partnerOf]) {
      var partnerKin = kinship(p.partnerOf);
      if (!partnerKin) return null;
      var partner = PEOPLE[p.partnerOf];
      var pname = personName(partner, "en");
      var wife = p.sex === "f";
      return {
        en:
          personName(p, "en") +
          " is the " +
          (wife ? "wife" : "husband") +
          " of " +
          pname +
          ", who is Jonathan's " +
          partnerKin.nounEn +
          ".",
        fr:
          personName(p, "fr") +
          " est " +
          (wife ? "la femme" : "le mari") +
          " de " +
          personName(partner, "fr") +
          ", qui est " +
          frArticle(partnerKin.nounFr, partnerKin.fem) +
          partnerKin.nounFr +
          " de Jonathan.",
        nounEn: "",
        nounFr: "",
        fem: wife,
        shared: partnerKin.shared,
        spouseOf: p.partnerOf,
      };
    }
    var s = sharedAncestor(id);
    if (!s) return null;
    var dP = s.dP;
    var dJ = s.dJ;
    var female = p.sex === "f";
    var nounEn = "";
    var nounFr = "";
    if (dP === 0) {
      // P is an ancestor of Jonathan.
      if (dJ === 1) {
        nounEn = female ? "mother" : "father";
        nounFr = female ? "mère" : "père";
      } else if (dJ === 2) {
        nounEn = female ? "grandmother" : "grandfather";
        nounFr = female ? "grand-mère" : "grand-père";
      } else {
        nounEn = greats(dJ - 2, "en", female ? "grandmother" : "grandfather");
        nounFr = greats(dJ - 2, "fr", female ? "grand-mère" : "grand-père");
      }
    } else if (dJ === 0) {
      // P is a descendant of Jonathan (does not happen today).
      if (dP === 1) {
        nounEn = female ? "daughter" : "son";
        nounFr = female ? "fille" : "fils";
      } else if (dP === 2) {
        nounEn = female ? "granddaughter" : "grandson";
        nounFr = female ? "petite-fille" : "petit-fils";
      } else {
        nounEn = greats(dP - 2, "en", female ? "granddaughter" : "grandson");
        nounFr = greats(dP - 2, "fr", female ? "petite-fille" : "petit-fils");
      }
    } else if (dP === 1) {
      // P is the sibling of one of Jonathan's ancestors.
      if (dJ === 1) {
        nounEn = female ? "sister" : "brother";
        nounFr = female ? "sœur" : "frère";
      } else if (dJ === 2) {
        nounEn = female ? "aunt" : "uncle";
        nounFr = female ? "tante" : "oncle";
      } else {
        // Sibling of a grandparent is a great-uncle; sibling of a
        // great-grandparent is a great-great-uncle, and so on.
        nounEn = greats(dJ - 3, "en", female ? "aunt" : "uncle");
        nounFr = greats(
          dJ - 3,
          "fr",
          "grand-" + (female ? "tante" : "oncle")
        );
      }
    } else {
      // Cousins: degree = min-1, removed = |dP - dJ|.
      var degree = Math.min(dP, dJ) - 1;
      var removed = Math.abs(dP - dJ);
      var NUM_WORDS = [
        "zero", "one", "two", "three", "four", "five",
        "six", "seven", "eight", "nine", "ten",
      ];
      nounEn = ordinal(degree, "en") + " cousin";
      if (removed === 1) nounEn += " once removed";
      else if (removed === 2) nounEn += " twice removed";
      else if (removed > 2)
        nounEn +=
          " " + (NUM_WORDS[removed] || removed) + " times removed";
      if (degree === 1) {
        nounFr = "cousin germain";
        if (female) nounFr = "cousine germaine";
      } else {
        nounFr =
          "cousin au " + ordinal(degree, "fr") + " degré";
        if (female) nounFr = "cousine au " + ordinal(degree, "fr") + " degré";
      }
      if (removed > 0) {
        nounFr +=
          ", décalé de " + removed + " génération" + (removed > 1 ? "s" : "");
      }
    }
    return {
      en:
        "Your ancestor " +
        personName(p, "en") +
        " is Jonathan's " +
        nounEn +
        ". That makes you his cousin.",
      fr:
        "Votre ancêtre " +
        personName(p, "fr") +
        " est " +
        frArticle(nounFr, female) +
        nounFr +
        " de Jonathan. Vous êtes donc son cousin.",
      nounEn: nounEn,
      nounFr: nounFr,
      fem: female,
      shared: s,
    };
  }

  function worstStatusOnPath(chain) {
    var worst = "";
    chain.forEach(function (id) {
      var st = personStatus(PEOPLE[id]);
      if (st === "verifying") worst = "verifying";
      else if (st === "probable" && worst !== "verifying") worst = "probable";
    });
    return worst;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function contactLinkHtml() {
    // The address is built here, as in js/contact.js, so it never
    // sits in the page source as plain text.
    var address = "sayhi" + "@" + "jonathanmccallum.com";
    return (
      '<a href="mailto:' +
      address +
      '">' +
      esc(searchText("writeTo", "en")) +
      "</a> · " +
      '<a href="/contact-jonathan/">' +
      '<span class="lang-fr">Page de contact</span>' +
      '<span class="lang-en">Contact page</span></a>'
    );
  }

  function showResult(id) {
    var p = PEOPLE[id];
    if (!p || !resultBox) return;
    var k = kinship(id);
    if (!k) {
      resultBox.hidden = false;
      resultBox.innerHTML =
        "<p><span class=\"lang-fr\">" +
        esc(searchText("noMatch", "fr")) +
        "</span><span class=\"lang-en\">" +
        esc(searchText("noMatch", "en")) +
        "</span></p><p>" +
        contactLinkHtml() +
        "</p>";
      return;
    }
    var chain = [];
    var note = "";
    if (k.shared) {
      chain = k.spouseOf
        ? [id].concat(pathChain(k.spouseOf, k.shared.ancestor))
        : pathChain(id, k.shared.ancestor);
      var worst = worstStatusOnPath(chain);
      if (worst === "verifying") {
        note =
          '<p class="ancestor-result__note"><span class="lang-fr">' +
          esc(searchText("verifyingNote", "fr")) +
          '</span><span class="lang-en">' +
          esc(searchText("verifyingNote", "en")) +
          "</span></p>";
      } else if (worst === "probable") {
        note =
          '<p class="ancestor-result__note"><span class="lang-fr">' +
          esc(searchText("probableNote", "fr")) +
          '</span><span class="lang-en">' +
          esc(searchText("probableNote", "en")) +
          "</span></p>";
      }
    }
    var chainHtml = chain
      .map(function (cid) {
        return esc(personName(PEOPLE[cid], currentLang()));
      })
      .join(" → ");
    resultBox.hidden = false;
    resultBox.innerHTML =
      '<p class="ancestor-result__sentence"><span class="lang-fr">' +
      esc(k.fr) +
      '</span><span class="lang-en">' +
      esc(k.en) +
      "</span></p>" +
      (chainHtml
        ? '<p class="ancestor-result__chain">' + chainHtml + "</p>"
        : "") +
      note +
      '<p class="ancestor-result__contact">' +
      contactLinkHtml() +
      "</p>";
    resultBox.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
    });
  }

  function showMatches(ids, q) {
    if (!matchesBox) return;
    if (!ids.length) {
      matchesBox.hidden = false;
      matchesBox.innerHTML =
        "<p><span class=\"lang-fr\">" +
        esc(searchText("noMatch", "fr")) +
        "</span><span class=\"lang-en\">" +
        esc(searchText("noMatch", "en")) +
        "</span></p><p>" +
        contactLinkHtml() +
        "</p>";
      if (resultBox) resultBox.hidden = true;
      return;
    }
    // An exact full-name match wins outright — "Thomas Hunter" goes
    // straight to Thomas Hunter, not to a list of every Thomas.
    var qn = norm(q || "");
    var exact = ids.filter(function (mid) {
      var mp = PEOPLE[mid];
      return (
        norm(personName(mp, "en")) === qn || norm(personName(mp, "fr")) === qn
      );
    });
    if (exact.length === 1) {
      matchesBox.hidden = true;
      showResult(exact[0]);
      return;
    }
    if (ids.length === 1) {
      matchesBox.hidden = true;
      showResult(ids[0]);
      return;
    }
    var shown = ids.slice(0, 20);
    var html =
      "<p><span class=\"lang-fr\">" +
      esc(searchText("choose", "fr")) +
      "</span><span class=\"lang-en\">" +
      esc(searchText("choose", "en")) +
      "</span></p><ul>";
    shown.forEach(function (mid) {
      var mp = PEOPLE[mid];
      html +=
        '<li><button type="button" class="ancestor-match" data-match="' +
        esc(mid) +
        '">' +
        esc(personName(mp, "en")) +
        " — " +
        esc(personLine(mp, "en")) +
        "</button></li>";
    });
    html += "</ul>";
    if (ids.length > 20) {
      html += "<p>…</p>";
    }
    matchesBox.hidden = false;
    matchesBox.innerHTML = html;
    if (resultBox) resultBox.hidden = true;
  }

  var debounce = null;
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(function () {
        var q = searchInput.value;
        if (!q.trim()) {
          if (matchesBox) matchesBox.hidden = true;
          if (resultBox) resultBox.hidden = true;
          return;
        }
        showMatches(findMatches(q), q);
      }, 150);
    });
  }

  // Picking a match, or tapping a name in the Tahiti groups, shows
  // the relationship.
  document.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute) {
        var mid = t.getAttribute("data-match");
        if (mid) {
          if (matchesBox) matchesBox.hidden = true;
          showResult(mid);
          return;
        }
        var ref = t.getAttribute("data-person-ref");
        if (ref) {
          showResult(ref);
          return;
        }
      }
      t = t.parentElement;
    }
  });
})();
