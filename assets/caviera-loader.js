/**
 * CAVIERA global loader — the Living Oryx (2026-08-18 unification)
 *
 * ONE reusable implementation for every genuine full-page navigation wait in the theme. Replaces
 * two previously separate systems that used to live here: a one-off "MENU → THE HOUSE" trigger
 * that always played the whole loader video to completion (~3s) regardless of how long the real
 * navigation actually took, and a separate Cinnabar/House-Seal "Curtain" page-transition overlay
 * (assets/caviera-page-transition.js, now deleted) used for every other internal link. Both are
 * retired in favour of this single engine.
 *
 * CORE PRINCIPLE — the video's runtime is NOT the loading duration. The Oryx loops for as long as
 * a navigation is genuinely still in flight, and is dismissed the moment the destination is ready
 * — never held open to let an animation "finish", and navigation itself is never artificially
 * delayed to manufacture time for the loader to play.
 *
 * Still deliberately NOT a client-side router — every intercepted click still ends in a real,
 * native browser navigation. This file only decides WHETHER to reveal a full-screen overlay while
 * that native navigation is in flight, using two documented techniques:
 *
 *   1. FAST-NAVIGATION PROTECTION: on a qualifying click, this does NOT call preventDefault() and
 *      does NOT delay navigation — the browser starts loading the destination immediately, exactly
 *      as it would with no script here at all. A short timer (SHOW_DELAY_MS) is started in
 *      parallel; if the browser has already navigated away before that timer fires (a fast/cached
 *      response), this page's whole JS context is torn down and the timer simply never runs — the
 *      loader is never shown, with no bookkeeping required. Only a genuinely slow navigation lives
 *      long enough for the timer to fire and reveal the loader.
 *
 *   2. CROSS-DOCUMENT CONTINUITY: revealing the loader sets a one-shot sessionStorage flag. The
 *      inline script at the top of <head> in layout/theme.liquid reads and clears that flag
 *      SYNCHRONOUSLY, before first paint, and adds html.caviera-loader-pending — which
 *      caviera-loader.css renders as the loader already fully covering the viewport, instantly, no
 *      flash of the new page underneath. That inline script also carries its own 1.5s safety-net
 *      timeout, completely independent of this file, so even if this script never runs at all on
 *      the destination page, the loader still clears itself and never hides content permanently.
 *
 * Respects prefers-reduced-motion (skips the whole ceremony, both directions — native navigation
 * proceeds with no overlay at all), Shopify Theme Editor design mode (never intercepts there), and
 * browser history (back/forward navigation is never intercepted, only programmatic left-clicks on
 * qualifying links) — see shouldSkip() and the design-mode guard below.
 */
(function () {
  var loader = document.querySelector('[data-caviera-loader]');
  if (!loader) return; // settings.enable_loader is off — nothing to do, nothing to show, ever.

  var video = loader.querySelector('[data-loader-video]');

  var STORAGE_KEY = 'caviera_loader_pending';
  var SHOW_DELAY_MS = 180; // fast-navigation protection threshold — within the requested 150-200ms
  var FADE_OUT_MS = 300; // within the requested 250-350ms exit range (see caviera-loader.css)
  var SAFETY_MS = 8000; // hard ceiling: always conceal eventually, even if window.load never fires
  var ACTIVE_CLASS = 'caviera-loader-active';
  var DEPART_CLASS = 'caviera-loader-departing';

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function designMode() {
    return typeof window.Shopify !== 'undefined' && !!window.Shopify.designMode;
  }

  video.muted = true; // belt-and-suspenders over the HTML attribute, for autoplay reliability

  var visible = false;
  var safetyTimer = null;

  function lockScroll() {
    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.classList.add(ACTIVE_CLASS);
  }
  function unlockScroll() {
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
  }

  /** Reveal the loader immediately. Safe to call repeatedly — a no-op once already visible. */
  function reveal() {
    if (visible) return;
    visible = true;
    loader.classList.remove('is-dismissed', 'is-leaving');
    loader.classList.add('is-active');
    lockScroll();
    if (!reduceMotion() && video.play) {
      // Native autoplay + loop (see snippets/caviera-loader.liquid) already keeps this playing
      // continuously in the background — this is a defensive nudge only, in case autoplay was
      // blocked or the element was paused (e.g. by conceal() below on an earlier reveal this page).
      try { video.play().catch(function () {}); } catch (e) { /* ignore */ }
    }
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(conceal, SAFETY_MS);
  }

  /** Conceal the loader (fade out), then finalize to the fully-dismissed, inert state. Safe to
   *  call at any time, including when never shown — always leaves the loader in a clean state. */
  function conceal() {
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    var main = document.getElementById('main-content');
    if (main) main.classList.remove(DEPART_CLASS);
    if (!visible) {
      loader.classList.remove('is-active', 'is-leaving');
      loader.classList.add('is-dismissed');
      return;
    }
    visible = false;
    unlockScroll();
    loader.classList.remove('is-active');
    loader.classList.add('is-leaving');
    var finalized = false;
    function finalize() {
      if (finalized) return;
      finalized = true;
      loader.classList.remove('is-leaving');
      loader.classList.add('is-dismissed');
      try { video.pause(); } catch (e) { /* ignore */ }
    }
    loader.addEventListener('transitionend', finalize, { once: true });
    // Hard safety net — never depends on transitionend actually firing.
    setTimeout(finalize, FADE_OUT_MS + 150);
  }

  // Small, reusable public API — kept for any future/manual call site, and for parity with the
  // previous revision's window.CaviearaLoader.show(onComplete) shape (onComplete still supported,
  // called once conceal() would otherwise have started, so a caller can navigate at exactly the
  // right moment if it needs to drive its own timing instead of relying on link interception).
  window.CaviearaLoader = {
    show: function (onComplete) {
      reveal();
      if (typeof onComplete === 'function') onComplete();
    },
    hide: conceal
  };

  // ---- Navigation interception ----
  // Same exclusion rules as the retired CAVIERA Curtain (assets/caviera-page-transition.js) —
  // battle-tested, unchanged in substance.
  function shouldSkip(link) {
    if (!link) return true;
    if (link.target && link.target !== '_self') return true;
    if (link.hasAttribute('download')) return true;
    if (link.hasAttribute('data-no-transition') || link.closest('[data-no-transition]')) return true;
    var url;
    try { url = new URL(link.href, window.location.href); } catch (e) { return true; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true; // mailto:, tel:, etc.
    if (url.origin !== window.location.origin) return true;
    // Same page (only the hash differs, or an exact repeat of the current URL) — no full-page
    // loader is meaningful for an in-page jump.
    if (url.pathname === window.location.pathname && url.search === window.location.search) return true;
    // Cart, checkout, and the login gate never wait on a decorative loader.
    if (/^\/(cart|checkout|account\/login)(\/|$)/.test(url.pathname)) return true;
    return false;
  }

  document.addEventListener('click', function (e) {
    if (designMode()) return; // never intercept while editing the theme in the Shopify admin
    if (reduceMotion()) return; // reduced motion: always a plain, immediate, un-intercepted navigation
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href]');
    if (shouldSkip(link)) return;

    // Deliberately NOT preventDefault() and NOT a delayed window.location.href assignment — native
    // navigation starts immediately, at full native speed. The delayed timer below only decides
    // whether to bother making the (already in-flight) navigation visually ceremonial.
    var revealTimer = setTimeout(function () {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) { /* fail open — no cross-document continuity, but this page's own reveal still runs */ }
      reveal();
      var main = document.getElementById('main-content');
      if (main) main.classList.add(DEPART_CLASS);
    }, SHOW_DELAY_MS);
    // No cleanup needed for the fast-navigation case: once the browser actually navigates away,
    // this entire script context (including revealTimer) is destroyed before it can fire.
    void revealTimer;
  });

  // ---- Arrival ----
  // The inline script in layout/theme.liquid already added html.caviera-loader-pending (and the
  // loader is already fully visible via that class's own CSS, see caviera-loader.css) before this
  // deferred script even ran, if this page was reached via a reveal on the previous page. Upgrade
  // that instant, pre-paint state into the normal .is-active state, so conceal() below has a
  // regular fade-out to use rather than needing a special case.
  if (document.documentElement.classList.contains('caviera-loader-pending')) {
    document.documentElement.classList.remove('caviera-loader-pending');
    visible = true;
    loader.classList.remove('is-dismissed', 'is-leaving');
    loader.classList.add('is-active');
    lockScroll();
    safetyTimer = setTimeout(conceal, SAFETY_MS);

    // "The moment the destination is ready" — window.load is the standard, honest signal that the
    // new page's own resources (not just its DOM) are actually ready, not a fixed/guessed timer.
    // If the page is already complete by the time this script runs (a fast load that still crossed
    // the SHOW_DELAY_MS threshold on the departing page, e.g. a slow initial connection followed by
    // a fast render), conceal on the next frame rather than waiting for an event that already fired.
    if (document.readyState === 'complete') {
      requestAnimationFrame(conceal);
    } else {
      window.addEventListener('load', conceal, { once: true });
    }
  }

  // ---- Browser back/forward (bfcache) ----
  // A page restored from the back/forward cache re-runs no scripts and fires no 'load' event — if
  // the loader was left visible right before the visitor navigated away (e.g. they clicked a link,
  // the loader appeared, then immediately hit Back before the destination finished loading), it
  // must never remain stuck. Unconditionally reset on every pageshow, not only bfcache restores —
  // a harmless no-op via conceal()'s own "not visible" branch when there was nothing to hide.
  window.addEventListener('pageshow', function () {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    document.documentElement.classList.remove('caviera-loader-pending');
    conceal();
  });
})();
