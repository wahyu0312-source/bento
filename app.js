/* =========================================================
 * app.js — TSH 弁当注文 (frontend)
 * =======================================================*/

// ====== SETTING ======
const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec';

// Weather (OpenWeatherMap)
const WEATHER_API_KEY = '9da4e73a2a764eafc9e32e5b39224a9c'; // ← isi dengan API key kamu
const WEATHER_CITY = 'Yokohama,jp';

// URL PDF / URL menu (diset oleh admin)
const MENU_PDF_URL = ''; // contoh: 'https://.../menu.pdf'

// Hari libur manual (opsional, format "yyyy-MM-dd")
const HOLIDAYS = [
  // '2025-01-01',
];

const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'];

const FONT_SIZE_KEY = 'tsh-bento-font-size';

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

  // Tambah BOM supaya Excel ngerti ini UTF-8
  const bom = '\uFEFF';

  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

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

const appRoot = document.getElementById('app-root');

const orderSection = document.getElementById('order-section');
const todayListSection = document.getElementById('today-list-section');
const dashboardSection = document.getElementById('dashboard-section');
const calendarSection = document.getElementById('calendar-section');
const menuPdfSection = document.getElementById('menu-pdf-section');

const tabOrder = document.getElementById('tab-order');
const tabTodayList = document.getElementById('tab-today-list');
const tabDashboard = document.getElementById('tab-dashboard');
const tabCalendar = document.getElementById('tab-calendar');
const tabMenuPdf = document.getElementById('tab-menu-pdf');

const orderDateInput = document.getElementById('order-date');
const employeeSelect = document.getElementById('employee-name');
const employeeSearchInput = document.getElementById('employee-search');
const deliveryPlaceSelect = document.getElementById('delivery-place');
const formMessage = document.getElementById('form-message');
const orderForm = document.getElementById('order-form');

const todayDateLabel = document.getElementById('today-date-label');
const todayMenuDiv = document.getElementById('today-menu');

// Today list
const todayListDateInput = document.getElementById('today-list-date');
const todayListBody = document.getElementById('today-list-body');

// Dashboard
const dashboardDateInput = document.getElementById('dashboard-date');
const dashboardMonthInput = document.getElementById('dashboard-month');
const dashboardDateLabel = document.getElementById('dashboard-date-label');
const dashboardMonthLabel = document.getElementById('dashboard-month-label');
const dashboardFreshBadge = document.getElementBy
