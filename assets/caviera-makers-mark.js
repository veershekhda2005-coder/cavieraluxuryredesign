/**
 * CAVIERA Maker's Mark — a restrained, continuous scroll-linked reveal for the House Seal,
 * headline/copy and Edition record, opt-in per instance (only the homepage's "Maker's Mark"
 * section carries [data-caviera-editorial-progress]; the Oryx moment and any other instance of
 * this shared section reuse the same section file without it, so this script simply finds nothing
 * to do there).
 *
 * ROOT-CAUSE NOTE: the section previously relied only on the theme's generic, one-shot
 * [data-reveal] IntersectionObserver (assets/caviera-global.js — threshold 0.15, unobserves after
 * firing once). That reveal was real, but it fired once, briefly, near entry and then did nothing
 * for the rest of the scroll through the section — there was no continuous progress driver at all.
 * This file adds one, independent of every other section's own progress variable.
 *
 * TWO independent modes, matching this section's own 900px layout breakpoint:
 *   - Desktop (>=900px, motion allowed): the stage is given real scroll height (see
 *     .caviera-editorial__stage in caviera-home.css) with a sticky inner, so a simple rect-based
 *     progress calculation (same technique as assets/caviera-material-truth.js) yields a smooth
 *     0-1 value across that pinned distance. Three overlapping, independently-eased channels are
 *     derived from it and written as CSS custom properties:
 *       --maker-seal-progress       (House Seal arrives + resolves,      ~0.20 - 0.65)
 *       --maker-headline-progress   (headline/eyebrow/body reach full,   ~0.45 - 0.80)
 *       --maker-provenance-progress (Edition record resolves,            ~0.65 - 1.00)
 *   - Mobile (<900px): no sticky, no extra section height, no scroll trap — a single, lightweight
 *     entry-based reveal instead (IntersectionObserver, fires once), staggered via CSS
 *     transition-delay rather than scroll position.
 * Both modes are re-evaluated on resize.
 *
 * No wheel interception, no preventDefault, no scroll snapping. Skips entirely under
 * prefers-reduced-motion — the section already renders its complete final composition without it,
 * since every CSS custom property above is read with a `, 1` (fully resolved) fallback.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MIN_WIDTH = 900;

  // Overlapping progress ranges, in the stage's own 0-1 scroll progress.
  var SEAL_START = 0.2, SEAL_END = 0.65;
  var HEADLINE_START = 0.45, HEADLINE_END = 0.8;
  var PROVENANCE_START = 0.65, PROVENANCE_END = 1.0;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function mapRange(value, start, end) {
    if (end <= start) return value >= end ? 1 : 0;
    var t = (value - start) / (end - start);
    if (t < 0) return 0;
    if (t > 1) return 1;
    return t;
  }

  function initMakersMark(stage) {
    var mode = null; // 'desktop' | 'mobile'
    var ticking = false;
    var sectionObserver = null;
    var entryObserver = null;

    function updateDesktop() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      var progress = total > 0 ? (0 - rect.top) / total : 0;
      progress = Math.max(0, Math.min(1, progress));

      var seal = easeOutCubic(mapRange(progress, SEAL_START, SEAL_END));
      var headline = easeOutCubic(mapRange(progress, HEADLINE_START, HEADLINE_END));
      var provenance = easeOutCubic(mapRange(progress, PROVENANCE_START, PROVENANCE_END));

      stage.style.setProperty('--maker-seal-progress', seal.toFixed(4));
      stage.style.setProperty('--maker-headline-progress', headline.toFixed(4));
      stage.style.setProperty('--maker-provenance-progress', provenance.toFixed(4));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateDesktop);
    }

    function teardownDesktop() {
      window.removeEventListener('scroll', onScroll);
      stage.style.removeProperty('--maker-seal-progress');
      stage.style.removeProperty('--maker-headline-progress');
      stage.style.removeProperty('--maker-provenance-progress');
    }

    function setupMobile() {
      // Progressive-enhancement marker: only now, once JS has confirmed it can actually observe
      // entry, does CSS apply the quiet starting state (see [data-mobile-ready] in caviera-home.css)
      // — a slow/blocked/failed script simply never sets this, and the section stays fully visible.
      stage.setAttribute('data-mobile-ready', 'true');
      if (!('IntersectionObserver' in window)) {
        stage.setAttribute('data-mobile-entered', 'true');
        return;
      }
      entryObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              stage.setAttribute('data-mobile-entered', 'true');
              entryObserver.disconnect();
            }
          });
        },
        { threshold: 0.25 }
      );
      entryObserver.observe(stage);
    }

    function teardownMobile() {
      if (entryObserver) {
        entryObserver.disconnect();
        entryObserver = null;
      }
      stage.removeAttribute('data-mobile-ready');
      stage.removeAttribute('data-mobile-entered');
    }

    function enterMode(nextMode) {
      if (mode === nextMode) return;
      if (mode === 'desktop') teardownDesktop();
      if (mode === 'mobile') teardownMobile();
      mode = nextMode;
      if (mode === 'desktop') {
        window.addEventListener('scroll', onScroll, { passive: true });
        updateDesktop();
      } else {
        setupMobile();
      }
    }

    function sync() {
      enterMode(window.innerWidth >= MIN_WIDTH ? 'desktop' : 'mobile');
    }

    // Gate the desktop scroll handler (and give the mobile observer something bounded to watch)
    // only while the section is actually near the viewport — a single, generous observer, so
    // nothing runs for the rest of the page.
    if ('IntersectionObserver' in window) {
      sectionObserver = new IntersectionObserver(
        function (entries) {
          var isNear = entries.some(function (entry) { return entry.isIntersecting; });
          if (isNear) {
            sync();
          } else if (mode === 'desktop') {
            window.removeEventListener('scroll', onScroll);
          }
        },
        { rootMargin: '100% 0px 100% 0px' }
      );
      sectionObserver.observe(stage);
    } else {
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
  }

  function init(root) {
    root.querySelectorAll('[data-caviera-editorial-progress]').forEach(function (stage) {
      if (stage.dataset.makersMarkBound) return;
      stage.dataset.makersMarkBound = 'true';
      initMakersMark(stage);
    });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
