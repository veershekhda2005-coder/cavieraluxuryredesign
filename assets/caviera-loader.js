/**
 * CAVIERA loader — final 2026 revision (CAVIERA Grand Theme 2026)
 *
 * A single walking-Oryx VIDEO (assets/caviera-loader-oryx-2026.mp4), once per browsing session,
 * homepage only. Replaces the previous multi-stage image sequence (oryx/House Seal/Master
 * Signature) that existed only as a placeholder while final motion artwork was pending — the
 * approved video is now the only visual event.
 *
 * The root element and the <video> itself always render unconditionally on the homepage (when
 * settings.enable_loader is on — see snippets/caviera-loader.liquid) — this script alone decides
 * whether it actually activates.
 *
 * Safety guarantees (every exit path is idempotent and always reachable):
 * - assets/caviera-loader.css defaults the root to `display: none` — if this script never runs at
 *   all (blocked/failed), the loader never appears and never blocks the page.
 * - prefers-reduced-motion: reduce — never forces the walk; skips the loader entirely and reveals
 *   the page immediately (also marks the session flag, so toggling reduced motion off later in
 *   the same session doesn't suddenly surface it).
 * - Already seen this session (sessionStorage) — skipped entirely, every homepage visit/refresh
 *   after the first in the same browsing session.
 * - Video error/stalled, or the autoplay play() promise rejecting — dismiss immediately rather
 *   than holding on a broken/frozen frame.
 * - A hard safety timeout (SAFETY_MS) always dismisses the loader no matter what, even if no
 *   video event ever fires.
 * - Body/html scroll-lock is applied only while active and is always removed on every exit path.
 */
(function () {
  var loader = document.querySelector('[data-caviera-loader]');
  if (!loader) return;

  var video = loader.querySelector('[data-loader-video]');
  if (!video) return;

  var SESSION_KEY = 'cavieraLoaderSeen';
  var FADE_MS = 620; // matches .caviera-loader.is-leaving's own CSS transition duration exactly
  var SAFETY_MS = 3800; // hard ceiling — never later than this regardless of video state
  // The source video is ~4.0s at normal speed; 1.5x lands the walk at ~2.67s, comfortably inside
  // the requested ~2.3-3s total visible-loader target once played back at this rate.
  var PLAYBACK_RATE = 1.5;
  var ACTIVE_CLASS = 'caviera-loader-active';

  function alreadySeenThisSession() {
    try {
      return Boolean(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return false; // storage unavailable — fail open, show it, never block on this alone
    }
  }
  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* fail open */ }
  }

  function lockScroll() {
    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.classList.add(ACTIVE_CLASS);
  }
  function unlockScroll() {
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
  }

  var exited = false;
  function exit() {
    if (exited) return;
    exited = true;
    if (loader._safety) { clearTimeout(loader._safety); loader._safety = null; }
    unlockScroll();
    loader.classList.add('is-leaving');
    var finalized = false;
    function finalize() {
      if (finalized) return;
      finalized = true;
      loader.classList.add('is-dismissed');
    }
    loader.addEventListener('transitionend', finalize, { once: true });
    // Hard safety net — never depends on transitionend actually firing (matches FADE_MS exactly,
    // with a small margin so a legitimate transitionend always wins the race first).
    setTimeout(finalize, FADE_MS + 150);
  }

  // Already shown once this browsing session — skip entirely, no flash, page renders normally.
  if (alreadySeenThisSession()) { return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    // Never force the walking animation. Skip the loader outright and reveal the page immediately
    // — the brand rule here is "do not block access to the site" over anything decorative.
    markSeen();
    return;
  }

  markSeen();
  lockScroll();
  loader.classList.add('is-active');

  // Belt-and-suspenders: the `muted` attribute is already on the element (see the Liquid), but
  // some browsers only reliably honour autoplay when the property is also set directly in JS.
  video.muted = true;
  video.playbackRate = PLAYBACK_RATE;

  video.addEventListener('ended', exit, { once: true });
  video.addEventListener('error', exit, { once: true });
  video.addEventListener('stalled', exit, { once: true });

  var playPromise = video.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    // Autoplay rejected by the browser (policy, low-power mode, etc.) — never hold on a frozen
    // first frame; reveal the page immediately.
    playPromise.catch(exit);
  }

  // Hard ceiling — never exceed this for any reason, even if no video event ever fires.
  loader._safety = setTimeout(exit, SAFETY_MS);
})();
