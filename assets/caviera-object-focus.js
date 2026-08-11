/**
 * Nolan-style sticky object storytelling for "Object in focus". The media column is already
 * sticky at 1024px+ via plain CSS (see .caviera-object-focus__media-col in caviera-home.css) — no
 * scroll-jacking, no forced position, it simply holds in view while the (taller) chapter list
 * scrolls past beside it, same technique already used by Packaging ritual's stage column. This
 * script only ever adds a restrained visual response as each chapter becomes the reading focus:
 * it sets data-active-chapter="<index>" on the media element, and caviera-home.css does the rest
 * (a small scale/shift per state — never a crop so aggressive it undermines "Contain" mode's own
 * promise to show the whole piece).
 *
 * Entirely optional: with no JS, IntersectionObserver support, or before it has run, the media
 * element carries no data-active-chapter attribute at all and renders at its plain resting state —
 * complete and correct either way. Skips entirely under prefers-reduced-motion, matching every
 * other scroll-driven effect in this theme.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initObjectFocus(section) {
    if (section.dataset.chaptersObserved) return;
    var chapters = Array.prototype.slice.call(section.querySelectorAll('.caviera-object-focus__chapter'));
    var media = section.querySelector('.caviera-object-focus__media');
    if (!chapters.length || !media || !('IntersectionObserver' in window)) return;
    section.dataset.chaptersObserved = 'true';

    var current = -1;
    function setActive(index) {
      if (index === current) return;
      current = index;
      media.setAttribute('data-active-chapter', String(index));
    }

    var observer = new IntersectionObserver(
      function (entries) {
        // Closest-to-centre wins, not just "first intersecting" — steadier while scrolling
        // quickly past several chapters at once (same approach as caviera-packaging-ritual.js).
        var best = null;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        });
        if (best) {
          var index = chapters.indexOf(best.target);
          if (index !== -1) setActive(index);
        }
      },
      { threshold: 0.5, rootMargin: '-40% 0px -40% 0px' }
    );
    chapters.forEach(function (chapter) { observer.observe(chapter); });
  }

  function init(root) {
    root.querySelectorAll('.caviera-object-focus').forEach(initObjectFocus);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
