# AI 中转站价格管理

一个离线运行的 AI 中转站价格管理工具，用于记录多个中转站的模型价格、比较不同币种的报价，并估算和保存使用费用。项目使用原生 HTML、CSS 和 JavaScript 构建，不需要后端服务；业务数据保存在当前浏览器的 `localStorage` 中，不会自动上传到服务器。

## 主要功能

- 中转站管理，以及模型与中转站的关联。
- 记录输入、输出、缓存读取和缓存写入单价，支持 USD、CNY 和倍率。
- 价格排行：按币种分组，并按输入、输出或缓存价格排序。
- 费用计算：按 token 用量估算费用，并可保存为使用记录。
- 使用记录：查看、编辑和删除已保存的费用记录。
- 数据备份：导出 JSON 备份，支持校验后合并导入或恢复。
- 浅色和深色主题切换。

## 数据存储与隐私

数据只保存在浏览器本地存储，键名为 `ai-relay-price-manager:v1`。项目不包含后端接口，也不会自动上传模型价格、使用记录或备份内容。请在“设置”中定期导出备份；清空数据的操作不可撤销。

## 项目结构

```text
index.html                          网页入口、导航和应用容器
app.js                              页面渲染与交互逻辑
core.js                             价格计算、排序、备份校验与恢复
styles.css                          页面样式、主题和移动端布局
capacitor.config.json               Capacitor 应用配置
package.json                        本地脚本和 Capacitor 依赖
scripts/verify.cjs                  Web 文件完整性检查
tests/app.test.js                   应用视图渲染测试
tests/core.test.js                  核心逻辑测试
.github/workflows/ci.yml            推送和 Pull Request 的测试工作流
.github/workflows/build-android.yml Android APK 构建工作流
```

`android/` 和 `www/` 不提交到仓库。Android 工作流会先复制 Web 资源生成 `www/`，再通过 Capacitor 生成 `android/` 并同步资源；这两个目录属于构建过程中的生成目录，已加入 `.gitignore`。

## 本地运行

最简单的方式是直接用浏览器打开 `index.html`。

如果已安装 Node.js 和 npm，也可以使用项目脚本启动静态预览：

```bash
npm install
npm run dev
```

`npm run dev` 使用 `npx serve .` 提供静态文件服务。启动后按命令行输出的地址访问，通常是 `http://localhost:3000`。本地预览不需要 Android SDK。

## 测试与文件校验

```bash
npm test
npm run build:web
```

`npm test` 运行 Node.js 测试，覆盖核心计算、排序、备份校验和主要视图渲染；`npm run build:web` 检查必要的 Web 文件是否存在。测试不需要浏览器或 Android SDK。

## 构建 Android APK

Android 构建由 GitHub Actions 执行，不依赖本机的 Android 工程、JDK 或 SDK。工作流会在 `main` 或 `master` 分支推送时运行，也可以在 GitHub Actions 页面手动执行 `Build Android APK`。

构建流程会：

1. 安装 Node.js 依赖。
2. 生成 `www/` Web 资源目录。
3. 用 Capacitor 生成并同步 `android/` 工程。
4. 配置 Android SDK，构建未签名的 Debug APK。
5. 将 APK 上传为名为 `app-debug-apk` 的 Actions Artifact。

下载构建产物：

1. 打开当前 GitHub 仓库的 **Actions** 页面。
2. 进入 `Build Android APK` 工作流并选择一次成功的运行记录。
3. 在运行记录底部的 **Artifacts** 区域下载 `app-debug-apk` 压缩包。
4. 解压后即可取得 `app-debug.apk`，安装前请确认设备允许安装对应来源的应用。

当前工作流上传的是 Debug APK，不等同于正式签名版本。正式版本未来计划通过 GitHub Releases 发布；目前尚未创建正式 Release，也没有固定的发布下载地址。

## 许可证

本项目采用 [MIT License](LICENSE)。完整许可证文本见根目录的 [`LICENSE`](LICENSE) 文件。
