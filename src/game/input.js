/* 입력 — 키보드(방향키·SPACE 누르는 동안 긁기·ENTER 뽑기·R 재시작)와 터치(가상 방향 8칸·긁기 누르는 동안·뽑기)를 하나의 상태로 합친다.
 * 멀티터치: pointerId 마다 손가락 밑의 버튼을 따로 추적한다(방향 + 긁기 동시 입력, 미끄러져도 따라간다). */
(function () {
  'use strict';
  var DG = window.DG = window.DG || {};
  var keys = {}, ptrs = {}, handlers = { separate: null, restart: null }, enabled = false;
  var DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], ul: [-1, -1], ur: [1, -1], dl: [-1, 1], dr: [1, 1] };

  function blockKey(e) { return e.key === ' ' || e.key.indexOf('Arrow') === 0 || e.key === 'Enter'; }
  window.addEventListener('keydown', function (e) {
    if (!enabled) return;
    if (blockKey(e)) e.preventDefault();                 // 스크롤·버튼 포커스 클릭과 충돌 방지
    if (e.repeat) { return; }
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k === ' ' ? 'Space' : k] = true;
    if (k === 'Enter' && handlers.separate) handlers.separate();
    if (k === 'r' && handlers.restart) handlers.restart();
  }, { passive: false });
  window.addEventListener('keyup', function (e) { if (enabled && blockKey(e)) e.preventDefault(); var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; delete keys[k === ' ' ? 'Space' : k]; });
  window.addEventListener('blur', function () { keys = {}; ptrs = {}; syncPad(); });

  function hit(e) { var el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest ? el.closest('[data-dir],[data-act]') : null; }
  function syncPad() {                                    // 현재 눌린 버튼에 .is-down 표시
    var down = {}, id;
    for (id in ptrs) if (ptrs[id]) down[ptrs[id].dir || ptrs[id].act] = true;
    var els = document.querySelectorAll('[data-dir],[data-act]');
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('is-down', !!down[els[i].dataset.dir || els[i].dataset.act]);
  }
  function setPtr(e) {
    var el = hit(e), o = el ? { dir: el.dataset.dir, act: el.dataset.act } : null;
    var prev = ptrs[e.pointerId];
    ptrs[e.pointerId] = o;
    if (o && o.act === 'separate' && !(prev && prev.act === 'separate') && handlers.separate) handlers.separate();   // 뽑기는 누르는 순간 1회
    syncPad();
  }
  function bind(root) {
    root.addEventListener('pointerdown', function (e) {
      if (!hit(e)) return;
      e.preventDefault();
      try { root.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
      if (e.pointerType === 'touch' || e.pointerType === 'pen') document.body.classList.add('touch');
      setPtr(e);
    });
    root.addEventListener('pointermove', function (e) { if (e.pointerId in ptrs) setPtr(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { root.addEventListener(t, function (e) { delete ptrs[e.pointerId]; syncPad(); }); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function read() {                                       // {dx,dy,scratch}
    var dx = 0, dy = 0, scratch = !!keys.Space, id;
    if (keys.ArrowLeft) dx -= 1; if (keys.ArrowRight) dx += 1; if (keys.ArrowUp) dy -= 1; if (keys.ArrowDown) dy += 1;
    for (id in ptrs) { var p = ptrs[id]; if (!p) continue; if (p.dir && DIR[p.dir]) { dx += DIR[p.dir][0]; dy += DIR[p.dir][1]; } if (p.act === 'scratch') scratch = true; }
    dx = Math.max(-1, Math.min(1, dx)); dy = Math.max(-1, Math.min(1, dy));
    return { dx: dx, dy: dy, scratch: scratch };
  }
  function reset() { keys = {}; ptrs = {}; syncPad(); }

  DG.input = {
    bind: bind, read: read, reset: reset,
    enable: function (on) { enabled = on; if (!on) reset(); },
    on: function (name, fn) { handlers[name] = fn; },
    press: function (k, v) { if (v) keys[k] = true; else delete keys[k]; }      // 테스트용
  };
})();
