/* =========================================================
 * app.js — TSH 弁当注文 (frontend)
 * =======================================================*/

// ====== SETTING ======
const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec';

// Weather (OpenWeatherMap)
const WEATHER_API_KEY = '9da4e73a2a764eafc9e32e5b39224a9c'; // ← isi dengan API key kamu
const WEATHER_CITY = 'Yokohama,jp';

// Hari libur manual (opsional, format "yyyy-MM-dd")
const HOLIDAYS = [
  // '2025-01-01',
];

const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'];

// ====== Utils ======
function formatJPY(amount) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount || 0);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthStrFromDateStr(dateStr) {
  return dateStr.slice(0, 7); // yyyy-MM
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekRange(dateStr) {
  const base = new Date(dateStr);
  const day = base.getDay(); // 0=Sun .. 6=Sat
  const diffToMonday = (day + 6) % 7; // Monday=0
  const start = new Date(base);
  start.setDate(base.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

function formatTodayHeader(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '本日 -';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const w = weekdayJa[d.getDay()] || '';
  return `本日 ${y}/${m}/${dd}（${w}）`;
}

// ====== CSV Helpers ======
function toCsv(rows) {
  return rows
    .map(row =>
      row
        .map(v => {
          const s = v == null ? '' : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
}

function downloadCsv(filename, rows) {
  const csvContent = toCsv(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ====== API helpers ======
async function apiGet(params) {
  const url = new URL(API_BASE_URL);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    // JANGAN pakai 'application/json' supaya tidak ada preflight CORS
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(data),
  });

  return res.json();
}


// ====== DOM refs ======
const todayHeaderText = document.getElementById('today-header-text');
const weatherHeaderText = document.getElementById('weather-header-text');
const todayOrderStatus = document.getElementById('today-order-status');

const orderSection = document.getElementById('order-section');
const dashboardSection = document.getElementById('dashboard-section');
const calendarSection = document.getElementById('calendar-section');

const tabOrder = document.getElementById('tab-order');
const tabDashboard = document.getElementById('tab-dashboard');
const tabCalendar = document.getElementById('tab-calendar');

const orderDateInput = document.getElementById('order-date');
const employeeSelect = document.getElementById('employee-name');
const employeeSearchInput = document.getElementById('employee-search');
const formMessage = document.getElementById('form-message');
const orderForm = document.getElementById('order-form');

const todayDateLabel = document.getElementById('today-date-label');
const todayMenuDiv = document.getElementById('today-menu');

const dashboardDateInput = document.getElementById('dashboard-date');
const dashboardMonthInput = document.getElementById('dashboard-month');
const dashboardDateLabel = document.getElementById('dashboard-date-label');
const dashboardMonthLabel = document.getElementById('dashboard-month-label');
const dashboardFreshBadge = document.getElementById('dashboard-fresh-badge');

const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');

const dayTotalCountEl = document.getElementById('day-total-count');
const dayTotalAmountEl = document.getElementById('day-total-amount');
const dayOrdersBody = document.getElementById('day-orders-body');

const monthTotalCountEl = document.getElementById('month-total-count');
const monthTotalAmountEl = document.getElementById('month-total-amount');
const monthEmployeeBody = document.getElementById('month-employee-body');
const monthDayBody = document.getElementById('month-day-body');

const btnDownloadDay = document.getElementById('btn-download-day');
const btnDownloadWeek = document.getElementById('btn-download-week');
const btnDownloadMonth = document.getElementById('btn-download-month');

// multi-date
const multiModeToggle = document.getElementById('multi-mode-toggle');
const multiPanel = document.getElementById('multi-panel');
const multiMonthInput = document.getElementById('multi-month');
const multiDaysContainer = document.getElementById('multi-days-container');
const btnGenerateMultiDays = document.getElementById('btn-generate-multi-days');
const btnSubmitMulti = document.getElementById('btn-submit-multi');

// employee summary
const summaryEmployeeSelect = document.getElementById('summary-employee');
const summaryMonthInput = document.getElementById('summary-month');
const btnLoadEmployeeSummary = document.getElementById('btn-load-employee-summary');
const btnDownloadEmpExcel = document.getElementById('btn-download-employee-excel');
const btnDownloadEmpPdf = document.getElementById('btn-download-employee-pdf');
const employeeSummaryView = document.getElementById('employee-summary-view');

// menu calendar
const calendarMonthInput = document.getElementById('calendar-month');
const calendarGrid = document.getElementById('calendar-grid');

// ====== Global state ======
let lastDaySummary = null;
let lastMonthSummary = null;
let lastEmployeeSummary = null;
let allEmployees = [];
let dashboardIsFresh = true;

const todayStatusBaseClass =
  'inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]';

// ====== Tabs ======
function activateTab(name) {
  const groups = [
    { name: 'order', section: orderSection, tab: tabOrder },
    { name: 'dashboard', section: dashboardSection, tab: tabDashboard },
    { name: 'calendar', section: calendarSection, tab: tabCalendar },
  ];

  groups.forEach(g => {
    if (!g.section || !g.tab) return;
    const active = g.name === name;

    g.section.classList.toggle('hidden', !active);

    g.tab.classList.toggle('bg-white', active);
    g.tab.classList.toggle('text-sky-900', active);
    g.tab.classList.toggle('border', active);
    g.tab.classList.toggle('border-sky-300', active);
    g.tab.classList.toggle('shadow-sm', active);

    if (!active) {
      g.tab.classList.remove('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
    }
  });
}

if (tabOrder) tabOrder.addEventListener('click', () => activateTab('order'));
if (tabDashboard) tabDashboard.addEventListener('click', () => activateTab('dashboard'));
if (tabCalendar) tabCalendar.addEventListener('click', () => activateTab('calendar'));

// ====== Dashboard fresh badge ======
function updateDashboardBadge() {
  if (!dashboardFreshBadge) return;
  if (dashboardIsFresh) {
    dashboardFreshBadge.textContent = '最新';
    dashboardFreshBadge.className =
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200';
  } else {
    dashboardFreshBadge.textContent = '未更新';
    dashboardFreshBadge.className =
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 border border-amber-200';
  }
}
function markDashboardFresh() {
  dashboardIsFresh = true;
  updateDashboardBadge();
}
function markDashboardDirty() {
  dashboardIsFresh = false;
  updateDashboardBadge();
}

// ====== Weather ======
function weatherEmojiFromMain(main) {
  const key = (main || '').toLowerCase();
  switch (key) {
    case 'clear':
      return '☀';
    case 'clouds':
      return '⛅';
    case 'rain':
      return '🌧';
    case 'drizzle':
      return '🌦';
    case 'thunderstorm':
      return '⛈';
    case 'snow':
      return '❄';
    default:
      return '🌤';
  }
}

async function loadWeather() {
  if (!weatherHeaderText) return;

  if (!WEATHER_API_KEY) {
    weatherHeaderText.textContent = '天気：🌤 くもり時々晴れ';
    return;
  }

  weatherHeaderText.textContent = '天気取得中…';

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(WEATHER_CITY)}` +
      `&lang=ja&units=metric&appid=${WEATHER_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('weather response error: ' + res.status);
    }

    const data = await res.json();

    const temp = Math.round(data.main?.temp ?? 0);
    const wObj = (data.weather && data.weather[0]) ? data.weather[0] : null;
    const main = wObj?.main ?? '';
    const desc = wObj?.description ?? '';
    const emoji = weatherEmojiFromMain(main);

    weatherHeaderText.textContent = `天気：${emoji} ${desc} ${temp}℃`;
  } catch (err) {
    console.error('weather error', err);
    weatherHeaderText.textContent = '天気情報取得エラー';
  }
}

// ====== Employees ======
async function loadEmployees() {
  try {
    const data = await apiGet({ action: 'getEmployees' });

    allEmployees = (data.employees || [])
      .map(emp => {
        if (typeof emp === 'string') {
          return { name: emp, dept: '' };
        }
        return {
          name: emp.name || '',
          dept: emp.dept || emp.department || '',
        };
      })
      .filter(e => e.name);

    renderEmployeeOptions('');
    renderSummaryEmployeeOptions();
  } catch (err) {
    console.error(err);
    if (employeeSelect) {
      employeeSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '社員リスト取得エラー';
      employeeSelect.appendChild(opt);
    }
  }
}

function renderEmployeeOptions(filterText) {
  if (!employeeSelect) return;
  const keyword = (filterText || '').toLowerCase();
  employeeSelect.innerHTML = '';

  const filtered = allEmployees.filter(e => {
    if (!keyword) return true;
    return (
      e.name.toLowerCase().includes(keyword) ||
      (e.dept && e.dept.toLowerCase().includes(keyword))
    );
  });

  if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '該当する社員が見つかりません';
    employeeSelect.appendChild(opt);
    return;
  }

  filtered.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.name;
    opt.textContent = e.dept ? `${e.name}（${e.dept}）` : e.name;
    employeeSelect.appendChild(opt);
  });
}

function renderSummaryEmployeeOptions() {
  if (!summaryEmployeeSelect) return;
  summaryEmployeeSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '社員を選択';
  summaryEmployeeSelect.appendChild(opt0);

  allEmployees.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.name;
    opt.textContent = e.dept ? `${e.name}（${e.dept}）` : e.name;
    summaryEmployeeSelect.appendChild(opt);
  });
}

if (employeeSearchInput) {
  employeeSearchInput.addEventListener('input', () => {
    const text = employeeSearchInput.value || '';
    renderEmployeeOptions(text.trim());
    updateTodayOrderStatus(); // employee list berubah → status mungkin berubah
  });
}

if (employeeSelect) {
  employeeSelect.addEventListener('change', () => {
    updateTodayOrderStatus();
  });
}

// ====== Menu per date + slideshow ======
async function loadMenuForDate(dateStr) {
  if (todayDateLabel) todayDateLabel.textContent = `(${dateStr})`;
  if (!todayMenuDiv) return;

  todayMenuDiv.textContent = '読み込み中…';

  try {
    const data = await apiGet({ action: 'getMenu', date: dateStr });
    const menu = data.menu || null;

    const name = menu?.name || 'メニュー未登録';
    const price = menu?.price || 0;
    const dateDisplay = menu?.date || dateStr;
    const imageUrl = menu?.imageUrl || '';
    const hasMenuImage = !!imageUrl;

    todayMenuDiv.innerHTML = `
      <div
        class="relative overflow-hidden rounded-2xl border border-sky-100 shadow-sm bg-gradient-to-r from-sky-50 via-white to-orange-50"
        style="
          background-image: url('./images/food-bg.png');
          background-repeat: no-repeat;
          background-position: right bottom;
          background-size: 220px auto;
        "
      >
        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5">
          <div class="flex-1">
            <p class="mt-0.5 text-base sm:text-lg font-semibold text-sky-900">
              ${name}
            </p>
            <p class="mt-1 text-[11px] sm:text-xs text-slate-500">日付: ${dateDisplay}</p>
            <p class="mt-3 text-sm text-slate-700">
              価格：
              <span class="font-bold text-orange-600">${formatJPY(price || 0)}</span>
            </p>
            ${
              menu
                ? `<p class="mt-1 text-[11px] text-slate-400">社員向け日替わり弁当です。</p>`
                : `<p class="mt-1 text-[11px] text-slate-400">メニューが未登録です。Menusシートに追加してください。</p>`
            }
          </div>

          <div id="hero-slides"
               class="relative w-32 sm:w-40 h-24 sm:h-28 rounded-2xl overflow-hidden border border-white/70 shadow-sm bg-white/80 flex-shrink-0">
            ${
              hasMenuImage
                ? `
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out" data-slide-index="0">
                <img src="${imageUrl}" alt="${name}" class="w-full h-full object-cover" />
              </div>
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out opacity-0" data-slide-index="1">
                <img src="./images/food-bg-1.png" alt="" class="w-full h-full object-cover" />
              </div>
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out opacity-0" data-slide-index="2">
                <img src="./images/food-bg-2.png" alt="" class="w-full h-full object-cover" />
              </div>
            `
                : `
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out" data-slide-index="0">
                <img src="./images/food-bg-1.png" alt="" class="w-full h-full object-cover" />
              </div>
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out opacity-0" data-slide-index="1">
                <img src="./images/food-bg-2.png" alt="" class="w-full h-full object-cover" />
              </div>
              <div class="absolute inset-0 transition-opacity duration-700 ease-in-out opacity-0" data-slide-index="2">
                <img src="./images/food-bg-3.png" alt="" class="w-full h-full object-cover" />
              </div>
            `
            }
          </div>
        </div>
      </div>
    `;

    setupHeroCarousel();
  } catch (err) {
    console.error(err);
    todayMenuDiv.textContent = 'メニュー取得エラー';
  }
}

function setupHeroCarousel() {
  const container = document.getElementById('hero-slides');
  if (!container) return;
  const slides = Array.from(container.querySelectorAll('[data-slide-index]'));
  if (slides.length <= 1) return;

  let current = 0;
  slides.forEach((el, idx) => {
    el.style.opacity = idx === 0 ? '1' : '0';
  });

  if (container._carouselTimer) {
    clearInterval(container._carouselTimer);
  }

  container._carouselTimer = setInterval(() => {
    slides[current].style.opacity = '0';
    current = (current + 1) % slides.length;
    slides[current].style.opacity = '1';
  }, 4000);
}

// ====== Status order hari ini di header ======
function updateTodayOrderStatus() {
  if (!todayOrderStatus) return;

  const dateStr = orderDateInput?.value || todayStr();
  const employeeName = employeeSelect?.value || '';

  todayOrderStatus.className =
    todayStatusBaseClass + ' bg-slate-50 text-slate-600 border-slate-200';

  if (!employeeName) {
    todayOrderStatus.textContent = '本日の注文：未選択';
    return;
  }

  if (!lastDaySummary || lastDaySummary.date !== dateStr) {
    todayOrderStatus.textContent = '本日の注文：読込中…';
    return;
  }

  const rec = (lastDaySummary.orders || []).find(o => o.employee === employeeName);

  if (!rec) {
    todayOrderStatus.textContent = '本日の注文：未登録';
    return;
  }

  if (rec.status === '注文する') {
    todayOrderStatus.textContent = '本日の注文：✅ 注文する';
    todayOrderStatus.className =
      todayStatusBaseClass + ' bg-emerald-50 text-emerald-700 border-emerald-200';
  } else {
    todayOrderStatus.textContent = '本日の注文：❌ 注文しない';
    todayOrderStatus.className =
      todayStatusBaseClass + ' bg-orange-50 text-orange-700 border-orange-200';
  }
}

// ====== Order (single day) ======
if (orderForm) {
  orderForm.addEventListener('submit', async e => {
    e.preventDefault();
    formMessage.textContent = '送信中…';

    const dateStr = orderDateInput.value;
    const employeeName = employeeSelect.value;
    const status = document.querySelector('input[name="order-status"]:checked')?.value;

    if (!dateStr || !employeeName) {
      formMessage.textContent = '日付と社員名を入力してください。';
      return;
    }

    try {
      const res = await apiPost({
        action: 'saveOrder',
        date: dateStr,
        employeeName,
        status,
      });

      if (res && res.success) {
        formMessage.textContent = '保存しました。';
        dashboardDateInput.value = dateStr;
        dashboardMonthInput.value = monthStrFromDateStr(dateStr);
        await Promise.all([loadDaySummary(dateStr), loadMonthSummary(dashboardMonthInput.value)]);
        updateTodayOrderStatus();
      } else {
        formMessage.textContent = '保存に失敗しました。';
      }
    } catch (err) {
      console.error(err);
      formMessage.textContent = '通信エラーが発生しました。';
    }
  });
}

// ====== Day summary ======
async function loadDaySummary(dateStr) {
  if (dashboardDateLabel) dashboardDateLabel.textContent = dateStr;
  if (dayOrdersBody) dayOrdersBody.innerHTML = '';
  if (dayTotalCountEl) dayTotalCountEl.textContent = '-';
  if (dayTotalAmountEl) dayTotalAmountEl.textContent = '-';

  try {
    const data = await apiGet({ action: 'getDaySummary', date: dateStr });
    lastDaySummary = data;

    if (dayTotalCountEl) dayTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    if (dayTotalAmountEl) dayTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    if (dayOrdersBody) {
      if (data.orders && data.orders.length > 0) {
        data.orders.forEach(o => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-sky-50';
          tr.innerHTML = `
            <td class="py-1 px-2">${o.employee}</td>
            <td class="py-1 px-2">
              <span class="px-2 py-0.5 rounded-full text-[11px] ${
                o.status === '注文する'
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
              }">${o.status}</span>
            </td>
            <td class="py-1 px-2 text-right">${formatJPY(o.subTotal || 0)}</td>
          `;
          dayOrdersBody.appendChild(tr);
        });
      } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="3" class="py-2 text-slate-400 px-2">注文データがありません。</td>
        `;
        dayOrdersBody.appendChild(tr);
      }
    }

    updateTodayOrderStatus();
  } catch (err) {
    console.error(err);
  }
}

// ====== Month summary ======
async function loadMonthSummary(monthStr) {
  if (dashboardMonthLabel) dashboardMonthLabel.textContent = monthStr || '';
  if (monthEmployeeBody) monthEmployeeBody.innerHTML = '';
  if (monthDayBody) monthDayBody.innerHTML = '';
  if (monthTotalCountEl) monthTotalCountEl.textContent = '-';
  if (monthTotalAmountEl) monthTotalAmountEl.textContent = '-';

  if (!monthStr) return;

  try {
    const data = await apiGet({ action: 'getMonthSummary', month: monthStr });
    lastMonthSummary = data;

    if (monthTotalCountEl) monthTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    if (monthTotalAmountEl) monthTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    if (monthEmployeeBody) {
      if (data.perEmployee && data.perEmployee.length > 0) {
        data.perEmployee.forEach(e => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-sky-50';
          tr.innerHTML = `
            <td class="py-1 px-2">${e.employee}</td>
            <td class="py-1 px-2 text-right">${e.count}</td>
            <td class="py-1 px-2 text-right">${formatJPY(e.amount || 0)}</td>
          `;
          monthEmployeeBody.appendChild(tr);
        });
      } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" class="py-2 px-2 text-slate-400">データがありません。</td>`;
        monthEmployeeBody.appendChild(tr);
      }
    }

    if (monthDayBody) {
      if (data.perDay && data.perDay.length > 0) {
        data.perDay.forEach(d => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-sky-50';
          tr.innerHTML = `
            <td class="py-1 px-2">${d.date}</td>
            <td class="py-1 px-2 text-right">${d.count}</td>
            <td class="py-1 px-2 text-right">${formatJPY(d.amount || 0)}</td>
          `;
          monthDayBody.appendChild(tr);
        });
      } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" class="py-2 px-2 text-slate-400">データがありません。</td>`;
        monthDayBody.appendChild(tr);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// ====== Dashboard refresh button ======
if (btnRefreshDashboard) {
  btnRefreshDashboard.addEventListener('click', async () => {
    const dateStr = dashboardDateInput.value || todayStr();
    const monthStr = dashboardMonthInput.value || monthStrFromDateStr(dateStr);

    dashboardDateInput.value = dateStr;
    dashboardMonthInput.value = monthStr;

    markDashboardDirty();
    await Promise.all([loadDaySummary(dateStr), loadMonthSummary(monthStr)]);
    markDashboardFresh();
  });
}

// ====== Date change handlers ======
if (orderDateInput) {
  orderDateInput.addEventListener('change', async () => {
    const dateStr = orderDateInput.value;
    if (!dateStr) return;
    if (todayHeaderText) todayHeaderText.textContent = formatTodayHeader(dateStr);
    await loadMenuForDate(dateStr);
    dashboardDateInput.value = dateStr;
    dashboardMonthInput.value = monthStrFromDateStr(dateStr);
    await Promise.all([
      loadDaySummary(dateStr),
      loadMonthSummary(dashboardMonthInput.value),
    ]);
  });
}

if (dashboardDateInput) {
  dashboardDateInput.addEventListener('change', async () => {
    const dateStr = dashboardDateInput.value;
    if (!dateStr) return;
    await loadDaySummary(dateStr);
    if (!dashboardMonthInput.value) {
      dashboardMonthInput.value = monthStrFromDateStr(dateStr);
    }
  });
}

if (dashboardMonthInput) {
  dashboardMonthInput.addEventListener('change', () => {
    // user mengubah bulan tapi belum klik "集計を更新"
    markDashboardDirty();
  });
}

// ====== Auto change when real date changes ======
let currentSystemDate = todayStr();
setInterval(async () => {
  const now = todayStr();
  if (now !== currentSystemDate) {
    currentSystemDate = now;

    if (orderDateInput) orderDateInput.value = now;
    if (dashboardDateInput) dashboardDateInput.value = now;
    if (dashboardMonthInput) dashboardMonthInput.value = monthStrFromDateStr(now);

    if (todayHeaderText) todayHeaderText.textContent = formatTodayHeader(now);
    loadWeather();

    await loadMenuForDate(now);
    await Promise.all([
      loadDaySummary(now),
      loadMonthSummary(monthStrFromDateStr(now)),
    ]);
  }
}, 60 * 1000);

// ====== Download Excel/CSV (day / week / month) ======
if (btnDownloadDay) {
  btnDownloadDay.addEventListener('click', () => {
    if (!lastDaySummary) {
      alert('まずダッシュボードを更新してください。');
      return;
    }
    const d = lastDaySummary;
    const rows = [];
    rows.push(['日付', d.date || '']);
    rows.push([]);
    rows.push(['社員名', 'ステータス', '単価', '小計']);
    (d.orders || []).forEach(o => {
      rows.push([o.employee, o.status, o.unitPrice || 0, o.subTotal || 0]);
    });
    rows.push([]);
    rows.push(['注文数合計', d.totalCount || 0]);
    rows.push(['金額合計', d.totalAmount || 0]);

    downloadCsv(`day-summary-${d.date || 'unknown'}.csv`, rows);
  });
}

if (btnDownloadWeek) {
  btnDownloadWeek.addEventListener('click', () => {
    if (!lastMonthSummary || !lastDaySummary) {
      alert('まず日次と月次の集計を更新してください。');
      return;
    }
    const baseDate = lastDaySummary.date;
    if (!baseDate) {
      alert('日付情報がありません。');
      return;
    }
    const { start, end } = getWeekRange(baseDate);

    const perDay = (lastMonthSummary.perDay || []).filter(
      d => d.date >= start && d.date <= end,
    );

    const rows = [];
    rows.push(['基準日', baseDate]);
    rows.push(['週範囲', `${start} 〜 ${end}`]);
    rows.push([]);
    rows.push(['日付', '注文数', '合計金額']);
    perDay.forEach(d => {
      rows.push([d.date, d.count, d.amount]);
    });

    const totalCount = perDay.reduce((s, d) => s + (d.count || 0), 0);
    const totalAmount = perDay.reduce((s, d) => s + (d.amount || 0), 0);
    rows.push([]);
    rows.push(['注文数合計', totalCount]);
    rows.push(['金額合計', totalAmount]);

    downloadCsv(`week-summary-${start}_to_${end}.csv`, rows);
  });
}

if (btnDownloadMonth) {
  btnDownloadMonth.addEventListener('click', () => {
    if (!lastMonthSummary) {
      alert('まず月間集計を更新してください。');
      return;
    }
    const m = lastMonthSummary;
    const rows = [];

    rows.push(['対象月', m.month || '']);
    rows.push([]);
    rows.push(['【社員別集計】']);
    rows.push(['社員名', '注文数', '合計金額']);
    (m.perEmployee || []).forEach(e => {
      rows.push([e.employee, e.count, e.amount]);
    });

    rows.push([]);
    rows.push(['【日別集計】']);
    rows.push(['日付', '注文数', '合計金額']);
    (m.perDay || []).forEach(d => {
      rows.push([d.date, d.count, d.amount]);
    });

    rows.push([]);
    rows.push(['注文数合計', m.totalCount || 0]);
    rows.push(['金額合計', m.totalAmount || 0]);

    downloadCsv(`month-summary-${m.month || 'unknown'}.csv`, rows);
  });
}

// ====== 月内複数日一括注文 ======
function getDaysInMonth(ymStr) {
  if (!ymStr) return [];
  const [y, m] = ymStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = [];
  while (first.getMonth() === m - 1) {
    days.push(new Date(first));
    first.setDate(first.getDate() + 1);
  }
  return days;
}

if (multiModeToggle && multiPanel) {
  multiModeToggle.addEventListener('change', () => {
    if (multiModeToggle.checked) {
      multiPanel.classList.remove('hidden');
      if (!multiMonthInput.value) {
        const t = todayStr();
        multiMonthInput.value = t.slice(0, 7);
      }
    } else {
      multiPanel.classList.add('hidden');
    }
  });
}

if (btnGenerateMultiDays && multiDaysContainer && multiMonthInput) {
  btnGenerateMultiDays.addEventListener('click', () => {
    const ym = multiMonthInput.value;
    if (!ym) {
      alert('対象月を選択してください。');
      return;
    }
    const days = getDaysInMonth(ym);
    if (!days.length) return;

    const today = todayStr();

    let html = '<div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">';
    days.forEach(d => {
      const ds = toDateStr(d);
      const w = weekdayJa[d.getDay()];
      const isToday = ds === today;
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = HOLIDAYS.includes(ds);

      let baseClass;
      if (isHoliday) {
        baseClass = 'bg-red-50 border border-red-200 text-red-700';
      } else if (isWeekend) {
        baseClass = 'bg-slate-100 border border-slate-200 text-slate-500';
      } else if (isToday) {
        baseClass = 'bg-orange-100 border border-orange-200';
      } else {
        baseClass = 'bg-white/70 border border-sky-100';
      }

      html += `
        <label class="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] sm:text-xs ${baseClass}">
          <input type="checkbox" class="multi-day-checkbox rounded border-slate-300" value="${ds}">
          <span class="flex-1 truncate">${ds}（${w}）${isHoliday ? '★' : ''}</span>
        </label>
      `;
    });
    html += '</div>';
    multiDaysContainer.innerHTML = html;
  });
}

if (btnSubmitMulti) {
  btnSubmitMulti.addEventListener('click', async () => {
    const employeeName = employeeSelect.value;
    const status = document.querySelector('input[name="order-status"]:checked')?.value;

    if (!employeeName) {
      formMessage.textContent = '社員名を選択してください。';
      return;
    }

    const checkboxes = multiDaysContainer?.querySelectorAll('.multi-day-checkbox');
    const selected = [];
    checkboxes?.forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });

    if (!selected.length) {
      formMessage.textContent = '日付を1つ以上選択してください。';
      return;
    }

    formMessage.textContent = '一括登録中…';

    try {
      await Promise.all(
        selected.map(dateStr =>
          apiPost({
            action: 'saveOrder',
            date: dateStr,
            employeeName,
            status,
          }),
        ),
      );

      const lastDate = selected[selected.length - 1];
      formMessage.textContent = `${selected.length} 日分の注文を保存しました。`;

      dashboardDateInput.value = lastDate;
      dashboardMonthInput.value = monthStrFromDateStr(lastDate);
      await Promise.all([
        loadDaySummary(lastDate),
        loadMonthSummary(dashboardMonthInput.value),
      ]);
    } catch (err) {
      console.error(err);
      formMessage.textContent = '一括登録中にエラーが発生しました。';
    }
  });
}

// ====== 社員別サマリー ======
async function loadEmployeeSummary(empName, monthStr) {
  if (!employeeSummaryView) return;
  employeeSummaryView.textContent = '読み込み中…';

  try {
    const data = await apiGet({
      action: 'getEmployeeSummary',
      employee: empName,
      month: monthStr,
    });
    lastEmployeeSummary = data;

    if (!data.orders || data.orders.length === 0) {
      employeeSummaryView.innerHTML = `
        <p class="text-[11px] sm:text-xs text-slate-500">
          対象データがありません。（社員名：${empName} / 月：${monthStr}）
        </p>
      `;
      return;
    }

    let html = `
      <div class="mb-2">
        <div class="text-sm sm:text-base font-semibold text-sky-900">
          ${empName}
        </div>
        <div class="text-[11px] sm:text-xs text-slate-500">
          対象月：${monthStr}　
          注文数：${data.totalCount || 0} 件　
          合計金額：${formatJPY(data.totalAmount || 0)}
        </div>
      </div>
      <div class="overflow-x-auto rounded-2xl border border-sky-100 bg-sky-50/60">
        <table class="min-w-full text-[11px] sm:text-xs">
          <thead class="bg-sky-100 text-slate-600">
            <tr>
              <th class="text-left px-2 py-1.5">日付</th>
              <th class="text-left px-2 py-1.5">ステータス</th>
              <th class="text-right px-2 py-1.5">単価</th>
              <th class="text-right px-2 py-1.5">小計</th>
            </tr>
          </thead>
          <tbody>
    `;
    data.orders.forEach(o => {
      html += `
        <tr class="border-t border-sky-100">
          <td class="px-2 py-1.5">${o.date}</td>
          <td class="px-2 py-1.5">${o.status}</td>
          <td class="px-2 py-1.5 text-right">${formatJPY(o.unitPrice || 0)}</td>
          <td class="px-2 py-1.5 text-right">${formatJPY(o.subTotal || 0)}</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
    employeeSummaryView.innerHTML = html;
  } catch (err) {
    console.error(err);
    employeeSummaryView.textContent = '読込エラーが発生しました。';
  }
}

if (btnLoadEmployeeSummary) {
  btnLoadEmployeeSummary.addEventListener('click', () => {
    const emp = summaryEmployeeSelect.value;
    const m = summaryMonthInput.value;
    if (!emp || !m) {
      alert('社員名と対象月を選択してください。');
      return;
    }
    loadEmployeeSummary(emp, m);
  });
}

if (btnDownloadEmpExcel) {
  btnDownloadEmpExcel.addEventListener('click', () => {
    if (!lastEmployeeSummary) {
      alert('まず社員別サマリーを表示してください。');
      return;
    }
    const s = lastEmployeeSummary;
    const rows = [];
    rows.push(['社員名', s.employee || '']);
    rows.push(['対象月', s.month || '']);
    rows.push([]);
    rows.push(['日付', 'ステータス', '単価', '小計']);
    (s.orders || []).forEach(o => {
      rows.push([o.date, o.status, o.unitPrice || 0, o.subTotal || 0]);
    });
    rows.push([]);
    rows.push(['注文数合計', s.totalCount || 0]);
    rows.push(['金額合計', s.totalAmount || 0]);

    downloadCsv(
      `employee-summary-${s.employee || 'unknown'}-${s.month || ''}.csv`,
      rows,
    );
  });
}

if (btnDownloadEmpPdf) {
  btnDownloadEmpPdf.addEventListener('click', async () => {
    const emp = summaryEmployeeSelect.value;
    const m = summaryMonthInput.value;
    if (!emp || !m) {
      alert('社員名と対象月を選択してください。');
      return;
    }
    try {
      const res = await apiGet({
        action: 'exportEmployeeSummaryPdf',
        employee: emp,
        month: m,
      });
      if (res && res.pdfUrl) {
        window.open(res.pdfUrl, '_blank');
      } else {
        alert('PDFの作成に失敗しました。');
      }
    } catch (err) {
      console.error(err);
      alert('PDFの作成中にエラーが発生しました。');
    }
  });
}

// ====== MENU CALENDAR VIEW ======
async function loadMenuCalendar(monthStr) {
  if (!calendarGrid) return;
  if (!monthStr) {
    calendarGrid.innerHTML =
      '<p class="text-[11px] sm:text-xs text-slate-500">対象月を選択してください。</p>';
    return;
  }

  calendarGrid.innerHTML =
    '<p class="text-[11px] sm:text-xs text-slate-500">読み込み中…</p>';

  try {
    const data = await apiGet({ action: 'getMenuCalendar', month: monthStr });
    const items = data.items || [];
    renderMenuCalendar(monthStr, items);
  } catch (err) {
    console.error(err);
    calendarGrid.innerHTML =
      '<p class="text-[11px] sm:text-xs text-red-500">メニュー取得エラー</p>';
  }
}

function renderMenuCalendar(monthStr, items) {
  if (!calendarGrid) return;

  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const map = {};
  (items || []).forEach(it => {
    map[it.date] = it;
  });

  let html = `
    <div class="grid grid-cols-7 text-[11px] sm:text-xs text-slate-500 mb-2">
      <div class="text-center text-red-500">日</div>
      <div class="text-center">月</div>
      <div class="text-center">火</div>
      <div class="text-center">水</div>
      <div class="text-center">木</div>
      <div class="text-center">金</div>
      <div class="text-center text-blue-500">土</div>
    </div>
    <div class="grid grid-cols-7 gap-1 text-[11px] sm:text-xs">
  `;

  for (let i = 0; i < firstWeekday; i++) {
    html += '<div class="h-16 sm:h-20 rounded-xl bg-transparent"></div>';
  }

  const today = todayStr();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m - 1, day);
    const ds = toDateStr(d);
    const w = d.getDay();
    const it = map[ds];
    const isToday = ds === today;
    const isWeekend = w === 0 || w === 6;

    let cellClass =
      'h-16 sm:h-20 rounded-xl border bg-white/80 flex flex-col px-1.5 py-1 cursor-pointer hover:border-sky-300';
    if (isToday) cellClass += ' ring-2 ring-sky-300';
    if (isWeekend) cellClass += ' bg-slate-50';

    html += `
      <div class="${cellClass}" data-date="${ds}">
        <div class="flex items-center justify-between mb-0.5">
          <span class="text-[11px] font-semibold ${
            isWeekend ? 'text-red-500' : 'text-slate-700'
          }">${day}</span>
          <span class="text-[9px] text-slate-400">${weekdayJa[w]}</span>
        </div>
        <div class="flex-1 overflow-hidden">
          <div class="text-[10px] sm:text-[11px] text-sky-900">
            ${
              it && it.name
                ? it.name
                : '<span class="text-slate-300">未登録</span>'
            }
          </div>
        </div>
        <div class="mt-0.5 text-[9px] text-orange-600 text-right">
          ${it && it.price ? formatJPY(it.price) : ''}
        </div>
      </div>
    `;
  }

  html += '</div>';
  calendarGrid.innerHTML = html;
}

if (calendarMonthInput) {
  calendarMonthInput.addEventListener('change', () => {
    loadMenuCalendar(calendarMonthInput.value);
  });
}

if (calendarGrid) {
  calendarGrid.addEventListener('click', e => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    const ds = cell.dataset.date;
    if (orderDateInput) {
      orderDateInput.value = ds;
      orderDateInput.dispatchEvent(new Event('change'));
      activateTab('order');
    }
  });
}

// ====== Init ======
async function init() {
  const today = todayStr();

  if (orderDateInput) orderDateInput.value = today;
  if (dashboardDateInput) dashboardDateInput.value = today;
  if (dashboardMonthInput) dashboardMonthInput.value = monthStrFromDateStr(today);
  if (multiMonthInput) multiMonthInput.value = today.slice(0, 7);
  if (calendarMonthInput) calendarMonthInput.value = today.slice(0, 7);

  if (todayHeaderText) todayHeaderText.textContent = formatTodayHeader(today);

  await Promise.all([loadEmployees(), loadMenuForDate(today)]);
  await Promise.all([
    loadDaySummary(today),
    loadMonthSummary(monthStrFromDateStr(today)),
    loadMenuCalendar(today.slice(0, 7)),
  ]);

  markDashboardFresh();
  loadWeather();
  activateTab('order');
}

// PWA: register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(err => console.log('SW registration failed', err));
  });
}

init();
