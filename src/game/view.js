/* 렌더링 — 판정(engine.js)과 분리. 상태(g)를 읽어 그리기만 한다.
 * 스타일: 2000년대 초중반 캐주얼 3D 느낌의 평면 로우폴리(면 단위 단색 음영 · 무광 · 나무 도마). 거의 정면 탑뷰. */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var C = DG.C, W = C.W, CX = C.CX, CY = C.CY, R = C.DISC_R, PI = Math.PI;
  var VIS = null;                                                          // 지금 그리는 캔버스에 보이는 논리 좌표 범위(가로로 넓은 캔버스에서 배경을 양옆으로 이어 그린다)
  var S = 1, boardCache = null, baseCache = {}, anim = null, dust = [], fx = null;

  function initScale() { S = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); boardCache = null; baseCache = {}; }
  function resetBase() { baseCache = {}; boardCache = null; }
  function mk() { var c = document.createElement('canvas'); c.width = W * S; c.height = W * S; var x = c.getContext('2d'); x.scale(S, S); return { c: c, x: x }; }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lerp(a, b, t) { var A = hex(a), B = hex(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }

  // ---------- 도마(나무 작업대): 가로 널빤지 5장, 면 단위 단색 ----------
  function drawBoardWide(x) {                                              // 배경을 보이는 범위 전체에 cover 로(늘이지 않는다). 정사각이면 예전과 완전히 같다
    var v = VIS || { x0: 0, y0: 0, x1: W, y1: W }, s = Math.max(v.x1 - v.x0, v.y1 - v.y0), cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    x.drawImage(board(), cx - s / 2, cy - s / 2, s, s);
  }
  function board() {
    if (boardCache) return boardCache;
    var b = mk(), x = b.x, r = rng(11), i, ph = W / 5;
    if (DG.IMG && DG.IMG.bg) { x.drawImage(DG.IMG.bg, 0, 0, W, W); return (boardCache = b.c); }   // 배경 에셋(assets/bg.png). 없으면 아래 나무 도마
    var tones = ['#B98A55', '#B0814D', '#BD8F5B', '#AC7D4A', '#B68752'];
    for (i = 0; i < 5; i++) {
      x.fillStyle = tones[i]; x.fillRect(0, i * ph, W, ph);
      x.fillStyle = 'rgba(0,0,0,0.14)'; x.fillRect(0, i * ph, W, 3);
      for (var k = 0; k < 6; k++) { x.fillStyle = 'rgba(80,45,15,0.10)'; x.fillRect(r() * W, i * ph + 10 + r() * (ph - 20), 60 + r() * 140, 2); }
      if (i === 1 || i === 3) { x.fillStyle = 'rgba(80,45,15,0.18)'; x.beginPath(); x.ellipse(60 + r() * 480, i * ph + ph / 2, 14, 8, 0, 0, PI * 2); x.fill(); }
    }
    x.fillStyle = 'rgba(0,0,0,0.20)'; x.fillRect(0, W - 6, W, 6);
    return (boardCache = b.c);
  }

  // ---------- 달고나 본체(모양별 1회 생성): 36각 면 + 테두리 + 기포 + 음각 도형 ----------
  function polyPath(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); }
  function shapePath(x, sh) { x.beginPath(); x.moveTo(sh.px[0], sh.py[0]); for (var i = 1; i < sh.n; i++) x.lineTo(sh.px[i], sh.py[i]); x.closePath(); }
  var DISC_N = 36;
  function discPoly(r) { var o = []; for (var i = 0; i < DISC_N; i++) { var a = i / DISC_N * PI * 2; o.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]); } return o; }

  function shapePts(sh) { var o = []; for (var i = 0; i < sh.n; i++) o.push([sh.px[i], sh.py[i]]); return o; }
  // 빈 달고나(assets/empty.png): 투명 배경 에셋의 원판을 논리 좌표의 원판(중심 CX,CY · 반지름 R)에 맞춰 그대로 쓴다
  function blank() {
    if (baseCache._blank) return baseCache._blank;
    var b = mk(), x = b.x, E = C.EMPTY, im = DG.IMG && DG.IMG.empty, k = R / E.r;
    x.save(); x.beginPath(); x.arc(CX, CY, R, 0, PI * 2); x.clip();
    if (im) { for (var pass = 0; pass < 2; pass++) x.drawImage(im, CX - E.cx * k, CY - E.cy * k, im.width * k, im.height * k); }   // 에셋 알파가 253 정도라 한 번 더 겹쳐 완전 불투명으로(색은 그대로)
    else { x.fillStyle = '#E4A93C'; x.fillRect(0, 0, W, W); }              // 에셋이 없을 때만(로딩 실패) 단색 대체
    x.restore();
    return (baseCache._blank = b.c);
  }
  // 눌러 찍은 홈: 안쪽 살짝 눌림 + 바깥 번짐 + 아래·오른쪽 밝은 모서리 + 위·왼쪽 그림자 + 홈 중심선(기존 사진 에셋의 음각과 같은 결)
  function engrave(x, pts, closed) {
    function path() { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); if (closed) x.closePath(); }
    x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
    if (pts.length === 1) { x.fillStyle = 'rgba(150,88,14,0.85)'; x.beginPath(); x.arc(pts[0][0], pts[0][1], 1.6, 0, PI * 2); x.fill(); x.restore(); return; }
    if (closed) { path(); x.fillStyle = 'rgba(255,236,170,0.07)'; x.fill(); }
    path(); x.strokeStyle = 'rgba(120,66,6,0.14)'; x.lineWidth = 9; x.stroke();
    x.save(); x.translate(1.6, 1.8); path(); x.strokeStyle = 'rgba(255,243,200,0.78)'; x.lineWidth = 3.2; x.stroke(); x.restore();
    x.save(); x.translate(-1.2, -1.4); path(); x.strokeStyle = 'rgba(138,78,10,0.55)'; x.lineWidth = 3; x.stroke(); x.restore();
    path(); x.strokeStyle = 'rgba(150,88,14,0.88)'; x.lineWidth = 2.2; x.stroke();
    x.restore();
  }
  function discShadow(x) { polyPath(x, discPoly(R).map(function (p) { return [p[0] + 7, p[1] + 11]; })); x.fillStyle = 'rgba(0,0,0,0.30)'; x.fill(); }
  function base(id) {
    if (baseCache[id]) return baseCache[id];
    var sh = DG.SHAPES[id], b = mk(), x = b.x, i, LIGHT = -2.4, r = rng(id.length * 97 + sh.n);
    if (id === 'custom' && DG.IMG && DG.IMG.empty) {                       // 직접 그린 도안: 빈 달고나 에셋 위에 도안을 눌러 찍은 홈으로 새긴다
      x.drawImage(blank(), 0, 0, W, W); engrave(x, shapePts(sh), true);
      return (baseCache[id] = b.c);
    }
    var photo = DG.IMG && DG.IMG[id];
    if (photo) {                                                           // 사진 에셋: 원판을 원형으로 잘라 그대로 쓴다(흰 배경 제거). 홈 가이드만 아주 옅게 보강
      x.save(); x.beginPath(); x.arc(CX, CY, R, 0, PI * 2); x.clip();
      x.drawImage(photo, CX - C.IMG_CX * C.IMG_K, CY - C.IMG_CY * C.IMG_K, photo.width * C.IMG_K, photo.height * C.IMG_K); x.restore();
      x.lineJoin = 'round'; shapePath(x, sh); x.strokeStyle = 'rgba(90,45,0,0.28)'; x.lineWidth = 2; x.stroke();
      return (baseCache[id] = b.c);
    }
    var Ro = R, Ri = R - 17;
    for (i = 0; i < DISC_N; i++) {                                         // 테두리(두꺼운 가장자리) 면
      var a0 = i / DISC_N * PI * 2, a1 = (i + 1) / DISC_N * PI * 2, am = (a0 + a1) / 2, lt = 0.5 + 0.5 * Math.cos(am - LIGHT);
      x.fillStyle = x.strokeStyle = lerp('#9C6A22', '#D7A24C', lt); x.lineWidth = 1;
      x.beginPath(); x.moveTo(CX + Ro * Math.cos(a0), CY + Ro * Math.sin(a0)); x.lineTo(CX + Ro * Math.cos(a1), CY + Ro * Math.sin(a1));
      x.lineTo(CX + Ri * Math.cos(a1), CY + Ri * Math.sin(a1)); x.lineTo(CX + Ri * Math.cos(a0), CY + Ri * Math.sin(a0)); x.closePath(); x.fill(); x.stroke();
    }
    for (i = 0; i < DISC_N; i++) {                                         // 윗면: 중심에서 퍼지는 삼각 면(아주 약한 명암)
      var b0 = i / DISC_N * PI * 2, b1 = (i + 1) / DISC_N * PI * 2, bm = (b0 + b1) / 2, l2 = 0.5 + 0.5 * Math.cos(bm - LIGHT);
      x.fillStyle = x.strokeStyle = lerp('#C98F34', '#DBA84E', l2 * 0.8 + (i % 2) * 0.08);
      x.beginPath(); x.moveTo(CX, CY); x.lineTo(CX + Ri * Math.cos(b0), CY + Ri * Math.sin(b0)); x.lineTo(CX + Ri * Math.cos(b1), CY + Ri * Math.sin(b1)); x.closePath(); x.fill(); x.stroke();
    }
    var tmp = { n: sh.n, px: sh.px, py: sh.py }, placed = 0, tries = 0;     // 기포(경로 근처는 피한다: 조작 경로를 가리지 않음)
    while (placed < 18 && tries++ < 200) {
      var ang = r() * PI * 2, rr = Math.sqrt(r()) * (Ri - 24), bx = CX + rr * Math.cos(ang), by = CY + rr * Math.sin(ang), ok = true;
      for (var j = 0; j < tmp.n; j += 2) if (Math.hypot(tmp.px[j] - bx, tmp.py[j] - by) < 22) { ok = false; break; }
      if (!ok) continue;
      var br = 3 + r() * 6; placed++;
      x.fillStyle = 'rgba(120,70,12,0.16)'; x.beginPath(); x.ellipse(bx, by, br, br * 0.85, 0, 0, PI * 2); x.fill();
      x.fillStyle = 'rgba(255,230,160,0.22)'; x.beginPath(); x.ellipse(bx - br * 0.25, by - br * 0.25, br * 0.55, br * 0.45, 0, 0, PI * 2); x.fill();
    }
    shapePath(x, sh); x.fillStyle = 'rgba(110,62,8,0.10)'; x.fill();         // 도형 안쪽: 살짝 눌린 느낌
    x.lineJoin = 'round'; x.lineCap = 'round';
    shapePath(x, sh); x.strokeStyle = 'rgba(245,215,150,0.55)'; x.lineWidth = 6.5; x.save(); x.translate(1.2, 1.4); x.stroke(); x.restore();   // 홈 아랫면 하이라이트
    shapePath(x, sh); x.strokeStyle = '#7A4A12'; x.lineWidth = 5; x.stroke();                                                                       // 홈
    return (baseCache[id] = b.c);
  }

  // ---------- 플레이 중 누적 레이어: 긁힌 홈(gc) · 선 밖 긁힌 자국(tc) ----------
  function ensureLayers(g) {
    if (g._v) return g._v;
    var gc = mk(), tc = mk(); gc.x.lineCap = tc.x.lineCap = 'round'; gc.x.lineJoin = 'round';
    g._v = { gc: gc, tc: tc, lastCrackE: 0 };
    return g._v;
  }
  function flush(g) {                                                      // 엔진이 쌓은 새 긁힘/자국을 레이어에 반영
    var v = ensureLayers(g), n = g.n, i;
    if (g.fresh.length) {                                                  // 긁힌 홈: 연속 구간마다 한 줄로(밝은 베이지 + 얇은 홈 가장자리). 매번 처음부터 그려 겹겹이 쌓이지 않는다
      g.fresh.length = 0;
      var x = v.gc.x, st = -1; x.clearRect(0, 0, W, W);
      for (i = 0; i < n; i++) if (!g.marked[i]) { st = i; break; }
      var runs = [], cur = null;
      if (st < 0) runs.push(Array.apply(null, Array(n)).map(function (_, k) { return k; }).concat([0]));
      else for (i = 1; i <= n; i++) {
        var idx = (st + i) % n;
        if (g.marked[idx]) { if (!cur) { cur = []; runs.push(cur); } cur.push(idx); } else cur = null;
      }
      x.lineCap = 'round'; x.lineJoin = 'round';
      [[5.4, '#B58A48'], [3.2, '#F6E6BE']].forEach(function (pass) {
        x.lineWidth = pass[0]; x.strokeStyle = x.fillStyle = pass[1];
        runs.forEach(function (r) {
          if (r.length === 1) { x.beginPath(); x.arc(g.px[r[0]], g.py[r[0]], pass[0] / 2, 0, PI * 2); x.fill(); return; }
          x.beginPath(); x.moveTo(g.px[r[0]], g.py[r[0]]);
          for (var k = 1; k < r.length; k++) x.lineTo(g.px[r[k]], g.py[r[k]]);
          x.stroke();
        });
      });
    }
    if (g.trail.length) {                                                  // 선 밖 긁힌 자국: 가는 베이지 선(균열과 구분). 불투명이라 겹쳐도 짙어지지 않는다
      var t = v.tc.x; t.strokeStyle = '#E3C98F'; t.lineWidth = 1.4;
      for (i = 0; i < g.trail.length; i++) { var q = g.trail[i]; t.beginPath(); t.moveTo(q[0], q[1]); t.lineTo(q[2], q[3]); t.stroke(); }
      g.trail.length = 0;
    }
  }
  function drawCracks(x, g) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (var i = 0; i < g.seeds.length; i++) {
      var sd = g.seeds[i]; if (sd.e < 1.5) continue;
      for (var b = 0; b < sd.br.length; b++) {
        var br = sd.br[b], len = Math.min(95, (5 + sd.e * 2.4) * br.k), segs = Math.max(2, Math.ceil(len / 5)), px = sd.x, py = sd.y, ang = br.a, pts = [[px, py]], s;
        for (s = 1; s <= segs; s++) { ang += br.jit[s % 12] * 0.22; px += Math.cos(ang) * (len / segs); py += Math.sin(ang) * (len / segs); pts.push([px, py]); }
        var lines = [pts];
        if (segs >= 7) {                                                   // 중간에서 한 가닥 더 갈라진다
          var k = 3 + (br.jit[1] > 0 ? 1 : 0), f = [pts[k]], fa = ang + (br.jit[2] > 0 ? 0.65 : -0.65), fx = pts[k][0], fy = pts[k][1];
          for (s = 1; s <= Math.ceil(segs * 0.35); s++) { fa += br.jit[(s + 4) % 12] * 0.2; fx += Math.cos(fa) * (len / segs); fy += Math.sin(fa) * (len / segs); f.push([fx, fy]); }
          lines.push(f);
        }
        lines.forEach(function (ln, li) {
          x.beginPath(); x.moveTo(ln[0][0], ln[0][1]); for (var q = 1; q < ln.length; q++) x.lineTo(ln[q][0], ln[q][1]);
          x.strokeStyle = 'rgba(255,236,186,0.38)'; x.lineWidth = li ? 1.8 : 2.4; x.save(); x.translate(0.7, 0.7); x.stroke(); x.restore();
          x.strokeStyle = 'rgba(84,48,12,0.88)'; x.lineWidth = li ? 0.8 : 1.05; x.stroke();
        });
      }
    }
  }

  // ---------- 바늘 · 조준 링 ----------
  function drawNeedle(x, g, noRing) {
    var tx = g.tip.x, ty = g.tip.y, press = g.scratching ? 1 : 0, ex = tx + 50, ey = ty - 104 + press * 4, im = DG.IMG && DG.IMG.needle, N = C.NEEDLE;
    if (im) {                                                              // 바늘 에셋: 끝점이 바늘끝 좌표에 오도록, 머리가 오른쪽 위를 향하게 기울여 그린다
      var k = N.len / (N.tipY - N.topY);
      x.save(); x.translate(tx, ty); x.rotate(N.angle * PI / 180);
      x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 3; x.shadowOffsetX = press ? 2 : 5; x.shadowOffsetY = press ? 3 : 7;   // 누르면 달고나에 더 가까워진 느낌
      x.drawImage(im, -N.tipX * k * N.wScale, -N.tipY * k, im.width * k * N.wScale, im.height * k);
      x.restore();
    } else {
    x.save(); x.lineCap = 'round';
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 3; x.beginPath(); x.moveTo(tx + 3, ty + 4); x.lineTo(ex + 6 + 7, ey + 14 + 6); x.stroke();   // 바늘 그림자
    x.strokeStyle = '#2E3236'; x.lineWidth = 3.6; x.beginPath(); x.moveTo(tx, ty); x.lineTo(ex, ey); x.stroke();                                   // 바늘대
    x.strokeStyle = '#C9CED3'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(tx - 0.4, ty - 1); x.lineTo(ex - 0.6, ey - 1); x.stroke();                // 광택 면
    x.fillStyle = '#6B431D'; x.beginPath(); x.arc(ex, ey, 7, 0, PI * 2); x.fill();                                                                 // 머리
    x.fillStyle = '#8E5E2E'; x.beginPath(); x.arc(ex - 2, ey - 2, 3, 0, PI * 2); x.fill();
    x.restore();
    }
    if (noRing) return;
    var d = g.tipD, col;                                                                                                                              // 조준 링: 선 위=흰색, 근접=노랑, 이탈=빨강
    if (d <= C.ON) col = '#FFFFFF'; else if (d <= C.EXIT) col = '#FFD24A'; else col = g.scratching ? '#FF4A3A' : 'rgba(255,255,255,0.5)';
    x.lineWidth = g.scratching ? 2.4 : 1.6; x.strokeStyle = col; x.beginPath(); x.arc(tx, ty, C.ON, 0, PI * 2); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(tx, ty, 1.8, 0, PI * 2); x.fill();
  }

  function spawnDust(g) {
    if (!g.scratching || !g.moved || g.phase !== 'play') return;
    for (var i = 0; i < 2 && dust.length < 70; i++) {
      var on = g.tipD <= C.ON;
      dust.push({ x: g.tip.x, y: g.tip.y, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 50, life: 0.45 + Math.random() * 0.3, t: 0, c: on ? '#F8E3A8' : '#6B3F0C' });
    }
  }
  function stepDust(dt) { for (var i = dust.length - 1; i >= 0; i--) { var p = dust[i]; p.t += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) dust.splice(i, 1); } }
  function drawDust(x) { for (var i = 0; i < dust.length; i++) { var p = dust[i]; x.globalAlpha = Math.max(0, 1 - p.t / p.life); x.fillStyle = p.c; x.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); } x.globalAlpha = 1; }

  function drawDisc(x, g, shadow) {
    if (shadow !== false) discShadow(x);
    x.drawImage(base(g.id), 0, 0, W, W);
    var v = ensureLayers(g); flush(g);
    x.drawImage(v.gc.c, 0, 0, W, W); x.drawImage(v.tc.c, 0, 0, W, W);
    drawCracks(x, g);
  }

  // 한 프레임(플레이 중). x 는 이미 (canvas.width/W) 배율이 적용된 컨텍스트
  function renderPlay(x, g, dt) {
    drawBoardWide(x);
    drawDisc(x, g);
    if (dt) { spawnDust(g); stepDust(dt); }
    drawDust(x);
    drawNeedle(x, g);
  }

  // ---------- 분리 / 파손 연출 ----------
  // 얇고 바삭한 설탕판이 금이 가며 깨지는 모습: 응력이 모이는 곳(파손 지점 · 플레이 중 생긴 균열 · 도형 꼭짓점)에 작은 파편이 몰리고
  // 나머지는 큰 조각 몇 개. 경계는 규칙 없는 노이즈(거친 직선형/완만한 곡선형 혼합). 실금이 먼저 번지고 → 일부만 분리되고, 일부는 금만 간 채 제자리에 남는다.
  function pathPts(x, pts) { x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y); x.closePath(); }
  function polyArea(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return a / 2; }
  function polyCentroid(p) {
    var a = polyArea(p), cx = 0, cy = 0;
    if (Math.abs(a) < 1e-6) return { x: p[0].x, y: p[0].y };
    for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length], f = p[i].x * q.y - q.x * p[i].y; cx += (p[i].x + q.x) * f; cy += (p[i].y + q.y) * f; }
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }
  function hash3(a, b, c) { var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(key, x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash3(key, i, 1) * (1 - u) + hash3(key, i + 1, 1) * u) * 2 - 1; }
  function edgeStyle(key) {                                                // 경계마다 성격이 다르다: 거친 직선형 / 완만한 곡선형 / 중간
    var r = hash3(key, 9, 5);
    if (r < 0.36) return { amp: 3.2, bow: (hash3(key, 3, 3) - 0.5) * 3 };
    if (r < 0.70) return { amp: 1.5, bow: (hash3(key, 4, 4) - 0.5) * 22 };
    return { amp: 2.4, bow: (hash3(key, 5, 5) - 0.5) * 11 };
  }
  function edgeDisp(key, st, t, lo, hi) {
    var env = Math.min(1, Math.min(t - lo, hi - t) / 14), u = (t - lo) / ((hi - lo) || 1);
    var n = vnoise(key, t / 41) + 0.5 * vnoise(key + 101, t / 17) + 0.22 * vnoise(key + 202, t / 6.5);
    return env * st.amp * n * 1.4 + st.bow * Math.sin(PI * u);
  }
  function clipTag(poly, nx, ny, c, tag) {                                 // 반평면 n·p ≤ c 만 남긴다. 각 꼭짓점의 tag = 그 점에서 다음 점까지 변의 이웃 조각 번호(-1 = 원판 가장자리)
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n], da = nx * a.x + ny * a.y - c, db = nx * b.x + ny * b.y - c, t;
      if (da <= 0) {
        out.push(a);
        if (db > 0) { t = da / (da - db); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tag: tag }); }
      } else if (db < 0) { t = da / (da - db); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tag: a.tag }); }
    }
    return out;
  }
  function dedupe(p) { var o = []; for (var i = 0; i < p.length; i++) { var q = o[o.length - 1]; if (!q || Math.hypot(q.x - p[i].x, q.y - p[i].y) > 0.05) o.push(p[i]); } if (o.length > 1 && Math.hypot(o[0].x - o[o.length - 1].x, o[0].y - o[o.length - 1].y) < 0.05) o.pop(); return o; }
  function cellsOf(seeds) {                                                // 시드마다 보로노이 칸(볼록 다각형)
    var base = discPoly(R).map(function (p) { return { x: p[0], y: p[1], tag: -1 }; }), cells = [];
    for (var i = 0; i < seeds.length; i++) {
      var poly = base.map(function (p) { return { x: p.x, y: p.y, tag: p.tag }; });
      for (var j = 0; j < seeds.length && poly.length >= 3; j++) {
        if (j === i) continue;
        var dx = seeds[j].x - seeds[i].x, dy = seeds[j].y - seeds[i].y, l = Math.hypot(dx, dy), nx = dx / l, ny = dy / l;
        poly = clipTag(poly, nx, ny, nx * (seeds[i].x + seeds[j].x) / 2 + ny * (seeds[i].y + seeds[j].y) / 2, j);
      }
      cells.push(dedupe(poly));
    }
    return cells;
  }
  function roughen(poly, i, seeds) {                                       // 이웃과 맞닿은 변을 규칙 없이 울퉁불퉁하게 — 맞은편 조각도 같은 함수라 경계가 서로 맞는다
    var out = [], n = poly.length;
    for (var k = 0; k < n; k++) {
      var a = poly[k], b = poly[(k + 1) % n], j = a.tag; out.push(a);
      if (j < 0) continue;
      var lo = Math.min(i, j), hi = Math.max(i, j), key = lo * 64 + hi, nx = seeds[hi].x - seeds[lo].x, ny = seeds[hi].y - seeds[lo].y, l = Math.hypot(nx, ny);
      nx /= l; ny /= l;
      var dx = -ny, dy = nx, ta = a.x * dx + a.y * dy, tb = b.x * dx + b.y * dy, tlo = Math.min(ta, tb), thi = Math.max(ta, tb), st = edgeStyle(key), pts = [];
      for (var t = Math.ceil(tlo / 4) * 4; t < thi; t += 4) {
        if (t - tlo < 3 || thi - t < 3) continue;
        var u = (t - ta) / (tb - ta), d = edgeDisp(key, st, t, tlo, thi);
        pts.push({ x: a.x + (b.x - a.x) * u + nx * d, y: a.y + (b.y - a.y) * u + ny * d, tag: j });
      }
      if (tb < ta) pts.reverse();
      for (var m = 0; m < pts.length; m++) out.push(pts[m]);
    }
    return out;
  }
  function cornersOf(g) {                                                  // 윤곽에서 급하게 꺾이는 곳(별 끝·세모 모서리·우산 살 끝/손잡이 이음매) — 응력이 모인다
    var n = g.n, k = 6, found = [], pick = [];
    for (var i = 0; i < n; i += 2) {
      var p0 = (i - k + n) % n, p1 = (i + k) % n, a1 = Math.atan2(g.py[i] - g.py[p0], g.px[i] - g.px[p0]), a2 = Math.atan2(g.py[p1] - g.py[i], g.px[p1] - g.px[i]), d = Math.abs(a2 - a1);
      if (d > PI) d = 2 * PI - d;
      if (d > 0.85) found.push({ x: g.px[i], y: g.py[i], w: d });
    }
    found.sort(function (a, b) { return b.w - a.w; });
    found.forEach(function (c) { if (pick.length < 8 && pick.every(function (q) { return Math.hypot(q.x - c.x, q.y - c.y) > 40; })) pick.push(c); });
    return pick;
  }
  function insideShape(g, x, y) { var c = false; for (var i = 0, j = g.n - 1; i < g.n; j = i++) { if ((g.py[i] > y) !== (g.py[j] > y) && x < (g.px[j] - g.px[i]) * (y - g.py[i]) / (g.py[j] - g.py[i]) + g.px[i]) c = !c; } return c; }

  function planFracture(g, won, rand) {
    var stress = [], i, O;
    if (!won && g.failAt) stress.push({ x: g.failAt.x, y: g.failAt.y });
    g.seeds.slice().sort(function (a, b) { return b.e - a.e; }).forEach(function (s) { if (s.e >= 8 && stress.length < 4) stress.push({ x: s.x, y: s.y }); });   // 플레이 중 손상된 곳
    cornersOf(g).forEach(function (c) { if (stress.length < 8) stress.push({ x: c.x, y: c.y }); });
    if (!stress.length) for (i = 0; i < 3; i++) { var q = (rand() * g.n) | 0; stress.push({ x: g.px[q], y: g.py[q] }); }
    O = won && stress.length > 1 ? stress[(rand() * Math.min(3, stress.length)) | 0] : stress[0];
    var seeds = [], lim = R - 18;
    function okAt(p, mind) { return Math.hypot(p.x - CX, p.y - CY) < lim && !(won && insideShape(g, p.x, p.y)) && seeds.every(function (s) { return Math.hypot(s.x - p.x, s.y - p.y) > mind; }); }
    function polar(c, r0, r1) { var a = rand() * PI * 2, r = r0 + rand() * (r1 - r0); return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; }
    var nBig = won ? 4 : 3, a0 = rand() * PI * 2, b, tries, p;
    for (b = 0; b < nBig; b++) {                                           // 큰 조각의 씨: 불규칙한 각도 · 거리
      for (tries = 0; tries < 12; tries++) {
        var ang = a0 + b * PI * 2 / nBig + (rand() - 0.5) * 1.1, rad = (won ? 150 : 90) + rand() * (won ? 70 : 95);
        p = { x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad };
        if (okAt(p, 100)) { seeds.push(p); break; }
      }
    }
    var nSmall = won ? 3 : 4;
    for (b = 0; b < nSmall; b++) {                                         // 작은 파편의 씨: 응력 지점 가까이
      var base = stress[b % stress.length];
      for (tries = 0; tries < 14; tries++) { p = polar(base, 8 + tries * 2, 26 + tries * 3); if (okAt(p, 24)) { seeds.push(p); break; } }
    }
    if (!won) for (b = 0; b < 2; b++) for (tries = 0; tries < 10; tries++) { p = polar(O, 10, 26); if (okAt(p, 15)) { seeds.push(p); break; } }
    for (tries = 0; seeds.length < 4 && tries < 60; tries++) { p = polar({ x: CX, y: CY }, 30, lim - 20); if (okAt(p, 60)) seeds.push(p); }
    var cells = cellsOf(seeds), pcs = [];
    cells.forEach(function (cell, k) {
      if (cell.length < 3) return;
      var poly = roughen(cell, k, seeds), c = polyCentroid(poly), ar = Math.abs(polyArea(poly));
      pcs.push({ poly: poly, c: c, area: ar, dO: Math.hypot(c.x - O.x, c.y - O.y), seedIdx: k });
    });
    pcs.sort(function (a, b) { return a.dO - b.dO; });                     // 응력 지점에 가까운 조각부터 떨어져 나간다
    var nFree = Math.max(2, Math.ceil(pcs.length * (won ? 0.6 : 0.4))), nLoose = Math.floor(pcs.length * 0.25);
    pcs.forEach(function (pc, idx) {
      pc.state = idx < nFree ? 'free' : (idx < nFree + nLoose ? 'loose' : 'stuck');
      var ang = Math.atan2(pc.c.y - O.y, pc.c.x - O.x) + (rand() - 0.5) * 1.7, small = Math.max(0, 1 - pc.area / 7000), dist, rot, t0;
      if (pc.state === 'free') { dist = (won ? 14 + rand() * 22 : 8 + rand() * 16) * (1 + small * 0.7); rot = (rand() - 0.5) * (0.16 + (pc.area < 2500 ? 0.2 : 0)); t0 = 0.28 + pc.dO / 520 * 0.4 + rand() * 0.12; }
      else if (pc.state === 'loose') { dist = 2 + rand() * 4; rot = (rand() - 0.5) * 0.05; t0 = 0.45 + rand() * 0.2; }
      else { dist = 0; rot = 0; t0 = 99; }
      pc.off = [Math.cos(ang) * dist, Math.sin(ang) * dist + (pc.state === 'free' ? 2.5 : 0)]; pc.rot = rot; pc.t0 = t0;
      pc.runs = [];                                                         // 이웃과 맞닿은 경계(실금이 그려질 선)
      var n = pc.poly.length, cur = null;
      for (var k = 0; k < n; k++) {
        var v = pc.poly[k];
        if (v.tag >= 0) { if (!cur || cur.tag !== v.tag) { cur = { tag: v.tag, pts: [] }; pc.runs.push(cur); cur.pts.push(v); } cur.pts.push(pc.poly[(k + 1) % n]); } else cur = null;
      }
      pc.runs.forEach(function (r) {
        var m = r.pts[(r.pts.length / 2) | 0]; r.onset = 0.04 + Math.hypot(m.x - O.x, m.y - O.y) / 640;
        if (Math.hypot(r.pts[0].x - O.x, r.pts[0].y - O.y) > Math.hypot(r.pts[r.pts.length - 1].x - O.x, r.pts[r.pts.length - 1].y - O.y)) r.pts.reverse();   // 응력 지점 쪽에서 번지기 시작
      });
    });
    return { pieces: pcs, O: O };
  }

  function beginEnd(g) {
    var won = g.phase === 'won', rand = rng((g.seed | 0) + 17), sh = g.shape;     // 시드 기반 — 같은 기록이면 같은 모양으로 깨진다(도전장 재현)
    var full = mk(); drawDisc(full.x, g, false);                           // 달고나 전체(누적 레이어·균열 포함, 바늘 제외)
    var a = { won: won, t: 0, g: g, shards: [], crumbs: [], full: full.c };
    if (won) {
      var piece = mk(), outer = mk();
      piece.x.save(); shapePath(piece.x, sh); piece.x.clip(); piece.x.drawImage(full.c, 0, 0, W, W); piece.x.restore();
      outer.x.drawImage(full.c, 0, 0, W, W); outer.x.globalCompositeOperation = 'destination-out'; shapePath(outer.x, sh); outer.x.fillStyle = '#000'; outer.x.fill();
      a.piece = piece.c; a.outer = outer.c;
    }
    var pl = planFracture(g, won, rand);
    a.shards = pl.pieces; a.O = pl.O;
    a.tSplit = 0.26; a.shards.forEach(function (pc) { if (pc.t0 < 90) a.tSplit = Math.min(a.tSplit, pc.t0); });
    var nc = won ? 14 : 9;                                                 // 작은 부스러기: 떨어져 나가는 조각 가장자리에서 조금만
    var freePcs = a.shards.filter(function (p) { return p.state === 'free'; });
    for (var j = 0; j < nc && freePcs.length; j++) {
      var pc = freePcs[(rand() * freePcs.length) | 0], v = pc.poly[(rand() * pc.poly.length) | 0], ang = rand() * PI * 2;
      a.crumbs.push({ x: v.x, y: v.y, vx: Math.cos(ang) * (15 + rand() * 35), vy: -20 - rand() * 40, s: 1.5 + rand() * 2.2, c: rand() < 0.5 ? '#E0AE57' : '#B57D26', rot: rand() * 6, t0: pc.t0 });
    }
    anim = a; return a;
  }

  function partialLine(x, pts, p) {                                        // pts 의 앞쪽 p(0~1) 만큼만 선으로
    if (p <= 0 || pts.length < 2) return;
    var total = pts.length - 1, upto = p * total, i, full = Math.floor(upto);
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y);
    for (i = 1; i <= Math.min(full, total); i++) x.lineTo(pts[i].x, pts[i].y);
    if (full < total) { var f = upto - full, a = pts[full], b = pts[full + 1]; x.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f); }
    x.stroke();
  }
  function crackRun(x, r, t) {                                             // 한 경계의 실금: 연한 단면 + 가는 짙은 갈색 선
    var p = Math.max(0, Math.min(1, (t - r.onset) / 0.25)); if (p <= 0) return;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,238,186,0.5)'; x.lineWidth = 4.2; partialLine(x, r.pts, p);
    x.strokeStyle = 'rgba(78,44,10,0.85)'; x.lineWidth = 1.8; partialLine(x, r.pts, p);
  }
  function ringClip(x, a) {                                                // 달고나가 있는 곳만(성공이면 빠진 도형 자리 제외) — 실금이 빈 곳에 떠 있지 않게
    x.beginPath(); var d = discPoly(R); x.moveTo(d[0][0], d[0][1]); for (var i = 1; i < d.length; i++) x.lineTo(d[i][0], d[i][1]); x.closePath();
    if (a.won) { var sh = a.g.shape; x.moveTo(sh.px[0], sh.py[0]); for (var k = 1; k < sh.n; k++) x.lineTo(sh.px[k], sh.py[k]); x.closePath(); x.clip('evenodd'); } else x.clip();
  }

  function renderEnd(x, tms, noBoard) {
    var a = anim, t = tms / 1000, g = a.g, sh = g.shape, i, s, img = a.won ? a.outer : a.full;
    if (!noBoard) drawBoardWide(x);
    var sa = Math.max(0, 1 - t / 0.3) * 0.30;                              // 깨지기 직전 원판 그림자만 0.3초 동안 걷힌다(틈에는 어떤 덧칠도 남기지 않는다)
    if (sa > 0) { polyPath(x, discPoly(R).map(function (p) { return [p[0] + 7, p[1] + 11]; })); x.fillStyle = 'rgba(0,0,0,' + sa + ')'; x.fill(); }
    if (t < a.tSplit) {                                                    // ① 아직 한 장 — 응력 지점부터 실금만 번진다
      x.drawImage(img, 0, 0, W, W);
      x.save(); ringClip(x, a); a.shards.forEach(function (pc) { pc.runs.forEach(function (r) { crackRun(x, r, t); }); }); x.restore();
    } else {                                                               // ② 조각 상태가 갈린다: 떨어진 것 / 느슨해진 것 / 금만 간 채 붙어 있는 것
      var order = { stuck: 0, loose: 1, free: 2 };
      a.shards.slice().sort(function (p, q) { return order[p.state] - order[q.state] || q.area - p.area; }).forEach(function (pc) { drawPiece(x, a, pc, img, t); });
    }
    if (a.won) {                                                           // 가운데 도형은 제자리·같은 크기 그대로
      x.save(); x.drawImage(a.piece, 0, 0, W, W);
      shapePath(x, sh); x.lineJoin = 'round'; x.strokeStyle = '#8A5A18'; x.lineWidth = 3; x.stroke(); x.restore();
    }
    for (i = 0; i < a.crumbs.length; i++) {
      s = a.crumbs[i]; var tt = t - s.t0 - 0.05, life = 0.8; if (tt < 0 || tt > life) continue;
      var cx = s.x + s.vx * tt, cy = s.y + s.vy * tt + 0.5 * 380 * tt * tt;
      x.globalAlpha = Math.max(0, 1 - tt / life); x.save(); x.translate(cx, cy); x.rotate(s.rot + tt * 4); x.fillStyle = s.c; x.fillRect(-s.s / 2, -s.s / 2, s.s, s.s); x.restore();
    }
    x.globalAlpha = 1;
  }
  function drawPiece(x, a, pc, img, t) {
    var pp = ease((t - pc.t0) / 0.5), ox = pc.off[0] * pp, oy = pc.off[1] * pp;
    x.save();
    x.translate(pc.c.x + ox, pc.c.y + oy); x.rotate(pc.rot * pp); x.translate(-pc.c.x, -pc.c.y);
    pathPts(x, pc.poly); x.clip();                                         // 조각 안쪽만 그린다 — 조각이 비운 자리는 아무것도 칠하지 않아 그대로 투명
    if (a.won) { x.save(); ringClip(x, a); x.drawImage(img, 0, 0, W, W); pc.runs.forEach(function (r) { crackRun(x, r, t); }); x.restore(); }
    else { x.drawImage(img, 0, 0, W, W); pc.runs.forEach(function (r) { crackRun(x, r, t); }); }
    x.restore();
  }
  function endDone(tms) { return tms >= C.END_MS; }
  function clearEnd() { anim = null; dust.length = 0; }

  // ---------- 미리보기(인트로 · 모양 선택 · 결과) ----------
  function sizeCanvas(cv) {
    if (cv._fixed) return cv.getContext('2d');                             // 화면에 안 붙은 캔버스(공유 이미지): 크기를 건드리지 않는다
    var r = cv.getBoundingClientRect(), d = Math.max(1, Math.min(2, window.devicePixelRatio || 1)), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv.getContext('2d');
  }
  function drawTo(cv, fn, withBoard) {                                     // 600×600 논리 장면을 캔버스에 맞춰(contain) 그린다. 비정방형 프레임은 도마를 cover 로 먼저 깐다
    var x = sizeCanvas(cv), k = Math.min(cv.width, cv.height) / W;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    if (withBoard) { var kc = Math.max(cv.width, cv.height) / W; x.setTransform(kc, 0, 0, kc, (cv.width - W * kc) / 2, (cv.height - W * kc) / 2); x.drawImage(board(), 0, 0, W, W); x.setTransform(1, 0, 0, 1, 0, 0); }
    x.setTransform(k, 0, 0, k, (cv.width - W * k) / 2, (cv.height - W * k) / 2);
    fn(x);
  }
  function previewDisc(cv, id, frac, withNeedle, flat) {                         // 도형 선택 썸네일 / 인트로
    var E = DG.engine, g = E.create(id, 3), n = g.n, cnt = Math.round(n * frac);
    if (withNeedle && !cnt) { var r = 0; for (var j = 1; j < n; j++) if (g.px[j] > g.px[r]) r = j; g.tip.x = g.px[r]; g.tip.y = g.py[r]; g.tipD = 0;   // 인트로: 긁은 자국 없이 홈 오른쪽에 바늘만
      drawTo(cv, function (x) { drawDisc(x, g, true); drawNeedle(x, g, true); }, true); return; }
    for (var i = 0; i < cnt; i++) { g.tip.x = g.px[i]; g.tip.y = g.py[i]; g.marked[i] = 1; g.markedCount++; g.fresh.push(i); }
    var tip = Math.max(0, cnt - 1); g.tip.x = g.px[tip]; g.tip.y = g.py[tip]; g.scratching = withNeedle; g.tipD = 0;
    drawTo(cv, function (x) { drawDisc(x, g, !flat); if (withNeedle) drawNeedle(x, g); }, !flat);
  }
  function blankDisc(cv, flat) { drawTo(cv, function (x) { if (!flat) discShadow(x); x.drawImage(blank(), 0, 0, W, W); }, !flat); }   // 선택 카드 썸네일 · 선택 미리보기: 빈 달고나
  function drawPad(cv, pts) { drawTo(cv, function (x) { discShadow(x); x.drawImage(blank(), 0, 0, W, W); (pts || []).forEach(function (st) { if (st.length) engrave(x, st, false); }); }, true); }   // 도안 그리기 화면: 빈 달고나 위에 그린 선들(눌러 찍히는 모습)
  function snapshot(cv, other) {                                           // 결과 화면: 마지막 연출 프레임(바늘 없음). other 가 있으면 그 기록의 장면
    var keep = anim, a = other || anim; if (!a) return; anim = a;
    try { drawTo(cv, function (x) { var k = a.won ? 0.72 : 1; x.translate(CX, CY); x.scale(k, k); x.translate(-CX, -CY); renderEnd(x, 1e6, true); }, true); } finally { anim = keep; }
  }
  function makeEnd(g) { var keep = anim, a = beginEnd(g); anim = keep; return a; }   // 현재 판의 연출 상태를 건드리지 않고 다른 기록의 끝 장면을 만든다
  function debugEnd(cv, tms) { drawTo(cv, function (x) { renderEnd(x, tms, true); }, false); }   // QA: 알파 검사용(배경 없음)
  function render(cv, g, dt) {                                             // 달고나(600×600 논리 좌표)는 높이에 맞춰 같은 크기·같은 위치로, 캔버스가 더 넓으면 배경만 양옆으로 연장
    var x = sizeCanvas(cv), k = Math.min(cv.width, cv.height) / W, ox = (cv.width - W * k) / 2, oy = (cv.height - W * k) / 2;
    x.setTransform(k, 0, 0, k, ox, oy);
    VIS = { x0: -ox / k, y0: -oy / k, x1: (cv.width - ox) / k, y1: (cv.height - oy) / k };
    try { if (anim) renderEnd(x, anim.t); else renderPlay(x, g, dt); } finally { VIS = null; }
  }
  function tickEnd(dtms) { if (anim) anim.t += dtms; return anim ? anim.t : 0; }

  DG.view = { makeEnd: makeEnd, debugEnd: debugEnd, initScale: initScale, resetBase: resetBase, render: render, beginEnd: beginEnd, tickEnd: tickEnd, endDone: endDone, clearEnd: clearEnd, previewDisc: previewDisc, blankDisc: blankDisc, drawPad: drawPad, snapshot: snapshot, isEnding: function () { return !!anim; }, resetFx: function () { dust.length = 0; } };
})();
