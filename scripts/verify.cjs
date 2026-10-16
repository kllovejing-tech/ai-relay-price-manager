const fs = require('fs');
const path = require('path');
const required = ['index.html', 'styles.css', 'app.js', 'README.md'];
const missing = required.filter((file) => !fs.existsSync(path.join(__dirname, '..', file)));
if (missing.length) { console.error('缺少文件: ' + missing.join(', ')); process.exit(1); }
console.log('Web 项目文件检查通过');
