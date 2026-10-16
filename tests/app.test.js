import test from 'node:test';
import assert from 'node:assert/strict';

// 最小 DOM/localStorage 桩，使 app.js 可在 Node 中动态导入并真正渲染视图（无需浏览器/网络）。
function installStubs() {
  const els = {};
  function el() {
    return { innerHTML: '', textContent: '', className: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {}, remove() {}, addEventListener() {}, click() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, showModal() {}, close() {}, files: [] };
  }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = {
    documentElement: { dataset: {} },
    getElementById(id) { return (els[id] ||= el()); },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return el(); },
    body: { appendChild() {}, }
  };
  globalThis.URL = globalThis.URL || { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  globalThis.Blob = globalThis.Blob || class { constructor() {} };
  return els;
}

let app, els;

test.before(async () => {
  els = installStubs();
  app = await import('../app.js?t=' + Date.now());
});

test('app.js 可被导入且暴露视图 API', () => {
  assert.ok(app._internal && typeof app._internal.navigate === 'function');
  assert.deepEqual(app._internal.views.sort(), ['calculator', 'home', 'ranking', 'settings', 'usage']);
});

test('首页视图渲染概览与新增入口', () => {
  app._internal.navigate('home');
  const html = els['view'].innerHTML;
  assert.ok(html.includes('概览'), '应渲染概览标题');
  assert.ok(html.includes('新增模型'), '应渲染新增模型按钮');
});

test('价格排行视图渲染标题', () => {
  app._internal.navigate('ranking');
  assert.ok(els['view'].innerHTML.includes('价格排行'));
});

test('费用计算视图含表单', () => {
  app._internal.navigate('calculator');
  assert.ok(els['view'].innerHTML.includes('费用计算'));
  assert.ok(els['view'].innerHTML.includes('calc-form'));
});

test('使用记录视图渲染', () => {
  app._internal.navigate('usage');
  assert.ok(els['view'].innerHTML.includes('使用记录'));
});

test('设置视图渲染', () => {
  app._internal.navigate('settings');
  assert.ok(els['view'].innerHTML.includes('设置'));
});

test('初始状态为空', () => {
  const s = app._internal.getState();
  assert.equal(s.stations.length, 0);
  assert.equal(s.models.length, 0);
  assert.equal(s.usages.length, 0);
});
