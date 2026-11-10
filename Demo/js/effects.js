/* ==========================================================================
   Atatürk Topluluğu — Arka Plan Paralaksı ve Platform Kenarlık Işığı
   (js/effects.js)
   - Fare hareketine karşılık arka plan görseli TERS yönde, maks. ±12px kayar.
   - Fare cam platform üzerindeyken kenarlıkta imleci takip eden ışık görünür
     (CSS: .glass-platform::before, --mx / --my).
   ========================================================================== */

(function (window, document) {
  "use strict";

  var MAX_OFFSET = 12;
  var EASE = 0.08;

  function init() {
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initPlatformHighlight();
    if (!reduced) initParallax();
  }

  function initPlatformHighlight() {
    var platform = document.getElementById("glassPlatform");
    if (!platform) return;

    platform.addEventListener(
      "pointermove",
      function (e) {
        var rect = platform.getBoundingClientRect();
        platform.style.setProperty("--mx", e.clientX - rect.left + "px");
        platform.style.setProperty("--my", e.clientY - rect.top + "px");
      },
      { passive: true }
    );
  }

  function initParallax() {
    var stage = document.querySelector(".bg-stage");
    if (!stage) return;

    var target = { x: 0, y: 0 };
    var current = { x: 0, y: 0 };
    var rafId = 0;

    function tick() {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;

      stage.style.setProperty("--parallax-x", current.x.toFixed(2) + "px");
      stage.style.setProperty("--parallax-y", current.y.toFixed(2) + "px");

      var settled =
        Math.abs(target.x - current.x) < 0.02 &&
        Math.abs(target.y - current.y) < 0.02;
      rafId = settled ? 0 : window.requestAnimationFrame(tick);
    }

    window.addEventListener(
      "pointermove",
      function (e) {
        if (e.pointerType === "touch") return;
        var nx = e.clientX / window.innerWidth - 0.5;
        var ny = e.clientY / window.innerHeight - 0.5;
        /* Ters yön */
        target.x = -nx * 2 * MAX_OFFSET;
        target.y = -ny * 2 * MAX_OFFSET;
        if (!rafId) rafId = window.requestAnimationFrame(tick);
      },
      { passive: true }
    );

    document.documentElement.addEventListener("mouseleave", function () {
      target.x = 0;
      target.y = 0;
      if (!rafId) rafId = window.requestAnimationFrame(tick);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
