/**
 * CAVIERA Material Truth — continuous looping background craftsmanship video.
 *
 * Deliberately NOT scroll-linked, NOT time-scrubbed, and NOT connected to Material Truth's own
 * scroll-progress controller (assets/caviera-material-truth.js — untouched, not even read by this
 * file). The video simply plays continuously and loops via the native `loop` attribute; the only
 * job of this script is to start/pause it based on whether the section is anywhere near the
 * viewport, purely for performance (a ~50MB, 90-second file has no reason to ever download or
 * decode while the visitor is still reading the Hero). This is intentionally the smallest possible
 * mechanism — one IntersectionObserver, no scroll listener, no requestAnimationFrame loop — so it
 * cannot compete with, or interfere with, Material Truth's or Maker's Mark's own independent
 * controllers.
 *
 * Resuming: play()/pause() never touch currentTime, so leaving and returning to the section
 * resumes exactly where the video was, never restarting from zero.
 *
 * Reduced motion: skips entirely (the video is simply never started) — see the matching CSS rule
 * in assets/caviera-home.css that also hides the (unplayed) video element itself, leaving only the
 * Obsidian overlay, per the brief's "static frame" fallback.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function init(root) {
    root.querySelectorAll('[data-craftsmanship-process-video]').forEach(function (wrapper) {
      if (wrapper.dataset.processVideoBound) return;
      wrapper.dataset.processVideoBound = 'true';

      var video = wrapper.querySelector('video');
      if (!video) return;

      // The video wrapper is now a direct child of the outer <section> (moved there so it can
      // cover the section's own padding band too, not just .stage — see sections/caviera-
      // craftsmanship.liquid) rather than nested inside .stage, so that's the correct visibility
      // target now; .stage is no longer an ancestor of this wrapper at all.
      var stage = wrapper.closest('.caviera-craftsmanship') || wrapper;

      if (!('IntersectionObserver' in window)) {
        // No observer support — fail open to plain continuous playback rather than never playing.
        video.play().catch(function () {});
        return;
      }

      // Generous rootMargin: starts loading/playing a little before the section actually arrives,
      // and only pauses once it's genuinely well outside the viewport in either direction — per
      // the brief's own "prepare shortly before it approaches, pause only when far outside".
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              video.play().catch(function () {});
            } else {
              video.pause();
            }
          });
        },
        { rootMargin: '100% 0px 100% 0px' }
      );
      observer.observe(stage);
    });
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
