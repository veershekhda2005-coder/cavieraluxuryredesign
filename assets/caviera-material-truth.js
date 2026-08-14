/**
 * CAVIERA Material Truth — a restrained Drkst/Rumaya-inspired scroll progression, opt-in per
 * instance (only the homepage's "Material Truth" section carries [data-caviera-material-progress];
 * the Craftsmanship and House pages reuse the same section file without it, so this script simply
 * finds nothing to do there).
 *
 * ACTIVATION-POINT FIX (this round): the previous progress formula counted the section's ENTRANCE
 * travel (scrolling up from fully-below-the-viewport to on-screen) as part of chapter progress —
 * total = rect.height + vh, progress = (vh - rect.top) / total. By the time the section was
 * actually fully composed on screen (top near the top of the viewport), a large fraction of that
 * total distance had already elapsed purely from the entrance, so progress had already sailed past
 * the first chapter's threshold before the visitor could really see the section at all — arriving
 * on "02 Stone Setting" the instant it became properly visible. Fixed by splitting position into
 * two phases instead of one continuous entrance-to-exit measure:
 *   1. BEFORE the section's top edge reaches ACTIVATION_FRACTION (10vh, within the requested
 *      8-12vh) from the top of the viewport — chapter 01 is forced active and progress is forced
 *      to 0, full stop. No chapter can ever activate while the section is still entering.
 *   2. ONCE that activation point is reached, a fresh LOCAL progress value starts at exactly 0
 *      there and advances to 1 over RUNWAY_FRACTION (35vh, within the requested 30-40vh) of
 *      further scrolling — not the section's own full height, a fixed, short, deliberate runway.
 * Both checks are purely positional (rect.top vs. viewport), re-evaluated every frame with no
 * stored/directional state, so scrolling upward naturally reverses through the same values and
 * re-entering the section from above always starts back at chapter 01 — nothing to reset by hand.
 *
 * TWO independent detection modes, matching the two very different desktop/mobile layouts of the
 * same three chapters:
 *   - Desktop (>=1024px, motion allowed): the three chapters sit SIDE BY SIDE (a wrapped row, not
 *     stacked), so "closest chapter to viewport centre" doesn't apply — they're all at the same Y
 *     position. Active state comes from the local activation-point progress described above.
 *     Writes --material-progress (drives the heading drift + progress rule) and data-material-
 *     state (0/1/2, thresholded at 0.38/0.72 — chapter 03 deliberately moved later in the runway
 *     so it isn't sitting "already done" for a large share of the section's remaining scroll).
 *   - Mobile (<1024px): chapters stack vertically in normal flow with no sticky/extra height, so
 *     the usual "closest chapter centre to a fixed viewport focal line" calculation (same principle
 *     as assets/caviera-object-focus.js) applies — but gated behind the SAME activation check first
 *     (chapter 01 forced until the section reaches its own composed viewing position), so mobile
 *     can't arrive already on chapter 02 either.
 * Both modes are re-evaluated on resize, so crossing the breakpoint always lands in the correct one
 * — including undoing anything the previous mode had set.
 *
 * No wheel interception, no preventDefault, no scroll snapping — normal scroll is the only input.
 * Skips entirely under prefers-reduced-motion (the section already renders completely — every
 * chapter at full, equal opacity — without it).
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MIN_WIDTH = 1024;
  var STATE_1_THRESHOLD = 0.38;
  var STATE_2_THRESHOLD = 0.72;
  // Fractions of the current viewport height — re-evaluated every frame, so these scale correctly
  // with window size rather than being fixed pixel values.
  var ACTIVATION_FRACTION = 0.10; // section's top edge reaches ~10vh from the top of the viewport
  var RUNWAY_FRACTION = 0.35; // then 01 -> 02 -> 03 completes over this much further scrolling

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

    // Shared activation gate — true only once the section's own top edge has reached its composed
    // viewing position (ACTIVATION_FRACTION from the top of the viewport). Purely positional, no
    // stored state, so it re-evaluates correctly on every frame in either scroll direction.
    function isActivated(rect, vh) {
      return rect.top <= vh * ACTIVATION_FRACTION;
    }

    function updateDesktop() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      if (!isActivated(rect, vh)) {
        // Still entering — chapter 01, no progress, full stop. Never lets 02/03 activate early.
        stage.style.setProperty('--material-progress', '0.0000');
        setActive(0);
        return;
      }
      // Local progress: 0 exactly at the activation point, 1 after RUNWAY_FRACTION of further
      // scrolling — a fixed, short runway, not the section's own full height.
      var activationOffset = vh * ACTIVATION_FRACTION;
      var runway = vh * RUNWAY_FRACTION;
      var progress = runway > 0 ? (activationOffset - rect.top) / runway : 0;
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
      if (!isActivated(rect, vh)) {
        // Same gate as desktop — the section itself hasn't reached its composed viewing position
        // yet, so chapter 01 stays forced regardless of where individual chapter rows sit.
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
