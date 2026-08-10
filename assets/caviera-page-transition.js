/**
 * CAVIERA Curtain — signature page transition.
 *
 * Deliberately NOT a client-side router. Every navigation this intercepts still ends in a real
 * `window.location.href` assignment — Shopify's own page lifecycle, analytics, forms, and cart
 * actions are completely untouched. This file only wraps a short visual departure/arrival around
 * navigation that was always going to happen anyway. If this script fails to load or throws before
 * binding, links simply behave like normal links — nothing here can break navigation.
 *
 * Departure (this page, on click):
 *   1. Skip entirely for anything that isn't a plain, same-tab, same-origin left-click on an <a>
 *      with an href to a genuinely different page (see shouldSkip below) — including the entire
 *      cart/checkout/login flow, which prioritises speed and reliability over spectacle.
 *   2. Otherwise: set a one-shot sessionStorage flag, play the curtain rising to cover the
 *      viewport, then navigate for real after --COVER_MS-- (a hard cap — the ceremony never delays
 *      the customer beyond it, whatever the animation is doing).
 *
 * Arrival (destination page, on load):
 *   The tiny inline script at the top of <head> in layout/theme.liquid already reads that
 *   sessionStorage flag synchronously before first paint, clears it, and adds
 *   `html.caviera-transition-pending` — which caviera-page-transition.css renders as the curtain
 *   already fully covering the viewport, instantly, no flash of the new page underneath. All this
 *   file does on arrival is turn that instant state into the graceful reveal animation. That inline
 *   script also carries its own 1.5s safety-net timeout, completely independent of this file — so
 *   even if this script never runs at all, the curtain still clears itself and never hides content
 *   permanently.
 *
 * Respects prefers-reduced-motion (skips the whole ceremony, both directions) and browser history —
 * back/forward navigation is never intercepted, only programmatic left-clicks on qualifying links.
 */
(function () {
  var el = document.querySelector('[data-caviera-transition]');
  if (!el) return;

  var STORAGE_KEY = 'caviera_transition_pending';
  var COVER_MS = 420; // hard cap: real navigation always fires by this point, ceremony or not
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shouldSkip(link) {
    if (!link) return true;
    if (link.target && link.target !== '_self') return true;
    if (link.hasAttribute('download')) return true;
    if (link.hasAttribute('data-no-transition') || link.closest('[data-no-transition]')) return true;
    var url;
    try { url = new URL(link.href, window.location.href); } catch (e) { return true; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true; // mailto:, tel:, etc.
    if (url.origin !== window.location.origin) return true;
    // Same page (only the hash differs, or an exact repeat of the current URL) — no visual
    // transition is meaningful for an in-page jump.
    if (url.pathname === window.location.pathname && url.search === window.location.search) return true;
    // Cart, checkout, and the login gate never wait on a decorative transition.
    if (/^\/(cart|checkout|account\/login)(\/|$)/.test(url.pathname)) return true;
    return false;
  }

  document.addEventListener('click', function (e) {
    if (reduceMotion) return; // reduced motion: always a plain, immediate navigation
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href]');
    if (shouldSkip(link)) return;

    e.preventDefault();
    var href = link.href;
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) { /* fail open below */ }
    el.classList.add('is-covering');

    var navigated = false;
    function go() {
      if (navigated) return;
      navigated = true;
      window.location.href = href;
    }
    setTimeout(go, COVER_MS);
  });

  // Arrival — see the file header. Only the graceful-reveal treatment happens here; the actual
  // "already covered, no flash" state and its safety net are set by the inline script in
  // layout/theme.liquid before this deferred file even runs.
  if (document.documentElement.classList.contains('caviera-transition-pending')) {
    // The homepage's own ceremonial loader (assets/caviera-loader.js) is a full-screen sequence in
    // its own right — never layer a second reveal ceremony on top of it. Simply drop the curtain
    // instantly and let the loader own the moment.
    var loaderWillRun = document.querySelector('[data-caviera-loader][data-enabled="true"]');
    if (loaderWillRun && !reduceMotion) {
      document.documentElement.classList.remove('caviera-transition-pending');
    } else if (reduceMotion) {
      document.documentElement.classList.remove('caviera-transition-pending');
    } else {
      requestAnimationFrame(function () {
        el.classList.add('is-covering', 'is-revealing');
        document.documentElement.classList.remove('caviera-transition-pending');
        setTimeout(function () {
          el.classList.remove('is-covering', 'is-revealing');
        }, 900);
      });
    }
  }
})();
