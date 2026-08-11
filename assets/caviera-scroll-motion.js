/**
 * CAVIERA Bespoke + client service — direct scroll-progress motion. ONE controller for both
 * sections (no second competing system, no IntersectionObserver for the motion itself).
 *
 * ROOT-CAUSE NOTE: three previous passes used an IntersectionObserver-driven ENTRANCE TRIGGER
 * (crossing a visibility threshold added/removed a single .is-active class, and CSS transitioned
 * between two fixed states). Each pass traced correctly in code review, but real-browser testing
 * repeatedly reported no perceptible motion. This file replaces that architecture entirely: there
 * is no threshold, no discrete on/off state, and no CSS transition on the scroll-driven
 * properties at all. Motion is a continuous, deterministic function of the section's own
 * getBoundingClientRect() on every scroll frame — recomputed from scratch each time, so it is
 * inherently reversible (scrolling up runs the exact same function backwards) and inherently
 * correct on load (update() runs once immediately, with no dependency on a first scroll event).
 *
 * One passive scroll listener requests a single animation frame; all math happens inside that
 * frame, never in the scroll handler itself. Only opacity/transform (and CSS custom properties)
 * are written — never top/left/width/height/margin.
 *
 * Both sections write a single raw 0-1 progress value (--bespoke-progress / --service-progress)
 * for a deliberately narrow "reading window" — from the section's top sitting at ~80% down the
 * viewport (0) to ~30% down (1) — rather than the section's full enter-to-exit passage, so the
 * motion resolves while the section is actually being read. Every per-element sub-progress
 * (CTA/underline/arrow on Bespoke; heading/three columns/dividers on Service) is then derived from
 * that one raw value with its own mapped window, either here in JS (where three keyframes need a
 * piecewise interpolation) or directly in CSS via calc()/clamp() (where only two are needed).
 *
 * data-bespoke-scroll-motion / data-service-scroll-motion are added to each section root only
 * once this script has actually initialised it, and never at all under prefers-reduced-motion
 * (the script returns immediately) — every hidden/offset starting value in CSS is gated behind
 * that attribute, and every custom property is read with a fallback equal to the fully-resolved
 * state, so without JS (or under reduced motion) nothing is ever hidden.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MIN_WIDTH = 700; // matches this section pair's own three-column breakpoint

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  // Piecewise: p<=0.5 lerps triplet[0]->[1] over 0-0.5; p>0.5 lerps triplet[1]->[2] over 0.5-1 —
  // reproduces an authored, front-loaded curve from three explicit keyframes without needing a
  // named easing function.
  function piecewise(triplet, p) {
    if (p <= 0.5) return lerp(triplet[0], triplet[1], p / 0.5);
    return lerp(triplet[1], triplet[2], (p - 0.5) / 0.5);
  }

  // Deliberately narrow "reading window": section top at 80% down the viewport -> progress 0;
  // section top at 30% down (upper-middle) -> progress 1. Not the section's full scroll passage.
  function readingWindowProgress(rect, vh) {
    var startLine = vh * 0.8;
    var endLine = vh * 0.3;
    return clamp((startLine - rect.top) / (startLine - endLine), 0, 1);
  }

  var updaters = [];
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      updaters.forEach(function (fn) { fn(); });
    });
  }

  function initBespoke(section) {
    if (section.dataset.scrollMotionBound) return;
    section.dataset.scrollMotionBound = 'true';
    section.setAttribute('data-bespoke-scroll-motion', 'true');

    var HEADLINE_OPACITY = [0.18, 0.75, 1];
    var HEADLINE_Y = [32, 12, 0]; // px
    var HEADLINE_X = [8, 3, 0]; // px

    return function update() {
      var rect = section.getBoundingClientRect();
      var p = readingWindowProgress(rect, window.innerHeight);
      section.style.setProperty('--bespoke-progress', p.toFixed(4));
      section.style.setProperty('--bespoke-headline-opacity', piecewise(HEADLINE_OPACITY, p).toFixed(3));
      section.style.setProperty('--bespoke-headline-y', piecewise(HEADLINE_Y, p).toFixed(2) + 'px');
      section.style.setProperty('--bespoke-headline-x', piecewise(HEADLINE_X, p).toFixed(2) + 'px');
    };
  }

  function initServiceDesktop(section) {
    return function update() {
      var rect = section.getBoundingClientRect();
      var p = readingWindowProgress(rect, window.innerHeight);
      section.style.setProperty('--service-progress', p.toFixed(4));
    };
  }

  // Mobile (<700px): items stack vertically and enter the viewport at very different times, so
  // each gets its OWN progress from its own position rather than sharing the section's single
  // window — "Made to Order resolves as it approaches view", independently of the others.
  function initServiceMobile(section, items) {
    return function update() {
      var vh = window.innerHeight;
      var headingRect = section.getBoundingClientRect();
      section.style.setProperty('--service-progress', readingWindowProgress(headingRect, vh).toFixed(4));
      items.forEach(function (item) {
        var rect = item.getBoundingClientRect();
        item.style.setProperty('--service-item-progress', readingWindowProgress(rect, vh).toFixed(4));
      });
    };
  }

  function setupService(section) {
    if (section.dataset.scrollMotionBound) return;
    section.dataset.scrollMotionBound = 'true';
    section.setAttribute('data-service-scroll-motion', 'true');

    var items = Array.prototype.slice.call(section.querySelectorAll('.caviera-services__item'));
    var mode = null;
    var desktopUpdate = initServiceDesktop(section);
    var mobileUpdate = items.length ? initServiceMobile(section, items) : desktopUpdate;
    var activeUpdate = null;

    function sync() {
      var nextMode = window.innerWidth >= MIN_WIDTH ? 'desktop' : 'mobile';
      if (nextMode === mode) return;
      mode = nextMode;
      activeUpdate = mode === 'desktop' ? desktopUpdate : mobileUpdate;
    }

    sync();
    updaters.push(function () {
      sync();
      activeUpdate();
    });
  }

  function init(root) {
    root.querySelectorAll('.caviera-bespoke').forEach(function (section) {
      var update = initBespoke(section);
      if (update) updaters.push(update);
    });
    root.querySelectorAll('.caviera-services').forEach(setupService);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });

  if (updaters.length) {
    // Correct immediately on load — no dependency on a first scroll event, so a page that
    // refreshes with either section already on screen shows the right state right away.
    updaters.forEach(function (fn) { fn(); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        updaters.forEach(function (fn) { fn(); });
      },
      { passive: true }
    );
  }
})();
