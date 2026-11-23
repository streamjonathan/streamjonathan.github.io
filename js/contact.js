// Contact email, built at runtime so the address never appears in page
// source as plain text. The local part and the domain are kept separate
// and joined here; the page only carries data-contact-email markers.
// Links get a mailto: address, and marked text gets the address itself.
(function () {
  var user = "sayhi";
  var host = "jonathanmccallum.com";
  var address = user + "@" + host;
  var links = document.querySelectorAll("[data-contact-email]");
  for (var i = 0; i < links.length; i++) {
    links[i].setAttribute("href", "mailto:" + address);
  }
  var texts = document.querySelectorAll("[data-contact-email-text]");
  for (var j = 0; j < texts.length; j++) {
    texts[j].textContent = address;
  }
})();
