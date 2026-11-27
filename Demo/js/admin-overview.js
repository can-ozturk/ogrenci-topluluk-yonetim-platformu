(function (window, document) {
  "use strict";

  var ATATURK_QUOTES = [
    "Hayatta en hakiki mürşit ilimdir, fendir.",
    "Bütün ümidim gençliktedir.",
    "Yurtta sulh, cihanda sulh.",
    "Egemenlik kayıtsız şartsız milletindir.",
    "Dinlenmemek üzere yürümeye karar verenler, asla ve asla yorulmazlar.",
    "Beni görmek demek mutlaka yüzümü görmek demek değildir. Benim fikirlerimi, benim duygularımı anlıyorsanız ve hissediyorsanız bu kafidir."
  ];

  var LETTERS = "A-Za-zÇĞİÖŞÜçğıöşüÂÊÎÔÛâêîôû";
  var NAME_REGEX = new RegExp("^[" + LETTERS + "]+(?:[ '’-][" + LETTERS + "]+)*$");

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeSpaces(val) {
    return String(val || "").replace(/\s+/g, " ").trim();
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

  function validateNewPassword(rawVal) {
    var val = String(rawVal || "");
    if (!val) {
      return "Yeni şifre alanı zorunludur.";
    }
    if (val.length < 8) {
      return "Yeni şifreniz en az 8 karakter uzunluğunda olmalıdır.";
    }
    if (!/[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(val) || !/[0-9]/.test(val)) {
      return "Yeni şifreniz en az 1 harf ve 1 rakam içermelidir.";
    }
    return "";
  }

  function initOverviewTypewriter() {
    var inner = byId("overviewTypewriterText");
    var cursor = byId("overviewTypewriterCursor");
    if (!inner) return;

    var index = 0;
    var typed = 0;
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function setBlinking(on) {
      if (!cursor) return;
      if (on) cursor.classList.add("is-blinking");
      else cursor.classList.remove("is-blinking");
    }

    function addChar(ch) {
      var span = document.createElement("span");
      span.className = "tw-char";
      span.textContent = ch;
      inner.insertBefore(span, cursor);
    }

    function removeChar() {
      var last = cursor ? cursor.previousSibling : inner.lastChild;
      if (last) inner.removeChild(last);
    }

    function typeNext() {
      var phrase = ATATURK_QUOTES[index];
      if (typed < phrase.length) {
        setBlinking(false);
        addChar(phrase.charAt(typed));
        typed += 1;
        window.setTimeout(typeNext, 48 + Math.random() * 28);
      } else {
        setBlinking(true);
        window.setTimeout(deleteNext, 2600);
      }
    }

    function deleteNext() {
      if (typed > 0) {
        setBlinking(false);
        removeChar();
        typed -= 1;
        window.setTimeout(deleteNext, 24);
      } else {
        setBlinking(true);
        index = (index + 1) % ATATURK_QUOTES.length;
        window.setTimeout(typeNext, 350);
      }
    }

    function showStatic() {
      while (inner.firstChild && inner.firstChild !== cursor) {
        inner.removeChild(inner.firstChild);
      }
      var span = document.createElement("span");
      span.textContent = ATATURK_QUOTES[index];
      inner.insertBefore(span, cursor);
      index = (index + 1) % ATATURK_QUOTES.length;
      window.setTimeout(showStatic, 5500);
    }

    setBlinking(true);
    window.setTimeout(reduced ? showStatic : typeNext, reduced ? 0 : 450);
  }

  function saveAdminNameEverywhere(cfg, Auth, session, firstName, lastName, fullName) {
    var uidKey = encodeURIComponent(session.uid);
    var patchData = {
      firstName: firstName,
      lastName: lastName,
      fullName: fullName
    };

    var rtdbOp = Auth.rtdbRequest(
      cfg,
      "PATCH",
      "admins/" + uidKey,
      session.idToken,
      patchData
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/admins/" +
      uidKey +
      "?updateMask.fieldPaths=firstName&updateMask.fieldPaths=lastName&updateMask.fieldPaths=fullName&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsOp = window
      .fetch(fsUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.idToken
        },
        body: JSON.stringify({
          fields: {
            firstName: { stringValue: firstName },
            lastName: { stringValue: lastName },
            fullName: { stringValue: fullName }
          }
        })
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]);
  }

  function changePasswordWithFirebase(FB, Auth, cfg, session, currentPassword, newPassword) {
    var auth = FB && FB.getAuth ? FB.getAuth() : null;
    var sdkUser = auth && !FB.isFileProtocol ? auth.currentUser : null;

    if (
      sdkUser &&
      window.firebase &&
      window.firebase.auth &&
      window.firebase.auth.EmailAuthProvider
    ) {
      var cred = window.firebase.auth.EmailAuthProvider.credential(
        sdkUser.email || session.email,
        currentPassword
      );
      return sdkUser
        .reauthenticateWithCredential(cred)
        .then(function () {
          return sdkUser.updatePassword(newPassword);
        })
        .then(function () {
          return sdkUser.getIdToken(true);
        })
        .then(function (freshToken) {
          session.idToken = freshToken;
          Auth.saveAuthSession(session);
        });
    }

    return Auth.firebaseRestAuth(
      "signInWithPassword",
      {
        email: session.email,
        password: currentPassword,
        returnSecureToken: true
      },
      cfg.apiKey
    )
      .then(function (reauthData) {
        return Auth.firebaseRestAuth(
          "update",
          {
            idToken: reauthData.idToken,
            password: newPassword,
            returnSecureToken: true
          },
          cfg.apiKey
        );
      })
      .then(function (updatedData) {
        if (updatedData && updatedData.idToken) {
          session.idToken = updatedData.idToken;
          if (updatedData.refreshToken) {
            session.refreshToken = updatedData.refreshToken;
          }
          Auth.saveAuthSession(session);
        }
      });
  }

  function mapPasswordChangeError(Auth, err) {
    var code = err && err.code ? String(err.code) : "";
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials"
    ) {
      return {
        field: "current",
        title: "Mevcut Şifre Hatalı",
        message: "Girdiğiniz mevcut şifre yanlış. Lütfen kontrol edip tekrar deneyin."
      };
    }
    if (code === "auth/weak-password") {
      return {
        field: "new",
        title: "Zayıf Şifre",
        message:
          "Seçtiğiniz yeni şifre yeterince güçlü değil. En az 8 karakter, 1 harf ve 1 rakam kullanın."
      };
    }
    if (code === "auth/requires-recent-login") {
      return {
        field: "",
        title: "Yeniden Giriş Gerekli",
        message:
          "Güvenliğiniz için oturumunuzun tazelenmesi gerekiyor. Lütfen çıkış yapıp tekrar giriş yaptıktan sonra şifrenizi güncelleyin."
      };
    }
    if (code === "auth/too-many-requests") {
      return {
        field: "",
        title: "Çok Fazla Deneme",
        message:
          "Çok fazla başarısız deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin."
      };
    }
    if (code === "auth/network-request-failed") {
      Auth.logTechnicalError("Şifre Değiştirme / Ağ", err);
      return {
        field: "",
        title: "Bağlantı Hatası",
        message:
          "Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
      };
    }

    Auth.logTechnicalError("Şifre Değiştirme", err);
    return {
      field: "",
      title: "Bilinmeyen Hata",
      message:
        "Şifre güncelleme işlemi şu anda gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyin."
    };
  }

  function initAdminOverviewModule() {
    var panel = byId("panelOverview");
    if (!panel) return;

    var welcomeTitleEl = byId("overviewWelcomeTitle");
    var fullNameValEl = byId("overviewFullNameValue");
    var emailValEl = byId("overviewEmailValue");
    var roleValEl = byId("overviewRoleValue");

    var profileForm = byId("adminProfileForm");
    var firstNameInput = byId("adminFirstName");
    var firstNameError = byId("adminFirstNameError");
    var lastNameInput = byId("adminLastName");
    var lastNameError = byId("adminLastNameError");
    var profileSubmitBtn = byId("adminProfileSubmitBtn");

    var passwordForm = byId("adminPasswordForm");
    var currentPwInput = byId("overviewCurrentPassword");
    var currentPwError = byId("overviewCurrentPasswordError");
    var newPwInput = byId("overviewNewPassword");
    var newPwError = byId("overviewNewPasswordError");
    var confirmPwInput = byId("overviewConfirmPassword");
    var confirmPwError = byId("overviewConfirmPasswordError");
    var passwordSubmitBtn = byId("adminPasswordSubmitBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;

    var adminCtx = null;

    initOverviewTypewriter();

    function notify(text, kind) {
      if (adminCtx && typeof adminCtx.showToast === "function") {
        adminCtx.showToast(text, kind);
      }
    }

    function renderProfileSummary(firstName, lastName, email, roleLabel) {
      var full = [firstName, lastName].filter(Boolean).join(" ").trim();

      if (welcomeTitleEl) {
        welcomeTitleEl.textContent = full
          ? "Panele Hoş Geldiniz, " + full
          : "Panele Hoş Geldiniz";
      }
      if (fullNameValEl) {
        fullNameValEl.textContent = full || "Henüz tanımlanmadı";
      }
      if (emailValEl) {
        emailValEl.textContent = email || "—";
      }
      if (roleValEl) {
        roleValEl.textContent = roleLabel || "Yetkili";
      }
      if (firstNameInput && firstName) {
        firstNameInput.value = firstName;
      }
      if (lastNameInput && lastName) {
        lastNameInput.value = lastName;
      }
    }

    [
      [firstNameInput, firstNameError],
      [lastNameInput, lastNameError],
      [currentPwInput, currentPwError],
      [newPwInput, newPwError],
      [confirmPwInput, confirmPwError]
    ].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].addEventListener("input", function () {
        UI.clearFieldError(pair[0], pair[1], false);
      });
    });

    if (profileForm) {
      profileForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!adminCtx || !adminCtx.session) return;

        var firstVal = normalizeSpaces(firstNameInput ? firstNameInput.value : "");
        var lastVal = normalizeSpaces(lastNameInput ? lastNameInput.value : "");

        var firstErr = validatePersonName(firstVal, "Adı");
        var lastErr = validatePersonName(lastVal, "Soyadı");

        if (firstErr) UI.setFieldError(firstNameInput, firstNameError, firstErr);
        else UI.clearFieldError(firstNameInput, firstNameError, true);

        if (lastErr) UI.setFieldError(lastNameInput, lastNameError, lastErr);
        else UI.clearFieldError(lastNameInput, lastNameError, true);

        if (firstErr || lastErr) {
          (firstErr ? firstNameInput : lastNameInput).focus();
          return;
        }

        var fullName = firstVal + " " + lastVal;
        UI.setButtonLoading(profileSubmitBtn, true, "Kaydediliyor...", "Ad Soyad Kaydet");

        saveAdminNameEverywhere(cfg, Auth, adminCtx.session, firstVal, lastVal, fullName)
          .then(function () {
            UI.setButtonLoading(profileSubmitBtn, false, "Kaydediliyor...", "Ad Soyad Kaydet");

            renderProfileSummary(firstVal, lastVal, adminCtx.email, adminCtx.roleLabel);
            if (typeof adminCtx.updateAdminHeader === "function") {
              adminCtx.updateAdminHeader(firstVal, lastVal, adminCtx.email);
            }

            var eventCreatorEl = byId("eventCreatorName");
            if (eventCreatorEl && !eventCreatorEl.value.trim()) {
              eventCreatorEl.value = fullName;
            }

            notify("Yetkili ad soyad bilginiz başarıyla kaydedildi.", "success");
          })
          .catch(function (err) {
            UI.setButtonLoading(profileSubmitBtn, false, "Kaydediliyor...", "Ad Soyad Kaydet");
            Auth.logTechnicalError("Yetkili Profil Güncelleme", err);
            notify("Bilgiler kaydedilemedi. Lütfen tekrar deneyin.", "error");
          });
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!adminCtx || !adminCtx.session) return;

        var currentVal = currentPwInput ? currentPwInput.value : "";
        var newVal = newPwInput ? newPwInput.value : "";
        var confirmVal = confirmPwInput ? confirmPwInput.value : "";

        var firstInvalid = null;

        if (!currentVal) {
          UI.setFieldError(currentPwInput, currentPwError, "Mevcut şifrenizi girmelisiniz.");
          if (!firstInvalid) firstInvalid = currentPwInput;
        } else {
          UI.clearFieldError(currentPwInput, currentPwError, false);
        }

        var newErr = validateNewPassword(newVal);
        if (!newErr && currentVal && newVal === currentVal) {
          newErr = "Yeni şifreniz mevcut şifrenizle aynı olamaz.";
        }
        if (newErr) {
          UI.setFieldError(newPwInput, newPwError, newErr);
          if (!firstInvalid) firstInvalid = newPwInput;
        } else {
          UI.clearFieldError(newPwInput, newPwError, true);
        }

        if (!confirmVal) {
          UI.setFieldError(confirmPwInput, confirmPwError, "Lütfen yeni şifrenizi tekrar girin.");
          if (!firstInvalid) firstInvalid = confirmPwInput;
        } else if (newVal !== confirmVal) {
          UI.setFieldError(confirmPwInput, confirmPwError, "Yeni şifreler birbiriyle eşleşmiyor.");
          if (!firstInvalid) firstInvalid = confirmPwInput;
        } else {
          UI.clearFieldError(confirmPwInput, confirmPwError, true);
        }

        if (firstInvalid) {
          firstInvalid.focus();
          return;
        }

        UI.setButtonLoading(passwordSubmitBtn, true, "Şifre güncelleniyor...", "Şifreyi Güncelle");

        changePasswordWithFirebase(FB, Auth, cfg, adminCtx.session, currentVal, newVal)
          .then(function () {
            UI.setButtonLoading(
              passwordSubmitBtn,
              false,
              "Şifre güncelleniyor...",
              "Şifreyi Güncelle"
            );
            passwordForm.reset();
            UI.clearFieldError(currentPwInput, currentPwError, false);
            UI.clearFieldError(newPwInput, newPwError, false);
            UI.clearFieldError(confirmPwInput, confirmPwError, false);
            notify("Şifreniz başarıyla güncellendi.", "success");
          })
          .catch(function (err) {
            UI.setButtonLoading(
              passwordSubmitBtn,
              false,
              "Şifre güncelleniyor...",
              "Şifreyi Güncelle"
            );
            var info = mapPasswordChangeError(Auth, err);
            if (info.field === "current" && currentPwInput) {
              UI.setFieldError(currentPwInput, currentPwError, info.message);
              currentPwInput.focus();
            } else if (info.field === "new" && newPwInput) {
              UI.setFieldError(newPwInput, newPwError, info.message);
              newPwInput.focus();
            }
            notify(info.message, "error");
          });
      });
    }

    function onAdminReady(ctx) {
      adminCtx = ctx;
      renderProfileSummary(ctx.firstName, ctx.lastName, ctx.email, ctx.roleLabel);
    }

    window.AtaturkOverview = {
      onAdminReady: onAdminReady
    };

    if (window.AtaturkAdmin) {
      onAdminReady(window.AtaturkAdmin);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminOverviewModule);
  } else {
    initAdminOverviewModule();
  }
})(window, document);
