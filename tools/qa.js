/* 화면·입력·레이아웃 QA — node tools/qa.js [--shots]   (file:// 헤드리스 Chrome, playwright-core)
 * 엔진 판정 단위 검증은 tools/sim.js. 여기서는 실제 DOM: 흐름 · 키보드 · 멀티터치 · 스크롤 충돌 · 재시작 초기화 · 반응형 오버플로. */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pw = require(path.join(ROOT, '..', '..', '260624', 'build', 'node_modules', 'playwright-core'));
const SHOTS = process.argv.includes('--shots');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x === undefined ? '' : JSON.stringify(x)); } };
const shot = (p, name) => SHOTS ? p.screenshot({ path: path.join(ROOT, 'screenshot', name + '.png') }) : null;

(async () => {
  const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  async function open(w, h, touch, dsf) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch, deviceScaleFactor: dsf || 1 }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/pretendard|net::ERR|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
    await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html'); await p.waitForTimeout(150);
    return { ctx, p };
  }
  const overflow = p => p.evaluate(() => { const s = document.querySelector('.screen.active'); return { sh: s.scrollHeight, ch: s.clientHeight, sw: s.scrollWidth, cw: s.clientWidth }; });
  const st = p => p.evaluate(() => { const g = DG_APP.g; return { phase: g.phase, prog: DG.engine.progress(g), dmg: g.damage, x: g.tip.x, y: g.tip.y, t: g.time, exits: g.exits, scr: window.scrollY }; });

  // 모양 시작: 직접 그리기는 그리기 화면에서 하트 모양 선을 입력하고 [완료]
async function startShape(p, id) {
  await p.tap('.shape-cell[data-id="' + id + '"]'); await p.tap('#btn-play'); await p.waitForTimeout(150);
  if (id !== 'custom') return;
  await p.waitForSelector('#screen-draw.active');
  await p.evaluate(() => { const o = []; for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 120 + 25 * Math.cos(3 * t); o.push([300 + r * Math.cos(t), 300 + r * Math.sin(t)]); } DG.draw._set(o); });
  await p.tap('#btn-draw-done'); await p.waitForTimeout(150);
}
console.log('[1] PC 흐름 · 키보드');
  let { ctx, p } = await open(1280, 800);
  await shot(p, '01_intro');
  ok(!(await p.locator('#btn-how').count()) && !(await p.locator('.intro-copy').count()) && await p.textContent('#btn-start') === '시작하기' && await p.textContent('h1') === '한 번에 뽑으세요', '메인: 서브카피·게임 방법 없음, 시작하기');
  await p.click('#btn-start'); ok(await p.isVisible('#screen-select'), '모양 선택 화면');
  ok(await p.locator('.shape-cell').count() === 4, '모양 4종'); await shot(p, '03_select');
  await p.click('.shape-cell[data-id="star"]'); await p.click('#btn-play'); await p.waitForTimeout(200);
  ok(await p.textContent('#hud-name') === '별', 'HUD 도형 이름'); await shot(p, '04_play_start');
  const s0 = await st(p);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
  const s1 = await st(p); ok(s1.x > s0.x + 40 && s1.dmg === 0 && s1.prog === s0.prog, '방향키 이동 — 긁지 않으면 진행·균열 불변', { s0, s1 });
  await p.keyboard.press('ArrowDown'); const s2 = await st(p);
  ok(Math.abs(s2.scr) === 0, '방향키/스페이스가 스크롤을 일으키지 않음');
  const a = await st(p); await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(40); await p.keyboard.up('ArrowLeft'); const a2 = await st(p);
  ok(a.x - a2.x > 0 && a.x - a2.x < 12, '방향키 짧게 누르면 미세 이동', a.x - a2.x);
  await p.keyboard.down('Space'); await p.keyboard.down('ArrowDown'); await p.waitForTimeout(600); await p.keyboard.up('ArrowDown'); await p.keyboard.up('Space');
  const s3 = await st(p); ok(s3.dmg > 0, '선 밖에서 긁으면 균열 증가', s3.dmg);
  await shot(p, '05_play_crack');
  await p.keyboard.press('r'); await p.waitForTimeout(100);
  const s4 = await st(p); ok(s4.dmg === 0 && s4.prog === 0 && s4.t === 0 && s4.exits === 0 && s4.phase === 'play', 'R 재시작 — 긁힘·균열·시간 초기화', s4);
  ok(await p.evaluate(() => document.getElementById('bar-crack').style.width) === '0%' && await p.textContent('#hud-prog') === '0%', 'HUD 도 초기화');
  await p.keyboard.down('Space'); await p.keyboard.down('ArrowLeft'); await p.waitForFunction(() => DG_APP.g.phase === 'lost', null, { timeout: 15000 }); await p.keyboard.up('ArrowLeft'); await p.keyboard.up('Space');
  await shot(p, '06_breaking'); await p.waitForTimeout(700); await shot(p, '07_breaking_late');
  await p.waitForSelector('#screen-result.active', { timeout: 8000 }); await p.waitForTimeout(200);
  ok(await p.textContent('#result-score') === '0점' && !(await p.locator('#result-title').count()), '파손 → 결과 화면(실패 · 0점 · 별도 큰 제목 없음)'); await shot(p, '08_result_fail');
  ok(/^정확도 \d+% · 균열 \d+% · 소요 시간 \d+초$/.test(await p.textContent('#result-detail')), '결과 상세 한 줄: ' + await p.textContent('#result-detail'));
  await ctx.close();

  console.log('[2] 성공 경로 — 실제 입력 경로(방향키 8방향 + SPACE)로 경로 추적');
  ({ ctx, p } = await open(1280, 800));
  await p.click('#btn-start'); await p.click('.shape-cell[data-id="triangle"]'); await p.click('#btn-play'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.getElementById('btn-pull').disabled), '덜 긁으면 [뽑기] 비활성');
  await p.keyboard.press('Enter'); ok((await st(p)).phase === 'play', '덜 긁고 ENTER → 무시');
  await p.keyboard.down('Space');
  const done = await p.evaluate(async () => {
    const g = DG_APP.g, n = g.n; let idx = 0, guard = 0;
    const press = (k, v) => DG.input.press(k, v);
    while (DG.engine.progress(g) < 0.995 && g.phase === 'play' && guard++ < 6000) {
      const tx = g.px[(idx + 3) % n], ty = g.py[(idx + 3) % n], gx = tx - g.tip.x, gy = ty - g.tip.y;
      press('ArrowLeft', gx < -0.8); press('ArrowRight', gx > 0.8); press('ArrowUp', gy < -0.8); press('ArrowDown', gy > 0.8);
      await new Promise(r => setTimeout(r, 16));
      if (Math.hypot(tx - g.tip.x, ty - g.tip.y) < 5) idx = (idx + 1) % n;
    }
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].forEach(k => press(k, false));
    return { phase: g.phase, prog: DG.engine.progress(g), dmg: g.damage };
  });
  await p.keyboard.up('Space');
  ok(done.phase === 'play' && done.prog >= 0.995, '100% 긁기 성공', done);
  ok(!(await p.evaluate(() => document.getElementById('btn-pull').disabled)), '충분히 긁으면 [뽑기] 활성'); await shot(p, '09_play_ready');
  await p.keyboard.press('Enter'); await p.waitForTimeout(350); await shot(p, '10_separating'); await p.waitForTimeout(500); await shot(p, '11_separating_late');
  await p.waitForSelector('#screen-result.active', { timeout: 8000 }); await p.waitForTimeout(200);
  const sc = await p.textContent('#result-score'); ok(/^\d+점$/.test(sc), '성공 결과 점수: ' + sc);
  console.log('     ', await p.textContent('#result-grade'), '|', await p.textContent('#result-detail'));
  await shot(p, '12_result_win');
  await p.click('#btn-again'); await p.waitForTimeout(150);
  const r = await st(p); ok(r.prog === 0 && r.dmg === 0 && r.phase === 'play', '다시 도전 — 완전 초기화', r);
  await ctx.close();

  console.log('[3] 모바일 세로 · 멀티터치');
  ({ ctx, p } = await open(390, 844, true, 2));
  await shot(p, 'm01_intro'); await p.tap('#btn-start'); await shot(p, 'm02_select');
  await p.tap('.shape-cell[data-id="triangle"]'); await p.tap('#btn-play'); await p.waitForTimeout(200); await shot(p, 'm03_play');
  ok(await p.isVisible('.controls') && (await p.isVisible('#btn-pull')) && (await p.isVisible('#btn-restart')), '터치 기기: 가상 조작 표시');
  const geo = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const c = r('#stage-canvas'), d = r('.dpad'), a = r('.actions'), h = r('.stats'); return { cv: [c.width, c.height, c.top, c.bottom], dpad: [d.top, d.bottom, d.left, d.right], act: [a.left, a.right], hud: h.bottom, vh: innerHeight, vw: innerWidth }; });
  ok(Math.abs(geo.cv[0] - geo.cv[1]) < 1.5, '달고나 캔버스 정사각형', geo.cv); ok(geo.cv[3] <= geo.dpad[0] && geo.dpad[1] <= geo.vh, '조작부가 달고나와 겹치지 않고 화면 안', geo);
  ok(geo.act[0] - geo.dpad[3] >= 12, '방향 버튼과 긁기 버튼 사이 간격 확보', geo.act[0] - geo.dpad[3]);
  const ov = await overflow(p); ok(ov.sh <= ov.ch + 1 && ov.sw <= ov.cw + 1, '플레이 화면 스크롤 없음', ov);
  const cdp = await ctx.newCDPSession(p);
  const center = s => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s);
  const dirC = await center('[data-dir="right"]'), scrC = await center('[data-act="scratch"]');
  const m0 = await st(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dirC[0], y: dirC[1], id: 1 }, { x: scrC[0], y: scrC[1], id: 2 }] });
  await p.waitForTimeout(500);
  const down = await p.evaluate(() => [...document.querySelectorAll('.is-down')].map(e => e.dataset.dir || e.dataset.act));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const m1 = await st(p); await p.waitForTimeout(60); const m2 = await st(p);
  ok(down.includes('right') && down.includes('scratch'), '두 손가락 동시 입력(방향+긁기) 인식', down);
  ok(m1.x > m0.x + 20, '터치로 바늘 이동', [m0.x, m1.x]); ok(Math.abs(m2.x - m1.x) < 0.5, '손가락 떼면 정지(관성 없음)');
  const ov2 = await p.evaluate(() => document.querySelectorAll('.is-down').length); ok(ov2 === 0, '손 떼면 버튼 눌림 해제');
  await p.tap('#btn-restart'); await p.waitForTimeout(100); ok((await st(p)).t === 0, '다시 시작 버튼');
  await ctx.close();

  console.log('[4] 반응형 오버플로(화면 × 화면)');
  const VPS = [[320, 568], [375, 667], [360, 640], [390, 844], [430, 932], [768, 1024], [1280, 800], [844, 390], [932, 430], [667, 375]];
  for (const [w, h] of VPS) {
    const touch = w < 1000; ({ ctx, p } = await open(w, h, touch));
    const bad = [];
    const chk = async name => { const o = await overflow(p); if (o.sh > o.ch + 1 || o.sw > o.cw + 1) bad.push(name + JSON.stringify(o)); };
    const land = w > h && h <= 520; const chk0 = chk; const chkS = land ? async () => {} : chk;
    const top = s => p.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().top * 10) / 10, s), tops = {};
    const meas = id => p.evaluate((id) => { const s = document.getElementById('screen-' + id), kids = [...s.children].filter(e => e.getBoundingClientRect().height > 0), f = kids[0].getBoundingClientRect(), l = kids[kids.length - 1].getBoundingClientRect(), v = s.querySelector('.slot-visual').getBoundingClientRect(), bs = [...s.querySelectorAll('.cta,.btn-secondary')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0); return { cy: (f.top + l.bottom) / 2, vcx: (v.left + v.right) / 2, vl: v.left, vr: v.right, vw: v.width, bl: Math.min(...bs.map(r => r.left)), br: Math.max(...bs.map(r => r.right)), h: innerHeight, w: innerWidth, over: s.scrollHeight > s.clientHeight + 1, top: f.top, bot: l.bottom }; }, id), M = {};
    await chkS('intro'); M.intro = await meas('intro'); await p.click('#btn-start'); await chkS('select'); M.select = await meas('select'); await p.click('#btn-play'); await p.waitForTimeout(120); { const o = await overflow(p); if (o.sw > o.cw + 1) bad.push('play 가로 스크롤 ' + JSON.stringify(o)); }
    const geo2 = await p.evaluate(() => { const r = document.querySelector('#stage-canvas').getBoundingClientRect(); return [r.width, r.height]; });
    if (geo2[0] < 120 || geo2[1] > geo2[0] + 1.5 || (!touch && Math.abs(geo2[0] - geo2[1]) > 1.5)) bad.push('canvas' + JSON.stringify(geo2));
    if (touch) {
      const e = await p.evaluate(() => { const c = document.querySelector('#stage-canvas').getBoundingClientRect(), ctl = [...document.querySelectorAll('.dpad,.actions')].map(x => x.getBoundingClientRect()); return ctl.some(r => r.width > 0 && !(r.right <= c.left + 1 || r.left >= c.right - 1 || r.bottom <= c.top + 1 || r.top >= c.bottom - 1)) || ctl.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1); });
      if (e) bad.push('controls overlap/out');
    }
    if (!land && w >= 340) {                                  // 게임 화면: 같은 좌우선 · 가로폭 최대 활용 · 요소 순서
      const m = await p.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(b.top), Math.round(b.bottom)]; }; return { stats: r('.stats'), hint: r('.hint'), cv: r('#stage-canvas'), help: r('.help-row'), btn: r('#btn-restart'), pad: r('.controls') }; });
      const want = Math.min(w - 40, 320), cvw = m.cv[1] - m.cv[0];
      if ((cvw >= 319 && (Math.abs(m.stats[0] - m.cv[0]) > 1 || Math.abs(m.stats[1] - m.cv[1]) > 1 || Math.abs(m.help[0] - m.cv[0]) > 1 || Math.abs(m.help[1] - m.cv[1]) > 1)) || (m.pad[1] > 0 && (Math.abs(m.pad[0] - m.stats[0]) > 1 || Math.abs(m.pad[1] - m.stats[1]) > 1)) || Math.abs(m.help[0] - m.stats[0]) > 1 || Math.abs(m.help[1] - m.stats[1]) > 1) bad.push('좌우선 불일치 ' + JSON.stringify(m));
      else if (m.cv[3] - m.cv[2] > cvw + 1 || cvw > want + 1) bad.push('캔버스 크기 ' + JSON.stringify(m.cv));
      else if (!(m.stats[3] <= m.hint[2] && m.hint[3] <= m.cv[2] && m.cv[3] <= m.help[2])) bad.push('요소 순서/겹침 ' + JSON.stringify(m));
      else if (m.btn[3] - m.btn[2] < 43 || m.btn[1] > m.stats[1] + 1) bad.push('다시 시작 버튼 ' + JSON.stringify(m.btn));
      else console.log('     play', w + '×' + h, '캔버스', Math.round(cvw) + 'px(최대 ' + want + ')', '카드 상단', m.stats[2], '좌우', m.cv[0], '/', w - m.cv[1]);
    }
    if (touch && !land) {                                       // 모바일 십자키 · 정렬 · 순서
      const G = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect().toJSON(); return { q: ['up', 'left', 'right', 'down'].map(d => { const b = document.querySelector('[data-dir="' + d + '"]').getBoundingClientRect(); return { d, l: b.left, t: b.top, w: b.width, h: b.height }; }), dpad: r('.dpad'), act: r('.actions'), stats: r('.stats'), hint: r('.hint'), cv: r('#stage-canvas'), ctl: r('.controls'), help: r('.help-row'), mark: r('.play-mark'), cards: [...document.querySelectorAll('.stat')].map(e => e.getBoundingClientRect().toJSON()), diag: document.querySelectorAll('[data-dir="ul"],[data-dir="ur"],[data-dir="dl"],[data-dir="dr"],.pad-diag').length, nb: document.querySelectorAll('.dpad [data-dir]').length, vw: innerWidth, sw: document.documentElement.scrollWidth, pull: r('#btn-pull'), restart: r('#btn-restart') }; });
      const near = (a, b2, t) => Math.abs(a - b2) <= (t || 0.7), up = G.q[0], lf = G.q[1], rt = G.q[2], dn = G.q[3], mid = (G.dpad.left + G.dpad.right) / 2, e = [];
      if (G.diag || G.nb !== 4) e.push('대각선/버튼 수 ' + G.diag + '/' + G.nb);
      if (!G.q.every(b2 => b2.w >= 44 && near(b2.w, up.w)) || !near(lf.w, lf.h) || !near(rt.w, rt.h) || !near(up.h, dn.h) || up.h < 40 || up.h > lf.h - 3 || !near(lf.h, rt.h)) e.push('방향키 크기(좌우 정사각·위아래는 낮게·폭 동일) ' + JSON.stringify(G.q.map(b2 => [b2.w, b2.h])));
      if (!near(up.l + up.w / 2, mid) || !near(dn.l + dn.w / 2, mid)) e.push('위/아래 키가 중앙축에 없음');
      if (!near(lf.l - G.dpad.left, G.dpad.right - (rt.l + rt.w)) || !near(lf.t, rt.t)) e.push('좌/우 키 대칭 아님');
      if (!near(up.t, G.dpad.top) || !near(dn.t + dn.h, G.dpad.bottom) || !(lf.t > up.t + up.h - 0.5 && dn.t > lf.t + lf.h - 0.5)) e.push('십자 배치');
      if (!near(G.act.height, G.dpad.height, 1) || !near(G.act.top, G.dpad.top, 1) || !near(G.act.bottom, G.dpad.bottom, 1) || G.act.left < G.dpad.right + 8) e.push('긁기 버튼 높이/상하선 ' + JSON.stringify([G.act.height, G.dpad.height, G.act.top, G.dpad.top, G.act.left, G.dpad.right]));
      if (!near((G.dpad.left + G.dpad.right) / 2, (G.restart.left + G.restart.right) / 2, 1) || !near(G.act.right, G.cv.right, 1) || G.dpad.left < G.cv.left - 3.5 || G.act.right > G.cv.right + 0.5 || G.act.width < 100 || G.act.width > 130 || !near(lf.l + lf.w + 3, up.l, 1.5)) e.push('십자키↔다시시작 / 긁기↔뽑기 중심축·폭·간격 ' + JSON.stringify([G.dpad.left, G.act.right, G.cv.left, G.cv.right, G.act.width, lf.l + lf.w, up.l]));
      if (!(G.stats.bottom <= G.hint.top + 0.5 && G.hint.bottom <= G.cv.top + 0.5 && G.cv.bottom <= G.ctl.top + 0.5 && G.ctl.bottom <= G.help.top + 0.5 && G.help.bottom <= G.mark.top + 0.5)) e.push('요소 순서/겹침');
      for (const k of ['stats', 'help']) if (!near(G[k].left, G.stats.left) || !near(G[k].right, G.stats.right)) e.push(k + ' 좌우선 불일치');
      if (G.cv.width >= G.stats.width - 1 && (!near(G.cv.left, G.stats.left) || !near(G.cv.right, G.stats.right))) e.push('달고나/카드 좌우선');
      for (const k of ['cv', 'hint', 'mark']) if (!near(G[k].left + G[k].width / 2, G.vw / 2)) e.push(k + ' 가로 중심');
      if (!near(G.cards[0].width, G.cards[1].width) || !near(G.cards[0].height, G.cards[1].height)) e.push('카드 크기 불일치');
      if (G.hint.height > 22) e.push('안내 문구가 한 줄이 아님 ' + G.hint.height);
      if (G.sw > G.vw + 1) e.push('가로 스크롤');
      if (G.restart.width < 100 || !near(G.restart.width, G.pull.width, 1.5) || !near(G.restart.height, G.pull.height)) e.push('다시시작/뽑기 크기');
      if (e.length) bad.push('모바일 레이아웃: ' + e.join(' | ')); else console.log('     모바일 십자키·정렬 OK', w + '×' + h, '십자', up.w + 'px', '긁기', Math.round(G.act.width) + '×' + Math.round(G.act.height), '달고나', Math.round(G.cv.width));
    }
    await shot(p, `r_${w}x${h}_play`);
    await p.evaluate(() => { const g = DG_APP.g; g.damage = 100; g.phase = 'lost'; g.failAt = { x: 300, y: 300 }; });
    await p.waitForSelector('#screen-result.active', { timeout: 8000 }); await chkS('result'); M.result = await meas('result'); await shot(p, `r_${w}x${h}_result`);
    if (!land) {                                              // 메인·선택·결과: 같은 가로 중심 · 이미지/버튼 좌우선 일치 · 콘텐츠 묶음이 뷰포트 세로 중앙
      for (const k of ['intro', 'select', 'result']) {
        const r = M[k];
        if (Math.abs(r.vcx - r.w / 2) > 0.6) bad.push(k + ' 이미지 가로 중심 ' + r.vcx + ' vs ' + r.w / 2);
        if (Math.abs(r.vl - r.bl) > 0.6 || Math.abs(r.vr - r.br) > 0.6) bad.push(k + ' 이미지/버튼 좌우선 불일치 ' + JSON.stringify([r.vl, r.bl, r.vr, r.br]));
        if (Math.abs(r.vw - M.intro.vw) > 0.6) bad.push(k + ' 이미지 너비 불일치 ' + r.vw + ' vs ' + M.intro.vw);
        if (!r.over && Math.abs(r.cy - r.h / 2) > 1.2) bad.push(k + ' 세로 중앙 아님 ' + r.cy + ' vs ' + r.h / 2);
      }
      if (!bad.length) console.log('     중심·좌우선·세로중앙 일치', w + '×' + h, '묶음 중심y', ['intro', 'select', 'result'].map(k => M[k].over ? '스크롤' : Math.round(M[k].cy)).join(' / '), '이미지 너비', M.intro.vw);
    }
    ok(bad.length === 0, `${w}×${h}${touch ? ' touch' : ''}`, bad);
    await ctx.close();
  }
  console.log('[4b] 메인 ↔ 결과 반복 전환 — 중심축 안정성');
  for (const [w, h] of [[390, 844], [360, 640], [1280, 800]]) {
    ({ ctx, p } = await open(w, h, w < 1000));
    await p.click('#btn-start'); await p.click('#btn-play'); await p.waitForTimeout(100);
    await p.evaluate(() => { const g = DG_APP.g; g.damage = 100; g.phase = 'lost'; g.failAt = { x: 300, y: 300 }; });
    await p.waitForSelector('#screen-result.active', { timeout: 8000 });
    const seq = await p.evaluate(() => {
      const out = [], m = id => { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id)); const s = document.getElementById('screen-' + id), v = s.querySelector('.slot-visual').getBoundingClientRect(), b = s.querySelector('.cta').getBoundingClientRect(); return [id, Math.round((v.left + v.right) * 100) / 200, Math.round(v.left * 10) / 10, Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(v.width * 10) / 10]; };
      for (let i = 0; i < 6; i++) { out.push(m(i % 2 ? 'result' : 'intro')); }
      return out;
    });
    const a = seq.filter(r => r[0] === 'intro'), b2 = seq.filter(r => r[0] === 'result');
    const same = (arr) => arr.every(r => r.slice(1).join() === arr[0].slice(1).join());
    ok(same(a) && same(b2) && a[0][1] === b2[0][1] && a[0][2] === b2[0][2] && a[0][3] === b2[0][3] && a[0][4] === b2[0][4] && a[0][5] === b2[0][5], w + '×' + h + ': 메인↔결과 6회 전환해도 이미지 중심·좌우선·너비가 같고 그대로', [a[0], b2[0]]);
    await ctx.close();
  }
  console.log('[5] 파손 그래픽 · 결과 · 공유 이미지 (4모양 × 성공/실패)');
  for (const id of ['custom', 'triangle', 'star', 'umbrella']) for (const mode of ['win', 'lose']) {
    ({ ctx, p } = await open(390, 844, true, 1));
    await p.tap('#btn-start'); await startShape(p, id);
    const pre = await p.evaluate((mode) => {
      const g = DG_APP.g;
      if (mode === 'win') { for (let i = 0; i < g.n; i++) { g.marked[i] = 1; } g.markedCount = g.n; g.fresh.push(0); g.onLen = 500; return DG.engine.separate(g); }
      g.damage = 100; g.phase = 'lost'; g.failAt = { x: DG.C.CX + 40, y: DG.C.CY - 30 }; return true;
    }, mode);
    await p.waitForSelector('#screen-result.active', { timeout: 9000 }); await p.waitForTimeout(150);
    const A = await p.evaluate(() => {
      const mkc = () => { const c = document.createElement('canvas'); c._fixed = true; c.width = 600; c.height = 600; return c; };
      const stat = (tms) => {
        const c = mkc(); DG.view.debugEnd(c, tms); const d = c.getContext('2d').getImageData(0, 0, 600, 600).data;
        let hole = 0, solid = 0, soft = 0, blob = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) {
          const a = d[(y * 600 + x) * 4 + 3], dist = Math.hypot(x - 300, y - 300);
          if (a >= 250) { solid++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          else if (a > 10) soft++;
          if (dist < 235 && a === 0) hole++;
        }
        const al = (x, y) => d[(y * 600 + x) * 4 + 3], isSoft = (x, y) => { const a = al(x, y); return a > 10 && a < 245; };
        for (let y = 1; y < 599; y++) for (let x = 1; x < 599; x++) { if (!isSoft(x, y)) continue; let all = true; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!isSoft(x + dx, y + dy)) { all = false; break; } if (all) blob++; }
        return { hole, solid, soft, blob, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
      };
      const g = DG_APP.g, sh = g.shape;
      let sx = 0, sy = 0; for (let i = 0; i < sh.n; i++) { sx += sh.px[i]; sy += sh.py[i]; }
      const c0 = mkc(); DG.view.debugEnd(c0, 1e6); const px = c0.getContext('2d').getImageData(Math.round(sx / sh.n), Math.round(sy / sh.n), 1, 1).data[3];
      let url = ''; try { url = share.toDataURL('image/png'); } catch (e) { url = 'ERR ' + e; }
      return { t0: stat(0), end: stat(1e6), centerAlpha: px };
    });
    const nm = id + '/' + mode;
    ok(pre === true || mode === 'lose', nm + ' 결과 상태 진입');
    ok(await p.locator('#btn-share').count() === 0 && await p.locator('#screen-result button:visible').count() === 3, nm + ': 결과 화면 버튼은 3개뿐');
    ok(A.t0.hole < 60 && Math.abs(A.t0.cx - 300) < 2.5 && Math.abs(A.t0.cy - 300) < 2.5 && Math.abs(A.t0.w - 524) < 4, nm + ': 파손 직전 위치·크기 그대로(틈 ' + A.t0.hole + 'px, 중심 ' + A.t0.cx + ',' + A.t0.cy + ', 지름 ' + A.t0.w + ')', A.t0);
    ok(A.end.hole > 300, nm + ': 조각 사이/빈 곳이 알파 0(투명) ' + A.end.hole + 'px');
    ok(A.end.blob < 150, nm + ': 반투명 면(그림자·덧칠) 없음 — 반투명 픽셀은 경계 안티앨리어싱뿐(면적 ' + A.end.blob + 'px)', A.end);
    if (mode === 'win') ok(A.centerAlpha === 255, nm + ': 가운데 도형이 온전히 남음');
    const txt = await p.evaluate(() => ({ score: document.getElementById('result-score').textContent, detail: document.getElementById('result-detail').textContent, ch: document.getElementById('btn-challenge').textContent, a: document.getElementById('btn-again').textContent, b: document.getElementById('btn-change').textContent, grade: document.getElementById('result-grade').textContent }));
    ok(txt.ch === '친구에게 도전장 보내기' && txt.a === '다시 뽑기' && txt.b === '다른 모양 도전' && /^정확도 \d+% · 균열 \d+% · 소요 시간 \d+초$/.test(txt.detail) && txt.grade.length > 0, nm + ': 점수 아래 한 줄 평가·상세·버튼 문구', txt);
    ok(mode === 'win' ? /^\d+점$/.test(txt.score) && txt.score !== '0점' : txt.score === '0점', nm + ': 성공/실패 구분 표시 ' + txt.score);
    if (id === 'umbrella' || id === 'circle') await shot(p, 'x_' + id + '_' + mode + '_result');
    // 결과 버튼 기능
    if (mode === 'lose') {
      await p.tap('#btn-change'); ok(await p.isVisible('#screen-select'), nm + ': [다른 모양] → 선택 화면');
      await p.tap('#btn-play'); await p.waitForTimeout(100);
      if (id === 'custom') { ok(await p.isVisible('#screen-draw'), nm + ': 직접 만들기 → 시작하기는 그리기 화면으로'); await p.evaluate(() => { const o = []; for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 120 + 25 * Math.cos(3 * t); o.push([300 + r * Math.cos(t), 300 + r * Math.sin(t)]); } DG.draw._set(o); }); await p.tap('#btn-draw-done'); await p.waitForTimeout(150); }
      const st2 = await p.evaluate(() => ({ ph: DG_APP.g.phase, dmg: DG_APP.g.damage, prog: DG.engine.progress(DG_APP.g) })); ok(st2.ph === 'play' && st2.dmg === 0 && st2.prog === 0, nm + ': 다시 시작 후 완전 초기화', st2);
    } else {
      await p.tap('#btn-again'); await p.waitForTimeout(100); ok(await p.isVisible('#screen-play') && (await p.evaluate(() => DG_APP.g.phase)) === 'play', nm + ': [다시 도전하기] → 새 판');
    }
    await ctx.close();
  }
  // 진행 UI: 게이지 눈금·수치 크기, 모바일/PC 안내 문구
  ({ ctx, p } = await open(390, 844, true, 1));
  await p.tap('#btn-start'); await p.tap('#btn-play'); await p.waitForTimeout(150);
  const ui = await p.evaluate(() => { const fs = s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize); return { v: fs('#hud-prog'), l: fs('.stat-label'), gh: document.querySelector('.gauge').getBoundingClientRect().height, hint: document.getElementById('hint').textContent }; });
  ok(ui.v >= 24 && ui.gh >= 8, '진행 카드: 수치 ' + ui.v + 'px · 게이지 ' + ui.gh + 'px', ui);
  ok(ui.hint === '긁기를 누른 채 방향키로 움직이세요', '모바일 안내 문구: ' + ui.hint);
  await p.evaluate(() => { const g = DG_APP.g; for (let i = 0; i < g.n; i++) g.marked[i] = 1; g.markedCount = g.n; }); await p.waitForTimeout(200);
  ok((await p.textContent('#hint')) === '뽑기 가능! 뽑기를 눌러주세요', '뽑기 가능 조건 → 짧은 안내 메시지');
  await ctx.close();
  ({ ctx, p } = await open(1280, 800)); await p.click('#btn-start'); await p.click('#btn-play'); await p.waitForTimeout(150);
  ok((await p.textContent('#hint')) === 'SPACE를 누른 채 방향키로 조절하세요', 'PC 안내 문구'); await ctx.close();
  console.log('[6] 도전장 — 링크 만들기 · 열기 · 도전 · 대결 결과');
  for (const [id, mode] of [['umbrella', 'win'], ['star', 'lose'], ['custom', 'win'], ['triangle', 'lose']]) {
    ({ ctx, p } = await open(390, 844, true, 1));
    let copied = '';
    p.on('dialog', async d => { copied = d.defaultValue(); await d.accept(); });
    await p.addInitScript(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) { /* 무시 */ } try { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; } catch (e) { /* 무시 */ } });
    await p.reload(); await p.waitForTimeout(200);
    await p.evaluate(() => { try { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; } catch (e) { /* 무시 */ } });
    await p.tap('#btn-start'); await startShape(p, id);
    await p.evaluate((mode) => { const g = DG_APP.g; if (mode === 'win') { for (let i = 0; i < g.n; i++) g.marked[i] = 1; g.markedCount = g.n; g.onLen = 500; g.damage = 12; g.time = 31; DG.engine.separate(g); } else { g.damage = 100; g.phase = 'lost'; g.failAt = { x: 330, y: 270 }; g.markedCount = Math.round(g.n * 0.4); for (let i = 0; i < g.markedCount; i++) g.marked[i] = 1; } }, mode);
    await p.waitForSelector('#screen-result.active', { timeout: 9000 }); await p.waitForTimeout(150);
    const mine = await p.evaluate(() => ({ score: DG_APP.lastResult.score, won: DG_APP.lastResult.won, shape: DG_APP.lastShape }));
    await p.tap('#btn-challenge'); await p.waitForSelector('#modal:not(.hidden)'); ok(true, id + '/' + mode + ': [도전장 보내기] → 닉네임 입력창');
    await p.fill('#modal-input', '테스터'); await p.tap('#modal-ok'); await p.waitForTimeout(300);
    const text = await p.evaluate(() => window.__copied || '');
    const link = ((text || copied).match(/\S*#battle\/v1\.\S+/) || [''])[0];
    ok(link.includes('#battle/v1.') && /테스터|잘할 수 있어/.test(text || copied) , id + '/' + mode + ': 도전장 링크·문구 복사 — ' + (text || copied).split('\n')[1]);
    ok((await p.textContent('#challenge-note')).includes('이 PC에서만') && await p.isVisible('#challenge-note'), id + '/' + mode + ': file:// 안내 표시');
    ok(!(await p.isVisible('#modal')), '닉네임 창 닫힘');
    const tok = link.split('#battle/')[1];
    const rt = await p.evaluate((t) => { const r = DG.battle.parseToken(t); return r && { n: r.nickname, shape: r.shape, won: r.won, score: r.score, seed: r.seed }; }, tok);
    ok(rt && rt.n === '테스터' && rt.shape === id && rt.won === (mode === 'win') && Math.abs(rt.score - mine.score) < 0.06, id + '/' + mode + ': 토큰 왕복(닉네임·모양·성공/실패·점수)', rt);
    await ctx.close();

    // 링크 열기 → 도전장 화면
    ({ ctx, p } = await open(390, 844, true, 1));
    await p.goto('about:blank'); await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html#battle/' + tok); await p.waitForTimeout(900);
    ok(await p.isVisible('#screen-challenge') && !(await p.isVisible('#screen-intro')), id + '/' + mode + ': 링크로 열면 도전장 화면(인트로 건너뜀)');
    ok((await p.textContent('#challenge-name')).includes('테스터') && /^\d+점$/.test(await p.textContent('#challenge-score')), id + '/' + mode + ': 친구 이름·점수 표시 ' + await p.textContent('#challenge-score'));
    const pix = await p.evaluate(() => { const c = document.getElementById('challenge-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 40) { const v = d[i] + d[i + 1] + d[i + 2]; mn = Math.min(mn, v); mx = Math.max(mx, v); } return { w: c.width, h: c.height, spread: mx - mn }; });
    ok(pix.w > 100 && pix.spread > 200, id + '/' + mode + ': 친구의 최종 모습이 그려짐', pix);
    await shot(p, 'c_' + id + '_' + mode + '_challenge');
    await p.tap('#btn-challenge-start'); await p.waitForTimeout(200);
    ok(await p.isVisible('#screen-play') && (await p.textContent('#hud-name')) === (await p.evaluate((i) => DG.SHAPES[i].name, id)), id + '/' + mode + ': 도전 시작 → 친구와 같은 모양으로 플레이');
    // 내 기록: 성공(만점 근처) → 대결 결과
    await p.evaluate(() => { const g = DG_APP.g; for (let i = 0; i < g.n; i++) g.marked[i] = 1; g.markedCount = g.n; g.onLen = 500; g.damage = 5; g.time = 15; DG.engine.separate(g); });
    await p.waitForSelector('#screen-battle.active', { timeout: 9000 }); await p.waitForTimeout(200);
    const vs = await p.evaluate(() => ({ a: document.getElementById('vs-a-score').textContent, b: document.getElementById('vs-b-score').textContent, w: document.getElementById('vs-winner').textContent, an: document.getElementById('vs-a-name').textContent }));
    const expect = (+vs.b > +vs.a) ? '이겼어요!' : (+vs.b < +vs.a ? '졌어요…' : '무승부예요');
    ok(vs.an === '테스터' && vs.w === expect && +vs.a === Math.round(rt.won ? rt.score : 0), id + '/' + mode + ': 대결 결과 ' + vs.a + ' VS ' + vs.b + ' → ' + vs.w, vs);
    await shot(p, 'c_' + id + '_' + mode + '_battle');
    await p.tap('#btn-vs-detail'); ok(await p.isVisible('#screen-result'), id + '/' + mode + ': [내 결과 자세히 보기] → 결과 화면');
    await p.tap('#btn-again'); await p.waitForTimeout(150);
    ok(await p.isVisible('#screen-play') && (await p.textContent('#hud-name')) === (await p.evaluate((i) => DG.SHAPES[i].name, id)), id + '/' + mode + ': 결과 화면 [다시 뽑기] → 같은 모양으로 재도전');
    await ctx.close();
  }
  ({ ctx, p } = await open(390, 844, true, 1));
  await p.goto('about:blank'); await p.goto('file:///' + ROOT.split(path.sep).join('/') + '/index.html#battle/v1.broken'); await p.waitForTimeout(500);
  ok(await p.isVisible('#screen-intro') && await p.isVisible('#toast'), '잘못된 도전장 링크: 안내 후 인트로로'); await ctx.close();
  ok(errs.length === 0, '콘솔/페이지 오류 없음', errs);
  await b.close();
  console.log(`\n${pass} PASS / ${fail} FAIL`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
