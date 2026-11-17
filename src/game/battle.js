/* 달고나 뽑기의 달인 — 친구 도전장 (기록을 링크 해시에 직접 담는다. 서버 없음. 주차하기·사과 깎기·썰기와 같은 방식)
 * 링크: <공개 주소>#battle/v1.<base64url JSON>
 * JSON: { n: 닉네임(≤12), i: 모양 id, w: 성공 1/실패 0, s: 점수(×10 정수), a: 정확도(×10), d: 균열(%), x: 선 이탈 횟수, t: 소요 시간(×10 초), p: 긁은 정도(×10 %),
 *         z: 판 시드(깨지는 모양 재현), f: 파손 지점 [x,y] (실패일 때),
 *         c: 직접 그린 도안일 때 정리된 닫힌 path [x0,y0,x1,y1,…](정수 좌표, i='custom') }
 * 점수는 실제 기록 그대로 담는다. 받는 쪽은 같은 시드·진행도·균열로 "최종 모습"을 다시 만들어 그린다(판정·점수에는 관여하지 않는다). */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var C = DG.C, PREFIX = 'v1.';

  function b64uEncode(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64uDecode(str) { var b = str.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(decodeURIComponent(escape(atob(b)))); }
  function num(v, lo, hi) { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? v : null; }

  // rec: { nickname, shape, result }  (result = engine 결과)
  function makeToken(rec) {
    var r = rec.result, d = { n: (rec.nickname || '').slice(0, 12), i: rec.shape, w: r.won ? 1 : 0, s: Math.round(r.score * 10), a: Math.round(r.accuracy * 10), d: r.damage, x: r.exits, t: Math.round(r.time * 10), p: Math.round(r.progress * 10), z: r.seed };
    if (!r.won && r.failAt) d.f = [r.failAt.x, r.failAt.y];
    if (rec.shape === 'custom' && rec.custom) { d.c = []; rec.custom.forEach(function (p) { d.c.push(p[0], p[1]); }); }
    return PREFIX + b64uEncode(d);
  }
  function parseToken(token) {
    try {
      if (!token || token.indexOf(PREFIX) !== 0) return null;
      var d = b64uDecode(token.slice(PREFIX.length));
      var custom = null;
      if (d.i === 'custom') {                                              // 직접 그린 도안: 좌표 6~400개(점 3~200개)의 0~600 정수
        if (!Array.isArray(d.c) || d.c.length < 6 || d.c.length > 400 || d.c.length % 2 || d.c.some(function (v) { return typeof v !== 'number' || !isFinite(v) || v < 0 || v > 600; })) return null;
        custom = []; for (var q = 0; q < d.c.length; q += 2) custom.push([Math.round(d.c[q]), Math.round(d.c[q + 1])]);
      } else if (!DG.SHAPES[d.i]) return null;
      var s = num(d.s, 0, 1000), a = num(d.a, 0, 1000), dm = num(d.d, 0, 100), x = num(d.x, 0, 9999), t = num(d.t, 0, 36000), p = num(d.p, 0, 1000), z = num(d.z, 0, 4294967295);
      if ([s, a, dm, x, t, p, z].some(function (v) { return v === null; })) return null;
      var won = d.w === 1;
      var f = Array.isArray(d.f) && num(d.f[0], 0, 600) !== null && num(d.f[1], 0, 600) !== null ? { x: +d.f[0], y: +d.f[1] } : null;
      return { nickname: String(d.n || '친구').replace(/[\u0000-\u001f<>]/g, '').slice(0, 12) || '친구', shape: d.i, won: won, score: s / 10, accuracy: a / 10, damage: dm, exits: x, time: t / 10, progress: p / 10, seed: z, failAt: f, custom: custom };
    } catch (e) { return null; }
  }
  function baseUrl() { return (DG.SHARE.URL || location.href).split('#')[0]; }
  function isLocal() { return !DG.SHARE.URL && !/^https?:$/.test(location.protocol); }   // file:// 로 연 링크는 이 PC에서만 열린다
  function buildUrl(token) { return baseUrl() + '#battle/' + token; }
  function parseHash() { var m = location.hash.match(/^#battle\/(.+)$/); return m ? m[1] : null; }

  // 기록 → 최종 모습을 그릴 수 있는 판 상태(엔진 객체). 진행도는 시작점부터 이어서 긁은 것으로 본다.
  function rebuild(rec) {
    if (rec.custom) DG.setCustom(rec.custom);                              // 친구가 직접 그린 도안이면 그 도안으로 장면을 다시 만든다
    var E = DG.engine, g = E.create(rec.shape, rec.seed), n = g.n, k = Math.round(n * rec.progress / 100), i;
    for (i = 0; i < k; i++) g.marked[i] = 1;
    g.markedCount = k; g.fresh.push(0);
    g.damage = rec.damage; g.phase = rec.won ? 'won' : 'lost';
    var r = g.rand, spots = [];
    if (!rec.won) { g.failAt = rec.failAt || { x: C.CX, y: C.CY }; for (i = 0; i < 3; i++) spots.push({ x: g.failAt.x + (r() - 0.5) * 36, y: g.failAt.y + (r() - 0.5) * 36, e: 28 }); }
    else if (rec.damage >= 4) { var m = Math.min(4, Math.ceil(rec.damage / 10)); for (i = 0; i < m; i++) { var q = (r() * n) | 0; spots.push({ x: g.px[q] + (r() - 0.5) * 14, y: g.py[q] + (r() - 0.5) * 14, e: rec.damage / m * 1.2 }); } }
    spots.forEach(function (s) {
      var nb = 3 + Math.floor(r() * 2), a0 = r() * 6.283, br = [];
      for (var b = 0; b < nb; b++) { var jit = []; for (var j = 0; j < 12; j++) jit.push((r() - 0.5) * 2); br.push({ a: a0 + b * (6.283 / nb) + (r() - 0.5) * 0.8, jit: jit, k: 0.7 + r() * 0.6 }); }
      g.seeds.push({ x: s.x, y: s.y, e: s.e, br: br });
    });
    g.result = { won: rec.won, score: rec.score, accuracy: rec.accuracy, exits: rec.exits, time: rec.time, damage: rec.damage, progress: rec.progress, seed: rec.seed, failAt: g.failAt };
    return g;
  }

  DG.battle = { makeToken: makeToken, parseToken: parseToken, buildUrl: buildUrl, parseHash: parseHash, baseUrl: baseUrl, isLocal: isLocal, rebuild: rebuild };
})();
