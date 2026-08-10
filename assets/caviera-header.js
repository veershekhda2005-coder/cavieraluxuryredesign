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

  // Global Escape handling for the mega menu — bound once; harmless to leave attached across
  // section reloads since it only ever queries live elements at the moment Escape is pressed.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.caviera-header__nav-item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
    }
  });
})();
