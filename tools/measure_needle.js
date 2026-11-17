/* 바늘 에셋 측정: node tools/measure_needle.js — 크기 · 투명 여부 · 바늘 끝(가장 아래 점)·머리(가장 위 점) 좌표 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html');
  const out = await p.evaluate(async () => {
    const im = new Image(); im.src = 'assets/Needle.png'; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, tipx = 0, topx = 0, transparent = 0;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = (y * W + xx) * 4;
      if (d[i + 3] < 250) transparent++;
      const solid = d[i + 3] > 40 && (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235);
      if (solid) { if (xx < minx) minx = xx; if (xx > maxx) maxx = xx; if (y < miny) { miny = y; topx = xx; } if (y > maxy) { maxy = y; tipx = xx; } }
    }
    return { w: W, h: H, corner: [d[0], d[1], d[2], d[3]], transparentPx: transparent, bbox: [minx, miny, maxx, maxy], tip: [tipx, maxy], top: [topx, miny] };
  });
  console.log(JSON.stringify(out));
  await b.close();
})();
