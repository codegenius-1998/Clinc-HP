
//===============================================================
// debounce関数
//===============================================================
function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


//===============================================================
// メニュー関連
//===============================================================

// 変数でセレクタを管理
var $menubar = $('#menubar');
var $menubarHdr = $('#menubar_hdr');

// menu
$(window).on("load resize", debounce(function() {
    if(window.innerWidth <= 900) {	// ここがブレイクポイント指定箇所です
        // 小さな端末用の処理
        $('body').addClass('small-screen').removeClass('large-screen');
        $menubar.addClass('display-none').removeClass('display-block');
        $menubarHdr.removeClass('display-none ham').addClass('display-block');
    } else {
        // 大きな端末用の処理
        $('body').addClass('large-screen').removeClass('small-screen');
        $menubar.addClass('display-block').removeClass('display-none');
        $menubarHdr.removeClass('display-block').addClass('display-none');

        // ドロップダウンメニューが開いていれば、それを閉じる
        $('.ddmenu_parent > ul').hide();
    }
}, 10));

$(function() {

    // ハンバーガーメニューをクリックした際の処理
    $menubarHdr.click(function() {
        $(this).toggleClass('ham');
        if ($(this).hasClass('ham')) {
            $menubar.addClass('display-block');
        } else {
            $menubar.removeClass('display-block');
        }
    });

    // アンカーリンクの場合にメニューを閉じる処理
    $menubar.find('a[href*="#"]').click(function() {
        $menubar.removeClass('display-block');
        $menubarHdr.removeClass('ham');
    });

    // ドロップダウンの親liタグ（空のリンクを持つaタグのデフォルト動作を防止）
	$menubar.find('a[href=""]').click(function() {
		return false;
	});

	// ドロップダウンメニューの処理
    $menubar.find('li:has(ul)').addClass('ddmenu_parent');
    $('.ddmenu_parent > a').addClass('ddmenu');

// タッチ開始位置を格納する変数
var touchStartY = 0;

// タッチデバイス用
$('.ddmenu').on('touchstart', function(e) {
    // タッチ開始位置を記録
    touchStartY = e.originalEvent.touches[0].clientY;
}).on('touchend', function(e) {
    // タッチ終了時の位置を取得
    var touchEndY = e.originalEvent.changedTouches[0].clientY;
    
    // タッチ開始位置とタッチ終了位置の差分を計算
    var touchDifference = touchStartY - touchEndY;
    
    // スクロール動作でない（差分が小さい）場合にのみドロップダウンを制御
    if (Math.abs(touchDifference) < 10) { // 10px以下の移動ならタップとみなす
        var $nextUl = $(this).next('ul');
        if ($nextUl.is(':visible')) {
            $nextUl.stop().hide();
        } else {
            $nextUl.stop().show();
        }
        $('.ddmenu').not(this).next('ul').hide();
        return false; // ドロップダウンのリンクがフォローされるのを防ぐ
    }
});

    //PC用
    $('.ddmenu_parent').hover(function() {
        $(this).children('ul').stop().show();
    }, function() {
        $(this).children('ul').stop().hide();
    });

    // ドロップダウンをページ内リンクで使った場合に、ドロップダウンを閉じる
    $('.ddmenu_parent ul a').click(function() {
        $('.ddmenu_parent > ul').hide();
    });

});


//===============================================================
// 小さなメニューが開いている際のみ、body要素のスクロールを禁止。
//===============================================================
$(function() {
  function toggleBodyScroll() {
    // 条件をチェック
    if ($('#menubar_hdr').hasClass('ham') && !$('#menubar_hdr').hasClass('display-none')) {
      // #menubar_hdr が 'ham' クラスを持ち、かつ 'display-none' クラスを持たない場合、スクロールを禁止
      $('body').css({
        overflow: 'hidden',
        height: '100%'
      });
    } else {
      // その他の場合、スクロールを再び可能に
      $('body').css({
        overflow: '',
        height: ''
      });
    }
  }

  // 初期ロード時にチェックを実行
  toggleBodyScroll();

  // クラスが動的に変更されることを想定して、MutationObserverを使用
  const observer = new MutationObserver(toggleBodyScroll);
  observer.observe(document.getElementById('menubar_hdr'), { attributes: true, attributeFilter: ['class'] });
});


//===============================================================
// スムーススクロール（※バージョン2024-7）※#menubarの高さを取得する場合
//===============================================================
$(function() {
    // ページトップボタンの表示・非表示
    var scroll = $('.pagetop');
    var scrollShow = $('.pagetop-show');
    $(scroll).hide();
    $(window).scroll(function() {
        if ($(this).scrollTop() >= 300) {
            $(scroll).fadeIn().addClass(scrollShow);
        } else {
            $(scroll).fadeOut().removeClass(scrollShow);
        }
    });

    // スムーススクロール
    function smoothScroll(target) {
        var menubarHeight = 0; // 初期値
        if ($('body').hasClass('large-screen')) {
            menubarHeight = $('#menubar').outerHeight(); // .large-screenクラスがある場合に#menubarの高さを取得
        }
        var scroll = target.offset().top - menubarHeight; // 高さを考慮してスクロール位置を調整
        $('body,html').animate({ scrollTop: scroll }, 500);
    }

    // ページトップボタンのクリックイベント
    $('.pagetop').click(function(e) {
        e.preventDefault();
        $('body,html').animate({ scrollTop: 0 }, 500);
    });

    // ページ読み込み時のハッシュ処理
    $(window).on('load', function() {
        var hash = location.hash;
        if (hash) {
            $('body,html').scrollTop(0);
            setTimeout(function() {
                var target = $(hash);
                if (target.length) {
                    smoothScroll(target);
                }
            }, 100);
        }
    });

    // リンククリック時のスムーススクロール
    $(window).on('load', function() {
        $('a[href*="#"]').click(function(e) {
            var href = $(this).attr('href');
            var targetId = href.split('#')[1]; // ハッシュ部分だけを取り出す
            var target = $('#' + targetId);
            if (target.length) {
                e.preventDefault();
                smoothScroll(target);
                history.pushState(null, null, '#' + targetId); // ハッシュをURLに追加
            }
        });
    });
});



//===============================================================
// 汎用開閉処理
//===============================================================
$(function() {
	$('.openclose-parts').next().hide();
	$('.openclose-parts').click(function() {
		$(this).next().slideToggle();
		$('.openclose-parts').not(this).next().slideUp();
	});
});


//===============================================================
// 詳細ページのサムネイル切り替え
//===============================================================
$(function() {
    // 初期表示: 各 .thumbnail-view に対して、直後の .thumbnail の最初の画像を表示
    $(".thumbnail-view-parts").each(function() {
        var firstThumbnailSrc = $(this).next(".thumbnail-parts").find("img:first").attr("src");
        var defaultImage = $("<img>").attr("src", firstThumbnailSrc);
        $(this).append(defaultImage);
    });

    // サムネイルがクリックされたときの動作
    $(".thumbnail-parts img").click(function() {
        var imgSrc = $(this).attr("src");
        var newImage = $("<img>").attr("src", imgSrc).hide();

        // このサムネイルの直前の .thumbnail-view 要素を取得
        var targetPhoto = $(this).parent(".thumbnail-parts").prev(".thumbnail-view-parts");

        targetPhoto.find("img").fadeOut(400, function() {
            targetPhoto.empty().append(newImage);
            newImage.fadeIn(400);
        });
    });
});


//===============================================================
// スライドショー
//===============================================================
$(function() {
	var slides = $('#mainimg .slide');
	var slideCount = slides.length;
	var currentIndex = 0;

	slides.eq(currentIndex).css('opacity', 1).addClass('active');

	setInterval(function() {
		var nextIndex = (currentIndex + 1) % slideCount;
		slides.eq(currentIndex).css('opacity', 0).removeClass('active');
		slides.eq(nextIndex).css('opacity', 1).addClass('active');
		currentIndex = nextIndex;
	}, 5000); // 5秒ごとにスライドを切り替える
});


//===============================================================
// メニューにfixedクラスを付与（2025.10.31 sticky前提・バウンド抑制版）
//===============================================================
document.addEventListener("DOMContentLoaded", function() {
  const menubar = document.getElementById('menubar');
  let triggerPoint = document.getElementById('trigger-point');
  const body = document.body;
  const html = document.documentElement;

  if (!menubar) return;

  // trigger が無ければ自動で menubar の直前に作る（到達＝即検知）
  if (!triggerPoint) {
    triggerPoint = document.createElement('div');
    triggerPoint.id = 'trigger-point';
    triggerPoint.setAttribute('aria-hidden', 'true');
    triggerPoint.style.height = '1px';
    menubar.parentNode.insertBefore(triggerPoint, menubar);
  } else {
    // 既存がある場合も、できれば menubar 直前に移動
    if (triggerPoint.nextElementSibling !== menubar) {
      menubar.parentNode.insertBefore(triggerPoint, menubar);
    }
  }

  let isFixed = false;
  let fixed2Timer = null;
  let baseY = 0;

  // 発火パラメータ（お好みで微調整）
  const IDLE_MS = 900;  // 到達してから“どれだけ待つか”
  const DIST_PX = 40;   // 到達点から“どれだけ離れたら”縮めてよいか
  const ROOT_MARGIN_TOP = -12; // 境界ヒステリシス。上端ぴったりでは判定を変えず、上端から12px 内側まで来たら「到達」とみなす

  function clearTimer(){ if (fixed2Timer){ clearTimeout(fixed2Timer); fixed2Timer = null; } }

  function scheduleFixed2(){
    clearTimer();
    baseY = window.pageYOffset || document.documentElement.scrollTop || 0;
    fixed2Timer = setTimeout(function(){
      if (!isFixed || !body.classList.contains('large-screen')) return;
      const nowY = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (nowY - baseY >= DIST_PX) {
        menubar.classList.add('fixed2');   // padding 縮小（CSS側）
      } else {
        // 境界付近では縮めない → もう一度“間”を取る
        scheduleFixed2();
      }
    }, IDLE_MS);
  }

  // IO：debounce しない（即判定）。sticky のままクラスだけ切り替える
  const observer = new IntersectionObserver(function(entries){
    const entry = entries[0];

    // 小画面 or 文字サイズ「大」（sticky解除運用）では無効化
    if (!body.classList.contains('large-screen') || html.classList.contains('f-large')) {
      if (isFixed) {
        isFixed = false;
        menubar.classList.remove('fixed', 'fixed2');
      }
      clearTimer();
      return;
    }

    if (!entry.isIntersecting) {
      // 上端に到達：即 fixed（見た目用）。縮小は“あとから”
      if (!isFixed) {
        isFixed = true;
        menubar.classList.add('fixed');   // opacity など
        scheduleFixed2();                 // “間”スタート
      }
    } else {
      // 上端から離れた：解除
      if (isFixed) {
        isFixed = false;
        menubar.classList.remove('fixed', 'fixed2');
        clearTimer();
      }
    }
  }, {
    root: null,
    threshold: 0,
    rootMargin: `${ROOT_MARGIN_TOP}px 0px 0px 0px`
  });

  observer.observe(triggerPoint);

  // リサイズ時の整理（大画面⇄小画面切替に追従）
  window.addEventListener('resize', function(){
    if (!body.classList.contains('large-screen') || html.classList.contains('f-large')) {
      isFixed = false;
      menubar.classList.remove('fixed', 'fixed2');
      clearTimer();
    } else if (isFixed) {
      scheduleFixed2();
    }
  });
});


//===============================================================
// 汎用開閉処理
//===============================================================
$(function() {
	$('.openclose').next().hide();
	$('.openclose').click(function() {
		$(this).next().slideToggle();
		$('.openclose').not(this).next().slideUp();
	});
});
