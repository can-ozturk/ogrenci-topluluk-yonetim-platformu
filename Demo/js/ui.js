/* ==========================================================================
   Atatürk Topluluğu — Arayüz Yardımcıları ve SVG İkon Kontrolleri (js/ui.js)
   Güvenlik: Tüm mesajlar yalnızca textContent ile DOM'a yazılır (XSS koruması).
   ========================================================================== */

(function (window, document) {
  "use strict";

  /* Şifre Göster / Gizle Butonlarını Başlat */
  function initPasswordToggles() {
    var toggleButtons = document.querySelectorAll("[data-toggle-password]");
    for (var i = 0; i < toggleButtons.length; i++) {
      (function (btn) {
        var targetId = btn.getAttribute("data-toggle-password");
        var input = document.getElementById(targetId);
        if (!input) return;

        /* Başlangıçta her zaman gizli (type="password") */
        input.setAttribute("type", "password");
        btn.setAttribute("data-visible", "false");
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Şifreyi göster");
        btn.setAttribute("title", "Şifreyi göster");

        btn.addEventListener("click", function () {
          var isCurrentlyHidden = input.getAttribute("type") === "password";
          var nextVisible = isCurrentlyHidden;

          input.setAttribute("type", nextVisible ? "text" : "password");
          btn.setAttribute("data-visible", nextVisible ? "true" : "false");
          btn.setAttribute("aria-pressed", nextVisible ? "true" : "false");
          btn.setAttribute(
            "aria-label",
            nextVisible ? "Şifreyi gizle" : "Şifreyi göster"
          );
          btn.setAttribute(
            "title",
            nextVisible ? "Şifreyi gizle" : "Şifreyi göster"
          );

          /* İmleç konumunu koruyarak input odağını sürdür */
          try {
            input.focus({ preventScroll: true });
            var len = input.value ? input.value.length : 0;
            input.setSelectionRange(len, len);
          } catch (e) {
            /* Bazı mobil tarayıcılarda setSelectionRange kısıtlaması */
          }
        });
      })(toggleButtons[i]);
    }
  }

  /* Genel Form Bildirim / Hata Kutusu Gösterimi */
  var ALERT_ICONS = {
    success:
      '<circle cx="12" cy="12" r="10" /><path d="m8.5 12.5 2.3 2.3 4.7-4.8" />',
    warning:
      '<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />',
    info:
      '<circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />',
    error:
      '<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />'
  };

  function showFormAlert(message, type, title) {
    var alertBox = document.getElementById("formAlertBox");
    var alertText = document.getElementById("formAlertText");
    if (!alertBox || !alertText) return;

    var kind =
      type === "success" || type === "warning" || type === "info"
        ? type
        : "error";

    alertBox.className = "alert-box alert-" + kind;
    alertBox.setAttribute("role", kind === "error" ? "alert" : "status");

    var svg = alertBox.querySelector("svg");
    if (svg && ALERT_ICONS[kind]) {
      svg.innerHTML = ALERT_ICONS[kind];
    }

    alertText.textContent = "";
    if (title) {
      var strongEl = document.createElement("strong");
      strongEl.className = "alert-title";
      strongEl.textContent = String(title);

      var bodyEl = document.createElement("span");
      bodyEl.className = "alert-desc";
      bodyEl.textContent = String(message || "");

      alertText.appendChild(strongEl);
      alertText.appendChild(bodyEl);
    } else {
      alertText.textContent = String(message || "");
    }

    alertBox.removeAttribute("hidden");
  }

  function hideFormAlert() {
    var alertBox = document.getElementById("formAlertBox");
    var alertText = document.getElementById("formAlertText");
    if (!alertBox) return;
    alertBox.setAttribute("hidden", "hidden");
    if (alertText) {
      alertText.textContent = "";
    }
  }

  /* Alan Bazlı Hata Gösterimi / Temizleme */
  function setFieldError(inputEl, errorEl, message) {
    if (inputEl) {
      inputEl.setAttribute("aria-invalid", "true");
      inputEl.classList.remove("is-valid");
    }
    if (errorEl) {
      errorEl.textContent = String(message || "");
      errorEl.removeAttribute("hidden");
    }
  }

  function clearFieldError(inputEl, errorEl, markValid) {
    if (inputEl) {
      inputEl.setAttribute("aria-invalid", "false");
      if (markValid) {
        inputEl.classList.add("is-valid");
      } else {
        inputEl.classList.remove("is-valid");
      }
    }
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.setAttribute("hidden", "hidden");
    }
  }

  /* Gönderim Butonu Yükleniyor Durumu */
  function setButtonLoading(btnEl, isLoading, loadingText, defaultText) {
    if (!btnEl) return;
    var spinner = btnEl.querySelector(".btn-spinner");
    var label = btnEl.querySelector(".btn-label");

    btnEl.disabled = Boolean(isLoading);
    btnEl.setAttribute("aria-busy", isLoading ? "true" : "false");

    if (spinner) {
      if (isLoading) {
        spinner.removeAttribute("hidden");
      } else {
        spinner.setAttribute("hidden", "hidden");
      }
    }

    if (label) {
      if (isLoading && loadingText) {
        label.textContent = loadingText;
      } else if (!isLoading && defaultText) {
        label.textContent = defaultText;
      }
    }
  }

  function initUI() {
    initPasswordToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }

  window.AtaturkUI = {
    showFormAlert: showFormAlert,
    hideFormAlert: hideFormAlert,
    setFieldError: setFieldError,
    clearFieldError: clearFieldError,
    setButtonLoading: setButtonLoading
  };
})(window, document);
