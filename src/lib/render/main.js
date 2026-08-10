/* main.js — 生成される全クリニックサイト共通のスクリプト。
 * 依存ライブラリ無し（jQuery等は使わない）。1機能=1関数、それぞれ対象要素が
 * 無ければ何もしないので、テンプレートの構成（表示/非表示セクション）が
 * サイトごとに変わっても安全に動く。
 */
(function () {
  "use strict";

  // JSが動いている印。CSS側は「.js」が付いた場合のみ初期非表示にする
  // （プログレッシブエンハンスメント — JSが読み込めなくても本文は常に見える）。
  document.documentElement.classList.add("js");

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

  function setupHeaderScrollState() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function setupScrollReveal() {
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

  setupFaqAccordion();
  setupMobileNavAutoClose();
  setupHeaderScrollState();
  setupScrollReveal();
})();
