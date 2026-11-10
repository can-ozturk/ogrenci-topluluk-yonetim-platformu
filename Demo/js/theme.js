/* ==========================================================================
   Atatürk Topluluğu — Koyu / Açık Tema Yönetimi (js/theme.js)
   ========================================================================== */

(function (window, document) {
  "use strict";

  var STORAGE_KEY = "ataturk_toplulugu_theme";

  function getSavedTheme() {
    try {
      var val = window.localStorage.getItem(STORAGE_KEY);
      if (val === "dark" || val === "light") {
        return val;
      }
    } catch (e) {
      /* file:// veya gizli sekme kısıtlamalarında sessizce devam et */
    }
    return null;
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* localStorage erişimi kapalıysa sessizce devam et */
    }
  }

  function getSystemPreferredTheme() {
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
      ) {
        return "light";
      }
    } catch (e) {
      /* Varsayılan olarak koyu tema */
    }
    return "dark";
  }

  function applyTheme(theme) {
    var normalized = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", normalized);

    var toggleBtn = document.getElementById("themeToggleBtn");
    var toggleLabel = document.getElementById("themeToggleText");

    if (toggleBtn) {
      var isLight = normalized === "light";
      toggleBtn.setAttribute("aria-pressed", isLight ? "true" : "false");
      toggleBtn.setAttribute(
        "aria-label",
        isLight ? "Koyu temaya geç" : "Açık temaya geç"
      );
      toggleBtn.setAttribute(
        "title",
        isLight ? "Koyu temaya geç" : "Açık temaya geç"
      );
    }

    if (toggleLabel) {
      toggleLabel.textContent = normalized === "light" ? "Açık Tema" : "Koyu Tema";
    }
  }

  var WAVE_DURATION = 680;
  var WAVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
  var isTransitioning = false;

  function prefersReducedMotion() {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function getOriginCoords(evt, btn) {
    if (
      evt &&
      typeof evt.clientX === "number" &&
      typeof evt.clientY === "number" &&
      (evt.clientX !== 0 || evt.clientY !== 0)
    ) {
      return { x: evt.clientX, y: evt.clientY };
    }
    if (btn && typeof btn.getBoundingClientRect === "function") {
      var rect = btn.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
    return { x: window.innerWidth - 48, y: 42 };
  }

  function spawnWaveRing(x, y, maxRadius) {
    try {
      if (!document.body || typeof document.body.animate !== "function") return;
      var ring = document.createElement("div");
      ring.className = "theme-wave-ring";
      ring.setAttribute("aria-hidden", "true");
      ring.style.left = x + "px";
      ring.style.top = y + "px";
      document.body.appendChild(ring);

      var anim = ring.animate(
        [
          { transform: "translate(-50%, -50%) scale(0)", opacity: 0.95 },
          { transform: "translate(-50%, -50%) scale(" + Math.ceil(maxRadius) + ")", opacity: 0 }
        ],
        { duration: WAVE_DURATION, easing: WAVE_EASING, fill: "forwards" }
      );
      var remove = function () {
        if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
      };
      anim.onfinish = remove;
      anim.oncancel = remove;
      window.setTimeout(remove, WAVE_DURATION + 120);
    } catch (e) {
      /* Eski tarayıcılarda sessizce geç */
    }
  }

  function transitionTheme(next, evt, btn) {
    if (prefersReducedMotion()) {
      applyTheme(next);
      saveTheme(next);
      return;
    }

    var origin = getOriginCoords(evt, btn);
    var maxRadius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y)
    );

    spawnWaveRing(origin.x, origin.y, maxRadius);

    if (
      typeof document.startViewTransition === "function" &&
      !isTransitioning
    ) {
      isTransitioning = true;
      var root = document.documentElement;
      root.classList.add("is-theme-transitioning");

      var cleanup = function () {
        root.classList.remove("is-theme-transitioning");
        isTransitioning = false;
      };

      try {
        var vt = document.startViewTransition(function () {
          applyTheme(next);
        });

        if (vt && vt.ready && typeof vt.ready.then === "function") {
          vt.ready.then(function () {
            root.animate(
              {
                clipPath: [
                  "circle(0px at " + origin.x + "px " + origin.y + "px)",
                  "circle(" + Math.ceil(maxRadius) + "px at " + origin.x + "px " + origin.y + "px)"
                ]
              },
              {
                duration: WAVE_DURATION,
                easing: WAVE_EASING,
                pseudoElement: "::view-transition-new(root)"
              }
            );
          }).catch(function () {});
        }

        if (vt && vt.finished && typeof vt.finished.then === "function") {
          vt.finished.then(cleanup, cleanup);
        } else {
          window.setTimeout(cleanup, WAVE_DURATION + 60);
        }

        saveTheme(next);
        return;
      } catch (e) {
        cleanup();
      }
    }

    applyTheme(next);
    saveTheme(next);
  }

  function initTheme() {
    var current = getSavedTheme() || getSystemPreferredTheme();
    applyTheme(current);

    var toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e) {
        var active =
          document.documentElement.getAttribute("data-theme") || "dark";
        var next = active === "dark" ? "light" : "dark";
        transitionTheme(next, e, toggleBtn);
      });
    }

    try {
      if (window.matchMedia) {
        var mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        var onChange = function (e) {
          if (!getSavedTheme()) {
            applyTheme(e.matches ? "light" : "dark");
          }
        };
        if (typeof mediaQuery.addEventListener === "function") {
          mediaQuery.addEventListener("change", onChange);
        } else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(onChange);
        }
      }
    } catch (e) {
      /* Eski tarayıcı uyumu */
    }
  }

  /* Sayfa boyanmadan önce varsa mevcut temayı hemen uygula */
  var initialTheme = getSavedTheme() || getSystemPreferredTheme();
  document.documentElement.setAttribute("data-theme", initialTheme);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }
})(window, document);
