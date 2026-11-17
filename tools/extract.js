/* 사진 에셋에서 음각 윤곽 경로 추출: node tools/extract.js
 * 흐름: 회색조 → (큰 블러 − 작은 블러)로 홈(주변보다 어두운 가는 선) 강조 → 임계값 이진화 → 도형 안쪽 시드에서 채우기(새지 않는 가장 높은 임계값 선택)
 *       → 영역을 홈 반폭만큼 바깥으로 팽창 → 경계 추적 → 단순화 → src/game/paths.js(이미지 px 좌표) 저장 + 검수용 오버레이 screenshot/path_*.png */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
const SEEDS = { circle: [300, 300], triangle: [300, 300], star: [298, 285], umbrella: [300, 215] };
const GROW = +(process.env.GROW || 3);

(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 640, height: 640 } });
  await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html');
  const out = await p.evaluate(async ({ SEEDS, GROW }) => {
    function box(src, W, H, r) {                                   // 분리형 박스 블러
      const tmp = new Float32Array(W * H), dst = new Float32Array(W * H), n = 2 * r + 1;
      for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / n; s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
      for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
      return dst;
    }
    function dilate(m, W, H, r) { let cur = m; for (let k = 0; k < r; k++) { const nx = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (cur[i] || cur[i - 1] || cur[i + 1] || cur[i - W] || cur[i + W]) nx[i] = 1; } cur = nx; } return cur; }
    function fill(groove, W, H, sx, sy, maxArea) {                 // 4방향 채우기, 넘치면 null
      const reg = new Uint8Array(W * H), st = [sy * W + sx]; let area = 0; reg[st[0]] = 1;
      while (st.length) { const i = st.pop(); area++; if (area > maxArea) return null; const x = i % W, y = (i / W) | 0; for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= W * H || reg[j] || groove[j]) continue; const jx = j % W; if (Math.abs(jx - x) > 1) continue; reg[j] = 1; st.push(j); } }
      return { reg, area };
    }
    function trace(reg, W, H) {                                    // Moore 경계 추적
      let sx = -1, sy = -1; outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (reg[y * W + x]) { sx = x; sy = y; break outer; }
      const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], pts = [[sx, sy]];
      let cx = sx, cy = sy, d = 6, guard = 0;
      do {
        let found = false;
        for (let k = 0; k < 8; k++) { const nd = (d + 6 + k) % 8, nx = cx + dirs[nd][0], ny = cy + dirs[nd][1]; if (nx >= 0 && ny >= 0 && nx < W && ny < H && reg[ny * W + nx]) { cx = nx; cy = ny; d = nd; pts.push([cx, cy]); found = true; break; } }
        if (!found) break;
      } while (!(cx === sx && cy === sy) && guard++ < 100000);
      return pts;
    }
    const res = {};
    for (const id of Object.keys(SEEDS)) {
      const img = new Image(); img.src = 'assets/' + id + '.jpg'; await img.decode();
      const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      const small = box(g, W, H, 1), large = box(g, W, H, 9), dog = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) dog[i] = large[i] - small[i];
      let best = null;
      for (let T = 1.5; T <= 14; T += 0.5) {                        // 낮은 임계값(홈이 두껍고 안 끊김)부터 올려 가며, 새지 않는 가장 높은 값
        const groove = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) groove[i] = dog[i] > T ? 1 : 0;
        const gd = dilate(groove, W, H, 1), f = fill(gd, W, H, SEEDS[id][0], SEEDS[id][1], 90000);
        if (f && f.area > 2500) best = { T, f };
      }
      if (!best) { res[id] = { error: 'no closed region' }; continue; }
      let reg = best.f.reg; reg = dilate(reg, W, H, GROW);
      const pts = trace(reg, W, H);
      // 단순화: 일정 간격 + 이동평균으로 계단 제거
      const N = pts.length, step = 3, sm = [];
      for (let i = 0; i < N; i += step) { let sx = 0, sy = 0, cnt = 0; for (let k = -4; k <= 4; k++) { const q = pts[(i + k + N) % N]; sx += q[0]; sy += q[1]; cnt++; } sm.push([sx / cnt, sy / cnt]); }
      // 검수용 오버레이
      const ov = document.createElement('canvas'); ov.width = W; ov.height = H; const o = ov.getContext('2d'); o.drawImage(img, 0, 0);
      o.strokeStyle = '#ff00cc'; o.lineWidth = 1.5; o.beginPath(); sm.forEach((q, i) => i ? o.lineTo(q[0], q[1]) : o.moveTo(q[0], q[1])); o.closePath(); o.stroke();
      res[id] = { T: best.T, area: best.f.area, n: sm.length, pts: sm.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]), overlay: ov.toDataURL('image/png') };
    }
    return res;
  }, { SEEDS, GROW });
  const lines = [];
  for (const id of Object.keys(out)) {
    const r = out[id]; if (r.error) { console.log(id, r.error); continue; }
    console.log(id, 'T=' + r.T, 'area=' + r.area, 'pts=' + r.n);
    fs.writeFileSync(path.join(ROOT, 'screenshot', 'path_' + id + '.png'), Buffer.from(r.overlay.split(',')[1], 'base64'));
    lines.push('    ' + id + ': ' + JSON.stringify(r.pts));
  }
  fs.writeFileSync(path.join(ROOT, 'src', 'game', 'paths.js'), '/* 사진 에셋(assets/*.jpg, 600×600) 위 음각 윤곽 경로 — tools/extract.js 가 생성. 이미지 px 좌표, 닫힌 다각선. 직접 고치지 말고 재생성하거나 수정본을 이 파일에 덮어쓴다. */\n(function () {\n  window.DG = window.DG || {};\n  DG.PATHS = {\n' + lines.join(',\n') + '\n  };\n})();\n');
  await b.close();
})();
