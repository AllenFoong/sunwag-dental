/* Narrow-screen navigation drawer.
   Progressive enhancement only: the CSS keeps the panel inline unless the page
   is both narrow and running JavaScript, so if this file never loads the
   navigation is still a plain wrapped row. No dependencies. */
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.getElementById("nav-panel");
  if (!toggle || !panel) return;

  var narrow = window.matchMedia("(max-width: 640px)");

  function close() {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var open = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && panel.classList.contains("is-open")) {
      close();
      toggle.focus();
    }
  });

  document.addEventListener("click", function (ev) {
    if (!panel.classList.contains("is-open")) return;
    if (panel.contains(ev.target) || toggle.contains(ev.target)) return;
    close();
  });

  /* Widening past the breakpoint hands layout back to CSS — drop the flag so
     the panel is not left in an open state nobody can see. */
  var onChange = function () {
    if (!narrow.matches) close();
  };
  if (narrow.addEventListener) narrow.addEventListener("change", onChange);
  else narrow.addListener(onChange);
})();
