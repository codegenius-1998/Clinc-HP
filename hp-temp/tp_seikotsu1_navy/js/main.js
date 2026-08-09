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
  const breakPoint = 1000;	// ここがブレイクポイント指定箇所です

  // ▼ここを切り替えるだけで 2パターンを使い分け！
  //   false → “従来どおり”
  //   true  → “ハンバーガーが非表示の間は #menubar も非表示”
  const HIDE_MENUBAR_IF_HDR_HIDDEN = true;

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
  initDropdown($('header nav'), isTouchDevice);
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


//===============================================================
// サムネイルの横スライドショー（複数設置対応）
//===============================================================
$(function() {

	var slideDuration = 1000;      // アニメーション時間（ミリ秒）
	var autoSlideInterval = 4000;  // 自動スライドの間隔（ミリ秒）

	//----------------------------
	// スライダー1個を初期化
	//----------------------------
	function initOneSlider($slider) {

		var imagesPerView, slideBy;
		var isAnimating = false;
		var currentImageIndex = 0;
		var pendingIndex = null;	// アニメ中クリックの「予約」

		var $imgParts = $slider.find('.img');
		var $indicatorsArea = $slider.find('.slide-indicators');

		// 既存タイマー停止（このスライダーだけ）
		stopAutoSlide();

		// 既存のクローンとインジケータ削除（このスライダーだけ）
		$imgParts.find('.clone').remove();
		$indicatorsArea.empty();

		// クローン削除後に元要素を取り直す
		var $divs = $imgParts.children('div').not('.clone');
		var totalImages = $divs.length;

		// 画像が1個以下なら何もしない
		if (totalImages <= 1) {
			$imgParts.css({
				'transition': 'none',
				'transform': 'translateX(0)'
			});
			return;
		}

		var windowWidth = $(window).width();

		if (windowWidth >= 801) {
			imagesPerView = 4;
			slideBy = 2;
		} else {
			imagesPerView = 2;
			slideBy = 1;
		}

		// 表示枚数以下ならスライド不要（インジケータも作らない）
		if (totalImages <= imagesPerView) {
			$imgParts.css({
				'transition': 'none',
				'transform': 'translateX(0)'
			});
			return;
		}

		// 無限ループ用クローン追加
		$divs.clone().addClass('clone').appendTo($imgParts);

		// インジケータ生成
		var totalSlides = Math.ceil(totalImages / slideBy);
		for (var i = 0; i < totalSlides; i++) {
			$indicatorsArea.append('<span class="indicator" data-index="' + (i * slideBy) + '"></span>');
		}
		var $indicatorItems = $indicatorsArea.find('.indicator');

		function updateIndicators() {
			var activeIndex = Math.floor(currentImageIndex / slideBy) % totalSlides;
			$indicatorItems.removeClass('active');
			$indicatorItems.eq(activeIndex).addClass('active');
		}

		function slideTo(index) {

			// アニメ中は動かさない（クリックは予約で処理）
			if (isAnimating) return;

			isAnimating = true;
			currentImageIndex = index;

			$imgParts.css({
				'transition': 'transform ' + (slideDuration / 1000) + 's ease',
				'transform': 'translateX(' + (-currentImageIndex * (100 / imagesPerView)) + '%)'
			});

			updateIndicators();

			setTimeout(function() {

				// ループ処理
				if (currentImageIndex >= totalImages) {

					$imgParts.css('transition', 'none');
					$imgParts.css('transform', 'translateX(0)');

					currentImageIndex = 0;
					updateIndicators();

					// 再描画を強制
					$imgParts[0].offsetHeight;

					$imgParts.css('transition', 'transform ' + (slideDuration / 1000) + 's ease');
				}

				isAnimating = false;

				// ★アニメ中にクリックされた予約があれば、ここで実行
				if (pendingIndex !== null) {
					var next = pendingIndex;
					pendingIndex = null;

					slideTo(next);

					// 自動再生を再開（startは内部で必ずstopするので多重にならない）
					startAutoSlide();
				}

			}, slideDuration);
		}

		function startAutoSlide() {

			// ★速度が上がる原因（タイマー多重）を根本的に潰す
			stopAutoSlide();

			var interval = setInterval(function() {
				slideTo(currentImageIndex + slideBy);
			}, autoSlideInterval);

			$slider.data('interval', interval);
		}

		function stopAutoSlide() {
			var interval = $slider.data('interval');
			if (interval) {
				clearInterval(interval);
				$slider.removeData('interval');
			}
		}

		// 初期位置
		$imgParts.css({
			'transition': 'none',
			'transform': 'translateX(0)'
		});
		updateIndicators();

		// 自動再生開始
		startAutoSlide();

		// hover停止（この機能のイベントだけ外せるように名前空間）
		$slider.off('.auto1')
			.on('mouseenter.auto1', function() {
				stopAutoSlide();
			})
			.on('mouseleave.auto1', function() {
				startAutoSlide();
			});

		// インジケータクリック
		$indicatorItems.off('.auto1').on('click.auto1', function() {

			var index = $(this).data('index');

			// まず止める（多重タイマー予防）
			stopAutoSlide();

			// アニメ中なら「予約」して終わり（終わった瞬間に実行される）
			if (isAnimating) {
				pendingIndex = index;
				return;
			}

			slideTo(index);
			startAutoSlide();

		});

	}

	//----------------------------
	// 全スライダーを初期化
	//----------------------------
	function initAllSliders() {
		$('.list-auto1').each(function() {
			initOneSlider($(this));
		});
	}

	// 初期化
	initAllSliders();

	// リサイズで再初期化
	var resizeTimer;
	$(window).off('.auto1resize').on('resize.auto1resize', function() {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function() {
			initAllSliders();
		}, 250);
	});

});



//===============================================================
// headerのフェード
//===============================================================
const header = document.getElementById('header');
let lastScrollY = 0; // 直前の位置をメモ

// --- 設定値（ここを変えると動きが変わります） ---
const startPos = 150;     // 何px以上スクロールしたら隠し始めるか
const tolerance = 10;     // 何px以上「戻した」時に表示させるか（遊びの量）
// --------------------------------------------

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    // 1. ページ最上部付近なら必ず表示する
    if (currentScrollY < startPos) {
        header.classList.remove('is-hide');
    } 
    // 2. 下にスクロールしている時
    else if (currentScrollY > lastScrollY) {
        header.classList.add('is-hide');
    } 
    // 3. 上にスクロールしている時（遊びを持たせる）
    else if (lastScrollY - currentScrollY > tolerance) {
        header.classList.remove('is-hide');
    }

    // 現在の位置をメモして次に備える
    lastScrollY = currentScrollY;
});


//===============================================================
// 汎用開閉処理
//===============================================================
$(function() {
	$('.openclose').next().hide();
	$('.openclose').click(function() {
		$(this).toggleClass('active');
		$(this).next().slideToggle();
		$('.openclose').not(this).removeClass('active').next().slideUp();
	});
});
