/* ==========================================================================
   Atatürk Topluluğu — Firebase Yapılandırma Dosyası (js/firebase-config.js)
   Gerçek Firebase Authentication ve Cloud Firestore bağlantısını başlatır.
   file:// protokolünde de çalışabilmesi için Auth persistence otomatik ayarlanır.
   ========================================================================== */

(function (window) {
  "use strict";

  var firebaseConfig = {
    apiKey: "GIZLI",
    authDomain: "GIZLI",
    databaseURL: "GIZLI",
    projectId: "GIZLI",
    storageBucket: "GIZLI",
    messagingSenderId: "GIZLI",
    appId: "GIZLI",
    measurementId: "GIZLI"
  };

  var isFileProtocol = window.location.protocol === "file:";

  function isConfigPlaceholder(cfg) {
    if (!cfg) return true;
    return (
      !cfg.apiKey ||
      cfg.apiKey.indexOf("BURAYA_") === 0 ||
      !cfg.projectId ||
      cfg.projectId.indexOf("BURAYA_") === 0
    );
  }

  var authInstance = null;
  var dbInstance = null;
  var initError = null;

  if (!isConfigPlaceholder(firebaseConfig)) {
    try {
      if (typeof window.firebase !== "undefined") {
        if (!window.firebase.apps || window.firebase.apps.length === 0) {
          window.firebase.initializeApp(firebaseConfig);
        }
        authInstance = window.firebase.auth();
        dbInstance = window.firebase.firestore();

        /* file:// protokolünde tarayıcı web storage kısıtlaması nedeniyle
           Firebase Auth'un hata vermemesi için bellek içi (NONE) persistence kullanılır */
        if (
          isFileProtocol &&
          authInstance &&
          window.firebase.auth.Auth &&
          window.firebase.auth.Auth.Persistence
        ) {
          authInstance
            .setPersistence(window.firebase.auth.Auth.Persistence.NONE)
            .catch(function () {});
        }
      } else {
        initError = "Sistem bağlantısı şu anda kurulamadı. Lütfen daha sonra tekrar deneyin veya yöneticiye başvurun.";
        console.error("[Atatürk Topluluğu - Sistem] Firebase SDK yüklenemedi.");
      }
    } catch (err) {
      initError = "Beklenmeyen bir sistem hatası oluştu. Lütfen yöneticiye başvurun.";
      console.error("[Atatürk Topluluğu - Sistem] Firebase başlatma hatası:", err);
    }
  }

  window.firebaseConfig = firebaseConfig;
  window.AtaturkFirebase = {
    config: firebaseConfig,
    isFileProtocol: isFileProtocol,
    isPlaceholder: isConfigPlaceholder(firebaseConfig),
    initError: initError,
    getAuth: function () {
      return authInstance;
    },
    getDb: function () {
      return dbInstance;
    }
  };
})(window);
