(function (window, document) {
  "use strict";

  var MAX_RAW_FILE_BYTES = 5 * 1024 * 1024;
  var MAX_IMAGE_WIDTH = 1200;
  var JPEG_QUALITY = 0.82;
  var ALLOWED_MIME = {
    "image/jpeg": true,
    "image/png": true,
    "image/webp": true,
    "image/gif": true
  };

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

  function formatTurkishEventDate(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) {
      return String(isoDate || "—");
    }
    var parts = String(isoDate).split("-");
    var dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    try {
      return dt.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return isoDate;
    }
  }

  function formatResponseTime(isoTs) {
    if (!isoTs) return "";
    var ms = Date.parse(String(isoTs));
    if (isNaN(ms)) return "";
    try {
      return new Date(ms).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  }

  function initialsOf(name, fallback) {
    var src = String(name || fallback || "?").trim();
    var parts = src.split(/\s+/).filter(Boolean);
    var raw =
      parts.length >= 2
        ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
        : src.charAt(0) || "?";
    try {
      return raw.toLocaleUpperCase("tr-TR");
    } catch (e) {
      return raw.toUpperCase();
    }
  }

  function generateEventId() {
    return (
      "evt_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function compressImageToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("FILE_READ_ERROR"));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error("IMAGE_DECODE_ERROR"));
        };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (w > MAX_IMAGE_WIDTH) {
              h = Math.round((h * MAX_IMAGE_WIDTH) / w);
              w = MAX_IMAGE_WIDTH;
            }
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            resolve(dataUrl);
          } catch (err) {

            resolve(String(reader.result || ""));
          }
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function strField(fields, key) {
    return fields && fields[key] && typeof fields[key].stringValue === "string"
      ? fields[key].stringValue
      : "";
  }

  function saveEventEverywhere(cfg, Auth, session, eventObj) {
    var idKey = encodeURIComponent(eventObj.id);

    var rtdbOp = Auth.rtdbRequest(
      cfg,
      "PUT",
      "events/" + idKey,
      session.idToken,
      eventObj
    );

    var root = Auth.firestoreRoot(cfg);
    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      root +
      "/events?documentId=" +
      idKey +
      "&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsBody = {
      fields: {
        id: { stringValue: eventObj.id },
        title: { stringValue: eventObj.title },
        description: { stringValue: eventObj.description },
        creatorName: { stringValue: eventObj.creatorName },
        eventDate: { stringValue: eventObj.eventDate },
        photoUrl: { stringValue: eventObj.photoUrl || "" },
        createdByUid: { stringValue: eventObj.createdByUid || "" },
        createdAt: { timestampValue: eventObj.createdAt }
      }
    };

    var fsOp = window
      .fetch(fsUrl, {
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

  function fetchEventsCombined(cfg, Auth, session) {
    var rtdbPromise = Auth.rtdbRequest(cfg, "GET", "events", session.idToken).catch(
      function () {
        return null;
      }
    );

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/events?pageSize=200&key=" +
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
          createdByUid: strField(f, "createdByUid"),
          createdAt:
            (f.createdAt && (f.createdAt.timestampValue || f.createdAt.stringValue)) ||
            doc.createTime ||
            "",
          responses: {}
        };
      }

      if (rtdbData && typeof rtdbData === "object") {
        var keys = Object.keys(rtdbData);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var item = rtdbData[key];
          if (!item || typeof item !== "object") continue;
          var prev = byIdMap[key] || {};
          byIdMap[key] = {
            id: key,
            title: item.title || prev.title || "",
            description: item.description || prev.description || "",
            creatorName: item.creatorName || prev.creatorName || "",
            eventDate: item.eventDate || prev.eventDate || "",
            photoUrl: item.photoUrl || prev.photoUrl || "",
            createdByUid: item.createdByUid || prev.createdByUid || "",
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
      for (var k = 0; k < allIds.length; k++) {
        list.push(byIdMap[allIds[k]]);
      }

      list.sort(function (a, b) {
        var ta = Date.parse(String(a.createdAt || "")) || 0;
        var tb = Date.parse(String(b.createdAt || "")) || 0;
        return tb - ta;
      });

      return list;
    });
  }

  function submitEventRsvp(cfg, Auth, session, eventId, status, responder) {
    if (status !== "attending" && status !== "declined") {
      return Promise.reject(new Error("INVALID_RSVP_STATUS"));
    }

    var nowIso = new Date().toISOString();
    var payload = {
      uid: session.uid,
      fullName: (responder && responder.fullName) || session.displayName || session.email || "Üye",
      username: (responder && responder.username) || "",
      email: (responder && responder.email) || session.email || "",
      status: status,
      updatedAt: nowIso
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

    var root = Auth.firestoreRoot(cfg);
    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      root +
      "/events/" +
      idKey +
      "/responses/" +
      uidKey +
      "?key=" +
      encodeURIComponent(cfg.apiKey);

    var fsBody = {
      fields: {
        uid: { stringValue: payload.uid },
        fullName: { stringValue: payload.fullName },
        username: { stringValue: payload.username },
        email: { stringValue: payload.email },
        status: { stringValue: payload.status },
        updatedAt: { timestampValue: payload.updatedAt }
      }
    };

    var fsOp = window
      .fetch(fsUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.idToken
        },
        body: JSON.stringify(fsBody)
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]).then(function () {
      return payload;
    });
  }

  function partitionResponses(responsesMap) {
    var attending = [];
    var declined = [];
    if (!responsesMap || typeof responsesMap !== "object") {
      return { attending: attending, declined: declined };
    }
    var uids = Object.keys(responsesMap);
    for (var i = 0; i < uids.length; i++) {
      var r = responsesMap[uids[i]];
      if (!r || typeof r !== "object") continue;
      var entry = {
        uid: r.uid || uids[i],
        fullName: r.fullName || r.username || r.email || "Üye",
        username: r.username || "",
        email: r.email || "",
        status: r.status || "",
        updatedAt: r.updatedAt || ""
      };
      if (entry.status === "attending") attending.push(entry);
      else if (entry.status === "declined") declined.push(entry);
    }

    var byNewest = function (a, b) {
      return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
    };
    attending.sort(byNewest);
    declined.sort(byNewest);

    return { attending: attending, declined: declined };
  }

  function updateEventEverywhere(cfg, Auth, session, eventId, patchObj) {
    var idKey = encodeURIComponent(eventId);
    var rtdbOp = Auth.rtdbRequest(
      cfg,
      "PATCH",
      "events/" + idKey,
      session.idToken,
      patchObj
    );

    var root = Auth.firestoreRoot(cfg);
    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      root +
      "/events/" +
      idKey +
      "?updateMask.fieldPaths=title&updateMask.fieldPaths=description&updateMask.fieldPaths=creatorName&updateMask.fieldPaths=eventDate&updateMask.fieldPaths=photoUrl&updateMask.fieldPaths=updatedAt&key=" +
      encodeURIComponent(cfg.apiKey);

    var fsBody = {
      fields: {
        title: { stringValue: patchObj.title },
        description: { stringValue: patchObj.description },
        creatorName: { stringValue: patchObj.creatorName },
        eventDate: { stringValue: patchObj.eventDate },
        photoUrl: { stringValue: patchObj.photoUrl || "" },
        updatedAt: { timestampValue: patchObj.updatedAt }
      }
    };

    var fsOp = window
      .fetch(fsUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.idToken
        },
        body: JSON.stringify(fsBody)
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]);
  }

  function deleteEventEverywhere(cfg, Auth, session, eventId) {
    var idKey = encodeURIComponent(eventId);
    var rtdbOp = Auth.rtdbRequest(cfg, "DELETE", "events/" + idKey, session.idToken);

    var fsUrl =
      "https://firestore.googleapis.com/v1/" +
      Auth.firestoreRoot(cfg) +
      "/events/" +
      idKey +
      "?key=" +
      encodeURIComponent(cfg.apiKey);

    var fsOp = window
      .fetch(fsUrl, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + session.idToken }
      })
      .catch(function () {});

    return Promise.all([rtdbOp, fsOp]);
  }

  function buildEventCard(eventObj, opts) {
    var options = opts || {};
    var currentUid = options.currentUid || "";
    var showStatusButton = Boolean(options.showStatusButton);
    var showEditButton = Boolean(options.showEditButton);
    var showDeleteButton = Boolean(options.showDeleteButton);
    var showRsvpButtons = options.showRsvpButtons !== false;

    var parts = partitionResponses(eventObj.responses);
    var myResp =
      currentUid && eventObj.responses && eventObj.responses[currentUid]
        ? eventObj.responses[currentUid].status
        : "";

    var article = document.createElement("article");
    article.className = "event-card";
    article.setAttribute("data-event-id", eventObj.id);

    var media = document.createElement("div");
    media.className = "event-card-media";

    if (eventObj.photoUrl) {
      var img = document.createElement("img");
      img.className = "event-card-img";
      img.src = eventObj.photoUrl;
      img.alt = eventObj.title ? eventObj.title + " etkinlik görseli" : "Etkinlik görseli";
      img.loading = "lazy";
      media.appendChild(img);
    } else {
      var fallback = document.createElement("div");
      fallback.className = "event-card-fallback";
      fallback.setAttribute("aria-hidden", "true");
      media.appendChild(fallback);
    }

    var dateBadge = document.createElement("span");
    dateBadge.className = "event-date-badge";
    dateBadge.textContent = formatTurkishEventDate(eventObj.eventDate);
    media.appendChild(dateBadge);

    if (showStatusButton || showEditButton || showDeleteButton) {
      var overlayActions = document.createElement("div");
      overlayActions.className = "event-card-overlay-actions";

      if (showStatusButton) {
        var statusBtn = document.createElement("button");
        statusBtn.type = "button";
        statusBtn.className = "event-status-trigger";
        statusBtn.setAttribute("data-event-action", "view-status");
        statusBtn.setAttribute("data-event-id", eventObj.id);
        statusBtn.setAttribute(
          "aria-label",
          (eventObj.title || "Etkinlik") + " katılım durumunu görüntüle"
        );
        statusBtn.textContent = "Durumu Görüntüle";
        overlayActions.appendChild(statusBtn);
      }

      if (showEditButton) {
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "event-edit-trigger";
        editBtn.setAttribute("data-event-action", "edit-event");
        editBtn.setAttribute("data-event-id", eventObj.id);
        editBtn.title = "Etkinliği Düzenle";
        editBtn.setAttribute(
          "aria-label",
          (eventObj.title || "Etkinlik") + " etkinliğini düzenle"
        );
        editBtn.textContent = "Düzenle";
        overlayActions.appendChild(editBtn);
      }

      if (showDeleteButton) {
        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "event-delete-trigger";
        delBtn.setAttribute("data-event-action", "delete-event");
        delBtn.setAttribute("data-event-id", eventObj.id);
        delBtn.title = "Etkinliği Sil";
        delBtn.setAttribute(
          "aria-label",
          (eventObj.title || "Etkinlik") + " etkinliğini sil"
        );
        delBtn.textContent = "Sil";
        overlayActions.appendChild(delBtn);
      }

      media.appendChild(overlayActions);
    }

    var body = document.createElement("div");
    body.className = "event-card-body";

    var title = document.createElement("h3");
    title.className = "event-card-title";
    title.textContent = eventObj.title || "İsimsiz Etkinlik";

    var desc = document.createElement("p");
    desc.className = "event-card-desc";
    desc.textContent = eventObj.description || "";

    var footer = document.createElement("footer");
    footer.className = "event-card-footer";

    var creator = document.createElement("p");
    creator.className = "event-card-creator";
    creator.textContent = "Etkinliği Oluşturan: " + (eventObj.creatorName || "Yetkili");

    footer.appendChild(creator);

    if (showRsvpButtons) {

      var rsvpBar = document.createElement("div");
      rsvpBar.className = "event-rsvp-bar";
      rsvpBar.setAttribute("role", "group");
      rsvpBar.setAttribute("aria-label", "Katılım yanıtı");

      var attendBtn = document.createElement("button");
      attendBtn.type = "button";
      attendBtn.className =
        "event-rsvp-btn event-rsvp-btn--attend" +
        (myResp === "attending" ? " is-selected" : "");
      attendBtn.setAttribute("data-rsvp", "attending");
      attendBtn.setAttribute("data-event-id", eventObj.id);
      attendBtn.setAttribute("aria-pressed", myResp === "attending" ? "true" : "false");

      var attendLabel = document.createElement("span");
      attendLabel.textContent = "Katılıyorum";
      var attendCount = document.createElement("span");
      attendCount.className = "rsvp-count";
      attendCount.textContent = String(parts.attending.length);
      attendBtn.appendChild(attendLabel);
      attendBtn.appendChild(attendCount);

      var declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className =
        "event-rsvp-btn event-rsvp-btn--decline" +
        (myResp === "declined" ? " is-selected" : "");
      declineBtn.setAttribute("data-rsvp", "declined");
      declineBtn.setAttribute("data-event-id", eventObj.id);
      declineBtn.setAttribute("aria-pressed", myResp === "declined" ? "true" : "false");

      var declineLabel = document.createElement("span");
      declineLabel.textContent = "Katılmıyorum";
      var declineCount = document.createElement("span");
      declineCount.className = "rsvp-count";
      declineCount.textContent = String(parts.declined.length);
      declineBtn.appendChild(declineLabel);
      declineBtn.appendChild(declineCount);

      rsvpBar.appendChild(attendBtn);
      rsvpBar.appendChild(declineBtn);
      footer.appendChild(rsvpBar);
    } else {

      var summaryBar = document.createElement("div");
      summaryBar.className = "event-rsvp-summary";
      summaryBar.setAttribute("aria-label", "Üye katılım özeti");

      var attendStat = document.createElement("span");
      attendStat.className = "event-stat-pill event-stat-pill--attend";
      attendStat.textContent = "Katılan: " + parts.attending.length;

      var declineStat = document.createElement("span");
      declineStat.className = "event-stat-pill event-stat-pill--decline";
      declineStat.textContent = "Katılmayan: " + parts.declined.length;

      summaryBar.appendChild(attendStat);
      summaryBar.appendChild(declineStat);
      footer.appendChild(summaryBar);
    }

    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(footer);

    article.appendChild(media);
    article.appendChild(body);
    return article;
  }

  function initAdminEventsModule() {
    var form = byId("eventCreateForm");
    var feedListEl = byId("eventFeedList");
    if (!form || !feedListEl) return;

    var photoInput = byId("eventPhoto");
    var photoDropzone = byId("eventPhotoDropzone");
    var photoPlaceholder = byId("eventPhotoPlaceholder");
    var photoPreviewWrap = byId("eventPhotoPreviewWrap");
    var photoPreviewImg = byId("eventPhotoPreview");
    var photoNameEl = byId("eventPhotoName");
    var photoClearBtn = byId("eventPhotoClearBtn");
    var photoError = byId("eventPhotoError");

    var titleInput = byId("eventTitle");
    var titleError = byId("eventTitleError");
    var creatorInput = byId("eventCreatorName");
    var creatorError = byId("eventCreatorNameError");
    var dateInput = byId("eventDate");
    var dateError = byId("eventDateError");
    var descInput = byId("eventDescription");
    var descError = byId("eventDescriptionError");
    var submitBtn = byId("eventSubmitBtn");
    var cancelEditBtn = byId("eventCancelEditBtn");
    var createHeadingEl = byId("eventsCreateHeading");
    var createCardEl = form.closest ? form.closest(".event-create-card") : null;

    var loadingEl = byId("eventLoading");
    var emptyEl = byId("eventEmpty");
    var emptyTextEl = byId("eventEmptyText");
    var metaEl = byId("eventsMeta");
    var navCountEl = byId("navEventsCount");

    var statusDialog = byId("eventStatusDialog");
    var statusTitleEl = byId("eventStatusTitle");
    var statusSubEl = byId("eventStatusSub");
    var statusCloseBtn = byId("eventStatusCloseBtn");
    var tabAttendingBtn = byId("tabAttending");
    var tabDeclinedBtn = byId("tabDeclined");
    var countAttendingEl = byId("statusCountAttending");
    var countDeclinedEl = byId("statusCountDeclined");
    var statusListEl = byId("statusMemberList");
    var statusEmptyEl = byId("statusEmpty");
    var statusEmptyTextEl = byId("statusEmptyText");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;

    var state = {
      adminCtx: null,
      events: [],
      byId: {},
      selectedPhotoDataUrl: "",
      editingEventId: "",
      activeDialogEventId: "",
      activeDialogTab: "attending",
      busyEventIds: {}
    };

    function notify(text, kind) {
      if (state.adminCtx && typeof state.adminCtx.showToast === "function") {
        state.adminCtx.showToast(text, kind);
      }
    }

    function syncDateMin() {
      if (!dateInput) return;
      dateInput.setAttribute("min", getTodayIsoDate());
    }

    function openNativeDatePicker() {
      if (!dateInput) return;
      syncDateMin();
      if (typeof dateInput.showPicker === "function") {
        try {
          dateInput.showPicker();
        } catch (e) {}
      }
    }

    if (dateInput) {
      syncDateMin();

      dateInput.addEventListener("keydown", function (e) {
        var key = e.key || "";
        if (key === "Tab" || key === "Shift" || key === "Escape") return;
        e.preventDefault();
        if (key === "Enter" || key === " ") {
          openNativeDatePicker();
        }
      });

      dateInput.addEventListener("paste", function (e) {
        e.preventDefault();
      });

      dateInput.addEventListener("drop", function (e) {
        e.preventDefault();
      });

      dateInput.addEventListener("click", openNativeDatePicker);
      dateInput.addEventListener("focus", openNativeDatePicker);

      dateInput.addEventListener("change", function () {
        UI.clearFieldError(dateInput, dateError, false);
        var val = dateInput.value;
        if (val && val < getTodayIsoDate()) {
          dateInput.value = "";
          UI.setFieldError(
            dateInput,
            dateError,
            "Geçmiş bir tarih seçilemez. Lütfen bugünü veya ileri bir tarihi seçin."
          );
        } else if (val) {
          UI.clearFieldError(dateInput, dateError, true);
        }
      });
    }

    function clearSelectedPhoto() {
      state.selectedPhotoDataUrl = "";
      if (photoInput) photoInput.value = "";
      if (photoPreviewImg) photoPreviewImg.removeAttribute("src");
      if (photoNameEl) photoNameEl.textContent = "";
      if (photoPreviewWrap) photoPreviewWrap.setAttribute("hidden", "hidden");
      if (photoPlaceholder) photoPlaceholder.removeAttribute("hidden");
      if (photoDropzone) photoDropzone.classList.remove("has-error", "has-preview");
    }

    function handlePhotoSelection(file) {
      UI.clearFieldError(photoInput, photoError, false);
      if (photoDropzone) photoDropzone.classList.remove("has-error");

      if (!file) {
        clearSelectedPhoto();
        return;
      }

      if (!ALLOWED_MIME[file.type]) {
        clearSelectedPhoto();
        if (photoDropzone) photoDropzone.classList.add("has-error");
        UI.setFieldError(
          photoInput,
          photoError,
          "Yalnızca JPG, PNG, WebP veya GIF formatında fotoğraf yükleyebilirsiniz."
        );
        return;
      }

      if (file.size > MAX_RAW_FILE_BYTES) {
        clearSelectedPhoto();
        if (photoDropzone) photoDropzone.classList.add("has-error");
        UI.setFieldError(
          photoInput,
          photoError,
          "Fotoğraf boyutu en fazla 5 MB olabilir."
        );
        return;
      }

      compressImageToDataUrl(file)
        .then(function (dataUrl) {
          state.selectedPhotoDataUrl = dataUrl;
          if (photoPreviewImg) photoPreviewImg.src = dataUrl;
          if (photoNameEl) photoNameEl.textContent = file.name || "Etkinlik fotoğrafı";
          if (photoPlaceholder) photoPlaceholder.setAttribute("hidden", "hidden");
          if (photoPreviewWrap) photoPreviewWrap.removeAttribute("hidden");
          if (photoDropzone) photoDropzone.classList.add("has-preview");
          UI.clearFieldError(photoInput, photoError, true);
        })
        .catch(function (err) {
          Auth.logTechnicalError("Etkinlik Fotoğrafı", err);
          clearSelectedPhoto();
          if (photoDropzone) photoDropzone.classList.add("has-error");
          UI.setFieldError(
            photoInput,
            photoError,
            "Fotoğraf işlenemedi. Lütfen başka bir görsel seçin."
          );
        });
    }

    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        handlePhotoSelection(file);
      });
    }

    if (photoClearBtn) {
      photoClearBtn.addEventListener("click", function () {
        clearSelectedPhoto();
        UI.clearFieldError(photoInput, photoError, false);
      });
    }

    [
      [titleInput, titleError],
      [creatorInput, creatorError],
      [descInput, descError]
    ].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].addEventListener("input", function () {
        UI.clearFieldError(pair[0], pair[1], false);
      });
    });

    function updateNavCount() {
      if (!navCountEl) return;
      if (state.events.length > 0) {
        navCountEl.textContent = String(state.events.length);
        navCountEl.removeAttribute("hidden");
      } else {
        navCountEl.setAttribute("hidden", "hidden");
      }
    }

    function renderEventFeed() {
      feedListEl.textContent = "";
      var frag = document.createDocumentFragment();
      var currentUid = state.adminCtx ? state.adminCtx.adminUid : "";

      for (var i = 0; i < state.events.length; i++) {
        frag.appendChild(
          buildEventCard(state.events[i], {
            currentUid: currentUid,
            showStatusButton: true,
            showEditButton: true,
            showDeleteButton: true,
            showRsvpButtons: false
          })
        );
      }
      feedListEl.appendChild(frag);
      updateNavCount();

      if (metaEl) {
        metaEl.textContent =
          state.events.length > 0
            ? "Toplam " +
              state.events.length +
              " etkinlik. Katılım listesini görmek için kartın üzerine gelip “Durumu Görüntüle” butonuna tıklayın."
            : "Etkinlik kartının üzerine gelerek katılım durumunu görüntüleyebilirsiniz.";
      }

      if (emptyEl && emptyTextEl) {
        if (state.events.length === 0) {
          emptyTextEl.textContent = "Henüz oluşturulmuş bir etkinlik bulunmuyor.";
          emptyEl.removeAttribute("hidden");
        } else {
          emptyEl.setAttribute("hidden", "hidden");
        }
      }
    }

    function renderStatusDialog() {
      var ev = state.byId[state.activeDialogEventId];
      if (!ev || !statusDialog) return;

      var parts = partitionResponses(ev.responses);
      if (statusTitleEl) statusTitleEl.textContent = ev.title || "Etkinlik";
      if (statusSubEl) {
        statusSubEl.textContent =
          formatTurkishEventDate(ev.eventDate) +
          " · Etkinliği Oluşturan: " +
          (ev.creatorName || "Yetkili");
      }
      if (countAttendingEl) countAttendingEl.textContent = String(parts.attending.length);
      if (countDeclinedEl) countDeclinedEl.textContent = String(parts.declined.length);

      var isAttendTab = state.activeDialogTab !== "declined";
      if (tabAttendingBtn) {
        tabAttendingBtn.classList.toggle("is-active", isAttendTab);
        tabAttendingBtn.setAttribute("aria-selected", isAttendTab ? "true" : "false");
      }
      if (tabDeclinedBtn) {
        tabDeclinedBtn.classList.toggle("is-active", !isAttendTab);
        tabDeclinedBtn.setAttribute("aria-selected", !isAttendTab ? "true" : "false");
      }

      var rows = isAttendTab ? parts.attending : parts.declined;
      if (statusListEl) statusListEl.textContent = "";

      if (rows.length === 0) {
        if (statusEmptyEl && statusEmptyTextEl) {
          statusEmptyTextEl.textContent = isAttendTab
            ? "Bu etkinlik için henüz “Katılıyorum” yanıtı verilmedi."
            : "Bu etkinlik için henüz “Katılmıyorum” yanıtı verilmedi.";
          statusEmptyEl.removeAttribute("hidden");
        }
        return;
      }

      if (statusEmptyEl) statusEmptyEl.setAttribute("hidden", "hidden");

      var frag = document.createDocumentFragment();
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var li = document.createElement("li");
        li.className = "status-member-row";

        var av = document.createElement("span");
        av.className = "member-avatar";
        av.setAttribute("aria-hidden", "true");
        av.textContent = initialsOf(r.fullName, r.email);

        var info = document.createElement("div");
        info.className = "status-member-info";

        var nm = document.createElement("p");
        nm.className = "member-name";
        nm.textContent = r.fullName;

        var em = document.createElement("p");
        em.className = "member-sub";
        em.textContent =
          (r.username ? "@" + r.username + " · " : "") + (r.email || "—");

        info.appendChild(nm);
        info.appendChild(em);

        var tm = document.createElement("span");
        tm.className = "status-member-time";
        tm.textContent = formatResponseTime(r.updatedAt);

        li.appendChild(av);
        li.appendChild(info);
        li.appendChild(tm);
        frag.appendChild(li);
      }

      if (statusListEl) statusListEl.appendChild(frag);
    }

    function openStatusDialog(eventId) {
      if (!state.byId[eventId] || !statusDialog) return;
      state.activeDialogEventId = eventId;
      state.activeDialogTab = "attending";
      renderStatusDialog();
      if (typeof statusDialog.showModal === "function") {
        statusDialog.showModal();
      } else {
        statusDialog.setAttribute("open", "open");
      }
    }

    if (statusCloseBtn && statusDialog) {
      statusCloseBtn.addEventListener("click", function () {
        if (typeof statusDialog.close === "function") statusDialog.close();
        else statusDialog.removeAttribute("open");
      });
    }

    if (tabAttendingBtn) {
      tabAttendingBtn.addEventListener("click", function () {
        state.activeDialogTab = "attending";
        renderStatusDialog();
      });
    }

    if (tabDeclinedBtn) {
      tabDeclinedBtn.addEventListener("click", function () {
        state.activeDialogTab = "declined";
        renderStatusDialog();
      });
    }

    function resetFormToCreateMode() {
      state.editingEventId = "";
      form.reset();
      clearSelectedPhoto();
      syncDateMin();
      UI.clearFieldError(photoInput, photoError, false);
      UI.clearFieldError(titleInput, titleError, false);
      UI.clearFieldError(creatorInput, creatorError, false);
      UI.clearFieldError(dateInput, dateError, false);
      UI.clearFieldError(descInput, descError, false);

      if (createHeadingEl) createHeadingEl.textContent = "Yeni Etkinlik Oluştur";
      if (createCardEl) createCardEl.classList.remove("is-editing");
      if (cancelEditBtn) cancelEditBtn.setAttribute("hidden", "hidden");
      UI.setButtonLoading(submitBtn, false, "Etkinlik yayınlanıyor...", "Etkinlik Oluştur");

      if (
        creatorInput &&
        state.adminCtx &&
        state.adminCtx.displayName &&
        state.adminCtx.displayName.indexOf("@") === -1
      ) {
        creatorInput.value = state.adminCtx.displayName;
      }
    }

    function enterEditMode(eventId) {
      var ev = state.byId[eventId];
      if (!ev) return;

      state.editingEventId = ev.id;
      UI.clearFieldError(photoInput, photoError, false);
      UI.clearFieldError(titleInput, titleError, false);
      UI.clearFieldError(creatorInput, creatorError, false);
      UI.clearFieldError(dateInput, dateError, false);
      UI.clearFieldError(descInput, descError, false);

      if (titleInput) titleInput.value = ev.title || "";
      if (creatorInput) creatorInput.value = ev.creatorName || "";
      if (dateInput) {
        syncDateMin();
        dateInput.value = ev.eventDate || "";
      }
      if (descInput) descInput.value = ev.description || "";

      if (ev.photoUrl) {
        state.selectedPhotoDataUrl = ev.photoUrl;
        if (photoInput) photoInput.value = "";
        if (photoPreviewImg) photoPreviewImg.src = ev.photoUrl;
        if (photoNameEl) photoNameEl.textContent = "Mevcut etkinlik fotoğrafı";
        if (photoPlaceholder) photoPlaceholder.setAttribute("hidden", "hidden");
        if (photoPreviewWrap) photoPreviewWrap.removeAttribute("hidden");
        if (photoDropzone) {
          photoDropzone.classList.remove("has-error");
          photoDropzone.classList.add("has-preview");
        }
      } else {
        clearSelectedPhoto();
      }

      if (createHeadingEl) createHeadingEl.textContent = "Etkinliği Düzenle";
      if (createCardEl) createCardEl.classList.add("is-editing");
      if (cancelEditBtn) cancelEditBtn.removeAttribute("hidden");
      UI.setButtonLoading(submitBtn, false, "Değişiklikler kaydediliyor...", "Değişiklikleri Kaydet");

      if (createCardEl && typeof createCardEl.scrollIntoView === "function") {
        createCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (titleInput) titleInput.focus();
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", resetFormToCreateMode);
    }

    function handleDeleteEvent(eventId) {
      var ev = state.byId[eventId];
      if (!ev || state.busyEventIds[eventId] || !state.adminCtx || !state.adminCtx.session) {
        return;
      }

      var confirmFn =
        typeof state.adminCtx.confirmAction === "function"
          ? state.adminCtx.confirmAction
          : function (opts) {
              return Promise.resolve(window.confirm(opts.title + "\n\n" + opts.message));
            };

      confirmFn({
        title: "Etkinliği Kalıcı Olarak Sil",
        message:
          "“" +
          (ev.title || "Etkinlik") +
          "” etkinliği ve bu etkinliğe ait tüm katılım yanıtları kalıcı olarak silinecektir. Devam etmek istiyor musunuz?",
        confirmLabel: "Etkinliği Sil",
        tone: "danger"
      }).then(function (ok) {
        if (!ok) return;
        state.busyEventIds[eventId] = true;

        deleteEventEverywhere(cfg, Auth, state.adminCtx.session, eventId)
          .then(function () {
            delete state.busyEventIds[eventId];
            delete state.byId[eventId];
            state.events = state.events.filter(function (item) {
              return item.id !== eventId;
            });
            if (state.editingEventId === eventId) {
              resetFormToCreateMode();
            }
            if (statusDialog && statusDialog.open && state.activeDialogEventId === eventId) {
              if (typeof statusDialog.close === "function") statusDialog.close();
            }
            renderEventFeed();
            notify("“" + (ev.title || "Etkinlik") + "” etkinliği silindi.", "success");
          })
          .catch(function (err) {
            delete state.busyEventIds[eventId];
            Auth.logTechnicalError("Etkinlik Silme", err);
            notify("Etkinlik silinemedi. Lütfen tekrar deneyin.", "error");
          });
      });
    }

    feedListEl.addEventListener("click", function (e) {
      var target = e.target;
      if (!target || !target.closest) return;

      var statusTrigger = target.closest('[data-event-action="view-status"]');
      if (statusTrigger) {
        openStatusDialog(statusTrigger.getAttribute("data-event-id"));
        return;
      }

      var editTrigger = target.closest('[data-event-action="edit-event"]');
      if (editTrigger) {
        enterEditMode(editTrigger.getAttribute("data-event-id"));
        return;
      }

      var deleteTrigger = target.closest('[data-event-action="delete-event"]');
      if (deleteTrigger) {
        handleDeleteEvent(deleteTrigger.getAttribute("data-event-id"));
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!state.adminCtx || !state.adminCtx.session) return;

      syncDateMin();
      var todayIso = getTodayIsoDate();
      var isEditing = Boolean(state.editingEventId && state.byId[state.editingEventId]);
      var existingEvent = isEditing ? state.byId[state.editingEventId] : null;

      var titleVal = titleInput ? titleInput.value.replace(/\s+/g, " ").trim() : "";
      var creatorVal = creatorInput ? creatorInput.value.replace(/\s+/g, " ").trim() : "";
      var dateVal = dateInput ? dateInput.value.trim() : "";
      var descVal = descInput ? descInput.value.trim() : "";

      var firstInvalid = null;

      if (!state.selectedPhotoDataUrl) {
        if (photoDropzone) photoDropzone.classList.add("has-error");
        UI.setFieldError(photoInput, photoError, "Etkinlik fotoğrafı seçilmesi zorunludur.");
        if (!firstInvalid) firstInvalid = photoInput;
      } else {
        if (photoDropzone) photoDropzone.classList.remove("has-error");
        UI.clearFieldError(photoInput, photoError, true);
      }

      if (!titleVal || titleVal.length < 3) {
        UI.setFieldError(titleInput, titleError, "Etkinlik adı en az 3 karakter olmalıdır.");
        if (!firstInvalid) firstInvalid = titleInput;
      } else {
        UI.clearFieldError(titleInput, titleError, true);
      }

      if (!creatorVal || creatorVal.length < 3) {
        UI.setFieldError(
          creatorInput,
          creatorError,
          "Etkinliği oluşturan kişinin adı ve soyadı zorunludur."
        );
        if (!firstInvalid) firstInvalid = creatorInput;
      } else {
        UI.clearFieldError(creatorInput, creatorError, true);
      }

      var isUnchangedPastDate =
        isEditing && existingEvent && dateVal === existingEvent.eventDate;
      if (!dateVal) {
        UI.setFieldError(dateInput, dateError, "Lütfen takvimden bir etkinlik tarihi seçin.");
        if (!firstInvalid) firstInvalid = dateInput;
      } else if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateVal) ||
        (dateVal < todayIso && !isUnchangedPastDate)
      ) {
        UI.setFieldError(
          dateInput,
          dateError,
          "Geçmiş bir tarih seçilemez. Lütfen bugünü veya ileri bir tarihi seçin."
        );
        if (!firstInvalid) firstInvalid = dateInput;
      } else {
        UI.clearFieldError(dateInput, dateError, true);
      }

      if (!descVal || descVal.length < 10) {
        UI.setFieldError(
          descInput,
          descError,
          "Etkinlik açıklaması en az 10 karakter olmalıdır."
        );
        if (!firstInvalid) firstInvalid = descInput;
      } else {
        UI.clearFieldError(descInput, descError, true);
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      if (isEditing && existingEvent) {
        UI.setButtonLoading(
          submitBtn,
          true,
          "Değişiklikler kaydediliyor...",
          "Değişiklikleri Kaydet"
        );

        var patchObj = {
          title: titleVal,
          description: descVal,
          creatorName: creatorVal,
          eventDate: dateVal,
          photoUrl: state.selectedPhotoDataUrl,
          updatedAt: new Date().toISOString()
        };

        updateEventEverywhere(cfg, Auth, state.adminCtx.session, existingEvent.id, patchObj)
          .then(function () {
            existingEvent.title = patchObj.title;
            existingEvent.description = patchObj.description;
            existingEvent.creatorName = patchObj.creatorName;
            existingEvent.eventDate = patchObj.eventDate;
            existingEvent.photoUrl = patchObj.photoUrl;
            existingEvent.updatedAt = patchObj.updatedAt;

            resetFormToCreateMode();
            renderEventFeed();
            notify("“" + existingEvent.title + "” etkinliği güncellendi.", "success");
          })
          .catch(function (err) {
            UI.setButtonLoading(
              submitBtn,
              false,
              "Değişiklikler kaydediliyor...",
              "Değişiklikleri Kaydet"
            );
            Auth.logTechnicalError("Etkinlik Güncelleme", err);
            notify("Etkinlik güncellenemedi. Lütfen tekrar deneyin.", "error");
          });
        return;
      }

      UI.setButtonLoading(submitBtn, true, "Etkinlik yayınlanıyor...", "Etkinlik Oluştur");

      var newEvent = {
        id: generateEventId(),
        title: titleVal,
        description: descVal,
        creatorName: creatorVal,
        eventDate: dateVal,
        photoUrl: state.selectedPhotoDataUrl,
        createdByUid: state.adminCtx.adminUid,
        createdAt: new Date().toISOString()
      };

      saveEventEverywhere(cfg, Auth, state.adminCtx.session, newEvent)
        .then(function () {
          resetFormToCreateMode();

          newEvent.responses = {};
          state.events.unshift(newEvent);
          state.byId[newEvent.id] = newEvent;
          renderEventFeed();

          notify("“" + newEvent.title + "” etkinliği başarıyla oluşturuldu.", "success");
        })
        .catch(function (err) {
          UI.setButtonLoading(submitBtn, false, "Etkinlik yayınlanıyor...", "Etkinlik Oluştur");
          Auth.logTechnicalError("Etkinlik Oluşturma", err);
          notify("Etkinlik kaydedilemedi. Lütfen tekrar deneyin.", "error");
        });
    });

    function refreshEvents() {
      if (!state.adminCtx || !state.adminCtx.session) return Promise.resolve();
      if (
        typeof state.adminCtx.canAccessEventsModule === "function" &&
        !state.adminCtx.canAccessEventsModule(state.adminCtx.adminRole)
      ) {
        return Promise.resolve();
      }

      return fetchEventsCombined(cfg, Auth, state.adminCtx.session)
        .then(function (list) {
          var map = {};
          for (var i = 0; i < list.length; i++) {
            map[list[i].id] = list[i];
          }
          state.events = list;
          state.byId = map;
          if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
          renderEventFeed();
        })
        .catch(function (err) {
          if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
          Auth.logTechnicalError("Etkinlik Listesi", err);
          notify("Etkinlik listesi yüklenemedi.", "error");
        });
    }

    function onAdminReady(adminCtx) {
      state.adminCtx = adminCtx;
      if (
        creatorInput &&
        !creatorInput.value &&
        adminCtx &&
        adminCtx.displayName &&
        adminCtx.displayName.indexOf("@") === -1
      ) {
        creatorInput.value = adminCtx.displayName;
      }
      refreshEvents();
    }

    window.AtaturkEvents = {
      onAdminReady: onAdminReady,
      refresh: refreshEvents,
      fetchEvents: fetchEventsCombined,
      submitEventRsvp: submitEventRsvp,
      buildEventCard: buildEventCard,
      formatTurkishEventDate: formatTurkishEventDate
    };

    if (window.AtaturkAdmin) {
      onAdminReady(window.AtaturkAdmin);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminEventsModule);
  } else {
    initAdminEventsModule();
  }
})(window, document);
