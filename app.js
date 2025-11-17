// ====== SETTING ======
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwevJsl--6Sy1JRWJzTrlybNRlTvkttpc7xsM03-nOhvhb6pGH2PlP7AHLA8QqwjZmZ/exec';
// =====================

// ====== Utils ======
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

async function apiGet(params) {
  const url = new URL(API_BASE_URL);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
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
        .join(',')
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

// ====== DOM refs ======
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

const btnDownloadDay   = document.getElementById('btn-download-day');
const btnDownloadWeek  = document.getElementById('btn-download-week');
const btnDownloadMonth = document.getElementById('btn-download-month');
const employeeSearchInput = document.getElementById('employee-search');

// cache summary data for export
let lastDaySummary = null;
let lastMonthSummary = null;
let allEmployees = [];
// ====== Tabs ======
function activateTab(name) {
  if (name === 'order') {
    orderSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    tabOrder.classList.add('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
    tabDashboard.classList.remove('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
  } else {
    orderSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    tabDashboard.classList.add('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
    tabOrder.classList.remove('bg-white', 'text-sky-900', 'border', 'border-sky-300', 'shadow-sm');
  }
}

tabOrder.addEventListener('click', () => activateTab('order'));
tabDashboard.addEventListener('click', () => activateTab('dashboard'));

// ====== Load employees ======
async function loadEmployees() {
  try {
    const data = await apiGet({ action: 'getEmployees' });

    // Normalisasi: boleh string lama, boleh object baru
    allEmployees = (data.employees || []).map(emp => {
      if (typeof emp === 'string') {
        return { name: emp, dept: '' };
      }
      return {
        name: emp.name || '',
        dept: emp.dept || emp.department || ''
      };
    }).filter(e => e.name);

    renderEmployeeOptions('');
  } catch (err) {
    console.error(err);
    employeeSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '社員リスト取得エラー';
    employeeSelect.appendChild(opt);
  }
}
function renderEmployeeOptions(filterText) {
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
    opt.value = e.name; // backend tetap terima nama saja
    opt.textContent = e.dept ? `${e.name}（${e.dept}）` : e.name;
    employeeSelect.appendChild(opt);
  });
}
if (employeeSearchInput) {
  employeeSearchInput.addEventListener('input', () => {
    const text = employeeSearchInput.value || '';
    renderEmployeeOptions(text.trim());
  });
}


// ====== Menu per date ======
async function loadMenuForDate(dateStr) {
  todayMenuDiv.textContent = '読み込み中…';
  todayDateLabel.textContent = `(${dateStr})`;

  try {
    const data = await apiGet({ action: 'getMenu', date: dateStr });
    const menu = data.menu;
    if (!menu) {
      todayMenuDiv.textContent = 'メニュー未登録';
    } else {
      const imgHtml = menu.imageUrl
        ? `
          <div class="w-full sm:w-40 h-32 flex-shrink-0">
            <img src="${menu.imageUrl}"
                 alt="${menu.name || ''}"
                 class="w-full h-full object-cover rounded-xl border border-sky-100 shadow-sm" />
          </div>
        `
        : '';

      todayMenuDiv.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex-1">
            <div class="font-semibold text-sky-900">${menu.name || '未設定'}</div>
            <div class="text-sm text-slate-500 mt-1">日付: ${menu.date}</div>
            <div class="mt-2 text-sm text-slate-600">
              価格: <span class="font-semibold text-orange-700">${formatJPY(menu.price || 0)}</span>
            </div>
          </div>
          ${imgHtml}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    todayMenuDiv.textContent = 'メニュー取得エラー';
  }
}


// ====== Submit order ======
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
      // sinkronkan dashboard
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

// ====== Day summary ======
async function loadDaySummary(dateStr) {
  dashboardDateLabel.textContent = dateStr;
  dayOrdersBody.innerHTML = '';
  dayTotalCountEl.textContent = '-';
  dayTotalAmountEl.textContent = '-';

  try {
    const data = await apiGet({ action: 'getDaySummary', date: dateStr });
    lastDaySummary = data;

    dayTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    dayTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    if (data.orders && data.orders.length > 0) {
      data.orders.forEach(o => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-sky-50';
        tr.innerHTML = `
          <td class="py-1 pr-4">${o.employee}</td>
          <td class="py-1 pr-4">
            <span class="px-2 py-0.5 rounded-full text-[11px] ${
              o.status === '注文する'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-orange-50 text-orange-700 border border-orange-200'
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

// ====== Month summary ======
async function loadMonthSummary(monthStr) {
  dashboardMonthLabel.textContent = monthStr || '';
  monthEmployeeBody.innerHTML = '';
  monthDayBody.innerHTML = '';
  monthTotalCountEl.textContent = '-';
  monthTotalAmountEl.textContent = '-';

  if (!monthStr) return;

  try {
    const data = await apiGet({ action: 'getMonthSummary', month: monthStr });
    lastMonthSummary = data;

    monthTotalCountEl.textContent = `${data.totalCount || 0} 件`;
    monthTotalAmountEl.textContent = formatJPY(data.totalAmount || 0);

    // employee
    if (data.perEmployee && data.perEmployee.length > 0) {
      data.perEmployee.forEach(e => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-sky-50';
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
        tr.className = 'border-b border-sky-50';
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

// ====== Dashboard refresh button ======
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

// ====== Date change handlers (auto ganti menu & summary) ======
orderDateInput.addEventListener('change', async () => {
  const dateStr = orderDateInput.value;
  if (!dateStr) return;
  await loadMenuForDate(dateStr);
  dashboardDateInput.value = dateStr;
  dashboardMonthInput.value = monthStrFromDateStr(dateStr);
  await Promise.all([
    loadDaySummary(dateStr),
    loadMonthSummary(dashboardMonthInput.value)
  ]);
});

dashboardDateInput.addEventListener('change', async () => {
  const dateStr = dashboardDateInput.value;
  if (!dateStr) return;
  await loadDaySummary(dateStr);
  if (!dashboardMonthInput.value) {
    dashboardMonthInput.value = monthStrFromDateStr(dateStr);
  }
});

// ====== Auto change when real date changes (cek tiap 1 menit) ======
let currentSystemDate = todayStr();
setInterval(async () => {
  const now = todayStr();
  if (now !== currentSystemDate) {
    currentSystemDate = now;
    orderDateInput.value = now;
    dashboardDateInput.value = now;
    dashboardMonthInput.value = monthStrFromDateStr(now);
    await loadMenuForDate(now);
    await Promise.all([
      loadDaySummary(now),
      loadMonthSummary(monthStrFromDateStr(now))
    ]);
  }
}, 60 * 1000);

// ====== Download Excel/CSV ======
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

  // フィルタ: 月次のperDayから週の範囲だけ抜き出す
  const perDay = (lastMonthSummary.perDay || []).filter(d =>
    d.date >= start && d.date <= end
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

// ====== Init ======
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
