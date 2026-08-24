/**
 * CAVIERA — THREE WORLDS — THRESHOLD SCROLL-SCRUB VIDEO PROTOTYPE
 *
 * The paused video is a frame source, never a player. Native page scroll maps Threshold's local
 * 0–1 travel to 0–duration; one rAF loop applies restrained frame-rate-independent damping before
 * assigning currentTime. The approved still is the poster, loading view, and failure fallback.
 */
(function () {
  var root = document.querySelector('[data-caviera-three-worlds]');
  if (!root) return;

  var requestedMode = new URLSearchParams(window.location.search).get('c3w-threshold-mode');
  var mode = requestedMode || root.getAttribute('data-c3w-threshold-mode');
  if (mode === 'video') mode = 'video-scrub';
  if (mode !== 'video-scrub') return;

  var isMobile = window.matchMedia('(max-width: 899px)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var designMode = Boolean(window.Shopify && window.Shopify.designMode);
  if (isMobile || reduceMotion || designMode) {
    root.classList.add('c3w--video-disabled');
    return;
  }

  var threshold = root.querySelector('[data-world="threshold"]');
  var video = root.querySelector('[data-threshold-video]');
  if (!threshold || !video) return;

  var source = video.getAttribute('data-src') || root.getAttribute('data-threshold-video-src');
  if (!source) return;

  var duration = 0;
  var targetTime = 0;
  var renderedTime = 0;
  var lastTick = 0;
  var rafId = 0;
  var settleTimer = 0;
  var loaded = false;
  var loadAttempts = 0;
  var ready = false;
  var failed = false;
  var primeStarted = false;
  var seekStartedAt = 0;
  var seekSamples = [];
  var primeTimer = 0;
  var readinessTimer = 0;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.pause();

  function localProgress() {
    var rect = threshold.getBoundingClientRect();
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    var travel = Math.max(1, rect.height - viewport);
    return Math.max(0, Math.min(1, -rect.top / travel));
  }

  function fail(reason) {
    if (failed) return;
    failed = true;
    ready = false;
    window.clearTimeout(primeTimer);
    window.clearTimeout(readinessTimer);
    window.clearTimeout(settleTimer);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    root.classList.remove('c3w--video-loading', 'c3w--video-ready');
    root.classList.add('c3w--video-disabled');
    video.removeAttribute('src');
    video.load();
    console.warn('[c3w-video] Threshold video unavailable; approved static fallback remains:', reason);
  }

  function waitForPresentedFrame(done) {
    var completed = false;
    function complete() {
      if (completed) return;
      completed = true;
      done();
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      var fallbackTimer = window.setTimeout(complete, 240);
      video.requestVideoFrameCallback(function () {
        window.clearTimeout(fallbackTimer);
        complete();
      });
    } else {
      requestAnimationFrame(function () { requestAnimationFrame(complete); });
    }
  }

  function reveal() {
    if (failed || ready || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    waitForPresentedFrame(function () {
      if (failed || ready || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return;
      ready = true;
      window.clearTimeout(primeTimer);
      window.clearTimeout(readinessTimer);
      root.classList.remove('c3w--video-loading');
      root.classList.add('c3w--video-ready');
      root.setAttribute('data-c3w-video-duration', duration.toFixed(3));
      updateTarget(true);
    });
  }

  function primeSeek() {
    if (primeStarted || failed) return;
    primeStarted = true;
    window.clearTimeout(readinessTimer);
    duration = Number(video.duration);
    targetTime = localProgress() * duration;
    renderedTime = targetTime;
    primeTimer = window.setTimeout(function () {
      fail(new Error('seek/decode readiness timeout'));
    }, 4000);

    // A short non-zero probe proves the asset is genuinely seekable before it can cover the still.
    var seekableEnd = video.seekable.end(video.seekable.length - 1);
    var probeTime = Math.min(Math.max(duration * 0.015, 0.04), Math.max(0.001, seekableEnd - 0.001));
    seekStartedAt = performance.now();
    video.addEventListener('seeked', function onProbeSeeked() {
      video.removeEventListener('seeked', onProbeSeeked);
      seekSamples.push(performance.now() - seekStartedAt);
      seekStartedAt = performance.now();
      var finalTime = Math.min(Math.max(targetTime, 0), Math.max(0, duration - 0.001));
      if (Math.abs(video.currentTime - finalTime) < 0.001) {
        seekSamples.push(0);
        root.setAttribute('data-c3w-video-prime-seek-ms', Math.round(Math.max.apply(Math, seekSamples)).toString());
        reveal();
        return;
      }
      video.addEventListener('seeked', function onTargetSeeked() {
        video.removeEventListener('seeked', onTargetSeeked);
        seekSamples.push(performance.now() - seekStartedAt);
        root.setAttribute('data-c3w-video-prime-seek-ms', Math.round(Math.max.apply(Math, seekSamples)).toString());
        reveal();
      });
      video.currentTime = finalTime;
    });
    try {
      video.currentTime = probeTime;
    } catch (error) {
      fail(error);
    }
  }

  function checkReadiness() {
    if (failed || primeStarted) return;
    duration = Number(video.duration);
    var validMetadata = Number.isFinite(duration) && duration > 0 &&
      video.videoWidth > 0 && video.videoHeight > 0;
    var hasSeekableRange = video.seekable && video.seekable.length > 0 &&
      video.seekable.end(video.seekable.length - 1) > video.seekable.start(0);
    if (validMetadata && hasSeekableRange) primeSeek();
  }

  function load() {
    if (loaded || failed) return;
    loaded = true;
    root.classList.add('c3w--video-loading');
    video.preload = 'auto';
    video.src = source;
    loadAttempts = 1;
    video.load();
    armReadinessTimeout();
  }

  function armReadinessTimeout() {
    window.clearTimeout(readinessTimer);
    readinessTimer = window.setTimeout(function () {
      if (!primeStarted && loadAttempts < 2) {
        loadAttempts += 1;
        video.load();
        armReadinessTimeout();
        return;
      }
      fail(new Error('metadata/dimensions/seekable-range readiness timeout'));
    }, loadAttempts === 1 ? 7000 : 8000);
  }

  function schedule() {
    if (!rafId && ready) rafId = requestAnimationFrame(tick);
  }

  function updateTarget(force, suppliedProgress) {
    if (!duration) return;
    var progress = typeof suppliedProgress === 'number' ? suppliedProgress : localProgress();
    targetTime = Math.max(0, Math.min(1, progress)) * duration;
    targetTime = Math.min(targetTime, Math.max(0, duration - 0.001));
    if (force) renderedTime = targetTime;
    schedule();
  }

  function tick(now) {
    rafId = 0;
    if (!ready || failed) return;
    var dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 1 / 60;
    lastTick = now;

    // 42/s reaches 95% of a new target in ~71ms. Exponential damping is refresh-rate independent;
    // snapping inside one source-frame prevents post-scroll fractional drift.
    var alpha = 1 - Math.exp(-42 * dt);
    renderedTime += (targetTime - renderedTime) * alpha;
    var frame = 1 / 30;
    if (Math.abs(targetTime - renderedTime) <= frame) renderedTime = targetTime;

    if (!video.seeking && Math.abs(video.currentTime - renderedTime) >= frame * 0.45) {
      seekStartedAt = performance.now();
      video.currentTime = renderedTime;
    }

    if (Math.abs(targetTime - renderedTime) > 0.0005 || video.seeking) schedule();
  }

  video.addEventListener('loadedmetadata', checkReadiness);
  video.addEventListener('loadeddata', checkReadiness);
  video.addEventListener('canplay', checkReadiness);
  video.addEventListener('progress', checkReadiness);
  video.addEventListener('error', function () { fail(video.error || new Error('media error')); });
  video.addEventListener('play', function () { video.pause(); });
  video.addEventListener('seeked', function () {
    if (ready && seekStartedAt) {
      var latency = performance.now() - seekStartedAt;
      root.setAttribute('data-c3w-video-last-seek-ms', Math.round(latency).toString());
    }
    schedule();
  });

  root.addEventListener('c3w:threshold-progress', function (event) {
    var progress = event.detail && Number(event.detail.progress);
    if (!Number.isFinite(progress)) return;
    updateTarget(false, progress);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(function () {
      // Once native scroll events go quiet, resolve the final fraction immediately. The video is
      // still paused; this only requests the exact target frame and cannot create playback drift.
      renderedTime = targetTime;
      if (!video.seeking && Math.abs(video.currentTime - renderedTime) > 0.001) {
        seekStartedAt = performance.now();
        video.currentTime = renderedTime;
      }
    }, 50);
  });

  // Keep the source detached while Threshold is far from view. The HTML still declares the
  // requested preload policy, but mobile/editor/reduced-motion sessions never receive a source.
  if ('IntersectionObserver' in window) {
    var loadObserver = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      loadObserver.disconnect();
      load();
    }, { rootMargin: '150% 0px' });
    loadObserver.observe(threshold);
  } else {
    load();
  }
})();
