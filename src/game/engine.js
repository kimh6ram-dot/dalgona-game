/* 판정 엔진 — DOM·캔버스를 모르는 순수 로직(논리 좌표 600×600). 화면 크기와 무관하게 같은 판정이 나온다.
 * 바늘끝 좌표 하나만 기준: 경로 점들까지의 최단거리 d 로 ① 선 위(≤ON) 긁힘 진행 ② 선 밖 균열 ③ 선 이탈 횟수를 계산한다. */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var C = DG.C, SC = DG.SCORE;

  function nearest(g, x, y) {                            // 경로 점들 중 가장 가까운 점 → g._d, g._k
    var px = g.px, py = g.py, best = 1e18, k = 0;
    for (var i = 0; i < g.n; i++) { var dx = px[i] - x, dy = py[i] - y, d = dx * dx + dy * dy; if (d < best) { best = d; k = i; } }
    g._d = Math.sqrt(best); g._k = k;
  }
  function inside(g, x, y) {                             // 도형 안쪽인가(광선법)
    var px = g.px, py = g.py, n = g.n, c = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      if ((py[i] > y) !== (py[j] > y) && x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i]) + px[i]) c = !c;
    }
    return c;
  }
  function dmgRate(d, ins) {                             // 선 밖에서 긁을 때 단위 길이당 균열량
    if (d <= C.ON) return 0;
    var f = d <= 24 ? 0.1 + (d - C.ON) / (24 - C.ON) * 0.9 : 1 + Math.min(0.6, (d - 24) / 60);
    return ins ? f * 1.25 : f;                           // 도형 안쪽을 긁으면 더 위험
  }

  function mark(g, k) {                                  // k 주변(MARK_R 이내) 경로 조각을 긁힘 처리
    var n = g.n, r2 = C.MARK_R * C.MARK_R, tx = g.tip.x, ty = g.tip.y, i, c;
    function hit(idx) {
      var dx = g.px[idx] - tx, dy = g.py[idx] - ty;
      if (dx * dx + dy * dy > r2) return false;
      if (!g.marked[idx]) { g.marked[idx] = 1; g.markedCount++; g.fresh.push(idx); }
      return true;
    }
    hit(k);
    for (i = 1, c = k; i < n; i++) { c = (k + i) % n; if (!hit(c)) break; }
    for (i = 1; i < n; i++) { c = (k - i + n) % n; if (!hit(c)) break; }
  }

  function addCrack(g, s, f) {                           // 선 밖 긁기: 가까운 균열 씨앗을 키우거나 새로 만든다 → 반복할수록 확대
    var x = g.tip.x, y = g.tip.y, best = null, bd = C.SEED_RADIUS * C.SEED_RADIUS, i, mult = 1;
    for (i = 0; i < g.seeds.length; i++) {
      var sd = g.seeds[i], dx = sd.x - x, dy = sd.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = sd; }
    }
    if (!best) {
      best = { x: x, y: y, e: 0, br: [] };
      var nb = 3 + Math.floor(g.rand() * 2), a0 = g.rand() * 6.283;
      for (i = 0; i < nb; i++) {
        var jit = []; for (var j = 0; j < 12; j++) jit.push((g.rand() - 0.5) * 2);
        best.br.push({ a: a0 + i * (6.283 / nb) + (g.rand() - 0.5) * 0.8, jit: jit, k: 0.7 + g.rand() * 0.6 });
      }
      if (g.seeds.length >= 40) g.seeds.shift();
      g.seeds.push(best);
    } else if (best.e > 6) mult = 1.35;                  // 이미 금 간 곳을 또 긁음
    var add = s * f * mult;
    best.e += add;
    g.damage += add;
    g.lastCrack = { x: x, y: y };
    if (g.damage >= C.FAIL) { g.damage = C.FAIL; g.phase = 'lost'; g.failAt = { x: x, y: y }; }
  }

  function scratchAt(g, s) {                             // 바늘끝이 s 만큼 긁으며 이동한 한 구간 판정
    var x = g.tip.x, y = g.tip.y;
    nearest(g, x, y);
    var d = g._d;
    if (d <= C.ON) {
      g.onLen += s; g.everOn = true; g.offFlag = false;
      mark(g, g._k);
    } else {
      g.offLen += s;
      if (d > C.EXIT && !g.offFlag) { if (g.everOn) g.exits++; g.offFlag = true; }
      g.trail.push([g.prev.x, g.prev.y, x, y]);
      addCrack(g, s, dmgRate(d, inside(g, x, y)));
    }
  }

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function create(shapeId, seed) {
    var sh = DG.SHAPES[shapeId];
    var g = {
      shape: sh, id: shapeId, n: sh.n, px: sh.px, py: sh.py,
      marked: new Uint8Array(sh.n), markedCount: 0, fresh: [], trail: [],
      tip: { x: sh.px[0], y: sh.py[0] }, prev: { x: sh.px[0], y: sh.py[0] },
      scratching: false, moved: false, started: false, time: 0,
      onLen: 0, offLen: 0, exits: 0, everOn: false, offFlag: false,
      damage: 0, seeds: [], lastCrack: null, failAt: null,
      phase: 'play', result: null, _d: 0, _k: 0, tipD: 0,
      rand: null, seed: 0
    };
    g.seed = seed == null ? (Math.random() * 1e9) | 0 : seed; g.rand = mulberry(g.seed);
    nearest(g, g.tip.x, g.tip.y); g.tipD = g._d;
    return g;
  }

  function step(g, dt, inp) {                            // inp: {dx,dy,scratch}
    if (g.phase !== 'play') return;
    var dx = inp.dx, dy = inp.dy, len = Math.hypot(dx, dy);
    g.scratching = !!inp.scratch; g.moved = false;
    if (g.scratching) g.started = true;
    if (g.started) g.time += dt;
    if (len > 0) {
      dx /= len; dy /= len;                              // 대각선 정규화
      var dist = (g.scratching ? C.SPEED_SCRATCH : C.SPEED) * dt;
      var steps = Math.max(1, Math.ceil(dist / 1.5)), s = dist / steps;
      var lim = C.DISC_R - 8;
      for (var i = 0; i < steps && g.phase === 'play'; i++) {
        g.prev.x = g.tip.x; g.prev.y = g.tip.y;
        var nx = g.tip.x + dx * s, ny = g.tip.y + dy * s;
        var ox = nx - C.CX, oy = ny - C.CY, od = Math.hypot(ox, oy);
        if (od > lim) { nx = C.CX + ox / od * lim; ny = C.CY + oy / od * lim; }
        g.tip.x = nx; g.tip.y = ny; g.moved = true;
        if (g.scratching) scratchAt(g, Math.hypot(nx - g.prev.x, ny - g.prev.y));
      }
    }
    if (!g.scratching) g.offFlag = false;                // 떼면 이탈 상태 해제
    nearest(g, g.tip.x, g.tip.y); g.tipD = g._d;
  }

  function progress(g) { return g.markedCount / g.n; }
  function ready(g) { return g.phase === 'play' && progress(g) >= C.READY; }

  function gradeFor(score) { for (var i = 0; i < DG.GRADES.length; i++) if (score >= DG.GRADES[i].min) return DG.GRADES[i]; return DG.GRADES[DG.GRADES.length - 1]; }

  function finish(g, won) {                              // 결과 계산(g.result)
    var prog = progress(g), tot = g.onLen + g.offLen;
    var acc = tot > 0 ? g.onLen / tot : 0;
    var ref = g.shape.ref, t = g.time;
    var timeF = t <= ref ? 1 : Math.max(0, 1 - (t - ref) / (ref * 1.5));
    var covF = Math.max(0, Math.min(1, (prog - 0.90) / 0.10));
    var raw = 100 * (SC.ACC * acc + SC.CRACK * (1 - g.damage / C.FAIL) + SC.TIME * timeF + SC.COV * covF) - Math.min(SC.EXIT_MAX, g.exits * SC.EXIT_PEN);
    var score = won ? Math.max(0, Math.min(100, Math.round(raw * 10) / 10)) : 0;
    var gr = won ? gradeFor(score) : DG.FAIL_GRADES[Math.floor(g.rand() * DG.FAIL_GRADES.length)];
    g.result = { won: won, score: score, title: gr.title, comment: gr.comment, accuracy: Math.round(acc * 1000) / 10, exits: g.exits, time: Math.round(t * 10) / 10, damage: Math.round(g.damage), progress: Math.round(prog * 1000) / 10, seed: g.seed, failAt: g.failAt ? { x: Math.round(g.failAt.x), y: Math.round(g.failAt.y) } : null };
    return g.result;
  }

  function separate(g) {                                 // [뽑기] — 충분히 긁었을 때만 성공
    if (!ready(g)) return false;
    g.phase = 'won'; finish(g, true); return true;
  }
  function settleLoss(g) { if (g.phase === 'lost' && !g.result) finish(g, false); }

  DG.engine = { create: create, step: step, progress: progress, ready: ready, separate: separate, settleLoss: settleLoss, nearest: nearest };
})();
