/* ============================================================
   counter.js — 滚轮式数字

   来源：React Bits 的 <Counter>。原版每一位是一条 0–9 的竖列，
   用 framer-motion 的 useSpring 把该位的值弹到位，数字像老式
   计数器一样滚过去。这里是原生版，整站依然零依赖。

   对应关系：
     value        → data-value
     places       → data-places（"100,10,1"）
     fontSize     → CSS 的 --counter-size（style.css，响应式，最大 80px）
     padding      → CSS 的 --counter-pad
     gap          → CSS 的 --counter-gap
     useSpring    → 下面的 spring()，参数照 framer-motion 默认
                    （stiffness 100 / damping 10 / mass 1，会稍微回弹）

   原版只在 value 改变时才滚；页面上数字不会变，所以改成
   卡片滚进视口时从 data-from（默认 0）滚到 data-value，只滚一次。

   触发时机：**整张卡片完整出现在屏幕里**才开始（阈值 0.95）。
   试过两种不好的：
     · 露出一半就滚 → 卡片还在淡入（reveal.js 0.85s），人还没看过去就滚完了
     · 露出后固定延迟 1.5s → 时间和人滚动的节奏对不上，效果不佳
   手机上卡片是竖排的，每张各自到位才各自滚。

   · 没有 JS → HTML 里原本就写着数字，照常显示
   · prefers-reduced-motion → 直接显示最终数字，不滚
   · 读屏：容器上 aria-label 是完整数字，滚动的列全部 aria-hidden
   ============================================================ */
(function () {
  "use strict";

  var nodes = document.querySelectorAll("[data-counter]");
  if (!nodes.length) return;

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* framer-motion useSpring 的默认参数 */
  var STIFFNESS = 100;
  var DAMPING = 10;
  var MASS = 1;

  /* 原版 Number 组件里的位移公式：
     当前值的个位是 placeValue，数字 n 离它差几格就往下/上挪几格，
     超过 5 格就从另一边绕过来 —— 所以 9 → 0 是往前滚一格，不是倒回去。 */
  function offsetFor(n, latest) {
    var placeValue = ((latest % 10) + 10) % 10;
    var offset = (10 + n - placeValue) % 10;
    if (offset > 5) offset -= 10;
    return offset;
  }

  function build(root) {
    var value = parseInt(root.getAttribute("data-value"), 10) || 0;
    var from = parseInt(root.getAttribute("data-from") || "0", 10) || 0;
    var places = (root.getAttribute("data-places") || "100,10,1")
      .split(",")
      .map(function (p) {
        return parseInt(p, 10);
      });

    root.setAttribute("aria-label", String(value));
    root.textContent = "";

    var digits = places.map(function (place) {
      var col = document.createElement("span");
      col.className = "counter-digit";
      col.setAttribute("aria-hidden", "true");
      var nums = [];
      for (var n = 0; n < 10; n++) {
        var s = document.createElement("span");
        s.className = "counter-number";
        s.textContent = n;
        col.appendChild(s);
        nums.push(s);
      }
      root.appendChild(col);
      return {
        nums: nums,
        target: Math.floor(value / place),
        pos: Math.floor(from / place),
        vel: 0,
      };
    });

    function paint() {
      digits.forEach(function (d) {
        for (var n = 0; n < 10; n++) {
          d.nums[n].style.transform =
            "translateY(calc(" + offsetFor(n, d.pos) + " * var(--counter-h)))";
        }
      });
    }

    function settle() {
      digits.forEach(function (d) {
        d.pos = d.target;
        d.vel = 0;
      });
      paint();
    }

    function run() {
      var last = performance.now();
      function tick(now) {
        /* 切到后台再回来时 dt 会很大，夹住免得弹簧炸掉 */
        var dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;
        var moving = false;
        digits.forEach(function (d) {
          var force = -STIFFNESS * (d.pos - d.target) - DAMPING * d.vel;
          d.vel += (force / MASS) * dt;
          d.pos += d.vel * dt;
          if (Math.abs(d.pos - d.target) > 0.001 || Math.abs(d.vel) > 0.001) {
            moving = true;
          }
        });
        paint();
        if (moving) requestAnimationFrame(tick);
        else settle();
      }
      requestAnimationFrame(tick);
    }

    if (still || !("IntersectionObserver" in window)) {
      settle();
      return;
    }

    paint(); // 先停在起始值
    /* 看的是整张卡，不是数字本身 —— 「到卡片」才算到 */
    var card = root.closest(".trust-card") || root;
    var io = new IntersectionObserver(
      function (entries) {
        /* 用 0.95 而不是 1：有些浏览器因为小数像素永远到不了 1.0 */
        if (entries[0].intersectionRatio < 0.95) return;
        io.disconnect();
        run();
      },
      { threshold: 0.95 },
    );
    io.observe(card);
  }

  [].forEach.call(nodes, build);
})();
