/**
 * House Principles (CAVIERA's Rumaya-inspired scroll principle) — one stable central title that
 * automatically changes as the user scrolls between four full-screen image rooms.
 *
 * FIX: the previous build used one IntersectionObserver per panel with `threshold: 0.5` against a
 * root shrunk by `rootMargin: '-40% 0px -40% 0px'`. For a panel that's ~100vh tall, the tallest that
 * shrunk root can ever be is ~20% of the viewport — so a panel's intersection ratio (measured
 * against its OWN full area) could never reach 0.5. The observer's threshold was never crossed for
 * panels 2-4, so the active index stayed wherever it first landed (Rarity) and never updated again.
 *
 * REPLACED with the deterministic calculation requested: on scroll, find whichever panel's own
 * vertical centre is closest to the viewport's vertical centre, and make that the active index.
 * Recomputed via one rAF-throttled scroll handler (never more than once per frame), and the handler
 * itself is only attached while this section is actually near the viewport (gated by a single,
 * generous IntersectionObserver on the SECTION as a whole, not the individual panels) — so there is
 * no continuous global scroll listener running for the rest of the page. Four getBoundingClientRect
 * reads per tick is negligible, and the DOM is only touched when the winning index actually changes.
 * Works identically scrolling up or down, since "closest to centre" is recalculated from scratch
 * every time, not derived from the previous state.
 *
 * Namespaced deliberately: only ever reads/writes data-house-code-active and the .is-ready class on
 * .caviera-house-codes. Never touches --caviera-progress, the hero's drag system, or any other
 * section's own state. Skips entirely under prefers-reduced-motion — the section already renders
 * completely and correctly without it (every panel carries its own always-visible local label; the
 * overlay itself is hidden outright in that case via CSS).
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initHouseCodes(section) {
    if (section.dataset.houseCodesBound) return;
    var panels = Array.prototype.slice.call(section.querySelectorAll('.caviera-house-codes__panel'));
    if (!panels.length) return;
    section.dataset.houseCodesBound = 'true';

    var current = section.getAttribute('data-house-code-active');
    var ticking = false;

    function update() {
      ticking = false;
      var viewportCenter = window.innerHeight * 0.5;
      var bestIndex = null;
      var bestDelta = Infinity;
      panels.forEach(function (panel) {
        var rect = panel.getBoundingClientRect();
        var panelCenter = rect.top + rect.height / 2;
        var delta = Math.abs(panelCenter - viewportCenter);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = panel.getAttribute('data-house-code-index');
        }
      });
      if (bestIndex !== null && bestIndex !== current) {
        current = bestIndex;
        section.setAttribute('data-house-code-active', bestIndex);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    // Only run the scroll handler while the section is actually near the viewport — a single,
    // generous observer on the section itself (not per-panel, and with no fragile threshold math),
    // purely to avoid a scroll listener running for the entire rest of the page.
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
      sectionObserver.observe(section);
    } else {
      // No IntersectionObserver support: fall back to a plain always-on listener rather than
      // never activating at all.
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }

    // Only now — once detection is actually wired up — let CSS visually step the local labels
    // aside in favour of the sticky overlay (see .caviera-house-codes.is-ready in the CSS).
    section.classList.add('is-ready');
  }

  function init(root) {
    root.querySelectorAll('.caviera-house-codes').forEach(initHouseCodes);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
