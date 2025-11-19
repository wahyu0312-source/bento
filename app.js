/* ========================================================= 
 * app.js — TSH 弁当注文 (frontend)
 * =======================================================*/

// ====== SETTINGS ======
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec';
const WEATHER_API_KEY = '9da4e73a2a764eafc9e32e5b39224a9c';
const WEATHER_CITY = 'Yokohama,jp';

// ====== UTILS ======
function todayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
function monthStrFromDateStr(dateStr) {
  return dateStr.slice(0, 7);
}
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}
function fmtJPY(n) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n || 0);
}
const weekdayJa = ['日','月','火','水','木','金','土'];

async function apiGet(params) {
  const url = new URL(API_BASE_URL);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url);
  return res.json();
}
async function apiPost(data) {
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// ====== DOM ======
const tabOrder = document.getElementById('tab-order');
const tabDashboard = document.getElementById('tab-dashboard');
const tabCalendar = document.getElementById('tab-calendar');
const orderSection = document.getElementById('order-section');
const dashboardSection = document.getElementById('dashboard-section');
const calendarSection = document.getElementById('calendar-section');

const todayHeaderText = document.getElementById('today-header-text');
const weatherHeaderText = document.getElementById('weather-header-text');
const todayMenuDiv = document.getElementById('today-menu');
const orderForm = document.getElementById('order-form');
const orderDateInput = document.getElementById('order-date');
const employeeSelect = document.getElementById('employee-name');
const employeeSearchInput = document.getElementById('employee-search');
const formMessage = document.getElementById('form-message');

// ====== TAB SYSTEM ======
function activateTab(name) {
  const sections = {
    order: orderSection,
    dashboard: dashboardSection,
    calendar: calendarSection
  };
  Object.values(sections).forEach(s => s?.classList.add('hidden'));
  if (sections[name]) sections[name].classList.remove('hidden');

  [tabOrder, tabDashboard, tabCalendar].forEach(b => {
    b?.classList.remove('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
  });
  if (name === 'order') tabOrder?.classList.add('bg-white','text-sky-900','border','border-sky-300','shadow-sm');
  if (name === 'dashboard') tabDashboard?.classList.add('bg-white','text-sky-900','border','border-sky-300','shadow-sm');
  if (name === 'calendar') tabCalendar?.classList.add('bg-white','text-sky-900','border','border-sky-300','shadow-sm');
}

if (tabOrder) tabOrder.addEventListener('click', () => activateTab('order'));
if (tabDashboard) tabDashboard.addEventListener('click', () => activateTab('dashboard'));
if (tabCalendar) tabCalendar.addEventListener('click', () => activateTab('calendar'));

// ====== WEATHER ======
function weatherEmoji(main) {
  const m = (main || '').toLowerCase();
  if (m.includes('cloud')) return '⛅';
  if (m.includes('rain')) return '🌧';
  if (m.includes('clear')) return '☀';
  return '🌤';
}
async function loadWeather() {
  try {
    weatherHeaderText.textContent = '天気取得中...';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric&lang=ja`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = Math.round(data.main.temp);
    const desc = data.weather[0].description;
    const icon = weatherEmoji(data.weather[0].main);
    weatherHeaderText.textContent = `天気：${icon} ${desc} ${temp}℃`;
  } catch (err) {
    weatherHeaderText.textContent = '天気情報取得エラー';
  }
}

// ====== EMPLOYEES ======
let allEmployees = [];
async function loadEmployees() {
  try {
    const data = await apiGet({ action: 'getEmployees' });
    allEmployees = data.employees || [];
    renderEmployeeOptions('');
  } catch (err) {
    console.error('loadEmployees error:', err);
  }
}
function renderEmployeeOptions(filterText) {
  if (!employeeSelect) return;
  const keyword = (filterText || '').toLowerCase();
  employeeSelect.innerHTML = '';
  const filtered = allEmployees.filter(e =>
    !keyword ||
    e.name.toLowerCase().includes(keyword) ||
    (e.dept && e.dept.toLowerCase().includes(keyword))
  );
  if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '社員リストがありません';
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
if (employeeSearchInput)
  employeeSearchInput.addEventListener('input', () => renderEmployeeOptions(employeeSearchInput.value));

// ====== MENU (Today + Calendar) ======
async function loadMenuForDate(dateStr) {
  todayMenuDiv.innerHTML = '読み込み中...';
  try {
    const data = await apiGet({ action: 'getMenu', date: dateStr });
    const menu = data.menu;
    if (!menu) {
      todayMenuDiv.textContent = '本日のメニューがありません。';
      return;
    }
    todayMenuDiv.innerHTML = `
      <div class="flex items-center justify-between p-4 rounded-2xl bg-white/80 border border-sky-100 shadow-sm">
        <div>
          <h3 class="text-sky-900 font-semibold text-base">${menu.name}</h3>
          <p class="text-slate-500 text-sm mt-1">日付: ${menu.date}</p>
          <p class="text-orange-600 font-bold mt-1">${fmtJPY(menu.price)}</p>
        </div>
        ${
          menu.imageUrl
            ? `<img src="${menu.imageUrl}" alt="menu" class="w-24 h-24 object-cover rounded-xl shadow-sm" />`
            : ''
        }
      </div>`;
  } catch (err) {
    todayMenuDiv.textContent = 'メニュー読み込みエラー';
  }
}

async function loadMenuCalendar(monthStr) {
  const calendarDiv = document.getElementById('calendar-view');
  if (!calendarDiv) return;
  calendarDiv.innerHTML = '読み込み中...';
  try {
    const data = await apiGet({ action: 'getMenuCalendar', month: monthStr });
    const list = data.items || [];
    if (list.length === 0) {
      calendarDiv.innerHTML = '<p class="text-slate-500 text-sm">この月のメニューはありません。</p>';
      return;
    }
    let html = '<div class="grid grid-cols-7 gap-2 text-xs sm:text-sm">';
    list.forEach(item => {
      const d = new Date(item.date);
      const w = weekdayJa[d.getDay()];
      html += `
        <div class="p-2 rounded-xl border bg-white/70 text-slate-700">
          <div class="font-semibold">${item.date}（${w}）</div>
          <div class="text-sky-800">${item.name || '-'}</div>
          <div class="text-orange-600">${fmtJPY(item.price || 0)}</div>
        </div>`;
    });
    html += '</div>';
    calendarDiv.innerHTML = html;
  } catch (err) {
    console.error('loadMenuCalendar error:', err);
    calendarDiv.textContent = 'カレンダー読み込みエラー';
  }
}

// ====== FORM ======
if (orderForm) {
  orderForm.addEventListener('submit', async e => {
    e.preventDefault();
    formMessage.textContent = '送信中...';
    const dateStr = orderDateInput.value;
    const employeeName = employeeSelect.value;
    const status = document.querySelector('input[name="order-status"]:checked')?.value;
    try {
      const res = await apiPost({
        action: 'saveOrder',
        date: dateStr,
        employeeName,
        status,
      });
      if (res.success) formMessage.textContent = '保存しました。';
      else formMessage.textContent = '保存に失敗しました。';
    } catch (err) {
      formMessage.textContent = '通信エラーが発生しました。';
    }
  });
}

// ====== INIT ======
async function init() {
  const today = todayStr();
  if (orderDateInput) orderDateInput.value = today;
  if (todayHeaderText) todayHeaderText.textContent = `本日 ${today}`;
  await loadWeather();
  await loadEmployees();
  await loadMenuForDate(today);
  await loadMenuCalendar(monthStrFromDateStr(today));
  activateTab('order');
}

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(err => console.log('SW registration failed', err));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('Init error:', err));
});
