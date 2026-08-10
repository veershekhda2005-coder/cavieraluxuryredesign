/**
 * Progressive enhancement for <caviera-facets>: filter panel open/close with focus handling
 * (Escape-close, focus restoration, and a Tab focus trap while open — the same pattern used by
 * the cart drawer and mobile nav drawer elsewhere in this theme), and auto-submit on checkbox
 * change. The underlying <form> works perfectly with JS disabled.
 */
(function () {
  class CavieraFacets extends HTMLElement {
    connectedCallback() {
      this.toggle = this.querySelector('[data-facets-toggle]');
      this.panel = this.querySelector('.caviera-facets__panel');
      this.scrim = this.querySelector('.caviera-facets__scrim');
      if (this.toggle && this.panel) {
        this.toggle.addEventListener('click', this.togglePanel.bind(this));
      }
      this.querySelectorAll('[data-facets-close]').forEach(function (el) {
        el.addEventListener('click', this.closePanel.bind(this));
      }, this);
      this.querySelectorAll('.caviera-facets__form input[type="checkbox"], .caviera-facets__form input[type="number"]').forEach(function (input) {
        input.addEventListener('change', function () { input.form.requestSubmit ? input.form.requestSubmit() : input.form.submit(); });
      });
      // Bound once per instance so disconnectedCallback can remove the exact same reference —
      // a fresh .bind() each time would leak a listener on every Theme Editor section reload.
      this.boundKeydown = this.onKeydown.bind(this);
      document.addEventListener('keydown', this.boundKeydown);
    }
    disconnectedCallback() {
      document.removeEventListener('keydown', this.boundKeydown);
      if (this.isMobileDrawerOpen()) document.documentElement.classList.remove('no-scroll');
    }
    // Below 900px the panel becomes a full off-canvas drawer (see caviera-collection.css) and
    // needs a real scroll lock + focus trap; at desktop widths it's just an inline panel that
    // pushes the grid down, so neither is appropriate there.
    isMobileDrawerOpen() {
      return !this.panel.hidden && window.innerWidth < 900;
    }
    togglePanel() {
      var open = !this.panel.hidden;
      if (open) this.closePanel(); else this.openPanel();
    }
    openPanel() {
      this.lastFocused = document.activeElement;
      this.panel.hidden = false;
      this.toggle.setAttribute('aria-expanded', 'true');
      if (window.innerWidth < 900) document.documentElement.classList.add('no-scroll');
      var firstField = this.panel.querySelector('input, button, a, select');
      if (firstField) firstField.focus();
    }
    closePanel() {
      this.panel.hidden = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('no-scroll');
      if (this.lastFocused) this.lastFocused.focus(); else this.toggle.focus();
    }
    trapFocus(e) {
      var focusables = this.panel.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    onKeydown(e) {
      if (!this.panel || this.panel.hidden) return;
      if (e.key === 'Escape') {
        this.closePanel();
      } else if (e.key === 'Tab') {
        this.trapFocus(e);
      }
    }
  }
  if (!customElements.get('caviera-facets')) customElements.define('caviera-facets', CavieraFacets);
})();
