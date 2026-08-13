/**
 * CAVIERA ceremonial loader — MENU → THE HOUSE revision (CAVIERA Grand Theme 2026)
 *
 * IMPORTANT CHANGE from the previous revision: this no longer activates automatically on page
 * load/refresh, and carries no sessionStorage "once per session" logic at all — both were removed
 * entirely, on purpose, for this use case. It is now a small reusable public API,
 * window.CaviearaLoader.show(onComplete), called ONLY from the full-screen menu's THE HOUSE click
 * handler (see assets/caviera-header.js) — never on its own, never for any other link.
 *
 * Safety guarantees (every path is idempotent and always reaches onComplete exactly once):
 * - assets/caviera-loader.css defaults the root to `display: none` — if this script never loads
 *   at all, window.CaviearaLoader simply doesn't exist; the header's click handler already checks
 *   for that and fails open straight to native navigation (see assets/caviera-header.js).
 * - prefers-reduced-motion: reduce — never forces the walk; calls onComplete immediately so
 *   navigation to The House proceeds at once. Navigation is never blocked by this loader.
 * - Video error/stalled, or the autoplay play() promise rejecting — finish immediately rather than
 *   holding on a broken/frozen frame.
 * - A hard safety timeout (SAFETY_MS) always finishes no matter what, even if no video event ever
 *   fires and the video never even starts loading.
 * - Body/html scroll-lock is applied only while visibly active and is always removed once finished.
 */
(function () {
  var loader = document.querySelector('[data-caviera-loader]');
  if (!loader) return;

  var video = loader.querySelector('[data-loader-video]');
  if (!video) return;

  var FADE_MS = 600; // within the requested ~500-650ms exit fade
  var SAFETY_MS = 3500; // hard ceiling, per this revision's own ~3.5s maximum
  // The source video is ~4.0s at normal speed (measured from the file itself); 1.3x — the middle
  // of this revision's requested ~1.25-1.35 range — lands the walk at roughly 3.0s. Duration is
  // rounded at the OS level to the nearest second, so this is an estimate, not a frame-exact
  // figure; SAFETY_MS is the actual enforced ceiling regardless of the source's true length.
  var PLAYBACK_RATE = 1.3;
  var ACTIVE_CLASS = 'caviera-loader-active';

  var busy = false; // guards against a second .show() call stacking while one is already running

  function lockScroll() {
    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.classList.add(ACTIVE_CLASS);
  }
  function unlockScroll() {
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
  }

  function show(onComplete) {
    var callback = typeof onComplete === 'function' ? onComplete : function () {};

    if (busy) { callback(); return; } // never stack a second run — fail open to navigation
    busy = true;

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (loader._safety) { clearTimeout(loader._safety); loader._safety = null; }
      unlockScroll();
      loader.classList.add('is-leaving');
      var finalized = false;
      function finalize() {
        if (finalized) return;
        finalized = true;
        loader.classList.remove('is-active', 'is-leaving');
        loader.classList.add('is-dismissed');
        busy = false;
        callback();
      }
      loader.addEventListener('transitionend', finalize, { once: true });
      // Hard safety net — never depends on transitionend actually firing.
      setTimeout(finalize, FADE_MS + 150);
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // Never force the walking animation, and never delay the deliberate MENU → THE HOUSE action
      // visitors just took — navigate straight through.
      busy = false;
      callback();
      return;
    }

    loader.classList.remove('is-dismissed', 'is-leaving');
    loader.classList.add('is-active');
    lockScroll();

    // Restart cleanly every time .show() is called (video may already have played once this page
    // view, e.g. back-navigation into the menu and out again).
    try { video.currentTime = 0; } catch (e) { /* ignore — not seekable yet, plays from wherever it is */ }
    video.muted = true; // belt-and-suspenders over the HTML attribute, for autoplay reliability
    video.playbackRate = PLAYBACK_RATE;

    video.removeEventListener('ended', finish);
    video.removeEventListener('error', finish);
    video.removeEventListener('stalled', finish);
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    video.addEventListener('stalled', finish, { once: true });

    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      // Autoplay rejected (policy, low-power mode, etc.) — never hold on a frozen first frame.
      playPromise.catch(finish);
    }

    // Hard ceiling — never exceed this for any reason, even if no video event ever fires.
    loader._safety = setTimeout(finish, SAFETY_MS);
  }

  window.CaviearaLoader = { show: show };
})();
