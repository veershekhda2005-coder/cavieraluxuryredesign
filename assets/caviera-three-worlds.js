/**
 * CAVIERA — THREE WORLDS (Phase 1 — experimental, isolated scroll-progress foundation only)
 *
 * ISOLATION: this file is a self-contained IIFE that only ever queries inside
 * [data-caviera-three-worlds] — it never touches window.onscroll, never redefines a global, and
 * exits immediately if that root isn't present on the page (e.g. every existing live template).
 * It cannot interfere with, race with, or be affected by any other scroll controller in this
 * theme (assets/caviera-scroll-progress.js, assets/caviera-material-truth.js, assets/caviera-
 * makers-mark.js, etc.) — none of them are referenced here, and this file is not referenced by
 * layout/theme.liquid or any of them either.
 *
 * ARCHITECTURE: one shared rAF-throttled scroll/resize listener drives FOUR independent per-world
 * update functions (updateThreshold, updateConstant, updateEditions, updatePrivateCommissions),
 * looked up by each world's own data-world value and called via a plain forEach — never an
 * if/else-if chain, so adding, removing, or reordering a world's own logic can never accidentally
 * block another world's from running. Each function only ever reads/writes its OWN element's own
 * state and its own --c3w-progress custom property — no shared mutable state between worlds.
 *
 * Phase 1 itself did not yet DO anything with the progress value beyond exposing it as a CSS
 * custom property per world (--c3w-progress, 0 at entry to 1 at exit, the same "phase-local
 * progress" shape already used elsewhere in this theme) — no pin, no transform, no opacity change.
 * Phase 2b/2c added real motion to updateThreshold; Phase 3a (this revision) brings updateConstant
 * up to the same shape — its own tall stage + sticky inner, its own named sub-progress properties,
 * and six independent "permanent code" markers (see CONSTANT_CODES) — all still technical/motion
 * FRAMEWORK only, no final Constant art direction, no real media (see FINAL_CONSTANT_MEDIA_SLOT in
 * the liquid file). Editions and Private Commissions are untouched, still Phase 1 measurement-only.
 *
 * Runs its first measurement synchronously on load (not waiting for a scroll/wheel/touch event),
 * matching this theme's own established convention for its other scroll-progress engines, so a
 * page reload already scrolled partway through Three Worlds reports the correct progress on first
 * paint.
 */
(function () {
  var root = document.querySelector('[data-caviera-three-worlds]');
  var requestedThresholdMode = new URLSearchParams(window.location.search).get('c3w-threshold-mode');
  if (requestedThresholdMode === 'video') requestedThresholdMode = 'video-scrub';
  var thresholdMode = /^(video-scrub|webgl|true3d|static)$/.test(requestedThresholdMode || '')
    ? requestedThresholdMode
    : (root && root.getAttribute('data-c3w-threshold-mode')) || 'static';
  if (root) root.setAttribute('data-c3w-threshold-mode', thresholdMode);
  if (!root) return; // Not on this page — every existing live template is completely unaffected.

  var worlds = Array.prototype.slice.call(root.querySelectorAll('[data-world]'));
  if (!worlds.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileFallback = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
  var editorFallback = Boolean(window.Shopify && window.Shopify.designMode);
  var staticFallback = reduceMotion || mobileFallback || editorFallback;

  /**
   * HOMEPAGE-EMBED SAFETY: the orientation indicator (below) is position: fixed, so it's relative
   * to the viewport, not this section — on the isolated full-page test template that's harmless
   * (Three Worlds is the only content on that page), but once embedded mid-homepage it must not
   * follow the visitor through House Statement above or House Principles below. A single
   * IntersectionObserver on the whole root container — independent of the four worlds' own
   * updateX functions and their rAF loop below — sets data-in-view on the root; the CSS in
   * assets/caviera-three-worlds.css shows/hides (and disables pointer-events on) the indicator
   * purely from that attribute. Native, one-shot-per-transition, no scroll listener of its own.
   */
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        root.setAttribute('data-in-view', entry.isIntersecting ? 'true' : 'false');
      });
    });
    visibilityObserver.observe(root);
  } else {
    // No IntersectionObserver support: fail safe to "visible" rather than permanently hidden.
    root.setAttribute('data-in-view', 'true');
  }

  /**
   * Shared helper — NOT a second scroll-progress engine, just the one arithmetic shape every
   * per-world function below happens to want in Phase 1. A future phase is free to give any one
   * world (or all four) a completely different calculation without touching this helper or any
   * other world's function.
   */
  function entryExitProgress(el) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var rect = el.getBoundingClientRect();
    var total = rect.height - vh;
    var progress = total > 0 ? (0 - rect.top) / total : (rect.top <= 0 ? 1 : 0);
    return Math.max(0, Math.min(1, progress));
  }

  /**
   * Two plain arithmetic helpers (Phase 2b) — not a new progress engine, just the shape every
   * per-world reveal below happens to want: mapping one world's own 0–1 entryExitProgress into a
   * narrower 0–1 "local" window (rescale), then interpolating a value across it (lerp). Kept here,
   * shared, rather than duplicated inline in each updateX function.
   */
  function rescale(value, start, end) {
    if (end === start) return value >= end ? 1 : 0;
    return Math.max(0, Math.min(1, (value - start) / (end - start)));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  /**
   * Three-segment piecewise lerp (Phase 2c) — the exact shape the light layers' own progression
   * needs (e.g. "0.00–0.25 opacity .04→.10, 0.25–0.60 →.13, 0.60–1.00 →.03"): each successive
   * rescale() saturates to 1 once its own window has passed, so composing three lerp() calls in
   * sequence — each only able to move the value further toward its OWN target once its window is
   * reached — reproduces the full three-stop curve without a generic keyframe/easing library.
   */
  function piecewise3(p, v0, s1, v1, s2, v2, s3, v3) {
    var value = lerp(v0, v1, rescale(p, s1[0], s1[1]));
    value = lerp(value, v2, rescale(p, s2[0], s2[1]));
    value = lerp(value, v3, rescale(p, s3[0], s3[1]));
    return value;
  }

  /**
   * WORLD 00 — updateThreshold (Phase 2b: the first real Three Worlds motion).
   *
   * Reduced motion: per brief, returns immediately after the (harmless, always-safe) --c3w-progress
   * write, before touching any of the new reveal custom properties below — CSS's own var(..., X)
   * fallback for each one already IS the fully "composed" end state (opacity 1, translateY/scale
   * settled, nothing exited yet), so simply never overriding them shows exactly that state
   * immediately, with no extended reveal sequence. Same convention already used by this theme's
   * own assets/caviera-makers-mark.js.
   *
   * Five independent sub-windows of this world's own single progress value (0–1), per brief:
   *   0.00–0.18  environment settles to full visibility/scale
   *   0.12–0.32  official wordmark appears
   *   0.26–0.52  "THE HOUSE EXISTS / IN THREE FORMS." reveals (masked line clip, not fade-up)
   *   0.50–0.70  ENTER THE HOUSE cue appears
   *   0.70–1.00  Threshold begins receding — environment dims, all typography fades — as the
   *              visitor nears The Constant. This is the ENTIRE Threshold→Constant transition
   *              mechanism for this phase: no pinned/sticky stage, no shared cross-world state —
   *              see updateConstant's own symmetric entry fade below, and the transition snippet's
   *              own comment for why the visual crossfade needs nothing from either of them.
   * Ranges intentionally overlap (e.g. wordmark and heading) exactly as in the brief — each is its
   * own independent lerp, not a strict timeline.
   *
   * Phase 2c ADDENDUM (living-light polish for the retained static layer): two additional
   * opacity-only custom properties (--threshold-light-primary-opacity,
   * --threshold-light-secondary-opacity) and one filter value (--threshold-environment-brightness)
   * are computed here too, using the exact same progress value and the same "no CSS transition,
   * scroll position maps 1:1" rule as everything else in this function. None of the five ranges or
   * values above were changed by this addendum — see the diff, not just this comment, to confirm.
   */
  function updateThreshold(el) {
    var progress = entryExitProgress(el);
    el.style.setProperty('--c3w-progress', progress.toFixed(4));
    if (staticFallback) return; // Composed static state for reduced motion and mobile.

    var videoTimeline = thresholdMode === 'video-scrub';
    var envIn = rescale(progress, 0, videoTimeline ? 0.12 : 0.18);
    var envOut = rescale(progress, videoTimeline ? 0.68 : 0.70, videoTimeline ? 0.80 : 1.00);
    var envOpacity = lerp(lerp(0.65, 1, envIn), 0.35, envOut);
    var envScale = lerp(1.015, 1, envIn);
    // Optional texture breathing (Phase 2c) — tied to the SAME entry settle as opacity/scale above,
    // not a separate timeline: brightness(.97) → brightness(1.00), holds at 1.00 once settled,
    // never animated on its own via CSS keyframes. Brief's max range, not exceeded.
    var envBrightness = lerp(0.97, 1.00, envIn);

    // Living-light layers (Phase 2c) — see the CSS for what each one actually renders (a
    // restrained radial gradient positioned over the existing doorway / floor-reflection areas of
    // the approved still). Values are opacity ONLY; nothing about the image itself moves. Exact
    // three-stop progression per brief, via piecewise3 above — NOT CSS transitions.
    var lightPrimary = piecewise3(progress, 0.04, [0, 0.25], 0.10, [0.25, 0.60], 0.13, [0.60, 1.00], 0.03);
    var lightSecondary = piecewise3(progress, 0.02, [0, 0.25], 0.05, [0.25, 0.60], 0.08, [0.60, 1.00], 0.02);

    var wordProgress = rescale(progress, videoTimeline ? 0.08 : 0.12, videoTimeline ? 0.22 : 0.32);
    var headingProgress = rescale(progress, videoTimeline ? 0.16 : 0.26, videoTimeline ? 0.38 : 0.52);
    var ctaProgress = rescale(progress, videoTimeline ? 0.30 : 0.50, videoTimeline ? 0.52 : 0.70);
    // Shared by the whole typography group (wordmark/eyebrow/heading/cta) — a parent-level opacity
    // multiplies visually with each child's own entry opacity, so this alone is the entire "fade
    // out as Threshold recedes" effect; no per-element exit math needed.
    var typographyExitOpacity = 1 - envOut;

    el.style.setProperty('--threshold-environment-opacity', envOpacity.toFixed(4));
    el.style.setProperty('--threshold-environment-scale', envScale.toFixed(4));
    el.style.setProperty('--threshold-environment-brightness', envBrightness.toFixed(4));
    el.style.setProperty('--threshold-light-primary-opacity', lightPrimary.toFixed(4));
    el.style.setProperty('--threshold-light-secondary-opacity', lightSecondary.toFixed(4));
    el.style.setProperty('--threshold-wordmark-opacity', wordProgress.toFixed(4));
    el.style.setProperty('--threshold-wordmark-y', lerp(10, 0, wordProgress).toFixed(2) + 'px');
    el.style.setProperty('--threshold-heading-y', lerp(110, 0, headingProgress).toFixed(2) + '%');
    el.style.setProperty('--threshold-cta-opacity', ctaProgress.toFixed(4));
    el.style.setProperty('--threshold-cta-y', lerp(8, 0, ctaProgress).toFixed(2) + 'px');
    el.style.setProperty('--threshold-typography-opacity', typographyExitOpacity.toFixed(4));
    if (videoTimeline) {
      root.dispatchEvent(new CustomEvent('c3w:threshold-progress', { detail: { progress: progress } }));
    }
  }

  /**
   * The Constant's six permanent-code windows (Phase 3a) — [start, end, midpoint], per brief's own
   * suggested framework. Declared once, outside updateConstant, so both the "which code is active"
   * logic and any future debugging/tuning pass can see the whole sequence in one place. The windows
   * are contiguous, so each code has one unambiguous active narrative range.
   */
  var CONSTANT_CODES = [
    { code: 'seal', start: 0.10, end: 0.19 },
    { code: 'oryx', start: 0.19, end: 0.28 },
    { code: 'provenance', start: 0.28, end: 0.46 },
    { code: 'material', start: 0.46, end: 0.64 },
    { code: 'ritual', start: 0.64, end: 0.82 },
    { code: 'permanence', start: 0.82, end: 0.94 }
  ];
  CONSTANT_CODES.forEach(function (c) { c.mid = (c.start + c.end) / 2; });

  /**
   * Shared photography envelope. Each detail receives local progress from 0 to 1, then follows the
   * same restrained three-part curve: enter 0.00-0.20, remain completely still at full opacity
   * from 0.20-0.78, and exit 0.78-1.00. There is deliberately no time-based state or direction
   * dependency, so reverse scrolling retraces the exact same values.
   */
  function detailEnvelope(progress, start, end) {
    var local = rescale(progress, start, end);
    var enter = rescale(local, 0.00, 0.20);
    var exit = rescale(local, 0.78, 1.00);

    return {
      local: local,
      opacity: local < 0.20 ? enter : (local <= 0.78 ? 1 : lerp(1, 0, exit)),
      y: local < 0.20 ? lerp(8, 0, enter) : (local <= 0.78 ? 0 : lerp(0, -5, exit)),
      scale: local < 0.20 ? lerp(1.01, 1, enter) : (local <= 0.78 ? 1 : lerp(1, 1.006, exit)),
      clip: local < 0.20 ? lerp(100, 0, enter) : (local <= 0.78 ? 0 : lerp(0, 100, exit))
    };
  }

  function applyDetailEnvelope(el, prefix, envelope) {
    el.style.setProperty(prefix + '-opacity', envelope.opacity.toFixed(4));
    el.style.setProperty(prefix + '-y', envelope.y.toFixed(2) + 'px');
    el.style.setProperty(prefix + '-scale', envelope.scale.toFixed(4));
    el.style.setProperty(prefix + '-clip', envelope.clip.toFixed(2) + '%');
  }

  /**
   * Decode a detail shortly before its reveal, once its own world has started. The data flag makes
   * this a one-shot preparation step; it does not preload every Three Worlds image at homepage
   * startup and it adds no animation loop.
   */
  function prepareUpcomingImage(el, selector, progress, prepareAt) {
    if (progress <= 0 || progress < prepareAt) return;
    var image = el.querySelector(selector);
    if (!image || image.dataset.c3wPrepared === 'true') return;
    image.dataset.c3wPrepared = 'true';
    image.loading = 'eager';
    if (typeof image.decode === 'function') image.decode().catch(function () {});
  }

  /**
   * WORLD 01 — updateConstant. The world introduction occupies 0.00-0.10, followed by House Seal,
   * Oryx, Provenance, Material, Ritual and Permanence in CONSTANT_CODES. The three photographs use
   * detailEnvelope(), while the final 0.94-1.00 remains reserved for transition preparation.
   */
  function updateConstant(el) {
    var progress = entryExitProgress(el);
    el.style.setProperty('--c3w-progress', progress.toFixed(4));
    el.style.setProperty('--c3w-constant-progress', progress.toFixed(4));
    if (staticFallback) return; // Composed static state for reduced motion and mobile.

    var mediaIn = rescale(progress, 0, 0.08);
    var sealFocus = detailEnvelope(progress, 0.10, 0.19);
    var oryxFocus = detailEnvelope(progress, 0.19, 0.28);
    // The photography discoveries sit inside their narrative-code windows, leaving the master
    // fully unobstructed for a short architectural breathing beat before the next code approaches.
    var provenanceDetail = detailEnvelope(progress, 0.295, 0.435);
    var materialDetail = detailEnvelope(progress, 0.475, 0.615);
    var ritualDetail = detailEnvelope(progress, 0.655, 0.795);
    var mediaOpacity = lerp(0.94, 1, mediaIn);
    mediaOpacity = mediaOpacity
      * (1 - provenanceDetail.opacity * 0.14)
      * (1 - materialDetail.opacity * 0.14)
      * (1 - ritualDetail.opacity * 0.14);

    var permanenceIn = rescale(progress, 0.82, 0.86);
    var handoffSettle = rescale(progress, 0.94, 1.00);
    var mediaScale = lerp(1, 1.006, mediaIn)
      + sealFocus.opacity * 0.004
      + oryxFocus.opacity * 0.006
      + provenanceDetail.opacity * 0.011
      + materialDetail.opacity * 0.009
      + ritualDetail.opacity * 0.011
      + permanenceIn * 0.006
      - handoffSettle * 0.004;
    var mediaX = sealFocus.opacity * 0.08
      - oryxFocus.opacity * 0.42
      - provenanceDetail.opacity * 0.65
      + materialDetail.opacity * 0.52
      - ritualDetail.opacity * 0.48;
    var mediaY = sealFocus.opacity * 0.18
      + provenanceDetail.opacity * 0.30
      - materialDetail.opacity * 0.24
      + ritualDetail.opacity * 0.28;
    el.style.setProperty('--c3w-constant-media-opacity', mediaOpacity.toFixed(4));
    el.style.setProperty('--c3w-constant-media-scale', mediaScale.toFixed(4));
    el.style.setProperty('--c3w-constant-media-x', mediaX.toFixed(3) + 'vw');
    el.style.setProperty('--c3w-constant-media-y', mediaY.toFixed(3) + 'vh');
    el.style.setProperty('--c3w-constant-light', lerp(0.04, 0.08, mediaIn).toFixed(4));
    el.style.setProperty('--c3w-constant-seal-opacity', (sealFocus.opacity * 0.82).toFixed(4));
    el.style.setProperty('--c3w-constant-oryx-opacity', (oryxFocus.opacity * 0.60).toFixed(4));

    // The restrained emphasis beneath each photograph follows the same envelope, so it is also
    // static throughout the photograph's hold rather than peaking and drifting at its midpoint.
    el.style.setProperty('--c3w-constant-material-opacity', (materialDetail.opacity * 0.025).toFixed(4));
    el.style.setProperty('--c3w-constant-ritual-opacity', '0');

    applyDetailEnvelope(el, '--c3w-constant-provenance', provenanceDetail);
    applyDetailEnvelope(el, '--c3w-constant-material-detail', materialDetail);
    applyDetailEnvelope(el, '--c3w-constant-ritual-detail', ritualDetail);

    prepareUpcomingImage(el, '.c3w-constant__provenance-el', progress, 0.20);
    prepareUpcomingImage(el, '[data-detail="material"] .c3w-constant__detail-el', progress, 0.38);
    prepareUpcomingImage(el, '[data-detail="ritual"] .c3w-constant__detail-el', progress, 0.56);

    var indexProgress = rescale(progress, 0.01, 0.04);
    var titleProgress = rescale(progress, 0.02, 0.06);
    var statementProgress = rescale(progress, 0.04, 0.08);
    var supportingProgress = rescale(progress, 0.055, 0.10);
    var codesGroupProgress = rescale(progress, 0.08, 0.11);
    var settleOut = rescale(progress, 0.94, 1.00);

    el.style.setProperty('--c3w-constant-index-opacity', indexProgress.toFixed(4));
    el.style.setProperty('--c3w-constant-title-y', lerp(110, 0, titleProgress).toFixed(2) + '%');
    // Composed ceiling 0.85, not 1 — matches this file's own existing restrained tagline/concept
    // convention (.c3w-world__tagline / .c3w-world__concept, used by Editions/Commissions), not a
    // full-opacity reveal.
    el.style.setProperty('--c3w-constant-statement-opacity', lerp(0, 0.85, statementProgress).toFixed(4));
    el.style.setProperty('--c3w-constant-statement-y', lerp(10, 0, statementProgress).toFixed(2) + 'px');
    el.style.setProperty('--c3w-constant-supporting-opacity', lerp(0, 0.85, supportingProgress).toFixed(4));
    el.style.setProperty('--c3w-constant-codes-opacity', codesGroupProgress.toFixed(4));
    // Partial settle only (1 → 0.7), per this function's own comment above.
    el.style.setProperty('--c3w-constant-content-opacity', lerp(1, 0.7, settleOut).toFixed(4));

    var introRecede = rescale(progress, 0.10, 0.18);
    el.style.setProperty('--c3w-constant-intro-opacity', lerp(1, 0.55, introRecede).toFixed(4));
    el.style.setProperty('--c3w-constant-intro-scale', lerp(1, 0.92, introRecede).toFixed(4));

    var activeCode = null;
    CONSTANT_CODES.forEach(function (c) {
      if (progress >= c.start && progress < c.end) activeCode = c.code;
    });
    el.querySelectorAll('[data-constant-code]').forEach(function (codeEl) {
      var code = codeEl.dataset.constantCode;
      var meta = CONSTANT_CODES.filter(function (c) { return c.code === code; })[0];
      var state = code === activeCode ? 'active' : (progress >= meta.end ? 'past' : 'future');
      codeEl.setAttribute('data-code-state', state);
    });
  }

  /**
   * WORLD 02 — updateEditions (Phase 4: final visual implementation — same stage/sticky shape and
   * "no CSS transition, scroll maps 1:1" convention as Threshold/Constant).
   *
   * Reduced motion: same early-return convention as updateThreshold/updateConstant — every reveal
   * property's CSS var(..., composed-value) fallback already represents the fully legible, settled
   * state, so simply never setting them is the entire "readable static sequence" brief asked for.
   *
   * Progress map:
   *   0.00-0.13  THE EDITIONS / WHAT CHANGES.
   *   0.13-0.27  EDITION I / THE FIRST LIGHT
   *   0.27-0.52  Light Study via detailEnvelope()
   *   0.52-0.80  Reveal Stage via detailEnvelope()
   *   0.80-0.94  final composed First Light environment
   *   0.94-1.00  transition toward Private Commissions
   * The Constant→Editions transition itself is intentionally NOT a new mechanism here: Constant's
   * own Permanence state (unchanged) and this world's own entry establish are simply adjacent in
   * scroll position — the same "two independent effects read as one crossfade" principle already
   * used for Threshold→Constant, per brief's own instruction not to alter Constant for this.
   */
  function updateEditions(el) {
    var progress = entryExitProgress(el);
    el.style.setProperty('--c3w-progress', progress.toFixed(4));
    if (staticFallback) return; // Composed static state for reduced motion and mobile.

    var mediaIn = rescale(progress, 0, 0.10);
    var mediaOpacity = lerp(0.9, 1, mediaIn);

    var lightStudyDetail = detailEnvelope(progress, 0.27, 0.52);
    var revealStageDetail = detailEnvelope(progress, 0.52, 0.80);
    mediaOpacity = mediaOpacity
      * (1 - lightStudyDetail.opacity * 0.12)
      * (1 - revealStageDetail.opacity * 0.18);

    // Exit (0.94-1.00) — a modest media dim (1→0.8, most of the darkening is the scrim below, not
    // this) plus an Obsidian scrim rising to ~0.55. Tried dropping media opacity alone first and
    // rejected it: this world's own background is Cinnabar, so fading the image without a scrim
    // exposed MORE red underneath, the opposite of brief's "Cinnabar becomes quieter" — confirmed
    // via screenshot, not assumed.
    var exitProgress = rescale(progress, 0.94, 1.00);
    mediaOpacity = mediaOpacity * lerp(1, 0.8, exitProgress);
    el.style.setProperty('--c3w-editions-media-opacity', mediaOpacity.toFixed(4));
    el.style.setProperty('--c3w-editions-media-scale', lerp(1.01, 1, mediaIn).toFixed(4));
    el.style.setProperty('--c3w-editions-exit-opacity', lerp(0, 0.55, exitProgress).toFixed(4));

    // First Light emphasis — subtly rises then recedes, per brief's own three-stop shape (same
    // piecewise3 helper as the Threshold's own living-light, within the brief's 0.06–0.12 band).
    var lightOpacity = piecewise3(progress, 0.04, [0, 0.30], 0.10, [0.30, 0.55], 0.10, [0.55, 1.00], 0.04);
    el.style.setProperty('--c3w-editions-light-opacity', lightOpacity.toFixed(4));

    var indexProgress = rescale(progress, 0.01, 0.05);
    var titleProgress = rescale(progress, 0.025, 0.085);
    var statementProgress = rescale(progress, 0.07, 0.13);
    var editionProgress = rescale(progress, 0.13, 0.21);
    var editionNameProgress = rescale(progress, 0.17, 0.27);

    el.style.setProperty('--c3w-editions-index-opacity', indexProgress.toFixed(4));
    el.style.setProperty('--c3w-editions-title-y', lerp(110, 0, titleProgress).toFixed(2) + '%');
    el.style.setProperty('--c3w-editions-statement-opacity', lerp(0, 0.85, statementProgress).toFixed(4));
    el.style.setProperty('--c3w-editions-statement-y', lerp(10, 0, statementProgress).toFixed(2) + 'px');
    el.style.setProperty('--c3w-editions-edition-opacity', editionProgress.toFixed(4));
    el.style.setProperty('--c3w-editions-edition-y', lerp(10, 0, editionProgress).toFixed(2) + 'px');
    el.style.setProperty('--c3w-editions-edition-name-opacity', editionNameProgress.toFixed(4));

    // Whole-content exit recede (0.94-1.00) — deeper than Constant's own 1→0.7 partial settle, per
    // brief's explicit "typography recedes" language for this specific world, but still never 0.
    el.style.setProperty('--c3w-editions-content-opacity', lerp(1, 0.3, exitProgress).toFixed(4));

    applyDetailEnvelope(el, '--c3w-editions-light-study', lightStudyDetail);
    applyDetailEnvelope(el, '--c3w-editions-reveal-stage', revealStageDetail);

    prepareUpcomingImage(el, '[data-editions-detail="light-study"] .c3w-editions__detail-el', progress, 0.19);
    prepareUpcomingImage(el, '[data-editions-detail="reveal-stage"] .c3w-editions__detail-el', progress, 0.44);
  }

  /**
   * WORLD 03 — updatePrivateCommissions (Phase 5: final visual implementation — same stage/sticky
   * shape and "no CSS transition, scroll maps 1:1" convention as every other world).
   *
   * Reduced motion: same early-return convention as the other three updateX functions — every
   * reveal property's CSS var(..., composed-value) fallback already represents the fully legible,
   * settled state, so simply never setting them is the entire "readable static sequence" brief
   * asked for.
   *
   * Progress map:
   *   0.00-0.09  Private world introduction
   *   0.09-0.25  Stone Selection via detailEnvelope()
   *   0.25-0.41  Design via detailEnvelope()
   *   0.41-0.57  Making via detailEnvelope()
   *   0.57-0.73  Authentication via detailEnvelope()
   *   0.73-0.90  Presentation via detailEnvelope()
   *   0.90-0.97  master chamber and final CTA
   *   0.97-1.00  release to the normal homepage
   * No exit-darkening scrim at the end (unlike Editions) — this is the LAST Three Worlds world, so
   * per brief ("return to a clean composed view") it should end fully clear, not dimmed, ready to
   * release into the normal homepage.
   */
  function updatePrivateCommissions(el) {
    var progress = entryExitProgress(el);
    el.style.setProperty('--c3w-progress', progress.toFixed(4));
    if (staticFallback) return; // Composed static state for reduced motion and mobile.

    var mediaIn = rescale(progress, 0, 0.09);
    var mediaOpacity = lerp(0.9, 1, mediaIn);

    var stoneDetail = detailEnvelope(progress, 0.09, 0.25);
    var designDetail = detailEnvelope(progress, 0.25, 0.41);
    var makingDetail = detailEnvelope(progress, 0.41, 0.57);
    var authenticationDetail = detailEnvelope(progress, 0.57, 0.73);
    var presentationDetail = detailEnvelope(progress, 0.73, 0.90);
    mediaOpacity = mediaOpacity
      * (1 - stoneDetail.opacity * 0.08)
      * (1 - designDetail.opacity * 0.08)
      * (1 - makingDetail.opacity * 0.10)
      * (1 - authenticationDetail.opacity * 0.10)
      * (1 - presentationDetail.opacity * 0.12);
    el.style.setProperty('--c3w-private-media-opacity', mediaOpacity.toFixed(4));
    el.style.setProperty('--c3w-private-media-scale', lerp(1.01, 1, mediaIn).toFixed(4));

    // Entry scrim — the Editions→Private transition. It starts at a restrained 0.24 and clears by
    // 0.05, before the opening identity is fully established; it never returns during the active
    // world, so the master chamber is not held beneath a persistent transition veil.
    var entryScrimProgress = rescale(progress, 0, 0.05);
    el.style.setProperty('--c3w-private-entry-scrim-opacity', lerp(0.24, 0, entryScrimProgress).toFixed(4));

    // Private light — brief's own max band (0.05–0.10).
    el.style.setProperty('--c3w-private-light-opacity', lerp(0.05, 0.10, mediaIn).toFixed(4));

    var indexProgress = rescale(progress, 0.005, 0.025);
    var titleProgress = rescale(progress, 0.015, 0.05);
    var statementProgress = rescale(progress, 0.04, 0.07);
    var supportingProgress = rescale(progress, 0.055, 0.09);
    var openingRecede = rescale(progress, 0.09, 0.122);

    el.style.setProperty('--c3w-private-index-opacity', indexProgress.toFixed(4));
    el.style.setProperty('--c3w-private-title-y', lerp(110, 0, titleProgress).toFixed(2) + '%');
    el.style.setProperty('--c3w-private-title-opacity', lerp(0.98, 0.20, openingRecede).toFixed(4));
    el.style.setProperty('--c3w-private-statement-opacity', (lerp(0, 0.70, statementProgress) * lerp(1, 0.20, openingRecede)).toFixed(4));
    el.style.setProperty('--c3w-private-statement-y', lerp(10, 0, statementProgress).toFixed(2) + 'px');
    el.style.setProperty('--c3w-private-supporting-opacity', (lerp(0, 0.56, supportingProgress) * lerp(1, 0.1607, openingRecede)).toFixed(4));

    // Final quiet statement + CTA — reveals only in the last 8% of this world's own progress, per
    // CTA settles quickly at 0.90-0.925, then holds cleanly through the 0.97 release window.
    var finalProgress = rescale(progress, 0.90, 0.925);
    el.style.setProperty('--c3w-private-final-opacity', finalProgress.toFixed(4));
    el.style.setProperty('--c3w-private-final-y', lerp(12, 0, finalProgress).toFixed(2) + 'px');

    // Whole-content settle — a modest partial dip only (never the deep Editions-style recede,
    // since nothing darkens further here), matching Constant's own restrained 1→0.85 shape rather
    // than Editions' 1→0.3, so the title/statement remain clearly legible behind the final CTA.
    var settleOut = rescale(progress, 0.90, 0.97);
    el.style.setProperty('--c3w-private-content-opacity', lerp(1, 0.85, settleOut).toFixed(4));

    applyDetailEnvelope(el, '--c3w-private-stone', stoneDetail);
    applyDetailEnvelope(el, '--c3w-private-design', designDetail);
    applyDetailEnvelope(el, '--c3w-private-making', makingDetail);
    applyDetailEnvelope(el, '--c3w-private-authentication', authenticationDetail);
    applyDetailEnvelope(el, '--c3w-private-presentation', presentationDetail);

    prepareUpcomingImage(el, '[data-private-detail="stone"] .c3w-private__detail-el', progress, 0.03);
    prepareUpcomingImage(el, '[data-private-detail="design"] .c3w-private__detail-el', progress, 0.17);
    prepareUpcomingImage(el, '[data-private-detail="making"] .c3w-private__detail-el', progress, 0.33);
    prepareUpcomingImage(el, '[data-private-detail="authentication"] .c3w-private__detail-el', progress, 0.49);
    prepareUpcomingImage(el, '[data-private-detail="presentation"] .c3w-private__detail-el', progress, 0.65);
  }

  var updaters = {
    threshold: updateThreshold,
    constant: updateConstant,
    editions: updateEditions,
    commissions: updatePrivateCommissions
  };

  /**
   * World orientation indicator (Step 4) — reads which world is currently closest to the viewport
   * centre and marks that world's own button .is-active / root[data-active-world]. Independent of
   * the four updateX functions above (it doesn't feed their progress values, and they don't feed
   * it) — purely an additional, optional reading of the same world elements' own geometry.
   */
  var orientationNav = root.querySelector('[data-world-orientation]');
  var orientationButtons = orientationNav
    ? Array.prototype.slice.call(orientationNav.querySelectorAll('[data-orientation-target]'))
    : [];

  function updateOrientation() {
    if (!orientationButtons.length) return;
    var viewportCenter = (window.innerHeight || document.documentElement.clientHeight) / 2;
    var closest = null;
    var closestDistance = Infinity;
    worlds.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      var elCenter = rect.top + rect.height / 2;
      var distance = Math.abs(elCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = el.dataset.world;
      }
    });
    if (!closest) return;
    root.setAttribute('data-active-world', closest);
    orientationButtons.forEach(function (btn) {
      var isActive = btn.dataset.orientationTarget === closest;
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'true');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
  }

  if (orientationButtons.length) {
    orientationButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = root.querySelector('[data-world="' + btn.dataset.orientationTarget + '"]');
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  var ticking = false;
  function measureAll() {
    // Plain forEach over every world, each looked up independently by its own data-world value —
    // never an else-if chain that could let one world's update accidentally skip another's.
    worlds.forEach(function (el) {
      var fn = updaters[el.dataset.world];
      if (typeof fn === 'function') fn(el);
    });
    updateOrientation();
    ticking = false;
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measureAll);
  }

  if (!staticFallback) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }
  // Always measure once immediately on init, reduced-motion or not, and regardless of whether any
  // scroll/wheel/touch event has fired yet — per brief, a reload landing mid-experience must never
  // have to wait for the visitor's next scroll to report correct progress.
  measureAll();

  /**
   * THE THRESHOLD's entry cue — foundation only, no cinematic transition yet. Scrolls to World 01
   * using the browser's own native smooth-scroll; a later phase can replace this with a real
   * world-to-world transition without changing anything else in this file.
   */
  var enterCue = root.querySelector('[data-world-enter]');
  var constantWorld = root.querySelector('[data-world="constant"]');
  if (enterCue && constantWorld) {
    enterCue.addEventListener('click', function () {
      if (root.classList.contains('c3w--video-ready')) {
        var videoThreshold = root.querySelector('[data-world="threshold"]');
        var videoTravel = Math.max(0, videoThreshold.offsetHeight - window.innerHeight);
        var videoDestination = window.scrollY + videoThreshold.getBoundingClientRect().top + videoTravel * 0.52;
        window.scrollTo({ top: videoDestination, behavior: 'smooth' });
      } else if (root.classList.contains('c3w--true3d-ready')) {
        var thresholdWorld = root.querySelector('[data-world="threshold"]');
        var travel = Math.max(0, thresholdWorld.offsetHeight - window.innerHeight);
        var destination = window.scrollY + thresholdWorld.getBoundingClientRect().top + travel * 0.42;
        window.scrollTo({ top: destination, behavior: 'smooth' });
      } else {
        constantWorld.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }
})();
