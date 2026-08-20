/* main.js — 生成される全クリニックサイト共通のスクリプト。
 * 依存ライブラリ無し（jQuery等は使わない）。1機能=1関数、それぞれ対象要素が
 * 無ければ何もしないので、ブロック構成（種類・個数・並び）がサイトごとに
 * 変わっても安全に動く。
 *
 * 演出の種類・速度・段差はテンプレートが決め、<html> の data-reveal /
 * data-stagger / data-parallax 属性としてこのファイルに渡ってくる
 * （src/lib/render/components.tsx の SitePage を参照）。
 */
(function () {
  "use strict";

  var root = document.documentElement;

  // JSが動いている印。CSS側は「.js」が付いた場合のみ初期非表示にする
  // （プログレッシブエンハンスメント — JSが読み込めなくても本文は常に見える）。
  root.classList.add("js");

  var revealMode = root.getAttribute("data-reveal") || "fade";
  var staggerEnabled = root.getAttribute("data-stagger") === "1";
  var parallaxEnabled = root.getAttribute("data-parallax") === "1";
  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupFaqAccordion() {
    var items = document.querySelectorAll(".faq-item");
    items.forEach(function (item) {
      var button = item.querySelector(".faq-q");
      if (!button) return;
      button.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");
        item.classList.toggle("open", !isOpen);
        button.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  function setupMobileNavAutoClose() {
    var toggle = document.getElementById("nav-toggle");
    if (!toggle) return;
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.checked = false;
      });
    });
  }

  /** 実測したヘッダーの高さを --header-h として公開する。
   * スマートフォンのメニューは position: fixed でヘッダーの真下に出すため、その高さが要る。
   * ヘッダーの高さはロゴの有無・医院名の行数・フォント設定で変わるので、CSS 側に固定値では書けない。
   * 取得できない場合に備えて CSS 側に既定値を持たせてあるので、この処理が動かなくても崩れはしない。 */
  function trackHeaderHeight() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var update = function () {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    };
    update();
    window.addEventListener("resize", update);
    // 画像の読み込みでヘッダーの高さが変わることがある（ロゴの縦横比が確定するのは読み込み後）。
    var logo = header.querySelector("img");
    if (logo && !logo.complete) logo.addEventListener("load", update);
  }

  function setupHeaderScrollState() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /** 同じ親を共有する .reveal どうしに、順番に応じた遅延を持たせる。
   * 対象は「カードの列」「ギャラリー」のような並列の集まりだけで、
   * セクション全体には効かせない — 全部に効かせると、下のセクションほど
   * どんどん遅れて表示され、読み込みが遅いように見えてしまうため。 */
  function applyStagger() {
    if (!staggerEnabled) return;
    // 対象は「同じ見た目の要素が並んでいる集まり」だけ。表の <tr> を入れていないのは、
    // 行に transform を掛けると列の位置合わせが崩れる実装のブラウザがあるため。
    var GROUPS = ".cards, .gallery, .staff-grid, .news-list, .faq-list";
    document.querySelectorAll(GROUPS).forEach(function (group) {
      var children = group.children;
      for (var i = 0; i < children.length; i++) {
        children[i].classList.add("reveal");
        children[i].style.setProperty("--reveal-delay", i * 90 + "ms");
      }
    });
  }

  function setupScrollReveal() {
    // テンプレートが演出無しを選んでいる／OSが動きを控える設定なら、
    // 監視そのものを立ち上げず、最初から全部表示された状態にする。
    if (revealMode === "none" || prefersReducedMotion) {
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    applyStagger();

    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  /** ヒーロー画像を、スクロール量の一部だけゆっくり動かす。
   * requestAnimationFrame で1フレーム1回に間引く（scrollイベントは
   * 1フレームに何度も飛んでくるため）。 */
  function setupParallaxHero() {
    if (!parallaxEnabled || prefersReducedMotion) return;
    var section = document.querySelector(".hero-full-bleed");
    var hero = section && section.querySelector(".hero-image");
    if (!hero) return;

    var ticking = false;
    var update = function () {
      // 移動量はヒーロー自身の高さを基準にする。ビューポート基準（旧実装）だと、画面の高いPCでは
      // 移動量がヒーローの高さを超え、拡大で稼いだ余白から画像がずれて端に隙間が出る。
      // 0.11 は CSS 側の scale(1.3)（＝上下 15% ずつの余白）に収まる値。
      var heroHeight = section.getBoundingClientRect().height || 1;
      var progress = Math.min(window.scrollY / heroHeight, 1);
      hero.style.setProperty("--parallax-y", progress * heroHeight * 0.11 + "px");
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  setupFaqAccordion();
  setupMobileNavAutoClose();
  trackHeaderHeight();
  setupHeaderScrollState();
  setupScrollReveal();
  setupParallaxHero();
})();
