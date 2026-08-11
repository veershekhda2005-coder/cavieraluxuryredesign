/**
 * <caviera-header> behaviour: sticky compact/seal transition on scroll, mobile drawer with focus
 * trap + restoration, and keyboard-accessible mega menu / submenu toggles. No animation library.
 *
 * Section-reload resilience: the custom element's connectedCallback already re-fires whenever the
 * Theme Editor reloads the header section. Everything else here is plain querySelector-based, so
 * it's wrapped in initHeaderControls(), bound with a `data-*-bound` guard, and re-run scoped to the
 * reloaded section on `shopify:section:load` — otherwise the menu/mega-menu would stop responding
 * the moment a merchant changed a header setting in the editor.
 */
(function () {
  class CavieraHeader extends HTMLElement {
    connectedCallback() {
      this.sticky = this.dataset.sticky === 'true';
      this.onScroll = this.onScroll.bind(this);
      if (this.sticky) {
        window.addEventListener('scroll', this.onScroll, { passive: true });
        this.onScroll();
      }
    }
    disconnectedCallback() {
      window.removeEventListener('scroll', this.onScroll);
    }
    onScroll() {
      var scrolled = window.scrollY > 24;
      this.classList.toggle('is-scrolled', scrolled);
      this.classList.toggle('is-compact', scrolled);
    }
  }
  if (!customElements.get('caviera-header')) {
    customElements.define('caviera-header', CavieraHeader);
  }

  var lastFocused = null;

  // FINAL LANDING FIX — ONE system, no header-height math at all. Every previous pass (CSS
  // scroll-margin-top against var(--header-height)/--header-height-compact, then a JS
  // getBoundingClientRect()-based header-height subtraction) was still trying to reserve space FOR
  // the header by calculating its size — approximate by construction, and the actual source of the
  // visible strip. The header is sticky and simply sits on top of whatever is at the top of the
  // viewport; scrolling #edition-i's own true document top to y=0 is what makes the OUTER Edition
  // wrapper (not any inner sticky child) the first thing at the top of the page — the header then
  // overlaps its own few pixels of Edition I exactly as it would overlap the top of any section,
  // never a sliver of the PREVIOUS section, which is what was actually reported. No subtraction, no
  // constant, nothing to get subtly wrong.
  //
  // Two rAFs, not zero or one: the first lets the browser commit closeMenu()'s DOM changes (mobile
  // nav hidden, `no-scroll` removed) into a real layout pass; the second runs after THAT layout is
  // painted, so getBoundingClientRect() below reads the final, settled position — not a mid-flight
  // one from the same task the class changes happened in.
  function scrollToEditionTop(edition) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var target = window.scrollY + edition.getBoundingClientRect().top;
        window.scrollTo({ top: target, behavior: 'auto' });
        if (window.history && window.history.pushState) {
          window.history.pushState(null, '', '#edition-i');
        }
      });
    });
  }

  function trapFocus(mobileNav, e) {
    if (!mobileNav || mobileNav.hidden) return;
    if (e.key !== 'Tab') return;
    var focusables = mobileNav.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function initHeaderControls(root) {
    var menuToggle = root.querySelector('[data-caviera-menu-toggle]');
    var mobileNav = document.getElementById('caviera-mobile-nav');
    var scrim = document.querySelector('.caviera-mobile-nav__scrim');
    var closeEls = root.querySelectorAll('[data-caviera-menu-close]');

    function onKeydown(e) {
      if (e.key === 'Escape') closeMenu();
      trapFocus(mobileNav, e);
    }
    function openMenu() {
      if (!mobileNav) return;
      lastFocused = document.activeElement;
      mobileNav.hidden = false;
      if (scrim) scrim.hidden = false;
      document.documentElement.classList.add('no-scroll');
      menuToggle && menuToggle.setAttribute('aria-expanded', 'true');
      var closeBtn = mobileNav.querySelector('[data-caviera-menu-close]');
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKeydown);
    }
    function closeMenu() {
      if (!mobileNav) return;
      mobileNav.hidden = true;
      if (scrim) scrim.hidden = true;
      document.documentElement.classList.remove('no-scroll');
      menuToggle && menuToggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused) lastFocused.focus();
    }

    if (menuToggle && !menuToggle.dataset.clickBound) {
      menuToggle.dataset.clickBound = 'true';
      menuToggle.addEventListener('click', openMenu);
    }
    closeEls.forEach(function (el) {
      if (el.dataset.clickBound) return;
      el.dataset.clickBound = 'true';
      el.addEventListener('click', closeMenu);
    });

    // Primary navigation links (EDITION I / THE HOUSE / JOURNAL, etc.) — ROOT-CAUSE FIX: these are
    // real <a href> elements (see sections/caviera-header.liquid) and always were, so nothing here
    // was ever missing an href/pointer-events/etc. The actual problem was that openMenu() adds
    // `no-scroll` to <html> and nothing ever removed it again for a same-page hash click (closeMenu
    // was only ever wired to the explicit close button and the scrim) — so clicking EDITION I while
    // the menu was open did technically navigate (the hash changed), but with scrolling locked and
    // the full-screen menu still covering the viewport, nothing ever became visible: indistinguishable
    // from "the link doesn't work". Cross-page links (THE HOUSE, JOURNAL) never showed this symptom
    // because a full page load replaces the DOM (and its no-scroll class) regardless.
    //
    // LANDING FIX (final pass) — for the EDITION I link specifically (any same-page link whose hash
    // target actually exists — in practice only #edition-i today): prevent the native hash jump,
    // close the menu, unlock scroll, then hand off to scrollToEditionTop() (above) for the exact,
    // no-header-math landing. Cross-page links (THE HOUSE, JOURNAL) just get the menu closed and
    // otherwise navigate exactly as before — unaffected by this fix.
    root.querySelectorAll('.caviera-mobile-nav__primary-link[href]').forEach(function (link) {
      if (link.dataset.clickBound) return;
      link.dataset.clickBound = 'true';
      link.addEventListener('click', function (e) {
        var url;
        try { url = new URL(link.href, window.location.href); } catch (err) { closeMenu(); return; }
        var samePage = url.pathname === window.location.pathname && url.search === window.location.search && url.hash;
        var target = samePage ? document.querySelector(url.hash) : null;
        if (target) {
          // In-page destination: take over the whole sequence ourselves so the menu is guaranteed
          // closed (and scrolling unlocked) BEFORE we scroll, rather than hoping the browser's
          // native hash-jump happens to land correctly against a still-locked page.
          e.preventDefault();
          closeMenu();
          scrollToEditionTop(target);
          // Move focus to the destination so keyboard/screen-reader users land where a sighted
          // mouse user's eye would — never left behind on a now-hidden menu item. tabindex="-1"
          // makes an otherwise non-interactive section programmatically focusable without adding a
          // permanent tab stop for mouse/normal reading-order users.
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        } else {
          // Cross-page destination, or an in-page hash with no matching element (fail open): just
          // close the menu — native navigation (or the page-transition ceremony) proceeds exactly
          // as it would for any other link, unlocking scroll naturally via the full page load.
          closeMenu();
        }
      });
    });

    // Mobile submenu accordions
    root.querySelectorAll('.caviera-mobile-nav__toggle').forEach(function (btn) {
      if (btn.dataset.clickBound) return;
      btn.dataset.clickBound = 'true';
      btn.addEventListener('click', function () {
        var submenu = btn.nextElementSibling;
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (submenu) submenu.hidden = expanded;
      });
    });

    // Desktop mega menu: keyboard support (click-to-toggle in addition to hover/focus-within CSS)
    root.querySelectorAll('.caviera-header__nav-item.has-submenu > .caviera-header__nav-link').forEach(function (btn) {
      if (btn.dataset.clickBound) return;
      btn.dataset.clickBound = 'true';
      btn.addEventListener('click', function () {
        var item = btn.closest('.caviera-header__nav-item');
        var open = item.classList.contains('is-open');
        root.querySelectorAll('.caviera-header__nav-item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
        if (!open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
        else { btn.setAttribute('aria-expanded', 'false'); }
      });
    });
  }

  initHeaderControls(document);
  document.addEventListener('shopify:section:load', function (e) { initHeaderControls(e.target); });

  // Cross-page landing correction — ONLY for #edition-i (a small, targeted routine, not a generic
  // hash-hijack of every anchor on the site). Arriving fresh from another page via /#edition-i
  // relies entirely on the browser's own native fragment scroll (no JS runs ahead of it); this runs
  // the identical zero-header-math correction once DOM/layout is ready, so a same-page click and a
  // fresh cross-page load both land through the exact same logic.
  var editionOnLoad = document.getElementById('edition-i');
  if (window.location.hash === '#edition-i' && editionOnLoad) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        window.scrollTo({ top: window.scrollY + editionOnLoad.getBoundingClientRect().top, behavior: 'auto' });
      });
    });
  }

  // Global Escape handling for the mega menu — bound once; harmless to leave attached across
  // section reloads since it only ever queries live elements at the moment Escape is pressed.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.caviera-header__nav-item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
    }
  });
})();
