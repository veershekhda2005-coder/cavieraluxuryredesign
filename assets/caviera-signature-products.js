/**
 * Signature products — progressive enhancement for sections/caviera-signature-products.liquid.
 *
 * The rail's thumbnails are real `<a href="...">` links to each product's page — this script only
 * intercepts clicks to swap the focused product in place instead of navigating away, and adds
 * ARIA-tabs-pattern keyboard support (arrow keys, Home/End). If this script fails to load or run,
 * every thumbnail still works as a normal link. Swipe on mobile is native CSS scroll-snap on the
 * rail (see assets/caviera-home.css) — no custom touch handling here.
 *
 * Section-reload resilience: bound via a `data-initialized` guard on the section root and re-run
 * scoped to just the reloaded section on `shopify:section:load`, so this keeps working after a
 * merchant edits the section's settings in the Theme Editor.
 */
(function () {
  function initSignatureProducts(scope) {
    scope.querySelectorAll('[data-caviera-signature-products]').forEach(function (root) {
      if (root.dataset.initialized) return;
      root.dataset.initialized = 'true';

      var focus = root.querySelector('[data-signature-focus]');
      var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-signature-thumb]'));
      var panels = root.querySelectorAll('[data-signature-panel]');
      if (!focus || !thumbs.length || !panels.length) return;

      function activate(index) {
        var template = panels[index];
        if (!template) return;
        focus.innerHTML = '';
        focus.appendChild(template.content.cloneNode(true));
        thumbs.forEach(function (thumb, i) {
          var active = i === index;
          thumb.classList.toggle('is-active', active);
          thumb.setAttribute('aria-selected', active ? 'true' : 'false');
          thumb.setAttribute('tabindex', active ? '0' : '-1');
        });
        focus.setAttribute('aria-labelledby', thumbs[index].id);
      }

      thumbs.forEach(function (thumb, index) {
        thumb.addEventListener('click', function (e) {
          e.preventDefault();
          activate(index);
          thumb.focus();
        });
        thumb.addEventListener('keydown', function (e) {
          var lastIndex = thumbs.length - 1;
          var targetIndex = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { targetIndex = index === lastIndex ? 0 : index + 1; }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { targetIndex = index === 0 ? lastIndex : index - 1; }
          else if (e.key === 'Home') { targetIndex = 0; }
          else if (e.key === 'End') { targetIndex = lastIndex; }
          if (targetIndex === null) return;
          e.preventDefault();
          thumbs[targetIndex].focus();
          activate(targetIndex);
        });
      });
    });
  }

  initSignatureProducts(document);
  document.addEventListener('shopify:section:load', function (e) { initSignatureProducts(e.target); });
})();
