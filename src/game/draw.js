/* 직접 그리기 — 빈 달고나 위에 그린 도안(여러 획 가능)을 게임용 닫힌 도안 하나로 정리한다.
 * 입력: 손가락/마우스(포인터 이벤트) → 논리 좌표(600×600). 달고나 원판 밖은 가장자리로 붙는다(밖으로 그려지지 않음).
 * 정리: 가까운 끝점끼리 이어 한 줄로 → 닫기(끝점→시작점) → 중복점 정리 → 정수 좌표. 그린 모양·크기·위치는 그대로(스무딩·확대·중앙 정렬 없음).
 * 결과(finish)의 pts 는 도전장 링크에 그대로 담기는 정리된 path 데이터다. */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var C = DG.C, W = C.W, CX = C.CX, CY = C.CY, LIM = C.DISC_R - 12;     // 선이 닿을 수 있는 가장자리(림 안쪽)
  var MAXV = 160, MAXPTS = 4000, MAXSTROKES = 8, cv = null, strokes = [], drawing = false, onRedraw = null;
  function total() { var n = 0; for (var i = 0; i < strokes.length; i++) n += strokes[i].length; return n; }

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function toLogical(e) {
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * W, dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy);
    if (d > LIM) { x = CX + dx / d * LIM; y = CY + dy / d * LIM; }
    return [x, y];
  }
  function redraw() { if (cv) DG.view.drawPad(cv, strokes); if (onRedraw) onRedraw(total()); }

  function bind(canvas, cb) {
    cv = canvas; onRedraw = cb || null;
    cv.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
      if (strokes.length >= MAXSTROKES) { drawing = false; if (onRedraw) onRedraw(-1); return; }      // 획이 너무 많으면 더 그리지 않는다
      strokes.push([toLogical(e)]); drawing = true; redraw();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = toLogical(e);
      var cur = strokes[strokes.length - 1];
      if (total() < MAXPTS && dist(p, cur[cur.length - 1]) >= 3) { cur.push(p); redraw(); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { cv.addEventListener(t, function () { drawing = false; }); });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  function reset() { strokes = []; drawing = false; redraw(); }              // 그린 선만 지운다(달고나는 그대로)

  function pathLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }
  function resampleOpen(p, step) {
    var L = pathLen(p), n = Math.max(2, Math.round(L / step)), out = [p[0]], e = 0, acc = 0, i, t;
    var cum = [0]; for (i = 1; i < p.length; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i]));
    for (i = 1; i < n; i++) {
      var s = L * i / n; while (e < p.length - 2 && cum[e + 1] < s) e++;
      t = (s - cum[e]) / ((cum[e + 1] - cum[e]) || 1);
      out.push([p[e][0] + (p[e + 1][0] - p[e][0]) * t, p[e][1] + (p[e + 1][1] - p[e][1]) * t]);
    }
    out.push(p[p.length - 1]); acc = 0;
    return out;
  }
  function smooth(p, passes) {                                           // 끝점은 고정, 3점 평균(0.25·0.5·0.25)을 반복
    for (var k = 0; k < passes; k++) {
      var q = [p[0]];
      for (var i = 1; i < p.length - 1; i++) q.push([p[i - 1][0] * 0.25 + p[i][0] * 0.5 + p[i + 1][0] * 0.25, p[i - 1][1] * 0.25 + p[i][1] * 0.5 + p[i + 1][1] * 0.25]);
      q.push(p[p.length - 1]); p = q;
    }
    return p;
  }
  function rdpOpen(p, eps) {
    if (p.length < 3) return p.slice();
    var a = p[0], b = p[p.length - 1], md = -1, mi = 0, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    for (var i = 1; i < p.length - 1; i++) { var d = Math.abs(dy * (p[i][0] - a[0]) - dx * (p[i][1] - a[1])) / L; if (d > md) { md = d; mi = i; } }
    if (md <= eps) return [a, b];
    return rdpOpen(p.slice(0, mi + 1), eps).slice(0, -1).concat(rdpOpen(p.slice(mi), eps));
  }
  function simplifyClosed(poly, eps) {                                   // 닫힌 다각선: 가장 먼 두 점으로 둘로 갈라 각각 단순화
    var a = 0, i, b = 0, md = -1;
    for (i = 1; i < poly.length; i++) { var d = dist(poly[0], poly[i]); if (d > md) { md = d; b = i; } }
    var h1 = poly.slice(0, b + 1), h2 = poly.slice(b).concat([poly[0]]);
    return rdpOpen(h1, eps).slice(0, -1).concat(rdpOpen(h2, eps).slice(0, -1));
  }
  function crossings(poly) {                                             // 서로 이웃하지 않는 변끼리의 교차 수(복잡한 낙서 판별)
    var n = poly.length, c = 0, i, j;
    function ccw(a, b, c2) { return (c2[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c2[0] - a[0]); }
    for (i = 0; i < n; i++) for (j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      var a = poly[i], b = poly[(i + 1) % n], c1 = poly[j], d = poly[(j + 1) % n];
      if (ccw(a, c1, d) !== ccw(b, c1, d) && ccw(a, b, c1) !== ccw(a, b, d)) c++;
    }
    return c;
  }

  // 반환: { ok:false, msg } | { ok:true, pts:[[x,y]...] (정수 · 안전 영역에 맞춘 닫힌 도안) }
  function chain(list) {                                                // 획들을 가까운 끝점끼리 이어 한 줄로(필요하면 획을 뒤집는다)
    var rest = list.slice(), out = rest.shift().slice();
    while (rest.length) {
      var end = out[out.length - 1], bi = 0, br = false, bd = 1e9;
      for (var i = 0; i < rest.length; i++) {
        var s = rest[i], d0 = dist(end, s[0]), d1 = dist(end, s[s.length - 1]);
        if (d0 < bd) { bd = d0; bi = i; br = false; }
        if (d1 < bd) { bd = d1; bi = i; br = true; }
      }
      var nx = rest.splice(bi, 1)[0]; if (br) nx = nx.slice().reverse();
      out = out.concat(nx);
    }
    return out;
  }
  function finish() {
    var all = strokes.filter(function (s) { return s.length >= 2; }), i;
    if (!strokes.length) return { ok: false, msg: '도안을 먼저 그려주세요' };
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, plen = 0;
    all.forEach(function (st) { plen += pathLen(st); st.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); });
    var size = Math.max(x1 - x0, y1 - y0);
    if (!all.length || size < 70 || plen < 170) return { ok: false, msg: '조금 더 길게 그려주세요' };
    if (plen / size > 16 || strokes.length > MAXSTROKES) return { ok: false, msg: '도안이 너무 복잡해요' };
    var s = chain(all);                                                    // 그린 점 그대로(스무딩·보정 없음)
    if (dist(s[0], s[s.length - 1]) < 8 && s.length > 3) s.pop();           // 거의 닫혀 있으면 끝점을 합친다(아니면 끝→시작을 직선으로 이어 닫는다)
    var eps = 0.7, poly = s;                                                // 일직선 위 중복점만 걷어낸다(모양은 그대로). 점이 너무 많으면 조금씩 거칠게
    for (i = 0; i < 8; i++) { poly = simplifyClosed(s, eps); if (poly.length <= MAXV) break; eps *= 1.6; }
    if (poly.length > MAXV || poly.length < 3) return { ok: false, msg: '도안이 너무 복잡해요' };
    if (crossings(poly) > 8) return { ok: false, msg: '도안이 너무 복잡해요' };
    return { ok: true, pts: poly.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; }) };
  }

  DG.draw = { bind: bind, reset: reset, redraw: redraw, finish: finish, count: total, _set: function (p) { strokes = Array.isArray(p[0][0]) ? p : [p]; redraw(); } };
})();
