
const denominations = [5, 10, 20, 50, 100, 200];
const STORAGE_KEY = "hassalaty_data_v1";

let data = {
  counts: {5:0,10:0,20:0,50:0,100:0,200:0},
  goals: [],
  transactions: [],
  sound: true
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.counts && Array.isArray(saved.goals) && Array.isArray(saved.transactions)) {
      data = {
        ...data,
        ...saved,
        counts: {...data.counts, ...saved.counts}
      };
    }
  } catch(e) {
    console.error("تعذر تحميل البيانات", e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function totalMoney() {
  return denominations.reduce((sum, d) => sum + d * Number(data.counts[d] || 0), 0);
}

function moneyIn() {
  return data.transactions
    .filter(t => t.type === "in")
    .reduce((sum,t) => sum + t.amount, 0);
}

function moneyOut() {
  return data.transactions
    .filter(t => t.type === "out")
    .reduce((sum,t) => sum + t.amount, 0);
}

function piecesCount() {
  return denominations.reduce((sum,d) => sum + Number(data.counts[d] || 0),0);
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("ar-EG");
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth()+1).padStart(2,"0") + "-" +
    String(d.getDate()).padStart(2,"0");
}

function dateLabel(key) {
  return new Date(key + "T12:00:00").toLocaleDateString("ar-EG", {
    day:"numeric", month:"short", year:"numeric"
  });
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function playCoin() {
  if (!data.sound) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(850,ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1250,ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.16);
    oscillator.onended = () => ctx.close();
  } catch(e) {}
}

function toggleSound() {
  data.sound = !data.sound;
  saveData();
  updateSoundButton();
  toast(data.sound ? "الصوت اتفعل 🔊" : "الصوت اتقفل 🔇");
}

function updateSoundButton() {
  document.getElementById("soundBtn").textContent = data.sound ? "🔊 الصوت" : "🔇 الصوت";
}

function addMoney(denomination, change) {
  const next = Number(data.counts[denomination] || 0) + change;
  if (next < 0) {
    toast("مفيش عدد كافي من الفئة دي");
    return;
  }

  data.counts[denomination] = next;

  if (change > 0) {
    data.transactions.unshift({
      id: Date.now() + Math.random(),
      type: "in",
      amount: denomination,
      reason: "إضافة فئة " + denomination + " جنيه",
      date: new Date().toISOString(),
      day: todayKey()
    });
    document.getElementById("pig").classList.remove("coin-pop");
    void document.getElementById("pig").offsetWidth;
    document.getElementById("pig").classList.add("coin-pop");
    playCoin();
  } else {
    data.transactions.unshift({
      id: Date.now() + Math.random(),
      type: "out",
      amount: denomination,
      reason: "إزالة فئة " + denomination + " جنيه",
      date: new Date().toISOString(),
      day: todayKey()
    });
  }

  saveData();
  renderAll();
}

function renderMoney() {
  const table = document.getElementById("moneyTable");
  const cards = document.getElementById("moneyCards");

  table.innerHTML = denominations.map(d => `
    <tr>
      <td class="denom">${d} جنيه</td>
      <td>
        <div class="counter">
          <button onclick="addMoney(${d},-1)">−</button>
          <span>${data.counts[d]}</span>
          <button class="plus" onclick="addMoney(${d},1)">+</button>
        </div>
      </td>
      <td class="row-total">${formatMoney(d * data.counts[d])} ج</td>
    </tr>
  `).join("");

  cards.innerHTML = denominations.map(d => `
    <div class="money-card">
      <div class="denom">${d} جنيه</div>
      <div class="money-card-total">${formatMoney(d * data.counts[d])} ج</div>
      <div class="counter">
        <button onclick="addMoney(${d},-1)">−</button>
        <span>${data.counts[d]}</span>
        <button class="plus" onclick="addMoney(${d},1)">+</button>
      </div>
    </div>
  `).join("");
}

function renderHome() {
  document.getElementById("grandTotal").textContent = formatMoney(totalMoney());
  document.getElementById("totalIn").textContent = formatMoney(moneyIn()) + " ج";
  document.getElementById("totalOut").textContent = formatMoney(moneyOut()) + " ج";
  document.getElementById("totalPieces").textContent = formatMoney(piecesCount());
}

function showPage(page, button) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(page).classList.add("active");
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  if (button) button.classList.add("active");

  if (page === "goals") renderGoals();
  if (page === "history") renderHistory();
  if (page === "stats") renderStats();
}

function addGoal() {
  const name = document.getElementById("goalName").value.trim();
  const target = Number(document.getElementById("goalTarget").value);

  if (!name || !Number.isFinite(target) || target <= 0) {
    toast("اكتب اسم الهدف ومبلغ صحيح");
    return;
  }

  data.goals.push({
    id: Date.now() + Math.random(),
    name,
    target,
    saved: 0
  });

  document.getElementById("goalName").value = "";
  document.getElementById("goalTarget").value = "";
  saveData();
  renderGoals();
  toast("هدفك اتضاف بنجاح 🎯");
}

function updateGoal(id) {
  const goal = data.goals.find(g => String(g.id) === String(id));
  if (!goal) return;

  const amount = Number(document.getElementById("goalProgress-" + id).value);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast("اكتب مبلغ صحيح");
    return;
  }

  goal.saved = Math.min(goal.target, goal.saved + amount);
  document.getElementById("goalProgress-" + id).value = "";
  saveData();
  renderGoals();
  toast("تم تحديث تقدم الهدف");
}

function deleteGoal(id) {
  if (!confirm("متأكد إنك عايز تحذف الهدف؟")) return;
  data.goals = data.goals.filter(g => String(g.id) !== String(id));
  saveData();
  renderGoals();
}

function renderGoals() {
  const list = document.getElementById("goalsList");

  if (!data.goals.length) {
    list.innerHTML = '<div class="empty">لسه مفيش أهداف. أضف أول هدف ليك 🎯</div>';
    return;
  }

  list.innerHTML = data.goals.map(g => {
    const percent = Math.min(100, Math.round(g.saved / g.target * 100));
    return `
      <div class="goal">
        <div class="goal-head">
          <div>
            <div class="goal-name">${escapeHTML(g.name)}</div>
            <div class="goal-numbers">${formatMoney(g.saved)} من ${formatMoney(g.target)} جنيه</div>
          </div>
          <div class="circle" style="--p:${percent}%"><span>${percent}%</span></div>
        </div>
        <div class="progress"><div style="width:${percent}%"></div></div>
        <div class="goal-bottom">
          <span class="muted">${percent === 100 ? "مبروك! حققت هدفك 🎉" : "فاضلك " + formatMoney(g.target-g.saved) + " جنيه"}</span>
          <button class="danger-btn" onclick="deleteGoal('${g.id}')">حذف</button>
        </div>
        ${percent < 100 ? `
          <div class="field" style="margin-top:14px">
            <label>إضافة تقدم للهدف (تسجيل متابعة فقط)</label>
            <input type="number" min="1" id="goalProgress-${g.id}" placeholder="المبلغ">
          </div>
          <button class="secondary-btn" onclick="updateGoal('${g.id}')">تحديث التقدم</button>
        ` : ""}
      </div>
    `;
  }).join("");
}

function withdrawMoney() {
  const amount = Number(document.getElementById("withdrawAmount").value);
  const reason = document.getElementById("withdrawReason").value.trim();

  if (!Number.isInteger(amount) || amount <= 0 || amount % 5 !== 0) {
    toast("اكتب مبلغ صحيح من مضاعفات 5 جنيه");
    return;
  }
  if (!reason) {
    toast("اكتب سبب السحب");
    return;
  }
  if (amount > totalMoney()) {
    toast("المبلغ أكبر من رصيد الحصالة");
    return;
  }

  // إيجاد تركيبة دقيقة من الفئات الموجودة باستخدام برمجة ديناميكية
  const dp = Array(amount + 1).fill(null);
  dp[0] = Array(denominations.length).fill(0);

  for (let i = 0; i < denominations.length; i++) {
    const d = denominations[i];
    const available = Number(data.counts[d] || 0);
    for (let a = amount; a >= 0; a--) {
      if (!dp[a]) continue;
      for (let count = 1; count <= available && a + count*d <= amount; count++) {
        const next = a + count*d;
        if (!dp[next]) {
          const combination = [...dp[a]];
          combination[i] += count;
          dp[next] = combination;
        }
      }
    }
  }

  if (!dp[amount]) {
    toast("مش قادرين نكوّن المبلغ من الفئات الموجودة بالظبط");
    return;
  }

  denominations.forEach((d,i) => {
    data.counts[d] -= dp[amount][i];
  });

  data.transactions.unshift({
    id: Date.now() + Math.random(),
    type: "out",
    amount,
    reason,
    date: new Date().toISOString(),
    day: todayKey()
  });

  document.getElementById("withdrawAmount").value = "";
  document.getElementById("withdrawReason").value = "";
  saveData();
  renderAll();
  toast("تم تسجيل السحب بنجاح");
}

function renderHistory() {
  const list = document.getElementById("historyList");
  document.getElementById("historyCount").textContent =
    data.transactions.length + " عملية";

  const today = todayKey();
  const todayTransactions = data.transactions.filter(t => t.day === today);
  const todayIn = todayTransactions.filter(t => t.type === "in").reduce((s,t) => s+t.amount,0);
  const todayOut = todayTransactions.filter(t => t.type === "out").reduce((s,t) => s+t.amount,0);

  document.getElementById("dailySummary").innerHTML = `
    <strong>ملخص النهارده (${dateLabel(today)}):</strong><br>
    إيداعات: ${formatMoney(todayIn)} جنيه — سحوبات: ${formatMoney(todayOut)} جنيه — الصافي: ${formatMoney(todayIn-todayOut)} جنيه
  `;

  if (!data.transactions.length) {
    list.innerHTML = '<div class="empty">لسه مفيش عمليات مسجلة</div>';
    return;
  }

  list.innerHTML = data.transactions.map(t => `
    <div class="transaction">
      <div>
        <strong>${t.type === "in" ? "إيداع" : "سحب"}</strong>
        <small>${escapeHTML(t.reason || "")} • ${dateLabel(t.day)}</small>
      </div>
      <div class="${t.type === "in" ? "amount-in" : "amount-out"}">
        ${t.type === "in" ? "+" : "−"}${formatMoney(t.amount)} ج
      </div>
    </div>
  `).join("");
}

function renderStats() {
  const days = {};
  data.transactions.forEach(t => {
    if (!days[t.day]) days[t.day] = 0;
    days[t.day] += t.type === "in" ? t.amount : -t.amount;
  });

  const entries = Object.entries(days);
  const positiveDays = entries.filter(([day,amount]) => amount > 0);
  const average = positiveDays.length
    ? positiveDays.reduce((s,[day,amount]) => s+amount,0) / positiveDays.length
    : 0;

  const best = entries.length
    ? entries.reduce((a,b) => b[1] > a[1] ? b : a)
    : null;

  document.getElementById("dailyAverage").textContent = formatMoney(Math.round(average)) + " ج";
  document.getElementById("bestDay").textContent =
    best && best[1] > 0 ? dateLabel(best[0]) : "—";
  document.getElementById("savingDays").textContent = positiveDays.length;

  const last7 = [];
  for (let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate()-i);
    const key = d.getFullYear() + "-" +
      String(d.getMonth()+1).padStart(2,"0") + "-" +
      String(d.getDate()).padStart(2,"0");
    last7.push({key, value: days[key] || 0});
  }

  const max = Math.max(1, ...last7.map(x => Math.max(0,x.value)));
  document.getElementById("weeklyChart").innerHTML = last7.map(item => {
    const height = Math.max(3, Math.max(0,item.value) / max * 125);
    const weekday = new Date(item.key + "T12:00:00")
      .toLocaleDateString("ar-EG",{weekday:"short"});
    return `
      <div class="bar-item" title="${formatMoney(item.value)} جنيه">
        <strong style="font-size:10px">${formatMoney(item.value)}</strong>
        <div class="bar" style="height:${height}px"></div>
        <small>${weekday}</small>
      </div>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
}

function renderAll() {
  renderMoney();
  renderHome();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  downloadFile(
    "hassalaty-backup.json",
    JSON.stringify(data,null,2),
    "application/json;charset=utf-8"
  );
  toast("جهزنا نسخة احتياطية");
}

function exportCSV() {
  const rows = [["النوع","المبلغ","السبب","التاريخ"]];
  data.transactions.forEach(t => {
    rows.push([
      t.type === "in" ? "إيداع" : "سحب",
      t.amount,
      t.reason || "",
      t.date || ""
    ]);
  });

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => '"' + String(value).replace(/"/g,'""') + '"').join(",")
  ).join("\n");

  downloadFile("hassalaty-history.csv",csv,"text/csv;charset=utf-8");
  toast("جهزنا ملف السجل");
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (
        !imported ||
        !imported.counts ||
        !Array.isArray(imported.goals) ||
        !Array.isArray(imported.transactions)
      ) throw new Error("invalid");

      const counts = {};
      denominations.forEach(d => {
        const n = Number(imported.counts[d] || 0);
        if (!Number.isInteger(n) || n < 0) throw new Error("invalid counts");
        counts[d] = n;
      });

      data = {
        counts,
        goals: imported.goals,
        transactions: imported.transactions,
        sound: imported.sound !== false
      };

      saveData();
      renderAll();
      toast("تم استرجاع النسخة الاحتياطية");
    } catch(e) {
      toast("الملف مش نسخة احتياطية صحيحة");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

loadData();
renderAll();
updateSoundButton();

