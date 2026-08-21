(function () {
  'use strict';

  if (window.Shopify && window.Shopify.designMode) return;

  var editableSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

  document.addEventListener('contextmenu', function (event) {
    var target = event.target;

    if (target instanceof Element && target.closest(editableSelector)) return;

    event.preventDefault();
  });
})();
