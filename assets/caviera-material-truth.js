/**
 * CAVIERA Material Truth — a restrained Drkst/Rumaya-inspired scroll progression, opt-in per
 * instance (only the homepage's "Material Truth" section carries [data-caviera-material-progress];
 * the Craftsmanship and House pages reuse the same section file without it, so this script simply
 * finds nothing to do there).
 *
 * REAL STICKY ARCHITECTURE (this round): earlier rounds deliberately removed position: sticky
 * entirely and approximated a "pinned" feel with a plain block + a hand-tuned viewport-relative
 * formula. This round reintroduces genuine position: sticky (see .caviera-craftsmanship__stage-
 * inner in assets/caviera-home.css — sticky, top: 0, height: 100svh, inside a taller ~130svh
 * .stage), per explicit request. With real sticky in play, desktop's progress formula is now the
 * standard sticky-scroll-progress calculation, not an approximation:
 *   - isActivated: stage.getBoundingClientRect().top <= 0 — this is the EXACT instant sticky
 *     visually engages (the browser itself won't stick .stage-inner to the viewport top until
 *     .stage's own top has scrolled up to it), so gating chapter progress on this same condition
 *     means chapter 01 is guaranteed active up to and including the moment sticky engages, and
 *     never before — no separate activation-distance constant to keep in sync with the CSS.
 *   - runway: stage.offsetHeight - vh — the real, measured scroll distance .stage-inner stays
 *     pinned for (~130svh outer - 100svh inner = ~30svh at typical viewports), not a guessed
 *     constant. Progress = -rect.top / (runway * (1 - HOLD_FRACTION)), clamped 0-1 — the
 *     (1 - HOLD_FRACTION) factor completes progress slightly before the runway itself is fully
 *     consumed, so the last HOLD_FRACTION (5%) of the actual sticky hold is a brief, deliberate
 *     pause with chapter 03 already fully active, before position: sticky releases on its own via
 *     ordinary CSS/layout mechanics (no JS "release" logic needed — once .stage's own bottom edge
 *     passes the viewport bottom, sticky simply stops, exactly like any position: sticky element).
 * Both checks are purely positional (rect.top vs. viewport, runway measured fresh every frame), no
 * stored/directional state, so scrolling upward naturally reverses through the same values and
 * re-entering the section from above always starts back at chapter 01 — nothing to reset by hand.
 *
 * TWO independent detection modes, matching the two very different desktop/mobile layouts of the
 * same three chapters:
 *   - Desktop (>=1024px, motion allowed): the three chapters sit SIDE BY SIDE (a wrapped row, not
 *     stacked), so "closest chapter to viewport centre" doesn't apply — they're all at the same Y
 *     position. Active state comes from the real sticky-progress formula described above. Writes
 *     --material-progress (drives the heading drift + progress rule) and data-material-state
 *     (0/1/2, thresholded at 0.34/0.68 per this round's explicit spec).
 *   - Mobile (<1024px): deliberately NOT converted to the sticky architecture — the full desktop
 *     composition (heading + framed video + three SIDE-BY-SIDE columns) cannot fit inside a single
 *     100dvh pinned room once the three chapters stack vertically instead, per this same section's
 *     own mobile layout (see caviera-home.css) — attempting it would either clip real copy or force
 *     a much taller mobile sticky hold, exactly the "long scroll trap" this round explicitly warns
 *     against. Per the brief's own explicit fallback ("if the full desktop composition cannot
 *     physically fit on mobile, preserve the existing mobile layout while using the same chapter-
 *     state logic"), mobile keeps its pre-existing, unconverted behaviour: no sticky, no extra
 *     height, chapters stack in normal flow, and the usual "closest chapter centre to a fixed
 *     viewport focal line" calculation (same principle as assets/caviera-object-focus.js) applies —
 *     gated behind the pre-existing ACTIVATION_FRACTION check first (chapter 01 forced until the
 *     section reaches its own composed viewing position), so mobile still can't arrive already on
 *     chapter 02.
 * Both modes are re-evaluated on resize, so crossing the breakpoint always lands in the correct one
 * — including undoing anything the previous mode had set.
 *
 * No wheel interception, no preventDefault, no scroll snapping — normal scroll is the only input.
 * Skips entirely under prefers-reduced-motion (the section already renders completely — every
 * chapter at full, equal opacity — without it; .stage-inner also isn't made sticky under reduced
 * motion, see caviera-home.css, so nothing pins for visitors who've asked for none of this).
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MIN_WIDTH = 1024;
  var STATE_1_THRESHOLD = 0.34;
  var STATE_2_THRESHOLD = 0.68;
  var HOLD_FRACTION = 0.05; // last 5% of the real sticky runway is a brief hold on chapter 03
  // Mobile-only — desktop's own activation check is now the real sticky engagement point
  // (rect.top <= 0), see isDesktopActivated() below.
  var ACTIVATION_FRACTION = 0.10; // section's top edge reaches ~10vh from the top of the viewport

  function initMaterialTruth(stage) {
    var list = stage.querySelector('.caviera-craftsmanship__list');
    var chapters = Array.prototype.slice.call(stage.querySelectorAll('.caviera-craftsmanship__row'));
    if (!list || !chapters.length) return;

    var current = -1;
    var ticking = false;
    var mode = null; // 'desktop' | 'mobile'

    function setActive(index) {
      if (index === current) return;
      current = index;
      chapters.forEach(function (chapter, i) {
        chapter.classList.toggle('is-active', i === index);
      });
    }

    // Mobile-only activation gate — true only once the section's own top edge has reached its
    // composed viewing position (ACTIVATION_FRACTION from the top of the viewport). Purely
    // positional, no stored state, so it re-evaluates correctly on every frame in either scroll
    // direction. Desktop uses its own, stricter gate (rect.top <= 0 — the real sticky engagement
    // point) directly inside updateDesktop() below.
    function isMobileActivated(rect, vh) {
      return rect.top <= vh * ACTIVATION_FRACTION;
    }

    function updateDesktop() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      if (rect.top > 0) {
        // .stage-inner hasn't stuck to the viewport top yet (position: sticky hasn't engaged) —
        // still entering. Chapter 01, no progress, full stop. Never lets 02/03 activate early.
        stage.style.setProperty('--material-progress', '0.0000');
        setActive(0);
        return;
      }
      // Real sticky runway: how far .stage's own top has scrolled past the viewport top is exactly
      // how far .stage-inner has left to travel before .stage's bottom edge reaches the viewport
      // bottom and sticky releases on its own. Measured fresh every frame (stage.offsetHeight), not
      // a guessed constant, so it always matches the CSS's actual ~130svh outer / 100svh inner
      // regardless of exact viewport height.
      var runway = stage.offsetHeight - vh;
      var effectiveRunway = runway * (1 - HOLD_FRACTION);
      var progress = effectiveRunway > 0 ? (-rect.top) / effectiveRunway : 0;
      progress = Math.max(0, Math.min(1, progress));
      stage.style.setProperty('--material-progress', progress.toFixed(4));
      var index = 0;
      if (progress >= STATE_2_THRESHOLD) index = 2;
      else if (progress >= STATE_1_THRESHOLD) index = 1;
      setActive(index);
    }

    function updateMobile() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      if (!isMobileActivated(rect, vh)) {
        // Mobile isn't sticky (see caviera-home.css) — this just confirms the section itself has
        // reached its composed viewing position before letting any chapter but 01 activate.
        setActive(0);
        return;
      }
      var focalY = vh * 0.5;
      var bestIndex = -1;
      var bestDelta = Infinity;
      chapters.forEach(function (chapter, i) {
        var chapterRect = chapter.getBoundingClientRect();
        var chapterCenter = chapterRect.top + chapterRect.height / 2;
        var delta = Math.abs(chapterCenter - focalY);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = i;
        }
      });
      if (bestIndex !== -1) setActive(bestIndex);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(mode === 'desktop' ? updateDesktop : updateMobile);
    }

    function enterMode(nextMode) {
      if (mode === nextMode) return;
      window.removeEventListener('scroll', onScroll);
      mode = nextMode;
      if (mode === 'desktop') {
        updateDesktop();
      } else {
        stage.style.removeProperty('--material-progress');
        updateMobile();
      }
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    function sync() {
      enterMode(window.innerWidth >= MIN_WIDTH ? 'desktop' : 'mobile');
    }

    // Only run the scroll handler while the section is actually near the viewport — a single,
    // generous observer on the stage itself, so the listener isn't running for the rest of the page.
    //
    // ROOT-CAUSE FIX (independent bug in this file, not a conflict with any other section's own
    // controller — assets/caviera-makers-mark.js was already structured correctly and needed no
    // change): this function previously called sync() unconditionally once more, right after this
    // if/else, regardless of IntersectionObserver support. That set `mode` to 'desktop' (or
    // 'mobile') and attached the scroll listener immediately on page load — before the observer had
    // ever confirmed the section was actually near the viewport. The observer's own first real
    // callback (almost always reporting isNear === false, since the page normally loads scrolled to
    // the top, far from this section) then removed that listener. Once the section later actually
    // approached and the observer reported isNear === true, sync() ran again — but since `mode` was
    // already 'desktop'/'mobile' from the earlier premature call, enterMode()'s own `if (mode ===
    // nextMode) return;` guard treated it as a no-op and never re-attached the listener. The result:
    // progress was computed exactly once, while the section was still off-screen, and never again —
    // reading as the animation "starting" and then freezing. Matches the exact same bug already
    // found and fixed in assets/caviera-oryx-crossing.js this project, and the same correct
    // structure assets/caviera-makers-mark.js already used: sync() is called ONLY inside the "no
    // IntersectionObserver support" fallback branch, never unconditionally afterward.
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          var isNear = entries.some(function (entry) { return entry.isIntersecting; });
          if (isNear) {
            sync();
          } else if (mode) {
            window.removeEventListener('scroll', onScroll);
          }
        },
        { rootMargin: '100% 0px 100% 0px' }
      );
      sectionObserver.observe(stage);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      sync();
    }

    var resizeTimer = null;
    window.addEventListener(
      'resize',
      function () {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(sync, 120);
      },
      { passive: true }
    );

    // Only now — once detection is actually wired up — let CSS dim the non-active chapters (see
    // [data-observing="true"] in caviera-home.css). Every chapter stays at full opacity until this
    // point, so a slow/blocked/failed script never leaves anything hard to read.
    list.setAttribute('data-observing', 'true');
  }

  function init(root) {
    root.querySelectorAll('[data-caviera-material-progress]').forEach(function (stage) {
      if (stage.dataset.materialBound) return;
      stage.dataset.materialBound = 'true';
      initMaterialTruth(stage);
    });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
