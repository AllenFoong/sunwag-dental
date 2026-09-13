/* Exploded view of a dental implant, driven through the Sketchfab Viewer API.

   Why it is written this way
   --------------------------
   · The three parts are separate MatrixTransform nodes in the model. Their
     stacking axis is LOCAL Y, and the numbers are in the hundreds — the parent
     C4D transform scales by 0.01 and swaps Y into world Z.
   · api.translate() sets an ABSOLUTE local position, not an offset. So the
     rest position of each node is read from the model at startup rather than
     hard-coded, and every frame writes base + spread * progress.
   · Sketchfab's own easing ({duration: 1.0}) fires unreliably when several
     nodes animate at once — parts arrive late or not at all. We drive the
     motion ourselves with requestAnimationFrame and {duration: 0}.
   · The viewer accepts translate() only a moment after `viewerready`, so we
     poll getMatrix() until it answers before starting the loop. */
(function () {
  "use strict";

  var MODEL = "dcfc91171cd34b6780a23a42effd29fc";

  /* Per part, in the model's local units:
       rest   – nudge off the model's own assembled pose, so the pieces read
                as seated rather than merely close. Measured in _tune.html,
                not guessed.
       spread – how far the part travels when the view opens up. */
  var PARTS = [
    { key: "crown", id: 5, rest: -80, spread: 210 },
    { key: "abutment", id: 22, rest: 25, spread: 95 },
    { key: "implant", id: 39, rest: 80, spread: 0 },
  ];

  /* the part is "called out" once the explode passes this much progress */
  var CUE = { crown: 0.28, abutment: 0.52, implant: 0.76 };

  /* one cycle, in milliseconds: hold together, separate, hold apart, close */
  var PHASE = { hold: 900, out: 1700, apart: 2600, back: 1300 };
  var CYCLE = PHASE.hold + PHASE.out + PHASE.apart + PHASE.back;

  /* Quiet time between posing the parts and revealing them, while the viewer
     finishes initialising. Found by hand, not guessed: 700 still left a faint
     shiver on reload, 1350 is clean. Lower it and the jitter comes back. */
  var SETTLE = 1350;

  /* Framed for the fully separated state: the crown ends up near world
     z ≈ 6.6, the implant sits at ≈ 0, so the view is centred at 3.3 and
     pulled far enough back that neither end clips the stage. */
  var CAMERA = { eye: [19.5, 0, 3.3], target: [0, 0, 3.3] };

  var stage = document.getElementById("xv-stage");
  var frame = document.getElementById("xv-frame");
  var poster = document.getElementById("xv-poster");
  if (!stage || !frame) return;

  /* Sketchfab 的加载器以前是 implant.html 里一个写死的 <script src>。
     现在这块并到了 services.html —— 主导航页不该让每个访客都
     去拉一个第三方脚本，所以改成跟模型一样按需注入：
     没滚到植牙那一节的人，完全不会请求 sketchfab.com。 */
  var SDK = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

  function withSdk(cb) {
    if (window.Sketchfab) return cb();
    var tag = document.querySelector('script[data-sketchfab]');
    if (!tag) {
      tag = document.createElement("script");
      tag.src = SDK;
      tag.async = true;
      tag.setAttribute("data-sketchfab", "");
      document.head.appendChild(tag);
    }
    tag.addEventListener("load", function () {
      window.Sketchfab ? cb() : fail();
    });
    tag.addEventListener("error", function () {
      fail();
    });
  }

  var steps = {};
  var tags = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("#xv-steps li"),
    function (li) {
      steps[li.getAttribute("data-step")] = li;
    },
  );
  Array.prototype.forEach.call(
    document.querySelectorAll(".xv-tag"),
    function (el) {
      tags[el.getAttribute("data-tag")] = el;
    },
  );

  var api = null;
  var base = {}; // node id -> resting local Y, read from the model
  var playing = true;
  var visible = true;
  var progress = -1; // last value pushed to the viewer
  var clock = 0;
  var last = 0;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── easing ─────────────────────────────────────────────────── */
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ── where in the cycle are we? ─────────────────────────────── */
  function progressAt(ms) {
    var t = ms % CYCLE;
    if (t < PHASE.hold) return 0;
    t -= PHASE.hold;
    if (t < PHASE.out) return easeInOut(t / PHASE.out);
    t -= PHASE.out;
    if (t < PHASE.apart) return 1;
    return 1 - easeInOut((t - PHASE.apart) / PHASE.back);
  }

  /* ── push one frame to the viewer ───────────────────────────── */
  function render(p) {
    if (!api || Math.abs(p - progress) < 0.001) return;
    progress = p;
    PARTS.forEach(function (part) {
      var b = base[part.id];
      if (b === undefined) return;
      /* seated at p = 0, and still landing on the verified framing at p = 1 */
      var y = b + part.rest + (part.spread - part.rest) * p;
      api.translate(part.id, [0, y, 0], { duration: 0 });
    });
    PARTS.forEach(function (part) {
      var on = p >= CUE[part.key];
      if (steps[part.key]) steps[part.key].classList.toggle("on", on);
      if (tags[part.key]) tags[part.key].classList.toggle("on", on);
    });
  }

  /* ── the loop ───────────────────────────────────────────────── */
  function tick(now) {
    var running = playing && visible;
    if (last && running) clock += now - last;
    last = now;
    if (running) render(progressAt(clock));
    requestAnimationFrame(tick);
  }

  /* pause when the section scrolls away or the tab is hidden — a WebGL
     canvas ticking off-screen is the easiest battery drain to give away */
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    if (visible) last = 0;
  });

  /* ── boot ───────────────────────────────────────────────────── */
  function fail(message) {
    if (!poster) return;
    var line = poster.querySelector("p");
    if (!line) return;
    line.removeAttribute("data-zh");
    line.textContent =
      message || "The 3D viewer could not load. Please try again later.";
    var spinner = poster.querySelector("svg");
    if (spinner) spinner.classList.remove("xv-spin");
  }

  /* Read each part's resting position. This doubles as the readiness probe:
     the viewer ignores translate() for a beat after `viewerready`, and
     getMatrix() answering is the signal that it will now listen. */
  function readBase(tries, done) {
    var pending = PARTS.length;
    var ok = true;
    PARTS.forEach(function (part) {
      api.getMatrix(part.id, function (err, matrix) {
        if (err || !matrix || !matrix.local) ok = false;
        else base[part.id] = matrix.local[13];
        if (--pending) return;
        if (ok) return done();
        if (tries <= 0) return fail();
        setTimeout(function () {
          readBase(tries - 1, done);
        }, 350);
      });
    });
  }

  function start() {
    withSdk(boot);
  }

  function boot() {
    new window.Sketchfab("1.12.1", frame).init(MODEL, {
      autostart: 1,
      transparent: 1,
      scrollwheel: 0, // never hijack the page scroll
      dnt: 1, // do-not-track: no Sketchfab analytics on a clinic page
      ui_infos: 0,
      ui_controls: 0,
      ui_stop: 0,
      ui_help: 0,
      ui_hint: 0,
      ui_settings: 0,
      ui_inspector: 0,
      ui_annotations: 0,
      ui_fullscreen: 0,
      ui_vr: 0,
      ui_ar: 0,
      success: function (viewer) {
        api = viewer;
        api.start();
        api.addEventListener("viewerready", function () {
          api.setCameraLookAt(CAMERA.eye, CAMERA.target, 0);
          readBase(12, function () {
            /* Seat the parts once, then leave the viewer alone.

               `viewerready` is not "settled": the viewer keeps finishing its
               scene setup for a beat afterwards, and a timeline capture put
               readBase only 12ms behind it. Revealing and writing translate()
               every frame inside that window made our writes and the viewer's
               own init fight over the same transforms — the parts shivered for
               about a second after every reload, then went fine.

               So: pose them, hold still through SETTLE behind the poster, and
               only then fade in and start the loop. The reveal is a stable
               frame instead of a scramble. */
            render(calm ? 1 : 0);
            setTimeout(function () {
              stage.classList.add("is-live");
              /* There are no controls: the view just loops. The one exception
                 is a visitor who asked their OS for reduced motion — they get
                 the separated state as a still frame, which is the state that
                 actually explains the three parts. */
              if (calm) {
                playing = false;
              }
              requestAnimationFrame(tick);
            }, SETTLE);
          });
        });
      },
      error: function () {
        fail();
      },
    });
  }

  /* only pull ~5 MB of model down once the section is actually approached */
  if ("IntersectionObserver" in window) {
    var booted = false;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible = entry.isIntersecting;
          if (visible) last = 0;
          if (entry.isIntersecting && !booted) {
            booted = true;
            start();
          }
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(stage);
  } else {
    start();
  }
})();
