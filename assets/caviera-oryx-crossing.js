/**
 * CAVIERA Oryx threshold crossing — "The Oryx walks first. The House follows." One continuous
 * scroll-linked journey for the artwork itself (never redrawn, never cropped — moved and faded as
 * a single object via transform/opacity only), opt-in per instance (only the homepage's "oryx-
 * moment" instance carries [data-caviera-oryx-progress]; the Maker's Mark instance of this same
 * shared section file, and any other instance, render nothing for this script to find).
 *
 * Independent of Maker's Mark's own scroll_progression system on this same section file — a
 * separate wrapper attribute (data-caviera-oryx-progress, not data-caviera-editorial-progress) and
 * a separate, independently-named set of CSS custom properties (--oryx-*, not --maker-*-progress),
 * per this project's rule that every section keeps its own progress channel. This is also its own
 * fully namespaced controller (initOryx/init below, never a global initializer) using its own
 * passive scroll listener — it does not touch, replace, or remove any other section's
 * IntersectionObserver, rAF loop, or motion-ready class.
 *
 * TWO modes, matching this section's own 900px layout breakpoint:
 *   - Desktop (>=900px, motion allowed): the stage has real scroll height (.caviera-editorial__
 *     stage[data-caviera-oryx-progress], see caviera-home.css) with a sticky inner, so a simple
 *     rect-based progress calculation (0-1 across that pinned distance — same technique as assets/
 *     caviera-material-truth.js) drives the whole sequence. The artwork's own horizontal travel is
 *     expressed in vw (scales with the viewport, appropriate for a wide desktop composition).
 *   - Mobile (<900px): no sticky, no added height (per the brief — "not a long sticky scene") —
 *     progress instead comes from the Oryx artwork's own entry-to-exit position as it scrolls
 *     through the viewport in normal flow, so the movement still visibly responds to scroll without
 *     any pinning. Its own, smaller px-based travel range (not a scaled-down copy of the desktop
 *     vw values) — a phone viewport doesn't have desktop's wide margin to cross.
 * Both modes write the exact same set of custom properties onto the stage element, so the CSS in
 * caviera-home.css never needs to know which mode produced them:
 *   --oryx-x, --oryx-y, --oryx-scale, --oryx-opacity   (the artwork's own arrival -> crossing ->
 *     composure journey, piecewise-interpolated across three authored keyframes)
 *   --oryx-label-progress     (THE HOUSE label, resolves earliest and most quietly)
 *   --oryx-heading-progress   (headline, resolves shortly after the label)
 *   --oryx-body-progress      (body copy, resolves later, alongside the artwork's own crossing)
 * Every one of these is read in CSS with a ", <resolved value>" fallback, so with no JS — or under
 * prefers-reduced-motion, where this script returns immediately — the section renders its complete
 * final composed state with zero flash.
 *
 * No wheel interception, no preventDefault, no scroll snapping — normal scroll is the only input.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MIN_WIDTH = 900;

  // Three authored keyframes for the artwork itself — arrival, crossing, composure. Desktop's
  // horizontal travel is in vw; mobile's is in px (a phone viewport has no wide vw margin to
  // spare, so it gets its own, smaller, unit-appropriate range rather than a scaled vw copy).
  var DESKTOP_KEYFRAMES = {
    xUnit: 'vw',
    x: [7, 2, -2],
    y: [26, 8, 0], // px
    scale: [0.94, 0.985, 1.02],
    opacity: [0.34, 0.8, 1],
  };
  var MOBILE_KEYFRAMES = {
    xUnit: 'px',
    x: [30, 10, -5],
    y: [18, 6, 0], // px
    scale: [0.94, 0.98, 1],
    opacity: [0.32, 0.75, 1],
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  // Piecewise: first half interpolates keyframe 0 -> 1, second half interpolates 1 -> 2.
  function piecewise(triplet, p) {
    if (p <= 0.5) return lerp(triplet[0], triplet[1], p / 0.5);
    return lerp(triplet[1], triplet[2], (p - 0.5) / 0.5);
  }

  function mapRange(p, start, end) {
    if (end <= start) return p >= end ? 1 : 0;
    return clamp01((p - start) / (end - start));
  }

  function initOryx(stage) {
    var media = stage.querySelector('.caviera-editorial__media');
    if (!media) return;

    var mode = null; // 'desktop' | 'mobile'
    var ticking = false;

    function applyProgress(p, keyframes) {
      p = clamp01(p);
      stage.style.setProperty('--oryx-x', piecewise(keyframes.x, p).toFixed(3) + keyframes.xUnit);
      stage.style.setProperty('--oryx-y', piecewise(keyframes.y, p).toFixed(2) + 'px');
      stage.style.setProperty('--oryx-scale', piecewise(keyframes.scale, p).toFixed(4));
      stage.style.setProperty('--oryx-opacity', piecewise(keyframes.opacity, p).toFixed(3));
      // Named timeline windows, per the brief: label resolves earliest (0-0.15), then the
      // headline (0.10-0.35), then body copy later, alongside the artwork's own main crossing
      // (0.35-0.72) — three distinct, overlapping windows of the one raw progress value, not
      // everything resolving in lockstep.
      stage.style.setProperty('--oryx-label-progress', mapRange(p, 0, 0.15).toFixed(4));
      stage.style.setProperty('--oryx-heading-progress', mapRange(p, 0.1, 0.35).toFixed(4));
      stage.style.setProperty('--oryx-body-progress', mapRange(p, 0.35, 0.72).toFixed(4));
    }

    function updateDesktop() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      var p = total > 0 ? (0 - rect.top) / total : 0;
      applyProgress(p, DESKTOP_KEYFRAMES);
    }

    function updateMobile() {
      ticking = false;
      var rect = media.getBoundingClientRect();
      var vh = window.innerHeight;
      // Standard entry-to-exit progress for an element scrolling through the viewport in normal
      // flow: 0 as its top just touches the bottom edge, 1 as its bottom just clears the top edge.
      var total = vh + rect.height;
      var p = total > 0 ? (vh - rect.top) / total : 0;
      applyProgress(p, MOBILE_KEYFRAMES);
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
      if (mode === 'desktop') updateDesktop();
      else updateMobile();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    function sync() {
      enterMode(window.innerWidth >= MIN_WIDTH ? 'desktop' : 'mobile');
    }

    // Only run the scroll handler while the section is actually near the viewport — a single,
    // generous observer, so the listener isn't running for the rest of the page. This observer is
    // scoped to this stage element only; it does not replace or interfere with any other
    // section's own observer.
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          var isNear = entries.some(function (entry) { return entry.isIntersecting; });
          if (isNear) {
            sync();
          } else {
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
    window.addEventListener(
      'orientationchange',
      function () {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(sync, 120);
      },
      { passive: true }
    );

    sync();
  }

  function init(root) {
    root.querySelectorAll('[data-caviera-oryx-progress]').forEach(function (stage) {
      if (stage.dataset.oryxBound) return;
      stage.dataset.oryxBound = 'true';
      initOryx(stage);
    });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
