/**
 * CAVIERA draggable tokens — a luxury translation of "movable stickers": House Seal medallions,
 * Edition/number plaques. Bounded pointer drag with a tactile partial-return settle on release
 * (never a full snap-back, never spring/bounce physics). Keyboard-focusable with arrow-key
 * nudging so the interaction isn't pointer-only. Touch pointers and prefers-reduced-motion both
 * leave the token fully visible but non-draggable — a static House artifact rather than a broken
 * or half-working control.
 */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function initToken(token) {
    if (token.dataset.dragBound) return;
    token.dataset.dragBound = 'true';

    var zone = token.closest('[data-caviera-drag-zone]') || token.parentElement;
    var curX = 0, curY = 0;
    var startX = 0, startY = 0;
    var dragging = false;
    var lastBounds = null;

    function bounds() {
      var zr = zone.getBoundingClientRect();
      var tr = token.getBoundingClientRect();
      var padX = tr.width * 0.6;
      var padY = tr.height * 0.6;
      return {
        minX: -(tr.left - zr.left) - padX,
        maxX: (zr.right - tr.right) + padX,
        minY: -(tr.top - zr.top) - padY,
        maxY: (zr.bottom - tr.bottom) + padY
      };
    }

    function setTransform(x, y) {
      token.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }

    function settleTo(x, y) {
      token.classList.add('is-settling');
      setTransform(x, y);
      setTimeout(function () { token.classList.remove('is-settling'); }, 500);
    }

    function onPointerDown(e) {
      if (e.pointerType === 'touch') return; // graceful degrade: stays visible, just not draggable
      if (typeof e.button === 'number' && e.button !== 0) return;
      dragging = true;
      lastBounds = bounds();
      startX = e.clientX - curX;
      startY = e.clientY - curY;
      token.classList.add('is-dragging');
      if (token.setPointerCapture) { try { token.setPointerCapture(e.pointerId); } catch (err) {} }
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
      // Tactile partial return — the token keeps roughly a third of the offset it was moved,
      // never a full snap back to origin and never an elastic overshoot past it.
      curX *= 0.32;
      curY *= 0.32;
      settleTo(curX, curY);
    }

    token.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    token.addEventListener('keydown', function (e) {
      var step = 14;
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
