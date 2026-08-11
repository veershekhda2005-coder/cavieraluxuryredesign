/**
 * CAVIERA quiet interlude — Bespoke invitation + client service strip. A dedicated, lightweight
 * IntersectionObserver controller (NOT the shared, one-shot [data-reveal] mechanism in
 * assets/caviera-global.js), because these two sections need something that reveal can't do:
 *
 * ROOT-CAUSE NOTE (why the previous pass was imperceptible): both sections previously relied on
 * the theme's generic [data-reveal] observer — threshold 0.15, rootMargin '0px 0px -60px 0px',
 * and critically it unobserves after firing ONCE. That meant: (a) it fired the instant a sliver of
 * the section entered view, well before the user was actually looking at it, so by the time they
 * were reading the section it had already finished animating: motion happened, just not while
 * anyone could see it happen; (b) the small transform deltas (8-18px) compounded the problem —
 * even a well-timed 10px rise is hard to register; (c) once fired, it never fires again, so
 * scrolling away and back showed a section already permanently in its resolved state. This file
 * fixes the mechanism (replayable, timed to when the section is actually being read, no reliance
 * on a page-load or first-scroll coincidence) — the CSS changes in assets/caviera-home.css then
 * make the resulting motion itself larger and clearly readable.
 *
 * Each observed section root gets:
 *   - data-motion-ready="true", added only once this script has actually initialised it —
 *     progressive enhancement: CSS in caviera-home.css gates every hidden/offset starting state
 *     behind this attribute, so without JS (or before it runs) everything renders at its plain,
 *     fully-visible resting state. Skipped entirely under prefers-reduced-motion, in which case
 *     this attribute is never added and nothing is ever hidden.
 *   - .is-active, added once ~20-30% of the section has entered the viewport (not 1px, not only
 *     once fully visible) and removed once the section has clearly, substantially left (not on
 *     every small fluctuation) — so scrolling away and returning replays the entrance.
 *   - .is-receding (Bespoke only), added while still active but visibly scrolling out past the top
 *     of the viewport, for the small "sense of passage" exit response — derived entirely from the
 *     IntersectionObserver's own entry.boundingClientRect and intersectionRatio, no separate
 *     scroll listener.
 */
(function () {
  var ENTER_RATIO = 0.28; // ~20-30% visible before entrance begins
  var EXIT_RATIO = 0.06; // clearly, substantially left before allowing a replay
  var RECEDE_RATIO = 0.6;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initSection(root, withRecede) {
    if (root.dataset.motionBound) return;
    root.dataset.motionBound = 'true';
    if (reduceMotion) return; // never set data-motion-ready — CSS default is already the final state

    root.setAttribute('data-motion-ready', 'true');
    var active = false;

    function handle(entries) {
      entries.forEach(function (entry) {
        var ratio = entry.intersectionRatio;
        if (!active && ratio >= ENTER_RATIO) {
          active = true;
          root.classList.add('is-active');
        } else if (active && ratio < EXIT_RATIO) {
          active = false;
          root.classList.remove('is-active');
          root.classList.remove('is-receding');
        }
        if (withRecede && active) {
          var recedingUp = entry.boundingClientRect.top < 0 && ratio < RECEDE_RATIO;
          root.classList.toggle('is-receding', recedingUp);
        }
      });
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(handle, {
        threshold: [0, EXIT_RATIO, ENTER_RATIO, RECEDE_RATIO, 1],
      });
      observer.observe(root);
    } else {
      // No IntersectionObserver support: show the resolved state outright rather than leaving the
      // section permanently in its hidden starting state.
      root.classList.add('is-active');
    }
  }

  function init(scope) {
    scope.querySelectorAll('.caviera-bespoke').forEach(function (el) { initSection(el, true); });
    scope.querySelectorAll('.caviera-services').forEach(function (el) { initSection(el, false); });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
