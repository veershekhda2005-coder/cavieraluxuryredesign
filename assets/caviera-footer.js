/**
 * Footer navigation — mobile accordion, progressive enhancement only. The <ul> for each menu
 * column has no `hidden` attribute in the markup (see sections/caviera-footer.liquid): every
 * link is fully visible and reachable without this script. Only collapsed into a tap-to-open
 * accordion below the 900px breakpoint (matching the header's own mobile/desktop split) — at
 * desktop widths the button is left completely inert (no listener attached, aria-expanded never
 * changed), rather than attaching a click handler that would toggle state with no visible effect
 * once CSS makes the list unconditionally visible there. Re-evaluated on resize, since a tablet
 * rotation or a resized desktop window can cross the breakpoint without a page reload.
 */
(function () {
  var MOBILE_QUERY = '(max-width: 899px)';

  function toggle(button, list) {
    var isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    if (isOpen) {
      list.setAttribute('hidden', '');
    } else {
      list.removeAttribute('hidden');
    }
  }

  function onClick(e) {
    var button = e.currentTarget;
    var list = document.getElementById(button.getAttribute('aria-controls'));
    if (list) toggle(button, list);
  }

  function setMode(column, isMobile) {
    var button = column.querySelector('.caviera-footer__column-toggle');
    var list = column.querySelector('.caviera-footer__column-list');
    if (!button || !list) return;
    if (isMobile) {
      if (!button.dataset.accordionBound) {
        button.dataset.accordionBound = 'true';
        button.addEventListener('click', onClick);
      }
      if (button.getAttribute('aria-expanded') === null) {
        button.setAttribute('aria-expanded', 'false');
        list.setAttribute('hidden', '');
      }
    } else if (button.dataset.accordionBound) {
      button.removeEventListener('click', onClick);
      delete button.dataset.accordionBound;
      button.removeAttribute('aria-expanded');
      list.removeAttribute('hidden');
    }
  }

  function initFooterAccordions(root) {
    var columns = root.querySelectorAll('[data-footer-accordion]');
    if (!columns.length) return;
    var mq = window.matchMedia(MOBILE_QUERY);
    var apply = function () {
      columns.forEach(function (column) { setMode(column, mq.matches); });
    };
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply); // older Safari
  }

  function init(root) {
    root.querySelectorAll('.caviera-footer').forEach(initFooterAccordions);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
