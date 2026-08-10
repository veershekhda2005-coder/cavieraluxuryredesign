/**
 * Product page behaviour: media gallery (thumbs/keyboard/swipe/zoom, variant-linked switching),
 * variant selection with URL deep-linking and price/media/SKU sync, AJAX add-to-cart feeding the
 * cart drawer with an ARIA-live success announcement, sticky mobile add-to-bag bar, share action,
 * and lazy product-recommendations fetch. Vanilla JS only.
 */
(function () {
  /* ---- Product media ---- */
  class ProductMedia extends HTMLElement {
    connectedCallback() {
      this.thumbs = Array.from(this.querySelectorAll('[data-media-thumb]'));
      this.items = Array.from(this.querySelectorAll('[data-media-id]'));
      this.thumbs.forEach(function (thumb, index) {
        thumb.addEventListener('click', this.show.bind(this, thumb.dataset.mediaThumb));
        thumb.addEventListener('keydown', this.onThumbKeydown.bind(this, index));
      }, this);
      this.addEventListener('click', this.onZoomClick.bind(this));
      // Bound once per instance so disconnectedCallback can remove the exact same reference —
      // a fresh .bind() each time would leak a listener on every Theme Editor section reload.
      this.boundDocumentKeydown = this.onDocumentKeydown.bind(this);
      document.addEventListener('keydown', this.boundDocumentKeydown);
      this.bindSwipe();
    }
    disconnectedCallback() {
      document.removeEventListener('keydown', this.boundDocumentKeydown);
    }
    show(mediaId) {
      mediaId = String(mediaId);
      this.items.forEach(function (item) { item.hidden = item.dataset.mediaId !== mediaId; item.classList.toggle('is-active', item.dataset.mediaId === mediaId); });
      this.thumbs.forEach(function (thumb) {
        var active = thumb.dataset.mediaThumb === mediaId;
        thumb.classList.toggle('is-active', active);
        thumb.setAttribute('aria-selected', String(active));
        thumb.setAttribute('tabindex', active ? '0' : '-1');
      });
    }
    // ARIA tabs pattern — matches the equivalent keyboard behaviour already used by the
    // homepage's Signature Products rail, for consistency across the theme.
    onThumbKeydown(index, e) {
      var last = this.thumbs.length - 1;
      var target = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = index === last ? 0 : index + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = index === 0 ? last : index - 1;
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = last;
      if (target === null) return;
      e.preventDefault();
      this.thumbs[target].focus();
      this.show(this.thumbs[target].dataset.mediaThumb);
    }
    onZoomClick(e) {
      var img = e.target.closest('[data-zoomable]');
      if (!img || this.dataset.zoom !== 'true') return;
      img.classList.toggle('is-zoomed');
      if (img.classList.contains('is-zoomed')) {
        img.style.transform = 'scale(1.6)';
        img.style.transformOrigin = ((e.offsetX / img.clientWidth) * 100) + '% ' + ((e.offsetY / img.clientHeight) * 100) + '%';
      } else {
        img.style.transform = '';
      }
    }
    // Escape exits zoom — the zoom toggle has no modal to close, but leaving a visitor zoomed in
    // with no visible way out isn't acceptable either.
    onDocumentKeydown(e) {
      if (e.key !== 'Escape') return;
      var zoomed = this.querySelector('.is-zoomed');
      if (zoomed) { zoomed.classList.remove('is-zoomed'); zoomed.style.transform = ''; }
    }
    // Native touch delta — no gesture library. Swiping the active stage advances/retreats one
    // media item, wrapping at the ends.
    bindSwipe() {
      var stage = this.querySelector('.caviera-product-media__stage');
      if (!stage) return;
      var startX = null;
      stage.addEventListener('touchstart', function (e) { startX = e.changedTouches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var deltaX = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(deltaX) < 40) return; // ignore small/accidental movement
        var activeIndex = this.items.findIndex(function (item) { return item.classList.contains('is-active'); });
        if (activeIndex === -1) return;
        var last = this.items.length - 1;
        var target = deltaX < 0 ? (activeIndex === last ? 0 : activeIndex + 1) : (activeIndex === 0 ? last : activeIndex - 1);
        this.show(this.items[target].dataset.mediaId);
      }.bind(this), { passive: true });
    }
  }
  if (!customElements.get('product-media')) customElements.define('product-media', ProductMedia);

  /* ---- Variant picker ---- */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.variants = JSON.parse(this.querySelector('[data-variant-data]').textContent);
      this.form = this.closest('product-form');
      this.addEventListener('change', this.onChange.bind(this));
    }
    getSelectedOptions() {
      var groups = {};
      this.querySelectorAll('input[type="radio"]:checked').forEach(function (input) {
        var name = input.name.replace('option-', '');
        groups[name] = input.value;
      });
      var options = [];
      Object.keys(groups).sort(function (a, b) { return a - b; }).forEach(function (k) { options.push(groups[k]); });
      return options;
    }
    findVariant(options) {
      return this.variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === options[i]; });
      });
    }
    onChange() {
      var options = this.getSelectedOptions();
      var variant = this.findVariant(options);
      if (!variant || !this.form) return;
      var idInput = this.form.querySelector('[data-variant-id-input]');
      if (idInput) idInput.value = variant.id;

      var submit = this.form.querySelector('[data-add-to-cart]');
      var text = this.form.querySelector('[data-add-to-cart-text]');
      if (submit) {
        submit.disabled = !variant.available;
        submit.setAttribute('aria-disabled', String(!variant.available));
      }
      if (text) text.textContent = variant.available ? window.theme.strings.addToBag : window.theme.strings.soldOut;

      document.querySelectorAll('.caviera-product__price').forEach(function (el) {
        el.innerHTML = '<span class="price">' + (window.Shopify && window.Shopify.formatMoney ? window.Shopify.formatMoney(variant.price) : (variant.price / 100)) + '</span>';
      });

      document.querySelectorAll('[data-product-sku-text]').forEach(function (el) {
        var row = el.closest('[data-product-sku-row]');
        if (variant.sku && window.theme.strings.skuLabel) {
          el.textContent = window.theme.strings.skuLabel.replace('__SKU__', variant.sku);
          if (row) row.hidden = false;
        } else if (row) {
          row.hidden = true;
        }
      });

      // Variant-linked media — switch the gallery to this variant's own image, if it has one.
      if (variant.featured_image && variant.featured_image.id) {
        var mediaRoot = document.querySelector('product-media');
        if (mediaRoot && typeof mediaRoot.show === 'function') mediaRoot.show(variant.featured_image.id);
      }

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
    }
  }
  if (!customElements.get('variant-picker')) customElements.define('variant-picker', VariantPicker);

  /* ---- Section-reload resilience ----
     ProductMedia/VariantPicker above are custom elements: their connectedCallback fires
     automatically whenever the Theme Editor re-renders the section HTML, so they need no extra
     handling. Everything below this point is plain querySelector + addEventListener, which does
     NOT get re-run when Shopify's Theme Editor AJAX-reloads a section after a settings change —
     so it's wrapped in an init function, scoped to a root, bound with a `data-*-bound` guard
     (never double-attaches a listener to the same element), called once on load and again on
     `shopify:section:load` scoped to just the section that changed. */
  var boundStickyObserver = null;

  function initProductForms(root) {
    root.querySelectorAll('.caviera-product-form__form').forEach(function (form) {
      if (form.dataset.submitBound) return;
      form.dataset.submitBound = 'true';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        // aria-disabled alone doesn't stop the browser from firing another submit event (a
        // second tap, the Enter key, or the mobile sticky bar's proxy click all still go
        // through) — a real in-flight guard is needed to prevent a genuine duplicate add.
        if (form.dataset.submitting === 'true') return;
        form.dataset.submitting = 'true';
        var submit = form.querySelector('[data-add-to-cart]');
        var status = form.querySelector('[data-form-status]');
        if (submit) { submit.disabled = true; submit.setAttribute('aria-disabled', 'true'); }
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: form.querySelector('[name="id"]').value, quantity: parseInt(form.querySelector('[name="quantity"]').value || '1', 10) }] })
        })
          .then(function (res) { if (!res.ok) return res.json().then(function (d) { throw d; }); return res.json(); })
          .then(function () {
            // Sighted visitors see the cart drawer open; this is the equivalent confirmation for
            // screen-reader users, who would otherwise get no signal that anything happened.
            // Reuses the same translated string the cart drawer itself uses.
            if (status) { status.textContent = window.theme.strings.cartUpdated; status.removeAttribute('data-state'); }
            document.dispatchEvent(new CustomEvent('caviera:cart:add'));
          })
          .catch(function (err) {
            if (status) { status.textContent = (err && err.description) || 'Something went wrong. Please try again.'; status.setAttribute('data-state', 'error'); }
          })
          .finally(function () {
            form.dataset.submitting = 'false';
            if (submit) { submit.disabled = false; submit.setAttribute('aria-disabled', 'false'); }
          });
      });
    });
  }

  function initStickyBar(root) {
    var stickyBar = root.querySelector('[data-sticky-mobile-bar="true"]');
    var form = root.querySelector('.caviera-product-form');
    if (!stickyBar || !form || !('IntersectionObserver' in window)) return;
    if (boundStickyObserver) boundStickyObserver.disconnect();
    boundStickyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var visible = !entry.isIntersecting && window.innerWidth < 900;
        stickyBar.classList.toggle('is-visible', visible);
        // The bar is fixed-position and otherwise overlays whatever content is currently at the
        // bottom of the viewport (the last accordion row, the bespoke CTA, recommendations) —
        // this reserves real space for it only while it's actually shown, so it never blocks
        // content but also never leaves a permanent empty gap once it's hidden again.
        document.body.classList.toggle('has-sticky-add-to-cart', visible);
      });
    });
    boundStickyObserver.observe(form);
    var stickyBtn = stickyBar.querySelector('[data-sticky-add-to-cart]');
    if (stickyBtn && !stickyBtn.dataset.clickBound) {
      stickyBtn.dataset.clickBound = 'true';
      stickyBtn.addEventListener('click', function () {
        var addBtn = form.querySelector('[data-add-to-cart]');
        if (addBtn) addBtn.click();
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function initQuantitySteppers(root) {
    root.querySelectorAll('[data-quantity-decrease], [data-quantity-increase]').forEach(function (btn) {
      if (btn.dataset.clickBound) return;
      btn.dataset.clickBound = 'true';
      btn.addEventListener('click', function () {
        var wrap = btn.closest('.caviera-product-form__quantity');
        var input = wrap.querySelector('[data-quantity-input]');
        var value = parseInt(input.value || '1', 10);
        value = btn.hasAttribute('data-quantity-decrease') ? Math.max(1, value - 1) : value + 1;
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function initRecommendations(root) {
    var recEl = root.querySelector('product-recommendations[data-url]');
    if (!recEl || recEl.dataset.observed || !('IntersectionObserver' in window)) return;
    recEl.dataset.observed = 'true';
    var recObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        fetch(recEl.dataset.url)
          .then(function (res) { return res.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var content = doc.querySelector('product-recommendations');
            if (content && content.innerHTML.trim()) recEl.innerHTML = content.innerHTML;
          })
          .catch(function () {});
      });
    });
    recObserver.observe(recEl);
  }

  function initProductPage(root) {
    initProductForms(root);
    initStickyBar(root);
    initQuantitySteppers(root);
    initRecommendations(root);
  }

  initProductPage(document);
  document.addEventListener('shopify:section:load', function (e) { initProductPage(e.target); });
})();
