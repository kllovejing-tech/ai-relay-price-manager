import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, priceKeys, uid, now, estimate, sortQuotes,
  validateBackup, restoreState, csv
} from '../core.js';

test('emptyState 返回完整结构', () => {
  const s = emptyState();
  assert.deepEqual(Object.keys(s).sort(),
    ['models', 'priceHistory', 'settings', 'stations', 'usages'].sort());
  assert.deepEqual(s.settings, { theme: 'light' });
});

test('estimate 正常计算不含倍率', () => {
  const prices = { input: 5, output: 15, cacheRead: 2, cacheWrite: 7, currency: 'USD', multiplier: '' };
  const r = estimate(prices, { input: 1_000_000, output: 1_000_000 });
  assert.equal(r.ok, true);
  assert.equal(r.items.input, 5);
  assert.equal(r.items.output, 15);
  assert.equal(r.total, 20);
  assert.equal(r.currency, 'USD');
});

test('estimate 支持倍率', () => {
  const r = estimate({ input: 10, output: 10, currency: 'CNY', multiplier: '0.8' }, { input: 1_000_000 });
  assert.equal(r.ok, true);
  assert.equal(r.items.input, 8);
  assert.equal(r.multiplier, 0.8);
});

test('estimate 缺少价格返回 ok=false 并列出缺失项', () => {
  const r = estimate({ input: 5, output: '', currency: 'USD' }, { input: 1, output: 1000 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['output']);
});

test('estimate 倍率无效报错', () => {
  const r = estimate({ input: 5, output: 5, currency: 'USD', multiplier: '0' }, { input: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes('倍率无效'));
});

test('sortQuotes 按币种分组并按指标升序', () => {
  const models = [
    { id: 'a', name: 'A', prices: { input: 3, output: 9, currency: 'USD' } },
    { id: 'b', name: 'B', prices: { input: 1, output: 9, currency: 'USD' } },
    { id: 'c', name: 'C', prices: { input: 2, output: 9, currency: 'CNY' } }
  ];
  const rows = sortQuotes(models, 'input', 'asc');
  const headers = rows.filter(r => r.header).map(r => r.currency);
  assert.deepEqual(headers, ['CNY', 'USD']);
  const usd = rows.filter(r => !r.header && r.prices.currency === 'USD').map(r => r.name);
  assert.deepEqual(usd, ['B', 'A']);
});

test('validateBackup 拒绝结构不完整的备份', () => {
  assert.throws(() => validateBackup({ stations: [] }), /备份结构不完整/);
  assert.throws(() => validateBackup({ stations: [{}], models: [], usages: [], priceHistory: [] }), /中转站数据格式错误/);
});

test('validateBackup 补全默认设置', () => {
  const r = validateBackup({ stations: [{ id: 's', name: 'S' }], models: [], usages: [], priceHistory: [] });
  assert.equal(r.settings.theme, 'light');
});

test('restoreState 合并模式按 id 覆盖', () => {
  const cur = { stations: [{ id: 's', name: 'old' }], models: [], usages: [], priceHistory: [], settings: { theme: 'light' } };
  const imp = { stations: [{ id: 's', name: 'new' }], models: [{ id: 'm', name: 'M', prices: {} }], usages: [], priceHistory: [], settings: { theme: 'dark' } };
  const r = restoreState(cur, imp, 'merge');
  assert.equal(r.stations[0].name, 'new');
  assert.equal(r.models.length, 1);
  assert.equal(r.settings.theme, 'dark');
});

test('restoreState 替换模式返回导入副本', () => {
  const cur = emptyState();
  const imp = { stations: [{ id: 's', name: 'S' }], models: [], usages: [], priceHistory: [], settings: {} };
  const r = restoreState(cur, imp, 'replace');
  assert.equal(r.stations.length, 1);
  assert.equal(r.settings.theme, 'light');
});

test('csv 转义逗号与引号', () => {
  const out = csv([['a,b', 'x"y'], ['plain']]);
  assert.equal(out, '"a,b","x""y"\r\nplain');
});

test('uid 与 now 返回字符串', () => {
  assert.equal(typeof uid(), 'string');
  assert.ok(now().includes('T'));
});

test('priceKeys 固定四项', () => {
  assert.deepEqual(priceKeys, ['input', 'output', 'cacheRead', 'cacheWrite']);
});

