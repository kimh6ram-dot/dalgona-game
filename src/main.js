/* 화면 흐름 · 게임 루프 배선. 판정은 DG.engine, 그리기는 DG.view, 입력은 DG.input, 도전장은 DG.battle. */
(function () {
  'use strict';
  var DG = window.DG, E = DG.engine, V = DG.view, I = DG.input, C = DG.C, B = DG.battle;
  var $ = function (id) { return document.getElementById(id); };
  var app = { shape: 'triangle', customPts: null, lastCustom: null, g: null, screen: 'intro', last: 0, raf: 0, resultShown: false, lastResult: null, challenge: null };
  var el = {}, D = DG.draw;

  function show(name) {
    app.screen = name;
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i].id === 'screen-' + name);
    I.enable(name === 'play');
    document.body.classList.toggle('is-play', name === 'play');
    if (name === 'intro') requestAnimationFrame(drawIntro);
    if (name === 'select') requestAnimationFrame(drawSelect);
    if (name === 'challenge' || name === 'battle') requestAnimationFrame(redrawVisuals);
    if (name === 'play') { cancelAnimationFrame(app.raf); app.last = 0; app.raf = requestAnimationFrame(loop); }
  }
  function toast(msg) { el.toast.textContent = msg; el.toast.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.toast.hidden = true; }, 2200); }

  // ---------- 인트로 / 선택 ----------
  function drawIntro() { if (app.screen === 'intro') V.previewDisc($('intro-canvas'), 'circle', 0, true); }
  function buildSelect() {
    var grid = $('shape-grid'); grid.innerHTML = '';
    DG.SELECT_ORDER.forEach(function (id) {
      var sh = id === 'custom' ? DG.CUSTOM_INFO : DG.SHAPES[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'shape-cell'; b.dataset.id = id;
      b.innerHTML = '<canvas></canvas><span class="shape-text"><span class="shape-name">' + sh.name + '</span><span class="shape-diff">' + sh.diff + '</span></span>';
      b.addEventListener('click', function () { app.shape = id; markSelected(); drawSelect(); });
      grid.appendChild(b);
    });
    markSelected();
  }
  function markSelected() {
    var cells = document.querySelectorAll('.shape-cell');
    for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('is-selected', cells[i].dataset.id === app.shape);
  }
  function drawSelect() {
    if (app.screen !== 'select') return;
    var cells = document.querySelectorAll('.shape-cell');
    for (var i = 0; i < cells.length; i++) { var cv = cells[i].querySelector('canvas'); if (cells[i].dataset.id === 'custom') V.blankDisc(cv, true); else V.previewDisc(cv, cells[i].dataset.id, 0, false, true); }   // 직접 그리기 카드 = 빈 달고나 에셋
    if (app.shape === 'custom') V.blankDisc($('select-canvas'), false); else V.previewDisc($('select-canvas'), app.shape, 0, false);
  }

  // ---------- 직접 그리기 ----------
  function openDraw() {
    $('draw-msg').textContent = '';
    show('draw');
    requestAnimationFrame(function () { D.reset(); });
  }
  function finishDraw() {
    var r = D.finish();
    if (!r.ok) { $('draw-msg').textContent = r.msg; return; }
    app.customPts = r.pts; DG.setCustom(r.pts);
    startGame();
  }

  // ---------- 플레이 ----------
  function startGame() {
    if (app.challenge) app.shape = app.challenge.shape;                    // 도전 중이면 친구와 같은 모양
    if (app.shape === 'custom') { var cp = app.challenge ? app.challenge.custom : app.customPts; if (!cp) { show('select'); return; } DG.setCustom(cp); }   // 직접 그린 도안(친구 도안이면 그 도안)
    I.reset(); V.clearEnd(); V.resetFx();
    app.g = E.create(app.shape); app.resultShown = false; app.endT = 0;
    el.hudName.textContent = app.g.shape.name;
    setHud(true);
    show('play');
  }
  var shown = {};
  function setHud(force) {
    var g = app.g, p = Math.min(100, Math.floor(E.progress(g) * 100)), c = Math.round(g.damage), rdy = E.ready(g);
    if (force || shown.p !== p) { shown.p = p; el.hudProg.textContent = p + '%'; el.barProg.style.width = p + '%'; }
    if (force || shown.c !== c) { shown.c = c; el.hudCrack.textContent = c + '%'; el.barCrack.style.width = c + '%'; }
    var tch = document.body.classList.contains('touch');
    if (force || shown.r !== rdy || shown.t !== tch) {
      shown.r = rdy; shown.t = tch; el.pull.disabled = !rdy; el.pull.classList.toggle('is-ready', rdy);
      el.hint.textContent = rdy ? '뽑기 가능! 뽑기를 눌러주세요' : (tch ? '긁기를 누른 채 방향키로 움직이세요' : 'SPACE를 누른 채 방향키로 조절하세요');   // PC / 모바일 조작법을 따로
      el.hint.classList.toggle('is-ready', rdy);
    }
  }
  function doSeparate() { if (app.screen === 'play' && app.g && !V.isEnding()) E.separate(app.g); }
  function loop(ts) {
    if (app.screen !== 'play') return;
    var dt = app.last ? Math.min(0.033, (ts - app.last) / 1000) : 0.016; app.last = ts;
    var g = app.g;
    if (g.phase === 'play') { E.step(g, dt, I.read()); setHud(false); }
    if (g.phase !== 'play' && !V.isEnding()) { E.settleLoss(g); I.reset(); V.beginEnd(g); setHud(false); el.hint.textContent = g.phase === 'won' ? '뽑았다!' : '와장창…'; }
    var t = V.tickEnd(dt * 1000);
    V.render($('stage-canvas'), g, dt);
    if (V.isEnding() && V.endDone(t) && !app.resultShown) { app.resultShown = true; app.lastResult = g.result; app.lastShape = g.id; app.lastCustom = g.id === 'custom' ? (app.challenge ? app.challenge.custom : app.customPts) : null; if (app.challenge) showBattle(); else showResult(); return; }
    app.raf = requestAnimationFrame(loop);
  }

  // ---------- 결과 (사과 깎기 결과 화면과 같은 구조: 이미지 → 제목 → 점수 → 한 줄 평가 → 상세 한 줄 → 도전장 / 보조 2개 → 워터마크) ----------
  function showResult(again) {
    var r = app.lastResult;
    show('result');
    requestAnimationFrame(function () { V.snapshot($('result-canvas')); });
    var sc = $('result-score');
    sc.innerHTML = r.won ? Math.round(r.score) + '<span class="unit">점</span>' : '0<span class="unit">점</span>';
    $('result-grade').textContent = r.title;
    $('result-sub').textContent = r.comment || '';
    $('result-detail').textContent = '정확도 ' + Math.round(r.accuracy) + '% · 균열 ' + r.damage + '% · 소요 시간 ' + Math.round(r.time) + '초';
    $('challenge-note').hidden = true;
    showCrowd(r, again);
  }
  // 점수별 관중 실루엣(전경). 등급 판정과 같은 점수 기준 · 성공이면서 50점 미만은 두 명, 실패는 없음. 50점 이상이면 yeah 효과음. 400ms 슬라이드 업 1회
  function showCrowd(r, again) {
    var img = $('result-crowd'), id = r.score >= 90 ? '90' : r.score >= 75 ? '75' : r.score >= 50 ? '50' : '00';
    img.classList.remove('rise'); img.classList.toggle('still', id === '00');
    if (!r.won) { img.removeAttribute('src'); img.hidden = true; return; }          // 실패: 관중 없음
    img.hidden = false; img.src = 'assets/crowd_' + id + '.png';
    void img.offsetWidth; img.classList.add('rise');
    if (r.score >= 50 && yeah && !again) { try { yeah.currentTime = 0; var pr = yeah.play(); if (pr && pr.catch) pr.catch(function () { /* 자동재생 차단 시 무시 */ }); } catch (e) { /* 무시 */ } }
  }
  var yeah = null; try { yeah = new Audio('assets/yeah_sfx.mp3'); yeah.preload = 'auto'; yeah.volume = 0.8; } catch (e) { yeah = null; }

  // ---------- 도전장 (문서: MINIGAME_SYSTEM §22 · 사과 깎기/썰기의 battle.js·share.js 방식) ----------
  function askNickname() {
    return new Promise(function (resolve) {
      var modal = $('modal'), input = $('modal-input'), okB = $('modal-ok'), noB = $('modal-cancel'), last = '';
      try { last = localStorage.getItem('dalgona_nick') || ''; } catch (e) { /* 무시 */ }
      modal.classList.remove('hidden'); input.value = last;
      setTimeout(function () { try { input.focus(); input.select(); } catch (e) { /* 무시 */ } }, 50);
      function done(v) { modal.classList.add('hidden'); okB.removeEventListener('click', ok); noB.removeEventListener('click', cancel); input.removeEventListener('keydown', key); resolve(v); }
      function ok() { var v = (input.value || '').trim() || '친구'; try { localStorage.setItem('dalgona_nick', v); } catch (e) { /* 무시 */ } done(v); }
      function cancel() { done(null); }
      function key(e) { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); e.stopPropagation(); }
      okB.addEventListener('click', ok); noB.addEventListener('click', cancel); input.addEventListener('keydown', key);
    });
  }
  function isTouch() { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } }
  function sendChallenge() {
    var r = app.lastResult; if (!r) return Promise.resolve('disabled');
    return askNickname().then(function (nick) {
      if (nick == null) return 'cancelled';
      var url = B.buildUrl(B.makeToken({ nickname: nick, shape: app.lastShape, result: r, custom: app.lastCustom }));
      var text = DG.SHARE.CHALLENGE.replace('{shape}', DG.SHAPES[app.lastShape].name).replace('{score}', String(r.won ? Math.round(r.score) : 0)), data = { title: DG.SHARE.TITLE, text: text, url: url };
      function copy() {
        var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(DG.SHARE.TITLE + '\n' + text + '\n' + url) : Promise.reject(new Error('no clipboard'));
        return p.then(function () { toast('도전장 링크를 복사했어요'); return 'copied'; }, function () { try { window.prompt('도전장 링크를 복사하세요', url); } catch (x) { /* 무시 */ } toast('복사하지 못했어요'); return 'failed'; });
      }
      if (isTouch() && navigator.share) return navigator.share(data).then(function () { return 'shared'; }, function (e) { if (e && e.name === 'AbortError') return 'cancelled'; return copy(); });
      return copy();
    });
  }
  function onChallengeClick() {
    if (onChallengeClick.busy) return; onChallengeClick.busy = true;
    if (B.isLocal()) { $('challenge-note').textContent = '지금은 파일로 열려 있어, 만든 링크가 이 PC에서만 열려요'; $('challenge-note').hidden = false; }
    Promise.resolve().then(sendChallenge).catch(function () { /* 토스트로 안내됨 */ }).then(function () { onChallengeClick.busy = false; });
  }

  // 친구(도전장) 기록의 최종 모습 · 대결 결과
  function oppEnd() { return V.makeEnd(B.rebuild(app.challenge)); }
  function redrawVisuals() {
    if (app.screen === 'result') { V.snapshot($('result-canvas')); return; }
    if (app.screen === 'draw') { D.redraw(); return; }
    if (!app.challenge) return;
    if (app.screen === 'challenge') {
      var rc = app.challenge;
      V.snapshot($('challenge-canvas'), oppEnd());
      $('challenge-name').textContent = rc.nickname + '님의 기록';
      $('challenge-score').innerHTML = (rc.won ? Math.round(rc.score) : 0) + '<span class="unit">점</span>';
    } else if (app.screen === 'battle') {
      V.snapshot($('vs-a-canvas'), oppEnd()); V.snapshot($('vs-b-canvas'));
    }
  }
  function showBattle() {
    var r = app.lastResult, rc = app.challenge, mine = r.won ? Math.round(r.score) : 0, opp = rc.won ? Math.round(rc.score) : 0;
    show('battle');
    $('vs-a-name').textContent = rc.nickname; $('vs-b-name').textContent = '나';
    $('vs-a-score').textContent = opp; $('vs-b-score').textContent = mine;
    $('vs-winner').textContent = mine > opp ? '이겼어요!' : (mine < opp ? '졌어요…' : '무승부예요');
  }

  // 사진 에셋: 모양별 JPG + 배경 PNG. 못 불러오면 코드로 그린 기본 달고나로 대체된다(경로는 사진 기준이라 어긋날 수 있어 assets 를 함께 둘 것)
  function loadPhotos() {
    DG.IMG = {};
    var ids = DG.SHAPE_ORDER.concat(['bg', 'needle', 'empty']), left = ids.length, done = false;
    function ready() { if (done) return; done = true; V.resetBase(); drawIntro(); drawSelect(); redrawVisuals(); document.documentElement.classList.add('assets-ready'); }   // 사진이 다 준비된 뒤에만 캔버스를 보여준다(대체 그림이 잠깐 보이는 깜빡임 방지)
    ids.forEach(function (id) {
      var im = new Image();
      im.onload = function () { DG.IMG[id] = im; if (done) { V.resetBase(); drawIntro(); drawSelect(); redrawVisuals(); } else if (--left === 0) ready(); };
      im.onerror = function () { if (--left === 0) ready(); };
      im.src = id === 'needle' ? C.NEEDLE.src : 'assets/' + id + (id === 'bg' || id === 'empty' ? '.png' : '.jpg');
    });
    setTimeout(ready, 4000);                                   // 안전장치: 네트워크가 느려도 화면이 비지 않게
  }

  // ---------- 초기화 ----------
  function init() {
    el = { toast: $('toast'), hudName: $('hud-name'), hudProg: $('hud-prog'), hudCrack: $('hud-crack'), barProg: $('bar-prog'), barCrack: $('bar-crack'), pull: $('btn-pull'), hint: $('hint') };
    V.initScale();
    loadPhotos();
    try { if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch'); } catch (e) { /* 무시 */ }
    window.addEventListener('touchstart', function () { document.body.classList.add('touch'); }, { once: true, passive: true });
    buildSelect();
    $('btn-start').addEventListener('click', function () { show('select'); });
    $('btn-play').addEventListener('click', function () { if (app.shape === 'custom' && !app.challenge) openDraw(); else startGame(); });
    D.bind($('draw-canvas'), function (n) { if (n < 0) $('draw-msg').textContent = '도안이 너무 복잡해요'; else if (n) $('draw-msg').textContent = ''; });
    $('btn-draw-reset').addEventListener('click', function () { $('draw-msg').textContent = ''; D.reset(); });
    $('btn-draw-done').addEventListener('click', finishDraw);
    $('btn-restart').addEventListener('click', function () { $('btn-restart').blur(); startGame(); });
    $('btn-again').addEventListener('click', startGame);
    $('btn-change').addEventListener('click', function () { app.challenge = null; show('select'); });
    $('btn-challenge').addEventListener('click', onChallengeClick);
    $('btn-challenge-start').addEventListener('click', startGame);
    $('btn-rematch').addEventListener('click', startGame);
    $('btn-vs-detail').addEventListener('click', function () { showResult(true); });
    I.bind($('screen-play'));
    I.on('separate', doSeparate);
    I.on('restart', function () { if (app.screen === 'play') startGame(); });
    window.addEventListener('resize', function () { drawIntro(); drawSelect(); redrawVisuals(); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Enter' && app.screen === 'intro') show('select'); });
    window.DG_APP = app;                                                    // 헤드리스 QA 용
    var tok = B.parseHash();                                                // 도전장 링크로 들어온 경우
    if (tok) {
      var rec = B.parseToken(tok);
      if (rec) { app.challenge = rec; app.shape = rec.shape; markSelected(); show('challenge'); return; }
      document.documentElement.classList.remove('boot-challenge'); toast('도전장 링크가 올바르지 않아요');
    }
    drawIntro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
