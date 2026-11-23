
const STORAGE_KEY = "hassalaty_bright_v1";
const denominations = [5, 10, 20, 50, 100, 200];

let data = {
  transactions: [],
  goal: {
    name: "",
    amount: 0
  }
};

// تحميل البيانات
function loadData() {
  const keys = [
    STORAGE_KEY,
    "hassalaty_complete_v3",
    "hassalaty_complete_v2",
    "hassalaty_data_v1"
  ];

  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed.transactions)) {
        data.transactions = parsed.transactions
          .map(normalizeTransaction)
          .filter(Boolean);
      } else if (Array.isArray(parsed.history)) {
        data.transactions = parsed.history
          .map(normalizeTransaction)
          .filter(Boolean);
      }

      if (parsed.goal && typeof parsed.goal === "object") {
        data.goal = {
          name: String(parsed.goal.name || ""),
          amount: Math.max(0, Number(parsed.goal.amount) || 0)
        };
      }

      if (parsed.goalName || parsed.goalAmount) {
        data.goal.name = String(parsed.goalName || data.goal.name);
        data.goal.amount = Math.max(
          0,
          Number(parsed.goalAmount) || data.goal.amount
        );
      }

      // محاولة استرجاع الرصيد القديم لو مفيش سجل
      if (data.transactions.length === 0) {
        const oldBalance = Number(
          parsed.balance ?? parsed.totalBalance ?? parsed.total ?? 0
        );

        if (Number.isFinite(oldBalance) && oldBalance > 0) {
          data.transactions.push({
            id: Date.now(),
            type: "deposit",
            amount: oldBalance,
            denomination: 0,
            date: new Date().toISOString(),
            note: "رصيد مسترجع من نسخة سابقة"
          });
        }
      }

      saveData();
      return;
    } catch (error) {
      console.warn("تعذر قراءة نسخة قديمة:", key);
    }
  }
}

function normalizeTransaction(item) {
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

// الحسابات الأساسية
function getBalance() {
  return data.transactions.reduce((total, t) => {
    return total + (t.type === "deposit" ? Number(t.amount) : -Number(t.amount));
  }, 0);
}

function getDeposits() {
  return data.transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

function getWithdrawals() {
  return data.transactions
    .filter(t => t.type === "withdraw")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

function getNoteCount(value) {
  return data.transactions.reduce((count, t) => {
    if (Number(t.denomination) !== value) return count;
    return count + (t.type === "deposit" ? 1 : -1);
  }, 0);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US");
}

// الصوت
function playSound(type = "add") {
  const toggle = document.getElementById("soundToggle");
  if (toggle && !toggle.checked) return;

  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;

    const audio = new AudioClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = type === "add" ? 750 : 350;

    gain.gain.setValueAtTime(0.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);
    oscillator.onended = () => audio.close();
  } catch (error) {
    console.log("الصوت غير متاح");
  }
}

// إضافة ورقة
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

// خصم ورقة
function removeMoney(value) {
  if (getNoteCount(value) <= 0 || getBalance() < value) {
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

// أزرار الفئات
document.getElementById("moneyGrid").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const value = Number(button.dataset.value);
  if (!denominations.includes(value)) return;

  if (button.dataset.action === "add") {
    addMoney(value);
  } else if (button.dataset.action === "minus") {
    removeMoney(value);
  }
});

// الرصيد والإحصائيات
function renderBalance() {
  const balance = getBalance();

  document.getElementById("balance").textContent = money(balance);
  document.getElementById("totalDeposits").textContent = money(getDeposits()) + " ج.م";
  document.getElementById("statDeposits").textContent = money(getDeposits()) + " ج.م";
  document.getElementById("statWithdrawals").textContent = money(getWithdrawals()) + " ج.م";
  document.getElementById("transactionCount").textContent = data.transactions.length;

  denominations.forEach(value => {
    document.getElementById("count-" + value).textContent = getNoteCount(value);
  });
}

// التاريخ
function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "تاريخ غير معروف";

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// سجل العمليات
function renderTransactions() {
  const container = document.getElementById("transactions");

  if (data.transactions.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div style="font-size:35px">🐷</div>
        لسه مفيش عمليات.. ابدأ حوّش أول فلوس!
      </div>`;
    return;
  }

  container.innerHTML = [...data.transactions].reverse().map(t => {
    const deposit = t.type === "deposit";
    const description = t.denomination
      ? `فئة ${money(t.denomination)} جنيه`
      : "رصيد مسترجع";

    return `
      <div class="transaction">
        <div class="transaction-info">
          <strong>${deposit ? "إضافة فلوس 💚" : "خصم فلوس ❤️"}</strong>
          <small>${description}</small>
          <small>${formatDate(t.date)}</small>
        </div>
        <span class="${deposit ? "deposit-amount" : "withdraw-amount"}">
          ${deposit ? "+" : "−"}${money(t.amount)} ج.م
        </span>
      </div>`;
  }).join("");
}

// صفحة الإحصائيات
function renderStats() {
  document.getElementById("statsDeposits").textContent = money(getDeposits()) + " ج.م";
  document.getElementById("statsWithdrawals").textContent = money(getWithdrawals()) + " ج.م";
  document.getElementById("statsBalance").textContent = money(getBalance()) + " ج.م";
  document.getElementById("statsCount").textContent = data.transactions.length;

  document.getElementById("denominationStats").innerHTML =
    denominations.map(value => `
      <div class="denomination-stat">
        <span>💵 فئة ${value} جنيه</span>
        <strong>${getNoteCount(value)} ورقة</strong>
      </div>
    `).join("");
}

// الأهداف
function renderGoal() {
  const current = getBalance();
  const target = Number(data.goal.amount) || 0;

  document.getElementById("goalName").value = data.goal.name;
  document.getElementById("goalAmount").value = target || "";

  document.getElementById("savedGoalName").textContent =
    data.goal.name || "لسه مفيش هدف محدد";

  document.getElementById("goalCurrent").textContent = money(current);

  const percentage = target > 0
    ? Math.min(100, current / target * 100)
    : 0;

  document.getElementById("goalProgress").style.width = percentage + "%";
  document.getElementById("goalPercentage").textContent =
    Math.round(percentage) + "%";

  let remainingText = "حدد هدفك وابدأ التحويش!";

  if (target > 0 && current >= target) {
    remainingText = "مبروك! حققت هدفك 🎉";
  } else if (target > 0) {
    remainingText = "فاضلك " + money(target - current) + " جنيه على هدفك";
  }

  document.getElementById("goalRemaining").textContent = remainingText;
}

document.getElementById("saveGoal").addEventListener("click", () => {
  const name = document.getElementById("goalName").value.trim();
  const amount = Number(document.getElementById("goalAmount").value);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("اكتب اسم الهدف والمبلغ المطلوب الأول ❤️");
    return;
  }

  data.goal = { name, amount };
  saveData();
  renderGoal();
  alert("تم حفظ هدفك بنجاح 🎯");
});

// التنقل بين الخانات
const nav = document.getElementById("mainNav");

nav.addEventListener("click", event => {
  const button = event.target.closest(".nav-item");
  if (!button) return;

  const pageName = button.dataset.page;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item === button);
  });

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const selectedPage = document.getElementById("page-" + pageName);

  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// الآلة الحاسبة
let calcExpression = "";
let calcFinished = false;

const calcDisplay = document.getElementById("calcDisplay");

document.querySelector(".calculator-grid").addEventListener("click", event => {
  const button = event.target.closest("button[data-calc]");
  if (!button) return;

  const value = button.dataset.calc;

  if (value === "clear") {
    calcExpression = "";
    calcFinished = false;
  } else if (value === "delete") {
    calcExpression = calcExpression.slice(0, -1);
    calcFinished = false;
  } else if (value === "=") {
    try {
      if (!calcExpression || !/^[0-9+\-*/.() ]+$/.test(calcExpression)) {
        throw new Error("Invalid");
      }

      const result = Function('"use strict"; return (' + calcExpression + ')')();

      if (!Number.isFinite(result)) throw new Error("Invalid");

      calcExpression = String(Number(result.toFixed(8)));
      calcFinished = true;
    } catch (error) {
      calcExpression = "";
      calcDisplay.value = "خطأ";
      return;
    }
  } else {
    if (calcFinished && /[0-9.]/.test(value)) {
      calcExpression = "";
    }

    calcExpression += value;
    calcFinished = false;
  }

  calcDisplay.value = calcExpression || "0";
});

// الوضع الليلي
function setDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);

  document.getElementById("darkToggle").checked = enabled;
  document.getElementById("themeBtn").textContent = enabled ? "☀️" : "🌙";

  localStorage.setItem("hassalaty_dark_mode", enabled ? "1" : "0");
}

document.getElementById("darkToggle").addEventListener("change", event => {
  setDarkMode(event.target.checked);
});

document.getElementById("themeBtn").addEventListener("click", () => {
  setDarkMode(!document.body.classList.contains("dark"));
});

// اختبار الصوت
document.getElementById("testSound").addEventListener("click", () => {
  playSound("add");
});

// النسخ الاحتياطي
document.getElementById("backupBtn").addEventListener("click", () => {
  const backup = {
    app: "Hasalty",
    version: 2,
    transactions: data.transactions,
    goal: data.goal
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "Hasalty-Backup.json";
  link.click();

  URL.revokeObjectURL(url);
});

// استعادة النسخة الاحتياطية
const restoreFile = document.getElementById("restoreFile");

document.getElementById("restoreBtn").addEventListener("click", () => {
  restoreFile.click();
});

restoreFile.addEventListener("change", async () => {
  const file = restoreFile.files[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());

    if (!Array.isArray(backup.transactions)) {
      throw new Error("Invalid backup");
    }

    const transactions = backup.transactions
      .map(normalizeTransaction)
      .filter(Boolean);

    const balance = transactions.reduce((sum, t) => {
      return sum + (t.type === "deposit" ? t.amount : -t.amount);
    }, 0);

    if (balance < 0) throw new Error("Invalid balance");

    if (!confirm("استعادة النسخة هتستبدل بياناتك الحالية. متأكد؟")) {
      restoreFile.value = "";
      return;
    }

    data = {
      transactions,
      goal: {
        name: String(backup.goal?.name || ""),
        amount: Math.max(0, Number(backup.goal?.amount) || 0)
      }
    };

    saveData();
    renderAll();
    alert("تم استعادة بياناتك بنجاح ❤️");
  } catch (error) {
    alert("ملف النسخة الاحتياطية غير صحيح.");
  }

  restoreFile.value = "";
});

// تحديث كل الصفحات
function renderAll() {
  renderBalance();
  renderTransactions();
  renderStats();
  renderGoal();
}

// تشغيل الموقع
loadData();
renderAll();

setDarkMode(localStorage.getItem("hassalaty_dark_mode") === "1");
