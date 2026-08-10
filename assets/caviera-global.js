/**
 * Global, page-independent behaviour: money formatting helper, scroll-reveal wiring, and a couple
 * of small accessibility conveniences. No frameworks, no jQuery.
 */
window.Shopify = window.Shopify || {};

/* Canonical Shopify money formatter (per Shopify's documented reference implementation),
   driven by the shop's configured money_format so no currency symbol is ever hardcoded. */
Shopify.formatMoney = function (cents, format) {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  var value = '';
  var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  var formatString = format || (window.theme && window.theme.moneyFormat) || '${{amount}}';

  function defaultOption(opt, def) { return typeof opt === 'undefined' ? def : opt; }
  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = defaultOption(precision, 2);
    thousands = defaultOption(thousands, ',');
    decimal = defaultOption(decimal, '.');
    if (isNaN(number) || number == null) return 0;
    number = (number / 100.0).toFixed(precision);
    var parts = number.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    var cents2 = parts[1] ? decimal + parts[1] : '';
    return dollars + cents2;
  }

  switch (formatString.match(placeholderRegex)[1]) {
    case 'amount': value = formatWithDelimiters(cents, 2); break;
    case 'amount_no_decimals': value = formatWithDelimiters(cents, 0); break;
    case 'amount_with_comma_separator': value = formatWithDelimiters(cents, 2, '.', ','); break;
    case 'amount_no_decimals_with_comma_separator': value = formatWithDelimiters(cents, 0, '.', ','); break;
    default: value = formatWithDelimiters(cents, 2);
  }
  return formatString.replace(placeholderRegex, value);
};

/* Confirm before destructive actions (e.g. deleting a saved address). */
document.querySelectorAll('[data-confirm]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    var message = el.dataset.confirm || (window.theme && window.theme.strings && window.theme.strings.confirmDelete) || 'Are you sure?';
    if (!window.confirm(message)) e.preventDefault();
  });
});

/* Share action — native share sheet where available, clipboard-copy fallback otherwise. */
document.querySelectorAll('[data-share-button]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var url = btn.dataset.shareUrl;
    var title = btn.dataset.shareTitle;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        var original = btn.textContent;
        btn.textContent = (window.theme && window.theme.strings && window.theme.strings.linkCopied) || 'Link copied';
        setTimeout(function () { btn.textContent = original; }, 1800);
      });
    }
  });
});

/* Quick add — from any product card, anywhere the shared snippet is used (homepage, collection,
   search, recommendations). Never guesses a variant on a multi-option product: only a product
   with a single purchasable variant adds directly; anything else sends the customer to the
   product page to choose, exactly as the shared product-card documents.

   Section-reload resilience: bound via a `data-*-bound` guard and re-run scoped to just the
   reloaded section on `shopify:section:load`, so quick-add and scroll-reveal keep working after a
   merchant changes a section's settings in the Theme Editor (a plain top-level querySelectorAll
   would otherwise never see the freshly-rendered elements again). */
function initQuickAdd(root) {
  root.querySelectorAll('[data-quick-add]').forEach(function (btn) {
    if (btn.dataset.clickBound) return;
    btn.dataset.clickBound = 'true';
    btn.addEventListener('click', function () {
      var singleVariant = btn.dataset.quickAddSingleVariant === 'true';
      var url = btn.dataset.productUrl;
      if (!singleVariant) {
        if (url) window.location.href = url;
        return;
      }
      var variantId = btn.dataset.variantId;
      if (!variantId) { if (url) window.location.href = url; return; }
      btn.setAttribute('aria-disabled', 'true');
      var originalText = btn.textContent;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
      })
        .then(function (res) { if (!res.ok) return res.json().then(function (d) { throw d; }); return res.json(); })
        .then(function () {
          document.dispatchEvent(new CustomEvent('caviera:cart:add'));
        })
        .catch(function () {
          // Fail open — never leave the customer stuck on a silently broken button.
          if (url) window.location.href = url;
        })
        .finally(function () {
          btn.setAttribute('aria-disabled', 'false');
          btn.textContent = originalText;
        });
    });
  });
}
initQuickAdd(document);

/* Scroll reveal — cheap, IntersectionObserver-based, respects reduced motion via CSS already. */
var revealObserver = null;
function initScrollReveal(root) {
  var els = root.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  }
  els.forEach(function (el) {
    if (el.dataset.revealObserved) return;
    el.dataset.revealObserved = 'true';
    revealObserver.observe(el);
  });
}
initScrollReveal(document);

document.addEventListener('shopify:section:load', function (e) {
  initQuickAdd(e.target);
  initScrollReveal(e.target);
});
