/**
 * Predictive search overlay: opens from the header trigger, fetches Shopify's predictive search
 * endpoint (debounced), renders product/collection/page/article results, keyboard-navigable,
 * with loading and empty states. Falls back to a normal /search results page on submit.
 */
(function () {
  var overlay = document.getElementById('caviera-search-overlay');
  if (!overlay) return;
  var input = overlay.querySelector('[data-search-input]');
  var clearBtn = overlay.querySelector('[data-search-clear]');
  var resultsEl = overlay.querySelector('[data-search-results]');
  var closeEls = overlay.querySelectorAll('[data-search-close]');
  var lastFocused = null;
  var debounceTimer = null;
  var currentController = null;

  function open() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('no-scroll');
    input.focus();
    document.addEventListener('keydown', onKeydown);
  }
  function close() {
    overlay.hidden = true;
    document.documentElement.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused) lastFocused.focus();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') trapFocus(e);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') onArrowKey(e);
  }
  // Arrow-key navigation among the currently rendered result links, from the input or from
  // within the results themselves — Enter then follows the focused link natively.
  function onArrowKey(e) {
    var links = Array.prototype.slice.call(resultsEl.querySelectorAll('a'));
    if (!links.length) return;
    e.preventDefault();
    var currentIndex = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      var next = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, links.length - 1);
      links[next].focus();
    } else if (currentIndex === -1 || currentIndex === 0) {
      input.focus();
    } else {
      links[currentIndex - 1].focus();
    }
  }
  function trapFocus(e) {
    var focusables = overlay.querySelectorAll('a, button, input');
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // The trigger button lives inside the header section, which can be reloaded independently by
  // the Theme Editor — bind (and re-bind after such a reload) rather than looking it up once.
  function bindSearchTrigger(root) {
    var trigger = root.querySelector('[data-caviera-search-toggle]');
    if (!trigger || trigger.dataset.clickBound) return;
    trigger.dataset.clickBound = 'true';
    trigger.addEventListener('click', open);
  }
  bindSearchTrigger(document);
  document.addEventListener('shopify:section:load', function (e) { bindSearchTrigger(e.target); });

  closeEls.forEach(function (el) { el.addEventListener('click', close); });

  if (input) {
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var term = input.value.trim();
      if (clearBtn) clearBtn.hidden = !term;
      if (!term) { resultsEl.innerHTML = ''; return; }
      resultsEl.innerHTML = '<p class="caviera-search-overlay__status">' + (window.theme && window.theme.strings && window.theme.strings.loading || 'Searching…') + '</p>';
      debounceTimer = setTimeout(function () { fetchResults(term); }, 220);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      resultsEl.innerHTML = '';
      clearBtn.hidden = true;
      input.focus();
    });
  }

  function fetchResults(term) {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    var url = (window.theme.routes.predictiveSearch || '/search/suggest') +
      '?q=' + encodeURIComponent(term) +
      '&resources[type]=product,collection,page,article' +
      '&resources[limit]=6' +
      '&section_id=predictive-search';
    fetch(url, { signal: currentController.signal })
      .then(function (res) { return res.json(); })
      .then(function (data) { render(term, data.resources ? data.resources.results : null); })
      .catch(function (err) { if (err.name !== 'AbortError') resultsEl.innerHTML = ''; });
  }

  function render(term, results) {
    if (!results) { resultsEl.innerHTML = ''; return; }
    var groups = [
      { key: 'products', label: window.theme.strings.products || 'Jewellery' },
      { key: 'collections', label: window.theme.strings.collections || 'Collections' },
      { key: 'pages', label: window.theme.strings.pages || 'Pages' },
      { key: 'articles', label: window.theme.strings.articles || 'Journal' }
    ];
    var total = groups.reduce(function (sum, g) { return sum + (results[g.key] || []).length; }, 0);
    if (total === 0) {
      resultsEl.innerHTML = '<p class="caviera-search-overlay__status">' + (window.theme.strings.noResults || 'No results') + ' “' + escapeHtml(term) + '”.</p>';
      return;
    }
    var html = '';
    groups.forEach(function (group) {
      var items = results[group.key] || [];
      if (!items.length) return;
      html += '<div class="caviera-search-overlay__group"><h3 class="label">' + group.label + '</h3><ul>';
      items.forEach(function (item) {
        // /search/suggest.json returns product prices as a bare decimal-dollar string (e.g.
        // "860.00") with no currency symbol — confirmed by inspecting the real endpoint's response
        // during hosted QA, since this is a real difference from the cart/product JSON endpoints
        // (which use integer cents). Shopify.formatMoney already accepts a decimal string directly
        // (it strips the "." and treats the result as cents), so this reuses the same money
        // formatter as the rest of the theme rather than ever hardcoding a currency symbol.
        var priceHtml = '';
        if (item.price && window.Shopify && window.Shopify.formatMoney) {
          priceHtml = '<span class="price">' + Shopify.formatMoney(item.price) + '</span>';
        }
        html += '<li><a href="' + item.url + '">' +
          (item.image ? '<img src="' + item.image + '" width="56" height="56" loading="lazy" alt="">' : '') +
          '<span>' + escapeHtml(item.title) + priceHtml + '</span>' +
          '</a></li>';
      });
      html += '</ul></div>';
    });
    resultsEl.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.theme = window.theme || {};
  window.theme.strings = window.theme.strings || {};
})();
