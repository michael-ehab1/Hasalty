
const STORAGE_KEY = "hassalaty_complete_v2";

const defaultData = {
  transactions: [],
  goals: [],
  sound: true,
  darkMode: true,
  reminder: false,
  reminderTime: "20:00"
};

let data = loadData();
let calendarDate = new Date();
let selectedCalendarDay = null;
let audioContext = null;
let lastReminderDate = "";

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);

    const parsed = JSON.parse(saved);

    return {
      ...defaultData,
      ...parsed,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : []
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function totalBalance() {
  return data.transactions.reduce((total, transaction) => {
    return total + (transaction.type === "deposit"
      ? Number(transaction.amount)
      : -Number(transaction.amount));
  }, 0);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Date(date).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

// صوت العملة
function playCoinSound() {
  if (!data.sound) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContext) audioContext = new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    function note(frequency, start, duration, volume) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.35,
        start + duration
      );

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    note(880, now, 0.18, 0.16);
    note(1320, now + 0.12, 0.25, 0.12);
    note(1760, now + 0.24, 0.35, 0.08);
  } catch (error) {
    console.log("Audio unavailable", error);
  }
}

// التنقل بين الصفحات
document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(button.dataset.page).classList.add("active");

    renderAll();
  });
});

// إضافة عملية
function addTransaction(type, amount, note = "") {
  amount = Number(amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("اكتب مبلغ صحيح");
    return false;
  }

  if (type === "withdraw" && amount > totalBalance()) {
    showToast("رصيدك مش كافي للسحب");
    return false;
  }

  data.transactions.unshift({
    id: Date.now() + Math.random(),
    type,
    amount,
    note,
    date: new Date().toISOString()
  });

  saveData();
  playCoinSound();
  renderAll();

  showToast(type === "deposit"
    ? `اتضاف ${money(amount)} جنيه للحصّالة! 💰`
    : `تم سحب ${money(amount)} جنيه`);

  return true;
}

// إضافة فئات العملات
document.querySelectorAll(".add-coin-btn").forEach(button => {
  button.addEventListener("click", () => {
    const card = button.closest(".money-card");
    const countInput = card.querySelector(".coin-count");
    const count = Number(countInput.value);
    const denomination = Number(button.dataset.value);

    if (!Number.isInteger(count) || count <= 0) {
      showToast("اكتب عدد العملات الأول");
      return;
    }

    const amount = count * denomination;

    if (addTransaction("deposit", amount, `إضافة ${count} عملة فئة ${denomination} جنيه`)) {
      countInput.value = 0;
    }
  });
});

// إضافة مبلغ يدوي
document.getElementById("customDepositBtn").addEventListener("click", () => {
  const amount = document.getElementById("customAmount").value;
  const note = document.getElementById("depositNote").value.trim();

  if (addTransaction("deposit", amount, note || "إضافة يدوية")) {
    document.getElementById("customAmount").value = "";
    document.getElementById("depositNote").value = "";
  }
});

// السحب
document.getElementById("withdrawBtn").addEventListener("click", () => {
  const amount = document.getElementById("withdrawAmount").value;
  const note = document.getElementById("withdrawNote").value.trim();

  if (addTransaction("withdraw", amount, note || "سحب من الحصّالة")) {
    document.getElementById("withdrawAmount").value = "";
    document.getElementById("withdrawNote").value = "";
  }
});

// عرض العمليات
function renderTransactions() {
  const container = document.getElementById("recentTransactions");

  if (!data.transactions.length) {
    container.innerHTML = '<p class="empty-state">لسه مفيش عمليات. ابدأ أول تحويشة! 💰</p>';
    return;
  }

  container.innerHTML = data.transactions.slice(0, 15).map(transaction => `
    <div class="transaction-item">
      <div>
        <strong>${transaction.type === "deposit" ? "🟢 إيداع" : "🔴 سحب"}</strong>
        <small>${escapeHTML(transaction.note || "")}</small>
        <small>${formatDate(transaction.date)}</small>
      </div>
      <div>
        <strong class="${transaction.type === "deposit" ? "deposit-value" : "withdraw-value"}">
          ${transaction.type === "deposit" ? "+" : "-"}${money(transaction.amount)} ج
        </strong>
        <button class="delete-transaction secondary-btn" data-id="${transaction.id}">حذف</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".delete-transaction").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!confirm("متأكد إنك عايز تحذف العملية؟")) return;

      data.transactions = data.transactions.filter(t => String(t.id) !== id);
      saveData();
      renderAll();
      showToast("تم حذف العملية");
    });
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// الإحصائيات الرئيسية
function renderHome() {
  const balance = totalBalance();
  const deposits = data.transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const withdrawals = data.transactions
    .filter(t => t.type === "withdraw")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  document.getElementById("totalBalance").textContent = money(balance);
  document.getElementById("totalDeposits").textContent = money(deposits);
  document.getElementById("totalWithdrawals").textContent = money(withdrawals);
  document.getElementById("transactionsCount").textContent = data.transactions.length;
  document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString("ar-EG");
}

// الأهداف
document.getElementById("addGoalBtn").addEventListener("click", () => {
  const name = document.getElementById("goalName").value.trim();
  const amount = Number(document.getElementById("goalAmount").value);
  const date = document.getElementById("goalDate").value;

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    showToast("اكتب اسم الهدف والمبلغ المطلوب");
    return;
  }

  data.goals.push({
    id: Date.now(),
    name,
    amount,
    date
  });

  saveData();

  document.getElementById("goalName").value = "";
  document.getElementById("goalAmount").value = "";
  document.getElementById("goalDate").value = "";

  renderAll();
  showToast("تم إضافة هدفك الجديد 🎯");
});

function renderGoals() {
  const container = document.getElementById("goalsList");

  if (!data.goals.length) {
    container.innerHTML = '<p class="empty-state">لسه مفيش أهداف. حدد أول حلم ليك! 🎯</p>';
    return;
  }

  container.innerHTML = data.goals.map(goal => {
    const progress = Math.min(100, Math.round(totalBalance() / goal.amount * 100));

    return `
      <div class="goal-card">
        <h3>🎯 ${escapeHTML(goal.name)}</h3>
        <div class="goal-meta">
          <span>${money(Math.min(totalBalance(), goal.amount))} جنيه</span>
          <span>${money(goal.amount)} جنيه</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="goal-meta">
          <span>${progress}% من الهدف</span>
          <span>${goal.date ? "الموعد: " + escapeHTML(goal.date) : "بدون موعد"}</span>
        </div>
        <button class="delete-goal secondary-btn" data-id="${goal.id}">حذف الهدف</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".delete-goal").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("متأكد إنك عايز تحذف الهدف؟")) return;

      data.goals = data.goals.filter(g => String(g.id) !== button.dataset.id);
      saveData();
      renderGoals();
      showToast("تم حذف الهدف");
    });
  });
}

// التقويم
document.getElementById("prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  document.getElementById("calendarMonth").textContent =
    calendarDate.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  const grid = document.getElementById("calendarGrid");
  const names = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

  let html = names.map(name =>
    `<div class="calendar-day weekday">${name}</div>`
  ).join("");

  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) html += "<div></div>";

  for (let day = 1; day <= days; day++) {
    const key = dateKey(new Date(year, month, day));

    const amount = data.transactions
      .filter(t => t.type === "deposit" && dateKey(t.date) === key)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const selected = selectedCalendarDay === key ? "selected" : "";
    const saved = amount > 0 ? "has-saving" : "";

    html += `
      <div class="calendar-day ${saved} ${selected}" data-date="${key}">
        ${day}
      </div>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll("[data-date]").forEach(dayElement => {
    dayElement.addEventListener("click", () => {
      selectedCalendarDay = dayElement.dataset.date;
      renderCalendar();

      const amount = data.transactions
        .filter(t => t.type === "deposit" && dateKey(t.date) === selectedCalendarDay)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      document.getElementById("calendarDetails").textContent =
        amount > 0
          ? `تحويش يوم ${selectedCalendarDay}: ${money(amount)} جنيه 💰`
          : `مفيش تحويش مسجل في يوم ${selectedCalendarDay}`;
    });
  });
}

// الإنجازات والتحديات
function renderAchievements() {
  const depositDays = new Set(
    data.transactions
      .filter(t => t.type === "deposit")
      .map(t => dateKey(t.date))
  );

  const dayCount = depositDays.size;
  const balance = totalBalance();

  const challenge = Math.min(30, dayCount);

  document.getElementById("challengeBar").style.width =
    `${challenge / 30 * 100}%`;

  document.getElementById("challengeText").textContent =
    `${challenge} من 30 يوم تحويش`;

  const badges = [
    { icon: "🌱", name: "أول تحويشة", unlocked: balance > 0 },
    { icon: "🪙", name: "500 جنيه", unlocked: balance >= 500 },
    { icon: "💰", name: "1000 جنيه", unlocked: balance >= 1000 },
    { icon: "🏆", name: "5000 جنيه", unlocked: balance >= 5000 },
    { icon: "🔥", name: "7 أيام تحويش", unlocked: dayCount >= 7 },
    { icon: "👑", name: "30 يوم تحويش", unlocked: dayCount >= 30 }
  ];

  document.getElementById("badgesList").innerHTML = badges.map(badge => `
    <div class="badge-card ${badge.unlocked ? "unlocked" : ""}">
      <span class="badge-icon">${badge.icon}</span>
      <strong>${badge.name}</strong>
      <small>${badge.unlocked ? "تم فتح الإنجاز" : "لم يتم فتحه بعد"}</small>
    </div>
  `).join("");
}

// الإحصائيات المتقدمة
function renderStats() {
  const daily = {};

  data.transactions
    .filter(t => t.type === "deposit")
    .forEach(t => {
      const key = dateKey(t.date);
      daily[key] = (daily[key] || 0) + Number(t.amount);
    });

  const values = Object.values(daily);
  const best = values.length ? Math.max(...values) : 0;
  const average = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;

  document.getElementById("bestDay").textContent = money(best);
  document.getElementById("averageSaving").textContent = money(average);
  document.getElementById("savingDays").textContent = values.length;

  const chart = document.getElementById("weeklyChart");
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    const key = dateKey(d);
    const amount = daily[key] || 0;

    days.push({
      name: d.toLocaleDateString("ar-EG", { weekday: "short" }),
      amount
    });
  }

  const max = Math.max(1, ...days.map(d => d.amount));

  chart.innerHTML = days.map(day => `
    <div class="chart-column">
      <span>${money(day.amount)}</span>
      <div class="chart-bar" style="height:${Math.max(3, day.amount / max * 115)}px"></div>
      <small>${day.name}</small>
    </div>
  `).join("");
}

// الوضع الليلي
function applyTheme() {
  document.body.classList.toggle("light-mode", !data.darkMode);
  document.getElementById("darkModeToggle").checked = data.darkMode;
}

document.getElementById("darkModeToggle").addEventListener("change", event => {
  data.darkMode = event.target.checked;
  saveData();
  applyTheme();
});

// إعداد الصوت
document.getElementById("soundToggle").checked = data.sound;

document.getElementById("soundToggle").addEventListener("change", event => {
  data.sound = event.target.checked;
  saveData();
  showToast(data.sound ? "تم تشغيل الصوت 🔊" : "تم كتم الصوت");
});

document.getElementById("testSoundBtn").addEventListener("click", () => {
  const wasEnabled = data.sound;
  data.sound = true;
  playCoinSound();
  data.sound = wasEnabled;
});

// النسخ الاحتياطي
document.getElementById("exportBtn").addEventListener("click", () => {
  const backup = {
    app: "Hasalty",
    version: 2,
    exportDate: new Date().toISOString(),
    data
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `Hasalty-Backup-${todayKey()}.json`;
  link.click();

  URL.revokeObjectURL(url);
  showToast("تم تجهيز النسخة الاحتياطية 💾");
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    const restored = backup.data || backup;

    if (!Array.isArray(restored.transactions) || !Array.isArray(restored.goals)) {
      throw new Error("Invalid backup");
    }

    if (!confirm("استعادة النسخة هتستبدل البيانات الحالية. متأكد؟")) return;

    data = {
      ...defaultData,
      ...restored
    };

    saveData();
    renderAll();
    applyTheme();
    showToast("تم استعادة بياناتك بنجاح 💚");
  } catch {
    showToast("ملف النسخة الاحتياطية غير صالح");
  } finally {
    event.target.value = "";
  }
});

// تصفير الحصالة
document.getElementById("resetBtn").addEventListener("click", () => {
  const first = confirm("⚠️ هل أنت متأكد؟ سيتم مسح الرصيد والأهداف وسجل العمليات.");
  if (!first) return;

  const second = confirm("تأكيد أخير: هل تريد تصفير حصّالتك بالكامل؟");
  if (!second) return;

  data.transactions = [];
  data.goals = [];

  saveData();
  renderAll();

  showToast("بدأنا من جديد يا Michael 🐷");
});

// حاسبة التحويش
document.getElementById("calculateBtn").addEventListener("click", () => {
  const daily = Number(document.getElementById("dailySaving").value);
  const target = Number(document.getElementById("calculatorTarget").value);

  if (daily <= 0 || target <= 0 || !Number.isFinite(daily) || !Number.isFinite(target)) {
    showToast("اكتب أرقام صحيحة");
    return;
  }

  const remaining = Math.max(0, target - totalBalance());
  const days = Math.ceil(remaining / daily);

  document.getElementById("calculatorResult").textContent =
    remaining === 0
      ? "مبروك! أنت وصلت لهدفك بالفعل 🎉"
      : `هتوصل لهدفك في حوالي ${days} يوم لو حوّشت ${money(daily)} جنيه يوميًا 💰`;
});

// التذكير
document.getElementById("reminderToggle").checked = data.reminder;
document.getElementById("reminderTime").value = data.reminderTime;

document.getElementById("saveReminderBtn").addEventListener("click", async () => {
  data.reminderTime = document.getElementById("reminderTime").value;
  data.reminder = document.getElementById("reminderToggle").checked;

  if (data.reminder && "Notification" in window) {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  saveData();
  showToast(data.reminder
    ? "تم حفظ التذكير. لازم الموقع يفضل مفتوح علشان يشتغل 🔔"
    : "تم إيقاف التذكير");
});

function checkReminder() {
  if (!data.reminder || !data.reminderTime) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = todayKey();

  if (currentTime === data.reminderTime && lastReminderDate !== today) {
    lastReminderDate = today;

    new Notification("حصّالتي 🐷", {
      body: "متنساش تحويشتك النهارده يا Michael 💰"
    });
  }
}

setInterval(checkReminder, 30000);

// تحديث الموقع
function renderAll() {
  renderHome();
  renderTransactions();
  renderGoals();
  renderCalendar();
  renderAchievements();
  renderStats();
}

applyTheme();
renderAll();

console.log("Hasalty is ready!");
