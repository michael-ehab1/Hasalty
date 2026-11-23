
const STORAGE_KEY = "hassalaty_complete_v3";

const denominations = [5, 10, 20, 50, 100, 200];

let data = {
  transactions: [],
  goals: [],
  darkMode: false,
  sound: true,
  reminder: false,
  reminderTime: "20:00"
};

let withdrawalCounts = {};
let calendarDate = new Date();

const $ = id => document.getElementById(id);

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) data = { ...data, ...JSON.parse(saved) };
  } catch (error) {
    console.error("تعذر تحميل البيانات", error);
  }

  data.transactions ||= [];
  data.goals ||= [];

  $("soundToggle").checked = data.sound;
  $("reminderToggle").checked = data.reminder;
  $("reminderTime").value = data.reminderTime || "20:00";

  document.body.classList.toggle("dark", data.darkMode);
  $("themeBtn").textContent = data.darkMode ? "☀️" : "🌙";
}

// الصوت المميز
function playSound() {
  if (!data.sound) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();

    [880, 1174, 1568].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.16,
        context.currentTime + 0.02 + index * 0.05
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.28 + index * 0.05
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(context.currentTime + index * 0.05);
      oscillator.stop(context.currentTime + 0.35 + index * 0.05);
    });
  } catch (error) {
    console.log("الصوت غير متاح");
  }
}

function getBalance() {
  return data.transactions.reduce((total, transaction) => {
    return total + (transaction.type === "deposit"
      ? transaction.amount
      : -transaction.amount);
  }, 0);
}

function addTransaction(type, amount, description) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  if (type === "withdraw" && amount > getBalance()) {
    alert("رصيد الحصّالة مش كافي للسحب!");
    return false;
  }

  data.transactions.push({
    id: Date.now() + Math.random(),
    type,
    amount,
    description,
    date: new Date().toISOString()
  });

  saveData();
  playSound();
  renderAll();

  return true;
}

// إنشاء أزرار السحب
function setupWithdrawButtons() {
  const container = $("withdrawRows");

  container.innerHTML = denominations.map(value => `
    <div class="withdraw-row">
      <strong>${value} جنيه</strong>
      <div class="counter">
        <button type="button" data-action="minus" data-value="${value}">−</button>
        <span id="count-${value}">0</span>
        <button type="button" class="plus" data-action="plus" data-value="${value}">+</button>
      </div>
    </div>
  `).join("");

  container.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const value = Number(button.dataset.value);
    const action = button.dataset.action;

    if (action === "plus") {
      withdrawalCounts[value]++;
    } else if (action === "minus") {
      withdrawalCounts[value] = Math.max(0, withdrawalCounts[value] - 1);
    }

    updateWithdrawalTotal();
  });

  updateWithdrawalTotal();
}

function updateWithdrawalTotal() {
  let total = 0;

  denominations.forEach(value => {
    const count = withdrawalCounts[value] || 0;
    total += value * count;

    $(`count-${value}`).textContent = count;
  });

  $("withdrawTotal").textContent = `${total} جنيه`;
}

function confirmWithdrawal() {
  let total = 0;
  const details = [];

  denominations.forEach(value => {
    const count = withdrawalCounts[value] || 0;

    if (count > 0) {
      total += value * count;
      details.push(`${count} × ${value}`);
    }
  });

  if (total === 0) {
    alert("اختار عدد الورق الأول");
    return;
  }

  if (total > getBalance()) {
    alert("المبلغ أكبر من رصيد الحصّالة!");
    return;
  }

  const confirmed = confirm(
    `هتسحب ${total} جنيه\n${details.join(" + ")}\nمتأكد؟`
  );

  if (!confirmed) return;

  if (addTransaction("withdraw", total, details.join(" + "))) {
    denominations.forEach(value => withdrawalCounts[value] = 0);
    updateWithdrawalTotal();
  }
}

// الإيداع بالضغط على الفئة
function setupDepositButtons() {
  $("depositButtons").addEventListener("click", event => {
    const button = event.target.closest("[data-value]");
    if (!button) return;

    const value = Number(button.dataset.value);

    addTransaction("deposit", value, `إيداع فئة ${value} جنيه`);
  });
}

// عرض الرصيد والإحصائيات
function renderBalance() {
  const deposits = data.transactions
    .filter(t => t.type === "deposit");

  const withdrawals = data.transactions
    .filter(t => t.type === "withdraw");

  const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.amount, 0);

  $("balance").innerHTML = `${getBalance().toLocaleString("en-US")} <small>جنيه</small>`;
  $("totalDeposits").textContent = `${totalDeposits.toLocaleString("en-US")} ج`;
  $("totalWithdrawals").textContent = `${totalWithdrawals.toLocaleString("en-US")} ج`;
  $("transactionCount").textContent = data.transactions.length;
}

// سجل العمليات
function renderTransactions() {
  const container = $("transactions");

  const sorted = [...data.transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (!sorted.length) {
    container.innerHTML = '<p class="empty">لسه مفيش عمليات</p>';
    return;
  }

  container.innerHTML = sorted.map(t => {
    const deposit = t.type === "deposit";
    const date = new Date(t.date).toLocaleString("ar-EG");

    return `
      <div class="transaction">
        <div class="transaction-info">
          <strong>${deposit ? "🟢 إيداع" : "🔴 سحب"}</strong>
          <small>${t.description || ""}</small>
          <small>${date}</small>
        </div>
        <strong class="${deposit ? "deposit-amount" : "withdraw-amount"}">
          ${deposit ? "+" : "-"}${t.amount} ج
        </strong>
        <button class="delete-btn" data-delete="${t.id}" title="حذف العملية">🗑️</button>
      </div>
    `;
  }).join("");
}

$("transactions").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = Number(button.dataset.delete);
  const transaction = data.transactions.find(t => t.id === id);

  if (!transaction) return;

  if (confirm("حذف العملية دي؟")) {
    data.transactions = data.transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
  }
});

// الأهداف
function addGoal() {
  const name = $("goalName").value.trim();
  const amount = Number($("goalAmount").value);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("اكتب اسم الهدف ومبلغه بشكل صحيح");
    return;
  }

  data.goals.push({
    id: Date.now(),
    name,
    amount
  });

  $("goalName").value = "";
  $("goalAmount").value = "";

  saveData();
  renderGoals();
}

function renderGoals() {
  const container = $("goalsList");
  const balance = Math.max(0, getBalance());

  if (!data.goals.length) {
    container.innerHTML = '<p class="empty">لسه مفيش أهداف.. حدد أول حلم ليك 🎯</p>';
    return;
  }

  container.innerHTML = data.goals.map(goal => {
    const percent = Math.min(100, balance / goal.amount * 100);

    return `
      <div class="goal-card">
        <div class="goal-top">
          <strong>${escapeHTML(goal.name)}</strong>
          <button class="delete-btn" data-goal-delete="${goal.id}">🗑️</button>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
        <small>${balance.toLocaleString("en-US")} من ${goal.amount.toLocaleString("en-US")} جنيه - ${Math.floor(percent)}%</small>
      </div>
    `;
  }).join("");
}

$("goalsList").addEventListener("click", event => {
  const button = event.target.closest("[data-goal-delete]");
  if (!button) return;

  const id = Number(button.dataset.goalDelete);

  if (confirm("تحذف الهدف ده؟")) {
    data.goals = data.goals.filter(goal => goal.id !== id);
    saveData();
    renderGoals();
  }
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// التقويم
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل",
    "مايو", "يونيو", "يوليو", "أغسطس",
    "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  $("calendarTitle").textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const savingDates = new Set(
    data.transactions
      .filter(t => t.type === "deposit")
      .map(t => new Date(t.date).toDateString())
  );

  const today = new Date().toDateString();

  let html = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    .map(day => `<div class="day-name">${day}</div>`).join("");

  for (let i = 0; i < firstDay; i++) {
    html += "<div></div>";
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const saved = savingDates.has(date.toDateString());
    const isToday = date.toDateString() === today;

    html += `
      <div class="${saved ? "saved-day" : ""} ${isToday ? "today" : ""}">
        ${day}${saved ? " 💰" : ""}
      </div>
    `;
  }

  $("calendar").innerHTML = html;
}

$("prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

$("nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

// الإنجازات
function renderAchievements() {
  const balance = getBalance();

  const achievements = [
    { icon: "🌱", name: "أول خطوة", condition: balance >= 5 },
    { icon: "🥉", name: "50 جنيه", condition: balance >= 50 },
    { icon: "🥈", name: "100 جنيه", condition: balance >= 100 },
    { icon: "🥇", name: "500 جنيه", condition: balance >= 500 },
    { icon: "💎", name: "1000 جنيه", condition: balance >= 1000 },
    { icon: "👑", name: "5000 جنيه", condition: balance >= 5000 }
  ];

  $("achievements").innerHTML = achievements.map(item => `
    <div class="achievement ${item.condition ? "unlocked" : ""}">
      <span>${item.icon}</span>
      <strong>${item.name}</strong>
      <small>${item.condition ? "تم الإنجاز ✓" : "لسه مقفولة"}</small>
    </div>
  `).join("");
}

// الإحصائيات
function renderStats() {
  const deposits = data.transactions.filter(t => t.type === "deposit");

  const largest = deposits.length
    ? Math.max(...deposits.map(t => t.amount))
    : 0;

  const average = deposits.length
    ? deposits.reduce((sum, t) => sum + t.amount, 0) / deposits.length
    : 0;

  const days = new Set(
    deposits.map(t => new Date(t.date).toDateString())
  );

  $("largestDeposit").textContent = `${largest} ج`;
  $("savingDays").textContent = days.size;
  $("averageDeposit").textContent = `${Math.round(average)} ج`;

  const labels = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const now = new Date();
  const amounts = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);

    const amount = deposits
      .filter(t => new Date(t.date).toDateString() === date.toDateString())
      .reduce((sum, t) => sum + t.amount, 0);

    amounts.push({
      amount,
      label: labels[date.getDay()]
    });
  }

  const max = Math.max(...amounts.map(x => x.amount), 1);

  $("weeklyChart").innerHTML = amounts.map(item => `
    <div class="chart-column">
      <small>${item.amount || ""}</small>
      <div class="chart-bar" style="height:${Math.max(3, item.amount / max * 100)}%"></div>
      <small>${item.label}</small>
    </div>
  `).join("");
}

// الوضع الليلي
$("themeBtn").addEventListener("click", () => {
  data.darkMode = !data.darkMode;

  document.body.classList.toggle("dark", data.darkMode);
  $("themeBtn").textContent = data.darkMode ? "☀️" : "🌙";

  saveData();
});

// إعدادات الصوت
$("soundToggle").addEventListener("change", event => {
  data.sound = event.target.checked;
  saveData();
});

$("testSound").addEventListener("click", playSound);

// النسخ الاحتياطي
$("backupBtn").addEventListener("click", () => {
  const file = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "Hasalty-Backup.json";
  link.click();

  URL.revokeObjectURL(url);
});

// استرجاع النسخة
$("restoreBtn").addEventListener("click", () => {
  $("restoreFile").click();
});

$("restoreFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (
      !imported ||
      !Array.isArray(imported.transactions) ||
      !Array.isArray(imported.goals)
    ) {
      throw new Error("Invalid backup");
    }

    const validTransactions = imported.transactions.every(t =>
      ["deposit", "withdraw"].includes(t.type) &&
      Number.isFinite(t.amount) &&
      t.amount > 0 &&
      !Number.isNaN(new Date(t.date).getTime())
    );

    if (!validTransactions) throw new Error("Invalid transactions");

    const balance = imported.transactions.reduce((sum, t) =>
      sum + (t.type === "deposit" ? t.amount : -t.amount), 0
    );

    if (balance < 0) throw new Error("Invalid balance");

    if (confirm("استرجاع النسخة الاحتياطية؟ البيانات الحالية هتتستبدل.")) {
      data = {
        ...data,
        ...imported,
        transactions: imported.transactions,
        goals: imported.goals
      };

      saveData();
      loadData();
      renderAll();
      alert("تم استرجاع النسخة الاحتياطية");
    }
  } catch (error) {
    alert("ملف النسخة الاحتياطية غير صالح");
  }

  event.target.value = "";
});

// تصفير البيانات
$("resetBtn").addEventListener("click", () => {
  if (!confirm("متأكد إنك عايز تصفر الحصّالة؟")) return;
  if (!confirm("كل العمليات والأهداف هتتمسح نهائيًا. متأكد؟")) return;

  data.transactions = [];
  data.goals = [];

  saveData();
  renderAll();

  alert("تم تصفير الحصّالة");
});

// حاسبة التحويش
$("calculateBtn").addEventListener("click", () => {
  const target = Number($("savingTarget").value);
  const daily = Number($("dailySaving").value);

  if (
    !Number.isFinite(target) ||
    !Number.isFinite(daily) ||
    target <= 0 ||
    daily <= 0
  ) {
    $("calculatorResult").textContent = "اكتب أرقام صحيحة";
    return;
  }

  const remaining = Math.max(0, target - getBalance());
  const days = Math.ceil(remaining / daily);

  $("calculatorResult").textContent = remaining === 0
    ? "مبروك! وصلت لهدفك 🎉"
    : `هتوصل لهدفك خلال ${days} يوم تقريبًا 🎯`;
});

// التذكير اليومي أثناء فتح الموقع
let lastReminderDate = "";

$("reminderToggle").addEventListener("change", event => {
  data.reminder = event.target.checked;
  saveData();

  if (data.reminder && "Notification" in window &&
      Notification.permission === "default") {
    Notification.requestPermission();
  }
});

$("reminderTime").addEventListener("change", event => {
  data.reminderTime = event.target.value;
  saveData();
});

function checkReminder() {
  if (!data.reminder) return;

  const now = new Date();
  const currentTime =
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0");

  const today = now.toDateString();

  if (currentTime === data.reminderTime && lastReminderDate !== today) {
    lastReminderDate = today;

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("حصّالتي 🐷", {
        body: "متنساش تحوش النهارده ولو مبلغ صغير ❤️"
      });
    } else {
      alert("متنساش تحوش النهارده ولو مبلغ صغير ❤️");
    }
  }
}

function renderAll() {
  renderBalance();
  renderTransactions();
  renderGoals();
  renderCalendar();
  renderAchievements();
  renderStats();
}

// تشغيل الموقع
loadData();
setupWithdrawButtons();
setupDepositButtons();
renderAll();

setInterval(checkReminder, 30000);
