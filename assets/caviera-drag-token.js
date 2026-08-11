/**
 * CAVIERA draggable tokens — a luxury translation of "movable stickers": House Seal medallions,
 * Edition/number plaques. Bounded pointer drag with a very small settle-toward-placement on
 * release (never a full snap-back, never spring/bounce physics — see settleTo's 0.92 retention
 * below). Keyboard-focusable with arrow-key nudging so the interaction isn't pointer-only. Touch
 * pointers and prefers-reduced-motion both leave the token fully visible but non-draggable — a
 * static House artifact rather than a broken or half-working control.
 *
 * FIX (visual-tuning pass): the previous build never cleared the `.is-settling` class — which
 * carries its own 500ms `transform` transition (see caviera-home.css) — when a new grab began.
 * Re-grabbing (or arrow-nudging) within that 500ms window left the transition class in place, so
 * every subsequent pointermove-driven translate3d was EASED over 500ms instead of applied
 * instantly, reading as sticky/laggy/resistant. onPointerDown and the keydown handler now both
 * explicitly clear `.is-settling` up front — see the two `token.classList.remove('is-settling')`
 * calls below — and `.caviera-drag-token.is-dragging` in caviera-home.css now also forces
 * `transition: none` as a second, belt-and-suspenders guarantee that no leftover transition class
 * can ever apply while a drag is actually live.
 */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HAS_DRAGGED_KEY = 'caviera:hasDraggedToken';

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function hasDraggedBefore() {
    try { return window.sessionStorage.getItem(HAS_DRAGGED_KEY) === 'true'; } catch (err) { return false; }
  }
  function markDragged() {
    try { window.sessionStorage.setItem(HAS_DRAGGED_KEY, 'true'); } catch (err) {}
  }

  function initToken(token) {
    if (token.dataset.dragBound) return;
    token.dataset.dragBound = 'true';

    // First-hover-only "Drag" cue: once any token has been successfully dragged this session,
    // every token's cue is retired for the rest of the visit — not just the one that moved.
    if (hasDraggedBefore()) token.classList.add('has-dragged');

    var zone = token.closest('[data-caviera-drag-zone]') || token.parentElement;
    var curX = 0, curY = 0;
    var startX = 0, startY = 0;
    var dragging = false;
    var lastBounds = null;

    // DRAG-RANGE FIX: `zone` now resolves to .caviera-hero__artifact-layer (or, in the Edition I
    // teaser, .caviera-edition-teaser__media) — one shared, hero/composition-wide surface — rather
    // than each artifact's own small positioning wrapper, so this naturally computes a range
    // spanning nearly the whole composition regardless of where the token started. `pad` is a
    // small fixed safety allowance (not token-size-relative — a 1x-token-width pad was previously
    // adding real range on paper but negligible range in practice once the zone itself was tiny;
    // now that the zone is large, a small fixed pad is enough to keep the token comfortably
    // retrievable at the very edge without needing "more room" to compensate for a small zone).
    function bounds() {
      var zr = zone.getBoundingClientRect();
      var tr = token.getBoundingClientRect();
      var pad = 28;
      return {
        minX: -(tr.left - zr.left) - pad,
        maxX: (zr.right - tr.right) + pad,
        minY: -(tr.top - zr.top) - pad,
        maxY: (zr.bottom - tr.bottom) + pad
      };
    }

    function setTransform(x, y) {
      token.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }

    function settleTo(x, y) {
      token.classList.add('is-settling');
      setTransform(x, y);
      setTimeout(function () { token.classList.remove('is-settling'); }, 320);
    }

    function onPointerDown(e) {
      if (e.pointerType === 'touch') return; // graceful degrade: stays visible, just not draggable
      if (typeof e.button === 'number' && e.button !== 0) return;
      // Clear any leftover settle transition FIRST — see the fix note at the top of this file.
      // Without this, re-grabbing a token that is still mid-settle would inherit its transition
      // and every following pointermove would be eased instead of tracking the pointer directly.
      token.classList.remove('is-settling');
      dragging = true;
      lastBounds = bounds();
      startX = e.clientX - curX;
      startY = e.clientY - curY;
      token.classList.add('is-dragging');
      if (token.setPointerCapture) { try { token.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault(); // no text/image selection, no native drag-ghost competing with this gesture
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var b = lastBounds || bounds();
      curX = clamp(e.clientX - startX, b.minX, b.maxX);
      curY = clamp(e.clientY - startY, b.minY, b.maxY);
      setTransform(curX, curY);
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      token.classList.remove('is-dragging');
      markDragged();
      document.querySelectorAll('.caviera-drag-token').forEach(function (t) { t.classList.add('has-dragged'); });
      // Very small settle only — the token keeps the large majority of the offset it was moved
      // (never a full snap back to origin, never an elastic overshoot past it): the pleasure of
      // this interaction is the user actually rearranging the composition, not fighting a spring
      // back to where it started.
      curX *= 0.92;
      curY *= 0.92;
      settleTo(curX, curY);
    }

    token.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    token.addEventListener('keydown', function (e) {
      var step = 14;
      token.classList.remove('is-settling'); // same fix as onPointerDown, for rapid arrow-key repeats
      var b = bounds();
      var nx = curX, ny = curY;
      if (e.key === 'ArrowLeft') nx -= step;
      else if (e.key === 'ArrowRight') nx += step;
      else if (e.key === 'ArrowUp') ny -= step;
      else if (e.key === 'ArrowDown') ny += step;
      else return;
      e.preventDefault();
      curX = clamp(nx, b.minX, b.maxX);
      curY = clamp(ny, b.minY, b.maxY);
      settleTo(curX, curY);
    });
  }

  function init(root) {
    if (reduceMotion) return; // reduced motion: tokens render as plain static artifacts, no drag
    root.querySelectorAll('[data-caviera-drag-token]').forEach(initToken);
  }

  init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
