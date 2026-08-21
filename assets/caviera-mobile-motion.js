/* CAVIERA mobile high-pass: deterministic still-image storytelling, no libraries or scroll lock. */
(function () {
  'use strict';

  var MOBILE = '(max-width: 899px)';
  var REDUCED = '(prefers-reduced-motion: reduce)';
  var mobileQuery = window.matchMedia(MOBILE);
  var reducedQuery = window.matchMedia(REDUCED);
  var cleanup = [];
  var resizeTimer = null;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function progressFor(element) {
    var rect = element.getBoundingClientRect();
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    var distance = Math.max(1, rect.height - viewport);
    return clamp(-rect.top / distance);
  }
  function setState(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanup.push(function () { target.removeEventListener(type, handler, options); });
  }

  function initThreeWorlds() {
    var root = document.querySelector('[data-caviera-three-worlds]');
    if (!root) return;
    var threshold = root.querySelector('[data-world="threshold"]');
    var constant = root.querySelector('[data-world="constant"]');
    var editions = root.querySelector('[data-world="editions"]');
    var privateWorld = root.querySelector('[data-world="commissions"]');
    var inRange = false;
    var queued = false;

    root.setAttribute('data-caviera-mobile-motion', 'ready');

    function update() {
      queued = false;
      if (!inRange) return;

      if (threshold) {
        var thresholdProgress = progressFor(threshold);
        threshold.style.setProperty('--caviera-mobile-progress', thresholdProgress.toFixed(4));
        setState(threshold, 'data-mobile-phase', thresholdProgress < 0.18 ? 'wordmark' : thresholdProgress < 0.42 ? 'heading' : thresholdProgress < 0.72 ? 'enter' : 'release');
      }

      if (constant) {
        var constantProgress = progressFor(constant);
        var codes = ['master', 'seal', 'oryx', 'provenance', 'material', 'ritual', 'permanence'];
        var constantIndex = constantProgress < 0.10 ? 0 : Math.min(6, 1 + Math.floor((constantProgress - 0.10) / 0.14));
        constant.style.setProperty('--caviera-mobile-progress', constantProgress.toFixed(4));
        setState(constant, 'data-mobile-code', codes[constantIndex]);
      }

      if (editions) {
        var editionsProgress = progressFor(editions);
        var editionsPhase = editionsProgress < 0.30 ? 'intro' : editionsProgress < 0.48 ? 'light-study' : editionsProgress < 0.62 ? 'master' : editionsProgress < 0.82 ? 'reveal-stage' : 'final';
        editions.style.setProperty('--caviera-mobile-progress', editionsProgress.toFixed(4));
        setState(editions, 'data-mobile-edition-phase', editionsPhase);
      }

      if (privateWorld) {
        var privateProgress = progressFor(privateWorld);
        var privatePhase = 'intro';
        if (privateProgress >= 0.12 && privateProgress < 0.27) privatePhase = 'stone';
        else if (privateProgress < 0.42 && privateProgress >= 0.27) privatePhase = 'design';
        else if (privateProgress < 0.57 && privateProgress >= 0.42) privatePhase = 'making';
        else if (privateProgress < 0.72 && privateProgress >= 0.57) privatePhase = 'authentication';
        else if (privateProgress < 0.92 && privateProgress >= 0.72) privatePhase = 'presentation';
        else if (privateProgress >= 0.92) privatePhase = 'final';
        privateWorld.style.setProperty('--caviera-mobile-progress', privateProgress.toFixed(4));
        setState(privateWorld, 'data-mobile-private-phase', privatePhase);
      }
    }

    function requestUpdate() {
      if (!inRange || queued) return;
      queued = true;
      requestAnimationFrame(update);
    }

    var observer = new IntersectionObserver(function (entries) {
      inRange = entries[0].isIntersecting;
      if (inRange) requestUpdate();
    }, { rootMargin: '100% 0px 100% 0px' });
    observer.observe(root);
    cleanup.push(function () { observer.disconnect(); });
    listen(window, 'scroll', requestUpdate, { passive: true });
    listen(window, 'resize', requestUpdate, { passive: true });
    update();
  }

  function initObservedMotion() {
    var selectors = [
      '.caviera-house-codes__panel',
      '.caviera-edition-teaser__copy',
      '.caviera-edition-teaser__media-primary',
      '.caviera-edition-teaser__media-secondary',
      '.caviera-edition-teaser__media-detail',
      '.caviera-object-focus__chapter',
      '.caviera-craftsmanship__row',
      '.caviera-craftsmanship__story',
      '[data-makers-mark] .caviera-editorial__maker-detail',
      '[data-makers-mark] .caviera-editorial__provenance',
      '.caviera-ritual__step'
    ];
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selectors.join(',')));
    if (!nodes.length) return;
    document.documentElement.setAttribute('data-caviera-mobile-observed-motion', 'ready');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.setAttribute('data-mobile-active', 'true');
        else if (entry.boundingClientRect.top > 0) entry.target.removeAttribute('data-mobile-active');
      });
    }, { rootMargin: '-12% 0px -20% 0px', threshold: [0.18, 0.42] });
    nodes.forEach(function (node) { observer.observe(node); });
    cleanup.push(function () { observer.disconnect(); });
  }

  function teardown() {
    cleanup.splice(0).forEach(function (dispose) { dispose(); });
    document.documentElement.removeAttribute('data-caviera-mobile-observed-motion');
    document.querySelectorAll('[data-caviera-mobile-motion]').forEach(function (root) {
      root.removeAttribute('data-caviera-mobile-motion');
      root.querySelectorAll('[data-mobile-phase],[data-mobile-code],[data-mobile-edition-phase],[data-mobile-private-phase]').forEach(function (world) {
        world.removeAttribute('data-mobile-phase');
        world.removeAttribute('data-mobile-code');
        world.removeAttribute('data-mobile-edition-phase');
        world.removeAttribute('data-mobile-private-phase');
        world.style.removeProperty('--caviera-mobile-progress');
      });
    });
    document.querySelectorAll('[data-mobile-active]').forEach(function (node) { node.removeAttribute('data-mobile-active'); });
  }

  function sync() {
    teardown();
    if (!mobileQuery.matches || reducedQuery.matches || (window.Shopify && window.Shopify.designMode)) return;
    initThreeWorlds();
    initObservedMotion();
  }
  function scheduleSync() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(sync, 160);
  }

  window.addEventListener('orientationchange', scheduleSync, { passive: true });
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', sync);
  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', sync);
  sync();
})();
