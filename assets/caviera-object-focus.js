/**
 * Nolan-style sticky object storytelling for "Object in focus". The media column is already
 * sticky at 1024px+ via plain CSS (see .caviera-object-focus__media-col in caviera-home.css) — no
 * scroll-jacking, no forced position, it simply holds in view while the (taller) chapter list
 * scrolls past beside it, same technique already used by Packaging ritual's stage column.
 *
 * This script decides which chapter is nearest the reading focus and reflects that in two places:
 *   1. .caviera-object-focus__media gets data-active-chapter="<index>" — caviera-home.css crossfades
 *      the matching real image state there (a small scale/shift too, never a crop so aggressive it
 *      undermines "Contain" mode's own promise to show the whole piece).
 *   2. the matching <li class="caviera-object-focus__chapter"> gets .is-active — caviera-home.css
 *      dims the other chapters slightly (never hidden) as a quiet reading cue.
 *
 * DETECTION: a deterministic "closest chapter centre to a fixed viewport focal line" calculation,
 * recomputed on every scroll frame (rAF-throttled) — not IntersectionObserver. An observer with a
 * fixed threshold against a shrunk root margin proved unreliable elsewhere in this project for
 * elements whose height can vary a lot relative to the observed band (see assets/caviera-house-
 * codes.js's own fix note); this calculation has no such failure mode and works identically
 * scrolling up or down, since it's recomputed from scratch every time rather than derived from the
 * previous state. A single, generous IntersectionObserver on the section as a whole (not the
 * chapters) gates the scroll listener on/off, so it isn't running for the rest of the page.
 *
 * Entirely optional: with no JS, or before it has run, the media element carries no data-active-
 * chapter attribute and no chapter carries .is-active — both render at their plain resting,
 * fully-readable state either way. Skips entirely under prefers-reduced-motion, matching every
 * other scroll-driven effect in this theme.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initObjectFocus(section) {
    if (section.dataset.chaptersBound) return;
    var chapterList = section.querySelector('.caviera-object-focus__chapters');
    var chapters = Array.prototype.slice.call(section.querySelectorAll('.caviera-object-focus__chapter'));
    var media = section.querySelector('.caviera-object-focus__media');
    if (!chapters.length || !media) return;
    section.dataset.chaptersBound = 'true';

    var current = -1;
    var ticking = false;

    function setActive(index) {
      if (index === current) return;
      current = index;
      media.setAttribute('data-active-chapter', String(index));
      chapters.forEach(function (chapter, i) {
        chapter.classList.toggle('is-active', i === index);
      });
    }

    function update() {
      ticking = false;
      // Focal line at ~50% viewport height — "the chapter nearest the reading focus", per brief.
      var focalY = window.innerHeight * 0.5;
      var bestIndex = -1;
      var bestDelta = Infinity;
      chapters.forEach(function (chapter, i) {
        var rect = chapter.getBoundingClientRect();
        var chapterCenter = rect.top + rect.height / 2;
        var delta = Math.abs(chapterCenter - focalY);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = i;
        }
      });
      if (bestIndex !== -1) setActive(bestIndex);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    // Only run the scroll handler while the section is actually near the viewport — a single,
    // generous observer on the section itself, purely to avoid a scroll listener running for the
    // entire rest of the page.
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          var isNear = entries.some(function (entry) { return entry.isIntersecting; });
          if (isNear) {
            update();
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
          } else {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
          }
        },
        { rootMargin: '100% 0px 100% 0px' }
      );
      sectionObserver.observe(section);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }

    // Only now — once detection is actually wired up — let CSS dim the non-active chapters (see
    // [data-observing="true"] in caviera-home.css). Every chapter stays at full opacity until this
    // point, so a slow/blocked/failed script never leaves anything hard to read.
    if (chapterList) chapterList.setAttribute('data-observing', 'true');
  }

  function init(root) {
    root.querySelectorAll('.caviera-object-focus').forEach(initObjectFocus);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
