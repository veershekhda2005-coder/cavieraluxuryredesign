/**
 * House Codes — Rumaya-inspired scroll principle (large visual rooms + a central chapter title
 * that automatically changes as the user scrolls between rooms), translated for CAVIERA.
 *
 * Purely passive: one IntersectionObserver decides which room is nearest the reading centre and
 * writes data-active-code onto the stage — same technique as assets/caviera-object-focus.js and
 * assets/caviera-packaging-ritual.js. No wheel interception, no preventDefault, no forced scroll
 * position; the user simply scrolls the page normally and the sticky overlay (CSS-driven, see
 * caviera-home.css) reacts. Skips entirely under prefers-reduced-motion, matching every other
 * scroll-driven effect in this theme — the section already renders completely and correctly
 * without it (every room carries its own always-visible caption; the overlay itself is hidden
 * outright under reduced motion via CSS).
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initHouseCodes(stage) {
    if (stage.dataset.roomsObserved) return;
    var rooms = Array.prototype.slice.call(stage.querySelectorAll('.caviera-house-codes__room'));
    if (!rooms.length || !('IntersectionObserver' in window)) return;
    stage.dataset.roomsObserved = 'true';

    var current = stage.getAttribute('data-active-code');

    function setActive(code) {
      if (code === current) return;
      current = code;
      stage.setAttribute('data-active-code', code);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        // Closest-to-centre wins, not just "first intersecting" — steadier while scrolling quickly
        // past a room whose 85vh height is shorter than the viewport (same approach already used
        // by caviera-object-focus.js/caviera-packaging-ritual.js).
        var best = null;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        });
        if (best) {
          var code = best.target.getAttribute('data-house-code');
          if (code) setActive(code);
        }
      },
      { threshold: 0.5, rootMargin: '-40% 0px -40% 0px' }
    );
    rooms.forEach(function (room) { observer.observe(room); });
  }

  function init(root) {
    root.querySelectorAll('[data-caviera-house-codes]').forEach(initHouseCodes);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
