/* ============================================================
   borderglow.js — 靠近边缘时发光的外框

   来源：React Bits 的 <BorderGlow>（DavidHDev/react-bits，
   src/content/Components/BorderGlow）。原版是 JSX + CSS，
   这里照源码逐行搬成原生版，整站依然零依赖。CSS 在 style.css 的
   「.border-glow-card」一节，几乎原封不动。

   对应关系（全部写在 data-* 上）：
     edgeSensitivity → data-edge-sensitivity
     glowColor       → data-glow-color（"H S L"，没有 %）
     backgroundColor → data-bg
     borderRadius    → data-radius
     glowRadius      → data-glow-radius
     glowIntensity   → data-glow-intensity
     coneSpread      → data-cone-spread
     animated        → data-animated（"true" 才开）
     colors          → data-colors（逗号分隔）
     fillOpacity     → data-fill-opacity

   行为：指针在卡片上移动时，算出「离边缘多近」(0–100) 和
   「指针相对中心的角度」，写进 --edge-proximity / --cursor-angle，
   其余全交给 CSS 的 conic-gradient 遮罩。
   · 手机没有 hover，不会触发，照片照常显示
   · prefers-reduced-motion → 不做 animated 的扫光（hover 光晕是
     跟手的，不算自动动画，保留）
   ============================================================ */
(function () {
  "use strict";

  var cards = document.querySelectorAll("[data-border-glow]");
  if (!cards.length) return;

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function parseHSL(str) {
    var m = String(str).match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
    if (!m) return { h: 40, s: 80, l: 80 };
    return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
  }

  function glowVars(el, glowColor, intensity) {
    var c = parseHSL(glowColor);
    var base = c.h + "deg " + c.s + "% " + c.l + "%";
    var op = [100, 60, 50, 40, 30, 20, 10];
    var keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
    for (var i = 0; i < op.length; i++) {
      el.style.setProperty(
        "--glow-color" + keys[i],
        "hsl(" + base + " / " + Math.min(op[i] * intensity, 100) + "%)",
      );
    }
  }

  var POS = [
    "80% 55%",
    "69% 34%",
    "8% 6%",
    "41% 38%",
    "86% 85%",
    "82% 18%",
    "51% 4%",
  ];
  var KEYS = ["one", "two", "three", "four", "five", "six", "seven"];
  var MAP = [0, 1, 2, 0, 1, 2, 1];

  function gradientVars(el, colors) {
    for (var i = 0; i < 7; i++) {
      var c = colors[Math.min(MAP[i], colors.length - 1)];
      el.style.setProperty(
        "--gradient-" + KEYS[i],
        "radial-gradient(at " + POS[i] + ", " + c + " 0px, transparent 50%)",
      );
    }
    el.style.setProperty(
      "--gradient-base",
      "linear-gradient(" + colors[0] + " 0 100%)",
    );
  }

  function isLight(color) {
    var v = String(color).trim().replace("#", "");
    if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(v)) return false;
    var hex = v.length === 3 ? v.replace(/./g, "$&$&") : v;
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return r * 0.2126 + g * 0.7152 + b * 0.0722 > 180;
  }

  function easeOut(x) {
    return 1 - Math.pow(1 - x, 3);
  }
  function easeIn(x) {
    return x * x * x;
  }

  function animateValue(o) {
    var start = o.start || 0,
      end = o.end == null ? 100 : o.end;
    var duration = o.duration || 1000,
      delay = o.delay || 0,
      ease = o.ease || easeOut;
    var t0 = performance.now() + delay;
    function tick() {
      var t = Math.min((performance.now() - t0) / duration, 1);
      o.onUpdate(start + (end - start) * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else if (o.onEnd) o.onEnd();
    }
    setTimeout(function () {
      requestAnimationFrame(tick);
    }, delay);
  }

  function num(el, name, def) {
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? def : v;
  }

  [].forEach.call(cards, function (card) {
    var bg = card.getAttribute("data-bg") || "#120F17";
    var colors = (card.getAttribute("data-colors") || "#c084fc,#f472b6,#38bdf8")
      .split(",")
      .map(function (s) {
        return s.trim();
      });
    var edgeSens = num(card, "data-edge-sensitivity", 30);

    card.classList.add("border-glow-card");
    if (isLight(bg)) card.classList.add("border-glow-card--light");
    card.style.setProperty("--card-bg", bg);
    card.style.setProperty("--edge-sensitivity", edgeSens);
    card.style.setProperty(
      "--border-radius",
      num(card, "data-radius", 28) + "px",
    );
    card.style.setProperty(
      "--glow-padding",
      num(card, "data-glow-radius", 40) + "px",
    );
    card.style.setProperty("--cone-spread", num(card, "data-cone-spread", 25));
    card.style.setProperty(
      "--fill-opacity",
      num(card, "data-fill-opacity", 0.5),
    );
    glowVars(
      card,
      card.getAttribute("data-glow-color") || "40 80 80",
      num(card, "data-glow-intensity", 1),
    );
    gradientVars(card, colors);

    /* 原版的两层结构：外发光 span + 内容层 */
    if (!card.querySelector(":scope > .edge-light")) {
      var light = document.createElement("span");
      light.className = "edge-light";
      light.setAttribute("aria-hidden", "true");
      card.insertBefore(light, card.firstChild);
    }

    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var dx = x - cx;
      var dy = y - cy;

      var kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
      var ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
      var edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      var angle = 0;
      if (dx !== 0 || dy !== 0) {
        angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
      }

      card.style.setProperty("--edge-proximity", (edge * 100).toFixed(3));
      card.style.setProperty("--cursor-angle", angle.toFixed(3) + "deg");
    });

    if (card.getAttribute("data-animated") === "true" && !still) {
      /* 原版是挂载就扫；这里卡片在页面下方，改成滚进视口才扫一次 */
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(
          function (entries) {
            if (!entries[0].isIntersecting) return;
            io.disconnect();
            sweep(card);
          },
          { threshold: 0.5 },
        );
        io.observe(card);
      } else {
        sweep(card);
      }
    }
  });

  function sweep(card) {
    /* eslint-disable-next-line no-lone-blocks */ {
      var a0 = 110,
        a1 = 465;
      card.classList.add("sweep-active");
      card.style.setProperty("--cursor-angle", a0 + "deg");
      animateValue({
        duration: 500,
        onUpdate: function (v) {
          card.style.setProperty("--edge-proximity", v);
        },
      });
      animateValue({
        ease: easeIn,
        duration: 1500,
        end: 50,
        onUpdate: function (v) {
          card.style.setProperty(
            "--cursor-angle",
            (a1 - a0) * (v / 100) + a0 + "deg",
          );
        },
      });
      animateValue({
        ease: easeOut,
        delay: 1500,
        duration: 2250,
        start: 50,
        end: 100,
        onUpdate: function (v) {
          card.style.setProperty(
            "--cursor-angle",
            (a1 - a0) * (v / 100) + a0 + "deg",
          );
        },
      });
      animateValue({
        ease: easeIn,
        delay: 2500,
        duration: 1500,
        start: 100,
        end: 0,
        onUpdate: function (v) {
          card.style.setProperty("--edge-proximity", v);
        },
        onEnd: function () {
          card.classList.remove("sweep-active");
        },
      });
    }
  }
})();
