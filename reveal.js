/* Scroll choreography: reveal on enter, once.
   Only transform / opacity / filter are animated (see style.css).
   Anything not observed stays visible — no JS, no blank page. */
(function () {
  var els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || !("IntersectionObserver" in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add("is-in");
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );

  els.forEach(function (el) {
    io.observe(el);
  });
})();
