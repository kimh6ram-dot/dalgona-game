/* 관중 실루엣 에셋 → 흰 배경 제거한 투명 PNG (assets/crowd_*.png)
 *   node tools/cutout.js
 * - 명도 → 알파(검정 실루엣 + 알파): 흰 배경·가장자리 흰 잔상 없음, 회색 실루엣은 반투명 검정으로 회색 유지, 옅은 워터마크는 문턱값으로 제거
 * - 사람 머리 폭을 기준으로 배율 통일(점수가 낮아도 사람 크기는 같다), 여백 제거, 가로 640(=결과 영역 320css @2x)에 하단 맞춤·중앙 정렬(넘치면 양옆 크롭)
 * 원본(점수별 jpg/png)은 그대로 두고 결과물만 새로 쓴다. */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
const OUT_W = 640, HEAD = 26;                       // 출력 폭 / 머리 폭 목표(@2x px)
const SRC = [                                       // head: 원본에서 사람 머리 폭(px) 실측값, hi: 이 명도 이상은 투명(워터마크 제거)
  { id: '90', file: '90점 이상.jpg', head: 52, hi: 225, lo: 60 },
  { id: '75', file: '75점 이상.jpg', head: 50, hi: 200, lo: 70 },
  { id: '50', file: '50점 이상.png', head: 76, hi: 215, lo: 70 },
  { id: '00', file: '50점 이하.png', head: 112, hi: 215, lo: 70 }
];
(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html');
  for (const s of SRC) {
    const url = await p.evaluate(async ({ s, OUT_W, HEAD }) => {
      const im = new Image(); im.src = 'assets/' + s.file; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const id = x.getImageData(0, 0, c.width, c.height), d = id.data, W = c.width, H = c.height;
      let minx = W, maxx = -1, miny = H, maxy = -1;
      for (let i = 0; i < W * H; i++) {
        const L = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
        let a = (s.hi - L) / (s.hi - s.lo); a = a < 0 ? 0 : a > 1 ? 1 : a;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = Math.round(a * 255);
        if (a > 0.3) { const px = i % W, py = (i / W) | 0; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py; }
      }
      x.putImageData(id, 0, 0);
      const k0 = HEAD / s.head, cw = maxx - minx + 1, ch = maxy - miny + 1, k = s.id === '00' ? k0 : Math.max(k0, OUT_W / cw), tw = Math.round(cw * k), th = Math.round(ch * k);
      const o = document.createElement('canvas'); o.width = OUT_W; o.height = th;
      const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
      const dx = Math.round((OUT_W - tw) / 2);                              // 중앙 정렬(넘치면 양옆이 잘린다)
      ox.drawImage(c, minx, miny, cw, ch, dx, 0, tw, th);
      return { url: o.toDataURL('image/png'), w: OUT_W, h: th, content: [cw, ch], k, trimmed: tw > OUT_W };
    }, { s, OUT_W, HEAD });
    fs.writeFileSync(path.join(ROOT, 'assets', 'crowd_' + s.id + '.png'), Buffer.from(url.url.split(',')[1], 'base64'));
    console.log(s.id, url.w + 'x' + url.h, 'k=' + url.k.toFixed(3), url.trimmed ? '(가로 크롭)' : '');
  }
  await b.close();
})();
