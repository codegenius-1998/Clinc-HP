/*
 * nj-motion.js — /preview/<slug> 用の控えめな進歩的拡張。依存なし・1ファイル。
 *
 * これが読み込まれなくても表示は完全に成立する(下の機能はすべて「無くても困らない」もの):
 *   1. スクロールで要素をふわっと出す (.nj-reveal / [data-nj-anim] に .is-visible)
 *   2. [data-nj-count] の数字を 0 から数え上げ
 *   3. ヘッダーにスクロール時の影 / 上部のスクロール進捗バー / Hero 背景の視差
 *   4. ページ内アンカーのスクロール。sticky ヘッダーの高さ分を差し引いて止める
 *      (ホーム = #top はページ最上部へ)。あわせてモバイルメニューを閉じる
 *
 * prefers-reduced-motion では動きを止め、要素は最初から見えるようにする。
 */
(function () {
  "use strict";

  var root = document.querySelector(".nj-site");
  if (!root) return;

  var reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  // JS が動いていることを CSS に伝える。これで初期状態(opacity:0)が有効になる。
  root.classList.add("nj-js");

  // --- 1 & 2. reveal + count-up -----------------------------------------------
  var revealSel = ".nj-reveal, [data-nj-anim]";
  var items = [].slice.call(root.querySelectorAll(revealSel));

  // 同じ親の中で data-nj-anim を持つ要素だけを数える(カード列などの段差用)。
  // トップレベルの .nj-reveal セクション同士では段差を付けない。
  function staggerIndex(el) {
    var p = el.parentNode;
    if (!p) return 0;
    var sibs = [].slice.call(p.children).filter(function (c) {
      return c.nodeType === 1 && c.hasAttribute && c.hasAttribute("data-nj-anim");
    });
    var i = sibs.indexOf(el);
    return i < 0 ? 0 : Math.min(i, 6);
  }

  function pad(v, n) {
    var s = String(v);
    while (n && s.length < n) s = "0" + s;
    return s;
  }

  function countUp(scope) {
    var nodes = scope.hasAttribute && scope.hasAttribute("data-nj-count")
      ? [scope]
      : [].slice.call(scope.querySelectorAll("[data-nj-count]"));
    nodes.forEach(function (n) {
      if (n.__njCounted) return;
      n.__njCounted = true;
      var target = parseFloat(n.getAttribute("data-nj-count"));
      var p = n.getAttribute("data-nj-pad");
      var suffix = n.getAttribute("data-nj-suffix") || "";
      if (reduce || isNaN(target) || !window.requestAnimationFrame) {
        n.textContent = pad(isNaN(target) ? n.textContent : target, p) + suffix;
        return;
      }
      var dur = 900;
      var t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - k, 3);
        n.textContent = pad(Math.round(target * e), p) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  function show(el) {
    if (el.hasAttribute("data-nj-anim")) {
      var i = staggerIndex(el);
      if (i > 0) el.style.setProperty("--nj-anim-delay", (i * 0.08).toFixed(2) + "s");
    }
    el.classList.add("is-visible");
    countUp(el);
  }

  if (reduce || !hasIO) {
    items.forEach(function (el) {
      el.classList.add("is-visible");
      countUp(el);
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          show(en.target);
          io.unobserve(en.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  // --- 3. header shadow / progress bar / hero parallax -----------------------
  var header = root.querySelector("header");
  var progress = root.querySelector(".nj-progress");
  var parallax = root.querySelector("[data-nj-parallax]");
  var ticking = false;

  // sticky ヘッダーの実測高さを CSS 変数に入れておく(scroll-margin-top の素の挙動用)。
  function headerHeight() {
    return header ? Math.round(header.getBoundingClientRect().height) : 0;
  }
  function measureHeader() {
    root.style.setProperty("--nj-header-h", headerHeight() + "px");
  }
  measureHeader();
  window.addEventListener("resize", measureHeader, { passive: true });

  function onScroll() {
    if (ticking) return;
    ticking = true;
    (window.requestAnimationFrame || function (f) { f(); })(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;

      if (header) {
        if (y > 8) header.setAttribute("data-nj-scrolled", "");
        else header.removeAttribute("data-nj-scrolled");
      }

      if (progress) {
        var h =
          (document.documentElement.scrollHeight || 0) - window.innerHeight;
        progress.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
      }

      if (parallax && !reduce && y < 1000) {
        parallax.style.transform =
          "translate3d(0," + (y * 0.12).toFixed(1) + "px,0) scale(1.12)";
      }

      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  // --- 4. anchor scroll (ヘッダー高さ分を差し引く) + close mobile menu -------
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();

    var toggle = document.getElementById("nj-nav");
    if (toggle) toggle.checked = false; // 先に閉じてからヘッダー高さを測る

    var y = 0;
    if (id !== "top") {
      var top = el.getBoundingClientRect().top + (window.pageYOffset || 0);
      y = Math.max(0, Math.round(top - headerHeight() - 8));
    }
    var smooth = !reduce && "scrollBehavior" in document.documentElement.style;
    if (smooth) window.scrollTo({ top: y, behavior: "smooth" });
    else window.scrollTo(0, y);

    if (window.history && history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }
  });
})();
