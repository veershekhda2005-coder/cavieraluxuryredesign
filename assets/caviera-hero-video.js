/**
 * CAVIERA hero bundled video — two small, deliberately narrow jobs, nothing else:
 *
 * 1. Reliable autoplay: the `muted` HTML attribute alone is normally sufficient for autoplay across
 *    current browsers, but re-asserting the property directly (video.muted = true) is a cheap,
 *    zero-risk belt-and-braces guarantee some environments are known to need — never touched again
 *    after this, never unmuted.
 * 2. Reduced motion: assets/caviera-home.css already hides [data-caviera-hero-video] and shows the
 *    static poster <img> instead under prefers-reduced-motion: reduce — but that's a CSS display
 *    swap only. The video's own `autoplay` attribute starts playback the instant the element is
 *    parsed, before any script (including this one) runs, and simply hiding an element with CSS
 *    does not stop a browser from continuing to decode/play it unseen. This pauses it outright for
 *    those visitors, so "prefers the static poster" means nothing is actually playing, not just
 *    nothing visible.
 *
 * No scroll listener, no drag, no library — this file does only the above. Not shared with any
 * other section; sections/caviera-hero.liquid only loads this script when the bundled video can
 * actually render (see use_bundled_desktop there).
 */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-caviera-hero-video]').forEach(function (video) {
    if (reduceMotion) {
      // Belt-and-braces alongside the CSS display swap — stop actual playback, not just visibility.
      video.pause();
      video.removeAttribute('autoplay');
      return;
    }
    video.muted = true;
    var playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      // Autoplay can still be rejected by browser policy in some contexts (e.g. low-power mode) —
      // the poster attribute already covers that visually; nothing further to do here but avoid an
      // unhandled rejection in the console.
      playAttempt.catch(function () {});
    }
  });
})();
