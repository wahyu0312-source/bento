/* =========================================================
 * app.js — TSH 弁当注文 (frontend)
 * =======================================================*/

// ====== SETTING ======
const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec';

// Weather (OpenWeatherMap)
const WEATHER_API_KEY = '9da4e73a2a764eafc9e32e5b39224a9c'; 
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
    {
      tab: tabOrder,
      section: orderSection,
      key: 'order',
    },
    {
      tab: tabDashboard,
      section: dashboardSection,
      key: 'dashboard',
    },
    {
      tab: tabCalendar,
      section: calendarSection,
      key: 'calendar',
    },
  ];

  groups.forEach(g => {
    const isActive = g.key === name;
    if (!g.tab || !g.section) return;

    if (isActive) {
      g.section.classList.remove('hidden');
      g.tab.classList.add(
        'bg-white',
        'text-sky-900',
        'border',
        'border-sky-300',
        'shadow-sm',
      );
    } else {
      g.section.classList.add('hidden');
      g.tab.classList.remove(
        'bg-white',
        'text-sky-900',
        'border',
        'border-sky-300',
        'shadow-sm',
      );
    }
  });

  // Saat buka tab kalender, paksa reload kalender
  if (name === 'calendar' && calendarMonthInput) {
    const ym = calendarMonthInput.value || todayStr().slice(0, 7); // yyyy-MM
    loadMenuCalendar(ym);
  }
}

// ★★ EVENT LISTENER UNTUK TAB ★★
if (tabOrder) {
  tabOrder.addEventListener('click', () => activateTab('order'));
}
if (tabDashboard) {
  tabDashboard.addEventListener('click', () => activateTab('dashboard'));
}
if (tabCalendar) {
  tabCalendar.addEventListener('click', () => activateTab('calendar'));
}

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
    const wObj = data.weather && data.weather[0] ? data.weather[0] : null;
    const main = wObj?.main ?? '';
    theDesc = wObj?.description ?? '';
    const emoji = weatherEmojiFromMain(main);

    weatherHeaderText.textContent = `天気：${emoji} ${theDesc} ${temp}℃`;
  } catch (err) {
    console.error('weather error', err);
    weatherHeaderText.textContent = '天気情報取得エラー';
  }
}

// (… POTONGAN KODE LAIN TIDAK DIUBAH …)
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Di sini kamu bisa pakai isi file `app.js` kamu yang tadi,
// hanya pastikan bagian TAB listener & calendar sudah sama
// seperti di atas.
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
