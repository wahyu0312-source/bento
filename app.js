/* =========================================================
 * app.js — TSH 弁当注文 (frontend) - 改良版 v2.0
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

// Time restrictions
const ORDER_DEADLINE_HOUR = 9; // 09:00 JST
const ORDER_DEADLINE_MINUTE = 0;

const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'];

// ====== Font Size Control ======
function setFontSize(size) {
  const body = document.getElementById('app-body');
  body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge');
  body.classList.add(`font-size-${size}`);
  localStorage.setItem('preferredFontSize', size);
}

// Load saved font size
window.addEventListener('DOMContentLoaded', () => {
  const savedSize = localStorage.getItem('preferredFontSize') || 'medium';
  setFontSize(savedSize);
});

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

// ====== Time Restriction Functions ======
function canOrderToday() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (hour < ORDER_DEADLINE_HOUR) {
    return true;
  } else if (hour === ORDER_DEADLINE_HOUR && minute < ORDER_DEADLINE_MINUTE) {
    return true;
  }
  return false;
}

function getMinimumOrderDate() {
  const now = new Date();
  const canToday = canOrderToday();
  
  if (canToday) {
    return todayStr();
  } else {
    // Tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateStr(tomorrow);
  }
}

function showTimeRestrictionMessage() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (!canOrderToday()) {
    formMessage.textContent = `⚠️ 本日の注文は${ORDER_DEADLINE_HOUR}:${String(ORDER_DEADLINE_MINUTE).padStart(2, '0')}で締め切られました。明日以降の注文のみ可能です。`;
    formMessage.className = 'text-xs text-orange-600 flex-1 bg-orange-50 p-2 rounded';
  } else {
    const remainingMinutes = (ORDER_DEADLINE_HOUR * 60 + ORDER_DEADLINE_MINUTE) - (hour * 60 + minute);
    formMessage.textContent = `本日の注文締切まで残り${remainingMinutes}分です。`;
    formMessage.className = 'text-xs text-sky-600 flex-1';
  }
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

const orderSection = document.getElementById('order-section');
const dashboardSection = document.getElementById('dashboard-section');
const calendarSection = document.getElementById('calendar-section');
const todayOrdersSection = document.getElementById('today-orders-section');
const menuPdfSection = document.getElementById('menu-pdf-section');

const tabOrder = document.getElementById('tab-order');
const tabDashboard = document.getElementById('tab-dashboard');
const tabCalendar = document.getElementById('tab-calendar');
const tabTodayOrders = document.getElementById('tab-today-orders');
const tabMenuPdf = document.getElementById('tab-menu-pdf');

const orderDateInput = document.getElementById('order-date');
const employeeSelect = document.getElementById('employee-name');
const employeeSearchInput = document.getElementById('employee-search');
const deliveryLocationSelect = document.getElementById('delivery-location');
const formMessage = document.getElementById('form-message');
const orderForm = document.getElementById('order-form');

const todayDateLabel = document.getElementById('today-date-label');
const todayMenuDiv = document.getElementById('today-menu');

const dashboardDateInput = document.getElementById('dashboard-date');
const dashboardMonthInput = document.getElementById('dashboard-month');
const dashboardDateLabel = document.getElementById('dashboard-date-label');
const dashboardMonthLabel = document.getElementById('dashboard-month-label');

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
const deliveryLocationMultiSelect = document.getElementById('delivery-location-multi');

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

// today orders
const btnRefreshTodayOrders = document.getElementById('btn-refresh-today-orders');
const todayOrdersBody = document.getElementById('today-orders-body');
const btnDownloadTodayOrders = document.getElementById('btn-download-today-orders');

// menu PDF
const menuUrlInput = document.getElementById('menu-url-input');
const btnSaveMenuUrl = document.getElementById('btn-save-menu-url');
const menuDisplayArea = document.getElementById('menu-display-area');

// ====== Global state ======
let lastDaySummary = null;
let lastMonthSummary = null;
let lastEmployeeSummary = null;
let allEmployees = [];
let dashboardIsFresh = true;

// ====== Tabs ======
function activateTab(name) {
  const groups = [
    { name: 'order', section: orderSection, tab: tabOrder },
    { name: 'dashboard', section: dashboardSection, tab: tabDashboard },
    { name: 'calendar', section: calendarSection, tab: tabCalendar },
    { name: 'today-orders', section: todayOrdersSection, tab: tabTodayOrders },
    { name: 'menu-pdf', section: menuPdfSection, tab: tabMenuPdf },
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
  
  // Load today orders when tab is activated
  if (name === 'today-orders') {
    loadTodayOrders();
  }
  
  // Load menu PDF when tab is activated
  if (name === 'menu-pdf') {
    loadMenuDisplay();
  }
}

if (tabOrder) tabOrder.addEventListener('click', () => activateTab('order'));
if (tabDashboard) tabDashboard.addEventListener('click', () => activateTab('dashboard'));
if (tabCalendar) tabCalendar.addEventListener('click', () => activateTab('calendar'));
if (tabTodayOrders) tabTodayOrders.addEventListener('click', () => activateTab('today-orders'));
if (tabMenuPdf) tabMenuPdf.addEventListener('click', () => activateTab('menu-pdf'));

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
    console.error('Weather error:', err);
    weatherHeaderText.textContent = '天気：🌤 データ取得エラー';
  }
}

// ====== Employees ======
async function loadEmployees() {
  try {
    const data = await apiGet({ action: 'getEmployees' });
    if (data.error) {
      console.error('getEmployees error:', data.error);
      return;
    }

    allEmployees = data.employees || [];
    renderEmployeeOptions(allEmployees);
    renderEmployeeSummaryOptions(allEmployees);
  } catch (err) {
    console.error('loadEmployees failed:', err);
  }
}

function renderEmployeeOptions(list) {
  if (!employeeSelect) return;
  employeeSelect.innerHTML = '<option value="">社員名を選択</option>';

  list.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.name;
    opt.textContent = `${emp.name} (${emp.dept})`;
    employeeSelect.appendChild(opt);
  });
}

function renderEmployeeSummaryOptions(list) {
  if (!summaryEmployeeSelect) return;
  summaryEmployeeSelect.innerHTML = '<option value="">社員を選択</option>';

  list.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.name;
    opt.textContent = `${emp.name} (${emp.dept})`;
    summaryEmployeeSelect.appendChild(opt);
  });
}

// ====== Employee search ======
if (employeeSearchInput && employeeSelect) {
  employeeSearchInput.addEventListener('input', () => {
    const keyword = employeeSearchInput.value.toLowerCase();
    if (!keyword) {
      renderEmployeeOptions(allEmployees);
      return;
    }

    const filtered = allEmployees.filter(emp => {
      const n = emp.name.toLowerCase();
      const d = emp.dept.toLowerCase();
      return n.includes(keyword) || d.includes(keyword);
    });

    renderEmployeeOptions(filtered);
  });
}

// ====== Today's Menu ======
async function loadTodayMenu() {
  if (!todayMenuDiv || !todayDateLabel) return;

  const today = todayStr();
  todayDateLabel.textContent = today;

  todayMenuDiv.textContent = '読み込み中…';

  try {
    const data = await apiGet({ action: 'getMenu', date: today });
    if (data.error) {
      todayMenuDiv.innerHTML = `<p class="text-orange-600 text-sm">エラー: ${data.error}</p>`;
      return;
    }

    if (!data.menu || data.menu.length === 0) {
      todayMenuDiv.innerHTML = `
        <p class="text-slate-500 text-sm">
          本日のメニューは登録されていません。
        </p>
      `;
      return;
    }

    const m = data.menu[0];
    const imageHtml = m.image
      ? `<img src="${m.image}" class="w-full max-w-sm rounded-xl mb-3" alt="menu" />`
      : '';

    todayMenuDiv.innerHTML = `
      <div class="space-y-2">
        ${imageHtml}
        <div class="text-sm text-slate-700">
          <div><strong>メニュー:</strong> ${m.menu_name || '-'}</div>
          <div><strong>価格:</strong> ${formatJPY(m.price)}</div>
          ${m.notes ? `<div class="text-xs text-slate-500 mt-1">${m.notes}</div>` : ''}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('loadTodayMenu failed:', err);
    todayMenuDiv.innerHTML = `
      <p class="text-orange-600 text-sm">
        メニュー読み込みエラー
      </p>
    `;
  }
}

// ====== Order Form Submit ======
if (orderForm) {
  orderForm.addEventListener('submit', async e => {
    e.preventDefault();

    const dateVal = orderDateInput.value;
    const empVal = employeeSelect.value;
    const menuType = document.querySelector('input[name="menu-type"]:checked')?.value || '通常メニュー';
    const deliveryLocation = deliveryLocationSelect.value;

    if (!dateVal || !empVal) {
      alert('日付と社員名を選択してください。');
      return;
    }

    // Check if order date is valid
    const minDate = getMinimumOrderDate();
    if (dateVal < minDate) {
      alert(`本日の注文締切は${ORDER_DEADLINE_HOUR}:${String(ORDER_DEADLINE_MINUTE).padStart(2, '0')}です。明日以降の日付を選択してください。`);
      return;
    }

    try {
      formMessage.textContent = '送信中…';
      formMessage.className = 'text-xs text-sky-600 flex-1';

      const payload = {
        action: 'saveOrder',
        date: dateVal,
        employee: empVal,
        menuType: menuType,
        deliveryLocation: deliveryLocation,
      };

      const result = await apiPost(payload);

      if (result.error) {
        formMessage.textContent = `エラー: ${result.error}`;
        formMessage.className = 'text-xs text-red-600 flex-1';
      } else {
        formMessage.textContent = '✓ 注文を送信しました';
        formMessage.className = 'text-xs text-emerald-600 flex-1';
        
        // Refresh today's menu if order is for today
        if (dateVal === todayStr()) {
          loadTodayMenu();
        }
      }
    } catch (err) {
      console.error('saveOrder failed:', err);
      formMessage.textContent = 'エラー: 送信失敗';
      formMessage.className = 'text-xs text-red-600 flex-1';
    }
  });
}

// ====== Multi-date mode ======
if (multiModeToggle && multiPanel) {
  multiModeToggle.addEventListener('change', () => {
    const checked = multiModeToggle.checked;
    multiPanel.classList.toggle('hidden', !checked);
  });
}

if (btnGenerateMultiDays && multiMonthInput && multiDaysContainer) {
  btnGenerateMultiDays.addEventListener('click', () => {
    console.log('Generate multi-days clicked');
    const monthVal = multiMonthInput.value;
    console.log('Month value:', monthVal);
    
    if (!monthVal) {
      alert('対象月を選択してください。');
      return;
    }

    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const minDate = getMinimumOrderDate();
    
    console.log('Year:', year, 'Month:', month, 'Days:', daysInMonth, 'Min Date:', minDate);

    const checkboxes = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${dd}`;
      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay();
      
      // （必要なら）ここで週末も含めて表示する
// 週末も注文可能にするため、土日をスキップしない

// Skip dates before minimum order date（過去日は非表示）
if (dateStr < minDate) continue;

      const w = weekdayJa[dayOfWeek] || '';
      const label = `${dateStr} (${w})`;

      checkboxes.push(`
        <label class="inline-flex items-center gap-2 p-2 rounded-lg hover:bg-sky-50 cursor-pointer">
          <input type="checkbox" name="multi-dates" value="${dateStr}" class="rounded border-sky-300" />
          <span>${label}</span>
        </label>
      `);
    }

    if (checkboxes.length === 0) {
      multiDaysContainer.innerHTML = '<p class="text-slate-500 text-sm">選択可能な日付がありません。</p>';
      console.log('No valid dates found');
    } else {
      multiDaysContainer.innerHTML = `
        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          ${checkboxes.join('')}
        </div>
      `;
      console.log('Generated', checkboxes.length, 'date checkboxes');
    }
  });
}

if (btnSubmitMulti) {
  btnSubmitMulti.addEventListener('click', async () => {
    const empVal = employeeSelect.value;
    if (!empVal) {
      alert('社員名を選択してください。');
      return;
    }

    const menuType = document.querySelector('input[name="menu-type-multi"]:checked')?.value || '通常メニュー';
    const deliveryLocation = deliveryLocationMultiSelect.value;

    const checkedInputs = multiDaysContainer.querySelectorAll('input[name="multi-dates"]:checked');
    if (checkedInputs.length === 0) {
      alert('日付を1つ以上選択してください。');
      return;
    }

    const dates = Array.from(checkedInputs).map(inp => inp.value);

    const confirmed = confirm(`${empVal} さんの注文を ${dates.length} 日分まとめて登録しますか？`);
    if (!confirmed) return;

    try {
      for (const dateStr of dates) {
        const payload = {
          action: 'saveOrder',
          date: dateStr,
          employee: empVal,
          menuType: menuType,
          deliveryLocation: deliveryLocation,
        };

        await apiPost(payload);
      }

      alert(`${dates.length} 日分の注文を登録しました。`);
      
      // Clear checkboxes
      checkedInputs.forEach(inp => (inp.checked = false));
    } catch (err) {
      console.error('Multi-submit error:', err);
      alert('一括登録中にエラーが発生しました。');
    }
  });
}

// ====== Dashboard ======
async function loadDaySummary(dateVal) {
  if (!dayOrdersBody) return;

  try {
    const data = await apiGet({ action: 'getDaySummary', date: dateVal });
    if (data.error) {
      console.error('getDaySummary error:', data.error);
      return;
    }

    lastDaySummary = data;

    const orders = data.orders || [];
    const total = data.total || 0;
    const totalAmount = data.totalAmount || 0;

    dayTotalCountEl.textContent = total;
    dayTotalAmountEl.textContent = formatJPY(totalAmount);

    if (orders.length === 0) {
      dayOrdersBody.innerHTML = `
        <tr><td colspan="4" class="px-2 py-2 text-center text-slate-400">データなし</td></tr>
      `;
      return;
    }

    dayOrdersBody.innerHTML = orders
      .map(o => {
        return `
          <tr class="border-t border-slate-100">
            <td class="px-2 py-1">${o.employee}</td>
            <td class="px-2 py-1">${o.menuType || '-'}</td>
            <td class="px-2 py-1">${o.deliveryLocation || '-'}</td>
            <td class="px-2 py-1 text-right">${formatJPY(o.price)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('loadDaySummary failed:', err);
  }
}

async function loadMonthSummary(monthVal) {
  if (!monthEmployeeBody || !monthDayBody) return;

  try {
    const data = await apiGet({ action: 'getMonthSummary', month: monthVal });
    if (data.error) {
      console.error('getMonthSummary error:', data.error);
      return;
    }

    lastMonthSummary = data;

    const total = data.total || 0;
    const totalAmount = data.totalAmount || 0;

    monthTotalCountEl.textContent = total;
    monthTotalAmountEl.textContent = formatJPY(totalAmount);

    // Employee summary
    const empList = data.byEmployee || [];
    if (empList.length === 0) {
      monthEmployeeBody.innerHTML = `
        <tr><td colspan="3" class="px-2 py-2 text-center text-slate-400">データなし</td></tr>
      `;
    } else {
      monthEmployeeBody.innerHTML = empList
        .map(e => {
          return `
            <tr class="border-t border-slate-100">
              <td class="px-2 py-1">${e.employee}</td>
              <td class="px-2 py-1 text-right">${e.count}</td>
              <td class="px-2 py-1 text-right">${formatJPY(e.amount)}</td>
            </tr>
          `;
        })
        .join('');
    }

    // Day summary
    const dayList = data.byDay || [];
    if (dayList.length === 0) {
      monthDayBody.innerHTML = `
        <tr><td colspan="3" class="px-2 py-2 text-center text-slate-400">データなし</td></tr>
      `;
    } else {
      monthDayBody.innerHTML = dayList
        .map(d => {
          return `
            <tr class="border-t border-slate-100">
              <td class="px-2 py-1">${d.date}</td>
              <td class="px-2 py-1 text-right">${d.count}</td>
              <td class="px-2 py-1 text-right">${formatJPY(d.amount)}</td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('loadMonthSummary failed:', err);
  }
}

if (btnRefreshDashboard) {
  btnRefreshDashboard.addEventListener('click', async () => {
    const dateVal = dashboardDateInput.value || todayStr();
    const monthVal = dashboardMonthInput.value || monthStrFromDateStr(todayStr());

    dashboardDateLabel.textContent = dateVal;
    dashboardMonthLabel.textContent = monthVal;

    await Promise.all([loadDaySummary(dateVal), loadMonthSummary(monthVal)]);
  });
}

// ====== CSV Download ======
if (btnDownloadDay) {
  btnDownloadDay.addEventListener('click', () => {
    if (!lastDaySummary || !lastDaySummary.orders) {
      alert('日次データがありません。');
      return;
    }

    const orders = lastDaySummary.orders;
    const rows = [['日付', '社員名', 'メニュー種類', 'お届け場所', '金額']];

    orders.forEach(o => {
      rows.push([o.date, o.employee, o.menuType || '-', o.deliveryLocation || '-', o.price || 0]);
    });

    const dateVal = dashboardDateInput.value || todayStr();
    downloadCsv(`日次_${dateVal}.csv`, rows);
  });
}

if (btnDownloadWeek) {
  btnDownloadWeek.addEventListener('click', async () => {
    const dateVal = dashboardDateInput.value || todayStr();
    const range = getWeekRange(dateVal);

    try {
      const promises = [];
      let current = new Date(range.start);
      const endDate = new Date(range.end);

      while (current <= endDate) {
        const ds = toDateStr(current);
        promises.push(apiGet({ action: 'getDaySummary', date: ds }));
        current.setDate(current.getDate() + 1);
      }

      const results = await Promise.all(promises);

      const rows = [['日付', '社員名', 'メニュー種類', 'お届け場所', '金額']];
      results.forEach(r => {
        if (r.error || !r.orders) return;
        r.orders.forEach(o => {
          rows.push([o.date, o.employee, o.menuType || '-', o.deliveryLocation || '-', o.price || 0]);
        });
      });

      if (rows.length <= 1) {
        alert('週次データがありません。');
        return;
      }

      downloadCsv(`週次_${range.start}_to_${range.end}.csv`, rows);
    } catch (err) {
      console.error('週次 download error:', err);
      alert('週次データ取得エラー');
    }
  });
}

if (btnDownloadMonth) {
  btnDownloadMonth.addEventListener('click', async () => {
    const monthVal = dashboardMonthInput.value || monthStrFromDateStr(todayStr());

    try {
      const data = await apiGet({ action: 'getMonthSummary', month: monthVal });
      if (data.error || !data.allOrders) {
        alert('月次データがありません。');
        return;
      }

      const rows = [['日付', '社員名', 'メニュー種類', 'お届け場所', '金額']];
      data.allOrders.forEach(o => {
        rows.push([o.date, o.employee, o.menuType || '-', o.deliveryLocation || '-', o.price || 0]);
      });

      downloadCsv(`月次_${monthVal}.csv`, rows);
    } catch (err) {
      console.error('月次 download error:', err);
      alert('月次データ取得エラー');
    }
  });
}

// ====== Employee Summary ======
if (btnLoadEmployeeSummary) {
  btnLoadEmployeeSummary.addEventListener('click', async () => {
    const empVal = summaryEmployeeSelect.value;
    const monthVal = summaryMonthInput.value;

    if (!empVal || !monthVal) {
      alert('社員名と対象月を選択してください。');
      return;
    }

    employeeSummaryView.textContent = '読み込み中…';

    try {
      const data = await apiGet({
        action: 'getEmployeeSummary',
        employee: empVal,
        month: monthVal,
      });

      if (data.error) {
        employeeSummaryView.innerHTML = `<p class="text-red-600">エラー: ${data.error}</p>`;
        return;
      }

      lastEmployeeSummary = data;

      const orders = data.orders || [];
      const total = data.total || 0;
      const totalAmount = data.totalAmount || 0;

      if (orders.length === 0) {
        employeeSummaryView.innerHTML = `
          <p class="text-slate-500">データがありません。</p>
        `;
        return;
      }

      const tableHtml = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs border border-slate-200">
            <thead class="bg-sky-50 text-slate-700">
              <tr>
                <th class="px-2 py-1 text-left border">日付</th>
                <th class="px-2 py-1 text-left border">メニュー</th>
                <th class="px-2 py-1 text-left border">お届け場所</th>
                <th class="px-2 py-1 text-right border">金額</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr class="border-t">
                  <td class="px-2 py-1 border">${o.date}</td>
                  <td class="px-2 py-1 border">${o.menuType || '-'}</td>
                  <td class="px-2 py-1 border">${o.deliveryLocation || '-'}</td>
                  <td class="px-2 py-1 text-right border">${formatJPY(o.price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="mt-2 text-sm font-semibold text-slate-700">
            合計: ${total}件 / ${formatJPY(totalAmount)}
          </div>
        </div>
      `;

      employeeSummaryView.innerHTML = tableHtml;
    } catch (err) {
      console.error('getEmployeeSummary failed:', err);
      employeeSummaryView.innerHTML = `<p class="text-red-600">読み込みエラー</p>`;
    }
  });
}

// ====== Menu Calendar ======
if (calendarMonthInput) {
  calendarMonthInput.addEventListener('change', loadMenuCalendar);
}

async function loadMenuCalendar() {
  if (!calendarGrid || !calendarMonthInput) return;

  const monthVal = calendarMonthInput.value;
  if (!monthVal) {
    calendarGrid.innerHTML = '<p class="text-slate-400 text-sm">対象月を選択してください。</p>';
    return;
  }

  calendarGrid.innerHTML = '<p class="text-slate-400 text-sm">読み込み中…</p>';

  try {
    const data = await apiGet({ action: 'getMenuCalendar', month: monthVal });
    if (data.error) {
      calendarGrid.innerHTML = `<p class="text-red-600 text-sm">エラー: ${data.error}</p>`;
      return;
    }

    const menus = data.menus || [];
    if (menus.length === 0) {
      calendarGrid.innerHTML = '<p class="text-slate-400 text-sm">メニューが登録されていません。</p>';
      return;
    }

    const tableHtml = `
      <table class="min-w-full border border-slate-200">
        <thead class="bg-sky-50 text-slate-700">
          <tr>
            <th class="px-3 py-2 text-left border">日付</th>
            <th class="px-3 py-2 text-left border">メニュー名</th>
            <th class="px-3 py-2 text-right border">価格</th>
            <th class="px-3 py-2 text-left border">備考</th>
          </tr>
        </thead>
        <tbody>
          ${menus.map(m => `
            <tr class="border-t hover:bg-sky-50">
              <td class="px-3 py-2 border">${m.date}</td>
              <td class="px-3 py-2 border">${m.menu_name || '-'}</td>
              <td class="px-3 py-2 text-right border">${formatJPY(m.price)}</td>
              <td class="px-3 py-2 border text-xs text-slate-500">${m.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    calendarGrid.innerHTML = tableHtml;
  } catch (err) {
    console.error('loadMenuCalendar failed:', err);
    calendarGrid.innerHTML = '<p class="text-red-600 text-sm">読み込みエラー</p>';
  }
}

// ====== Today Orders List ======
async function loadTodayOrders() {
  if (!todayOrdersBody) return;

  const today = todayStr();
  todayOrdersBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-slate-400">読み込み中…</td></tr>';

  try {
    const data = await apiGet({ action: 'getDaySummary', date: today });
    if (data.error) {
      todayOrdersBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-red-600">エラー: ${data.error}</td></tr>`;
      return;
    }

    const orders = data.orders || [];
    if (orders.length === 0) {
      todayOrdersBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-slate-400">本日の注文はありません</td></tr>';
      return;
    }

    todayOrdersBody.innerHTML = orders.map((o, idx) => `
      <tr class="border-t border-slate-100 hover:bg-sky-50">
        <td class="px-3 py-2">${o.employee}</td>
        <td class="px-3 py-2">${o.menuType || '-'}</td>
        <td class="px-3 py-2">${o.deliveryLocation || '-'}</td>
        <td class="px-3 py-2 text-right">
          <button 
            onclick="editTodayOrder('${o.employee}', '${o.date}')" 
            class="px-2 py-1 text-xs rounded bg-sky-100 text-sky-700 hover:bg-sky-200 mr-1"
          >
            編集
          </button>
          <button 
            onclick="deleteTodayOrder('${o.employee}', '${o.date}')" 
            class="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
          >
            削除
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadTodayOrders failed:', err);
    todayOrdersBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-red-600">読み込みエラー</td></tr>';
  }
}

// Edit today order
window.editTodayOrder = async function(employee, date) {
  // Check time restriction
  if (!canOrderToday()) {
    alert(`編集期限を過ぎています。${ORDER_DEADLINE_HOUR}:${String(ORDER_DEADLINE_MINUTE).padStart(2, '0')}以降は編集できません。`);
    return;
  }

  const menuType = prompt('メニュー種類を入力してください (通常メニュー/豚抜き/おかずのみ/ご飯のみ):');
  if (!menuType) return;

  const deliveryLocation = prompt('お届け場所を入力してください (本社C棟/本社A棟/駒岡工場):');
  if (!deliveryLocation) return;

  try {
    const payload = {
      action: 'saveOrder',
      date: date,
      employee: employee,
      menuType: menuType,
      deliveryLocation: deliveryLocation,
    };

    const result = await apiPost(payload);
    if (result.error) {
      alert(`エラー: ${result.error}`);
    } else {
      alert('注文を更新しました');
      loadTodayOrders();
    }
  } catch (err) {
    console.error('editTodayOrder failed:', err);
    alert('更新エラー');
  }
};

// Delete today order
window.deleteTodayOrder = async function(employee, date) {
  // Check time restriction
  if (!canOrderToday()) {
    alert(`削除期限を過ぎています。${ORDER_DEADLINE_HOUR}:${String(ORDER_DEADLINE_MINUTE).padStart(2, '0')}以降は削除できません。`);
    return;
  }

  const confirmed = confirm(`${employee}さんの注文を削除しますか？`);
  if (!confirmed) return;

  try {
    const payload = {
      action: 'deleteOrder',
      date: date,
      employee: employee,
    };

    const result = await apiPost(payload);
    if (result.error) {
      alert(`エラー: ${result.error}`);
    } else {
      alert('注文を削除しました');
      loadTodayOrders();
    }
  } catch (err) {
    console.error('deleteTodayOrder failed:', err);
    alert('削除エラー');
  }
};

if (btnRefreshTodayOrders) {
  btnRefreshTodayOrders.addEventListener('click', loadTodayOrders);
}

if (btnDownloadTodayOrders) {
  btnDownloadTodayOrders.addEventListener('click', async () => {
    const today = todayStr();

    try {
      const data = await apiGet({ action: 'getDaySummary', date: today });
      if (data.error || !data.orders || data.orders.length === 0) {
        alert('本日のデータがありません。');
        return;
      }

      const rows = [['日付', '社員名', 'メニュー種類', 'お届け場所', '金額']];
      data.orders.forEach(o => {
        rows.push([
          o.date,
          o.employee,
          o.menuType || '-',
          o.deliveryLocation || '-',
          o.price || 0,
        ]);
      });

      downloadCsv(`本日注文_${today}.csv`, rows);
    } catch (err) {
      console.error('today orders download error:', err);
      alert('ダウンロードエラー');
    }
  });
}

// ====== Menu PDF Display ======
function loadMenuDisplay() {
  const savedUrl = localStorage.getItem('menuPdfUrl');
  if (savedUrl) {
    menuUrlInput.value = savedUrl;
    displayMenuContent(savedUrl);
  }
}

function displayMenuContent(url) {
  if (!url) {
    menuDisplayArea.innerHTML = '<p class="text-sm text-slate-400">メニューURLを設定してください</p>';
    return;
  }

  // Check if it's a PDF
  if (url.toLowerCase().endsWith('.pdf') || url.includes('pdf')) {
    menuDisplayArea.innerHTML = `
      <iframe src="${url}" class="w-full h-[600px] rounded-lg border border-slate-200"></iframe>
      <div class="mt-2 text-center">
        <a href="${url}" target="_blank" class="text-sky-600 hover:text-sky-700 text-sm underline">
          新しいタブで開く
        </a>
      </div>
    `;
  } else {
    // Assume it's an image
    menuDisplayArea.innerHTML = `
      <img src="${url}" alt="Menu" class="max-w-full h-auto rounded-lg border border-slate-200" />
      <div class="mt-2 text-center">
        <a href="${url}" target="_blank" class="text-sky-600 hover:text-sky-700 text-sm underline">
          新しいタブで開く
        </a>
      </div>
    `;
  }
}

if (btnSaveMenuUrl) {
  btnSaveMenuUrl.addEventListener('click', () => {
    const url = menuUrlInput.value.trim();
    if (!url) {
      alert('URLを入力してください');
      return;
    }

    localStorage.setItem('menuPdfUrl', url);
    displayMenuContent(url);
    alert('メニューURLを保存しました');
  });
}

// ====== Initialize ======
window.addEventListener('DOMContentLoaded', () => {
  const today = todayStr();
  const currentMonth = monthStrFromDateStr(today);

  if (todayHeaderText) todayHeaderText.textContent = formatTodayHeader(today);

  if (orderDateInput) {
    const min = getMinimumOrderDate();
    orderDateInput.value = min;
    orderDateInput.min = min;
  }

  if (dashboardDateInput) dashboardDateInput.value = today;
  if (dashboardMonthInput) dashboardMonthInput.value = currentMonth;
  if (dashboardDateLabel) dashboardDateLabel.textContent = today;
  if (dashboardMonthLabel) dashboardMonthLabel.textContent = currentMonth;

  if (multiMonthInput) multiMonthInput.value = currentMonth;
  if (summaryMonthInput) summaryMonthInput.value = currentMonth;
  if (calendarMonthInput) {
    calendarMonthInput.value = currentMonth;
    // ← langsung load kalender untuk bulan sekarang
    loadMenuCalendar();
  }

  loadWeather();
  loadEmployees();
  loadTodayMenu();
  
  showTimeRestrictionMessage();
  setInterval(showTimeRestrictionMessage, 60000);
});

