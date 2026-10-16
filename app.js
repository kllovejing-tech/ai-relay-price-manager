import {
  emptyState, priceKeys, priceLabels, uid, now,
  estimate, sortQuotes, validateBackup, restoreState, csv
} from './core.js';

const STORAGE_KEY = 'ai-relay-price-manager:v1';
let rankingMetric = 'input';
let rankingDir = 'asc';
let _lastCalc = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return validateBackup(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('保存失败：' + (e && e.message ? e.message : e));
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmt(n, currency = 'USD') {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 6 }) + ' ' + currency;
}

function modelName(id) {
  const m = state.models.find(x => x.id === id);
  return m ? m.name : '—';
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme === 'dark' ? 'dark' : 'light';
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
  toast('主题已切换');
}

function priceGrid(prices) {
  const p = prices || {};
  return `<div class="price-grid">${priceKeys.map(k =>
    `<div class="price-item"><small>${priceLabels[k]}</small><strong>${fmt(p[k], p.currency)}</strong></div>`
  ).join('')}</div>`;
}

function modelCard(m) {
  const station = state.stations.find(s => s.id === m.stationId);
  return `<div class="list-card">
    <div class="row"><div>
      <div class="title">${esc(m.name)}</div>
      <div class="meta">${station ? esc(station.name) : '未关联中转站'} · ${esc(m.prices.currency || 'USD')}</div>
    </div>
    <div class="toolbar-inline fit">
      <button class="secondary-button fit" data-action="edit-model" data-id="${esc(m.id)}">编辑</button>
      <button class="danger-button fit" data-action="delete-model" data-id="${esc(m.id)}">删除</button>
    </div></div>
    ${priceGrid(m.prices)}
  </div>`;
}

function homeView(view) {
  const totalSpend = state.usages.reduce((s, u) => s + (Number(u.cost) || 0), 0);
  const recent = [...state.models].slice(-5).reverse();
  view.innerHTML = `
    <div class="section-heading"><h2>概览</h2></div>
    <div class="grid stats-grid">
      <div class="stat-card"><span>中转站</span><strong>${state.stations.length}</strong></div>
      <div class="stat-card"><span>模型</span><strong>${state.models.length}</strong></div>
      <div class="stat-card"><span>使用记录</span><strong>${state.usages.length}</strong></div>
      <div class="stat-card"><span>累计花费</span><strong>${fmt(totalSpend, 'USD')}</strong></div>
    </div>
    <div class="panel">
      <div class="toolbar-inline">
        <button class="primary-button" data-action="add-model">+ 新增模型</button>
        <button class="secondary-button" data-action="seed">导入示例</button>
        <button class="secondary-button" data-action="export">导出备份</button>
      </div>
    </div>
    <div class="section-heading"><h3>最近添加的模型</h3><button class="secondary-button fit" data-action="add-model">添加</button></div>
    ${recent.length ? `<div class="list">${recent.map(modelCard).join('')}</div>`
      : `<div class="empty">还没有模型，点击“新增模型”开始，或“导入示例”快速体验。</div>`}
  `;
}

function currencyHeader(c) {
  return `<div class="subtle" style="margin:10px 2px 2px">币种：${esc(c)}</div>`;
}

function rankingView(view) {
  const rows = sortQuotes(state.models, rankingMetric, rankingDir);
  view.innerHTML = `
    <div class="section-heading"><h2>价格排行</h2></div>
    <div class="toolbar">
      <select name="metric" class="toolbar-inline">
        ${priceKeys.map(k => `<option value="${k}" ${k === rankingMetric ? 'selected' : ''}>${priceLabels[k]}</option>`).join('')}
      </select>
      <select name="direction" class="toolbar-inline">
        <option value="asc" ${rankingDir === 'asc' ? 'selected' : ''}>升序</option>
        <option value="desc" ${rankingDir === 'desc' ? 'selected' : ''}>降序</option>
      </select>
      <span></span>
    </div>
    ${state.models.length
      ? `<div class="list">${rows.map(r => (r.header ? currencyHeader(r.currency) : modelCard(r))).join('')}</div>`
      : `<div class="empty">暂无模型数据。</div>`}
  `;
}

function calculatorView(view) {
  const modelOptions = state.models.length
    ? state.models.map(m => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.prices.currency || 'USD')})</option>`).join('')
    : '<option value="">（请先添加模型）</option>';
  view.innerHTML = `
    <div class="section-heading"><h2>费用计算</h2></div>
    <div class="panel">
      <form id="calc-form" class="form-grid">
        <label>选择模型<select name="modelId" class="toolbar-inline">${modelOptions}</select></label>
        <div class="form-grid two">
          <label>输入 tokens<input name="input" inputmode="decimal" value="1000000"></label>
          <label>输出 tokens<input name="output" inputmode="decimal" value="500000"></label>
          <label>缓存读取<input name="cacheRead" inputmode="decimal" value="0"></label>
          <label>缓存写入<input name="cacheWrite" inputmode="decimal" value="0"></label>
        </div>
        <div class="toolbar-inline">
          <button type="button" class="primary-button fit" data-action="calc">计算</button>
        </div>
        <div id="calc-result" class="notice">填写数量后点击“计算”。</div>
      </form>
    </div>`;
}

function doCalc() {
  const form = document.getElementById('calc-form');
  if (!form) return;
  const fd = new FormData(form);
  const modelId = String(fd.get('modelId') || '');
  const model = state.models.find(m => m.id === modelId);
  if (!model) { toast('请先选择模型'); return; }
  const counts = {
    input: fd.get('input') || 0, output: fd.get('output') || 0,
    cacheRead: fd.get('cacheRead') || 0, cacheWrite: fd.get('cacheWrite') || 0
  };
  const est = estimate(model.prices, counts);
  const out = document.getElementById('calc-result');
  if (!est.ok) {
    out.textContent = '无法计算，缺少价格：' + (est.missing || []).join('、');
    _lastCalc = null;
    return;
  }
  const lines = priceKeys.map(k => `${priceLabels[k]} ${fmt(est.items[k], est.currency)}`).join('；');
  out.innerHTML = `<div>明细：${lines}</div>
    <div style="margin-top:6px">合计：<strong>${fmt(est.total, est.currency)}</strong>（倍率 ${est.multiplier}）</div>
    <button type="button" class="secondary-button" data-action="save-usage-from-calc">保存为使用记录</button>`;
  _lastCalc = { modelId, counts, est };
}

function saveCalcUsage() {
  if (!_lastCalc) return;
  const { modelId, counts, est } = _lastCalc;
  state.usages.unshift({
    id: uid(), modelId, date: now().slice(0, 10),
    counts, cost: est.total, currency: est.currency, note: '费用计算'
  });
  save();
  _lastCalc = null;
  render();
  navigate('usage');
  toast('已保存为使用记录');
}

function usageCard(u) {
  const counts = u.counts || {};
  const parts = priceKeys.filter(k => Number(counts[k]) > 0)
    .map(k => `${priceLabels[k]} ${esc(counts[k])}`).join(' · ');
  return `<div class="list-card">
    <div class="row"><div>
      <div class="title">${esc(modelName(u.modelId))}</div>
      <div class="meta">${esc(u.date || '')}${parts ? (' · ' + parts) : ''}</div>
    </div>
    <div style="text-align:right">
      <div><strong>${fmt(u.cost, u.currency || 'USD')}</strong></div>
      <div class="toolbar-inline fit">
        <button class="secondary-button fit" data-action="edit-usage" data-id="${esc(u.id)}">编辑</button>
        <button class="danger-button fit" data-action="delete-usage" data-id="${esc(u.id)}">删除</button>
      </div>
    </div></div>
    ${u.note ? `<div class="meta" style="margin-top:6px">${esc(u.note)}</div>` : ''}
  </div>`;
}

function usageView(view) {
  const list = [...state.usages].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  view.innerHTML = `
    <div class="section-heading"><h2>使用记录</h2><button class="primary-button fit" data-action="add-usage">+ 记录</button></div>
    ${list.length
      ? `<div class="list">${list.map(usageCard).join('')}</div>`
      : `<div class="empty">还没有使用记录。可在“费用计算”中保存，或在此手动添加。</div>`}
  `;
}

function settingsView(view) {
  view.innerHTML = `
    <div class="section-heading"><h2>设置</h2></div>
    <div class="panel">
      <div class="section-heading"><h3>外观</h3><button class="secondary-button fit" data-action="toggle-theme">切换主题</button></div>
      <p class="subtle">当前主题：${state.settings.theme === 'dark' ? '深色' : '浅色'}。也可点击右上角图标切换。</p>
    </div>
    <div class="panel">
      <div class="section-heading"><h3>数据备份</h3></div>
      <div class="toolbar-inline">
        <button class="secondary-button" data-action="export">导出备份</button>
        <button class="secondary-button" data-action="seed">导入示例</button>
      </div>
      <div class="form-grid" style="margin-top:10px">
        <label>从文件恢复备份（合并）<input type="file" name="backup" accept="application/json,.json"></label>
      </div>
      <p class="subtle">恢复模式为合并（按 id 覆盖）。如需完全替换，请先清空数据再导入。</p>
    </div>
    <div class="panel">
      <div class="section-heading"><h3>危险操作</h3><button class="danger-button fit" data-action="clear">清空全部数据</button></div>
    </div>`;
}

const views = { home: homeView, ranking: rankingView, calculator: calculatorView, usage: usageView, settings: settingsView };
let currentView = 'home';

function render() {
  const view = document.getElementById('view');
  if (!view) return;
  const fn = views[currentView] || views.home;
  fn(view);
}

function navigate(view) {
  if (!views[view]) view = 'home';
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  render();
}

function openDialog(title, bodyHtml, onSubmit) {
  const d = document.getElementById('editor-dialog');
  if (!d) return;
  d.className = 'dialog-card';
  d.innerHTML = `<form method="dialog" class="dialog-body">
    <h3>${esc(title)}</h3>
    ${bodyHtml}
    <div class="dialog-actions">
      <button type="button" class="secondary-button" data-cancel>取消</button>
      <button type="submit" class="primary-button">保存</button>
    </div>
  </form>`;
  const form = d.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = onSubmit(form);
    if (result !== false) {
      if (typeof d.close === 'function') d.close();
      save();
      render();
    }
  });
  const cancel = d.querySelector('[data-cancel]');
  cancel.addEventListener('click', () => { if (typeof d.close === 'function') d.close(); });
  if (typeof d.showModal === 'function') d.showModal();
}

function modelEditor(model) {
  const m = model || {
    id: uid(), name: '', stationId: '',
    prices: { input: '', output: '', cacheRead: '', cacheWrite: '', currency: 'USD', multiplier: '' }
  };
  const stationOptions = state.stations.map(s =>
    `<option value="${esc(s.id)}" ${s.id === m.stationId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const body = `
    <div class="form-grid">
      <label>模型名称<input name="name" value="${esc(m.name)}" placeholder="如 gpt-4o" required></label>
      <label>所属中转站<select name="stationId" class="toolbar-inline"><option value="">（无）</option>${stationOptions}</select></label>
      <div class="form-grid two">
        <label>输入单价<input name="input" value="${esc(m.prices.input)}" inputmode="decimal" placeholder="0"></label>
        <label>输出单价<input name="output" value="${esc(m.prices.output)}" inputmode="decimal" placeholder="0"></label>
        <label>缓存读取<input name="cacheRead" value="${esc(m.prices.cacheRead)}" inputmode="decimal" placeholder="0"></label>
        <label>缓存写入<input name="cacheWrite" value="${esc(m.prices.cacheWrite)}" inputmode="decimal" placeholder="0"></label>
      </div>
      <div class="form-grid two">
        <label>币种<select name="currency" class="toolbar-inline">
          <option value="USD" ${m.prices.currency === 'USD' ? 'selected' : ''}>USD</option>
          <option value="CNY" ${m.prices.currency === 'CNY' ? 'selected' : ''}>CNY</option>
        </select></label>
        <label>倍率<input name="multiplier" value="${esc(m.prices.multiplier)}" inputmode="decimal" placeholder="1"></label>
      </div>
    </div>`;
  openDialog(model ? '编辑模型' : '新增模型', body, (form) => {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { toast('请填写模型名称'); return false; }
    m.name = name;
    m.stationId = String(fd.get('stationId') || '');
    m.prices = {
      input: String(fd.get('input') || ''),
      output: String(fd.get('output') || ''),
      cacheRead: String(fd.get('cacheRead') || ''),
      cacheWrite: String(fd.get('cacheWrite') || ''),
      currency: String(fd.get('currency') || 'USD'),
      multiplier: String(fd.get('multiplier') || '')
    };
    if (model) {
      const idx = state.models.findIndex(x => x.id === m.id);
      if (idx >= 0) state.models[idx] = m;
    } else {
      state.models.push(m);
    }
    toast('模型已保存');
  });
}

function usageEditor(usage) {
  const u = usage || { id: uid(), modelId: '', date: now().slice(0, 10), counts: {}, note: '' };
  const modelOptions = state.models.length
    ? state.models.map(m => `<option value="${esc(m.id)}" ${m.id === u.modelId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
    : '<option value="">（暂无模型）</option>';
  const c = u.counts || {};
  const body = `
    <div class="form-grid">
      <label>模型<select name="modelId" class="toolbar-inline" required><option value="">请选择</option>${modelOptions}</select></label>
      <label>日期<input name="date" type="date" value="${esc(u.date)}"></label>
      <div class="form-grid two">
        <label>输入 tokens<input name="input" inputmode="decimal" value="${esc(c.input)}"></label>
        <label>输出 tokens<input name="output" inputmode="decimal" value="${esc(c.output)}"></label>
        <label>缓存读取<input name="cacheRead" inputmode="decimal" value="${esc(c.cacheRead)}"></label>
        <label>缓存写入<input name="cacheWrite" inputmode="decimal" value="${esc(c.cacheWrite)}"></label>
      </div>
      <label>备注<input name="note" value="${esc(u.note)}"></label>
    </div>`;
  openDialog(usage ? '编辑使用记录' : '新增使用记录', body, (form) => {
    const fd = new FormData(form);
    const modelId = String(fd.get('modelId') || '');
    if (!modelId) { toast('请选择模型'); return false; }
    const counts = {
      input: fd.get('input') || '', output: fd.get('output') || '',
      cacheRead: fd.get('cacheRead') || '', cacheWrite: fd.get('cacheWrite') || ''
    };
    const model = state.models.find(m => m.id === modelId);
    const est = estimate(model ? model.prices : {}, counts);
    u.modelId = modelId;
    u.date = String(fd.get('date') || now().slice(0, 10));
    u.counts = counts;
    u.cost = est.ok ? est.total : 0;
    u.currency = est.currency;
    u.note = String(fd.get('note') || '');
    if (usage) {
      const i = state.usages.findIndex(x => x.id === u.id);
      if (i >= 0) state.usages[i] = u;
    } else {
      state.usages.unshift(u);
    }
    toast('使用记录已保存');
  });
}

function deleteModel(id) {
  if (!globalThis.confirm || !globalThis.confirm('删除该模型？相关使用记录仍保留。')) return;
  if (globalThis.confirm && !globalThis.confirm('删除该模型？相关使用记录仍保留。')) return;
  state.models = state.models.filter(m => m.id !== id);
  save();
  render();
  toast('模型已删除');
}

function deleteUsage(id) {
  if (globalThis.confirm && !globalThis.confirm('删除这条使用记录？')) return;
  state.usages = state.usages.filter(u => u.id !== id);
  save();
  render();
  toast('记录已删除');
}

function seedSample() {
  const st = { id: uid(), name: '示例中转站', url: 'https://example.com', note: '演示数据' };
  const m1 = {
    id: uid(), name: 'gpt-4o', stationId: st.id,
    prices: { input: 5, output: 15, cacheRead: 2.5, cacheWrite: 7.5, currency: 'USD', multiplier: '' }
  };
  const m2 = {
    id: uid(), name: 'claude-3.5-sonnet', stationId: st.id,
    prices: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75, currency: 'USD', multiplier: '' }
  };
  const m3 = {
    id: uid(), name: '本地-qwen', stationId: '',
    prices: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 1, currency: 'CNY', multiplier: '0.8' }
  };
  state.stations.push(st);
  state.models.push(m1, m2, m3);
  state.usages.unshift({
    id: uid(), modelId: m1.id, date: now().slice(0, 10),
    counts: { input: 2000000, output: 800000, cacheRead: 0, cacheWrite: 0 },
    cost: 22, currency: 'USD', note: '示例对话'
  });
  save();
  render();
  toast('已导入示例数据');
}

function exportBackup() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-relay-prices-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('备份已导出');
}

function importBackupFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      state = restoreState(state, data, 'merge');
      applyTheme();
      save();
      render();
      toast('备份已合并导入');
    } catch (err) {
      toast('导入失败：' + (err && err.message ? err.message : err));
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (globalThis.confirm && !globalThis.confirm('确定清空所有数据？此操作不可撤销。')) return;
  state = emptyState();
  applyTheme();
  save();
  render();
  toast('已清空全部数据');
}

function handleAction(action, id) {
  switch (action) {
    case 'toggle-theme': toggleTheme(); break;
    case 'add-model': modelEditor(); break;
    case 'edit-model': modelEditor(state.models.find(m => m.id === id)); break;
    case 'delete-model': deleteModel(id); break;
    case 'add-usage': usageEditor(); break;
    case 'edit-usage': usageEditor(state.usages.find(u => u.id === id)); break;
    case 'delete-usage': deleteUsage(id); break;
    case 'seed': seedSample(); break;
    case 'export': exportBackup(); break;
    case 'clear': clearAll(); break;
    case 'calc': doCalc(); break;
    case 'save-usage-from-calc': saveCalcUsage(); break;
    default: break;
  }
}

function onClick(e) {
  const t = e.target;
  const actionEl = t.closest ? t.closest('[data-action]') : null;
  if (actionEl) {
    e.preventDefault();
    handleAction(actionEl.dataset.action, actionEl.dataset.id);
    return;
  }
  const navEl = t.closest ? t.closest('.nav-item') : null;
  if (navEl) navigate(navEl.dataset.view);
}

function onChange(e) {
  const t = e.target;
  if (t.name === 'metric') { rankingMetric = t.value; render(); }
  else if (t.name === 'direction') { rankingDir = t.value; render(); }
  else if (t.name === 'backup') { importBackupFile(t); }
}

function init() {
  applyTheme();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  navigate('home');
}

if (typeof document !== 'undefined') {
  init();
}

export const _internal = {
  navigate,
  render,
  getState: () => state,
  views: Object.keys(views)
};

