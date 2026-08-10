/**
 * Cart drawer: AJAX add/update/remove against Shopify's cart.js endpoints, focus trap, Escape
 * close, focus restoration, ARIA live status. Checkout stays fully Shopify-hosted — this script
 * never touches /checkout beyond linking to it.
 */
(function () {
  var drawer = document.getElementById('caviera-cart-drawer');

  // The trigger button lives inside the header section, which can be reloaded independently by
  // the Theme Editor — bind (and re-bind after such a reload) rather than looking it up once.
  function bindCartTrigger(root) {
    var trigger = root.querySelector('[data-caviera-cart-toggle]');
    if (!trigger || trigger.dataset.clickBound) return;
    trigger.dataset.clickBound = 'true';
    if (!drawer) {
      // Drawer disabled by settings — cart icon still links sensibly to the cart page.
      trigger.addEventListener('click', function () { window.location.href = window.theme.routes.cartUrl; });
    } else {
      trigger.addEventListener('click', function () { open(); refresh(); });
    }
  }

  if (!drawer) {
    bindCartTrigger(document);
    document.addEventListener('shopify:section:load', function (e) { bindCartTrigger(e.target); });
    return;
  }

  var closeEls = drawer.querySelectorAll('[data-cart-close]');
  var itemsEl = drawer.querySelector('[data-cart-items]');
  var statusEl = drawer.querySelector('[data-cart-status]');
  var lastFocused = null;

  function money(cents) { return Shopify.formatMoney(cents); }

  function open() {
    lastFocused = document.activeElement;
    drawer.hidden = false;
    document.documentElement.classList.add('no-scroll');
    document.addEventListener('keydown', onKeydown);
    var closeBtn = drawer.querySelector('.caviera-cart-drawer__close');
    if (closeBtn) closeBtn.focus();
  }
  function close() {
    drawer.hidden = true;
    document.documentElement.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused) lastFocused.focus();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e);
  }
  function trapFocus(e) {
    var focusables = drawer.querySelectorAll('a, button, textarea, input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  bindCartTrigger(document);
  document.addEventListener('shopify:section:load', function (e) { bindCartTrigger(e.target); });
  closeEls.forEach(function (el) { el.addEventListener('click', close); });
  document.addEventListener('caviera:cart:add', function () { refresh(); open(); });

  function setCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.setAttribute('data-cart-count', count);
    });
    // The visible badge is aria-hidden (a bare number reads poorly to screen readers) — the
    // accessible name lives on this sibling label instead, so it needs the same update.
    var strings = window.theme && window.theme.strings;
    document.querySelectorAll('[data-cart-label]').forEach(function (el) {
      if (!strings) return;
      if (count === 0) el.textContent = strings.cartLabelEmpty;
      else if (count === 1) el.textContent = strings.cartLabelOne.replace('__COUNT__', count);
      else el.textContent = strings.cartLabelOther.replace('__COUNT__', count);
    });
  }

  function refresh() {
    fetch('/cart.js').then(function (r) { return r.json(); }).then(render).catch(function () {});
  }

  function render(cart) {
    setCount(cart.item_count);
    // Hide the footer rather than removing it: this same drawer stays in the DOM for the rest of
    // the page's life, so if the cart is emptied and then something is added again later, the
    // checkout button/subtotal/view-cart link must still be there to bring back — not gone until
    // a full page reload.
    var footer = drawer.querySelector('.caviera-cart-drawer__footer');
    if (cart.item_count === 0) {
      itemsEl.innerHTML = '<div class="caviera-cart-drawer__empty"><p class="body-text">' +
        (window.theme.strings.cartEmpty || 'Your bag is empty.') + '</p></div>';
      if (footer) footer.hidden = true;
      return;
    }
    if (footer) footer.hidden = false;

    // Discount allocations can change as a direct result of a quantity update (e.g. a cart-level
    // "spend X, save Y%" discount crossing its threshold) — keep this in sync, not just subtotal.
    var discountsEl = drawer.querySelector('[data-cart-discounts]');
    if (discountsEl) {
      if (cart.cart_level_discount_applications && cart.cart_level_discount_applications.length) {
        discountsEl.innerHTML = cart.cart_level_discount_applications.map(function (d) {
          return '<li>' + escapeHtml(d.title) + '</li>';
        }).join('');
        discountsEl.hidden = false;
      } else {
        discountsEl.hidden = true;
      }
    }
    var html = '<ul class="caviera-cart-drawer__list">';
    cart.items.forEach(function (item, i) {
      html += '<li class="caviera-cart-drawer__item" data-cart-item data-line="' + (i + 1) + '">' +
        '<a href="' + item.url + '" class="caviera-cart-drawer__item-media">' +
        (item.image ? '<img src="' + item.image + '&width=160" width="80" height="80" alt="" loading="lazy">' : '') +
        '</a>' +
        '<div class="caviera-cart-drawer__item-info">' +
        '<a href="' + item.url + '" class="caviera-cart-drawer__item-title">' + escapeHtml(item.product_title) + '</a>' +
        (item.variant_title ? '<p class="label caviera-cart-drawer__item-variant">' + escapeHtml(item.variant_title) + '</p>' : '') +
        '<div class="caviera-cart-drawer__item-row">' +
        '<div class="caviera-cart-drawer__qty">' +
        '<button type="button" class="caviera-product-form__qty-btn" data-cart-qty-decrease data-line="' + (i + 1) + '" aria-label="Decrease quantity">−</button>' +
        '<span data-cart-qty>' + item.quantity + '</span>' +
        '<button type="button" class="caviera-product-form__qty-btn" data-cart-qty-increase data-line="' + (i + 1) + '" aria-label="Increase quantity">+</button>' +
        '</div><span class="price">' + money(item.final_line_price) + '</span></div></div>' +
        '<button type="button" class="caviera-cart-drawer__remove" data-cart-remove data-line="' + (i + 1) + '">Remove</button>' +
        '</li>';
    });
    html += '</ul>';
    itemsEl.innerHTML = html;

    var subtotalEl = drawer.querySelector('[data-cart-subtotal]');
    if (subtotalEl) subtotalEl.textContent = money(cart.total_price);

    var shippingEl = drawer.querySelector('[data-shipping-message]');
    if (shippingEl) {
      var threshold = parseInt(shippingEl.dataset.threshold, 10);
      if (threshold > 0) {
        var remaining = threshold - cart.total_price;
        shippingEl.textContent = remaining > 0
          ? (window.theme.strings.shippingAtLeast || 'Spend __AMOUNT__ more for free shipping.').replace('__AMOUNT__', money(remaining))
          : (window.theme.strings.shippingQualified || 'Your order qualifies for free shipping.');
      }
    }
  }

  // Only one line-change request in flight at a time — prevents rapid repeat clicks (or a slow
  // network response) from racing each other and leaving the drawer showing a stale quantity.
  var changeInFlight = false;

  function changeLine(line, quantity) {
    if (changeInFlight) return;
    changeInFlight = true;
    itemsEl.classList.add('is-loading');
    statusEl.textContent = '';
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) { render(cart); statusEl.textContent = window.theme.strings.cartUpdated || 'Cart updated'; })
      .catch(function () { statusEl.textContent = window.theme.strings.cartError || 'Something did not update. Please try again.'; })
      .finally(function () { changeInFlight = false; itemsEl.classList.remove('is-loading'); });
  }

  itemsEl.addEventListener('click', function (e) {
    var dec = e.target.closest('[data-cart-qty-decrease]');
    var inc = e.target.closest('[data-cart-qty-increase]');
    var rem = e.target.closest('[data-cart-remove]');
    if (!dec && !inc && !rem) return;
    if (changeInFlight) return;
    var li = e.target.closest('[data-cart-item]');
    var line = parseInt((dec || inc || rem).dataset.line, 10);
    var qtyEl = li.querySelector('[data-cart-qty]');
    var current = parseInt(qtyEl ? qtyEl.textContent : '1', 10);
    if (rem) changeLine(line, 0);
    else changeLine(line, dec ? Math.max(0, current - 1) : current + 1);
  });

  var noteField = drawer.querySelector('[data-cart-note]');
  if (noteField) {
    noteField.addEventListener('blur', function () {
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteField.value })
      }).catch(function () {});
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
