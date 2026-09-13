/* EN / 中文 switch.
   The HTML ships English. Every translatable node carries data-zh with the
   Chinese, so with JavaScript off the page is still a complete English site.
   Preference is remembered per visitor in localStorage. */
(function () {
  var KEY = "sunwag-lang";

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function remember(lang) {
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {
      /* private mode — the switch still works for this page view */
    }
  }

  function swap(el, attr, lang) {
    var zh = el.getAttribute("data-zh" + (attr ? "-" + attr : ""));
    if (zh === null) return;
    var keep = "data-en" + (attr ? "-" + attr : "");
    if (!el.hasAttribute(keep)) {
      el.setAttribute(keep, attr ? el.getAttribute(attr) : el.innerHTML);
    }
    var value = lang === "zh" ? zh : el.getAttribute(keep);
    if (attr) el.setAttribute(attr, value);
    else el.innerHTML = value;
  }

  function apply(lang) {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.documentElement.setAttribute("data-lang", lang);

    var i, nodes;
    nodes = document.querySelectorAll("[data-zh]");
    for (i = 0; i < nodes.length; i++) swap(nodes[i], null, lang);

    nodes = document.querySelectorAll("[data-zh-content]");
    for (i = 0; i < nodes.length; i++) swap(nodes[i], "content", lang);

    nodes = document.querySelectorAll("[data-zh-alt]");
    for (i = 0; i < nodes.length; i++) swap(nodes[i], "alt", lang);

    nodes = document.querySelectorAll("[data-zh-placeholder]");
    for (i = 0; i < nodes.length; i++) swap(nodes[i], "placeholder", lang);

    nodes = document.querySelectorAll("[data-zh-aria-label]");
    for (i = 0; i < nodes.length; i++) swap(nodes[i], "aria-label", lang);

    nodes = document.querySelectorAll("[data-lang-btn]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute(
        "aria-pressed",
        nodes[i].getAttribute("data-lang-btn") === lang ? "true" : "false",
      );
    }
  }

  var current = stored() === "zh" ? "zh" : "en";
  apply(current);

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-lang-btn]") : null;
    if (!btn) return;
    current = btn.getAttribute("data-lang-btn");
    remember(current);
    apply(current);
  });
})();
