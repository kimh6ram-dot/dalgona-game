/* 달고나 모양 경로 데이터. 모양을 추가하려면 RAW 에 닫힌 다각선(점 배열)을 만들고 ORDER·META 에 한 줄 더하면 된다.
 * 모든 모양은 같은 간격(C.STEP)으로 재표본화되어 달고나 중심에 맞춰지고, 맨 위 점이 시작점(index 0)이 된다. */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var C = DG.C;
  var PI = Math.PI;

  function arc(cx, cy, r, a0, a1, n) {                   // a0→a1 호를 n 구간으로
    var o = [];
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return o;
  }
  function scallop(x0, x1, depth, n) {                   // 우산 아랫단: 두 끝(살 끝)은 아래, 사이는 위로 오목
    var o = [];
    for (var i = 1; i <= n; i++) { var t = i / n; o.push([x0 + (x1 - x0) * t, -depth * Math.sin(PI * t)]); }
    return o;
  }

  var RAW = {
    circle: function () { return arc(0, 0, 100, 0, PI * 2, 160).slice(0, -1); },
    triangle: function () { return [[0, -100], [86.6, 50], [-86.6, 50]]; },
    star: function () {
      var o = [];
      for (var i = 0; i < 10; i++) { var r = i % 2 ? 40 : 100, a = -PI / 2 + i * PI / 5; o.push([r * Math.cos(a), r * Math.sin(a)]); }
      return o;
    },
    umbrella: function () {
      var p = [];
      p = p.concat(arc(0, 0, 130, PI, PI * 2, 60));                       // 둥근 윗면(왼→오른)
      p = p.concat(scallop(130, 65, 17, 10), scallop(65, 11, 17, 8));      // 오른쪽 아랫단
      p.push([11, 125]);                                                  // 손잡이 오른쪽 변
      p = p.concat(arc(-27, 125, 38, 0, PI, 24));                         // 갈고리 바깥 호
      p.push([-65, 105], [-43, 105], [-43, 125]);                         // 갈고리 끝
      p = p.concat(arc(-27, 125, 16, PI, 0, 18));                         // 갈고리 안쪽 호(되돌아 올라감)
      p.push([-11, 0]);                                                   // 손잡이 왼쪽 변이 윗면에 닿는 곳
      p = p.concat(scallop(-11, -65, 17, 8), scallop(-65, -130, 17, 10)); // 왼쪽 아랫단
      return p;
    }
  };

  var META = {
    circle:   { name: '동그라미', diff: '보통',      size: 320, ref: 20 },
    triangle: { name: '세모',     diff: '쉬움',      size: 340, ref: 22 },
    star:     { name: '별',       diff: '어려움',    size: 345, ref: 30 },
    umbrella: { name: '우산',     diff: '매우 어려움', size: 340, ref: 42 }
  };
  var ORDER = ['triangle', 'circle', 'star', 'umbrella'];

  function resample(raw, step) {                         // 닫힌 다각선을 같은 간격 점으로
    var m = raw.length, cum = [0], L = 0, i;
    for (i = 0; i < m; i++) { var a = raw[i], b = raw[(i + 1) % m]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
    var n = Math.max(12, Math.round(L / step)), out = [], e = 0;
    for (i = 0; i < n; i++) {
      var s = L * i / n;
      while (cum[e + 1] < s) e++;
      var a2 = raw[e], b2 = raw[(e + 1) % m], t = (s - cum[e]) / ((cum[e + 1] - cum[e]) || 1);
      out.push([a2[0] + (b2[0] - a2[0]) * t, a2[1] + (b2[1] - a2[1]) * t]);
    }
    return out;
  }
  function fit(pts, size) {                              // bbox 최대변 = size, 중심 = 달고나 중심
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i;
    for (i = 0; i < pts.length; i++) { x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]); y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    var k = size / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return pts.map(function (p) { return [C.CX + (p[0] - cx) * k, C.CY + (p[1] - cy) * k]; });
  }

  function build(id, pts, m) {                           // 점(논리 좌표, 닫힌 다각선) → 판정용 모양(맨 위 점이 시작점)
    var top = 0; for (var i = 1; i < pts.length; i++) if (pts[i][1] < pts[top][1] - 0.01) top = i;
    pts = pts.slice(top).concat(pts.slice(0, top));
    var n = pts.length, px = new Float32Array(n), py = new Float32Array(n), len = 0;
    for (var j = 0; j < n; j++) { px[j] = pts[j][0]; py[j] = pts[j][1]; len += Math.hypot(pts[(j + 1) % n][0] - pts[j][0], pts[(j + 1) % n][1] - pts[j][1]); }
    return { id: id, name: m.name, diff: m.diff, ref: m.ref, n: n, px: px, py: py, length: len };
  }

  DG.SHAPES = {};
  DG.SHAPE_ORDER = ORDER;                                  // 사진 에셋을 불러오는 목록(인트로의 동그라미 포함)
  DG.SELECT_ORDER = ['triangle', 'star', 'umbrella', 'custom'];   // 선택 화면 카드 순서(2×2)
  DG.CUSTOM_INFO = { name: '직접 만들기', diff: '모름' };      // 선택 카드 문구
  ORDER.forEach(function (id) {
    var pts;
    if (DG.PATHS && DG.PATHS[id]) {                          // 사진 에셋의 음각 윤곽(이미지 px) → 논리 좌표: 원판 중심·반지름을 맞춘다
      pts = resample(DG.PATHS[id].map(function (q) { return [C.CX + (q[0] - C.IMG_CX) * C.IMG_K, C.CY + (q[1] - C.IMG_CY) * C.IMG_K]; }), C.STEP);
    } else {                                                 // 사진 경로가 없으면 코드로 만든 기본 도형
      pts = fit(resample(RAW[id](), 0.6), META[id].size);    // 먼저 촘촘히(꼭짓점 보존) → 맞춤 → 판정 간격으로
      pts = resample(pts, C.STEP);
    }
    DG.SHAPES[id] = build(id, pts, META[id]);
  });

  // ---------- 직접 그린 도안 ----------
  // fitCustom: 도안을 달고나 안쪽 안전 영역에 맞춘다(bbox 중심 = 원판 중심, 최대변 ≤ 340, 가장 먼 점 ≤ 반지름 205). 이미 맞춰진 도안에 다시 적용해도 그대로(배율 1).
  function fitCustom(pts) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i;
    for (i = 0; i < pts.length; i++) { x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]); y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rmax = 1;
    for (i = 0; i < pts.length; i++) rmax = Math.max(rmax, Math.hypot(pts[i][0] - cx, pts[i][1] - cy));
    var k = Math.min(340 / Math.max(x1 - x0, y1 - y0, 1), 205 / rmax);
    return pts.map(function (p) { return [C.CX + (p[0] - cx) * k, C.CY + (p[1] - cy) * k]; });
  }
  var customKey = '';
  function setCustom(raw) {                                  // 도안(닫힌 다각선, 달고나 논리 좌표 그대로) → DG.SHAPES.custom. 확대·이동 없이 판정 간격으로만 다시 표본화. 같은 도안이면 그대로 둔다
    var key = JSON.stringify(raw);
    if (DG.SHAPES.custom && key === customKey) return DG.SHAPES.custom;
    var pts = resample(raw, C.STEP), sh = build('custom', pts, { name: '내 도안', diff: DG.CUSTOM_INFO.diff, ref: 20 });
    sh.ref = Math.max(14, Math.min(50, Math.round(sh.length / 40)));   // 기준 시간: 길이에 비례(세모 22 · 별 30 · 우산 42 와 비슷한 비율)
    DG.SHAPES.custom = sh; customKey = key;
    if (DG.view) DG.view.resetBase();
    return sh;
  }
  DG.fitCustom = fitCustom; DG.setCustom = setCustom;
})();
