/**
 * Packaging ritual — Nolan Barret–style sticky object storytelling. The desktop visual stage is
 * already sticky via plain CSS (.caviera-ritual__stage-col, 1024px+, see caviera-home.css) — no
 * scroll-jacking, no forced position; it simply holds in view while the (taller) six-step story
 * scrolls past beside it, releasing normally once the story ends.
 *
 * This script decides which step is nearest the reading focus and reflects that in two places:
 *   1. .caviera-ritual__stage gets data-active-kind="<arrive|open|discover|unseal|reveal|keep>" —
 *      caviera-home.css crossfades the matching real visual state there (see
 *      snippets/caviera-ritual-stage-visual.liquid) — a real scene change per step, not just a
 *      container-level nudge.
 *   2. the matching <li class="caviera-ritual__step"> gets .is-active — caviera-home.css dims the
 *      other steps and grows the Cinnabar progress line to match.
 *
 * ROOT-CAUSE FIX: this previously used an IntersectionObserver with threshold: 0.5 and rootMargin:
 * '-40% 0px -40% 0px' — the same combination already found unreliable elsewhere in this project
 * once an observed element's height is a meaningful fraction of the viewport (see assets/caviera-
 * house-codes.js's own fix note). Replaced with the same deterministic "closest step centre to a
 * fixed viewport focal line" rAF calculation already proven in assets/caviera-object-focus.js —
 * recomputed from scratch every scroll frame, so it works identically scrolling up or down.
 *
 * Entirely optional: with no JS, or before it has run, the stage shows whichever kind the first
 * step block actually is (set server-side in Liquid, not merely a CSS default) and no step carries
 * .is-active — both render at a plain, fully-readable resting state either way. Skips entirely
 * under prefers-reduced-motion, matching every other scroll-driven effect in this theme — the
 * section already shows every step at full opacity and one representative visual without it.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initPackagingRitual(root) {
    if (root.dataset.ritualBound) return;
    var list = root.querySelector('[data-ritual-steps]');
    var steps = list ? Array.prototype.slice.call(list.querySelectorAll('.caviera-ritual__step')) : [];
    if (!list || !steps.length) return;
    root.dataset.ritualBound = 'true';

    var fill = root.querySelector('[data-ritual-progress-fill]');
    var stage = root.querySelector('.caviera-ritual__stage');

    var current = -1;
    var ticking = false;

    function setActive(index) {
      if (index === current) return;
      current = index;
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === index);
      });
      if (fill) {
        var pct = ((index + 1) / steps.length) * 100;
        fill.style.height = pct + '%';
      }
      if (stage) {
        var kind = steps[index] && steps[index].dataset.stageKind;
        if (kind) stage.setAttribute('data-active-kind', kind);
      }
    }

    function update() {
      ticking = false;
      // Focal line at ~50% viewport height — "the step nearest the reading focus", per brief.
      var focalY = window.innerHeight * 0.5;
      var bestIndex = -1;
      var bestDelta = Infinity;
      steps.forEach(function (step, i) {
        var rect = step.getBoundingClientRect();
        var stepCenter = rect.top + rect.height / 2;
        var delta = Math.abs(stepCenter - focalY);
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
      window.requestAnimationFrame(update);
    }

    // Only run the scroll handler while the section is actually near the viewport — a single,
    // generous observer on the section itself, so the listener isn't running for the rest of the
    // page.
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          var isNear = entries.some(function (entry) { return entry.isIntersecting; });
          if (isNear) {
            update();
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
          } else {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
          }
        },
        { rootMargin: '100% 0px 100% 0px' }
      );
      sectionObserver.observe(root);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }

    // Only now — once detection is actually wired up — let CSS dim the non-active steps (see
    // [data-observing="true"] in caviera-home.css). Every step stays at full opacity until this
    // point, so a slow/blocked/failed script never leaves anything hard to read.
    list.setAttribute('data-observing', 'true');
  }

  function init(root) {
    root.querySelectorAll('.caviera-ritual').forEach(initPackagingRitual);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
