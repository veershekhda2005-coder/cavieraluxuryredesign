/**
 * Ceremonial loader — CAVIERA Grand Theme 2026
 *
 * Loader intentionally disabled pending approved walking Oryx animation and final House Seal
 * asset verification. (config/settings_data.json sets enable_loader: false.) `enabled` below reads
 * that setting and is checked BEFORE anything else, including the `?loader_test=1` QA override —
 * so test mode also cannot activate the loader while it is disabled this way. Nothing else in this
 * file changed: re-enable by flipping enable_loader back to true once real assets are approved.
 *
 * The root element and both of its stage wrappers are always present in the homepage DOM — see
 * snippets/caviera-loader.liquid — regardless of whether this script decides to actually play the
 * sequence:
 *
 *   const loader    = document.querySelector('[data-caviera-loader]');
 *   const oryxStage = loader.querySelector('[data-loader-oryx]');
 *   const sealStage = loader.querySelector('[data-loader-seal]');
 *
 * All three always resolve to real elements on the homepage. This script only ever adds/removes
 * classes on them; it never inserts or removes any of the three, so those selectors keep
 * resolving before, during and after the sequence runs — whether or not either stage actually has
 * an image inside it.
 *
 * Modes, chosen from the data-has-oryx / data-has-seal attributes AND a real DOM check
 * (`stage.querySelector('img, picture, video, svg')`) — a stage only counts as available if both
 * agree, so a blank stage is never activated (see the snippet for the asset cascade policy):
 *   1. Oryx + Seal — walk stage (max 2 loops, ~1.2s each, restrained/no bounce), crossfades to the
 *      House Seal, holds briefly, fades into the hero.
 *   2. Oryx only   — walk stage only, then fades straight into the hero.
 *   3. Seal only   — static House Seal held briefly, then fades into the hero.
 *   4. Neither     — stays inert, no visible flash, nothing added/removed beyond class no-ops
 *      (both wrapper elements remain in the DOM, empty, for dev inspection).
 *
 * Safety guarantees:
 * - If this script never runs (blocked/failed), the loader stays `display:none` per
 *   caviera-loader.css and never overlays or blocks the page.
 * - A hard timeout always dismisses the loader by data-duration, even if an asset fails to load
 *   or an animation event never fires — never later than ~2.8s in the worst case.
 * - If the oryx image fails to load, it falls through to the next stage (the seal, if one exists,
 *   otherwise straight to the hero) rather than holding on a broken visual. The House Seal is
 *   always the last stage, so its image failing to load dismisses outright.
 * - Body scroll-lock (`caviera-loader-active`) is applied only while active and is always removed
 *   on every dismissal path.
 * - Never waits for the rest of the homepage's images (`window.load`) — only its own stage assets
 *   and independent timers drive it.
 */
(function () {
  var loader = document.querySelector('[data-caviera-loader]');
  if (!loader) return;

  var oryxStage = loader.querySelector('[data-loader-oryx]');
  var sealStage = loader.querySelector('[data-loader-seal]');

  var STEP_CYCLE_MS = 1200; // one full step ≈ 1.2s, per brand motion spec
  var MAX_LOOPS = 2;
  var CROSSFADE_MS = 450;
  var BODY_ACTIVE_CLASS = 'caviera-loader-active';

  // ?loader_test=1 — forces a replay for QA even when sessionStorage says it was already seen.
  function hasTestParam() {
    try {
      return /(?:^|[?&])loader_test=1(?:&|$)/.test(window.location.search);
    } catch (e) { return false; }
  }

  function lockScroll() { document.body.classList.add(BODY_ACTIVE_CLASS); }
  function unlockScroll() { document.body.classList.remove(BODY_ACTIVE_CLASS); }

  var dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    unlockScroll();
    loader.classList.add('is-dismissed');
    if (loader._safety) { clearTimeout(loader._safety); loader._safety = null; }
  }

  var enabled = loader.dataset.enabled !== 'false'; // Liquid renders the literal string 'true'/'false'
  var oncePerSession = loader.dataset.oncePerSession !== 'false';
  var duration = parseInt(loader.dataset.duration, 10) || 2600;
  var reducedBehaviour = loader.dataset.reducedMotionBehaviour || 'static_brief';
  var isDesignMode = loader.dataset.designMode === 'true';
  var testMode = hasTestParam();

  // Trust the DOM over the data attributes: even though Liquid's data-has-oryx/data-has-seal
  // should always agree with what actually got rendered, checking the real DOM content here means
  // a blank stage is never shown even if that ever drifted out of sync for any reason.
  var oryxHasMedia = Boolean(oryxStage && oryxStage.querySelector('img, picture, video, svg'));
  var sealHasMedia = Boolean(sealStage && sealStage.querySelector('img, picture, video, svg'));
  var hasOryx = loader.dataset.hasOryx === 'true' && oryxHasMedia;
  var hasSeal = loader.dataset.hasSeal === 'true' && sealHasMedia;

  // Disabled in Theme settings (currently the case — see file header), or no approved asset to
  // show at all: stay inert, no flash. This check runs before the ?loader_test=1 override below,
  // so test mode cannot bypass a disabled loader. Both stage wrappers remain in the DOM (empty)
  // regardless — only the *activation* is skipped.
  if (!enabled || (!hasOryx && !hasSeal)) { return; }

  // Theme Editor preview always bypasses the session gate — the customizer iframe reloads
  // constantly and a one-per-session flag would otherwise hide it after the first preview.
  if (oncePerSession && !isDesignMode && !testMode) {
    try {
      if (sessionStorage.getItem('caviera_loader_seen')) { return; }
    } catch (e) { /* storage unavailable — proceed, show once, fail open */ }
  }
  if (oncePerSession && !isDesignMode) {
    try { sessionStorage.setItem('caviera_loader_seen', '1'); } catch (e) { /* fail open */ }
  }

  var saveData = navigator.connection && navigator.connection.saveData;
  if (saveData && !isDesignMode) { return; }

  // Failure handling: the House Seal is always the last stage, so its image failing to load has
  // nothing further to fall back to — dismiss outright. The oryx image failing to load, however,
  // falls through to whatever stage would normally come next (the seal, or the hero) — see advance().
  function onSealError() { dismiss(); }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduced motion: brand rule is "static House Seal held briefly, or skip" — never the walk.
  function runReduced() {
    lockScroll();
    loader.classList.add('is-active', 'is-reduced');
    if (hasSeal) {
      loader.classList.add('is-resolving');
      var sealImg = sealStage.querySelector('img');
      if (sealImg) { sealImg.addEventListener('error', onSealError, { once: true }); }
    }
    // hasOryx-only (no seal) falls through with neither modifier: the oryx sits still for the
    // brief hold below (caviera-loader.css strips its animation in this media query) rather than
    // walking — a static presence only.
    var holdTime = Math.min(700, duration);
    var t = setTimeout(dismiss, holdTime);
    loader._safety = setTimeout(function () { clearTimeout(t); dismiss(); }, duration);
  }

  function runFull() {
    lockScroll();
    loader.classList.add('is-active');

    if (!hasOryx && hasSeal) {
      // Seal-only fallback: no approved oryx asset yet. Hold the static seal briefly, then reveal
      // the hero — no walk stage to run. The (empty) oryx wrapper is simply never populated.
      loader.classList.add('is-resolving');
      var sealImgOnly = sealStage.querySelector('img');
      if (sealImgOnly) { sealImgOnly.addEventListener('error', onSealError, { once: true }); }
      var holdTime = Math.min(900, duration);
      var t0 = setTimeout(dismiss, holdTime);
      loader._safety = setTimeout(function () { clearTimeout(t0); dismiss(); }, duration);
      return;
    }

    // Oryx present (walk asset if supplied, else the documented static-fallback progression — see
    // caviera-loader.css's caviera-walk-cycle keyframes: horizontal progression capped at 2%
    // vertical bob, no leg articulation faked, never more than two loops).
    var walkDuration = STEP_CYCLE_MS * MAX_LOOPS;
    var oryxImg = oryxStage.querySelector('img');
    var advanced = false;

    function advance() {
      if (advanced) return;
      advanced = true;
      if (hasSeal) {
        loader.classList.add('is-resolving');
        var sealImg = sealStage.querySelector('img');
        if (sealImg) { sealImg.addEventListener('error', onSealError, { once: true }); }
        // Hold the seal for whatever remains of the configured duration budget after the walk and
        // the closing fade, so the hero reveals within the brand's ~2.4–2.8s window by
        // construction — never a glimpse shorter than 300ms, never open-ended.
        var sealHold = Math.max(300, duration - walkDuration - CROSSFADE_MS);
        setTimeout(dismiss, sealHold);
      } else {
        // No approved House Seal yet — fade straight from the oryx stage into the hero rather
        // than resolving into anything unofficial.
        dismiss();
      }
    }

    if (oryxImg) {
      oryxImg.addEventListener('animationend', advance, { once: true });
      // If the oryx image itself fails to load, don't hold on a broken visual — fall through to
      // the seal (or the hero) exactly as if the walk had finished normally.
      oryxImg.addEventListener('error', advance, { once: true });
    }
    // Safety: advance even if the animation event never fires.
    setTimeout(advance, walkDuration);
    // Hard ceiling: never exceed the configured maximum duration for any reason. Kept at exactly
    // `duration` (not padded) so the loader always dismisses within the brand's ~2.8s ceiling even
    // in the worst case, regardless of animation/event timing.
    loader._safety = setTimeout(dismiss, duration);
  }

  if (reduceMotion) {
    if (reducedBehaviour === 'skip') { return; }
    runReduced();
  } else {
    runFull();
  }
})();
