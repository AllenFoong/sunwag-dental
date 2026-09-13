/* ============================================================
   carousel.js — 自动播放的分栏卡片

   来源：Paymark 模板的 timeline 卡（左文右图 + 圆点指示器 + 自动切换）。
   原版是 React + framer-motion；这里是原生实现，整站依然零依赖。

   行为：
     · 每 3.5 秒切下一张（INTERVAL），切换是 0.6s 的交叉淡入淡出
     · 鼠标移上去 / 键盘聚焦到卡内 → 暂停，移开恢复
     · 卡片滚出视口 / 标签页切到后台 → 暂停
     · prefers-reduced-motion → 不自动播，但圆点仍可点
     · 带 hash 进来（比如首页链到 services.html#wisdom）→ 直接定位到那一张
     · 没有 JS → 三张全部可见地竖排（见 style.css 里 html:not(.js) 的兜底）

   无障碍：不给非当前项加 aria-hidden —— 服务内容不该因为轮播而对
   读屏用户消失。圆点是真的 <button>，可点可 Tab。
   ============================================================ */
(function () {
  "use strict";

  var root = document.querySelector("[data-carousel]");
  if (!root) return;

  var slides = [].slice.call(root.querySelectorAll(".case-slide"));
  var arts = [].slice.call(root.querySelectorAll(".case-art"));
  var dotBox = root.querySelector(".case-dots");
  var idxEl = root.querySelector(".case-index");
  if (slides.length < 2 || !dotBox) return;

  /* 停留时长。交叉淡换本身 0.6s（在 style.css 里），所以内容
     真正稳住不动的时间是 INTERVAL 减去 0.6s。 */
  var INTERVAL = 3500;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- 圆点 ---------- */
  var dots = slides.map(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "case-dot";
    var name = s.querySelector("h3");
    b.setAttribute(
      "aria-label",
      name ? name.textContent.trim() : "第 " + (i + 1) + " 项",
    );
    b.addEventListener("click", function () {
      go(i);
      restart();
    });
    dotBox.appendChild(b);
    return b;
  });

  /* ---------- 切换 ---------- */
  var cur = -1;

  function go(i) {
    if (i === cur) return;
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      s.classList.toggle("is-active", k === cur);
    });
    arts.forEach(function (a, k) {
      a.classList.toggle("is-active", k === cur);
    });
    dots.forEach(function (d, k) {
      d.classList.toggle("is-active", k === cur);
      d.setAttribute("aria-current", k === cur ? "true" : "false");
    });
    if (idxEl) idxEl.textContent = slides[cur].dataset.num || "";
  }

  /* ---------- 自动播放 ---------- */
  var timer = 0;
  var hovered = false;
  var onScreen = false;

  function canRun() {
    return !hovered && onScreen && !document.hidden && !still.matches;
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }
  function start() {
    stop();
    if (canRun()) {
      timer = setInterval(function () {
        go(cur + 1);
      }, INTERVAL);
    }
  }
  function restart() {
    start();
  }

  root.addEventListener("mouseenter", function () {
    hovered = true;
    stop();
  });
  root.addEventListener("mouseleave", function () {
    hovered = false;
    start();
  });
  root.addEventListener("focusin", function () {
    hovered = true;
    stop();
  });
  root.addEventListener("focusout", function () {
    if (!root.contains(document.activeElement)) {
      hovered = false;
      start();
    }
  });

  document.addEventListener("visibilitychange", start);
  still.addEventListener("change", start);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        onScreen = entries[0].isIntersecting;
        start();
      },
      { threshold: 0.25 },
    ).observe(root);
  } else {
    onScreen = true;
  }

  /* ---------- 起始那一张：优先跟随 hash ---------- */
  function fromHash() {
    var id = (location.hash || "").slice(1);
    if (!id) return 0;
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].id === id) return i;
    }
    return 0;
  }
  go(fromHash());
  window.addEventListener("hashchange", function () {
    go(fromHash());
    restart();
  });

  onScreen = true; // IO 还没回调前先允许，回调会立刻纠正
  start();
})();
