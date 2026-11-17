/* 링크 미리보기 이미지(assets/og.jpg, 1200×630): 메인 화면의 사진(스테인리스 + 달고나 + 오른쪽 바늘)을 그대로 렌더 — node tools/make-og.js */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html'); await p.waitForFunction(() => document.documentElement.classList.contains('assets-ready'));
  const url = await p.evaluate(() => { const c = document.createElement('canvas'); c._fixed = true; c.width = 1200; c.height = 630; DG.view.previewDisc(c, 'circle', 0, true); return c.toDataURL('image/jpeg', 0.9); });
  fs.writeFileSync(path.join(ROOT, 'assets', 'og.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
