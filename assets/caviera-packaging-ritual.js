/**
 * Packaging ritual — restrained "active step" enhancement only. Brightens the step nearest the
 * reading focus and grows a thin progression line to match. Entirely optional: every step is
 * marked up as plain, fully-readable content (see assets/caviera-home.css,
 * .caviera-ritual__step's default opacity: 1), and this script only ever adds emphasis — it never
 * hides, reorders, or requires anything to understand the section. No scroll-jacking, no forced
 * scroll position, no snapping. Respects prefers-reduced-motion by leaving the CSS transition
 * itself disabled (see the media query beside .caviera-ritual__step in caviera-home.css) — the
 * active class still applies instantly, content is never hidden either way.
 */
(function () {
  function initPackagingRitual(root) {
    var list = root.querySelector('[data-ritual-steps]');
    if (!list || list.dataset.observed) return;
    var steps = Array.prototype.slice.call(list.querySelectorAll('.caviera-ritual__step'));
    if (!steps.length || !('IntersectionObserver' in window)) return;
    list.dataset.observed = 'true';

    var fill = root.querySelector('[data-ritual-progress-fill]');

    function setActive(index) {
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === index);
      });
      if (fill && steps.length > 1) {
        var pct = (index / (steps.length - 1)) * 100;
        fill.style.height = pct + '%';
      }
    }

    var current = 0;
    setActive(current);

    var observer = new IntersectionObserver(
      function (entries) {
        // Pick whichever observed step is closest to the vertical centre of the viewport band
        // we're watching, rather than just "first intersecting" — steadier while scrolling
        // quickly past several short steps at once.
        var best = null;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        });
        if (best) {
          var index = steps.indexOf(best.target);
          if (index !== -1 && index !== current) {
            current = index;
            setActive(current);
          }
        }
      },
      { threshold: 0.5, rootMargin: '-40% 0px -40% 0px' }
    );
    steps.forEach(function (step) { observer.observe(step); });

    // Only now — once the observer is actually attached — switch on the CSS that dims inactive
    // steps. Before this point (or if IntersectionObserver were unsupported, handled by the early
    // return above) every step stays at full opacity.
    list.setAttribute('data-observing', 'true');
  }

  function init(root) {
    root.querySelectorAll('.caviera-ritual').forEach(initPackagingRitual);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
