
const STORAGE_KEY = "hassalaty_bright_v1";

const denominations = [5, 10, 20, 50, 100, 200];

let data = {
  transactions: []
};

// تحميل البيانات المحفوظة
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed.transactions)) {
        data.transactions = parsed.transactions;
      }

      return;
    }

    // محاولة استرجاع سجل قديم لو موجود
    const oldKeys = [
      "hassalaty_complete_v3",
      "hassalaty_complete_v2",
      "hassalaty_data_v1",
      "hassalaty_data"
    ];

    for (const key of oldKeys) {
      const old = localStorage.getItem(key);
      if (!old) continue;

      const parsed = JSON.parse(old);
      const oldTransactions = parsed.transactions || parsed.history;

      if (Array.isArray(oldTransactions)) {
        data.transactions = oldTransactions
          .map(normalizeOldTransaction)
          .filter(Boolean);

        saveData();
        return;
      }

      const oldBalance = Number(
        parsed.balance ?? parsed.totalBalance ?? parsed.total ?? 0
      );

      if (Number.isFinite(oldBalance) && oldBalance > 0) {
        data.transactions = [{
          id: Date.now(),
          type: "deposit",
          amount: oldBalance,
          denomination: 0,
          date: new Date().toISOString(),
          note: "رصيد مسترجع من نسخة سابقة"
        }];

        saveData();
        return;
      }
    }
  } catch (error) {
    console.error("حدثت مشكلة في تحميل البيانات:", error);
  }
}

function normalizeOldTransaction(item) {
  if (!item || typeof item !== "object") return null;

  const amount = Number(item.amount ?? item.value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rawType = String(item.type || item.action || "").toLowerCase();

  const isWithdrawal =
    rawType.includes("withdraw") ||
    rawType.includes("minus") ||
    rawType.includes("سحب") ||
    rawType.includes("خصم");

  return {
    id: item.id || Date.now() + Math.random(),
    type: isWithdrawal ? "withdraw" : "deposit",
    amount,
    denomination: Number(item.denomination || item.valueOfNote || 0),
    date: item.date || item.createdAt || new Date().toISOString(),
    note: item.note || ""
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// حساب الرصيد
function getBalance() {
  return data.transactions.reduce((total, transaction) => {
    return total + (
      transaction.type === "deposit"
        ? Number(transaction.amount)
        : -Number(transaction.amount)
    );
  }, 0);
}

// إجمالي الإيداعات
function getDeposits() {
  return data.transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

// إجمالي الخصومات
function getWithdrawals() {
  return data.transactions
    .filter(t => t.type === "withdraw")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

// عدد الأوراق المتبقية من كل فئة
function getNoteCount(value) {
  return data.transactions.reduce((count, transaction) => {
    if (Number(transaction.denomination) !== value) return count;

    return count + (
      transaction.type === "deposit" ? 1 : -1
    );
  }, 0);
}

// صوت الإضافة والخصم
function playSound(type = "add") {
  const soundToggle = document.getElementById("soundToggle");

  if (soundToggle && !soundToggle.checked) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.type = "sine";

    oscillator.frequency.value =
      type === "add" ? 750 : 350;

    gain.gain.setValueAtTime(0.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + 0.18
    );

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);

    oscillator.onended = () => audio.close();
  } catch (error) {
    console.log("الصوت غير متاح");
  }
}

// إضافة ورقة نقدية
function addMoney(value) {
  data.transactions.push({
    id: Date.now() + Math.random(),
    type: "deposit",
    amount: value,
    denomination: value,
    date: new Date().toISOString()
  });

  saveData();
  renderAll();
  playSound("add");
}

// خصم ورقة نقدية
function removeMoney(value) {
  const count = getNoteCount(value);

  if (count <= 0 || getBalance() < value) {
    alert("مش عندك ورقة من الفئة دي تخصمها ❤️");
    return;
  }

  data.transactions.push({
    id: Date.now() + Math.random(),
    type: "withdraw",
    amount: value,
    denomination: value,
    date: new Date().toISOString()
  });

  saveData();
  renderAll();
  playSound("remove");
}

// التعامل مع أزرار الفئات
const moneyGrid = document.getElementById("moneyGrid");

if (moneyGrid) {
  moneyGrid.addEventListener("click", function(event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const value = Number(button.dataset.value);
    const action = button.dataset.action;

    if (!denominations.includes(value)) return;

    if (["add", "plus", "deposit"].includes(action)) {
      addMoney(value);
    } else if (["minus", "remove", "withdraw"].includes(action)) {
      removeMoney(value);
    }
  });
}

// تحديث الرصيد والإحصائيات
function renderBalance() {
  const balance = getBalance();

  const balanceElement = document.getElementById("balance");
  const depositsElement = document.getElementById("totalDeposits");
  const withdrawalsElement = document.getElementById("statWithdrawals");
  const statDepositsElement = document.getElementById("statDeposits");

  if (balanceElement) {
    balanceElement.textContent = balance.toLocaleString("en-US");
  }

  if (depositsElement) {
    depositsElement.textContent =
      getDeposits().toLocaleString("en-US") + " ج.م";
  }

  if (withdrawalsElement) {
    withdrawalsElement.textContent =
      getWithdrawals().toLocaleString("en-US") + " ج.م";
  }

  if (statDepositsElement) {
    statDepositsElement.textContent =
      getDeposits().toLocaleString("en-US") + " ج.م";
  }

  denominations.forEach(value => {
    const countElement = document.getElementById("count-" + value);

    if (countElement) {
      countElement.textContent = getNoteCount(value);
    }
  });
}

// تنسيق التاريخ
function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "تاريخ غير معروف";

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// عرض سجل العمليات
function renderTransactions() {
  const container = document.getElementById("transactions");
  const countElement = document.getElementById("transactionCount");

  if (!container) return;

  if (countElement) {
    countElement.textContent = data.transactions.length;
  }

  if (data.transactions.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div style="font-size:35px">🐷</div>
        لسه مفيش عمليات.. ابدأ حوّش أول فلوس!
      </div>
    `;
    return;
  }

  const latest = [...data.transactions].reverse().slice(0, 50);

  container.innerHTML = latest.map(transaction => {
    const isDeposit = transaction.type === "deposit";
    const sign = isDeposit ? "+" : "−";
    const className = isDeposit ? "deposit-amount" : "withdraw-amount";

    const description = transaction.denomination
      ? `ورقة نقدية فئة ${transaction.denomination} جنيه`
      : "رصيد مسترجع";

    return `
      <div class="transaction">
        <div class="transaction-info">
          <strong>${isDeposit ? "إضافة فلوس 💚" : "خصم فلوس ❤️"}</strong>
          <small>${description}</small>
          <small>${formatDate(transaction.date)}</small>
        </div>
        <span class="${className}">
          ${sign}${Number(transaction.amount).toLocaleString("en-US")} ج.م
        </span>
      </div>
    `;
  }).join("");
}

// تحديث كل أجزاء الموقع
function renderAll() {
  renderBalance();
  renderTransactions();
}

// الوضع الليلي
function setDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);

  const darkToggle = document.getElementById("darkToggle");
  const themeBtn = document.getElementById("themeBtn");

  if (darkToggle) darkToggle.checked = enabled;

  if (themeBtn) {
    themeBtn.textContent = enabled ? "☀️" : "🌙";
  }

  localStorage.setItem("hassalaty_dark_mode", enabled ? "1" : "0");
}

const darkToggle = document.getElementById("darkToggle");

if (darkToggle) {
  darkToggle.addEventListener("change", () => {
    setDarkMode(darkToggle.checked);
  });
}

const themeBtn = document.getElementById("themeBtn");

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    setDarkMode(!document.body.classList.contains("dark"));
  });
}

// اختبار الصوت
const testSound = document.getElementById("testSound");

if (testSound) {
  testSound.addEventListener("click", () => {
    playSound("add");
  });
}

// تصدير نسخة احتياطية
const backupBtn = document.getElementById("backupBtn");

if (backupBtn) {
  backupBtn.addEventListener("click", () => {
    const backup = {
      app: "Hasalty",
      version: 1,
      transactions: data.transactions
    };

    const file = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Hasalty-Backup.json";
    link.click();

    URL.revokeObjectURL(url);
  });
}

// استعادة نسخة احتياطية
const restoreBtn = document.getElementById("restoreBtn");
const restoreFile = document.getElementById("restoreFile");

if (restoreBtn && restoreFile) {
  restoreBtn.addEventListener("click", () => {
    restoreFile.click();
  });

  restoreFile.addEventListener("change", async () => {
    const file = restoreFile.files[0];

    if (!file) return;

    try {
      const content = await file.text();
      const backup = JSON.parse(content);

      if (!Array.isArray(backup.transactions)) {
        throw new Error("ملف النسخة الاحتياطية غير صحيح");
      }

      const validTransactions = backup.transactions.filter(t => {
        return (
          t &&
          ["deposit", "withdraw"].includes(t.type) &&
          Number.isFinite(Number(t.amount)) &&
          Number(t.amount) > 0
        );
      });

      const newData = { transactions: validTransactions };

      const newBalance = newData.transactions.reduce((sum, t) => {
        return sum + (
          t.type === "deposit"
            ? Number(t.amount)
            : -Number(t.amount)
        );
      }, 0);

      if (newBalance < 0) {
        throw new Error("النسخة الاحتياطية غير صالحة");
      }

      if (!confirm("استعادة النسخة هتستبدل البيانات الحالية. متأكد؟")) {
        restoreFile.value = "";
        return;
      }

      data = newData;
      saveData();
      renderAll();

      alert("تم استعادة بيانات حصّالتي بنجاح ❤️");
    } catch (error) {
      alert("مش قادر أقرأ الملف. اتأكد إنه نسخة احتياطية صحيحة.");
    }

    restoreFile.value = "";
  });
}

// تشغيل الموقع
loadData();
renderAll();

const savedDarkMode = localStorage.getItem("hassalaty_dark_mode");
setDarkMode(savedDarkMode === "1");
