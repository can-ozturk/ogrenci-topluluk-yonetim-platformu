(function (window, document) {
  "use strict";

  var STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    SUSPENDED: "suspended"
  };

  var STATUS_LABELS = {
    pending: "Beklemede",
    approved: "Onaylı",
    rejected: "Reddedildi",
    suspended: "Askıya Alındı"
  };

  var VALID_AUTHORITIES = {
    "uyelik-yonetimi": {
      panel: "members",
      label: "Üyelik Yönetimi"
    },
    "muhasebe": {
      panel: "budget",
      label: "Bütçe Yönetimi (Muhasebe)"
    },
    "etkinlik-yonetimi": {
      panel: "events",
      label: "Etkinlik Yönetimi"
    }
  };

  function getAuthorityConfig(authorityVal) {
    var key = String(authorityVal || "").trim();
    return VALID_AUTHORITIES.hasOwnProperty(key) ? VALID_AUTHORITIES[key] : null;
  }

  function formatAuthorityLabel(authorityVal) {
    var cfg = getAuthorityConfig(authorityVal);
    return cfg ? cfg.label : "Yetki Atanmamış";
  }

  function canAccessMembersModule(authorityVal) {
    return String(authorityVal || "").trim() === "uyelik-yonetimi";
  }

  function canAccessEventsModule(authorityVal) {
    return String(authorityVal || "").trim() === "etkinlik-yonetimi";
  }

  var RESET_PASSWORD_WARNING =
    "Dikkat: Bu işlem sonucunda üyenin kayıtlı e-posta adresine şifre sıfırlama bağlantısı gönderilecek ve üye bu işlemden haberdar olacaktır. İşlemi başlatmadan önce üyenin bilgisinin olduğundan emin olun. Devam etmek istiyor musunuz?";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ACTION_ICONS = {
    reset: [
      "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
      "m22 6-10 7L2 6"
    ],
    delete: [
      "M3 6h18",
      "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
      "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    ]
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function makeIcon(paths) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", paths[i]);
      svg.appendChild(p);
    }
    return svg;
  }

  function toTurkishLower(val) {
    var s = String(val || "");
    try {
      return s.toLocaleLowerCase("tr-TR");
    } catch (e) {
      return s.toLowerCase();
    }
  }

  function toMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    var parsed = Date.parse(String(ts));
    return isNaN(parsed) ? 0 : parsed;
  }

  function formatDate(ts) {
    var ms = toMillis(ts);
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch (e) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function initialsOf(firstName, lastName, fallback) {
    var a = String(firstName || "").trim().charAt(0);
    var b = String(lastName || "").trim().charAt(0);
    var raw = (a + b) || String(fallback || "?").trim().charAt(0) || "?";
    try {
      return raw.toLocaleUpperCase("tr-TR");
    } catch (e) {
      return raw.toUpperCase();
    }
  }

  function fullNameOf(m) {
    var full = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return full || (m.username ? "@" + m.username : m.email || "Üye");
  }

  function strField(fields, key) {
    return fields && fields[key] && typeof fields[key].stringValue === "string"
      ? fields[key].stringValue
      : "";
  }

  function tsField(fields, key) {
    if (!fields || !fields[key]) return null;
    if (fields[key].timestampValue) return fields[key].timestampValue;
    if (fields[key].stringValue) return fields[key].stringValue;
    return null;
  }

  function fetchFirestoreDocRest(cfg, Auth, collection, docId, idToken) {
    var url =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/" +
      collection +
      "/" +
      encodeURIComponent(docId) +
      "?key=" +
      encodeURIComponent(cfg.apiKey);

    return window
      .fetch(url, {
        headers: idToken ? { Authorization: "Bearer " + idToken } : {}
      })
      .then(function (res) {
        if (res.status === 200) return res.json();
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  function isAuthorizedRole(roleVal) {
    var r = String(roleVal || "").trim().toLowerCase();
    return Boolean(r && r !== "member");
  }

  function fetchAdminRecord(cfg, Auth, session) {
    var uidKey = encodeURIComponent(session.uid);

    return Auth.rtdbRequest(cfg, "GET", "admins/" + uidKey, session.idToken)
      .catch(function () {
        return null;
      })
      .then(function (rtdbAdmin) {
        if (rtdbAdmin && typeof rtdbAdmin === "object") {
          var cleanEmail = String(
            rtdbAdmin.email || rtdbAdmin.eposta || session.email || ""
          ).toLowerCase();
          var cleanCreatedAt = rtdbAdmin.createdAt || new Date().toISOString();
          var authority = String(rtdbAdmin.authority || "").trim();
          var firstName = String(rtdbAdmin.firstName || "").trim();
          var lastName = String(rtdbAdmin.lastName || "").trim();
          var fullName =
            String(rtdbAdmin.fullName || "").trim() ||
            [firstName, lastName].filter(Boolean).join(" ");

          if (
            !rtdbAdmin.hasOwnProperty("authority") ||
            rtdbAdmin.hasOwnProperty("role") ||
            rtdbAdmin.hasOwnProperty("eposta") ||
            rtdbAdmin.hasOwnProperty("sifre") ||
            rtdbAdmin.hasOwnProperty("uid") ||
            rtdbAdmin.hasOwnProperty("yetki") ||
            rtdbAdmin.hasOwnProperty("durum")
          ) {
            var cleaned = {
              email: cleanEmail,
              authority: authority,
              createdAt: cleanCreatedAt
            };
            if (firstName) cleaned.firstName = firstName;
            if (lastName) cleaned.lastName = lastName;
            if (fullName) cleaned.fullName = fullName;
            Auth.rtdbRequest(cfg, "PUT", "admins/" + uidKey, session.idToken, cleaned).catch(
              function () {}
            );
          }

          return {
            displayName:
              fullName ||
              rtdbAdmin.displayName ||
              cleanEmail ||
              session.displayName ||
              "Yetkili",
            firstName: firstName,
            lastName: lastName,
            fullName: fullName,
            email: cleanEmail,
            authority: authority
          };
        }

        return fetchFirestoreDocRest(
          cfg,
          Auth,
          "admins",
          session.uid,
          session.idToken
        ).then(function (fsAdmin) {
          if (fsAdmin) {
            var af = fsAdmin.fields || {};
            var fsAuth = strField(af, "authority");
            var fsFirst = strField(af, "firstName");
            var fsLast = strField(af, "lastName");
            var fsFull =
              strField(af, "fullName") || [fsFirst, fsLast].filter(Boolean).join(" ");
            return {
              displayName:
                fsFull ||
                strField(af, "displayName") ||
                strField(af, "email") ||
                session.email ||
                "Yetkili",
              firstName: fsFirst,
              lastName: fsLast,
              fullName: fsFull,
              email: strField(af, "email") || session.email || "",
              authority: fsAuth
            };
          }
          return null;
        });
      });
  }

  function resolveOrBootstrapAdmin(cfg, Auth, session, emailVal) {
    var uidKey = encodeURIComponent(session.uid);

    return fetchAdminRecord(cfg, Auth, session).then(function (existingAdmin) {
      if (existingAdmin) {
        if (!getAuthorityConfig(existingAdmin.authority)) {
          return { state: "UNASSIGNED_AUTHORITY" };
        }
        return {
          state: "READY",
          displayName: existingAdmin.displayName,
          authority: existingAdmin.authority
        };
      }

      return Promise.all([
        Auth.rtdbRequest(cfg, "GET", "users/" + uidKey, session.idToken).catch(function () {
          return null;
        }),
        fetchFirestoreDocRest(cfg, Auth, "users", session.uid, session.idToken)
      ]).then(function (userChecks) {
        var rtdbUser = userChecks[0];
        var fsUser = userChecks[1];

        var isRegularMember =
          (rtdbUser && typeof rtdbUser === "object") ||
          Boolean(fsUser && fsUser.fields);

        if (isRegularMember) {
          return { state: "DENIED_MEMBER" };
        }

        var nowIso = new Date().toISOString();
        var cleanEmail = String(emailVal || session.email || "").toLowerCase();
        var adminPayload = {
          email: cleanEmail,
          authority: "",
          createdAt: nowIso
        };

        return Auth.rtdbRequest(
          cfg,
          "PUT",
          "admins/" + uidKey,
          session.idToken,
          adminPayload
        ).then(function () {
          return {
            state: "FIRST_LOGIN_REGISTERED",
            displayName: cleanEmail,
            authority: ""
          };
        });
      });
    });
  }

  function listMembersCombined(cfg, Auth, session) {
    var rtdbPromise = Auth.rtdbRequest(cfg, "GET", "users", session.idToken).catch(
      function () {
        return null;
      }
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/users?pageSize=300&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsPromise = window
      .fetch(fsUrl, { headers: { Authorization: "Bearer " + session.idToken } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      });

    return Promise.all([rtdbPromise, fsPromise]).then(function (results) {
      var rtdbData = results[0];
      var fsData = results[1];

      if (!rtdbData && !fsData) {
        return [];
      }

      var byUid = {};

      var fsDocs = (fsData && fsData.documents) || [];
      for (var i = 0; i < fsDocs.length; i++) {
        var doc = fsDocs[i];
        var parts = String(doc.name || "").split("/");
        var fUid = parts[parts.length - 1];
        var f = doc.fields || {};
        var fRole = strField(f, "role") || "member";
        if (isAuthorizedRole(fRole)) continue;

        byUid[fUid] = {
          uid: fUid,
          firstName: strField(f, "firstName"),
          lastName: strField(f, "lastName"),
          studentNumber: strField(f, "studentNumber"),
          department: strField(f, "department"),
          username: strField(f, "username"),
          email: strField(f, "email"),
          role: "member",
          status: strField(f, "status") || STATUS.PENDING,
          createdAt: tsField(f, "createdAt") || doc.createTime || null
        };
      }

      if (rtdbData && typeof rtdbData === "object") {
        var uids = Object.keys(rtdbData);
        for (var j = 0; j < uids.length; j++) {
          var rUid = uids[j];
          var u = rtdbData[rUid];
          if (!u || typeof u !== "object") continue;
          var rRole = u.role || "member";
          if (isAuthorizedRole(rRole)) {
            delete byUid[rUid];
            continue;
          }

          var prev = byUid[rUid] || {};
          byUid[rUid] = {
            uid: rUid,
            firstName: u.firstName || prev.firstName || "",
            lastName: u.lastName || prev.lastName || "",
            studentNumber: u.studentNumber || prev.studentNumber || "",
            department: u.department || prev.department || "",
            username: u.username || prev.username || "",
            email: u.email || prev.email || "",
            role: "member",
            status: u.status || prev.status || STATUS.PENDING,
            createdAt: u.createdAt || prev.createdAt || null
          };
        }
      }

      var finalList = [];
      var allKeys = Object.keys(byUid);
      for (var k = 0; k < allKeys.length; k++) {
        finalList.push(byUid[allKeys[k]]);
      }
      return finalList;
    });
  }

  function updateMemberStatusEverywhere(cfg, Auth, session, member, nextStatus) {
    var uidKey = encodeURIComponent(member.uid);
    var nowIso = new Date().toISOString();

    var rtdbRecord = {
      username: member.username || "",
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      studentNumber: member.studentNumber || "",
      department: member.department || "",
      email: member.email || "",
      role: "member",
      status: nextStatus,
      createdAt: member.createdAt || nowIso
    };

    var rtdbOp = Auth.rtdbRequest(
      cfg,
      "PUT",
      "users/" + uidKey,
      session.idToken,
      rtdbRecord
    );

    var root = Auth.firestoreRoot(cfg);
    var fsBody = {
      writes: [
        {
          update: {
            name: root + "/users/" + uidKey,
            fields: {
              status: { stringValue: nextStatus },
              statusUpdatedBy: { stringValue: session.uid }
            }
          },
          updateMask: {
            fieldPaths: ["status", "statusUpdatedBy"]
          },
          updateTransforms: [
            { fieldPath: "statusUpdatedAt", setToServerValue: "REQUEST_TIME" }
          ],
          currentDocument: { exists: true }
        }
      ]
    };

    var fsOp = window
      .fetch("https://firestore.googleapis.com/v1/" + root + ":commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.idToken
        },
        body: JSON.stringify(fsBody)
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]);
  }

  function deleteMemberEverywhere(cfg, Auth, session, member) {
    var uidKey = encodeURIComponent(member.uid);
    var ops = [
      Auth.rtdbRequest(cfg, "DELETE", "users/" + uidKey, session.idToken)
    ];

    if (member.username) {
      ops.push(
        Auth.rtdbRequest(
          cfg,
          "DELETE",
          "usernames/" + encodeURIComponent(member.username),
          session.idToken
        ).catch(function () {})
      );
    }
    if (member.studentNumber) {
      ops.push(
        Auth.rtdbRequest(
          cfg,
          "DELETE",
          "studentNumbers/" + encodeURIComponent(member.studentNumber),
          session.idToken
        ).catch(function () {})
      );
    }

    var root = Auth.firestoreRoot(cfg);
    var fsWrites = [{ delete: root + "/users/" + uidKey }];
    if (member.username) {
      fsWrites.push({
        delete: root + "/usernames/" + encodeURIComponent(member.username)
      });
    }
    if (member.studentNumber) {
      fsWrites.push({
        delete: root + "/studentNumbers/" + encodeURIComponent(member.studentNumber)
      });
    }

    ops.push(
      window
        .fetch("https://firestore.googleapis.com/v1/" + root + ":commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + session.idToken
          },
          body: JSON.stringify({ writes: fsWrites })
        })
        .catch(function () {})
    );

    return Promise.all(ops);
  }

  function initAdminLoginPage() {
    var form = byId("adminLoginForm");
    if (!form) return;

    var emailInput = byId("adminLoginEmail");
    var emailError = byId("adminLoginEmailError");
    var passwordInput = byId("adminLoginPassword");
    var passwordError = byId("adminLoginPasswordError");
    var submitBtn = byId("adminLoginSubmitBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;

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

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      UI.hideFormAlert();

      var emailVal = emailInput ? emailInput.value.trim() : "";
      var passVal = passwordInput ? passwordInput.value : "";

      var emailErr = Auth.validateEmail(emailVal);
      var passErr = Auth.validateLoginPassword(passVal);

      if (emailErr) UI.setFieldError(emailInput, emailError, emailErr);
      else UI.clearFieldError(emailInput, emailError, true);

      if (passErr) UI.setFieldError(passwordInput, passwordError, passErr);
      else UI.clearFieldError(passwordInput, passwordError, true);

      if (emailErr || passErr) {
        (emailErr ? emailInput : passwordInput).focus();
        return;
      }

      UI.setButtonLoading(submitBtn, true, "Yetki doğrulanıyor...", "Yetkili Girişi Yap");

      Auth.signInWithFirebase(FB, emailVal, passVal)
        .then(function (session) {
          return resolveOrBootstrapAdmin(cfg, Auth, session, emailVal).then(
            function (outcome) {

              if (outcome.state === "DENIED_MEMBER") {
                return Auth.signOutQuietly(FB).then(function () {
                  var denied = new Error("NOT_ADMIN");
                  denied.code = "custom/not-admin";
                  throw denied;
                });
              }

              if (outcome.state === "FIRST_LOGIN_REGISTERED") {
                return Auth.signOutQuietly(FB).then(function () {
                  UI.setButtonLoading(
                    submitBtn,
                    false,
                    "Yetki doğrulanıyor...",
                    "Yetkili Girişi Yap"
                  );
                  if (passwordInput) {
                    passwordInput.value = "";
                    UI.clearFieldError(passwordInput, passwordError, false);
                    passwordInput.focus();
                  }
                  UI.showFormAlert(
                    "Hesabınız onaylandı, lütfen tekrar giriş yapın. Yetki atamanız yapıldıktan sonra yönetim paneline erişebilirsiniz.",
                    "success",
                    "Onaylandı — Tekrar Giriş Yapın"
                  );
                });
              }

              if (outcome.state === "UNASSIGNED_AUTHORITY") {
                return Auth.signOutQuietly(FB).then(function () {
                  UI.setButtonLoading(
                    submitBtn,
                    false,
                    "Yetki doğrulanıyor...",
                    "Yetkili Girişi Yap"
                  );
                  if (passwordInput) {
                    passwordInput.value = "";
                    UI.clearFieldError(passwordInput, passwordError, false);
                  }
                  UI.showFormAlert(
                    "Hesabınıza henüz bir yetki atanmamıştır. Erişim için lütfen sistem yöneticisi ile iletişime geçin.",
                    "warning",
                    "Yetki Atanmamış"
                  );
                });
              }

              session.displayName = outcome.displayName || session.displayName;
              Auth.saveAuthSession(session);

              if (passwordInput) {
                passwordInput.value = "";
                UI.clearFieldError(passwordInput, passwordError, false);
              }
              UI.setButtonLoading(
                submitBtn,
                true,
                "Panele yönlendiriliyor...",
                "Yetkili Girişi Yap"
              );
              UI.showFormAlert(
                "Yetkili kimliği doğrulandı. Yönetim paneline yönlendiriliyorsunuz...",
                "success",
                "Giriş Başarılı"
              );
              window.setTimeout(function () {
                window.location.href = "./admin-dashboard.html";
              }, 550);
            },
            function (stepErr) {
              return Auth.signOutQuietly(FB).then(function () {
                throw stepErr;
              });
            }
          );
        })
        .catch(function (err) {
          UI.setButtonLoading(submitBtn, false, "Yetki doğrulanıyor...", "Yetkili Girişi Yap");

          if (err && err.code === "custom/not-admin") {
            if (passwordInput) {
              passwordInput.value = "";
              UI.clearFieldError(passwordInput, passwordError, false);
            }
            UI.showFormAlert(
              "Bu hesap standart bir üye hesabıdır ve yetkili erişimine sahip değildir. Üye Girişi ekranını kullanın.",
              "error",
              "Yetkisiz Erişim"
            );
            return;
          }

          var info = Auth.mapLoginErrorToTurkish(err);
          if (info.field === "email" && emailInput) {
            UI.setFieldError(emailInput, emailError, info.fieldMessage || info.message);
            emailInput.focus();
          } else if (info.field === "password" && passwordInput) {
            UI.setFieldError(passwordInput, passwordError, info.fieldMessage || info.message);
            passwordInput.focus();
          }
          UI.showFormAlert(info.message, "error", info.title);
        });
    });
  }

  function initAdminDashboardPage() {
    var shell = byId("adminShell");
    if (!shell) return;

    var gate = byId("adminGate");
    var adminNameEl = byId("adminName");
    var adminAvatarEl = byId("adminAvatar");
    var adminRoleEl = shell.querySelector(".admin-chip-role");
    var panelMembersEl = byId("panelMembers");
    var logoutBtn = byId("adminLogoutBtn");
    var searchInput = byId("memberSearch");
    var listEl = byId("memberList");
    var loadingEl = byId("memberLoading");
    var emptyEl = byId("memberEmpty");
    var emptyTextEl = byId("memberEmptyText");
    var metaEl = byId("membersMeta");
    var navPendingEl = byId("navPendingCount");
    var toastRegion = byId("toastRegion");

    var kpiTotal = byId("kpiTotal");
    var kpiPending = byId("kpiPending");
    var kpiApproved = byId("kpiApproved");
    var kpiSuspended = byId("kpiSuspended");

    var dialog = byId("confirmDialog");
    var dialogTitle = byId("confirmTitle");
    var dialogMessage = byId("confirmMessage");
    var dialogNote = byId("confirmNote");
    var dialogOkBtn = byId("confirmOkBtn");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;
    var auth = FB && FB.getAuth ? FB.getAuth() : null;

    var state = {
      session: null,
      adminUid: "",
      adminRole: "admin",
      members: [],
      byUid: {},
      filter: "all",
      query: "",
      busyUids: {},
      pollTimer: 0
    };

    function stopListeners() {
      if (state.pollTimer) {
        window.clearInterval(state.pollTimer);
        state.pollTimer = 0;
      }
    }

    function redirectToAdminLogin() {
      stopListeners();
      window.location.replace("./admin-login.html");
    }

    function showToast(text, kind) {
      if (!toastRegion) return;
      var item = document.createElement("div");
      item.className = "toast-item toast-item--" + (kind || "info");
      item.textContent = String(text || "");
      toastRegion.appendChild(item);

      window.setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 4200);
    }

    function confirmAction(opts) {
      if (!dialog || typeof dialog.showModal !== "function") {
        var plain = opts.title + "\n\n" + opts.message + (opts.note ? "\n\n" + opts.note : "");
        return Promise.resolve(window.confirm(plain));
      }

      dialog.setAttribute("data-tone", opts.tone || "warn");
      dialogTitle.textContent = String(opts.title || "İşlemi onaylayın");
      dialogMessage.textContent = String(opts.message || "");

      if (opts.note) {
        dialogNote.textContent = String(opts.note);
        dialogNote.removeAttribute("hidden");
      } else {
        dialogNote.textContent = "";
        dialogNote.setAttribute("hidden", "hidden");
      }

      dialogOkBtn.textContent = String(opts.confirmLabel || "Onayla");
      dialogOkBtn.className =
        "admin-btn " + (opts.tone === "danger" ? "admin-btn--danger" : "admin-btn--primary");

      return new Promise(function (resolve) {
        function onClose() {
          dialog.removeEventListener("close", onClose);
          resolve(dialog.returnValue === "confirm");
        }
        dialog.addEventListener("close", onClose);
        dialog.returnValue = "cancel";
        dialog.showModal();
      });
    }

    function updateCounts() {
      var counts = { all: state.members.length, pending: 0, approved: 0, suspended: 0, rejected: 0 };
      for (var i = 0; i < state.members.length; i++) {
        var st = state.members[i].status;
        if (counts.hasOwnProperty(st)) counts[st]++;
      }

      if (kpiTotal) kpiTotal.textContent = String(counts.all);
      if (kpiPending) kpiPending.textContent = String(counts.pending);
      if (kpiApproved) kpiApproved.textContent = String(counts.approved);
      if (kpiSuspended) kpiSuspended.textContent = String(counts.suspended);

      var badges = shell.querySelectorAll("[data-count]");
      for (var j = 0; j < badges.length; j++) {
        var key = badges[j].getAttribute("data-count");
        if (counts.hasOwnProperty(key)) {
          badges[j].textContent = String(counts[key]);
        }
      }

      if (navPendingEl) {
        if (counts.pending > 0) {
          navPendingEl.textContent = String(counts.pending);
          navPendingEl.removeAttribute("hidden");
        } else {
          navPendingEl.setAttribute("hidden", "hidden");
        }
      }
    }

    function matchesSearch(m, q) {
      if (!q) return true;
      var haystack = toTurkishLower(
        [m.firstName, m.lastName, m.username, m.email].filter(Boolean).join(" ")
      );
      return haystack.indexOf(q) !== -1;
    }

    function makeActionButton(action, uid, label, variant, title, iconKey) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-btn " + variant;
      btn.setAttribute("data-action", action);
      btn.setAttribute("data-uid", uid);
      if (title) {
        btn.title = title;
        btn.setAttribute("aria-label", title);
      }
      if (iconKey && ACTION_ICONS[iconKey]) {
        btn.appendChild(makeIcon(ACTION_ICONS[iconKey]));
      }
      if (label) {
        var span = document.createElement("span");
        span.textContent = label;
        btn.appendChild(span);
      }
      return btn;
    }

    function buildMemberRow(m) {
      var li = document.createElement("li");
      li.className = "member-row" + (state.busyUids[m.uid] ? " is-busy" : "");
      li.setAttribute("data-uid", m.uid);

      var idCell = document.createElement("div");
      idCell.className = "member-cell member-cell--identity";

      var avatar = document.createElement("span");
      avatar.className = "member-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = initialsOf(m.firstName, m.lastName, m.username || m.email);

      var idText = document.createElement("div");
      idText.className = "member-identity-text";

      var nameEl = document.createElement("p");
      nameEl.className = "member-name";
      nameEl.textContent = fullNameOf(m);

      var subParts = [];
      if (m.username) subParts.push("@" + m.username);
      if (m.studentNumber) subParts.push(m.studentNumber);
      if (m.department) subParts.push(m.department);

      var subEl = document.createElement("p");
      subEl.className = "member-sub";
      subEl.textContent = subParts.join(" · ") || "—";

      idText.appendChild(nameEl);
      idText.appendChild(subEl);
      idCell.appendChild(avatar);
      idCell.appendChild(idText);

      var emailCell = document.createElement("div");
      emailCell.className = "member-cell member-cell--email";
      emailCell.textContent = m.email || "—";

      var dateCell = document.createElement("div");
      dateCell.className = "member-cell member-cell--date";
      dateCell.textContent = formatDate(m.createdAt);

      var statusCell = document.createElement("div");
      statusCell.className = "member-cell member-cell--status";
      var known = STATUS_LABELS.hasOwnProperty(m.status);
      var badge = document.createElement("span");
      badge.className = "status-badge status-badge--" + (known ? m.status : "unknown");
      badge.textContent = known ? STATUS_LABELS[m.status] : "Tanımsız";
      statusCell.appendChild(badge);

      var actionsCell = document.createElement("div");
      actionsCell.className = "member-cell member-cell--actions";
      var who = fullNameOf(m);

      if (m.status === STATUS.PENDING) {
        actionsCell.appendChild(
          makeActionButton("approve", m.uid, "Onayla", "admin-btn--approve", who + " başvurusunu onayla")
        );
        actionsCell.appendChild(
          makeActionButton("reject", m.uid, "Reddet", "admin-btn--reject", who + " başvurusunu reddet")
        );
      } else if (m.status === STATUS.APPROVED) {
        actionsCell.appendChild(
          makeActionButton("suspend", m.uid, "Askıya Al", "admin-btn--warn", who + " hesabını askıya al")
        );
      } else if (m.status === STATUS.SUSPENDED) {
        actionsCell.appendChild(
          makeActionButton("unsuspend", m.uid, "Askıyı Kaldır", "admin-btn--approve", who + " hesabının askısını kaldır")
        );
      } else {
        actionsCell.appendChild(
          makeActionButton("approve", m.uid, "Onayla", "admin-btn--approve", who + " üyeliğini onayla")
        );
      }

      if (m.email) {
        actionsCell.appendChild(
          makeActionButton(
            "reset-password",
            m.uid,
            "",
            "admin-btn--ghost admin-btn--icon",
            who + " için şifre sıfırlama e-postası gönder",
            "reset"
          )
        );
      }

      actionsCell.appendChild(
        makeActionButton(
          "delete",
          m.uid,
          "",
          "admin-btn--danger admin-btn--icon",
          who + " üyelik kaydını sil",
          "delete"
        )
      );

      li.appendChild(idCell);
      li.appendChild(emailCell);
      li.appendChild(dateCell);
      li.appendChild(statusCell);
      li.appendChild(actionsCell);
      return li;
    }

    function renderList() {
      if (!listEl) return;
      var q = toTurkishLower(state.query.trim());

      var filtered = state.members.filter(function (m) {
        if (state.filter !== "all" && m.status !== state.filter) return false;
        return matchesSearch(m, q);
      });

      listEl.textContent = "";
      var frag = document.createDocumentFragment();
      for (var i = 0; i < filtered.length; i++) {
        frag.appendChild(buildMemberRow(filtered[i]));
      }
      listEl.appendChild(frag);

      if (metaEl) {
        metaEl.textContent =
          state.members.length === filtered.length
            ? "Toplam " + state.members.length + " üye (en yeni kayıtlar üstte)."
            : state.members.length + " üyeden " + filtered.length + " eşleşme gösteriliyor.";
      }

      if (emptyEl && emptyTextEl) {
        if (filtered.length === 0) {
          emptyTextEl.textContent =
            state.members.length === 0
              ? "Henüz kayıtlı bir üye başvurusu bulunmuyor."
              : "Arama veya filtre ölçütlerine uyan üye bulunamadı.";
          emptyEl.removeAttribute("hidden");
        } else {
          emptyEl.setAttribute("hidden", "hidden");
        }
      }
    }

    function applyMemberList(list) {
      list.sort(function (a, b) {
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });

      var map = {};
      for (var i = 0; i < list.length; i++) {
        map[list[i].uid] = list[i];
      }

      state.members = list;
      state.byUid = map;

      if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
      UI.hideFormAlert();
      updateCounts();
      renderList();
    }

    function refreshMembers() {
      if (!state.session || !canAccessMembersModule(state.adminRole)) {
        return Promise.resolve();
      }
      return listMembersCombined(cfg, Auth, state.session)
        .then(applyMemberList)
        .catch(function (err) {
          if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
          Auth.logTechnicalError("Üye Listesi", err);
          UI.showFormAlert(
            "Üye listesi şu anda yüklenemiyor. Lütfen sayfayı yenileyin veya sistem sorumlusuna başvurun.",
            "error",
            "Bilinmeyen Hata"
          );
        });
    }

    function setRowBusy(uid, isBusy) {
      if (isBusy) state.busyUids[uid] = true;
      else delete state.busyUids[uid];
      var row = listEl ? listEl.querySelector('[data-uid="' + uid + '"]') : null;
      if (row) {
        if (isBusy) row.classList.add("is-busy");
        else row.classList.remove("is-busy");
      }
    }

    function updateMemberStatus(member, nextStatus, successText) {
      setRowBusy(member.uid, true);
      updateMemberStatusEverywhere(cfg, Auth, state.session, member, nextStatus)
        .then(function () {
          setRowBusy(member.uid, false);
          member.status = nextStatus;
          updateCounts();
          renderList();
          showToast(successText, "success");
        })
        .catch(function (err) {
          setRowBusy(member.uid, false);
          Auth.logTechnicalError("Üye Durum Güncelleme", err);
          showToast("Durum güncellenemedi. Lütfen tekrar deneyin.", "error");
        });
    }

    function triggerPasswordReset(member) {
      if (!member.email) return;
      confirmAction({
        title: "Şifre Sıfırlama Bağlantısı Gönder",
        message: RESET_PASSWORD_WARNING,
        note: "Alıcı: " + fullNameOf(member) + " (" + member.email + ")",
        confirmLabel: "Bağlantıyı Gönder",
        tone: "warn"
      }).then(function (ok) {
        if (!ok) return;
        setRowBusy(member.uid, true);

        var sendOp =
          auth && !FB.isFileProtocol
            ? auth.sendPasswordResetEmail(member.email)
            : Auth.firebaseRestAuth(
                "sendOobCode",
                { requestType: "PASSWORD_RESET", email: member.email },
                cfg.apiKey
              );

        Promise.resolve(sendOp)
          .then(function () {
            setRowBusy(member.uid, false);
            showToast(member.email + " adresine şifre sıfırlama bağlantısı gönderildi.", "success");
          })
          .catch(function (err) {
            setRowBusy(member.uid, false);
            Auth.logTechnicalError("Şifre Sıfırlama", err);
            showToast("Şifre sıfırlama e-postası gönderilemedi.", "error");
          });
      });
    }

    function deleteMemberRecord(member) {
      var who = fullNameOf(member);
      confirmAction({
        title: "Üyelik Kaydını Kalıcı Olarak Sil",
        message:
          who +
          " adlı üyenin profil kaydı (users/" +
          member.uid +
          ") silinecek; ayrılmış kullanıcı adı (" +
          (member.username ? "@" + member.username : "—") +
          ") ve öğrenci numarası (" +
          (member.studentNumber || "—") +
          ") serbest bırakılacaktır. Bu işlem geri alınamaz.",
        note:
          "Teknik not: E-posta/şifre oturum kaydı (Firebase Authentication) istemci SDK ile silinemez; aynı e-posta adresinin yeniden kayıt olabilmesi için Firebase Console → Authentication → Users bölümünden de silinmesi gerekir.",
        confirmLabel: "Üyeliği Sil",
        tone: "danger"
      }).then(function (ok) {
        if (!ok) return;
        setRowBusy(member.uid, true);

        deleteMemberEverywhere(cfg, Auth, state.session, member)
          .then(function () {
            delete state.busyUids[member.uid];
            delete state.byUid[member.uid];
            state.members = state.members.filter(function (item) {
              return item.uid !== member.uid;
            });
            updateCounts();
            renderList();
            showToast(who + " üyelik kaydı silindi.", "success");
          })
          .catch(function (err) {
            setRowBusy(member.uid, false);
            Auth.logTechnicalError("Üyelik Silme", err);
            showToast("Üyelik kaydı silinemedi. Lütfen tekrar deneyin.", "error");
          });
      });
    }

    function handleRowAction(action, uid) {
      if (!canAccessMembersModule(state.adminRole)) {
        showToast("Bu işlem için 'uyelik-yonetimi' yetkisi gereklidir.", "error");
        return;
      }
      var member = state.byUid[uid];
      if (!member || state.busyUids[uid]) return;
      var who = fullNameOf(member);

      if (action === "approve") {
        updateMemberStatus(member, STATUS.APPROVED, who + " üyeliği onaylandı.");
        return;
      }

      if (action === "reject") {
        updateMemberStatus(member, STATUS.REJECTED, who + " başvurusu reddedildi.");
        return;
      }

      if (action === "suspend") {
        confirmAction({
          title: "Hesabı Askıya Al",
          message:
            who +
            " adlı üyenin hesabı askıya alınacak. Üye giriş yapmaya çalıştığında hesabının askıya alındığına dair uyarı görecek ve panele erişemeyecektir.",
          confirmLabel: "Askıya Al",
          tone: "warn"
        }).then(function (ok) {
          if (ok) updateMemberStatus(member, STATUS.SUSPENDED, who + " hesabı askıya alındı.");
        });
        return;
      }

      if (action === "unsuspend") {
        confirmAction({
          title: "Hesap Askısını Kaldır",
          message:
            who +
            " adlı üyenin hesabı yeniden “Onaylı” durumuna geçirilecek ve üye tekrar giriş yapabilecektir.",
          confirmLabel: "Askıyı Kaldır",
          tone: "warn"
        }).then(function (ok) {
          if (ok) updateMemberStatus(member, STATUS.APPROVED, who + " hesabının askısı kaldırıldı.");
        });
        return;
      }

      if (action === "reset-password") {
        triggerPasswordReset(member);
        return;
      }

      if (action === "delete") {
        deleteMemberRecord(member);
      }
    }

    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("button[data-action]") : null;
        if (!btn) return;
        handleRowAction(btn.getAttribute("data-action"), btn.getAttribute("data-uid"));
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.query = searchInput.value || "";
        renderList();
      });
    }

    var filterBtns = shell.querySelectorAll(".filter-pill[data-filter]");
    for (var i = 0; i < filterBtns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          state.filter = btn.getAttribute("data-filter") || "all";
          for (var k = 0; k < filterBtns.length; k++) {
            var active = filterBtns[k] === btn;
            filterBtns[k].classList.toggle("is-active", active);
            filterBtns[k].setAttribute("aria-pressed", active ? "true" : "false");
          }
          renderList();
        });
      })(filterBtns[i]);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        UI.setButtonLoading(logoutBtn, true, "Çıkış yapılıyor...", "Çıkış Yap");
        stopListeners();
        Auth.signOutQuietly(FB).then(function () {
          window.location.replace("./admin-login.html");
        });
      });
    }

    var viewTitleEl = byId("adminViewTitle");
    var panelOverviewEl = byId("panelOverview");
    var panelBudgetEl = byId("panelBudget");
    var panelEventsEl = byId("panelEvents");
    var PANEL_TITLES = {
      overview: "Genel Bakış",
      members: "Üyelik Yönetimi",
      budget: "Bütçe Yönetimi",
      events: "Etkinlik Yönetimi"
    };
    var allowedPanel = "";
    var activePanel = "";

    function enforceStrictModuleIsolation(authority) {
      var authCfg = getAuthorityConfig(authority);
      allowedPanel = authCfg ? authCfg.panel : "";

      var authItems = shell.querySelectorAll(".sidebar-nav li[data-authority]");
      for (var ai = 0; ai < authItems.length; ai++) {
        var li = authItems[ai];
        if (li.getAttribute("data-authority") === authority) {
          li.removeAttribute("hidden");
        } else if (li.parentNode) {
          li.parentNode.removeChild(li);
        }
      }

      var panelMap = {
        members: panelMembersEl,
        budget: panelBudgetEl,
        events: panelEventsEl
      };
      var keys = Object.keys(panelMap);
      for (var pi = 0; pi < keys.length; pi++) {
        var pKey = keys[pi];
        var pEl = panelMap[pKey];
        if (pKey !== allowedPanel && pEl && pEl.parentNode) {
          pEl.parentNode.removeChild(pEl);
        }
      }
    }

    function switchAdminPanel(panelKey) {

      var target = panelKey === "overview" ? "overview" : allowedPanel;
      if (!target) return;
      activePanel = target;

      var navButtons = shell.querySelectorAll(".nav-item[data-panel]");
      for (var n = 0; n < navButtons.length; n++) {
        var isTarget = navButtons[n].getAttribute("data-panel") === target;
        navButtons[n].classList.toggle("is-active", isTarget);
        if (isTarget) {
          navButtons[n].setAttribute("aria-current", "page");
        } else {
          navButtons[n].removeAttribute("aria-current");
        }
      }

      if (viewTitleEl) {
        viewTitleEl.textContent = PANEL_TITLES[target] || "Yetkili Paneli";
      }

      UI.hideFormAlert();
      if (panelOverviewEl) panelOverviewEl.setAttribute("hidden", "hidden");
      if (panelMembersEl && panelMembersEl.parentNode) panelMembersEl.setAttribute("hidden", "hidden");
      if (panelBudgetEl && panelBudgetEl.parentNode) panelBudgetEl.setAttribute("hidden", "hidden");
      if (panelEventsEl && panelEventsEl.parentNode) panelEventsEl.setAttribute("hidden", "hidden");

      if (target === "overview") {
        if (panelOverviewEl) panelOverviewEl.removeAttribute("hidden");
        return;
      }

      if (target === "members" && canAccessMembersModule(state.adminRole)) {
        if (panelMembersEl) panelMembersEl.removeAttribute("hidden");
        refreshMembers();
        return;
      }

      if (target === "budget" && state.adminRole === "muhasebe") {
        if (panelBudgetEl) panelBudgetEl.removeAttribute("hidden");
        if (window.AtaturkBudget && typeof window.AtaturkBudget.refresh === "function") {
          window.AtaturkBudget.refresh();
        }
        return;
      }

      if (target === "events" && canAccessEventsModule(state.adminRole)) {
        if (panelEventsEl) panelEventsEl.removeAttribute("hidden");
        if (window.AtaturkEvents && typeof window.AtaturkEvents.refresh === "function") {
          window.AtaturkEvents.refresh();
        }
      }
    }

    var navRoot = shell.querySelector(".sidebar-nav");
    if (navRoot) {
      navRoot.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".nav-item[data-panel]") : null;
        if (!btn) return;
        var targetPanel = btn.getAttribute("data-panel");
        if (targetPanel) switchAdminPanel(targetPanel);
      });
    }

    function updateAdminHeader(firstName, lastName, fallbackEmail) {
      var full = [firstName, lastName].filter(Boolean).join(" ").trim();
      var label = full || fallbackEmail || "Yetkili";
      if (adminNameEl) adminNameEl.textContent = label;
      if (adminAvatarEl) {
        adminAvatarEl.textContent = initialsOf(firstName || label, lastName || "", "Y");
      }
      if (window.AtaturkAdmin) {
        window.AtaturkAdmin.firstName = firstName || "";
        window.AtaturkAdmin.lastName = lastName || "";
        window.AtaturkAdmin.fullName = full;
        window.AtaturkAdmin.displayName = label;
      }
    }

    function activateDashboard(session) {
      fetchAdminRecord(cfg, Auth, session)
        .then(function (adminInfo) {

          var authCfg = adminInfo ? getAuthorityConfig(adminInfo.authority) : null;
          if (!adminInfo || !authCfg) {
            return Auth.signOutQuietly(FB).then(redirectToAdminLogin);
          }

          state.session = session;
          state.adminUid = session.uid;
          state.adminRole = adminInfo.authority;
          Auth.saveAuthSession(session);

          var authorityLabel = formatAuthorityLabel(state.adminRole);
          var displayLabel =
            adminInfo.fullName ||
            adminInfo.displayName ||
            session.displayName ||
            session.email ||
            "Yetkili";

          if (adminNameEl) adminNameEl.textContent = displayLabel;
          if (adminAvatarEl) {
            adminAvatarEl.textContent = initialsOf(
              adminInfo.firstName || displayLabel,
              adminInfo.lastName || "",
              "Y"
            );
          }
          if (adminRoleEl) adminRoleEl.textContent = authorityLabel;

          enforceStrictModuleIsolation(state.adminRole);

          if (gate) gate.setAttribute("hidden", "hidden");
          shell.removeAttribute("hidden");

          window.AtaturkAdmin = {
            session: session,
            adminUid: state.adminUid,
            adminRole: state.adminRole,
            authority: state.adminRole,
            roleLabel: authorityLabel,
            email: adminInfo.email || session.email || "",
            firstName: adminInfo.firstName || "",
            lastName: adminInfo.lastName || "",
            fullName: adminInfo.fullName || "",
            displayName: displayLabel,
            showToast: showToast,
            confirmAction: confirmAction,
            updateAdminHeader: updateAdminHeader,
            canAccessEventsModule: canAccessEventsModule
          };

          if (window.AtaturkOverview && typeof window.AtaturkOverview.onAdminReady === "function") {
            window.AtaturkOverview.onAdminReady(window.AtaturkAdmin);
          }
          if (
            canAccessEventsModule(state.adminRole) &&
            window.AtaturkEvents &&
            typeof window.AtaturkEvents.onAdminReady === "function"
          ) {
            window.AtaturkEvents.onAdminReady(window.AtaturkAdmin);
          }
          if (
            state.adminRole === "muhasebe" &&
            window.AtaturkBudget &&
            typeof window.AtaturkBudget.onAdminReady === "function"
          ) {
            window.AtaturkBudget.onAdminReady(window.AtaturkAdmin);
          }

          switchAdminPanel(authCfg.panel);

          if (canAccessMembersModule(state.adminRole) && !state.pollTimer) {
            state.pollTimer = window.setInterval(function () {
              if (activePanel === "members") refreshMembers();
            }, 10000);
          }
        })
        .catch(function (err) {
          Auth.logTechnicalError("Yetkili Doğrulama", err);
          Auth.signOutQuietly(FB).then(redirectToAdminLogin);
        });
    }

    function bootstrapSession(sdkUser) {
      if (sdkUser) {
        sdkUser
          .getIdToken()
          .then(function (token) {
            activateDashboard({
              uid: sdkUser.uid,
              email: sdkUser.email || "",
              displayName: sdkUser.displayName || "",
              idToken: token
            });
          })
          .catch(function (err) {
            Auth.logTechnicalError("Yetkili Oturumu", err);
            redirectToAdminLogin();
          });
        return;
      }

      var saved = Auth.loadAuthSession();
      if (saved && saved.uid && saved.idToken) {
        activateDashboard(saved);
        return;
      }

      redirectToAdminLogin();
    }

    if (auth && !FB.isFileProtocol) {
      auth.onAuthStateChanged(bootstrapSession);
    } else {
      bootstrapSession(null);
    }
  }

  function initAll() {
    initAdminLoginPage();
    initAdminDashboardPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})(window, document);
