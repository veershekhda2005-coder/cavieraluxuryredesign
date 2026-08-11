/**
 * CAVIERA Edition I — Bureau Nine-style horizontal exhibition. Normal vertical page scroll drives
 * horizontal translation of the exhibition track; nothing here intercepts the wheel or calls
 * preventDefault on scrolling — vertical scroll position is the only source of truth, so scrolling
 * up always reverses the track exactly, and both edges release into ordinary vertical scrolling
 * (into House Principles above, or Object in focus below) with no trap.
 *
 * Entirely independent of House Principles (sections/caviera-house-codes.liquid): different custom
 * property (--edition-exhibition-progress, never --house-code-progress or the hero/old Edition's
 * own --caviera-progress), different data attributes, no shared state of any kind.
 *
 * Activates ONLY at >=1024px with prefers-reduced-motion: no-preference — matching exactly the
 * media query in assets/caviera-edition-exhibition.css that switches the SAME markup from a plain
 * vertical stack into the sticky horizontal exhibition. Below that width, or under reduced motion,
 * this script deliberately does nothing (and undoes anything it had previously set, if the
 * viewport is resized across the breakpoint) — the section is already complete and correct as a
 * static stack without it.
 */
(function () {
  var MIN_WIDTH = 1024;
  var MIN_VH_MULT = 2.5; // 250vh floor for the vertical scroll distance
  var MAX_VH_MULT = 4; // 400vh ceiling

  function shouldActivate() {
    return (
      window.innerWidth >= MIN_WIDTH &&
      !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );
  }

  function initExhibition(wrapper) {
    var viewport = wrapper.querySelector('.caviera-edition-teaser__viewport');
    var track = wrapper.querySelector('.caviera-edition-teaser__track');
    if (!viewport || !track) return;

    var active = false;
    var horizontalTravelDistance = 0;
    var ticking = false;

    // Calculated once per measure() call from the track's actual rendered geometry — never a
    // guessed vw number. Recomputed on resize, never inside the scroll handler itself.
    function measure() {
      horizontalTravelDistance = Math.max(0, track.scrollWidth - viewport.clientWidth);
      var vh = window.innerHeight;
      var verticalDistance = Math.min(Math.max(horizontalTravelDistance, vh * MIN_VH_MULT), vh * MAX_VH_MULT);
      wrapper.style.height = (vh + verticalDistance) + 'px';
    }

    function update() {
      ticking = false;
      var rect = wrapper.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      var progress = total > 0 ? (0 - rect.top) / total : 0;
      progress = Math.max(0, Math.min(1, progress));
      track.style.transform = 'translate3d(' + (-progress * horizontalTravelDistance) + 'px, 0, 0)';
      wrapper.style.setProperty('--edition-exhibition-progress', progress.toFixed(4));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    function activate() {
      if (active) return;
      active = true;
      measure();
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    function deactivate() {
      if (!active) return;
      active = false;
      window.removeEventListener('scroll', onScroll);
      // Undo everything this script set — the CSS stacked-mode fallback needs a plain, un-styled
      // wrapper/track to lay out correctly (e.g. after a resize down past the breakpoint).
      wrapper.style.height = '';
      wrapper.style.removeProperty('--edition-exhibition-progress');
      track.style.transform = '';
    }

    function sync() {
      if (shouldActivate()) activate();
      else deactivate();
    }

    var resizeTimer = null;
    window.addEventListener(
      'resize',
      function () {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
          if (active) measure();
          sync();
        }, 120);
      },
      { passive: true }
    );

    sync();
  }

  function init(root) {
    root.querySelectorAll('[data-caviera-edition-exhibition]').forEach(function (wrapper) {
      if (wrapper.dataset.exhibitionBound) return;
      wrapper.dataset.exhibitionBound = 'true';
      initExhibition(wrapper);
    });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
