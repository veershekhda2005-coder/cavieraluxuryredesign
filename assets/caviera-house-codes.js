/**
 * House Codes — Rumaya-inspired scroll principle (large visual rooms + a central chapter title
 * that automatically changes as the user scrolls between them), translated for CAVIERA.
 *
 * Purely passive: one IntersectionObserver decides which panel is nearest the reading centre and
 * writes data-house-code-active onto the section itself — same technique as
 * assets/caviera-object-focus.js and assets/caviera-packaging-ritual.js. No wheel interception, no
 * preventDefault, no forced scroll position, no mapping of vertical movement to anything else; the
 * user simply scrolls the page normally and the sticky overlay (CSS-driven, see
 * assets/caviera-house-codes.css) reacts.
 *
 * Namespaced deliberately: only ever reads/writes data-house-code-active and the .is-ready class on
 * .caviera-house-codes. Never touches --caviera-progress, the hero's drag system, or any other
 * section's own state.
 *
 * Progressive enhancement: `.is-ready` is added to the section ONLY once the observer has actually
 * attached below — never optimistically, so a script that fails partway through (or never loads at
 * all) leaves every panel's own always-visible local label exactly as it was, never blank. Skips
 * entirely under prefers-reduced-motion — the section already renders completely and correctly
 * without it (see the CSS gate that hides the overlay outright in that case).
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initHouseCodes(section) {
    if (section.dataset.houseCodesObserved) return;
    var panels = Array.prototype.slice.call(section.querySelectorAll('.caviera-house-codes__panel'));
    if (!panels.length || !('IntersectionObserver' in window)) return;
    section.dataset.houseCodesObserved = 'true';

    var current = section.getAttribute('data-house-code-active');

    function setActive(index) {
      if (index === current) return;
      current = index;
      section.setAttribute('data-house-code-active', index);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        // Closest-to-centre wins, not just "first intersecting" — steadier while scrolling quickly
        // past a panel whose height is close to the viewport's own (same approach already used by
        // caviera-object-focus.js/caviera-packaging-ritual.js).
        var best = null;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        });
        if (best) {
          var index = best.target.getAttribute('data-house-code-index');
          if (index !== null) setActive(index);
        }
      },
      { threshold: 0.5, rootMargin: '-40% 0px -40% 0px' }
    );
    panels.forEach(function (panel) { observer.observe(panel); });

    // Only now — once the observer is actually attached — let CSS visually step the local labels
    // aside in favour of the sticky overlay (see .caviera-house-codes.is-ready in the CSS).
    section.classList.add('is-ready');
  }

  function init(root) {
    root.querySelectorAll('.caviera-house-codes').forEach(initHouseCodes);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
