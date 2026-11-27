(function (window, document) {
  "use strict";

  var SUPPORTED_CURRENCIES = [
    { code: "TL", label: "TL · Türk Lirası" },
    { code: "USD", label: "USD · ABD Doları" },
    { code: "EUR", label: "EUR · Euro" },
    { code: "GBP", label: "GBP · İngiliz Sterlini" }
  ];

  var CURRENCY_LABELS = {
    TL: "TL · Türk Lirası",
    USD: "USD · ABD Doları",
    EUR: "EUR · Euro",
    GBP: "GBP · İngiliz Sterlini"
  };

  var MAX_ENTRIES = 5;
  var ANIM_DURATION_MS = 850;

  function byId(id) {
    return document.getElementById(id);
  }

  function roundMoney(num) {
    return Math.round(Number(num || 0) * 100) / 100;
  }

  function formatMoney(amount, currency) {
    var val = roundMoney(amount);
    var cur = String(currency || "TL").toUpperCase();
    try {
      return (
        val.toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) +
        " " +
        cur
      );
    } catch (e) {
      return val.toFixed(2) + " " + cur;
    }
  }

  function formatDateTime(isoTs) {
    if (!isoTs) return "—";
    var ms = Date.parse(String(isoTs));
    if (isNaN(ms)) return "—";
    try {
      return new Date(ms).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return String(isoTs).slice(0, 16).replace("T", " ");
    }
  }

  function generateTxId(prefix) {
    return (
      (prefix || "tx") +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function parsePositiveAmount(rawVal) {
    var cleaned = String(rawVal || "")
      .trim()
      .replace(",", ".");
    if (!cleaned) return NaN;
    var n = Number(cleaned);
    if (!isFinite(n) || n <= 0) return NaN;
    return roundMoney(n);
  }

  function openDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "open");
    }
  }

  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === "function") {
      if (dlg.open) dlg.close();
    } else {
      dlg.removeAttribute("open");
    }
  }

  function fetchBudgetData(cfg, Auth, session) {
    return Auth.rtdbRequest(cfg, "GET", "budget", session.idToken)
      .then(function (data) {
        var root = data && typeof data === "object" ? data : {};
        var txMap =
          root.transactions && typeof root.transactions === "object"
            ? root.transactions
            : {};
        var txList = [];
        var keys = Object.keys(txMap);

        for (var i = 0; i < keys.length; i++) {
          var t = txMap[keys[i]];
          if (!t || typeof t !== "object") continue;
          txList.push({
            id: t.id || keys[i],
            type: t.type === "expense" ? "expense" : "income",
            amount: roundMoney(t.amount),
            currency: String(t.currency || "TL").toUpperCase(),
            description: String(t.description || ""),
            recordedByUid: String(t.recordedByUid || ""),
            recordedByName: String(t.recordedByName || "Yetkili"),
            recordedByEmail: String(t.recordedByEmail || ""),
            createdAt: String(t.createdAt || "")
          });
        }

        txList.sort(function (a, b) {
          return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
        });

        var balances = { TL: 0 };
        var totalsIncome = { TL: 0 };
        var totalsExpense = { TL: 0 };

        for (var j = 0; j < txList.length; j++) {
          var item = txList[j];
          var cur = item.currency;
          if (!balances.hasOwnProperty(cur)) {
            balances[cur] = 0;
            totalsIncome[cur] = 0;
            totalsExpense[cur] = 0;
          }
          if (item.type === "income") {
            balances[cur] = roundMoney(balances[cur] + item.amount);
            totalsIncome[cur] = roundMoney(totalsIncome[cur] + item.amount);
          } else {
            balances[cur] = roundMoney(balances[cur] - item.amount);
            totalsExpense[cur] = roundMoney(totalsExpense[cur] + item.amount);
          }
        }

        return {
          balances: balances,
          totalsIncome: totalsIncome,
          totalsExpense: totalsExpense,
          transactions: txList
        };
      });
  }

  function persistBudgetBatch(cfg, Auth, session, newTransactions, updatedBalances) {
    var nowIso = new Date().toISOString();
    var rtdbPatch = {
      summary: {
        balances: updatedBalances,
        updatedAt: nowIso,
        updatedBy: session.uid
      }
    };

    var ops = [
      Auth.rtdbRequest(cfg, "PUT", "budget/summary", session.idToken, rtdbPatch.summary)
    ];

    for (var i = 0; i < newTransactions.length; i++) {
      var tx = newTransactions[i];
      ops.push(
        Auth.rtdbRequest(
          cfg,
          "PUT",
          "budget/transactions/" + encodeURIComponent(tx.id),
          session.idToken,
          tx
        )
      );
    }

    var root = Auth.firestoreRoot(cfg);
    var fsBalanceFields = {};
    var curKeys = Object.keys(updatedBalances);
    for (var c = 0; c < curKeys.length; c++) {
      fsBalanceFields[curKeys[c]] = { doubleValue: roundMoney(updatedBalances[curKeys[c]]) };
    }

    var fsWrites = [
      {
        update: {
          name: root + "/budget/summary",
          fields: {
            balances: { mapValue: { fields: fsBalanceFields } },
            updatedAt: { timestampValue: nowIso },
            updatedBy: { stringValue: session.uid }
          }
        }
      }
    ];

    for (var k = 0; k < newTransactions.length; k++) {
      var t = newTransactions[k];
      fsWrites.push({
        update: {
          name: root + "/budget/summary/transactions/" + encodeURIComponent(t.id),
          fields: {
            id: { stringValue: t.id },
            type: { stringValue: t.type },
            amount: { doubleValue: t.amount },
            currency: { stringValue: t.currency },
            description: { stringValue: t.description },
            recordedByUid: { stringValue: t.recordedByUid },
            recordedByName: { stringValue: t.recordedByName },
            recordedByEmail: { stringValue: t.recordedByEmail },
            createdAt: { timestampValue: t.createdAt }
          }
        }
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

  function initAdminBudgetModule() {
    var panel = byId("panelBudget");
    if (!panel) return;

    var balanceGridEl = byId("budgetBalanceGrid");
    var loadingEl = byId("budgetLoading");
    var recentListEl = byId("budgetRecentList");
    var recentEmptyEl = byId("budgetRecentEmpty");
    var recentMetaEl = byId("budgetRecentMeta");

    var openIncomeBtn = byId("openIncomeModalBtn");
    var openExpenseBtn = byId("openExpenseModalBtn");
    var openHistoryBtn = byId("openHistoryModalBtn");
    var openHistoryFromRecentBtn = byId("openHistoryFromRecentBtn");

    var incomeDialog = byId("budgetIncomeDialog");
    var incomeForm = byId("budgetIncomeForm");
    var incomeCountSelector = byId("incomeCountSelector");
    var incomeRowsContainer = byId("incomeRowsContainer");
    var incomeModalAlert = byId("incomeModalAlert");
    var incomeSubmitBtn = byId("incomeSubmitBtn");
    var incomeCloseBtn = byId("incomeCloseBtn");
    var incomeCancelBtn = byId("incomeCancelBtn");

    var expenseDialog = byId("budgetExpenseDialog");
    var expenseForm = byId("budgetExpenseForm");
    var expenseCountSelector = byId("expenseCountSelector");
    var expenseRowsContainer = byId("expenseRowsContainer");
    var expenseModalAlert = byId("expenseModalAlert");
    var expenseSubmitBtn = byId("expenseSubmitBtn");
    var expenseCloseBtn = byId("expenseCloseBtn");
    var expenseCancelBtn = byId("expenseCancelBtn");

    var historyDialog = byId("budgetHistoryDialog");
    var historyCloseBtn = byId("historyCloseBtn");
    var historyFilterBar = byId("historyFilterBar");
    var historyListEl = byId("budgetHistoryList");
    var historyEmptyEl = byId("budgetHistoryEmpty");
    var historyEmptyTextEl = byId("budgetHistoryEmptyText");
    var historyCountAll = byId("historyCountAll");
    var historyCountIncome = byId("historyCountIncome");
    var historyCountExpense = byId("historyCountExpense");

    var UI = window.AtaturkUI;
    var FB = window.AtaturkFirebase;
    var Auth = window.AtaturkAuth;
    var cfg = FB && FB.config ? FB.config : window.firebaseConfig;

    var state = {
      adminCtx: null,
      balances: { TL: 0 },
      totalsIncome: { TL: 0 },
      totalsExpense: { TL: 0 },
      transactions: [],
      incomeRowCount: 1,
      expenseRowCount: 1,
      historyFilter: "all",
      animFrames: {}
    };

    function notify(text, kind) {
      if (state.adminCtx && typeof state.adminCtx.showToast === "function") {
        state.adminCtx.showToast(text, kind);
      }
    }

    function showModalAlert(el, msg) {
      if (!el) return;
      el.textContent = String(msg || "");
      el.removeAttribute("hidden");
    }

    function hideModalAlert(el) {
      if (!el) return;
      el.textContent = "";
      el.setAttribute("hidden", "hidden");
    }

    function orderedCurrencies(balancesMap) {
      var list = ["TL"];
      var keys = Object.keys(balancesMap || {});
      for (var i = 0; i < keys.length; i++) {
        if (keys[i] !== "TL") list.push(keys[i]);
      }
      return list;
    }

    function ensureBalanceCard(currency) {
      if (!balanceGridEl) return null;
      var existing = balanceGridEl.querySelector(
        '.budget-balance-card[data-currency="' + currency + '"]'
      );
      if (existing) return existing;

      var card = document.createElement("div");
      card.className = "budget-balance-card";
      card.setAttribute("data-currency", currency);

      var top = document.createElement("div");
      top.className = "budget-balance-top";

      var pill = document.createElement("span");
      pill.className = "budget-currency-pill";
      pill.textContent = CURRENCY_LABELS[currency] || currency;
      top.appendChild(pill);

      var amt = document.createElement("p");
      amt.className = "budget-balance-amount";
      amt.setAttribute("data-balance-currency", currency);
      amt.textContent = formatMoney(0, currency);

      var sub = document.createElement("div");
      sub.className = "budget-balance-sub";

      var inSpan = document.createElement("span");
      inSpan.className = "budget-sub-in";
      inSpan.setAttribute("data-income-currency", currency);
      inSpan.textContent = "Giriş: " + formatMoney(0, currency);

      var outSpan = document.createElement("span");
      outSpan.className = "budget-sub-out";
      outSpan.setAttribute("data-expense-currency", currency);
      outSpan.textContent = "Çıkış: " + formatMoney(0, currency);

      sub.appendChild(inSpan);
      sub.appendChild(outSpan);

      card.appendChild(top);
      card.appendChild(amt);
      card.appendChild(sub);
      balanceGridEl.appendChild(card);
      return card;
    }

    function animateCurrencyBalance(currency, fromVal, toVal, direction) {
      var card = ensureBalanceCard(currency);
      if (!card) return;
      var amtEl = card.querySelector('[data-balance-currency="' + currency + '"]');
      if (!amtEl) return;

      if (state.animFrames[currency]) {
        window.cancelAnimationFrame(state.animFrames[currency]);
        delete state.animFrames[currency];
      }

      amtEl.classList.remove("is-counting-up", "is-counting-down");

      var reduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      var cls = direction === "up" ? "is-counting-up" : "is-counting-down";
      amtEl.classList.add(cls);

      if (reduced || fromVal === toVal) {
        amtEl.textContent = formatMoney(toVal, currency);
        window.setTimeout(function () {
          amtEl.classList.remove("is-counting-up", "is-counting-down");
        }, 650);
        return;
      }

      var startTs = null;
      function step(ts) {
        if (startTs === null) startTs = ts;
        var elapsed = ts - startTs;
        var progress = Math.min(elapsed / ANIM_DURATION_MS, 1);

        var eased = 1 - Math.pow(1 - progress, 3);
        var current = fromVal + (toVal - fromVal) * eased;
        amtEl.textContent = formatMoney(current, currency);

        if (progress < 1) {
          state.animFrames[currency] = window.requestAnimationFrame(step);
        } else {
          delete state.animFrames[currency];
          amtEl.textContent = formatMoney(toVal, currency);
          window.setTimeout(function () {
            amtEl.classList.remove("is-counting-up", "is-counting-down");
          }, 350);
        }
      }

      state.animFrames[currency] = window.requestAnimationFrame(step);
    }

    function renderBalanceCards(prevBalances, animatedDirection) {
      var currencies = orderedCurrencies(state.balances);
      for (var i = 0; i < currencies.length; i++) {
        var cur = currencies[i];
        var card = ensureBalanceCard(cur);
        if (!card) continue;

        var amtEl = card.querySelector('[data-balance-currency="' + cur + '"]');
        var inEl = card.querySelector('[data-income-currency="' + cur + '"]');
        var outEl = card.querySelector('[data-expense-currency="' + cur + '"]');

        var nextVal = roundMoney(state.balances[cur] || 0);
        var prevVal = prevBalances ? roundMoney(prevBalances[cur] || 0) : nextVal;

        if (inEl) {
          inEl.textContent = "Giriş: " + formatMoney(state.totalsIncome[cur] || 0, cur);
        }
        if (outEl) {
          outEl.textContent = "Çıkış: " + formatMoney(state.totalsExpense[cur] || 0, cur);
        }

        if (animatedDirection && prevVal !== nextVal) {
          animateCurrencyBalance(cur, prevVal, nextVal, animatedDirection);
        } else if (amtEl) {
          amtEl.textContent = formatMoney(nextVal, cur);
        }
      }
    }

    function buildEntryRow(mode, index, preserved) {
      var isIncome = mode === "income";
      var row = document.createElement("div");
      row.className = "budget-entry-row";
      row.setAttribute("data-row-index", String(index));

      var title = document.createElement("p");
      title.className = "budget-entry-row-title";
      title.textContent = (isIncome ? "Gelir Kaynağı #" : "Gider Kalemi #") + (index + 1);
      row.appendChild(title);

      var fields = document.createElement("div");
      fields.className = "budget-entry-fields";

      var amtWrap = document.createElement("div");
      amtWrap.className = "event-field";
      var amtId = mode + "Amount_" + index;
      var amtLabel = document.createElement("label");
      amtLabel.className = "event-label";
      amtLabel.setAttribute("for", amtId);
      amtLabel.textContent = isIncome ? "Girilen Tutar" : "Çıkan Tutar";

      var amtInput = document.createElement("input");
      amtInput.type = "number";
      amtInput.id = amtId;
      amtInput.className = "event-input";
      amtInput.setAttribute("data-field", "amount");
      amtInput.step = "0.01";
      amtInput.min = "0.01";
      amtInput.inputMode = "decimal";
      amtInput.placeholder = "0,00";
      amtInput.required = true;
      if (preserved && preserved.amount) amtInput.value = preserved.amount;

      amtWrap.appendChild(amtLabel);
      amtWrap.appendChild(amtInput);

      var curWrap = document.createElement("div");
      curWrap.className = "event-field";
      var curId = mode + "Currency_" + index;
      var curLabel = document.createElement("label");
      curLabel.className = "event-label";
      curLabel.setAttribute("for", curId);
      curLabel.textContent = isIncome ? "Para Birimi" : "Para Cinsi";

      var curSelect = document.createElement("select");
      curSelect.id = curId;
      curSelect.className = "event-input budget-select";
      curSelect.setAttribute("data-field", "currency");
      for (var c = 0; c < SUPPORTED_CURRENCIES.length; c++) {
        var opt = document.createElement("option");
        opt.value = SUPPORTED_CURRENCIES[c].code;
        opt.textContent = SUPPORTED_CURRENCIES[c].code;
        if ((preserved && preserved.currency) === opt.value) {
          opt.selected = true;
        }
        curSelect.appendChild(opt);
      }

      curWrap.appendChild(curLabel);
      curWrap.appendChild(curSelect);

      var descWrap = document.createElement("div");
      descWrap.className = "event-field budget-entry-desc-field";
      var descId = mode + "Desc_" + index;
      var descLabel = document.createElement("label");
      descLabel.className = "event-label";
      descLabel.setAttribute("for", descId);
      descLabel.textContent = isIncome ? "Gelir Kaynağı / Açıklama" : "Çıkış Nedeni / Açıklama";

      var descInput = document.createElement("input");
      descInput.type = "text";
      descInput.id = descId;
      descInput.className = "event-input";
      descInput.setAttribute("data-field", "description");
      descInput.maxLength = 160;
      descInput.placeholder = isIncome
        ? "Örn. Sponsor katkısı, etkinlik geliri, nakit girişi..."
        : "Örn. Etkinlik afiş baskısı, ikram gideri, salon kirası...";
      descInput.required = true;
      if (preserved && preserved.description) descInput.value = preserved.description;

      descWrap.appendChild(descLabel);
      descWrap.appendChild(descInput);

      fields.appendChild(amtWrap);
      fields.appendChild(curWrap);
      fields.appendChild(descWrap);
      row.appendChild(fields);

      var rowErr = document.createElement("p");
      rowErr.className = "field-error";
      rowErr.setAttribute("data-row-error", "true");
      rowErr.setAttribute("role", "alert");
      rowErr.setAttribute("hidden", "hidden");
      row.appendChild(rowErr);

      return row;
    }

    function snapshotRowValues(container) {
      var list = [];
      if (!container) return list;
      var rows = container.querySelectorAll(".budget-entry-row");
      for (var i = 0; i < rows.length; i++) {
        var amt = rows[i].querySelector('[data-field="amount"]');
        var cur = rows[i].querySelector('[data-field="currency"]');
        var desc = rows[i].querySelector('[data-field="description"]');
        list.push({
          amount: amt ? amt.value : "",
          currency: cur ? cur.value : "TL",
          description: desc ? desc.value : ""
        });
      }
      return list;
    }

    function renderEntryRows(mode, container, count, preserveValues) {
      if (!container) return;
      var clamped = Math.max(1, Math.min(MAX_ENTRIES, Number(count) || 1));
      var saved = preserveValues ? snapshotRowValues(container) : [];
      container.textContent = "";
      var frag = document.createDocumentFragment();
      for (var i = 0; i < clamped; i++) {
        frag.appendChild(buildEntryRow(mode, i, saved[i] || null));
      }
      container.appendChild(frag);
    }

    function syncCountPills(selectorEl, activeVal) {
      if (!selectorEl) return;
      var btns = selectorEl.querySelectorAll(".count-pill[data-count-val]");
      for (var i = 0; i < btns.length; i++) {
        var isMatch = Number(btns[i].getAttribute("data-count-val")) === activeVal;
        btns[i].classList.toggle("is-active", isMatch);
        btns[i].setAttribute("aria-pressed", isMatch ? "true" : "false");
      }
    }

    function collectAndValidateRows(container, mode) {
      var rows = container ? container.querySelectorAll(".budget-entry-row") : [];
      var entries = [];
      var firstInvalidEl = null;

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var amtEl = row.querySelector('[data-field="amount"]');
        var curEl = row.querySelector('[data-field="currency"]');
        var descEl = row.querySelector('[data-field="description"]');
        var errEl = row.querySelector('[data-row-error]');

        if (errEl) {
          errEl.textContent = "";
          errEl.setAttribute("hidden", "hidden");
        }
        if (amtEl) amtEl.setAttribute("aria-invalid", "false");
        if (descEl) descEl.setAttribute("aria-invalid", "false");

        var amount = parsePositiveAmount(amtEl ? amtEl.value : "");
        var currency = String(curEl ? curEl.value : "TL").toUpperCase();
        var desc = String(descEl ? descEl.value : "")
          .replace(/\s+/g, " ")
          .trim();

        var errMsg = "";
        if (isNaN(amount)) {
          errMsg =
            mode === "income"
              ? "Lütfen geçerli ve sıfırdan büyük bir tutar girin."
              : "Lütfen geçerli ve sıfırdan büyük bir çıkış tutarı girin.";
          if (amtEl) {
            amtEl.setAttribute("aria-invalid", "true");
            if (!firstInvalidEl) firstInvalidEl = amtEl;
          }
        } else if (!desc || desc.length < 2) {
          errMsg =
            mode === "income"
              ? "Gelir kaynağı / açıklama alanı en az 2 karakter olmalıdır."
              : "Çıkış nedeni / açıklama alanı en az 2 karakter olmalıdır.";
          if (descEl) {
            descEl.setAttribute("aria-invalid", "true");
            if (!firstInvalidEl) firstInvalidEl = descEl;
          }
        }

        if (errMsg) {
          if (errEl) {
            errEl.textContent = errMsg;
            errEl.removeAttribute("hidden");
          }
        } else {
          entries.push({
            amount: amount,
            currency: currency,
            description: desc
          });
        }
      }

      if (firstInvalidEl) {
        firstInvalidEl.focus();
        return null;
      }
      return entries;
    }

    function buildTransactionRow(tx) {
      var li = document.createElement("li");
      li.className = "budget-tx-row";

      var badge = document.createElement("span");
      badge.className =
        "budget-tx-badge " +
        (tx.type === "income" ? "budget-tx-badge--in" : "budget-tx-badge--out");
      badge.textContent = tx.type === "income" ? "Giriş" : "Çıkış";

      var info = document.createElement("div");
      info.className = "budget-tx-info";

      var descEl = document.createElement("p");
      descEl.className = "budget-tx-desc";
      descEl.textContent = tx.description || "—";

      var metaEl = document.createElement("p");
      metaEl.className = "budget-tx-meta";
      var who = tx.recordedByName || tx.recordedByEmail || "Yetkili";
      metaEl.textContent = formatDateTime(tx.createdAt) + " · Kaydeden: " + who;

      info.appendChild(descEl);
      info.appendChild(metaEl);

      var amtEl = document.createElement("span");
      amtEl.className =
        "budget-tx-amount " +
        (tx.type === "income" ? "budget-tx-amount--in" : "budget-tx-amount--out");
      amtEl.textContent =
        (tx.type === "income" ? "+" : "-") + formatMoney(tx.amount, tx.currency);

      li.appendChild(badge);
      li.appendChild(info);
      li.appendChild(amtEl);
      return li;
    }

    function renderRecentTransactions() {
      if (!recentListEl) return;
      recentListEl.textContent = "";

      var preview = state.transactions.slice(0, 5);
      if (recentMetaEl) {
        recentMetaEl.textContent =
          state.transactions.length > 0
            ? "Toplam " + state.transactions.length + " hareketten en son " + preview.length + " işlem gösteriliyor."
            : "En son kaydedilen gelir ve gider işlemleri.";
      }

      if (preview.length === 0) {
        if (recentEmptyEl) recentEmptyEl.removeAttribute("hidden");
        return;
      }

      if (recentEmptyEl) recentEmptyEl.setAttribute("hidden", "hidden");
      var frag = document.createDocumentFragment();
      for (var i = 0; i < preview.length; i++) {
        frag.appendChild(buildTransactionRow(preview[i]));
      }
      recentListEl.appendChild(frag);
    }

    function renderHistoryModal() {
      if (!historyListEl) return;

      var incomeCount = 0;
      var expenseCount = 0;
      for (var i = 0; i < state.transactions.length; i++) {
        if (state.transactions[i].type === "income") incomeCount++;
        else expenseCount++;
      }

      if (historyCountAll) historyCountAll.textContent = String(state.transactions.length);
      if (historyCountIncome) historyCountIncome.textContent = String(incomeCount);
      if (historyCountExpense) historyCountExpense.textContent = String(expenseCount);

      var filtered = state.transactions.filter(function (tx) {
        if (state.historyFilter === "income") return tx.type === "income";
        if (state.historyFilter === "expense") return tx.type === "expense";
        return true;
      });

      historyListEl.textContent = "";
      if (filtered.length === 0) {
        if (historyEmptyEl && historyEmptyTextEl) {
          historyEmptyTextEl.textContent =
            state.transactions.length === 0
              ? "Henüz kaydedilmiş bir bütçe hareketi bulunmuyor."
              : "Seçili filtrede gösterilecek bütçe hareketi bulunamadı.";
          historyEmptyEl.removeAttribute("hidden");
        }
        return;
      }

      if (historyEmptyEl) historyEmptyEl.setAttribute("hidden", "hidden");
      var frag = document.createDocumentFragment();
      for (var j = 0; j < filtered.length; j++) {
        frag.appendChild(buildTransactionRow(filtered[j]));
      }
      historyListEl.appendChild(frag);
    }

    if (incomeCountSelector) {
      incomeCountSelector.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".count-pill") : null;
        if (!btn) return;
        state.incomeRowCount = Number(btn.getAttribute("data-count-val")) || 1;
        syncCountPills(incomeCountSelector, state.incomeRowCount);
        renderEntryRows("income", incomeRowsContainer, state.incomeRowCount, true);
        hideModalAlert(incomeModalAlert);
      });
    }

    if (expenseCountSelector) {
      expenseCountSelector.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".count-pill") : null;
        if (!btn) return;
        state.expenseRowCount = Number(btn.getAttribute("data-count-val")) || 1;
        syncCountPills(expenseCountSelector, state.expenseRowCount);
        renderEntryRows("expense", expenseRowsContainer, state.expenseRowCount, true);
        hideModalAlert(expenseModalAlert);
      });
    }

    if (openIncomeBtn) {
      openIncomeBtn.addEventListener("click", function () {
        state.incomeRowCount = 1;
        syncCountPills(incomeCountSelector, 1);
        renderEntryRows("income", incomeRowsContainer, 1, false);
        hideModalAlert(incomeModalAlert);
        openDialog(incomeDialog);
      });
    }

    if (openExpenseBtn) {
      openExpenseBtn.addEventListener("click", function () {
        state.expenseRowCount = 1;
        syncCountPills(expenseCountSelector, 1);
        renderEntryRows("expense", expenseRowsContainer, 1, false);
        hideModalAlert(expenseModalAlert);
        openDialog(expenseDialog);
      });
    }

    function openHistory() {
      state.historyFilter = "all";
      if (historyFilterBar) {
        var pills = historyFilterBar.querySelectorAll(".filter-pill");
        for (var i = 0; i < pills.length; i++) {
          var active = pills[i].getAttribute("data-tx-filter") === "all";
          pills[i].classList.toggle("is-active", active);
          pills[i].setAttribute("aria-pressed", active ? "true" : "false");
        }
      }
      renderHistoryModal();
      openDialog(historyDialog);
    }

    if (openHistoryBtn) openHistoryBtn.addEventListener("click", openHistory);
    if (openHistoryFromRecentBtn) openHistoryFromRecentBtn.addEventListener("click", openHistory);

    if (incomeCloseBtn) incomeCloseBtn.addEventListener("click", function () { closeDialog(incomeDialog); });
    if (incomeCancelBtn) incomeCancelBtn.addEventListener("click", function () { closeDialog(incomeDialog); });
    if (expenseCloseBtn) expenseCloseBtn.addEventListener("click", function () { closeDialog(expenseDialog); });
    if (expenseCancelBtn) expenseCancelBtn.addEventListener("click", function () { closeDialog(expenseDialog); });
    if (historyCloseBtn) historyCloseBtn.addEventListener("click", function () { closeDialog(historyDialog); });

    if (historyFilterBar) {
      historyFilterBar.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".filter-pill") : null;
        if (!btn) return;
        state.historyFilter = btn.getAttribute("data-tx-filter") || "all";
        var pills = historyFilterBar.querySelectorAll(".filter-pill");
        for (var i = 0; i < pills.length; i++) {
          var active = pills[i] === btn;
          pills[i].classList.toggle("is-active", active);
          pills[i].setAttribute("aria-pressed", active ? "true" : "false");
        }
        renderHistoryModal();
      });
    }

    if (incomeForm) {
      incomeForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideModalAlert(incomeModalAlert);
        if (!state.adminCtx || state.adminCtx.authority !== "muhasebe") return;

        var entries = collectAndValidateRows(incomeRowsContainer, "income");
        if (!entries || entries.length === 0) return;

        var prevBalances = {};
        var nextBalances = {};
        var nextIncome = {};
        var curKeys = Object.keys(state.balances);
        for (var i = 0; i < curKeys.length; i++) {
          var k = curKeys[i];
          prevBalances[k] = roundMoney(state.balances[k]);
          nextBalances[k] = roundMoney(state.balances[k]);
          nextIncome[k] = roundMoney(state.totalsIncome[k] || 0);
        }

        var nowMs = Date.now();
        var newTxs = [];
        for (var j = 0; j < entries.length; j++) {
          var item = entries[j];
          var cur = item.currency;
          if (!nextBalances.hasOwnProperty(cur)) {
            prevBalances[cur] = 0;
            nextBalances[cur] = 0;
            nextIncome[cur] = 0;
            state.totalsExpense[cur] = 0;
          }
          nextBalances[cur] = roundMoney(nextBalances[cur] + item.amount);
          nextIncome[cur] = roundMoney(nextIncome[cur] + item.amount);

          newTxs.push({
            id: generateTxId("in"),
            type: "income",
            amount: item.amount,
            currency: cur,
            description: item.description,
            recordedByUid: state.adminCtx.adminUid,
            recordedByName: state.adminCtx.displayName || state.adminCtx.email || "Yetkili",
            recordedByEmail: state.adminCtx.email || "",
            createdAt: new Date(nowMs + j).toISOString()
          });
        }

        UI.setButtonLoading(incomeSubmitBtn, true, "Kaydediliyor...", "Onayla");

        persistBudgetBatch(cfg, Auth, state.adminCtx.session, newTxs, nextBalances)
          .then(function () {
            UI.setButtonLoading(incomeSubmitBtn, false, "Kaydediliyor...", "Onayla");
            state.balances = nextBalances;
            state.totalsIncome = nextIncome;
            for (var n = newTxs.length - 1; n >= 0; n--) {
              state.transactions.unshift(newTxs[n]);
            }

            closeDialog(incomeDialog);
            renderBalanceCards(prevBalances, "up");
            renderRecentTransactions();
            notify(
              newTxs.length + " gelir kaydı eklendi ve genel bakiye güncellendi.",
              "success"
            );
          })
          .catch(function (err) {
            UI.setButtonLoading(incomeSubmitBtn, false, "Kaydediliyor...", "Onayla");
            Auth.logTechnicalError("Bütçe Gelir Kaydı", err);
            showModalAlert(
              incomeModalAlert,
              "Gelir kaydı şu anda kaydedilemedi. Lütfen tekrar deneyin."
            );
          });
      });
    }

    if (expenseForm) {
      expenseForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideModalAlert(expenseModalAlert);
        if (!state.adminCtx || state.adminCtx.authority !== "muhasebe") return;

        var entries = collectAndValidateRows(expenseRowsContainer, "expense");
        if (!entries || entries.length === 0) return;

        var deductionsByCurrency = {};
        for (var d = 0; d < entries.length; d++) {
          var curCode = entries[d].currency;
          deductionsByCurrency[curCode] = roundMoney(
            (deductionsByCurrency[curCode] || 0) + entries[d].amount
          );
        }

        var dedKeys = Object.keys(deductionsByCurrency);
        for (var c = 0; c < dedKeys.length; c++) {
          var cur = dedKeys[c];
          var available = roundMoney(state.balances[cur] || 0);
          var requested = deductionsByCurrency[cur];
          if (requested > available) {
            showModalAlert(
              expenseModalAlert,
              "Yetersiz bakiye: " +
                cur +
                " için çıkış yapılmak istenen toplam tutar (" +
                formatMoney(requested, cur) +
                ") mevcut bakiyeden (" +
                formatMoney(available, cur) +
                ") fazla olamaz."
            );
            return;
          }
        }

        var prevBalances = {};
        var nextBalances = {};
        var nextExpense = {};
        var curKeys = Object.keys(state.balances);
        for (var i = 0; i < curKeys.length; i++) {
          var k = curKeys[i];
          prevBalances[k] = roundMoney(state.balances[k]);
          nextBalances[k] = roundMoney(state.balances[k]);
          nextExpense[k] = roundMoney(state.totalsExpense[k] || 0);
        }

        var nowMs = Date.now();
        var newTxs = [];
        for (var j = 0; j < entries.length; j++) {
          var item = entries[j];
          var ec = item.currency;
          nextBalances[ec] = roundMoney((nextBalances[ec] || 0) - item.amount);
          nextExpense[ec] = roundMoney((nextExpense[ec] || 0) + item.amount);

          newTxs.push({
            id: generateTxId("out"),
            type: "expense",
            amount: item.amount,
            currency: ec,
            description: item.description,
            recordedByUid: state.adminCtx.adminUid,
            recordedByName: state.adminCtx.displayName || state.adminCtx.email || "Yetkili",
            recordedByEmail: state.adminCtx.email || "",
            createdAt: new Date(nowMs + j).toISOString()
          });
        }

        UI.setButtonLoading(expenseSubmitBtn, true, "Kaydediliyor...", "Onayla");

        persistBudgetBatch(cfg, Auth, state.adminCtx.session, newTxs, nextBalances)
          .then(function () {
            UI.setButtonLoading(expenseSubmitBtn, false, "Kaydediliyor...", "Onayla");
            state.balances = nextBalances;
            state.totalsExpense = nextExpense;
            for (var n = newTxs.length - 1; n >= 0; n--) {
              state.transactions.unshift(newTxs[n]);
            }

            closeDialog(expenseDialog);
            renderBalanceCards(prevBalances, "down");
            renderRecentTransactions();
            notify(
              newTxs.length + " gider kaydı işlendi ve genel bakiye güncellendi.",
              "success"
            );
          })
          .catch(function (err) {
            UI.setButtonLoading(expenseSubmitBtn, false, "Kaydediliyor...", "Onayla");
            Auth.logTechnicalError("Bütçe Gider Kaydı", err);
            showModalAlert(
              expenseModalAlert,
              "Gider kaydı şu anda kaydedilemedi. Lütfen tekrar deneyin."
            );
          });
      });
    }

    function refreshBudget() {
      if (
        !state.adminCtx ||
        !state.adminCtx.session ||
        state.adminCtx.authority !== "muhasebe"
      ) {
        return Promise.resolve();
      }

      return fetchBudgetData(cfg, Auth, state.adminCtx.session)
        .then(function (result) {
          state.balances = result.balances;
          state.totalsIncome = result.totalsIncome;
          state.totalsExpense = result.totalsExpense;
          state.transactions = result.transactions;

          if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
          renderBalanceCards(null, "");
          renderRecentTransactions();
        })
        .catch(function (err) {
          if (loadingEl) loadingEl.setAttribute("hidden", "hidden");
          Auth.logTechnicalError("Bütçe Verisi Yükleme", err);
          notify("Bütçe verileri yüklenemedi. Lütfen sayfayı yenileyin.", "error");
        });
    }

    function onAdminReady(ctx) {
      if (!ctx || ctx.authority !== "muhasebe") return;
      state.adminCtx = ctx;
      refreshBudget();
    }

    window.AtaturkBudget = {
      onAdminReady: onAdminReady,
      refresh: refreshBudget
    };

    if (window.AtaturkAdmin && window.AtaturkAdmin.authority === "muhasebe") {
      onAdminReady(window.AtaturkAdmin);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminBudgetModule);
  } else {
    initAdminBudgetModule();
  }
})(window, document);
