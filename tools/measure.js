/* 사진 에셋 측정: node tools/measure.js — 원판 중심·반지름(흰 배경 제외 영역), 홈(윤곽) 강조 이미지를 screenshot/ 에 저장 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html');
  const out = await p.evaluate(async () => {
    const res = {};
    for (const id of ['circle', 'triangle', 'star', 'umbrella']) {
      const img = new Image(); img.src = 'assets/' + id + '.jpg'; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (d.data[k] < 225 || d.data[k + 1] < 225 || d.data[k + 2] < 225) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
      res[id] = { w: W, h: H, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
