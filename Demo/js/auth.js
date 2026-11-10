/* ==========================================================================
   Atatürk Topluluğu — Kimlik Doğrulama ve Firestore İşlemleri (js/auth.js)
   Güvenlik İlkeleri:
   - Tüm kayıt ve giriş işlemleri doğrudan Firebase Authentication ve
     Cloud Firestore / Realtime Database üzerinde gerçekleştirilir.
   - localStorage üzerinde sahte/yerel kullanıcı tutulmaz.
   - Şifreler asla console.log veya localStorage'a yazılmaz.
   - Kullanıcı girdileri yalnızca textContent ile DOM'a aktarılır.
   ========================================================================== */

(function (window, document) {
  "use strict";

  var USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;
  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var LETTERS = "A-Za-zÇĞİÖŞÜçğıöşüÂÊÎÔÛâêîôû";
  var NAME_REGEX = new RegExp("^[" + LETTERS + "]+(?:[ '’-][" + LETTERS + "]+)*$");
  var DEPARTMENT_REGEX = new RegExp("^[" + LETTERS + "0-9][" + LETTERS + "0-9 .,&()'’/-]*$");
  var STUDENT_NUMBER_REGEX = /^[0-9]{6,12}$/;

  /* Üyelik durumu: Firestore'a makine değeri yazılır, ekranda etiket gösterilir.
     (Gelecekteki yönetici onay ekranı bu alanı "approved" vb. yapacaktır.) */
  var STATUS_PENDING = "pending";
  var STATUS_LABELS = { pending: "Beklemede" };

  /* Önceki sürümden kalmış olabilecek yerel test kaydını temizle */
  try {
    window.localStorage.removeItem("ataturk_toplulugu_local_users_v1");
  } catch (e) {}

  /* ------------------------------------------------------------------------
     Firebase Identity Toolkit REST Yardımcıları
     (Tarayıcı file:// protokolündeyken Firebase JS SDK web-storage hatası
      verirse doğrudan resmi Google Identity Toolkit & Firestore REST API
      üzerinden gerçek Firebase projesine yazar.)
     ------------------------------------------------------------------------ */
  function mapRestErrorToAuthCode(msg) {
    var m = String(msg || "");
    if (m.indexOf("EMAIL_EXISTS") === 0) return "auth/email-already-in-use";
    if (m.indexOf("INVALID_EMAIL") === 0) return "auth/invalid-email";
    if (m.indexOf("WEAK_PASSWORD") === 0) return "auth/weak-password";
    if (m.indexOf("OPERATION_NOT_ALLOWED") === 0) return "auth/operation-not-allowed";
    if (m.indexOf("EMAIL_NOT_FOUND") === 0) return "auth/user-not-found";
    if (m.indexOf("INVALID_PASSWORD") === 0) return "auth/wrong-password";
    if (m.indexOf("INVALID_LOGIN_CREDENTIALS") === 0) return "auth/invalid-credential";
    if (m.indexOf("USER_DISABLED") === 0) return "auth/user-disabled";
    if (m.indexOf("TOO_MANY_ATTEMPTS_TRY_LATER") === 0) return "auth/too-many-requests";
    return "auth/unknown";
  }

  function firebaseRestAuth(endpoint, payload, apiKey) {
    var url =
      "https://identitytoolkit.googleapis.com/v1/accounts:" +
      endpoint +
      "?key=" +
      encodeURIComponent(apiKey);

    return window
      .fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || (data && data.error)) {
            var rawMsg =
              data && data.error && data.error.message
                ? data.error.message
                : "UNKNOWN_ERROR";
            var err = new Error(rawMsg);
            err.code = mapRestErrorToAuthCode(rawMsg);
            throw err;
          }
          return data;
        });
      })
      .catch(function (err) {
        if (err && err.code) throw err;
        var netErr = new Error("NETWORK_ERROR");
        netErr.code = "auth/network-request-failed";
        throw netErr;
      });
  }

  /* ------------------------------------------------------------------------
     Firestore REST Yardımcıları
     (Kayıt sırasında profil + benzersizlik kayıtları tek bir atomik "commit"
      ile yazılır. Her belge için `exists: false` ön koşulu vardır; aynı
      kullanıcı adı / öğrenci numarası ikinci kez yazılamaz — yarış durumu
      olsa bile iki istekten yalnızca biri başarılı olur.)
     ------------------------------------------------------------------------ */
  function makeCodeError(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  function firestoreRoot(cfg) {
    return (
      "projects/" + encodeURIComponent(cfg.projectId) + "/databases/(default)/documents"
    );
  }

  /* 404 yanıtı: belge yok mu (true), yoksa veritabanının kendisi mi yok (false)? */
  function isDocumentMissing(res) {
    return res
      .json()
      .catch(function () {
        return {};
      })
      .then(function (data) {
        var msg = data && data.error && data.error.message ? String(data.error.message) : "";
        return msg.indexOf("database") === -1;
      });
  }

  /* Belge var mı? true / false döner; belirlenemezse null (atomik yazım yine korur) */
  function firestoreDocExists(cfg, collection, id, idToken) {
    var url =
      "https://firestore.googleapis.com/v1/" +
      firestoreRoot(cfg) +
      "/" +
      collection +
      "/" +
      encodeURIComponent(id) +
      "?key=" +
      encodeURIComponent(cfg.apiKey);
    var opts = idToken ? { headers: { Authorization: "Bearer " + idToken } } : {};

    return window
      .fetch(url, opts)
      .then(function (res) {
        if (res.status === 200) return true;
        if (res.status === 404) {
          return isDocumentMissing(res).then(function (missing) {
            return missing ? false : null;
          });
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  /* Kayıttan önce hızlı ön kontrol (gereksiz Auth hesabı oluşmasını önler) */
  function assertClaimsFree(cfg, profile) {
    return Promise.all([
      firestoreDocExists(cfg, "studentNumbers", profile.studentNumber, null),
      firestoreDocExists(cfg, "usernames", profile.username, null)
    ]).then(function (res) {
      if (res[0] === true) throw makeCodeError("custom/student-number-taken");
      if (res[1] === true) throw makeCodeError("custom/username-taken");
    });
  }

  /* users/{uid} + usernames/{username} + studentNumbers/{no} → tek atomik yazım */
  function commitProfile(cfg, account, profile) {
    var root = firestoreRoot(cfg);
    var uid = account.uid;

    var body = {
      writes: [
        {
          update: {
            name: root + "/users/" + encodeURIComponent(uid),
            fields: {
              uid: { stringValue: uid },
              username: { stringValue: profile.username },
              firstName: { stringValue: profile.firstName },
              lastName: { stringValue: profile.lastName },
              studentNumber: { stringValue: profile.studentNumber },
              department: { stringValue: profile.department },
              email: { stringValue: profile.email.toLowerCase() },
              role: { stringValue: "member" },
              status: { stringValue: STATUS_PENDING }
            }
          },
          updateTransforms: [
            { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }
          ],
          currentDocument: { exists: false }
        },
        {
          update: {
            name: root + "/usernames/" + encodeURIComponent(profile.username),
            fields: { uid: { stringValue: uid } }
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: root + "/studentNumbers/" + encodeURIComponent(profile.studentNumber),
            fields: { uid: { stringValue: uid } }
          },
          currentDocument: { exists: false }
        }
      ]
    };

    return window
      .fetch("https://firestore.googleapis.com/v1/" + root + ":commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + account.idToken
        },
        body: JSON.stringify(body)
      })
      .then(function (res) {
        if (res.ok) return;
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            var e = new Error(
              data && data.error && data.error.message
                ? data.error.message
                : "FIRESTORE_COMMIT_FAILED"
            );
            e.code = "custom/profile-write-failed";
            e.status = res.status;
            throw e;
          });
      });
  }

  /* İsteğe bağlı Realtime Database yansıması (başarısızlık kaydı etkilemez) */
  function mirrorToRealtimeDb(cfg, account, profile) {
    if (!cfg || !cfg.databaseURL) return Promise.resolve();
    var rtdbBase = cfg.databaseURL.replace(/\/+$/, "");
    return window
      .fetch(
        rtdbBase +
          "/users/" +
          encodeURIComponent(account.uid) +
          ".json?auth=" +
          encodeURIComponent(account.idToken),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: profile.username,
            firstName: profile.firstName,
            lastName: profile.lastName,
            studentNumber: profile.studentNumber,
            department: profile.department,
            email: profile.email.toLowerCase(),
            role: "member",
            status: STATUS_PENDING,
            createdAt: new Date().toISOString()
          })
        }
      )
      .catch(function () {});
  }

  /* ------------------------------------------------------------------------
     Birleşik Firebase Kayıt & Giriş İşlemleri (Önce SDK, gerekirse REST)
     ------------------------------------------------------------------------ */
  function isSdkEnvironmentError(err) {
    return Boolean(
      err &&
        (err.code === "auth/web-storage-unsupported" ||
          err.code === "auth/operation-not-supported-in-this-environment" ||
          err.code === "auth/internal-error")
    );
  }

  /* Auth hesabı oluşturur → { uid, idToken, user (SDK kullanıcısı veya null) } */
  function createAuthAccount(FB, cfg, email, password) {
    var auth = FB && FB.getAuth ? FB.getAuth() : null;

    function viaRest() {
      return firebaseRestAuth(
        "signUp",
        { email: email, password: password, returnSecureToken: true },
        cfg.apiKey
      ).then(function (data) {
        return { uid: data.localId, idToken: data.idToken, user: null };
      });
    }

    if (auth && !FB.isFileProtocol) {
      return auth
        .createUserWithEmailAndPassword(email, password)
        .then(function (cred) {
          var user = cred.user;
          return user.getIdToken().then(function (token) {
            return { uid: user.uid, idToken: token, user: user };
          });
        })
        .catch(function (err) {
          if (isSdkEnvironmentError(err)) return viaRest();
          throw err;
        });
    }

    /* file:// protokolünde veya SDK yoksa doğrudan resmi Firebase REST API */
    return viaRest();
  }

  /* Profil yazılamazsa yetim kalan Auth hesabını siler */
  function deleteAuthAccount(cfg, account) {
    var op = account.user
      ? account.user.delete()
      : firebaseRestAuth("delete", { idToken: account.idToken }, cfg.apiKey);
    return Promise.resolve(op).catch(function (e) {
      logTechnicalError("Kayıt / Temizlik", e);
    });
  }

  function signOutQuietly(FB) {
    var auth = FB && FB.getAuth ? FB.getAuth() : null;
    if (!auth) return Promise.resolve();
    return Promise.resolve(auth.signOut()).catch(function () {});
  }

  /* Atomik yazım başarısız: çakışmayı tespit et, hesabı temizle, hatayı fırlat */
  function failRegistration(cfg, account, profile, err) {
    return Promise.all([
      firestoreDocExists(cfg, "studentNumbers", profile.studentNumber, account.idToken),
      firestoreDocExists(cfg, "usernames", profile.username, account.idToken)
    ]).then(function (res) {
      var out = err;
      if (res[0] === true) out = makeCodeError("custom/student-number-taken");
      else if (res[1] === true) out = makeCodeError("custom/username-taken");

      return deleteAuthAccount(cfg, account).then(function () {
        throw out;
      });
    });
  }

  /* profile: { firstName, lastName, studentNumber, department, username, email } */
  function registerWithFirebase(FB, profile, password) {
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;

    return assertClaimsFree(cfg, profile)
      .then(function () {
        return createAuthAccount(FB, cfg, profile.email, password);
      })
      .then(function (account) {
        return commitProfile(cfg, account, profile)
          .then(
            function () {
              return mirrorToRealtimeDb(cfg, account, profile);
            },
            function (err) {
              return failRegistration(cfg, account, profile, err);
            }
          )
          .then(function () {
            /* Üye "Beklemede" olduğundan kayıt sonrası açık oturum bırakılmaz */
            return signOutQuietly(FB);
          });
      });
  }

  /* Giriş → { uid, idToken } */
  function signInWithFirebase(FB, email, password) {
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;
    var auth = FB && FB.getAuth ? FB.getAuth() : null;

    function viaRest() {
      return firebaseRestAuth(
        "signInWithPassword",
        { email: email, password: password, returnSecureToken: true },
        cfg.apiKey
      ).then(function (data) {
        return { uid: data.localId, idToken: data.idToken };
      });
    }

    if (auth && !FB.isFileProtocol) {
      return auth
        .signInWithEmailAndPassword(email, password)
        .then(function (cred) {
          return cred.user.getIdToken().then(function (token) {
            return { uid: cred.user.uid, idToken: token };
          });
        })
        .catch(function (err) {
          if (isSdkEnvironmentError(err)) return viaRest();
          throw err;
        });
    }

    return viaRest();
  }

  /* users/{uid}.status değerini okur. Belge/alan yoksa "" (bu özellikten önce
     açılmış eski hesap). Okuma hatasında hata fırlatır (güvenli tarafta kal). */
  function fetchMemberStatus(cfg, session) {
    var url =
      "https://firestore.googleapis.com/v1/" +
      firestoreRoot(cfg) +
      "/users/" +
      encodeURIComponent(session.uid) +
      "?key=" +
      encodeURIComponent(cfg.apiKey);

    return window
      .fetch(url, { headers: { Authorization: "Bearer " + session.idToken } })
      .then(function (res) {
        if (res.status === 404) {
          return isDocumentMissing(res).then(function (missing) {
            if (!missing) throw makeCodeError("custom/status-read-failed");
            return "";
          });
        }
        if (!res.ok) throw makeCodeError("custom/status-read-failed");
        return res.json().then(function (data) {
          var f = data && data.fields && data.fields.status;
          return f && f.stringValue ? f.stringValue : "";
        });
      })
      .catch(function (err) {
        if (err && err.code === "custom/status-read-failed") throw err;
        throw makeCodeError("custom/status-read-failed");
      });
  }

  /* ------------------------------------------------------------------------
     Doğrulama Yardımcıları (Türkçe, Alan Bazlı)
     ------------------------------------------------------------------------ */
  function normalizeSpaces(rawVal) {
    return String(rawVal || "").replace(/\s+/g, " ").trim();
  }

  function validatePersonName(rawVal, label) {
    var val = normalizeSpaces(rawVal);
    if (!val) {
      return label + " alanı zorunludur.";
    }
    if (val.length < 2 || val.length > 40) {
      return label + " 2 ile 40 karakter arasında olmalıdır.";
    }
    if (!NAME_REGEX.test(val)) {
      return label + " yalnızca harflerden oluşmalıdır.";
    }
    return "";
  }

  function validateFirstName(rawVal) {
    return validatePersonName(rawVal, "Ad");
  }

  function validateLastName(rawVal) {
    return validatePersonName(rawVal, "Soyad");
  }

  function validateStudentNumber(rawVal) {
    var val = String(rawVal || "").trim();
    if (!val) {
      return "Öğrenci numarası alanı zorunludur.";
    }
    if (!/^[0-9]+$/.test(val)) {
      return "Öğrenci numarası yalnızca rakamlardan oluşmalıdır.";
    }
    if (!STUDENT_NUMBER_REGEX.test(val)) {
      return "Öğrenci numarası 6 ile 12 haneli olmalıdır.";
    }
    return "";
  }

  function validateDepartment(rawVal) {
    var val = normalizeSpaces(rawVal);
    if (!val) {
      return "Bölüm alanı zorunludur.";
    }
    if (val.length < 2 || val.length > 80) {
      return "Bölüm adı 2 ile 80 karakter arasında olmalıdır.";
    }
    if (!DEPARTMENT_REGEX.test(val)) {
      return "Bölüm adında geçersiz karakterler var. Lütfen kontrol edin.";
    }
    return "";
  }

  function validateUsername(rawVal) {
    var val = String(rawVal || "").trim();
    if (!val) {
      return "Kullanıcı adı alanı zorunludur.";
    }
    if (val.length < 3 || val.length > 20) {
      return "Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.";
    }
    if (!USERNAME_REGEX.test(val)) {
      return "Sadece küçük İngilizce harfler (a-z), rakam (0-9), nokta (.) ve alt çizgi (_) kullanabilirsiniz.";
    }
    return "";
  }

  function validateEmail(rawVal) {
    var val = String(rawVal || "").trim();
    if (!val) {
      return "E-posta adresi alanı zorunludur.";
    }
    if (!EMAIL_REGEX.test(val)) {
      return "Lütfen geçerli bir e-posta adresi girin (ör. ad.soyad@ornek.edu.tr).";
    }
    return "";
  }

  function validateLoginPassword(rawVal) {
    var val = String(rawVal || "");
    if (!val) {
      return "Şifre alanı zorunludur.";
    }
    return "";
  }

  function validateRegisterPassword(rawVal) {
    var val = String(rawVal || "");
    if (!val) {
      return "Şifre alanı zorunludur.";
    }
    if (val.length < 8) {
      return "Şifreniz en az 8 karakter uzunluğunda olmalıdır.";
    }
    if (!/[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(val) || !/[0-9]/.test(val)) {
      return "Şifreniz en az 1 harf ve 1 rakam içermelidir.";
    }
    return "";
  }

  function validatePasswordConfirm(passwordVal, confirmVal) {
    var confirmStr = String(confirmVal || "");
    if (!confirmStr) {
      return "Lütfen şifrenizi tekrar girin.";
    }
    if (passwordVal !== confirmStr) {
      return "Şifreler birbiriyle eşleşmiyor.";
    }
    return "";
  }

  /* ------------------------------------------------------------------------
     Firebase Hata Kodlarını Profesyonel Türkçe Mesajlara Çevirme
     (Teknik ve veritabanı kaynaklı hatalar kullanıcıya gösterilmez;
      yalnızca geliştirici konsoluna [F12] yazılır.)
     ------------------------------------------------------------------------ */
  function logTechnicalError(scope, err) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "[Atatürk Topluluğu - " + scope + " Hatası]",
        err && err.code ? err.code : "unknown",
        err && err.message ? err.message : err
      );
    }
  }

  function mapLoginErrorToTurkish(err) {
    var code = err && err.code ? String(err.code) : "";
    if (code === "auth/user-not-found") {
      return {
        title: "Kullanıcı Bulunamadı",
        message:
          "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı. Lütfen e-posta adresinizi kontrol edin veya kayıt olun.",
        field: "email",
        fieldMessage: "Bu e-posta adresine ait kayıtlı bir kullanıcı bulunamadı."
      };
    }
    if (code === "auth/wrong-password") {
      return {
        title: "Hatalı Şifre",
        message:
          "Girdiğiniz şifre yanlış. Lütfen şifrenizi kontrol edip tekrar deneyin.",
        field: "password",
        fieldMessage: "Şifre hatalı. Lütfen tekrar deneyin."
      };
    }
    if (
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials"
    ) {
      return {
        title: "Giriş Bilgileri Hatalı",
        message:
          "Girdiğiniz şifre yanlış veya bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.",
        field: "password",
        fieldMessage: "E-posta adresi veya şifre doğrulanamadı."
      };
    }
    if (code === "auth/invalid-email") {
      return {
        title: "Geçersiz E-posta",
        message: "Lütfen geçerli bir e-posta adresi girin.",
        field: "email",
        fieldMessage: "Geçerli bir e-posta adresi girin."
      };
    }
    if (code === "auth/too-many-requests") {
      return {
        title: "Çok Fazla Deneme",
        message:
          "Çok fazla başarısız giriş denemesi yapıldı. Güvenliğiniz için lütfen birkaç dakika bekleyip tekrar deneyin."
      };
    }
    if (code === "auth/user-disabled") {
      return {
        title: "Hesap Askıya Alındı",
        message:
          "Bu kullanıcı hesabı kullanıma kapatılmıştır. Detaylı bilgi için topluluk yönetimine başvurun."
      };
    }
    if (code === "auth/network-request-failed") {
      logTechnicalError("Giriş / Ağ", err);
      return {
        title: "Bağlantı Hatası",
        message:
          "Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
      };
    }

    /* Teknik / yapılandırma / bilinmeyen hatalar: detayı sadece F12 konsola yaz */
    logTechnicalError("Giriş", err);
    return {
      title: "Bilinmeyen Hata",
      message:
        "Giriş işlemi şu anda gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyin veya topluluk yönetimine başvurun."
    };
  }

  function mapRegisterErrorToTurkish(err) {
    var code = err && err.code ? String(err.code) : "";
    if (code === "auth/email-already-in-use") {
      return {
        title: "E-posta Kullanımda",
        message: "Bu e-posta adresiyle kayıtlı bir hesap zaten var. Giriş yapmayı deneyebilirsiniz."
      };
    }
    if (code === "auth/invalid-email") {
      return {
        title: "Geçersiz E-posta",
        message: "Lütfen geçerli bir e-posta adresi girin."
      };
    }
    if (code === "auth/weak-password") {
      return {
        title: "Zayıf Şifre",
        message: "Şifreniz çok zayıf. Lütfen en az 8 karakter, 1 harf ve 1 rakam içeren bir şifre seçin."
      };
    }
    if (code === "auth/network-request-failed") {
      logTechnicalError("Kayıt / Ağ", err);
      return {
        title: "Bağlantı Hatası",
        message: "Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
      };
    }

    /* Teknik / veritabanı / yapılandırma hataları: detayı sadece F12 konsola yaz */
    logTechnicalError("Kayıt", err);
    return {
      title: "Bilinmeyen Hata",
      message: "Kayıt işlemi sırasında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin veya topluluk yönetimine başvurun."
    };
  }

  /* ------------------------------------------------------------------------
     GİRİŞ GÖRÜNÜMÜ BAŞLATMA
     ------------------------------------------------------------------------ */
  function initLoginPage() {
    var loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    var emailInput = document.getElementById("loginEmail");
    var emailError = document.getElementById("loginEmailError");
    var passwordInput = document.getElementById("loginPassword");
    var passwordError = document.getElementById("loginPasswordError");
    var submitBtn = document.getElementById("loginSubmitBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        UI.clearFieldError(emailInput, emailError, false);
        UI.hideFormAlert();
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener("input", function () {
        UI.clearFieldError(passwordInput, passwordError, false);
        UI.hideFormAlert();
      });
    }

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      UI.hideFormAlert();

      var emailVal = emailInput ? emailInput.value.trim() : "";
      var passwordVal = passwordInput ? passwordInput.value : "";

      var emailErrMsg = validateEmail(emailVal);
      var passErrMsg = validateLoginPassword(passwordVal);

      var hasError = false;
      if (emailErrMsg) {
        UI.setFieldError(emailInput, emailError, emailErrMsg);
        hasError = true;
      } else {
        UI.clearFieldError(emailInput, emailError, true);
      }

      if (passErrMsg) {
        UI.setFieldError(passwordInput, passwordError, passErrMsg);
        hasError = true;
      } else {
        UI.clearFieldError(passwordInput, passwordError, true);
      }

      if (hasError) {
        if (emailErrMsg && emailInput) {
          emailInput.focus();
        } else if (passErrMsg && passwordInput) {
          passwordInput.focus();
        }
        return;
      }

      UI.setButtonLoading(submitBtn, true, "Giriş yapılıyor...", "Giriş Yap");

      function handleLoginSuccess(session) {
        return fetchMemberStatus(FB.config, session).then(
          function (status) {
            UI.setButtonLoading(submitBtn, false, "Giriş yapılıyor...", "Giriş Yap");
            if (passwordInput) {
              passwordInput.value = "";
              UI.clearFieldError(passwordInput, passwordError, false);
            }

            /* Onay bekleyen üye: oturum kapatılır, hiçbir sayfa açılmaz */
            if (status === STATUS_PENDING) {
              return signOutQuietly(FB).then(function () {
                UI.showFormAlert(
                  "Üyelik başvurunuz yönetim onayı bekliyor. Durumunuz: " +
                    STATUS_LABELS[STATUS_PENDING] +
                    ". Onaylandığında giriş yapabileceksiniz.",
                  "info",
                  "Başvurunuz " + STATUS_LABELS[STATUS_PENDING]
                );
              });
            }

            UI.showFormAlert(
              "Kimlik doğrulaması tamamlandı. Ana ekran çok yakında hizmetinizde olacak.",
              "success",
              "Giriş Başarılı"
            );
          },
          function (err) {
            /* Durum okunamadı: güvenli tarafta kal, oturumu kapat */
            return signOutQuietly(FB).then(function () {
              throw err;
            });
          }
        );
      }

      function handleLoginError(err) {
        UI.setButtonLoading(submitBtn, false, "Giriş yapılıyor...", "Giriş Yap");
        var info = mapLoginErrorToTurkish(err);

        if (info.field === "email" && emailInput) {
          UI.setFieldError(
            emailInput,
            emailError,
            info.fieldMessage || info.message
          );
          emailInput.focus();
        } else if (info.field === "password" && passwordInput) {
          UI.setFieldError(
            passwordInput,
            passwordError,
            info.fieldMessage || info.message
          );
          passwordInput.focus();
        }

        UI.showFormAlert(info.message, "error", info.title);
      }

      signInWithFirebase(FB, emailVal, passwordVal)
        .then(handleLoginSuccess)
        .catch(handleLoginError);
    });
  }

  /* ------------------------------------------------------------------------
     KAYIT OL GÖRÜNÜMÜ BAŞLATMA
     ------------------------------------------------------------------------ */
  function initRegisterPage() {
    var registerForm = document.getElementById("registerForm");
    if (!registerForm) return;

    var firstNameInput = document.getElementById("registerFirstName");
    var firstNameError = document.getElementById("registerFirstNameError");
    var lastNameInput = document.getElementById("registerLastName");
    var lastNameError = document.getElementById("registerLastNameError");
    var studentNoInput = document.getElementById("registerStudentNumber");
    var studentNoError = document.getElementById("registerStudentNumberError");
    var departmentInput = document.getElementById("registerDepartment");
    var departmentError = document.getElementById("registerDepartmentError");
    var usernameInput = document.getElementById("registerUsername");
    var usernameError = document.getElementById("registerUsernameError");
    var emailInput = document.getElementById("registerEmail");
    var emailError = document.getElementById("registerEmailError");
    var passwordInput = document.getElementById("registerPassword");
    var passwordError = document.getElementById("registerPasswordError");
    var confirmInput = document.getElementById("registerPasswordConfirm");
    var confirmError = document.getElementById("registerPasswordConfirmError");
    var matchStatus = document.getElementById("passwordMatchStatus");
    var submitBtn = document.getElementById("registerSubmitBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;

    function updateRealtimePasswordMatch() {
      if (!passwordInput || !confirmInput || !matchStatus) return;

      var passVal = passwordInput.value;
      var confVal = confirmInput.value;

      if (!confVal) {
        matchStatus.textContent = "";
        matchStatus.setAttribute("hidden", "hidden");
        matchStatus.className = "field-status";
        confirmInput.classList.remove("is-valid");
        return;
      }

      UI.clearFieldError(confirmInput, confirmError, false);
      matchStatus.removeAttribute("hidden");

      if (passVal === confVal) {
        matchStatus.textContent = "✓ Şifreler birbiriyle eşleşiyor.";
        matchStatus.className = "field-status is-match";
        confirmInput.setAttribute("aria-invalid", "false");
        confirmInput.classList.add("is-valid");
      } else {
        matchStatus.textContent = "✕ Şifreler birbiriyle eşleşmiyor.";
        matchStatus.className = "field-status is-mismatch";
        confirmInput.setAttribute("aria-invalid", "true");
        confirmInput.classList.remove("is-valid");
      }
    }

    function resetRegisterFormClean() {
      registerForm.reset();
      UI.clearFieldError(firstNameInput, firstNameError, false);
      UI.clearFieldError(lastNameInput, lastNameError, false);
      UI.clearFieldError(studentNoInput, studentNoError, false);
      UI.clearFieldError(departmentInput, departmentError, false);
      UI.clearFieldError(usernameInput, usernameError, false);
      UI.clearFieldError(emailInput, emailError, false);
      UI.clearFieldError(passwordInput, passwordError, false);
      UI.clearFieldError(confirmInput, confirmError, false);
      if (matchStatus) {
        matchStatus.textContent = "";
        matchStatus.setAttribute("hidden", "hidden");
        matchStatus.className = "field-status";
      }
    }

    /* Yeni zorunlu alanlar: yazarken hatayı temizle, alandan çıkınca doğrula */
    function bindRequiredField(inputEl, errorEl, validator) {
      if (!inputEl) return;
      inputEl.addEventListener("input", function () {
        UI.clearFieldError(inputEl, errorEl, false);
        UI.hideFormAlert();
      });
      inputEl.addEventListener("blur", function () {
        if (!inputEl.value.trim()) return;
        var err = validator(inputEl.value);
        if (err) {
          UI.setFieldError(inputEl, errorEl, err);
        } else {
          UI.clearFieldError(inputEl, errorEl, true);
        }
      });
    }

    bindRequiredField(firstNameInput, firstNameError, validateFirstName);
    bindRequiredField(lastNameInput, lastNameError, validateLastName);
    bindRequiredField(studentNoInput, studentNoError, validateStudentNumber);
    bindRequiredField(departmentInput, departmentError, validateDepartment);

    if (usernameInput) {
      usernameInput.addEventListener("input", function () {
        var lowered = usernameInput.value.toLowerCase();
        if (usernameInput.value !== lowered) {
          var pos = usernameInput.selectionStart;
          usernameInput.value = lowered;
          try {
            usernameInput.setSelectionRange(pos, pos);
          } catch (e) {}
        }
        UI.clearFieldError(usernameInput, usernameError, false);
        UI.hideFormAlert();
      });

      usernameInput.addEventListener("blur", function () {
        var val = usernameInput.value.trim();
        if (!val) return;
        var err = validateUsername(val);
        if (err) {
          UI.setFieldError(usernameInput, usernameError, err);
        } else {
          UI.clearFieldError(usernameInput, usernameError, true);
        }
      });
    }

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        UI.clearFieldError(emailInput, emailError, false);
        UI.hideFormAlert();
      });

      emailInput.addEventListener("blur", function () {
        var val = emailInput.value.trim();
        if (!val) return;
        var err = validateEmail(val);
        if (err) {
          UI.setFieldError(emailInput, emailError, err);
        } else {
          UI.clearFieldError(emailInput, emailError, true);
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener("input", function () {
        UI.clearFieldError(passwordInput, passwordError, false);
        UI.hideFormAlert();
        updateRealtimePasswordMatch();
      });

      passwordInput.addEventListener("blur", function () {
        var val = passwordInput.value;
        if (!val) return;
        var err = validateRegisterPassword(val);
        if (err) {
          UI.setFieldError(passwordInput, passwordError, err);
        } else {
          UI.clearFieldError(passwordInput, passwordError, true);
        }
      });
    }

    if (confirmInput) {
      confirmInput.addEventListener("input", function () {
        UI.hideFormAlert();
        updateRealtimePasswordMatch();
      });
    }

    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      UI.hideFormAlert();

      var usernameVal = usernameInput
        ? usernameInput.value.trim().toLowerCase()
        : "";
      if (usernameInput && usernameInput.value !== usernameVal) {
        usernameInput.value = usernameVal;
      }

      var firstNameVal = normalizeSpaces(firstNameInput ? firstNameInput.value : "");
      var lastNameVal = normalizeSpaces(lastNameInput ? lastNameInput.value : "");
      var studentNoVal = studentNoInput ? studentNoInput.value.trim() : "";
      var departmentVal = normalizeSpaces(departmentInput ? departmentInput.value : "");

      var emailVal = emailInput ? emailInput.value.trim() : "";
      var passwordVal = passwordInput ? passwordInput.value : "";
      var confirmVal = confirmInput ? confirmInput.value : "";

      var firstInvalid = null;

      /* Sıra formdaki görünüm sırasıyla aynıdır: ilk hatalı alana odaklanılır */
      [
        [firstNameInput, firstNameError, validateFirstName(firstNameVal)],
        [lastNameInput, lastNameError, validateLastName(lastNameVal)],
        [studentNoInput, studentNoError, validateStudentNumber(studentNoVal)],
        [departmentInput, departmentError, validateDepartment(departmentVal)]
      ].forEach(function (f) {
        if (f[2]) {
          UI.setFieldError(f[0], f[1], f[2]);
          if (!firstInvalid) firstInvalid = f[0];
        } else {
          UI.clearFieldError(f[0], f[1], true);
        }
      });

      var userErr = validateUsername(usernameVal);
      var emailErr = validateEmail(emailVal);
      var passErr = validateRegisterPassword(passwordVal);
      var confErr = validatePasswordConfirm(passwordVal, confirmVal);

      if (userErr) {
        UI.setFieldError(usernameInput, usernameError, userErr);
        if (!firstInvalid) firstInvalid = usernameInput;
      } else {
        UI.clearFieldError(usernameInput, usernameError, true);
      }

      if (emailErr) {
        UI.setFieldError(emailInput, emailError, emailErr);
        if (!firstInvalid) firstInvalid = emailInput;
      } else {
        UI.clearFieldError(emailInput, emailError, true);
      }

      if (passErr) {
        UI.setFieldError(passwordInput, passwordError, passErr);
        if (!firstInvalid) firstInvalid = passwordInput;
      } else {
        UI.clearFieldError(passwordInput, passwordError, true);
      }

      if (confErr) {
        if (matchStatus) {
          matchStatus.setAttribute("hidden", "hidden");
        }
        UI.setFieldError(confirmInput, confirmError, confErr);
        if (!firstInvalid) firstInvalid = confirmInput;
      } else {
        UI.clearFieldError(confirmInput, confirmError, true);
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      UI.setButtonLoading(
        submitBtn,
        true,
        "Kaydınız oluşturuluyor...",
        "Kayıt Ol"
      );

      registerWithFirebase(
        FB,
        {
          firstName: firstNameVal,
          lastName: lastNameVal,
          studentNumber: studentNoVal,
          department: departmentVal,
          username: usernameVal,
          email: emailVal
        },
        passwordVal
      )
        .then(function () {
          UI.setButtonLoading(
            submitBtn,
            false,
            "Kaydınız oluşturuluyor...",
            "Kayıt Ol"
          );
          resetRegisterFormClean();

          var loginEmailInput = document.getElementById("loginEmail");
          if (loginEmailInput && !loginEmailInput.value) {
            loginEmailInput.value = emailVal;
          }

          UI.showFormAlert(
            "Üyelik başvurunuz alındı. Durumunuz: " +
              STATUS_LABELS[STATUS_PENDING] +
              ". Yönetim onayından sonra giriş yapabileceksiniz.",
            "success",
            "Başvurunuz Alındı"
          );
        })
        .catch(function (err) {
          UI.setButtonLoading(
            submitBtn,
            false,
            "Kaydınız oluşturuluyor...",
            "Kayıt Ol"
          );

          if (err && err.code === "custom/student-number-taken") {
            UI.setFieldError(
              studentNoInput,
              studentNoError,
              "Bu öğrenci numarasıyla daha önce kayıt yapılmış."
            );
            UI.showFormAlert(
              "Bu öğrenci numarasıyla zaten bir üyelik başvurusu bulunuyor. Bir yanlışlık olduğunu düşünüyorsanız topluluk yönetimine başvurun.",
              "error",
              "Öğrenci Numarası Kayıtlı"
            );
            if (studentNoInput) studentNoInput.focus();
            return;
          }

          if (err && err.code === "custom/username-taken") {
            UI.setFieldError(
              usernameInput,
              usernameError,
              "Bu kullanıcı adı zaten alınmış. Lütfen başka bir kullanıcı adı seçin."
            );
            UI.showFormAlert(
              "Seçtiğiniz kullanıcı adı başka bir üye tarafından kullanılıyor.",
              "error",
              "Kullanıcı Adı Kullanımda"
            );
            if (usernameInput) usernameInput.focus();
            return;
          }

          if (err && err.code === "auth/email-already-in-use") {
            UI.setFieldError(
              emailInput,
              emailError,
              "Bu e-posta adresi zaten kullanımda. Giriş yapmayı deneyebilirsiniz."
            );
            UI.showFormAlert(
              "Bu e-posta adresiyle kayıtlı bir hesap zaten mevcut. Giriş ekranından oturum açabilirsiniz.",
              "error",
              "E-posta Kullanımda"
            );
            if (emailInput) emailInput.focus();
            return;
          }

          var regErrInfo = mapRegisterErrorToTurkish(err);
          UI.showFormAlert(
            regErrInfo.message,
            "error",
            regErrInfo.title
          );
        });
    });
  }

  /* ------------------------------------------------------------------------
     PANEL SAYFASI (dashboard.html) BAŞLATMA
     ------------------------------------------------------------------------ */
  function initDashboardPage() {
    var dashboardView = document.getElementById("dashboardView");
    if (!dashboardView) return;

    var welcomeTitle = document.getElementById("dashboardWelcomeTitle");
    var usernameEl = document.getElementById("dashboardUsername");
    var emailEl = document.getElementById("dashboardEmail");
    var roleEl = document.getElementById("dashboardRole");
    var logoutBtn = document.getElementById("logoutBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var auth = FB && FB.getAuth ? FB.getAuth() : null;
    var db = FB && FB.getDb ? FB.getDb() : null;

    if (!auth) {
      window.location.href = "./index.html";
      return;
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = "./index.html";
        return;
      }

      if (emailEl) {
        emailEl.textContent = user.email || "-";
      }

      if (db) {
        db.collection("users")
          .doc(user.uid)
          .get()
          .then(function (docSnap) {
            var data = docSnap.exists ? docSnap.data() : null;
            var uname =
              data && data.username
                ? data.username
                : user.email
                ? user.email.split("@")[0]
                : "Üye";
            var urole = data && data.role ? data.role : "member";

            if (welcomeTitle) {
              welcomeTitle.textContent =
                "Hoş geldin, " + uname + " — Atatürk Topluluğu Paneli";
            }
            if (usernameEl) {
              usernameEl.textContent = "@" + uname;
            }
            if (roleEl) {
              roleEl.textContent = urole === "member" ? "Üye (member)" : urole;
            }
          })
          .catch(function () {
            var fallbackName = user.email ? user.email.split("@")[0] : "Üye";
            if (welcomeTitle) {
              welcomeTitle.textContent =
                "Hoş geldin, " + fallbackName + " — Atatürk Topluluğu Paneli";
            }
            if (usernameEl) {
              usernameEl.textContent = "@" + fallbackName;
            }
          });
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        UI.setButtonLoading(logoutBtn, true, "Çıkış yapılıyor...", "Çıkış Yap");
        auth
          .signOut()
          .then(function () {
            window.location.href = "./index.html";
          })
          .catch(function () {
            UI.setButtonLoading(
              logoutBtn,
              false,
              "Çıkış yapılıyor...",
              "Çıkış Yap"
            );
            UI.showFormAlert(
              "Çıkış yapılırken bir sorun oluştu. Lütfen tekrar deneyin.",
              "error"
            );
          });
      });
    }
  }

  function initAll() {
    initLoginPage();
    initRegisterPage();
    initDashboardPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})(window, document);
