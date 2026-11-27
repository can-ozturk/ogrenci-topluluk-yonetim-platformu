(function (window, document) {
  "use strict";

  var ATATURK_QUOTES = [
    "Hayatta en hakiki mürşit ilimdir, fendir.",
    "Bütün ümidim gençliktedir.",
    "Yurtta sulh, cihanda sulh.",
    "Egemenlik kayıtsız şartsız milletindir.",
    "Dinlenmemek üzere yürümeye karar verenler, asla ve asla yorulmazlar."
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function getTodayIsoDate() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1);
    var d = String(now.getDate());
    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;
    return y + "-" + m + "-" + d;
  }

  function parseTimestampToDate(raw) {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
    if (typeof raw.toDate === "function") return raw.toDate();
    if (typeof raw.toMillis === "function") return new Date(raw.toMillis());
    if (typeof raw.seconds === "number") return new Date(raw.seconds * 1000);
    if (typeof raw === "number") {
      var fromNum = new Date(raw);
      return isNaN(fromNum.getTime()) ? null : fromNum;
    }
    var ms = Date.parse(String(raw));
    return isNaN(ms) ? null : new Date(ms);
  }

  function formatMembershipDuration(createdDate) {
    if (!createdDate) return "Üyelik süresi hesaplanamadı";
    var now = new Date();
    var start = new Date(
      createdDate.getFullYear(),
      createdDate.getMonth(),
      createdDate.getDate()
    );
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    var diffDays = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return "Bugün katıldı";
    if (diffDays < 30) return diffDays + " gündür üye";

    var totalMonths =
      (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth());

    var anchor = new Date(start.getFullYear(), start.getMonth() + totalMonths, start.getDate());
    if (anchor.getTime() > today.getTime()) {
      totalMonths -= 1;
      anchor = new Date(start.getFullYear(), start.getMonth() + totalMonths, start.getDate());
    }

    var remDays = Math.max(
      0,
      Math.floor((today.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000))
    );

    if (totalMonths >= 12) {
      var years = Math.floor(totalMonths / 12);
      var months = totalMonths % 12;
      if (months > 0) return years + " yıl " + months + " aydır üye";
      return years + " yıldır üye";
    }

    if (totalMonths > 0) {
      if (remDays > 0) return totalMonths + " ay " + remDays + " gündür üye";
      return totalMonths + " aydır üye";
    }

    return diffDays + " gündür üye";
  }

  function formatTurkishDate(dt) {
    if (!dt) return "—";
    try {
      return dt.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return dt.toISOString().slice(0, 10);
    }
  }

  function formatTurkishEventDate(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) {
      return String(isoDate || "—");
    }
    var p = String(isoDate).split("-");
    return formatTurkishDate(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  }

  function initialsOf(firstName, lastName, fallback) {
    var a = String(firstName || "").trim().charAt(0);
    var b = String(lastName || "").trim().charAt(0);
    var raw = (a + b) || String(fallback || "Ü").trim().charAt(0) || "Ü";
    try {
      return raw.toLocaleUpperCase("tr-TR");
    } catch (e) {
      return raw.toUpperCase();
    }
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

  function validateNewPassword(rawVal) {
    var val = String(rawVal || "");
    if (!val) return "Yeni şifre alanı zorunludur.";
    if (val.length < 8) return "Yeni şifreniz en az 8 karakter uzunluğunda olmalıdır.";
    if (!/[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(val) || !/[0-9]/.test(val)) {
      return "Yeni şifreniz en az 1 harf ve 1 rakam içermelidir.";
    }
    return "";
  }

  function initMemberTypewriter() {
    var inner = byId("memberTypewriterText");
    var cursor = byId("memberTypewriterCursor");
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

    function typeNext() {
      var phrase = ATATURK_QUOTES[index];
      if (typed < phrase.length) {
        setBlinking(false);
        var span = document.createElement("span");
        span.className = "tw-char";
        span.textContent = phrase.charAt(typed);
        inner.insertBefore(span, cursor);
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
        var last = cursor ? cursor.previousSibling : inner.lastChild;
        if (last) inner.removeChild(last);
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

  function fetchMemberProfile(cfg, Auth, session) {
    return Auth.rtdbRequest(
      cfg,
      "GET",
      "users/" + encodeURIComponent(session.uid),
      session.idToken
    )
      .then(function (u) {
        if (u && typeof u === "object") {
          return {
            uid: session.uid,
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            username: u.username || "",
            email: u.email || session.email || "",
            role: u.role || "member",
            status: u.status || "",
            createdAt: u.createdAt || null
          };
        }
        return null;
      })
      .catch(function () {
        return null;
      })
      .then(function (fromRtdb) {
        if (fromRtdb) return fromRtdb;

        var url =
          "https://firestore.googleapis.com/v1/" +
          Auth.firestoreRoot(cfg) +
          "/users/" +
          encodeURIComponent(session.uid) +
          "?key=" +
          encodeURIComponent(cfg.apiKey);

        return window
          .fetch(url, { headers: { Authorization: "Bearer " + session.idToken } })
          .then(function (res) {
            return res.ok ? res.json() : null;
          })
          .then(function (doc) {
            if (!doc || !doc.fields) return null;
            var f = doc.fields;
            return {
              uid: session.uid,
              firstName: strField(f, "firstName"),
              lastName: strField(f, "lastName"),
              username: strField(f, "username"),
              email: strField(f, "email") || session.email || "",
              role: strField(f, "role") || "member",
              status: strField(f, "status"),
              createdAt: tsField(f, "createdAt") || doc.createTime || null
            };
          })
          .catch(function () {
            return null;
          });
      });
  }

  function fetchAnnouncements(cfg, Auth, session) {
    var rtdbOp = Auth.rtdbRequest(cfg, "GET", "announcements", session.idToken).catch(
      function () {
        return null;
      }
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/announcements?pageSize=20&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsOp = window
      .fetch(fsUrl, { headers: { Authorization: "Bearer " + session.idToken } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      });

    return Promise.all([rtdbOp, fsOp]).then(function (results) {
      var rtdbData = results[0];
      var fsData = results[1];
      var byIdMap = {};

      var fsDocs = (fsData && fsData.documents) || [];
      for (var i = 0; i < fsDocs.length; i++) {
        var doc = fsDocs[i];
        var parts = String(doc.name || "").split("/");
        var id = parts[parts.length - 1];
        var f = doc.fields || {};
        byIdMap[id] = {
          id: id,
          title: strField(f, "title") || "Duyuru",
          content: strField(f, "content") || strField(f, "description") || "",
          createdAt: tsField(f, "createdAt") || doc.createTime || ""
        };
      }

      if (rtdbData && typeof rtdbData === "object") {
        var keys = Object.keys(rtdbData);
        for (var j = 0; j < keys.length; j++) {
          var k = keys[j];
          var a = rtdbData[k];
          if (!a || typeof a !== "object") continue;
          byIdMap[k] = {
            id: k,
            title: a.title || "Duyuru",
            content: a.content || a.description || "",
            createdAt: a.createdAt || ""
          };
        }
      }

      var list = [];
      var allIds = Object.keys(byIdMap);
      for (var n = 0; n < allIds.length; n++) {
        list.push(byIdMap[allIds[n]]);
      }

      list.sort(function (x, y) {
        var dx = parseTimestampToDate(x.createdAt);
        var dy = parseTimestampToDate(y.createdAt);
        return (dy ? dy.getTime() : 0) - (dx ? dx.getTime() : 0);
      });

      return list.slice(0, 5);
    });
  }

  function fetchPublishedEvents(cfg, Auth, session) {
    var rtdbOp = Auth.rtdbRequest(cfg, "GET", "events", session.idToken).catch(
      function () {
        return null;
      }
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/events?pageSize=200&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsOp = window
      .fetch(fsUrl, { headers: { Authorization: "Bearer " + session.idToken } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      });

    return Promise.all([rtdbOp, fsOp]).then(function (results) {
      var rtdbData = results[0];
      var fsData = results[1];
      var byIdMap = {};

      var fsDocs = (fsData && fsData.documents) || [];
      for (var i = 0; i < fsDocs.length; i++) {
        var doc = fsDocs[i];
        var parts = String(doc.name || "").split("/");
        var eid = parts[parts.length - 1];
        var f = doc.fields || {};
        byIdMap[eid] = {
          id: eid,
          title: strField(f, "title"),
          description: strField(f, "description"),
          creatorName: strField(f, "creatorName"),
          eventDate: strField(f, "eventDate"),
          photoUrl: strField(f, "photoUrl"),
          createdAt: tsField(f, "createdAt") || doc.createTime || "",
          responses: {}
        };
      }

      if (rtdbData && typeof rtdbData === "object") {
        var keys = Object.keys(rtdbData);
        for (var j = 0; j < keys.length; j++) {
          var k = keys[j];
          var item = rtdbData[k];
          if (!item || typeof item !== "object") continue;
          var prev = byIdMap[k] || {};
          byIdMap[k] = {
            id: k,
            title: item.title || prev.title || "",
            description: item.description || prev.description || "",
            creatorName: item.creatorName || prev.creatorName || "",
            eventDate: item.eventDate || prev.eventDate || "",
            photoUrl: item.photoUrl || prev.photoUrl || "",
            createdAt: item.createdAt || prev.createdAt || "",
            responses:
              item.responses && typeof item.responses === "object"
                ? item.responses
                : prev.responses || {}
          };
        }
      }

      var list = [];
      var allIds = Object.keys(byIdMap);
      for (var m = 0; m < allIds.length; m++) {
        list.push(byIdMap[allIds[m]]);
      }

      list.sort(function (a, b) {
        return (Date.parse(String(b.createdAt || "")) || 0) - (Date.parse(String(a.createdAt || "")) || 0);
      });

      return list;
    });
  }

  function saveMemberRsvp(cfg, Auth, session, profile, eventId, status) {
    var fullName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
      (profile.username ? "@" + profile.username : profile.email || "Üye");

    var payload = {
      uid: session.uid,
      fullName: fullName,
      username: profile.username || "",
      email: profile.email || session.email || "",
      status: status,
      updatedAt: new Date().toISOString()
    };

    var idKey = encodeURIComponent(eventId);
    var uidKey = encodeURIComponent(session.uid);

    var rtdbOp = Auth.rtdbRequest(
      cfg,
      "PUT",
      "events/" + idKey + "/responses/" + uidKey,
      session.idToken,
      payload
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/events/" +
      idKey +
      "/responses/" +
      uidKey +
      "?key=" +
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
            uid: { stringValue: payload.uid },
            fullName: { stringValue: payload.fullName },
            username: { stringValue: payload.username },
            email: { stringValue: payload.email },
            status: { stringValue: payload.status },
            updatedAt: { timestampValue: payload.updatedAt }
          }
        })
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]).then(function () {
      return payload;
    });
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
          if (updatedData.refreshToken) session.refreshToken = updatedData.refreshToken;
          Auth.saveAuthSession(session);
        }
      });
  }

  function mapPasswordError(Auth, err) {
    var code = err && err.code ? String(err.code) : "";
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials"
    ) {
      return {
        field: "current",
        message: "Girdiğiniz mevcut şifre yanlış. Lütfen kontrol edip tekrar deneyin."
      };
    }
    if (code === "auth/weak-password") {
      return {
        field: "new",
        message:
          "Seçtiğiniz yeni şifre yeterince güçlü değil. En az 8 karakter, 1 harf ve 1 rakam kullanın."
      };
    }
    if (code === "auth/requires-recent-login") {
      return {
        field: "",
        message:
          "Güvenliğiniz için oturumunuzun tazelenmesi gerekiyor. Lütfen çıkış yapıp tekrar giriş yaptıktan sonra şifrenizi değiştirin."
      };
    }
    if (code === "auth/too-many-requests") {
      return {
        field: "",
        message: "Çok fazla başarısız deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin."
      };
    }
    Auth.logTechnicalError("Üye Şifre Değiştirme", err);
    return {
      field: "",
      message: "Şifre güncelleme işlemi şu anda gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyin."
    };
  }

  function initMemberDashboard() {
    var shell = byId("memberShell");
    if (!shell) return;

    var gate = byId("memberGate");
    var viewTitleEl = byId("memberViewTitle");
    var memberNameEl = byId("memberName");
    var memberAvatarEl = byId("memberAvatar");
    var logoutBtn = byId("memberLogoutBtn");
    var toastRegion = byId("memberToastRegion");

    var panelOverview = byId("panelMemberOverview");
    var panelEvents = byId("panelMemberEvents");
    var sidebarNav = byId("memberSidebarNav");
    var navEventsCount = byId("navMemberEventsCount");

    var welcomeTitleEl = byId("memberWelcomeTitle");
    var durationValueEl = byId("memberDurationValue");
    var joinedDateEl = byId("memberJoinedDate");
    var fullNameValEl = byId("memberFullNameValue");
    var usernameValEl = byId("memberUsernameValue");
    var emailValEl = byId("memberEmailValue");
    var roleValEl = byId("memberRoleValue");

    var announcementsLoading = byId("announcementsLoading");
    var announcementsList = byId("memberAnnouncementsList");
    var announcementsEmpty = byId("announcementsEmpty");

    var passwordForm = byId("memberPasswordForm");
    var currentPwInput = byId("memberCurrentPassword");
    var currentPwError = byId("memberCurrentPasswordError");
    var newPwInput = byId("memberNewPassword");
    var newPwError = byId("memberNewPasswordError");
    var confirmPwInput = byId("memberConfirmPassword");
    var confirmPwError = byId("memberConfirmPasswordError");
    var passwordSubmitBtn = byId("memberPasswordSubmitBtn");

    var eventsLoading = byId("memberEventsLoading");
    var eventListEl = byId("memberEventList");
    var eventsEmpty = byId("memberEventsEmpty");
    var eventsMetaEl = byId("memberEventsMeta");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;
    var auth = FB && FB.getAuth ? FB.getAuth() : null;

    var state = {
      session: null,
      profile: null,
      events: [],
      eventsById: {},
      busyEventIds: {}
    };

    initMemberTypewriter();

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

    function redirectToLogin() {
      Auth.signOutQuietly(FB).then(function () {
        window.location.replace("./index.html");
      });
    }

    function switchPanel(panelKey) {
      var target = panelKey === "events" ? "events" : "overview";
      if (sidebarNav) {
        var btns = sidebarNav.querySelectorAll(".nav-item[data-panel]");
        for (var i = 0; i < btns.length; i++) {
          var active = btns[i].getAttribute("data-panel") === target;
          btns[i].classList.toggle("is-active", active);
          if (active) btns[i].setAttribute("aria-current", "page");
          else btns[i].removeAttribute("aria-current");
        }
      }
      if (viewTitleEl) {
        viewTitleEl.textContent = target === "events" ? "Etkinlikler" : "Genel Bakış";
      }
      if (panelOverview) {
        if (target === "overview") panelOverview.removeAttribute("hidden");
        else panelOverview.setAttribute("hidden", "hidden");
      }
      if (panelEvents) {
        if (target === "events") panelEvents.removeAttribute("hidden");
        else panelEvents.setAttribute("hidden", "hidden");
      }
    }

    if (sidebarNav) {
      sidebarNav.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".nav-item[data-panel]") : null;
        if (!btn) return;
        switchPanel(btn.getAttribute("data-panel"));
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        UI.setButtonLoading(logoutBtn, true, "Çıkış yapılıyor...", "Çıkış Yap");
        redirectToLogin();
      });
    }

    function renderAnnouncements(items) {
      if (announcementsLoading) announcementsLoading.setAttribute("hidden", "hidden");
      if (!announcementsList) return;
      announcementsList.textContent = "";

      if (!items || items.length === 0) {
        if (announcementsEmpty) announcementsEmpty.removeAttribute("hidden");
        return;
      }

      if (announcementsEmpty) announcementsEmpty.setAttribute("hidden", "hidden");
      var frag = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) {
        var a = items[i];
        var li = document.createElement("li");
        li.className = "announcement-item";

        var body = document.createElement("div");
        body.className = "announcement-content";

        var t = document.createElement("p");
        t.className = "announcement-title";
        t.textContent = a.title || "Duyuru";

        body.appendChild(t);
        if (a.content) {
          var p = document.createElement("p");
          p.className = "announcement-body";
          p.textContent = a.content;
          body.appendChild(p);
        }

        var dtEl = document.createElement("span");
        dtEl.className = "announcement-date";
        dtEl.textContent = formatTurkishDate(parseTimestampToDate(a.createdAt));

        li.appendChild(body);
        li.appendChild(dtEl);
        frag.appendChild(li);
      }
      announcementsList.appendChild(frag);
    }

    function buildMemberEventCard(ev) {
      var todayIso = getTodayIsoDate();
      var isExpired = Boolean(ev.eventDate && ev.eventDate < todayIso);

      var responses = ev.responses && typeof ev.responses === "object" ? ev.responses : {};
      var attendCount = 0;
      var declineCount = 0;
      var respKeys = Object.keys(responses);
      for (var i = 0; i < respKeys.length; i++) {
        var r = responses[respKeys[i]];
        if (!r || typeof r !== "object") continue;
        if (r.status === "attending") attendCount++;
        else if (r.status === "declined") declineCount++;
      }

      var myResp =
        state.session && responses[state.session.uid]
          ? responses[state.session.uid].status
          : "";

      var article = document.createElement("article");
      article.className = "event-card" + (isExpired ? " is-expired" : "");
      article.setAttribute("data-event-id", ev.id);

      var media = document.createElement("div");
      media.className = "event-card-media";

      if (ev.photoUrl) {
        var img = document.createElement("img");
        img.className = "event-card-img";
        img.src = ev.photoUrl;
        img.alt = ev.title ? ev.title + " etkinlik görseli" : "Etkinlik görseli";
        img.loading = "lazy";
        media.appendChild(img);
      } else {
        var fb = document.createElement("div");
        fb.className = "event-card-fallback";
        fb.setAttribute("aria-hidden", "true");
        media.appendChild(fb);
      }

      var dateBadge = document.createElement("span");
      dateBadge.className = "event-date-badge";
      dateBadge.textContent = formatTurkishEventDate(ev.eventDate);
      media.appendChild(dateBadge);

      if (isExpired) {
        var expBadge = document.createElement("span");
        expBadge.className = "event-expired-badge";
        expBadge.textContent = "Süresi Doldu";
        media.appendChild(expBadge);
      }

      var body = document.createElement("div");
      body.className = "event-card-body";

      var title = document.createElement("h3");
      title.className = "event-card-title";
      title.textContent = ev.title || "Etkinlik";

      var desc = document.createElement("p");
      desc.className = "event-card-desc";
      desc.textContent = ev.description || "";

      var footer = document.createElement("footer");
      footer.className = "event-card-footer";

      var creator = document.createElement("p");
      creator.className = "event-card-creator";
      creator.textContent = "Etkinliği Oluşturan: " + (ev.creatorName || "Topluluk Yönetimi");

      var rsvpBar = document.createElement("div");
      rsvpBar.className = "event-rsvp-bar";
      rsvpBar.setAttribute("role", "group");
      rsvpBar.setAttribute("aria-label", (ev.title || "Etkinlik") + " katılım yanıtı");

      var attendBtn = document.createElement("button");
      attendBtn.type = "button";
      attendBtn.className =
        "event-rsvp-btn event-rsvp-btn--attend" +
        (myResp === "attending" ? " is-selected" : "");
      attendBtn.setAttribute("data-rsvp", "attending");
      attendBtn.setAttribute("data-event-id", ev.id);
      attendBtn.setAttribute("aria-pressed", myResp === "attending" ? "true" : "false");
      if (isExpired) {
        attendBtn.disabled = true;
        attendBtn.setAttribute("aria-disabled", "true");
        attendBtn.title = "Bu etkinliğin süresi dolmuştur.";
      }

      var aLbl = document.createElement("span");
      aLbl.textContent = "Katılıyorum";
      var aCnt = document.createElement("span");
      aCnt.className = "rsvp-count";
      aCnt.textContent = String(attendCount);
      attendBtn.appendChild(aLbl);
      attendBtn.appendChild(aCnt);

      var declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className =
        "event-rsvp-btn event-rsvp-btn--decline" +
        (myResp === "declined" ? " is-selected" : "");
      declineBtn.setAttribute("data-rsvp", "declined");
      declineBtn.setAttribute("data-event-id", ev.id);
      declineBtn.setAttribute("aria-pressed", myResp === "declined" ? "true" : "false");
      if (isExpired) {
        declineBtn.disabled = true;
        declineBtn.setAttribute("aria-disabled", "true");
        declineBtn.title = "Bu etkinliğin süresi dolmuştur.";
      }

      var dLbl = document.createElement("span");
      dLbl.textContent = "Katılmıyorum";
      var dCnt = document.createElement("span");
      dCnt.className = "rsvp-count";
      dCnt.textContent = String(declineCount);
      declineBtn.appendChild(dLbl);
      declineBtn.appendChild(dCnt);

      rsvpBar.appendChild(attendBtn);
      rsvpBar.appendChild(declineBtn);

      footer.appendChild(creator);
      footer.appendChild(rsvpBar);

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(footer);

      article.appendChild(media);
      article.appendChild(body);
      return article;
    }

    function renderEvents() {
      if (eventsLoading) eventsLoading.setAttribute("hidden", "hidden");
      if (!eventListEl) return;
      eventListEl.textContent = "";

      if (navEventsCount) {
        if (state.events.length > 0) {
          navEventsCount.textContent = String(state.events.length);
          navEventsCount.removeAttribute("hidden");
        } else {
          navEventsCount.setAttribute("hidden", "hidden");
        }
      }

      if (eventsMetaEl) {
        eventsMetaEl.textContent =
          state.events.length > 0
            ? "Toplam " +
              state.events.length +
              " etkinlik listeleniyor. Yaklaşan etkinlikler için katılım yanıtınızı belirtebilirsiniz."
            : "Yaklaşan etkinlikler için “Katılıyorum” veya “Katılmıyorum” yanıtınızı bildirebilirsiniz.";
      }

      if (state.events.length === 0) {
        if (eventsEmpty) eventsEmpty.removeAttribute("hidden");
        return;
      }

      if (eventsEmpty) eventsEmpty.setAttribute("hidden", "hidden");
      var frag = document.createDocumentFragment();
      for (var i = 0; i < state.events.length; i++) {
        frag.appendChild(buildMemberEventCard(state.events[i]));
      }
      eventListEl.appendChild(frag);
    }

    if (eventListEl) {
      eventListEl.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-rsvp]") : null;
        if (!btn || btn.disabled) return;
        if (!state.session || !state.profile) return;

        var eventId = btn.getAttribute("data-event-id");
        var nextStatus = btn.getAttribute("data-rsvp");
        var ev = state.eventsById[eventId];
        if (!ev || state.busyEventIds[eventId]) return;

        if (ev.eventDate && ev.eventDate < getTodayIsoDate()) {
          showToast("Bu etkinliğin süresi dolduğu için katılım yanıtı değiştirilemez.", "error");
          return;
        }

        state.busyEventIds[eventId] = true;
        saveMemberRsvp(cfg, Auth, state.session, state.profile, eventId, nextStatus)
          .then(function (saved) {
            delete state.busyEventIds[eventId];
            if (!ev.responses || typeof ev.responses !== "object") ev.responses = {};
            ev.responses[saved.uid] = saved;
            renderEvents();
            showToast(
              nextStatus === "attending"
                ? "Katılım yanıtınız “Katılıyorum” olarak kaydedildi."
                : "Katılım yanıtınız “Katılmıyorum” olarak kaydedildi.",
              "success"
            );
          })
          .catch(function (err) {
            delete state.busyEventIds[eventId];
            Auth.logTechnicalError("Üye RSVP", err);
            showToast("Katılım yanıtınız kaydedilemedi. Lütfen tekrar deneyin.", "error");
          });
      });
    }

    [
      [currentPwInput, currentPwError],
      [newPwInput, newPwError],
      [confirmPwInput, confirmPwError]
    ].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].addEventListener("input", function () {
        UI.clearFieldError(pair[0], pair[1], false);
      });
    });

    if (passwordForm) {
      passwordForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!state.session) return;

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

        changePasswordWithFirebase(FB, Auth, cfg, state.session, currentVal, newVal)
          .then(function () {
            UI.setButtonLoading(passwordSubmitBtn, false, "Şifre güncelleniyor...", "Şifreyi Güncelle");
            passwordForm.reset();
            UI.clearFieldError(currentPwInput, currentPwError, false);
            UI.clearFieldError(newPwInput, newPwError, false);
            UI.clearFieldError(confirmPwInput, confirmPwError, false);
            showToast("Şifreniz başarıyla güncellendi.", "success");
          })
          .catch(function (err) {
            UI.setButtonLoading(passwordSubmitBtn, false, "Şifre güncelleniyor...", "Şifreyi Güncelle");
            var info = mapPasswordError(Auth, err);
            if (info.field === "current" && currentPwInput) {
              UI.setFieldError(currentPwInput, currentPwError, info.message);
              currentPwInput.focus();
            } else if (info.field === "new" && newPwInput) {
              UI.setFieldError(newPwInput, newPwError, info.message);
              newPwInput.focus();
            }
            showToast(info.message, "error");
          });
      });
    }

    function activateMemberDashboard(session) {
      fetchMemberProfile(cfg, Auth, session)
        .then(function (profile) {
          if (!profile || profile.status !== "approved") {
            redirectToLogin();
            return;
          }

          state.session = session;
          state.profile = profile;
          Auth.saveAuthSession(session);

          var fullName =
            [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
            (profile.username ? "@" + profile.username : profile.email || "Üye");

          if (memberNameEl) memberNameEl.textContent = fullName;
          if (memberAvatarEl) {
            memberAvatarEl.textContent = initialsOf(
              profile.firstName || fullName,
              profile.lastName || "",
              "Ü"
            );
          }
          if (welcomeTitleEl) {
            welcomeTitleEl.textContent = "Hoş Geldin, " + fullName;
          }
          if (fullNameValEl) fullNameValEl.textContent = fullName;
          if (usernameValEl) {
            usernameValEl.textContent = profile.username ? "@" + profile.username : "—";
          }
          if (emailValEl) emailValEl.textContent = profile.email || session.email || "—";
          if (roleValEl) roleValEl.textContent = "Üye (Onaylı)";

          var joinedDt = parseTimestampToDate(profile.createdAt);
          if (durationValueEl) {
            durationValueEl.textContent = formatMembershipDuration(joinedDt);
          }
          if (joinedDateEl) {
            joinedDateEl.textContent = "Kayıt Tarihi: " + formatTurkishDate(joinedDt);
          }

          if (gate) gate.setAttribute("hidden", "hidden");
          shell.removeAttribute("hidden");
          switchPanel("overview");

          fetchAnnouncements(cfg, Auth, session)
            .then(renderAnnouncements)
            .catch(function () {
              renderAnnouncements([]);
            });

          fetchPublishedEvents(cfg, Auth, session)
            .then(function (list) {
              var map = {};
              for (var i = 0; i < list.length; i++) map[list[i].id] = list[i];
              state.events = list;
              state.eventsById = map;
              renderEvents();
            })
            .catch(function (err) {
              Auth.logTechnicalError("Üye Etkinlik Listesi", err);
              renderEvents();
            });
        })
        .catch(function (err) {
          Auth.logTechnicalError("Üye Paneli Doğrulama", err);
          redirectToLogin();
        });
    }

    function bootstrapSession(sdkUser) {
      if (sdkUser) {
        sdkUser
          .getIdToken()
          .then(function (token) {
            activateMemberDashboard({
              uid: sdkUser.uid,
              email: sdkUser.email || "",
              displayName: sdkUser.displayName || "",
              idToken: token
            });
          })
          .catch(function () {
            redirectToLogin();
          });
        return;
      }

      var saved = Auth.loadAuthSession();
      if (saved && saved.uid && saved.idToken) {
        activateMemberDashboard(saved);
        return;
      }

      window.location.replace("./index.html");
    }

    if (auth && !FB.isFileProtocol) {
      auth.onAuthStateChanged(bootstrapSession);
    } else {
      bootstrapSession(null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMemberDashboard);
  } else {
    initMemberDashboard();
  }
})(window, document);
