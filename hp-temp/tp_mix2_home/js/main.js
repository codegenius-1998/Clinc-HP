//===============================================================
// メニュー制御用の関数とイベント設定（※バージョン2026-4｜オーバーレイ対応版）
//===============================================================
$(function(){
  //-------------------------------------------------
  // 変数の宣言
  //-------------------------------------------------
  const $menubar = $('#menubar');
  const $menubarHdr = $('#menubar_hdr');
  const $overlay = $('#menubar-overlay');
  const breakPoint = 900;	// ここがブレイクポイント指定箇所です

  // ▼ここを切り替えるだけで 2パターンを使い分け！
  //   false → “従来どおり”
  //   true  → “ハンバーガーが非表示の間は #menubar も非表示”
  const HIDE_MENUBAR_IF_HDR_HIDDEN = false;

  // タッチデバイスかどうかの判定
  const isTouchDevice = ('ontouchstart' in window) ||
                       (navigator.maxTouchPoints > 0) ||
                       (navigator.msMaxTouchPoints > 0);

  //-------------------------------------------------
  // debounce(処理の呼び出し頻度を抑制) 関数
  //-------------------------------------------------
  function debounce(fn, wait) {
    let timerId;
    return function(...args) {
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        fn.apply(this, args);
      }, wait);
    };
  }

  //-------------------------------------------------
  // メニューを閉じる共通関数
  // ※ハンバーガー解除・メニュー非表示・オーバーレイ非表示・
  //   noscroll解除・ドロップダウン閉じ を一括で行う
  //-------------------------------------------------
  function closeMenu() {
    $menubarHdr.removeClass('ham');
    $menubar.hide();
    $overlay.hide();
    $menubar.find('.ddmenu_parent ul').hide();
    $('body').removeClass('noscroll');
  }

  //-------------------------------------------------
  // メニューを開く共通関数
  //-------------------------------------------------
  function openMenu() {
    $menubarHdr.addClass('ham');
    $menubar.show();
    $overlay.show();
    $menubar.find('.ddmenu_parent ul').hide();
    if ($(window).width() < breakPoint) {
      $('body').addClass('noscroll');
    }
  }

  //-------------------------------------------------
  // ドロップダウン用の初期化関数
  //-------------------------------------------------
  function initDropdown($menu, isTouch) {
    // ドロップダウンメニューが存在するliにクラス追加
    $menu.find('ul li').each(function() {
      if ($(this).find('ul').length) {
        $(this).addClass('ddmenu_parent');
        $(this).children('a').addClass('ddmenu');
      }
    });

    // 子メニューは初期状態で閉じる（ちらつき防止）
    $menu.find('.ddmenu_parent ul').hide();

    // 万一の再初期化に備えてイベントを解除（多重バインド防止）
    $menu.find('.ddmenu').off('click.ddmenu');
    $menu.find('.ddmenu_parent').off('mouseenter.ddmenu mouseleave.ddmenu');

    //---------------------------------------------
    // ▼ブレイクポイント未満（開閉メニュー時）は
    //   PCでも「クリックで開閉」に統一（hover無効）
    //---------------------------------------------
    $menu.find('.ddmenu').on('click.ddmenu', function(e) {
      if (!isTouch && $(window).width() >= breakPoint) return; // PC大画面はhover運用

      e.preventDefault();
      e.stopPropagation();

      const $dropdownMenu = $(this).siblings('ul');
      if ($dropdownMenu.is(':visible')) {
        $dropdownMenu.hide();
      } else {
        $menu.find('.ddmenu_parent ul').hide(); // 他を閉じる
        $dropdownMenu.show();
      }
    });

    //---------------------------------------------
    // ▼PC大画面（breakPoint以上）のみ hover で開閉
    //---------------------------------------------
    $menu.find('.ddmenu_parent').on('mouseenter.ddmenu', function() {
      if (isTouch) return;
      if ($(window).width() < breakPoint) return; // 開閉メニュー時はhover無効
      $(this).children('ul').show();
    }).on('mouseleave.ddmenu', function() {
      if (isTouch) return;
      if ($(window).width() < breakPoint) return; // 開閉メニュー時はhover無効
      $(this).children('ul').hide();
    });
  }

  //-------------------------------------------------
  // ハンバーガーメニューでの開閉制御関数
  //-------------------------------------------------
  function initHamburger($hamburger) {
    let isAnimating = false;	// 連打防止用フラグ
    $hamburger.on('click', function() {
      if (isAnimating) return;	// アニメーション中は何もしない
      isAnimating = true;

      if ($(this).hasClass('ham')) {
        // 開いている → 閉じる
        closeMenu();
      } else {
        // 閉じている → 開く
        openMenu();
      }

      // メニューのCSSアニメーション(0.2s)完了後にロック解除
      setTimeout(function() { isAnimating = false; }, 300);
    });
  }

  //-------------------------------------------------
  // オーバーレイクリックでメニューを閉じる
  //-------------------------------------------------
  $overlay.on('click', function() {
    closeMenu();
  });

  //-------------------------------------------------
  // レスポンシブ時の表示制御 (リサイズ時)
  //-------------------------------------------------
  const handleResize = debounce(function() {
    const windowWidth = $(window).width();

    // bodyクラスの制御 (small-screen / large-screen)
    if (windowWidth < breakPoint) {
      $('body').removeClass('large-screen').addClass('small-screen');
    } else {
      $('body').removeClass('small-screen').addClass('large-screen');
      // PC表示になったら、ハンバーガー解除 + メニュー・オーバーレイを閉じる
      $menubarHdr.removeClass('ham');
      $menubar.find('.ddmenu_parent ul').hide();
      $overlay.hide();
      $('body').removeClass('noscroll');

      // ▼ #menubar を表示するか/しないかの切り替え
      if (HIDE_MENUBAR_IF_HDR_HIDDEN) {
        $menubarHdr.hide();
        $menubar.hide();
      } else {
        $menubarHdr.hide();
        $menubar.show();
      }
    }

    // スマホ(ブレイクポイント未満)のとき
    if (windowWidth < breakPoint) {
      $menubarHdr.show();
      if (!$menubarHdr.hasClass('ham')) {
        $menubar.hide();
        $overlay.hide();
        $('body').removeClass('noscroll');
      }
    }
  }, 200);

  //-------------------------------------------------
  // 初期化
  //-------------------------------------------------
  // 1) ドロップダウン初期化 (#menubar)
  initDropdown($menubar, isTouchDevice);

  // 2) ハンバーガーメニュー初期化 (#menubar_hdr)
  initHamburger($menubarHdr);

  // 3) レスポンシブ表示の初期処理 & リサイズイベント
  handleResize();
  $(window).on('resize', handleResize);

  //-------------------------------------------------
  // アンカーリンク(#)のクリックイベント
  //-------------------------------------------------
  $menubar.find('a[href*="#"]').on('click', function() {
    // ドロップダウンメニューの親(a.ddmenu)のリンクはメニューを閉じない
    if ($(this).hasClass('ddmenu')) return;

    // スマホ表示＆ハンバーガーが開いている状態なら閉じる
    if ($menubarHdr.is(':visible') && $menubarHdr.hasClass('ham')) {
      closeMenu();
    }
  });

  //-------------------------------------------------
  // 「header nav」など別メニューにドロップダウンだけ適用したい場合
  //-------------------------------------------------
  // 例：header nav へドロップダウンだけ適用（ハンバーガー連動なし）
  //initDropdown($('header nav'), isTouchDevice);
});


//===============================================================
// スムーススクロール（※バージョン2026-08-02）
// 通常タイプ / fixedヘッダー対応 切り替え版
//===============================================================
$(function() {

    //===========================================================
    // 設定
    //===========================================================
    // 'normal' ＝ 通常タイプ（固定ヘッダーなし）
    // 'fixed' ＝ fixedヘッダー対応
    var scrollType = 'normal';

    // fixedヘッダー時に位置計算に使う要素（※fixed版を使う際は必ずチェック。画面上部に貼り付くブロックを指定する。）
    // 例：'header' / '#header' / '.site-header'
    var fixedHeaderSelector = '#menubar';

    // ページ上部へ戻るボタンのセレクター
    var topButton = $('.pagetop');

    // ページトップボタン表示用のクラス名
    var scrollShow = 'pagetop-show';


    //===========================================================
    // fixedヘッダーぶんの補正値を取得
    //===========================================================
    function getHeaderOffset() {

        // 通常タイプなら補正なし
        if(scrollType !== 'fixed') {
            return 0;
        }

        // 指定要素を取得
        var $header = $(fixedHeaderSelector);

        // 要素がなければ補正なし
        if(!$header.length) {
            return 0;
        }

        // 画面上でのヘッダー下端位置を取得
        // 高さ + 上部の余白(topやmarginで見た目上ずれている分)も含めて見られる
        var rect = $header.get(0).getBoundingClientRect();

        // 念のためマイナスは0にする
        return Math.max(0, rect.bottom);
    }


    //===========================================================
    // スムーススクロール本体
    //===========================================================
    function smoothScroll(target) {

        var scrollTo = 0;

        // '#' の場合はページ最上部へ
        if(target === '#') {
            scrollTo = 0;

        } else {

            // スクロール先の要素を取得
            var $target = $(target);

            // 対象が存在しない場合は何もしない
            if(!$target.length) {
                return;
            }

            // 通常位置から、fixedヘッダー分を引く
            scrollTo = $target.offset().top - getHeaderOffset();

            // 0未満にならないように補正
            if(scrollTo < 0) {
                scrollTo = 0;
            }
        }

        // アニメーションでスムーススクロール
        $('html, body').animate({scrollTop: scrollTo}, 500);
    }

	//===========================================================
	// ページ内リンク / ページトップボタン
	//===========================================================
	$('a[href*="#"], .pagetop').click(function(e) {

		// ページトップボタン → 最上部へ
		if($(this).hasClass('pagetop')) {
			e.preventDefault();
			smoothScroll('#');
			return;
		}

		// このリンクのハッシュ（例 "#contact"）。<a>要素がURLを自動解決してくれる。
		var hash = this.hash;

		// href="#"（その場に止める）／ハッシュ無しの通常リンクは触らない
		if(!hash || hash === '#') {
			if(($(this).attr('href') || '') === '#') e.preventDefault();
			return;
		}

		// リンク先が「今いるページ」のときだけスムーススクロール。
		//   "#id" でも "service.html#id" でも、現在ページ＋ハッシュなら同一ページ扱い。
		//   別ページ・外部サイト宛てはそのまま遷移させ、読み込み後に下の「ハッシュ付きURLで開いた時」がスクロールする。
		if(this.host !== location.host || this.pathname !== location.pathname || this.search !== location.search) return;

		if($(hash).length) {
			e.preventDefault();
			smoothScroll(hash);
		}
	});

    //===========================================================
    // ページトップボタンの表示切り替え
    //===========================================================
    $(topButton).hide();

    $(window).scroll(function() {
        if($(this).scrollTop() >= 300) {
            $(topButton).fadeIn().addClass(scrollShow);
        } else {
            $(topButton).fadeOut().removeClass(scrollShow);
        }
    });


    //===========================================================
    // ハッシュ付きURLで開いた時
    //===========================================================
    if(window.location.hash) {
        $('html, body').scrollTop(0);

        setTimeout(function() {
            smoothScroll(window.location.hash);
        }, 500);
    }

});


//===============================================================
// スライドショー（ズーム）
//===============================================================
$(function() {
  $('.mainimg').each(function() {
    var $root = $(this);
    var slides = $root.find('.slide');
    var slideCount = slides.length;
    var currentIndex = 0;

    // CSSの transition から "opacity" の時間(ms)を取得（delayも加算）
    function cssTimeToMs(v) {
      v = (v || '').toString().trim();
      if (!v) return 0;
      if (v.indexOf('ms') > -1) return Math.round(parseFloat(v));
      if (v.indexOf('s') > -1)  return Math.round(parseFloat(v) * 1000);
      var n = parseFloat(v);
      return isNaN(n) ? 0 : Math.round(n);
    }

    function getTransitionMs(el, propName) {
      var st = window.getComputedStyle(el);
      var props = (st.transitionProperty || '').split(',');
      var durs  = (st.transitionDuration || '').split(',');
      var dels  = (st.transitionDelay || '').split(',');

      function pick(list, i) {
        if (!list.length) return '0s';
        return (list[i] !== undefined ? list[i] : list[list.length - 1]).trim();
      }

      for (var i = 0; i < props.length; i++) {
        var p = props[i].trim();
        if (p === propName || p === 'all') {
          return cssTimeToMs(pick(durs, i)) + cssTimeToMs(pick(dels, i));
        }
      }
      return 0;
    }

    var INTERVAL = 5000; // 自動切替の間隔（ms）

    // CSS側の transition: opacity ... を自動で拾う（取れなければ1000ms）
    var FADE_MS = getTransitionMs(slides.get(0), 'opacity');
    if (!FADE_MS) FADE_MS = 1000;

    // 切替完了まで拡大を続ける
    var ZOOM_MS = INTERVAL + FADE_MS;

    var autoTimer = null;
    var isAnimating = false;

    // インジケータ作成
    var $indicators = $root.find('.slide-indicators').empty();
    for (var i = 0; i < slideCount; i++) {
      $indicators.append('<span class="indicator" data-index="' + i + '"></span>');
    }
    var $dots = $indicators.find('.indicator');

    // 拡大（Ken Burns）用：拡大時間をJS側で揃える
    slides.find('img').css('transition', 'transform ' + ZOOM_MS + 'ms linear');

    function resetZoom($slide) {
      var $img = $slide.find('img');
      $img.css('transition', 'none');         // リセットは瞬時に（見えない所で戻す）
      $slide.removeClass('zoom');             // CSS側の scale(1) に戻す
      if ($img[0]) { $img[0].offsetHeight; }  // reflow
      $img.css('transition', 'transform ' + ZOOM_MS + 'ms linear');
    }

    function startZoom($slide) {
      window.requestAnimationFrame(function() {
        $slide.addClass('zoom');
      });
    }

    // 初期表示
    slides.css('opacity', 0).removeClass('active');
    slides.each(function() { resetZoom($(this)); });

    slides.eq(0).css('opacity', 1).addClass('active');
    $dots.removeClass('active').eq(0).addClass('active');
    startZoom(slides.eq(0));

    function setActive(nextIndex) {
      if (nextIndex === currentIndex) return;
      isAnimating = true;

      var $current = slides.eq(currentIndex);
      var $next = slides.eq(nextIndex);

      // 次スライドは必ずscale(1)から開始
      resetZoom($next);

      // フェード（退場側のzoomはフェード完了まで維持）
      $current.css('opacity', 0).removeClass('active');
      $next.css('opacity', 1).addClass('active');

      // 次スライドの拡大を開始（フェード中も拡大）
      startZoom($next);

      // インジケータ
      $dots.eq(currentIndex).removeClass('active');
      $dots.eq(nextIndex).addClass('active');

      var prevIndex = currentIndex;
      currentIndex = nextIndex;

      // フェード完了後に退場側だけリセット（見えないので違和感が出ない）
      setTimeout(function() {
        resetZoom(slides.eq(prevIndex));
        isAnimating = false;
      }, FADE_MS);
    }

    function next() {
      var n = (currentIndex + 1) % slideCount;
      setActive(n);
      restartTimer();
    }

    function restartTimer() {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(next, INTERVAL);
    }

    // クリックで移動 → タイマーをリセット
    $dots.on('click', function() {
      var to = $(this).data('index');
      if (isAnimating) return;
      if (to === currentIndex) {
        return restartTimer();
      }
      setActive(to);
      restartTimer();
    });

    // 自動再生開始
    restartTimer();
  });
});


//===============================================================
// サムネイルスライドショー
//===============================================================
$(document).ready(function() {
    // 各 .img を個別に処理
    $('.slideimg2 .img').each(function() {
        var $imgParts = $(this);
        var $divs = $imgParts.children('div');
        var divCount = $divs.length;

        // 各 div の幅を計算
        var divWidth = 100 / (divCount * 2);

        // サムネイルの枚数に応じてアニメーション時間と幅を計算
        var animationTime = (divCount / 4) * 40 + 's';
        var slideWidth = (divCount / 4) * 200 + '%';

        // 各 div に幅を設定
        $divs.css({
            'flex': '0 0 ' + divWidth + '%',
            'width': divWidth + '%'
        });

        // .img に animation と width を設定
        $imgParts.css({
            'animation-duration': animationTime,
            'width': slideWidth
        });

        // 初期ロード時に子要素を複製して追加
        $divs.clone().appendTo($imgParts);

        // サムネイルにマウスが乗った時にアニメーションを一時停止
        $imgParts.on('mouseenter', function() {
            $(this).css('animation-play-state', 'paused');
        });

        // サムネイルからマウスが離れた時にアニメーションを再開
        $imgParts.on('mouseleave', function() {
            $(this).css('animation-play-state', 'running');
        });
    });
});


//===============================================================
// 汎用開閉処理
//===============================================================
$(function() {
	$('.openclose').next().hide();
	$('.openclose').click(function() {
		// クリックした要素に active クラスをトグルする
		$(this).toggleClass('active');
		$(this).next().slideToggle();
		// クリックされた要素以外の active クラスを除去し、その dd を閉じる
		$('.openclose').not(this).removeClass('active').next().slideUp();
	});
});
