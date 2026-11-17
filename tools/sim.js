// 엔진 단위 검증: node tools/sim.js  — 자동조종으로 모양별 판정·점수 범위를 확인한다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {}, Math, Float32Array, Uint8Array, console }; ctx.window = ctx; vm.createContext(ctx);
['config', 'paths', 'shapes', 'engine'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'src/game', f + '.js'), 'utf8'), ctx));
const DG = ctx.DG, E = DG.engine;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 경로 추적 자동조종: wobble = 선에서 벗어나려는 최대 진폭(u), 방향키 8방향만 쓴다(실제 입력과 동일)
function run(id, wobble, seed, opts) {
  opts = opts || {};
  const g = E.create(id, seed), r = rng(seed + 7), n = g.n;
  let idx = 0, off = 0, offV = 0, t = 0, frames = 0;
  while (g.phase === 'play' && frames < 60 * 240) {
    const tx = g.px[(idx + 3) % n] + 0, ty = g.py[(idx + 3) % n];
    // 목표점(경로 앞쪽) + 법선방향 흔들림
    offV += (r() - 0.5) * 0.9; offV *= 0.96; off = Math.max(-wobble, Math.min(wobble, off + offV));
    const nx = -(g.py[(idx + 4) % n] - g.py[idx]), ny = g.px[(idx + 4) % n] - g.px[idx], nl = Math.hypot(nx, ny) || 1;
    const gx = tx + nx / nl * off - g.tip.x, gy = ty + ny / nl * off - g.tip.y;
    const dx = Math.abs(gx) > 0.8 ? Math.sign(gx) : 0, dy = Math.abs(gy) > 0.8 ? Math.sign(gy) : 0;
    E.step(g, 1 / 60, { dx, dy, scratch: true });
    if (Math.hypot(g.px[(idx + 3) % n] - g.tip.x, g.py[(idx + 3) % n] - g.tip.y) < 5) idx = (idx + 1) % n;
    frames++;
    if (E.progress(g) >= (opts.stopAt || 0.999)) break;
  }
  E.settleLoss(g);
  if (g.phase === 'play') E.separate(g);
  return g;
}

for (const id of DG.SHAPE_ORDER) {
  const s = DG.SHAPES[id];
  console.log(`\n[${id}] n=${s.n} 길이=${s.length.toFixed(0)}u 시작=(${s.px[0].toFixed(0)},${s.py[0].toFixed(0)})`);
  const perfect = run(id, 0, 1), sloppy = run(id, 12, 2), wild = run(id, 26, 3);
  const f = g => `${g.phase} 진행 ${(E.progress(g) * 100).toFixed(1)}% 균열 ${g.damage.toFixed(0)} 이탈 ${g.exits} 시간 ${g.time.toFixed(1)}s 점수 ${g.result && g.result.score}`;
  console.log('  정밀 :', f(perfect)); console.log('  보통 :', f(sloppy)); console.log('  거칠게:', f(wild));
  ok(perfect.phase === 'won' && perfect.result.score >= 90, `${id}: 정밀 추적은 성공·고득점`);
  ok(wild.damage > sloppy.damage || wild.phase === 'lost', `${id}: 거칠수록 균열이 더 큼`);
  // 선 밖(도형 중심)을 계속 긁으면 파손
  const g = E.create(id, 9); for (let i = 0; i < 60 * 30 && g.phase === 'play'; i++) E.step(g, 1 / 60, { dx: i % 120 < 60 ? 1 : -1, dy: 0.0, scratch: true });
  ok(g.phase === 'lost', `${id}: 엉뚱한 곳을 긁으면 파손(${g.damage.toFixed(0)})`);
  // 긁지 않고 이동만: 진행·균열 불변
  const h = E.create(id, 4); for (let i = 0; i < 300; i++) E.step(h, 1 / 60, { dx: 1, dy: 1, scratch: false });
  ok(h.damage === 0 && h.markedCount === 0, `${id}: 스페이스 안 누르면 아무 일 없음`);
  // 같은 곳 반복 긁기 시 진행률은 중복 증가 안 함
  const k = E.create(id, 5); for (let i = 0; i < 120; i++) E.step(k, 1 / 60, { dx: 0, dy: 0, scratch: true }); const m0 = k.markedCount;
  for (let i = 0; i < 120; i++) E.step(k, 1 / 60, { dx: 0, dy: 0, scratch: true });
  ok(k.markedCount === m0, `${id}: 같은 곳 반복 긁기는 진행 중복 없음`);
  // 뽑기: 덜 긁었으면 불가
  ok(E.separate(E.create(id, 6)) === false, `${id}: 덜 긁으면 뽑기 불가`);
  // 대각선 속도 정규화
  const d1 = E.create(id, 1), d2 = E.create(id, 1); const x0 = d1.tip.x, y0 = d1.tip.y;
  for (let i = 0; i < 20; i++) { E.step(d1, 1 / 60, { dx: 0, dy: 1, scratch: false }); E.step(d2, 1 / 60, { dx: 1, dy: 1, scratch: false }); }
  ok(Math.abs(Math.hypot(d1.tip.x - x0, d1.tip.y - y0) - Math.hypot(d2.tip.x - x0, d2.tip.y - y0)) < 0.5, `${id}: 대각선 속도 = 직선 속도`);
}
console.log(fail ? `\n${fail}건 실패` : '\n전부 통과'); process.exit(fail ? 1 : 0);
