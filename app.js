// ====== SETTING ======
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec'; // contoh: 'https://script.google.com/macros/s/xxx/exec'
// =====================

// Utils
function formatJPY(amount) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
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

async function apiGet(params) {
  const url = new URL(API_BASE_URL);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));

  const res = await fetch(url.toString(), {
    method: 'GET'
  });
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify(data) // tidak set Content-Type agar tetap simple request
  });
  return res.json();
}

// DOM
const orderSection      = document.getElementById('order-section');
const dashboardSection  = document.getElementById('dashboard-section');
const tabOrder          = document.getElementById('tab-order');
const tabDashboard      = document.getElementById('tab-dashboard');

const orderDateInput    = document.getElementById('order-date');
const employeeSelect    = document.getElementById('employee-name');
const formMessage       = document.getElementById('form-message');
const orderForm         = document.getElementById('order-form');

const todayDateLabel    = document.getElementById('today-date-label');
const todayMenuDiv      = document.getElementById('today-menu');

const dashboardDateInput   = document.getElementById('dashboard-date');
const dashboardMonthInput  = document.getElementById('dashboard-month');
const dashboardDateLabel   = document.getElementById('dashboard-date-label');
const dashboardMonthLabel  = document.getElementById('dashboard-month-label');

const btnRefreshDashboard  = document.getElementById('btn-refresh-dashboard');

const dayTotalCountEl    = document.getElementById('day-total-count');
const dayTotalAmountEl   = document.getElementById('day-total-amount');
const dayOrdersBody      = document.getElementById('day-orders-body');

const monthTotalCountEl  = document.getElementById('month-total-count');
const monthTotalAmountEl = document.getElementById('month-total-amount');
const monthEmployeeBody  = document.getElementById('month-employee-body');
const monthDayBody       = document.getElementById('month-day-body');

// Tab switching
function activateTab(name) {
  if (name === 'order') {
    orderSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    tabOrder.classList.add('bg-slate-900', 'text-white', 'shadow-sm');
    tabDashboard.classList.remove('bg-slate-900', 'text-white', 'shadow-sm');
  } else {
    orderSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    tabDashboard.classList.add('bg-slate-900', 'text-white', 'shadow-sm');
    tabOrder.classList.remove('bg-slate-900', 'text-white', 'shadow-sm');
  }
}

tabOrder.addEventListener('click', () => activateTab('order'));
tabDashboard.addEventListener('click', () => activateTab('dashboard'));

// Load employees
async function loadEmployees() {
  try {
    const data = await apiGet({ action: 'getEmployees' });
    employeeSelect.innerHTML = '';

    if (data.employees && data.employees.length > 0) {
      data.employees.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        employeeSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '社員マスタが未設定です';
      employeeSelect.appendChild(opt);
    }
  } catch (err) {
    console.error(err);
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '社員リスト取得エラー';
    employeeSelect.appendChild(opt);
  }
}

// Load menu for date
async function loadMenuForDate(dateStr) {
  todayMenuDiv.textContent = '読み込み中…';
  todayDateLabel.textContent = `(${dateStr})`;

  try {
    const data = await apiGet({ action: 'getMenu', date: dateStr });
    const menu = data.menu;
    if (!menu) {
      todayMenuDiv.textContent = 'メニュー未登録';
    } else {
      todayMenuDiv.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="font-semibold">${menu.name || '未設定'}</div>
            <div class="text-sm text-slate-300 mt-1">日付: ${menu.date}</div>
          </div>
          <div class="text-right">
            <div class="text-sm text-slate-300">価格</div>
            <div class="text-lg font-semibold">${formatJPY(menu.price || 0)}</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    todayMenuDiv.textContent = 'メニュー取得エラー';
  }
}

// Submit order
orderForm.addEventListener('submit', async (e) => {
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
      status
    });

    if (res && res.success) {
      formMessage.textContent = '保存しました。';
      // refresh dashboard date supaya sync
      dashboardDateInput.value = dateStr;
      dashboardMonthInput.value = monthStrFromDateStr(dateStr);
      await Promise.all([
        loadDaySummary(dateStr),
        loadMonthSummary(dashboardMonthInput.value)
      ]);
    } else {
      formMessage.textContent = '保存に失敗しました。';
    }
  } catch (err) {
    console.error(err);
    formMessage.textContent = '通信エラーが発生しました。';
  }
});

// Day summary
async function loadDaySummary(dateStr) {
  dashboardDateLabel.textContent = dateStr;
  dayOrdersBody.innerHTML = '';
  dayTotalCountEl.textContent = '-';
  dayTotalAmountEl.textContent = '-';

  try {
    const data = await apiGet({ action: 'getDaySummary', date: dateStr });
    dayTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    dayTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    if (data.orders && data.orders.length > 0) {
      data.orders.forEach(o => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800';
        tr.innerHTML = `
          <td class="py-1 pr-4">${o.employee}</td>
          <td class="py-1 pr-4">
            <span class="px-2 py-0.5 rounded-full text-[11px] ${
              o.status === '注文する'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-700/60 text-slate-200 border border-slate-600'
            }">${o.status}</span>
          </td>
          <td class="py-1 text-right">${formatJPY(o.subTotal || 0)}</td>
        `;
        dayOrdersBody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="3" class="py-2 text-slate-400">注文データがありません。</td>
      `;
      dayOrdersBody.appendChild(tr);
    }
  } catch (err) {
    console.error(err);
  }
}

// Month summary
async function loadMonthSummary(monthStr) {
  dashboardMonthLabel.textContent = monthStr || '';
  monthEmployeeBody.innerHTML = '';
  monthDayBody.innerHTML = '';
  monthTotalCountEl.textContent = '-';
  monthTotalAmountEl.textContent = '-';

  if (!monthStr) return;

  try {
    const data = await apiGet({ action: 'getMonthSummary', month: monthStr });

    monthTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    monthTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    // employee
    if (data.perEmployee && data.perEmployee.length > 0) {
      data.perEmployee.forEach(e => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800';
        tr.innerHTML = `
          <td class="py-1 pr-4">${e.employee}</td>
          <td class="py-1 pr-4 text-right">${e.count}</td>
          <td class="py-1 text-right">${formatJPY(e.amount || 0)}</td>
        `;
        monthEmployeeBody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" class="py-2 text-slate-400">データがありません。</td>`;
      monthEmployeeBody.appendChild(tr);
    }

    // per day
    if (data.perDay && data.perDay.length > 0) {
      data.perDay.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800';
        tr.innerHTML = `
          <td class="py-1 pr-4">${d.date}</td>
          <td class="py-1 pr-4 text-right">${d.count}</td>
          <td class="py-1 text-right">${formatJPY(d.amount || 0)}</td>
        `;
        monthDayBody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" class="py-2 text-slate-400">データがありません。</td>`;
      monthDayBody.appendChild(tr);
    }
  } catch (err) {
    console.error(err);
  }
}

// Dashboard refresh button
btnRefreshDashboard.addEventListener('click', async () => {
  const dateStr = dashboardDateInput.value || todayStr();
  const monthStr = dashboardMonthInput.value || monthStrFromDateStr(dateStr);

  dashboardDateInput.value = dateStr;
  dashboardMonthInput.value = monthStr;

  await Promise.all([
    loadDaySummary(dateStr),
    loadMonthSummary(monthStr)
  ]);
});

// Init
async function init() {
  const today = todayStr();
  orderDateInput.value = today;
  dashboardDateInput.value = today;
  dashboardMonthInput.value = monthStrFromDateStr(today);

  await loadEmployees();
  await loadMenuForDate(today);
  await Promise.all([
    loadDaySummary(today),
    loadMonthSummary(monthStrFromDateStr(today))
  ]);
}

// PWA: register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.log('SW registration failed', err));
  });
}

init();
