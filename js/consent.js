// Cookie consent: one small choice, remembered on this device.
//
// The law (ePrivacy Directive Art. 5(3), applied in Spain by LSSI
// Art. 22.2) says the site must ask before it stores anything on the
// visitor's device that is not strictly necessary — and the visitor
// must be able to say no as easily as yes. So the banner has two
// buttons, Accept and Reject, side by side, with no colour trick.
//
// What counts as strictly necessary here, and so needs no consent:
// the sign-in session cookie (interview_session, 1 hour), the theme
// choice, and this consent choice itself. Everything else the site
// loads on its own is same-origin and sets nothing.
//
// The one non-essential thing is Google's sign-in button: it loads a
// script from accounts.google.com, and Google may set its own cookies.
// It only loads after the visitor accepts. Instagram, LINE and email
// sign-in do not load any third-party script, so they work either way.
//
// Choice is stored in localStorage as "cookie-consent": "accepted" or
// "rejected". Other scripts read it through window.JMConsent.choice()
// and listen for the "cookie-consent" event when it changes.
(function () {
  var KEY = "cookie-consent";

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  var banner = document.getElementById("cookie-banner");
  if (!banner) return;

  function show() { banner.hidden = false; }
  function hide() { banner.hidden = true; }

  function choose(value) {
    write(value);
    window.__cookieConsent = value;
    hide();
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: value }));
  }

  var accept = document.getElementById("cookie-accept");
  var reject = document.getElementById("cookie-reject");
  if (accept) accept.addEventListener("click", function () { choose("accepted"); });
  if (reject) reject.addEventListener("click", function () { choose("rejected"); });

  // "Cookie settings" in the footer re-opens the banner any time.
  var settings = document.getElementById("cookie-settings");
  if (settings) {
    settings.addEventListener("click", function (e) {
      e.preventDefault();
      show();
    });
  }

  window.JMConsent = {
    choice: function () { return window.__cookieConsent || read(); },
    open: show,
  };
  window.__cookieConsent = read();

  // First visit: no choice stored yet, so ask.
  if (!read()) show();
})();
