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
  const breakPoint = 9999;	// ここがブレイクポイント指定箇所です

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
  $menubar.find('a[href^="#"]').on('click', function() {
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
// スムーススクロール（※バージョン2025-3）
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
	$('a[href^="#"], .pagetop').click(function(e) {

		// hrefが無い.pagtopでも '#' 扱いにする
		var id = $(this).attr('href') || '#';

		// .pagetop 以外の href="#" は無視（その場に止める）
		if(id === '#' && !$(this).hasClass('pagetop')) {
			e.preventDefault();
			return;
		}

		e.preventDefault();
		smoothScroll(id);
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


// ===============================================================
// 詳細ページ：サムネイル切替（画像/動画） + 横スクロール矢印（自動）
// ===============================================================
$(function(){

  // ------------------------------
  // サムネ（video）の初期処理：controls消し、iOS対策、再生アイコン付与
  // ------------------------------
  function setupThumbVideo($v){
    var videoEl = $v[0];

    $v.attr({
      'preload': 'metadata',
      'muted': true,
      'playsinline': true
    });

    videoEl.removeAttribute('controls');

    // iOSで最初のフレームが白になりやすい対策
    function seekThumbFrame(){
      try {
        videoEl.pause();
        videoEl.currentTime = 0.1;
      } catch(e) {}
    }
    // 読み込みタイミングにより効き方が違うので複数で保険
    $v.on('loadedmetadata loadeddata', seekThumbFrame);
    seekThumbFrame();

    // まだラップされていなければラップ＋アイコン
    if (!$v.parent().hasClass('thumb-wrap')) {
      $v.wrap('<span class="thumb-wrap is-video"></span>');
      $v.after('<span class="thumb-play" aria-hidden="true"><i class="fa-solid fa-play fas fa-play"></i></span>');
    }
  }

  // ------------------------------
  // サムネ要素（img/video）から、表示用の要素を生成
  // ------------------------------
  function createViewerEl($media){
    if ($media.is('img')) {
      return $('<img>').attr('src', $media.attr('src'));
    }

    if ($media.is('video')) {
      var src = $media.attr('src') || $media.find('source:first').attr('src');
      if (!src) return null;

      var $v = $('<video>').attr({
        src: src,
        controls: true,
        playsinline: true,
        preload: 'metadata'
      });

      // iOSで真っ白防止：0.1秒目を表示
      $v.on('loadedmetadata loadeddata', function(){
        try { this.currentTime = 0.1; } catch(e) {}
      });

      return $v;
    }

    return null;
  }

  // ------------------------------
  // 1セットずつ処理（複数設置に対応）
  // ------------------------------
  $('.thumbnail-view').each(function(){

    var $view  = $(this);
    var $thumbs = $view.next('.thumbnail-changer');

    // サムネ内の video を処理（ラップ＆アイコン）
    $thumbs.find('video').each(function(){
      setupThumbVideo($(this));
    });

    // --- サムネ列にナビを動的生成（矢印＋スクロール枠） ---
    // すでに生成済みなら二重に作らない
    if (!$thumbs.parent().hasClass('thumbnail-wrapper3')) {
      var $wrapper = $thumbs.wrap('<div class="thumbnail-wrapper3"></div>').parent();
      var $nav     = $wrapper.wrap('<div class="thumbnail-nav3"></div>').parent();

      var $prev = $('<div class="thumb-arrow3 prev">&#10094;</div>');
      var $next = $('<div class="thumb-arrow3 next">&#10095;</div>');
      $nav.prepend($prev).append($next);

      // 1回のスクロール量（サムネ 3個分）
      function getStep(){
        var $item = $thumbs.children().first();
        var w = $item.outerWidth(true) || 100;
        return w * 3;
      }

      function updateArrows(){
        var max = $thumbs[0].scrollWidth - $wrapper.innerWidth();
        var pos = $wrapper.scrollLeft();

        if (max <= 0) {
          $prev.addClass('is-off');
          $next.addClass('is-off');
        } else {
          $prev.toggleClass('is-off', pos <= 0);
          $next.toggleClass('is-off', pos >= max - 2);
        }
      }

      $prev.on('click', function(){
        $wrapper.animate({scrollLeft: $wrapper.scrollLeft() - getStep()}, 300, updateArrows);
      });
      $next.on('click', function(){
        $wrapper.animate({scrollLeft: $wrapper.scrollLeft() + getStep()}, 300, updateArrows);
      });

      $wrapper.on('scroll', updateArrows);
      $(window).on('resize', updateArrows);
      updateArrows();
    }

    // --- 初期表示：最初の img か video を表示 ---
    var $first = $thumbs.find('img,video').first();
    var $firstEl = createViewerEl($first);

    if ($firstEl) {
      $view.empty().append($firstEl);
    }

  });

  // ------------------------------
  // サムネクリック（pointerdown推奨：iOS/タップ遅延＆誤再生防止）
  // ------------------------------
  $(document).on('pointerdown', '.thumbnail-changer', function(e){

    // thumb-wrap上のクリックも拾えるように closest で探す
    var $media = $(e.target).closest('img,video');
    if (!$media.length) return;

    e.preventDefault();

    // サムネがvideoなら誤再生防止で止める
    if ($media.is('video')) {
      try { $media[0].pause(); } catch(err) {}
    }

    // 対応する view を取得
    var $view = $(this).closest('.thumbnail-nav3').prev('.thumbnail-view');
    if (!$view.length) return;

    var $nextEl = createViewerEl($media);
    if (!$nextEl) return;

    // iOS対策：display:none だと白くなる事があるので opacity で切り替え
    $nextEl.css('opacity', 0);

    $view.find('img,video').fadeOut(400, function(){
      $view.empty().append($nextEl);

      // 動画の場合は念のためロード
      if ($nextEl.is('video')) {
        try { $nextEl[0].load(); } catch(e) {}
      }

      $nextEl.animate({opacity: 1}, 400);
    });

  });

});


// ===============================================================
// FAQアコーディオン開閉
// ===============================================================
$(function(){
	$(".openclose .q").on("click", function(){
		var $item = $(this).closest(".faq-item");
		var $answer = $item.find(".a");
		$item.toggleClass("open");
		$answer.slideToggle(300);
	});
});


// ===============================================================
// #message：500px以上スクロールでフェードイン
// ===============================================================
$(function(){
	var $message = $('#message');
	if(!$message.length) return;

	// 初期状態は非表示
	$message.hide();

	$(window).on('scroll', function(){
		if($(this).scrollTop() >= 500){
			$message.fadeIn();
		} else {
			$message.fadeOut();
		}
	});
});


//===============================================================
// ポップアップ
//===============================================================
$(function() {
	// セッション内でポップアップが既に表示されているかチェック
	if (!sessionStorage.getItem('popupShown')) {
		setTimeout(function(){
			if ($("#popup2-overlay-parts").length) {
				$("#popup2-overlay-parts").fadeIn(300);
			}
			$("#popup").fadeIn(300);
			sessionStorage.setItem('popupShown', 'true');
		}, 3000); // 3秒後にポップアップを表示
	}
	
	// 閉じるボタンのクリックイベント
	$(".close-btn-parts").click(function(){
		$("#popup").fadeOut(300);
		if ($("#popup2-overlay-parts").length) {
			$("#popup2-overlay-parts").fadeOut(300);
		}
	});
});
