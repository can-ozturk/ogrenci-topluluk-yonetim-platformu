/* ==========================================================================
   Atatürk Topluluğu — Daktilo Animasyonu (js/typewriter.js)
   Sonsuz döngü: harf harf yaz -> bekle (imleç yanıp söner) -> hızlıca sil
   -> kısa boşluk -> sonraki ifade. Metinler yalnızca textContent ile yazılır.
   ========================================================================== */

(function (window, document) {
  "use strict";

  var PHRASES = [
    "Atatürk ilke ve inkılaplarıyla ilerliyoruz",
    "Egemenlik kayıtsız şartsız milletindir.",
    "Etkinlikler, duyurular, topluluk çalışmaları",
    "Hayatta en hakiki mürşit ilimdir.",
    "Yurtta sulh, cihanda sulh."
  ];

  var START_DELAY = 1500; /* alt panel belirirken başlar */
  var TYPE_MIN = 60;
  var TYPE_MAX = 80;
  var HOLD_MS = 500;
  var DELETE_MS = 40;
  var GAP_MS = 250;
  var STATIC_ROTATE_MS = 4000; /* prefers-reduced-motion */

  function init() {
    var inner = document.getElementById("typewriterText");
    var cursor = document.getElementById("typewriterCursor");
    if (!inner) return;

    var wrap = inner.parentNode;
    var index = 0;
    var typed = 0;
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function fit() {
      /* Uzun ifadede son harfler (ve imleç) görünür kalsın */
      var over = inner.offsetWidth - wrap.clientWidth;
      inner.style.transform = over > 0 ? "translateX(" + -over + "px)" : "";
    }

    function setBlinking(on) {
      if (!cursor) return;
      if (on) {
        cursor.classList.add("is-blinking");
      } else {
        cursor.classList.remove("is-blinking");
      }
    }

    function addChar(ch) {
      var span = document.createElement("span");
      span.className = "tw-char";
      span.textContent = ch;
      inner.insertBefore(span, cursor);
      fit();
    }

    function removeChar() {
      var last = cursor ? cursor.previousSibling : inner.lastChild;
      if (last) inner.removeChild(last);
      fit();
    }

    function typeNext() {
      var phrase = PHRASES[index];
      if (typed < phrase.length) {
        setBlinking(false);
        addChar(phrase.charAt(typed));
        typed += 1;
        window.setTimeout(typeNext, TYPE_MIN + Math.random() * (TYPE_MAX - TYPE_MIN));
      } else {
        setBlinking(true);
        window.setTimeout(deleteNext, HOLD_MS);
      }
    }

    function deleteNext() {
      if (typed > 0) {
        setBlinking(false);
        removeChar();
        typed -= 1;
        window.setTimeout(deleteNext, DELETE_MS);
      } else {
        setBlinking(true);
        index = (index + 1) % PHRASES.length;
        window.setTimeout(typeNext, GAP_MS);
      }
    }

    function showStatic() {
      /* Hareket azaltma tercihi: harf harf animasyon yok, ifade periyodik değişir */
      while (inner.firstChild && inner.firstChild !== cursor) {
        inner.removeChild(inner.firstChild);
      }
      var span = document.createElement("span");
      span.textContent = PHRASES[index];
      inner.insertBefore(span, cursor);
      fit();
      index = (index + 1) % PHRASES.length;
      window.setTimeout(showStatic, STATIC_ROTATE_MS);
    }

    setBlinking(true);
    window.addEventListener("resize", fit);
    window.setTimeout(reduced ? showStatic : typeNext, reduced ? 0 : START_DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
