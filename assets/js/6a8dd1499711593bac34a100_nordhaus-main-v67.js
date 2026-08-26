// Прелоудер — полноэкранный блок (.preloader, data-preloader) с процентом загрузки в правом
// нижнем углу (.preloader_percent, data-preloader-percent), добавлено 2026-08-25. Структура —
// нативные Designer-элементы (не HTML-embed), чтобы стили было удобно менять прямо в Designer.
// Логика: пока страница грузится, цифра плавно едет к 90% (fake progress, чтобы не залипать на
// 0%, если загрузка долгая) — реальное окончание загрузки обрывает fake-tween и быстро дотягивает
// до 100%, после чего блок УЕЗЖАЕТ ВНИЗ (yPercent:0->100, 1с, БЕЗ opacity — 2026-08-25, по прямому
// запросу "не растворяется, а уезжает вниз") и скрывается (display:none, чтобы не блокировать
// клики после исчезновения). Уезд запускается ТОЛЬКО после реальной полной загрузки сайта.
// **2026-08-25 (ревизия)**: `window.load` НЕ гарантирует, что весь контент реально загружен — он
// не ждёт `<img loading="lazy">` и не блокируется видео-элементами (спецификация не считает
// `<video>` blocking-ресурсом для load). Поэтому ждём явно: window 'load' + document.fonts.ready +
// картинки (img.complete && naturalWidth>0, иначе слушаем load/error) + видео (readyState>=2 /
// 'loadeddata', иначе слушаем loadeddata/error) — см. whenAllContentLoaded() ниже. readyState>=2
// ("готов показать кадр"), а НЕ >=4/'canplaythrough' ("докачан до конца") — фоновые видео вне
// текущей секции браузер может придержать/оборвать их буферизацию, пока секция не видна, так что
// ждать полной докачки можно неопределённо долго. Есть safety-таймаут 8с (Promise.race), чтобы
// залипший запрос не заблокировал сайт надолго — не основной триггер, а страховка на сбой сети.
// **2026-08-26 (фикс "залипания на 90%")**: изначально ждали КАЖДУЮ картинку/видео на всей
// ~28000px странице, включая десятки ещё не начавших грузиться loading="lazy" секций далеко за
// первым экраном — это условие почти никогда не выполнялось быстро, и прелоудер обычно упирался в
// 8с safety-таймаут. По прямому запросу сузили ожидание до контента ПЕРВОГО ЭКРАНА — см.
// isAboveFold() ниже.
// **2026-08-25: формат 000-100 + поцифровая "одометр"-анимация** (по прямому запросу) — вместо
// textContent строим на лету 3 "слота" (по одному на разряд), каждый — overflow:hidden окно
// высотой 1em, внутри — вертикальная лента из 10 цифр 0..9 (display:flex;flex-direction:column).
// Чтобы показать цифру N, лента сдвигается на translateY(-N em) — т.к. каждая цифра ровно 1em
// высотой, N*1em точно совмещает нужную цифру с окном. Именно поэтому "прошлая цифра уходит
// вверх, следующая приезжает снизу" получается естественно: рост N сдвигает ленту ВВЕРХ, открывая
// следующую цифру снизу — тот же принцип, что у реального механического одометра. em-based (не
// px) — подстраивается под font-size из Designer (сейчас 8rem) без JS-измерений. Слоты/ленты —
// рантайм-структура внутри .preloader_percent (сам класс/его font-size/color/line-height из
// Designer не трогаем, только заменяем innerHTML на цифровые span'ы, которые наследуют шрифт).
// Анимация конкретного разряда запускается только когда его цифра РЕАЛЬНО меняется (не на каждый
// кадр tween'а прогресса) — иначе на каждый кадр спамились бы новые твины.
(function () {
  if (typeof gsap === 'undefined') return;

  var preloader = document.querySelector('[data-preloader]');
  var percentEl = document.querySelector('[data-preloader-percent]');
  if (!preloader || !percentEl) return;

  var DIGIT_COUNT = 3;
  var strips = [];
  var lastDigits = [];

  percentEl.innerHTML = '';
  percentEl.style.display = 'inline-flex';

  for (var i = 0; i < DIGIT_COUNT; i++) {
    var slot = document.createElement('span');
    slot.style.display = 'inline-block';
    slot.style.overflow = 'hidden';
    slot.style.height = '1em';
    slot.style.verticalAlign = 'top';

    var strip = document.createElement('span');
    strip.style.display = 'flex';
    strip.style.flexDirection = 'column';

    for (var d = 0; d <= 9; d++) {
      var digitEl = document.createElement('span');
      digitEl.style.height = '1em';
      digitEl.style.lineHeight = '1em';
      digitEl.textContent = String(d);
      strip.appendChild(digitEl);
    }

    slot.appendChild(strip);
    percentEl.appendChild(slot);
    strips.push(strip);
    lastDigits.push('0');
  }

  var progress = { value: 0 };

  function render() {
    var str = String(Math.round(progress.value)).padStart(DIGIT_COUNT, '0');
    for (var i = 0; i < DIGIT_COUNT; i++) {
      var digit = str[i];
      if (digit !== lastDigits[i]) {
        lastDigits[i] = digit;
        gsap.to(strips[i], { y: (-parseInt(digit, 10)) + 'em', duration: 0.35, ease: 'power2.out' });
      }
    }
  }

  var fakeTween = gsap.to(progress, {
    value: 90,
    duration: 4,
    ease: 'power1.out',
    onUpdate: render
  });

  function finish() {
    fakeTween.kill();
    gsap.to(progress, {
      value: 100,
      duration: 0.4,
      ease: 'power1.out',
      onUpdate: render,
      onComplete: function () {
        gsap.to(preloader, {
          yPercent: 100,
          duration: 1,
          delay: 0.2,
          ease: 'power2.inOut',
          onComplete: function () {
            preloader.style.display = 'none';
          }
        });
      }
    });
  }

  // 2026-08-26 (фикс "залипания на 90%"): раньше ждали КАЖДУЮ картинку/видео на всей ~28000px
  // странице, включая десятки loading="lazy" секций, до которых пользователь ещё не доскроллил —
  // браузер их даже не начинает грузить, пока они не близко к вьюпорту, так что это условие почти
  // никогда не выполнялось быстро и прелоудер обычно упирался в 8с safety-таймаут. По прямому
  // запросу сузили ожидание до контента ПЕРВОГО ЭКРАНА — на момент запуска скрипта (до первого
  // скролла, прелоудер его и так блокирует) scrollY===0, поэтому "видим в первом вьюпорте"
  // проверяется просто через getBoundingClientRect() без поправки на scroll offset.
  function isAboveFold(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  function whenAllContentLoaded(cb) {
    var imgs = Array.prototype.slice.call(document.images).filter(isAboveFold);
    var videos = Array.prototype.slice.call(document.querySelectorAll('video')).filter(isAboveFold);

    var imgPromises = imgs.map(function (img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(function (resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });

    // readyState>=2 (HAVE_CURRENT_DATA / 'loadeddata'), не >=4 ('canplaythrough') — фоновые
    // видео вне текущей секции браузер может придержать/оборвать их буферизацию, пока секция не
    // видна, и ждать "докачано до конца" можно неопределённо долго. readyState>=2 значит "видео
    // реально готово показывать кадр", этого достаточно для "контент загружен".
    var videoPromises = videos.map(function (video) {
      if (video.readyState >= 2) return Promise.resolve();
      return new Promise(function (resolve) {
        video.addEventListener('loadeddata', resolve, { once: true });
        video.addEventListener('error', resolve, { once: true });
      });
    });

    var fontsPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

    var windowLoadPromise = new Promise(function (resolve) {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });

    var allLoaded = Promise.all([windowLoadPromise, fontsPromise].concat(imgPromises, videoPromises));
    var safetyTimeout = new Promise(function (resolve) { setTimeout(resolve, 8000); });

    Promise.race([allLoaded, safetyTimeout]).then(cb);
  }

  whenAllContentLoaded(finish);
})();

// Кастомная обработка якорных ссылок (замена Lenis anchors:true)
// **2026-08-25: явные duration/easing на каждый scrollTo()** — раньше эти клики полагались на
// инстанс-дефолт Lenis (duration:1.2), который убрали из конфига (см. head), чтобы наконец-то
// заработал lerp при скроле колесом (см. gotcha про Lenis ниже) — без этой правки клики стали бы
// молча наследовать новый lerp:0.1 и вести себя иначе (не мгновенный duration-джамп, а
// накатывающееся приближение). Те же duration:0.8/easeOutCubic, что уже используются в клике
// слайдера — единообразно по сайту.
(function () {
  var links = document.querySelectorAll('a[href^="#"]:not([href="#"])');
  if (!links.length) return;

  var scrollOpts = {
    duration: 0.8,
    easing: function (t) { return 1 - Math.pow(1 - t, 3); }
  };

  function withLenis(cb) {
    if (!window.lenis) {
      requestAnimationFrame(function () { withLenis(cb); });
      return;
    }
    cb(window.lenis);
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      withLenis(function (lenis) {
        var vh = link.getAttribute('data-scroll-vh');
        if (vh !== null) {
          lenis.scrollTo(parseFloat(vh) / 100 * window.innerHeight, scrollOpts);
          return;
        }

        var id = link.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;

        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        requestAnimationFrame(function () {
          var offset = target.getBoundingClientRect().top + window.scrollY;
          // data-scroll-extra-vh: доп. скрол сверх позиции таргета (напр. Read more -> #idea,
          // +50vh по прямому запросу, чтобы не просто доехать до верха секции, а укатиться внутрь неё).
          var extraVh = link.getAttribute('data-scroll-extra-vh');
          if (extraVh !== null) offset += parseFloat(extraVh) / 100 * window.innerHeight;
          lenis.scrollTo(offset, scrollOpts);
        });
      });
    });
  });
})();

// Смена цвета текста navbar над опредёнными секциями (.navbar-dark-trigger).
// Echo — особый случай: у него 3 слайда, переключающихся БЕЗ смены положения на странице
// (echo_bg-img просто наезжают друг на друга по xPercent), поэтому обычная проверка
// "элемент вошёл в верхнюю полосу вьюпорта" не может различить слайды между собой.
// Нужен активный индекс echoActiveSlide (см. window.__setEchoActiveSlide ниже, дёргается
// из setupEchoSlides по onEnter/onLeaveBack каждого перехода): по прямому запросу — светлый
// navbar на 1-м и 2-м слайде, тёмный — только на 3-м (индекс 2).
(function () {
  var navbar = document.querySelector('.navbar');
  // 2026-08-25: добавлены .section-approach/.section-news/.section-founder — тёмный navbar
  // поверх них по прямому запросу (.section-slider намеренно НЕ добавлена — навбар над ней
  // должен остаться светлым).
  // 2026-08-25 (фикс бага): .section_horizon в списке заменена на .horizon_mask — сама секция
  // 725vh высотой, и её bounding rect остаётся "перекрывающим" navbar ещё ДОЛГО после того, как
  // horizon визуально скрылась под следующими наехавшими секциями (z-index/margin-top трюк не
  // убирает секцию из документа, просто рисует поверх неё) — из-за этого echo (следующая секция,
  // z-index выше) ошибочно наследовала "тёмный" статус от horizon даже на своём 1-м слайде,
  // который должен быть светлым. .horizon_mask — реальный sticky-бокс (100vh, position:sticky),
  // его rect корректно отражает ТЕКУЩУЮ видимость, а не номинальный размер всей секции.
  var triggers = Array.prototype.slice.call(document.querySelectorAll('.section-philosophy, .horizon_mask, .section_quiet, .section-idea, .section-services, .section-approach, .section-news, .section-founder, .navbar-dark-trigger'));
  if (!navbar || !triggers.length) return;

  var echoSection = document.querySelector('.section_echo');
  var horizonMask = document.querySelector('.horizon_mask');
  // .slider_pin (не .section-slider) — та же причина, что у horizonMask выше: .section-slider
  // высотой 600vh, и её raw rect "перекрывал" бы navbar почти всё время, пока идёт скролл секции,
  // а не только пока она реально видна. .slider_pin — настоящий sticky-бокс (100vh).
  var sliderPin = document.querySelector('.slider_pin');
  var echoActiveSlide = 0;

  // 2026-08-25 (фикс бага): .navbar_project-link (Silence/Horizon/Echo/Quiet Geometry/Studio/
  // contacts) и .menu-btn имеют СВОЙ явный color в CSS (var(--text-light-primary)) — собственное
  // объявленное свойство элемента не наследуется от родителя, поэтому inline color, который JS
  // ставит только на .navbar, до них не доходил, и они не меняли цвет вместе с остальным navbar.
  // Добавлены в colorTargets, чтобы JS явно ставил им тот же inline color.
  var colorTargets = [navbar].concat(
    Array.prototype.slice.call(navbar.querySelectorAll('.navbar_link, .navbar_logo, .navbar_project-link, .menu-btn'))
  );

  var DARK = '#252525';
  var isDarkState = null;

  function setDark(isDark) {
    if (isDark === isDarkState) return;
    isDarkState = isDark;
    colorTargets.forEach(function (el) {
      el.style.color = isDark ? DARK : '';
    });
  }

  // 2026-08-26: navbar полностью прячется (opacity:0) над Slider, по прямому запросу.
  // pointer-events:none вместе с opacity, чтобы невидимый navbar не перехватывал клики, пока
  // Slider на экране — восстанавливается автоматически, как только секция уходит. Проверка идёт
  // по .slider_pin (см. комментарий у объявления переменной выше), плюс тот же opacity-гейт, что
  // и у horizonMask — .slider_pin тоже угасает в opacity:0 через наездный fade на .section-news
  // (см. stages), и его sticky-детач так же отстаёт от визуального скрытия ещё на 100vh.
  var isHiddenState = null;
  function setHidden(isHidden) {
    if (isHidden === isHiddenState) return;
    isHiddenState = isHidden;
    navbar.style.opacity = isHidden ? '0' : '';
    navbar.style.pointerEvents = isHidden ? 'none' : '';
  }

  // 2026-08-26 (фикс бага): .horizon_mask перестаёт быть видимым (opacity доходит до 0 через
  // наездный fade на .section_echo, см. stages ниже) РАНЬШЕ, чем его bounding rect перестаёт
  // формально "перекрывать" navbar — sticky-детач тянется ещё на 100vh (высота самой маски)
  // ПОСЛЕ того, как Echo уже полностью наехал и стал виден. Из-за этого 1-й (и отчасти 2-й)
  // слайд Echo ошибочно наследовал тёмный navbar от уже невидимой horizon_mask. Фикс: rect-
  // перекрытие horizon_mask учитывается только пока она реально видима (opacity > 0).
  function update() {
    var navHeight = navbar.getBoundingClientRect().height;
    var isDark = triggers.some(function (el) {
      var r = el.getBoundingClientRect();
      var overlapping = r.top <= navHeight && r.bottom >= 0;
      if (overlapping && el === horizonMask && parseFloat(getComputedStyle(el).opacity) <= 0.02) {
        return false;
      }
      return overlapping;
    });
    if (!isDark && echoSection && echoActiveSlide === 2) {
      var er = echoSection.getBoundingClientRect();
      isDark = er.top <= navHeight && er.bottom >= 0;
    }
    setDark(isDark);

    if (sliderPin) {
      var pr = sliderPin.getBoundingClientRect();
      var pinOverlapping = pr.top <= navHeight && pr.bottom >= 0;
      if (pinOverlapping && parseFloat(getComputedStyle(sliderPin).opacity) <= 0.02) {
        pinOverlapping = false;
      }
      setHidden(pinOverlapping);
    }
  }

  window.__setEchoActiveSlide = function (index) {
    echoActiveSlide = index;
    update();
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Все анимации ниже — на GSAP + ScrollTrigger.
// ВАЖНО: элементы ниже НЕ должны иметь свой CSS transform в Designer —
// GSAP должен полностью владеть transform с самого первого gsap.set(),
// иначе он компонует новый translate()/scale() поверх CSS-класса вместо замены.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  function bindLenis() {
    if (!window.lenis) {
      requestAnimationFrame(bindLenis);
      return;
    }
    window.lenis.on('scroll', ScrollTrigger.update);
    ScrollTrigger.refresh();
  }
  bindLenis();

  window.addEventListener('load', function () {
    ScrollTrigger.refresh();
  });

  // Наезд philosophy на hero: цвет фона hero и скейл/opacity видео по скролу
  (function () {
    var philosophy = document.querySelector('.section-philosophy');
    var heroPin = document.querySelector('.hero_pin');
    var heroVideo = document.querySelector('.hero_video');
    if (!philosophy || !heroPin || !heroVideo) return;

    var TARGET_COLOR = { r: 0x25, g: 0x25, b: 0x25 };
    var MIN_SCALE = 0.25;
    var MIN_OPACITY = 0.25;
    var fromColor = null;

    function parseColor(str) {
      var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      var a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a === 0) return null;
      return { r: +m[1], g: +m[2], b: +m[3] };
    }

    function getFromColor() {
      if (fromColor) return fromColor;
      var el = heroPin;
      while (el) {
        var c = parseColor(getComputedStyle(el).backgroundColor);
        if (c) { fromColor = c; return fromColor; }
        el = el.parentElement;
      }
      fromColor = { r: 255, g: 255, b: 255 };
      return fromColor;
    }

    gsap.set(heroVideo, { scale: 1, opacity: 1 });

    ScrollTrigger.create({
      trigger: philosophy,
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      onUpdate: function (self) {
        var progress = self.progress;
        var from = getFromColor();
        var r = Math.round(from.r + (TARGET_COLOR.r - from.r) * progress);
        var g = Math.round(from.g + (TARGET_COLOR.g - from.g) * progress);
        var b = Math.round(from.b + (TARGET_COLOR.b - from.b) * progress);
        heroPin.style.backgroundColor = 'rgb(' + r + ',' + g + ',' + b + ')';

        var scale = 1 - progress * (1 - MIN_SCALE);
        var opacity = 1 - progress * (1 - MIN_OPACITY);
        gsap.set(heroVideo, { scale: scale, opacity: opacity });
      }
    });
  })();

  // Philosophy: reveal контента — сначала прямые дети .philosophy_top (.philosophy_top-left,
  // .philosophy_top-right), затем прямые дети .philosophy_bottom (6x .bottom_row — тот же класс,
  // что и в Idea, поэтому селектор СКОУПЛЕН через '.philosophy_bottom .bottom_row', не глобальный).
  // Добавлено 2026-08-25 по прямому запросу. Обе группы — обратимые played timeline (slide-up 2rem
  // + opacity, duration:0.6, ease:power2.out, stagger:0.1 внутри группы), триггер на самом
  // контейнере группы, 'top 50%' ("когда находятся на середине экрана"). Группа (2) гейтится на
  // завершение группы (1) — тот же безопасный played-timeline gating handshake (titleRevealed/
  // textEntered-стиль), что уже используется для Idea (title-wrap -> text-wrap -> bottom_row) и
  // Founder (title -> img-wrap -> footer): played-таймлайны можно безопасно гейтить, scrub — нет
  // (см. историю багов у Idea text-wrap выше).
  (function () {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    var top = document.querySelector('.philosophy_top');
    var bottom = document.querySelector('.philosophy_bottom');
    if (!top || !bottom) return;

    var topItems = Array.prototype.slice.call(top.children);
    var bottomItems = Array.prototype.slice.call(bottom.querySelectorAll('.bottom_row'));
    if (!topItems.length || !bottomItems.length) return;

    gsap.set(topItems, { y: '2rem', opacity: 0 });
    gsap.set(bottomItems, { y: '2rem', opacity: 0 });

    var topRevealed = false;
    var bottomEntered = false;

    var bottomTl = gsap.timeline({ paused: true });
    bottomTl.to(bottomItems, { y: 0, opacity: 1, duration: 1, ease: 'power1.out', stagger: 0.12 });

    var topTl = gsap.timeline({
      paused: true,
      onComplete: function () {
        topRevealed = true;
        if (bottomEntered) bottomTl.play();
      },
      onReverseComplete: function () { topRevealed = false; }
    });
    topTl.to(topItems, { y: 0, opacity: 1, duration: 1, ease: 'power1.out', stagger: 0.12 });

    // 2026-08-25 (ревизия): start сдвинут с 'top 50%' на 'top 80%' — появление начинается раньше,
    // как только секция входит в нижнюю часть экрана, а не когда доходит до середины. duration
    // 0.6->1 + ease power2.out->power1.out (более плавное затухание, без резкого "довода" в конце).
    ScrollTrigger.create({
      trigger: top,
      start: 'top 80%',
      onEnter: function () { topTl.play(); },
      onLeaveBack: function () { topTl.reverse(); }
    });

    ScrollTrigger.create({
      trigger: bottom,
      start: 'top 80%',
      onEnter: function () {
        bottomEntered = true;
        if (topRevealed) bottomTl.play();
      },
      onLeaveBack: function () {
        bottomEntered = false;
        bottomTl.reverse();
      }
    });
  })();

  // Наезд projects (и блоков внутри него) друг на друга — тот же приём, что hero→philosophy:
  // следующий блок наезжает поверх (margin-top:-100vh + z-index в CSS),
  // а уходящий блок в этот момент тает в opacity:0 по скролу.
  // **2026-08-25: добавлена 5-я пара — .slider_pin -> .section-news**, по прямому запросу
  // "уход в opacity:0 по скролу, когда начинает подъезжать следующая секция". .section-news не
  // была частью цепочки наезда раньше (без z-index/margin-top) — добавили через data_style_tool:
  // position:relative, z-index:10 (следующий после section-process, последнего в цепочке — z:9),
  // margin-top:-100vh, background-color:#f7f7f7 (тот же непрозрачный фон, что у остальных секций
  // цепочки, снят с .section-idea live computed style — иначе News была бы полупрозрачной и не
  // перекрывала бы Slider визуально). .slider_pin уже был sticky-боксом (та же роль, что
  // silence_inner/horizon_mask/echo_mask/quiet_inner) — механизм подходит без изменений.
  (function () {
    var stages = [
      { outgoing: '.silence_inner', incoming: '.section_horizon' },
      { outgoing: '.horizon_mask', incoming: '.section_echo' },
      { outgoing: '.echo_mask', incoming: '.section_quiet' },
      { outgoing: '.quiet_inner', incoming: '.section-idea' },
      { outgoing: '.slider_pin', incoming: '.section-news' }
    ];

    stages.forEach(function (s) {
      var outgoing = document.querySelector(s.outgoing);
      var incoming = document.querySelector(s.incoming);
      if (!outgoing || !incoming) return;

      gsap.set(outgoing, { opacity: 1 });

      ScrollTrigger.create({
        trigger: incoming,
        start: 'top bottom',
        end: 'top top',
        scrub: true,
        onUpdate: function (self) {
          gsap.set(outgoing, { opacity: 1 - self.progress });
        }
      });
    });
  })();

  // Projects: horizon — слайды "cover": прошлый остаётся на месте, новый наезжает поверх.
  // Смена слайда — отдельная анимация с длительностью/easing, НЕ привязанная к скроллу
  // (ScrollTrigger только даёт сигнал "въехали в зону" / "вышли из зоны").
  // **2026-08-25: добавлен exit-сдвиг** — уходящий (предыдущий) slides[i-1] одновременно с
  // приездом нового slide тоже анимируется, yPercent:0 -> -10 (сдвиг ВВЕРХ на 10% своей высоты),
  // назад — 0 при onLeaveBack. По прямому запросу, тот же принцип, что и у slider_img/echo_bg-img
  // (см. ниже), только по вертикали вместо горизонтали — здесь GSAP-tween, не CSS-класс.
  // Начальная расстановка (какой слайд виден) — СРАЗУ при загрузке (см. вызов ниже), чтобы не было
  // вспышки "естественного" DOM-порядка. Триггеры смены слайдов — только после reveal-mask анимации.
  function initHorizonSlides() {
    var slides = Array.prototype.slice.call(document.querySelectorAll('.horizon_img'));
    if (slides.length < 2) return;
    gsap.set(slides[0], { yPercent: 0 });
    slides.slice(1).forEach(function (slide) {
      gsap.set(slide, { yPercent: 100 });
    });
  }
  initHorizonSlides();

  function setupHorizonSlides() {
    var section = document.querySelector('.section_horizon');
    var slides = Array.prototype.slice.call(document.querySelectorAll('.horizon_img'));
    if (!section || slides.length < 2) return;

    slides.forEach(function (slide, i) {
      if (i === 0) return; // первый слайд уже виден изначально

      ScrollTrigger.create({
        trigger: section,
        // 2026-08-26: шаг скролла между слайдами сокращён на 50% (0.5x innerHeight
        // вместо 1x) по прямому запросу — только длительность ШАГА, не скорость
        // самого перехода (duration/ease у gsap.to ниже не тронуты).
        start: function () { return 'top+=' + ((i - 1 + 0.75) * window.innerHeight * 0.5) + ' top'; },
        onEnter: function () {
          gsap.to(slide, { yPercent: 0, duration: 1, ease: 'power2.inOut', overwrite: true });
          gsap.to(slides[i - 1], { yPercent: -10, duration: 1, ease: 'power2.inOut', overwrite: true });
        },
        onLeaveBack: function () {
          gsap.to(slide, { yPercent: 100, duration: 1, ease: 'power2.inOut', overwrite: true });
          gsap.to(slides[i - 1], { yPercent: 0, duration: 1, ease: 'power2.inOut', overwrite: true });
        }
      });
    });
  }

  // Projects: echo — слайды "cover" синхронно в echo_bg-slider и echo_slider.
  // Смена слайда — отдельная анимация с длительностью/easing, НЕ привязанная к скроллу.
  // **2026-08-25: добавлен exit-сдвиг ТОЛЬКО для echo_bg-img** (не для echo_slider-img/cardSlide)
  // — уходящий bgSlides[i-1] одновременно с приездом нового bgSlide анимируется отдельным
  // gsap.to(), xPercent:0 -> -10 (сдвиг влево на 10% своей ширины), назад — 0 при onLeaveBack. По
  // прямому запросу, "такой же эффект" как у slider_img.
  // Начальная расстановка — СРАЗУ при загрузке (см. вызов ниже). Триггеры смены слайдов — только
  // после reveal-mask анимации (см. ниже) — вызывается из неё.
  function initEchoSlides() {
    var bgSlides = Array.prototype.slice.call(document.querySelectorAll('.echo_bg-img'));
    var cardSlides = Array.prototype.slice.call(document.querySelectorAll('.echo_slider-img'));
    if (bgSlides.length < 2 || cardSlides.length < 2) return;
    var count = Math.min(bgSlides.length, cardSlides.length);
    gsap.set(bgSlides[0], { xPercent: 0 });
    gsap.set(cardSlides[0], { xPercent: 0 });
    for (var j = 1; j < count; j++) {
      gsap.set(bgSlides[j], { xPercent: 100 });
      gsap.set(cardSlides[j], { xPercent: 100 });
    }
  }
  initEchoSlides();

  function setupEchoSlides() {
    var section = document.querySelector('.section_echo');
    var bgSlides = Array.prototype.slice.call(document.querySelectorAll('.echo_bg-img'));
    var cardSlides = Array.prototype.slice.call(document.querySelectorAll('.echo_slider-img'));
    if (!section || bgSlides.length < 2 || cardSlides.length < 2) return;

    var count = Math.min(bgSlides.length, cardSlides.length);

    for (var i = 1; i < count; i++) {
      (function (i) {
        var bgSlide = bgSlides[i];
        var cardSlide = cardSlides[i];

        ScrollTrigger.create({
          trigger: section,
          start: function () { return 'top+=' + ((i - 1) * window.innerHeight + 0.75 * window.innerHeight) + ' top'; },
          onEnter: function () {
            gsap.to(cardSlide, { xPercent: 0, duration: 1, ease: 'power2.inOut', overwrite: true });
            gsap.to(bgSlide, { xPercent: 0, duration: 1, ease: 'power2.inOut', overwrite: true });
            gsap.to(bgSlides[i - 1], { xPercent: -10, duration: 1, ease: 'power2.inOut', overwrite: true });
            if (window.__setEchoActiveSlide) window.__setEchoActiveSlide(i);
          },
          onLeaveBack: function () {
            gsap.to(cardSlide, { xPercent: 100, duration: 1, ease: 'power2.inOut', overwrite: true });
            gsap.to(bgSlide, { xPercent: 100, duration: 1, ease: 'power2.inOut', overwrite: true });
            gsap.to(bgSlides[i - 1], { xPercent: 0, duration: 1, ease: 'power2.inOut', overwrite: true });
            if (window.__setEchoActiveSlide) window.__setEchoActiveSlide(i - 1);
          }
        });
      })(i);
    }
  }

  // Projects: появление контента всех 4 блоков через маску (scale снизу вверх), НЕ по скролу —
  // time-based анимация, срабатывает когда секция видна на 90vh экрана (top доходит до 10%
  // высоты вьюпорта) и ОБРАТИМА: при скроле назад маска прячется обратно (onLeaveBack).
  // Маска — сам sticky-бокс с видимым контентом (silence_inner/horizon_mask/echo_mask/quiet_inner),
  // контент — его прямые дети, получающие обратный scale, чтобы визуально не растягиваться вместе с маской.
  // Для horizon/echo — триггеры смены слайдов регистрируются только ОДИН раз, после первого
  // завершения анимации (slidesReady-флаг защищает от повторной регистрации при скроле туда-сюда).
  (function () {
    var configs = [
      { section: '.section_silence', mask: '.silence_inner' },
      { section: '.section_horizon', mask: '.horizon_mask', afterReveal: setupHorizonSlides },
      { section: '.section_echo', mask: '.echo_mask', afterReveal: setupEchoSlides },
      { section: '.section_quiet', mask: '.quiet_inner' }
    ];

    var DURATION = 1.5; // было 1s, +50% для плавности

    configs.forEach(function (cfg) {
      var section = document.querySelector(cfg.section);
      var mask = document.querySelector(cfg.mask);
      if (!section || !mask) return;

      var content = Array.prototype.slice.call(mask.children);
      var slidesReady = false;

      gsap.set(mask, { scaleY: 0.001, transformOrigin: 'bottom center' });
      content.forEach(function (el) {
        gsap.set(el, { scaleY: 1, transformOrigin: 'bottom center' });
      });

      function syncContent() {
        var scale = Math.max(gsap.getProperty(mask, 'scaleY'), 0.001);
        content.forEach(function (el) {
          gsap.set(el, { scaleY: 1 / scale });
        });
      }

      ScrollTrigger.create({
        trigger: section,
        start: 'top 10%',
        onEnter: function () {
          gsap.to(mask, {
            scaleY: 1,
            duration: DURATION,
            ease: 'power2.inOut',
            overwrite: true,
            onUpdate: syncContent,
            onComplete: function () {
              if (cfg.afterReveal && !slidesReady) {
                slidesReady = true;
                cfg.afterReveal();
              }
            }
          });
        },
        onLeaveBack: function () {
          gsap.to(mask, {
            scaleY: 0.001,
            duration: DURATION,
            ease: 'power2.inOut',
            overwrite: true,
            onUpdate: syncContent
          });
        }
      });
    });
  })();
})();

// Services: поведение секции различается по брейкпоинтам (граница — 992px,
// совпадает с брейкпоинтом Webflow "medium", где секция теряет pin и превращается
// в обычный поток — см. .section-services/.services_list-item в стилях).
// Десктоп (>=992px):
//   - **2026-08-25 (ревизия)**: .services_image-wrap скейлится 0.1 -> 1 НАПРЯМУЮ ПО СКРОЛУ
//     (scrub, не played timeline) за первые 50% скрола секции (trigger: section, 'top top' ->
//     'bottom bottom'). Как только scale доходит до 1 (пересечение локального прогресса 1.0),
//     по очереди slide-up (100% своей высоты) + opacity 0 -> 1 появляются .services_list-item —
//     задержка 0.1с, played reversible timeline (play() вперёд/reverse() назад при пересечении
//     этой же отметки), clearProps по завершении их tween отдаёт opacity/transform обратно классу
//     current из hover-логики ниже;
//   - наведение на карточку подсвечивает её и синхронизированное большое фото —
//     .services_big-img с тем же индексом внутри .services_image-wrap получает current.
// Планшет/мобилка (<992px): наведения и entrance-эффекта фото нет, карточки появляются по
// очереди снизу вверх (slide-up) с шагом 0.1с, когда список входит в зону видимости.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var section = document.querySelector('.section-services');
  var list = document.querySelector('.services_list');
  var imageWrap = document.querySelector('.services_image-wrap');
  if (!section || !list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('.services_list-item'));
  if (!items.length) return;

  ScrollTrigger.matchMedia({
    '(min-width: 992px)': function () {
      if (!imageWrap) return;
      var bigImgs = Array.prototype.slice.call(imageWrap.querySelectorAll('.services_big-img'));
      if (!bigImgs.length) return;

      function setCurrent(index) {
        items.forEach(function (item, i) {
          var isCurrent = i === index;
          item.classList.toggle('current', isCurrent);
          var itemImg = item.querySelector('.services_list-item-img');
          if (itemImg) itemImg.classList.toggle('current', isCurrent);
        });
        bigImgs.forEach(function (img, i) {
          img.classList.toggle('current', i === index);
        });
      }

      // Наведение на карточки блокируется, пока идёт scale-анимация .services_image-wrap
      // (0 -> 100%), чтобы hover не переключал current до того, как фото встало на место.
      var imageWrapReady = false;

      var handlers = items.map(function (item, index) {
        var handler = function () {
          if (!imageWrapReady) return;
          setCurrent(index);
        };
        item.addEventListener('mouseenter', handler);
        return handler;
      });

      gsap.set(imageWrap, { transformOrigin: 'left bottom', scale: 0.1 });
      gsap.set(items, { yPercent: 100, opacity: 0 });

      // 2026-08-25 (ревизия): .services_image-wrap теперь скейлится 0.1 -> 1 НАПРЯМУЮ ПО СКРОЛУ
      // (scrub), а не time-based tween на 'top 10%' — по прямому запросу, за первые 50% скрола
      // секции (trigger: section, 'top top' -> 'bottom bottom', localProgress = self.progress/0.5,
      // clamp 1). Список .services_list-item появляется по очереди СРАЗУ ПОСЛЕ, когда scale
      // доходит до 1 (localProgress===1) — played reversible timeline, не сам scrub, тот же
      // gating-принцип, что и раньше: play() при пересечении отметки вперёд, reverse() назад.
      var itemsTl = gsap.timeline({ paused: true });
      itemsTl.to(items, {
        yPercent: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.1,
        clearProps: 'transform,opacity'
      });

      var scaleTrigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: function (self) {
          var localProgress = Math.min(self.progress / 0.5, 1);
          gsap.set(imageWrap, { scale: 0.1 + 0.9 * localProgress });
          if (localProgress >= 1 && !imageWrapReady) {
            imageWrapReady = true;
            itemsTl.play();
          } else if (localProgress < 1 && imageWrapReady) {
            imageWrapReady = false;
            itemsTl.reverse();
          }
        }
      });

      return function () {
        items.forEach(function (item, index) {
          item.removeEventListener('mouseenter', handlers[index]);
        });
        scaleTrigger.kill();
        itemsTl.kill();
        gsap.set(imageWrap, { clearProps: 'transform,transformOrigin' });
        gsap.set(items, { clearProps: 'transform,opacity' });
      };
    },

    '(max-width: 991px)': function () {
      gsap.set(items, { y: '2rem', opacity: 0 });

      var trigger = ScrollTrigger.create({
        trigger: list,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          gsap.to(items, {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
            stagger: 0.1,
            overwrite: true
          });
        }
      });

      return function () {
        trigger.kill();
        gsap.set(items, { clearProps: 'transform,opacity' });
      };
    }
  });
})();

// Idea: reveal контента секции. Секция осталась плавным потоком (без явной высоты) —
// предыдущая версия с .idea_title-pin/-runway была откачена: overflow:hidden 100vh-бокс обрезал
// двухстрочный заголовок (огромный font-size), а 250vh раннвея создавали пустой провал в скроле.
// **2026-08-25 (переписано на чистый scrub)**: по прямому запросу — "секция доходит до 25% от
// верхнего края - запускается анимация title-wrap, после них text-wrap, и дальше уже idea_bottom,
// всё зависит от скрола". ОДИН master-timeline, привязанный к ScrollTrigger (trigger: section,
// 'top top' -> 'bottom bottom', scrub:true) — три фазы идут ПОСЛЕДОВАТЕЛЬНО внутри одной шкалы
// прогресса 0..1 (позиции — доли общего скрола секции, не секунды):
//   0.00-0.25  — простой (ничего не происходит, секция ещё "въезжает")
//   0.25-0.50  — .idea_title-wrap (4шт, слайд снизу) + .idea_title (подъём+opacity) +
//                .idea_title-inner (раскрытие маски) — все три синхронно ('<'), стаггер внутри фазы
//   0.50-0.65  — .idea_top-text-wrap (3шт)
//   0.65-1.00  — .bottom_row внутри .idea_bottom (8шт)
// ease:'none' на всех твинах — стандарт для scrub-таймлайнов на этом сайте (линейная зависимость
// от позиции скрола, а не "своя" кривая ускорения, которая на scrub всё равно не считывается как
// анимация со своим временем). Раньше это были played-таймлайны с гейтинг-флагами именно потому,
// что предыдущий запрос был "НЕ привязывать к скролу" — теперь запрос обратный, поэтому чистый
// scrub тут корректен, а не "то, от чего раньше отказались": условия изменились.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var section = document.querySelector('.section-idea');
  if (!section) return;

  var titleWraps = Array.prototype.slice.call(section.querySelectorAll('.idea_title-wrap'));
  var titles = Array.prototype.slice.call(section.querySelectorAll('.idea_title'));
  var textWraps = Array.prototype.slice.call(section.querySelectorAll('.idea_top-text-wrap'));
  var rows = Array.prototype.slice.call(section.querySelectorAll('.bottom_row'));
  if (!titles.length) return;

  var titleInners = titles.map(function (title) {
    var inner = document.createElement('div');
    inner.className = 'idea_title-inner';
    while (title.firstChild) inner.appendChild(title.firstChild);
    title.appendChild(inner);
    title.style.overflow = 'hidden';
    return inner;
  });

  // 2026-08-25: y:'100vh' -> yPercent:100 по прямому запросу ("слишком резко") — 100vh почти
  // всегда сильно больше собственной высоты .idea_title-wrap, поэтому элемент пролетал куда
  // больший путь, чем нужно для честного "выезда снизу", и выглядел рывком. yPercent:100
  // отталкивается от РЕАЛЬНОЙ высоты самого элемента.
  gsap.set(titleWraps, { yPercent: 100 });
  gsap.set(titles, { y: '4rem', opacity: 0 });
  gsap.set(titleInners, { yPercent: 100 });
  gsap.set(textWraps, { y: '2rem', opacity: 0 });
  gsap.set(rows, { y: '2rem', opacity: 0 });

  var masterTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      // 2026-08-26: scrub:true -> scrub:0.5 по прямому запросу — при быстром скроле
      // (особенно фаза title-wrap, узкое окно 0.25-0.50) анимация "телепортировалась"
      // мгновенно к текущей позиции. Числовой scrub даёт лёгкое сглаживание/инерцию
      // без потери scroll-driven обратимости.
      scrub: 0.5
    }
  });

  masterTl
    // фаза text-wrap: окно 0.50-0.65 (span 0.15), 3 элемента
    .to(textWraps, { y: 0, opacity: 1, duration: 0.09, ease: 'none', stagger: 0.03 }, 0.5)
    // фаза idea_bottom: окно 0.65-1.0 (span 0.35), 8 элементов
    .to(rows, { y: 0, opacity: 1, duration: 0.15, ease: 'none', stagger: 0.02857 }, 0.65);

  // 2026-08-26: title-wrap ВЫНЕСЕН из master-таймлайна в свой отдельный scrub-триггер, привязанный
  // к .idea_top (обёртка 4 title-wrap + 3 text-wrap), а не к прогрессу всей секции — по прямому
  // запросу "анимация должна заканчиваться к середине экрана, а не к верхней части". Раньше фаза
  // была долей (0.25-0.50) от прогресса ВСЕЙ секции ('top top'->'bottom bottom' её собственных
  // ~1795px высоты) — а .idea_title-wrap лежит всего ~170px от начала .idea_top, поэтому её
  // "естественная" позиция достигает середины экрана уже на ~13% прогресса секции; докрутка до 50%
  // раньше означала кучу лишнего скрола, за который title-wrap успевал уехать к самому верху экрана
  // до срабатывания. Прямой trigger на сам .idea_top с end:'top 50%' завязан на его РЕАЛЬНУЮ позицию
  // во вьюпорте, а не на долю чужой (гораздо большей) секции — устойчиво к будущим изменениям высоты
  // секции/паддингов, ничего пересчитывать вручную не нужно.
  var ideaTop = section.querySelector('.idea_top');
  if (ideaTop) {
    var titleTl = gsap.timeline({
      scrollTrigger: {
        trigger: ideaTop,
        start: 'top bottom',
        end: 'top 50%',
        scrub: 0.5
      }
    });
    titleTl
      .to(titleWraps, { yPercent: 0, duration: 1, ease: 'none', stagger: 0.2 }, 0)
      .to(titles, { y: 0, opacity: 1, duration: 1, ease: 'none', stagger: 0.2 }, 0)
      .to(titleInners, { yPercent: 0, duration: 1, ease: 'none', stagger: 0.2 }, 0);
  }
})();

// Process наезжает на services тем же приёмом, что и раньше в цепочке секций
// (margin-top:-100vh + z-index — см. .section-process в стилях). Пока идёт наезд (top секции
// process от низа до верха вьюпорта), поверх .services_pin растёт затемняющий оверлей
// #252525 — из 0% в 50% opacity. Оверлей — обычный div, создаётся здесь же в рантайме,
// т.к. в Designer под это отдельного элемента нет.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var processSection = document.querySelector('.section-process');
  var servicesPin = document.querySelector('.services_pin');
  if (!processSection || !servicesPin) return;

  var overlay = document.createElement('div');
  overlay.className = 'services_darken-overlay';
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = '#252525';
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  servicesPin.appendChild(overlay);

  ScrollTrigger.create({
    trigger: processSection,
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: function (self) {
      overlay.style.opacity = String(self.progress * 0.5);
    }
  });
})();

// Process: контент .process_content появляется по очереди (slide-up + opacity) — в DOM-порядке
// это .process_text-wrap, .process_img, .process_text-wrap — триггер на top 50% (середина
// экрана), обратимый: onEnter -> play(), onLeaveBack -> reverse() (при скроле назад анимация
// откатывается). duration/stagger удвоены дважды (0.7->1.4->2.8, 0.15->0.3->0.6) — по двум
// последовательным запросам замедлить вдвое, элементы появлялись слишком резко.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var section = document.querySelector('.section-process');
  var content = document.querySelector('.process_content');
  if (!section || !content) return;

  var revealEls = Array.prototype.slice.call(content.children);
  if (!revealEls.length) return;

  gsap.set(revealEls, { y: '2rem', opacity: 0 });

  var revealTl = gsap.timeline({ paused: true });
  revealTl.to(revealEls, {
    y: 0,
    opacity: 1,
    duration: 2.8,
    ease: 'power2.out',
    stagger: 0.6
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    onEnter: function () { revealTl.play(); },
    onLeaveBack: function () { revealTl.reverse(); }
  });
})();

// Approach: 1) .approach_top **2026-08-25: теперь ПИНИТСЯ** — по прямому запросу "сначала
//    зафиксировался approach_top и внутри проиграла анимация title, потом уже приехали middle и
//    bottom без фиксации". Реализовано в рантайме (без Designer-элемента, тот же приём, что и
//    idea_title-inner/services-overlay/founder-mask): дети .approach_top (на деле только
//    .approach_title) переносятся в новый div.approach_top-pin (position:sticky;top:0;height:100vh;
//    overflow:hidden), на который также переехали исходные flex/alignment-стили самого
//    .approach_top (display:flex;flex-direction:column;justify-content:flex-start;
//    align-items:center;text-align:center — см. гочу про потерю display:grid/flex при переносе
//    детей в новую sticky-обёртку, применили тот же принцип и к flex). Сам .approach_top становится
//    рантайм-runway высотой 200vh (100vh под пин + 100vh скрола для дозаполнения текста), display
//    меняется на block, чтобы не конфликтовать с центрированием 100vh-ребёнка. .approach_title
//    заполняется побуквенно (opacity 0.25 -> 1) scrub'ом, ПРИВЯЗАННЫМ К RUNWAY (.approach_top,
//    start:'top top', end:'bottom bottom' — тот же приём, что вращение маски в Founder), а не к
//    самому titleEl — пока элемент запинен, его собственный bounding rect не двигается, поэтому
//    trigger:titleEl больше не может scrub'иться (та же причина, по которой это не работает для
//    любого запиненного контента на сайте). Прогресс заполнения синхронизирован так, что текст
//    дозаполняется ровно к моменту открепления. 2) прямые дети .approach_middle появляются по
//    очереди slide-up(2rem) + opacity, задержка 0.2с/длительность 1.2с, обратимый paused timeline
//    (onEnter -> play(), onLeaveBack -> reverse()), триггер на top 85% самого .approach_middle —
//    БЕЗ ИЗМЕНЕНИЙ, приезжает обычным потоком уже после того, как approach_top открепился.
// 3) прямые дети .approach_bottom (.approach_circle) появляются по очереди slide-up(100% своей
// высоты через yPercent — было 50%, увеличено по прямому запросу) + opacity — SCRUB, привязан к
// позиции скрола (ScrollTrigger start:'top 80%' на самом .approach_bottom, end:'+=60%', stagger 0.2).
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var approachTop = document.querySelector('.approach_top');
  var middle = document.querySelector('.approach_middle');
  var bottom = document.querySelector('.approach_bottom');

  if (approachTop) {
    var pin = document.createElement('div');
    pin.className = 'approach_top-pin';
    pin.style.position = 'sticky';
    pin.style.top = '0';
    pin.style.height = '100vh';
    pin.style.width = '100%';
    pin.style.overflow = 'hidden';
    pin.style.display = 'flex';
    pin.style.flexDirection = 'column';
    pin.style.justifyContent = 'flex-start';
    pin.style.alignItems = 'center';
    pin.style.textAlign = 'center';

    while (approachTop.firstChild) pin.appendChild(approachTop.firstChild);
    approachTop.appendChild(pin);

    approachTop.style.height = '200vh';
    approachTop.style.display = 'block';
    approachTop.style.position = 'relative';
  }

  var titleEl = document.querySelector('.approach_title');

  if (titleEl) {
    var textNodes = Array.prototype.slice.call(titleEl.childNodes);
    var chars = [];
    textNodes.forEach(function (node) {
      if (node.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      node.textContent.split('').forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'approach_title-char';
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      });
      node.parentNode.replaceChild(frag, node);
    });

    if (chars.length) {
      gsap.set(chars, { opacity: 0.25 });
      gsap.to(chars, {
        opacity: 1,
        ease: 'none',
        stagger: 0.05,
        scrollTrigger: {
          trigger: approachTop || titleEl,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true
        }
      });
    }
  }

  if (middle) {
    var middleItems = Array.prototype.slice.call(middle.children);
    if (middleItems.length) {
      gsap.set(middleItems, { y: '2rem', opacity: 0 });

      var middleTl = gsap.timeline({ paused: true });
      middleTl.to(middleItems, {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: 'power2.out',
        stagger: 0.2
      });

      ScrollTrigger.create({
        trigger: middle,
        start: 'top 85%',
        onEnter: function () { middleTl.play(); },
        onLeaveBack: function () { middleTl.reverse(); }
      });
    }
  }

  if (bottom) {
    var bottomItems = Array.prototype.slice.call(bottom.children);
    if (bottomItems.length) {
      gsap.set(bottomItems, { yPercent: 100, opacity: 0 });

      gsap.timeline({
        scrollTrigger: {
          trigger: bottom,
          start: 'top 80%',
          end: '+=60%',
          scrub: true
        }
      }).to(bottomItems, {
        yPercent: 0,
        opacity: 1,
        ease: 'none',
        stagger: 0.2
      });
    }
  }
})();

// Slider: смена слайдов по скролу — два независимых набора:
// 1) .slide-content (внутри .slider_content-grid) — current передаётся ЭКСКЛЮЗИВНО (снимается с
//    предыдущего элемента при появлении следующего) — это просто dim/undim текстового индикатора
//    (opacity), не позиционная анимация, менять здесь нечего.
// 2) .slider_img (внутри .slider_wrapper) — three-state FSM через классы: не пришёл (base,
//    translate 100%) -> current (0%) -> exited (translate -10%, новый комбо-класс). При onEnter
//    границы i: у slides[i-1] current МЕНЯЕТСЯ на exited (не накапливается вместе с current —
//    чистая замена класса, translate -10% симметрично сдвигает уходящий слайд влево ОДНОВРЕМЕННО
//    с приездом следующего), у slides[i] добавляется current. onLeaveBack — зеркально: current
//    снимается с i, exited меняется обратно на current у i-1 (возвращается на 0%). **2026-08-25:
//    exited-класс и его логика добавлены по прямому запросу** ("уходящий слайд смещается влево на
//    10% одновременно с приездом следующего") — до этого current с предыдущей картинки вообще не
//    снимался (см. историю ниже), теперь снимается и заменяется на exited.
// Секция даёт 100vh скрола на слайд + 100vh запаса в конце (высота .section-slider = кол-во
// слайдов * 100vh + 100vh, иначе 4й слайд приезжал прямо перед тем, как секция начинает открепляться).
// Переключение — на каждой границе в window.innerHeight, обратимо (onEnter/onLeaveBack), тем же
// приёмом start-функции с 'top+=Npx top', что и в horizon/echo. Граница 1->2 сдвинута на 50vh
// раньше остальных (slideOffset(1)) — по прямому запросу. Клик по любому .slide-content
// доскраливает (через тот же Lenis, что и якорные ссылки) ровно до границы этого слайда — со
// СВОИМИ duration:0.8/easing (не глобальные lenis-дефолты duration:1.2 + экспоненциальный easing
// с долгим затухающим хвостом), которые ощущались как медленный переход с задержкой — правка
// 2026-08-25 по жалобе пользователя.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var section = document.querySelector('.section-slider');
  var contents = Array.prototype.slice.call(document.querySelectorAll('.slider_content-grid .slide-content'));
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.slider_wrapper .slider_img'));
  if (!section || contents.length < 2 || imgs.length < 2) return;

  var count = Math.min(contents.length, imgs.length);

  function slideOffset(i) {
    var vh = window.innerHeight;
    return i === 1 ? vh * 0.5 : i * vh;
  }

  for (var i = 1; i < count; i++) {
    (function (i) {
      ScrollTrigger.create({
        trigger: section,
        start: function () { return 'top+=' + slideOffset(i) + ' top'; },
        onEnter: function () {
          contents[i - 1].classList.remove('current');
          contents[i].classList.add('current');
          imgs[i - 1].classList.remove('current');
          imgs[i - 1].classList.add('exited');
          imgs[i].classList.add('current');
        },
        onLeaveBack: function () {
          contents[i].classList.remove('current');
          contents[i - 1].classList.add('current');
          imgs[i].classList.remove('current');
          imgs[i - 1].classList.remove('exited');
          imgs[i - 1].classList.add('current');
        }
      });
    })(i);
  }

  function withLenis(cb) {
    if (!window.lenis) {
      requestAnimationFrame(function () { withLenis(cb); });
      return;
    }
    cb(window.lenis);
  }

  contents.forEach(function (content, j) {
    content.style.cursor = 'pointer';
    content.addEventListener('click', function () {
      withLenis(function (lenis) {
        var sectionTop = section.getBoundingClientRect().top + window.scrollY;
        var target = j === 0 ? sectionTop : sectionTop + slideOffset(j) + 2;
        lenis.scrollTo(target, {
          duration: 0.8,
          easing: function (t) { return 1 - Math.pow(1 - t, 3); }
        });
      });
    });
  });
})();

// News: .news_title и каждая .news_card появляются по скролу (slide-up 2rem + opacity) на
// СВОЁМ собственном триггере (top 70% экрана) — независимо друг от друга, без общего stagger,
// обратимо (onEnter -> play(), onLeaveBack -> reverse()). news_title теперь тоже часть этого
// набора анимируемых элементов — по прямому запросу.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var title = document.querySelector('.section-news .news_title');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.section-news .news_card'));
  var elements = (title ? [title] : []).concat(cards);
  if (!elements.length) return;

  elements.forEach(function (el) {
    gsap.set(el, { y: '2rem', opacity: 0 });

    var tl = gsap.timeline({ paused: true });
    tl.to(el, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      onEnter: function () { tl.play(); },
      onLeaveBack: function () { tl.reverse(); }
    });
  });
})();

// Founder: .founder_img остаётся ПОЛНОСТЬЮ статичным (без единой трансформации, без искажений) —
// видна только его часть, попадающая под SVG-маску, построенную в рантайме из геометрии двух
// .founder_mask-circle (сами div-круги теперь прозрачные — чисто геометрический ориентир, JS
// читает их реальный getBoundingClientRect и на resize пересчитывает). Вращается только
// содержимое маски (её внутренняя <g transform="rotate(...)">), а не фото и не сами div-круги —
// именно это "крутит узор и показывает скрытые части неподвижной фотографии", как просили.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var section = document.querySelector('.section-founder');
  var img = document.querySelector('.founder_img');
  var circles = Array.prototype.slice.call(document.querySelectorAll('.founder_mask-circle'));
  if (!section || !img || circles.length < 2) return;

  var svgNS = 'http://www.w3.org/2000/svg';
  var maskId = 'founder-mask-' + Math.random().toString(36).slice(2);

  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';

  var mask = document.createElementNS(svgNS, 'mask');
  mask.setAttribute('id', maskId);

  var group = document.createElementNS(svgNS, 'g');
  var svgCircles = circles.map(function () {
    var c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('fill', '#ffffff');
    group.appendChild(c);
    return c;
  });

  mask.appendChild(group);
  svg.appendChild(mask);
  document.body.appendChild(svg);

  img.style.maskImage = 'url(#' + maskId + ')';
  img.style.webkitMaskImage = 'url(#' + maskId + ')';
  img.style.maskRepeat = 'no-repeat';
  img.style.webkitMaskRepeat = 'no-repeat';

  var pivot = { x: 0, y: 0 };

  function layout() {
    var imgRect = img.getBoundingClientRect();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    circles.forEach(function (circle, i) {
      var r = circle.getBoundingClientRect();
      var cx = r.left + r.width / 2 - imgRect.left;
      var cy = r.top + r.height / 2 - imgRect.top;
      var radius = r.width / 2;
      svgCircles[i].setAttribute('cx', cx);
      svgCircles[i].setAttribute('cy', cy);
      svgCircles[i].setAttribute('r', radius);
      minX = Math.min(minX, cx - radius);
      maxX = Math.max(maxX, cx + radius);
      minY = Math.min(minY, cy - radius);
      maxY = Math.max(maxY, cy + radius);
    });

    pivot.x = (minX + maxX) / 2;
    pivot.y = (minY + maxY) / 2;
  }

  layout();
  window.addEventListener('resize', layout);
  // 2026-08-25 (фикс бага): .founder_img — loading="lazy" и находится в самом низу страницы
  // (~26000px), поэтому в момент первого layout() (сразу при выполнении скрипта, задолго до
  // того как пользователь реально доскроллит досюда) картинка браузером ЕЩЁ НЕ загружена —
  // её getBoundingClientRect() даёт width:0, из-за чего imgRect.left считается неверно (как
  // будто у 0-ширины бокса, по центру флекс-контейнера), а cx кругов — мимо реального центра
  // картинки. Итог: при вращении маски круги вылезают за левый край .founder_img и обрезаются
  // ("половина круга, съехавшая маска"). window 'load' НЕ помогает — lazy-картинка вне вьюпорта
  // не блокирует load вообще, грузится только когда пользователь доскроллит близко. Правильный
  // триггер — 'load' САМОЙ картинки (или img.complete, если она вдруг уже готова — например,
  // при повторном заходе из кэша браузера).
  if (img.complete && img.naturalWidth > 0) {
    layout();
  } else {
    img.addEventListener('load', layout, { once: true });
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: function (self) {
      var angle = self.progress * 180;
      group.setAttribute('transform', 'rotate(' + angle + ' ' + pivot.x + ' ' + pivot.y + ')');
    }
  });
})();

// Founder: reveal контента (title -> img-wrap -> footer), добавлено 2026-08-25 по прямому запросу.
// 1) .founder_title — slide-up(2rem) + opacity, duration:1.2 (удвоено с 0.6 2026-08-25 —
//    ощущалось слишком резким), обратимый paused timeline, триггер top 70% на самом
//    .founder_title (onEnter -> play(), onLeaveBack -> reverse() — реверс уже был реализован
//    изначально, часть той же introTl, что и img-wrap; отдельно проверено и подтверждено рабочим
//    2026-08-25 по запросу "сделай обратную анимацию для этого заголовка при скроле назад").
// 2) .founder_img-wrap — opacity + slide-up(yPercent:25->0, 25% ОТ СОБСТВЕННОЙ высоты — не
//    фиксированный rem/px), играет сразу следом за title ВНУТРИ ТОГО ЖЕ timeline (chained .to(),
//    без своего отдельного триггера) — соответствует формулировке "а потом .founder_img-wrap".
//    duration:2.4 (дважды удвоено 2026-08-25: 0.6 -> 1.2 -> 2.4, ощущалось слишком резким/быстрым
//    оба раза). Проверено через data_style_tool, что у класса нет своего Designer-transform —
//    yPercent можно применять напрямую (см. gotcha про composited transform в конце файла).
// 3) .founder_footer — slide-up(2rem) + opacity, свой отдельный обратимый timeline, триггер
//    top 90% на самом .founder_footer — НО играет только если img-wrap уже закончил появляться:
//    флаг imgWrapRevealed выставляется в onComplete/onReverseComplete у intro-timeline (title+img-wrap),
//    footer's onEnter проверяет флаг — если ещё не готов, просто помечает footerEntered=true и
//    ждёт, пока intro-timeline не выставит флаг и не запустит footer сама (тот же принцип
//    gating, что и imageWrapReady в Services).
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var titleEl = document.querySelector('.founder_title');
  var imgWrap = document.querySelector('.founder_img-wrap');
  var footerEl = document.querySelector('.founder_footer');
  if (!titleEl || !imgWrap || !footerEl) return;

  gsap.set(titleEl, { y: '2rem', opacity: 0 });
  gsap.set(imgWrap, { opacity: 0, yPercent: 25 });
  gsap.set(footerEl, { y: '2rem', opacity: 0 });

  var imgWrapRevealed = false;
  var footerEntered = false;

  var footerTl = gsap.timeline({ paused: true });
  footerTl.to(footerEl, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' });

  var introTl = gsap.timeline({
    paused: true,
    onComplete: function () {
      imgWrapRevealed = true;
      if (footerEntered) footerTl.play();
    },
    onReverseComplete: function () {
      imgWrapRevealed = false;
    }
  });

  introTl
    .to(titleEl, { y: 0, opacity: 1, duration: 1.2, ease: 'power2.out' })
    .to(imgWrap, { opacity: 1, yPercent: 0, duration: 2.4, ease: 'power2.out' });

  ScrollTrigger.create({
    trigger: titleEl,
    start: 'top 70%',
    onEnter: function () { introTl.play(); },
    onLeaveBack: function () { introTl.reverse(); }
  });

  ScrollTrigger.create({
    trigger: footerEl,
    start: 'top 90%',
    onEnter: function () {
      footerEntered = true;
      if (imgWrapRevealed) footerTl.play();
    },
    onLeaveBack: function () {
      footerEntered = false;
      footerTl.reverse();
    }
  });
})();

// Footer (.footer, id footer): .footer_left и .footer_contacts появляются по очереди
// slide-up(2rem) + opacity, задержка 0.2с, обратимый paused timeline (onEnter -> play(),
// onLeaveBack -> reverse()). Добавлено 2026-08-25, триггер менялся несколько раз тем же днём —
// см. историю версий файла для 'top 50%' / 'center bottom' / 'bottom bottom' / 'bottom 90%'.
// **2026-08-25 (фикс бага)**: 'bottom 90%' математически НЕДОСТИЖИМ для .footer — это последний
// элемент страницы (ничего ниже), поэтому на максимально возможном скроле его нижняя граница
// всегда останавливается РОВНО на 100% высоты вьюпорта (некуда скроллить дальше, чтобы дотянуть
// её до 90%) — trigger.progress навсегда застревал на 0, .footer_left/.footer_contacts оставались
// невидимыми (opacity:0 из gsap.set), а .footer_links с соцсетями — единственное, чего gsap.set
// вообще не касался — оставался всегда видимым. Пользователь это заметил как "видны только
// ссылки соцсетей". Правильный, недостижимости не подверженный вариант — 'top 90%' (тот же
// top-based идиом входа в кадр, что используется по всему сайту для остальных reveal-анимаций):
// срабатывает, когда верх футера достигает 90% вьюпорта, задолго до предела скролла страницы.
(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  var footer = document.querySelector('.footer');
  var footerLeft = document.querySelector('.footer_left');
  var footerContacts = document.querySelector('.footer_contacts');
  if (!footer || !footerLeft || !footerContacts) return;

  var els = [footerLeft, footerContacts];
  gsap.set(els, { y: '2rem', opacity: 0 });

  var footerRevealTl = gsap.timeline({ paused: true });
  footerRevealTl.to(els, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.2 });

  ScrollTrigger.create({
    trigger: footer,
    start: 'top 90%',
    onEnter: function () { footerRevealTl.play(); },
    onLeaveBack: function () { footerRevealTl.reverse(); }
  });
})();

// Открытие/закрытие мобильного/планшетного меню (.navbar_menu) — menu-btn открывает,
// navbar_close закрывает; visual-часть (translateX 100%→0) уже задана в стилях через
// комбо-класс .navbar_menu.opened, здесь только переключение класса.
(function () {
  var menuBtn = document.querySelector('.menu-btn');
  var closeBtn = document.querySelector('.navbar_close');
  var menu = document.querySelector('.navbar_menu');
  if (!menuBtn || !closeBtn || !menu) return;

  menuBtn.addEventListener('click', function () {
    menu.classList.add('opened');
  });

  closeBtn.addEventListener('click', function () {
    menu.classList.remove('opened');
  });
})();
