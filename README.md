# AI 中转站价格管理

离线个人工具，用于记录多个 AI 中转站的模型价格、按币种做价格排行，并估算/记录使用费用。纯前端（HTML + CSS + 原生 ES Module），数据保存在浏览器 localStorage，无需服务器、不上传任何数据。

## 功能

- 中转站与模型价格管理（输入/输出/缓存读取/缓存写入单价，支持 USD/CNY 与倍率）
- 价格排行：按币种分组，按任一价格维度升序/降序
- 费用计算：输入 token 用量实时估算费用，并可一键保存为使用记录
- 使用记录：手动记录或来自计算器，支持编辑/删除
- 备份：导出/合并导入 JSON，含数据校验与恢复
- 浅色/深色主题切换

## 目录结构

```
index.html            入口页面与导航
styles.css            样式（含明暗主题）
core.js               纯逻辑：估算、排序、备份校验/恢复、CSV
app.js                视图渲染与交互（ES Module，依赖 core.js）
scripts/verify.cjs    构建/校验脚本（检查必要文件存在）
tests/*.test.js       node --test 单元测试（无需浏览器/网络）
.github/workflows/ci.yml   推送/PR 时运行测试与校验
capacitor.config.json     Capacitor 打包配置
```

## 本地运行

直接用浏览器打开 `index.html` 即可。若要使用本地静态服务器：

```bash
npm run dev        # 使用 npx serve 启动本地站点
```

## 测试

```bash
npm test           # node --test tests/*.test.js，离线运行
npm run build:web  # 检查 index.html/styles.css/app.js/README.md 是否齐全
```

测试分为两部分：

- `tests/core.test.js`：直接验证 `core.js` 的纯函数（估算、排序、备份校验/恢复、CSV）。
- `tests/app.test.js`：用最小 DOM/localStorage 桩动态导入 `app.js`，验证五个视图都能真实渲染。

## 数据说明

所有数据仅保存在当前浏览器的 localStorage（键名 `ai-relay-price-manager:v1`）。请通过“设置 → 导出备份”定期备份；清空操作不可撤销。

## 移动端打包（可选）

项目已附带 `capacitor.config.json`，可配合 `@capacitor/android` 打包为 Android 应用（需另行安装 Android 开发环境）。
