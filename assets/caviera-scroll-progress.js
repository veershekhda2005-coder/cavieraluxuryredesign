/**
 * Shared scroll-progress driver for CAVIERA's pinned/sticky "moving through" sections (Hero,
 * Edition I teaser). An element marked [data-caviera-pin] is a tall wrapper containing sticky
 * content (see assets/caviera-home.css); as the wrapper scrolls through the viewport, this sets
 * --caviera-progress (0 at entry, 1 at exit) on the wrapper via rAF-throttled reads of
 * getBoundingClientRect. CSS alone decides what --caviera-progress does (transform/opacity via
 * calc()) — this file only ever measures and writes one custom property per element per frame,
 * never touching layout-triggering properties itself.
 *
 * Skips entirely under prefers-reduced-motion. Every consumer of --caviera-progress must use
 * `var(--caviera-progress, 0)` so the un-set (script-skipped or script-blocked) state renders a
 * complete, correct, static composition — never a half-applied effect.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var els = [];
  var ticking = false;

  function measure() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    els.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var total = rect.height - vh;
      var progress = total > 0 ? (0 - rect.top) / total : 0;
      progress = Math.max(0, Math.min(1, progress));
      el.style.setProperty('--caviera-progress', progress.toFixed(4));
    });
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measure);
  }

  function init(root) {
    var found = root.querySelectorAll('[data-caviera-pin]');
    found.forEach(function (el) {
      if (els.indexOf(el) === -1) els.push(el);
    });
  }

  init(document);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  measure();

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
    measure();
  });
})();
