/* ==========================================================================
   Atatürk Topluluğu — Giriş <-> Kayıt Görünüm Geçişi (js/view-switch.js)
   Sayfa yenilenmeden geçiş yapar; sol sütun (daktilo dahil) hiç yeniden
   çizilmez. Mevcut içerik ~16px sola kayıp bulanıklaşarak solar, yeni içerik
   sağdan gelip netleşir; kart yüksekliği yumuşakça yeni içeriğe uyar.
   Bağlantılar (href="./register.html" / "./index.html") JS çalışmasa da
   normal sayfa gezintisi olarak çalışmaya devam eder.
   ========================================================================== */

(function (window, document) {
  "use strict";

  var LEAVE_MS = 250;
  var RESIZE_MS = 300;

  var TITLES = {
    login: "Giriş Yap — Atatürk Topluluğu",
    register: "Kayıt Ol — Atatürk Topluluğu"
  };
  var URLS = {
    login: "./index.html",
    register: "./register.html"
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function init() {
    var viewport = byId("formViewport");
    var card = byId("formCard");
    var column = byId("formColumn");
    var alertBox = byId("formAlertBox");
    var views = { login: byId("viewLogin"), register: byId("viewRegister") };
    if (!viewport || !card || !views.login || !views.register) return;

    var current = document.body.getAttribute("data-initial-view") === "register" ? "register" : "login";
    var busy = false;
    var queued = null;

    /* ------------------------------------------------------------------ */
    function viewFromLocation() {
      return /register\.html$/i.test(window.location.pathname) ? "register" : "login";
    }

    function setUrl(view, push) {
      try {
        window.history[push ? "pushState" : "replaceState"]({ view: view }, "", URLS[view]);
      } catch (e) {
        /* file:// gibi ortamlarda URL güncellenemez; görünüm yine de değişir */
      }
    }

    function hideAlert() {
      if (window.AtaturkUI) window.AtaturkUI.hideFormAlert();
    }

    /* Tek ortak bildirim kutusunu aktif görünümün başlığının altına taşır */
    function moveAlert(view) {
      var head = view.querySelector(".view-head");
      if (alertBox && head && head.parentNode) {
        head.parentNode.insertBefore(alertBox, head.nextSibling);
      }
    }

    /* Sağ sütunda sabit min-height tutmak yerine aktif görünüm kendi doğal
       yüksekliğini alır; böylece giriş ekranı sol sütunla dikeyde tam hizalanır
       ve ekran yüksekliğini aşmaz. */
    function reserveHeight() {
      if (!column) return;
      column.style.minHeight = "";
    }

    /* ------------------------------------------------------------------ */
    function switchTo(next, push) {
      if (next === current) return;
      if (busy) {
        queued = { view: next, push: push };
        return;
      }
      busy = true;

      var from = views[current];
      var to = views[next];
      var vs = window.getComputedStyle(viewport);
      var vPad = parseFloat(vs.paddingTop) + parseFloat(vs.paddingBottom);

      viewport.style.height = viewport.offsetHeight + "px";
      viewport.classList.add("is-animating");
      hideAlert();
      from.classList.add("is-leaving");

      window.setTimeout(function () {
        from.hidden = true;
        from.classList.remove("is-active", "is-leaving");

        moveAlert(to);
        to.hidden = false;
        to.classList.add("is-active", "is-entering");

        var endHeight = to.offsetHeight + vPad; /* yeniden akış tetikler */
        viewport.style.height = endHeight + "px";

        window.requestAnimationFrame(function () {
          to.classList.remove("is-entering");
        });

        current = next;
        document.title = TITLES[next];
        if (push !== null) setUrl(next, push);

        var heading = to.querySelector(".view-title");
        if (heading) {
          heading.setAttribute("tabindex", "-1");
          heading.focus({ preventScroll: true });
        }

        window.setTimeout(function () {
          viewport.style.height = "";
          viewport.classList.remove("is-animating");
          busy = false;
          if (queued) {
            var q = queued;
            queued = null;
            switchTo(q.view, q.push);
          }
        }, RESIZE_MS);
      }, LEAVE_MS);
    }

    /* ------------------------------------------------------------------ */
    document.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest("[data-switch-view]") : null;
      if (!link) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      e.preventDefault();
      switchTo(link.getAttribute("data-switch-view"), true);
    });

    window.addEventListener("popstate", function (e) {
      var view = e.state && e.state.view ? e.state.view : viewFromLocation();
      switchTo(view, null);
    });

    /* ------------------------------------------------------------------ */
    /* Başlangıç durumu */
    views.login.hidden = current !== "login";
    views.register.hidden = current !== "register";
    views[current].classList.add("is-active");
    moveAlert(views[current]);
    document.title = TITLES[current];

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(reserveHeight, 120);
    });
    window.addEventListener("load", reserveHeight);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reserveHeight);
    }
    reserveHeight();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
