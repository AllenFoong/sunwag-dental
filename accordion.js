/* ============================================================
   accordion.js — 图片手风琴

   来源：React Bits 的 <AccordionGallery>。我手上只有调用片段
   （items / defaultIndex / expandRatio / trigger），没有组件源码，
   所以这是按这四个 prop 的语义重写的原生版本，整站依然零依赖。

   对应关系：
     items        → DOM 里的 .acc-item（写在 HTML 里，不是 JS 数组，
                    这样没有 JS 也能看见图）
     defaultIndex → data-default
     expandRatio  → data-expand（展开那张占容器宽度的比例）
     trigger      → data-trigger（hover / click）

   行为：
     · 展开靠 flex-basis 过渡，不用 width，避免 gap 参与计算出错
     · 键盘 Tab 到某一张 = 展开（focusin），不然只有鼠标能用
     · 鼠标离开整条 → 回到 defaultIndex，不是回到全收拢
     · 窄屏（<760px）CSS 直接换成两列网格，不走手风琴 ——
       手机没有 hover，硬套只会变成必须点两下才进得去
     · prefers-reduced-motion → 不做过渡（CSS 里关）
     · 没有 JS → 每张等宽平铺（CSS 的 --ratio 有兜底值）
   ============================================================ */
(function () {
  "use strict";

  var root = document.querySelector("[data-accordion]");
  if (!root) return;

  var items = [].slice.call(root.querySelectorAll(".acc-item"));
  if (items.length < 2) return;

  var expand = parseFloat(root.dataset.expand || "0.52");
  var trigger = root.dataset.trigger === "click" ? "click" : "hover";
  var home = parseInt(root.dataset.default || "0", 10);
  if (!(home >= 0 && home < items.length)) home = 0;

  /* 收拢那几张平分剩下的宽度 */
  var rest = (1 - expand) / (items.length - 1);
  root.style.setProperty("--n", items.length);

  var cur = -1;

  function open(i) {
    if (i === cur) return;
    cur = i;
    items.forEach(function (el, k) {
      var on = k === i;
      el.classList.toggle("is-open", on);
      el.style.setProperty("--ratio", on ? expand : rest);
      /* 收拢的那几张里，横排标签是隐藏的，对读屏没意义但对
         焦点顺序有 —— 链接本身始终可达，这里只管视觉。 */
      el.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  items.forEach(function (el, i) {
    if (trigger === "hover") {
      el.addEventListener("mouseenter", function () {
        open(i);
      });
    } else {
      el.addEventListener("click", function (e) {
        if (cur !== i) {
          e.preventDefault(); // 第一下只展开，第二下才跳转
          open(i);
        }
      });
    }
    /* 键盘用户：Tab 过去就展开 */
    el.addEventListener("focus", function () {
      open(i);
    });
  });

  root.addEventListener("mouseleave", function () {
    open(home);
  });

  open(home);
})();
