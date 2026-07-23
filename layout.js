/* ===== 版面位置 / 大小系統 layout.js =====
   位置與大小都「按類型(data-lay key)」套用:同一種區塊(如所有植物的成長時間軸)共用一組設定,
   所以在任一頁拖一次,全部同類型區塊一起改變。

   正式模式:讀 config/layout.json,對每個 [data-lay] 套用位移(CSS translate)與縮放(CSS scale),
             皆不干擾既有動畫(translate / scale 為獨立屬性,和 transform 分開)。
   編輯模式(網址加 ?edit=1):每個區塊顯示「移動把手(左上)」與「縮放把手(右下角)」,
             底部工具列可「複製 layout.json / 重設 / 離開」。拖好把 JSON 貼進 config/layout.json → commit 上線。

   layout.json 格式:{ "detail.timeline": { "x": -120, "y": 10, "s": 1.1 }, ... }  (x/y=位移px,s=縮放倍率) */
(function () {
  'use strict';
  var editing = /[?&]edit=1(?:&|$)/.test(location.search);
  var map = {};

  var LABELS = {
    'lobby.header': '大廳標題', 'lobby.cards': '分類卡牆',
    'grid.back': '返回鈕', 'grid.header': '分類標題', 'grid.tabs': '分類頁籤', 'grid.cards': '植物卡牆',
    'detail.back': '返回鈕', 'detail.title': '植物名', 'detail.metrics': '指標列',
    'detail.picker': '選擇個體', 'detail.intro': '植物介紹', 'detail.timelineHead': '時間軸標題', 'detail.timeline': '成長時間軸'
  };

  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'config/layout.json?t=' + Date.now(), false);
    xhr.send();
    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
      var j = JSON.parse(xhr.responseText || '{}');
      if (j && typeof j === 'object') map = j;
    }
  } catch (e) {}

  function applyAll() {
    var els = document.querySelectorAll('[data-lay]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], o = map[el.getAttribute('data-lay')];
      el.style.transformOrigin = 'top left';
      el.style.translate = (o && (o.x || o.y)) ? ((o.x || 0) + 'px ' + (o.y || 0) + 'px') : '';
      el.style.scale = (o && o.s && o.s !== 1) ? String(o.s) : '';
    }
  }

  function watchApp(after) {
    var app = document.getElementById('app');
    if (app) new MutationObserver(function () { applyAll(); if (after) after(); }).observe(app, { childList: true });
  }

  // ── 正式模式:只套用 ──
  if (!editing) {
    function go() { applyAll(); watchApp(null); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    return;
  }

  // ── 編輯模式 ──
  var overlay, hmove = {}, hsize = {}, raf = 0, drag = null;

  function injectCss() {
    var s = document.createElement('style');
    s.textContent =
      '.lay-overlay{position:fixed;inset:0;z-index:9998;pointer-events:none;}' +
      '.lay-h{position:absolute;pointer-events:auto;cursor:grab;background:rgba(94,203,138,.92);color:#04120b;' +
        'font:600 11px/1 "Space Grotesk",sans-serif;padding:4px 8px;border-radius:7px;white-space:nowrap;' +
        'box-shadow:0 3px 10px rgba(0,0,0,.5);user-select:none;transform:translate(-2px,-120%);}' +
      '.lay-h:active{cursor:grabbing;}' +
      '.lay-z{position:absolute;pointer-events:auto;cursor:nwse-resize;width:20px;height:20px;' +
        'transform:translate(-50%,-50%);background:rgba(94,203,138,.92);color:#04120b;border-radius:6px;' +
        'font:600 12px/20px "Space Grotesk",sans-serif;text-align:center;box-shadow:0 3px 10px rgba(0,0,0,.5);user-select:none;}' +
      '[data-lay]{outline:1.5px dashed rgba(94,203,138,.5);outline-offset:3px;}' +
      '.lay-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;align-items:center;' +
        'background:rgba(10,16,14,.94);border:1px solid rgba(94,203,138,.4);border-radius:12px;padding:9px 12px;' +
        'font:400 12px/1.4 "Space Grotesk",sans-serif;color:#cfe9d8;box-shadow:0 12px 40px rgba(0,0,0,.6);}' +
      '.lay-bar button{font:inherit;cursor:pointer;background:rgba(94,203,138,.16);border:1px solid rgba(94,203,138,.4);' +
        'color:#c8f5d8;padding:6px 10px;border-radius:8px;}' +
      '.lay-bar button:hover{background:rgba(94,203,138,.28);}' +
      '.lay-bar .x{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.15);color:#9fb4a8;}';
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    if (!overlay) { overlay = document.createElement('div'); overlay.className = 'lay-overlay'; document.body.appendChild(overlay); }
  }

  function positionHandles() {
    var k, h, el, r;
    for (k in hmove) { h = hmove[k]; el = h.__el; if (!el || !document.body.contains(el)) { h.remove(); delete hmove[k]; continue; } r = el.getBoundingClientRect(); h.style.left = r.left + 'px'; h.style.top = r.top + 'px'; }
    for (k in hsize) { h = hsize[k]; el = h.__el; if (!el || !document.body.contains(el)) { h.remove(); delete hsize[k]; continue; } r = el.getBoundingClientRect(); h.style.left = r.right + 'px'; h.style.top = r.bottom + 'px'; }
  }
  function scheduleHandles() { cancelAnimationFrame(raf); raf = requestAnimationFrame(buildHandles); }

  function buildHandles() {
    ensureOverlay();
    var els = document.querySelectorAll('[data-lay]'), seen = {}, i, el, k;
    for (i = 0; i < els.length; i++) {
      el = els[i]; k = el.getAttribute('data-lay'); seen[k] = 1;
      if (!hmove[k]) { var m = document.createElement('div'); m.className = 'lay-h'; m.textContent = '⤢ ' + (LABELS[k] || k); m.__key = k; overlay.appendChild(m); hmove[k] = m; wireMove(m); }
      hmove[k].__el = el;
      if (!hsize[k]) { var z = document.createElement('div'); z.className = 'lay-z'; z.textContent = '⤡'; z.title = '拖曳改大小'; z.__key = k; overlay.appendChild(z); hsize[k] = z; wireSize(z); }
      hsize[k].__el = el;
    }
    for (k in hmove) if (!seen[k]) { hmove[k].remove(); delete hmove[k]; }
    for (k in hsize) if (!seen[k]) { hsize[k].remove(); delete hsize[k]; }
    positionHandles();
  }

  function getSet(k) { var o = map[k]; if (!o) { o = { x: 0, y: 0 }; map[k] = o; } return o; }

  function wireMove(h) {
    h.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      var el = h.__el; if (!el) return;
      var o = map[h.__key] || {};
      drag = { t: 'move', h: h, el: el, k: h.__key, bx: o.x || 0, by: o.y || 0, sx: ev.clientX, sy: ev.clientY };
      try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    h.addEventListener('pointermove', function (ev) {
      if (!drag || drag.h !== h) return;
      var nx = Math.round(drag.bx + (ev.clientX - drag.sx)), ny = Math.round(drag.by + (ev.clientY - drag.sy));
      var o = getSet(drag.k); o.x = nx; o.y = ny;
      drag.el.style.translate = nx + 'px ' + ny + 'px';
      positionHandles(); updateBar();
    });
    endBind(h);
  }

  function wireSize(z) {
    z.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      var el = z.__el; if (!el) return;
      var r = el.getBoundingClientRect();
      var o = map[z.__key] || {};
      var d0 = Math.max(24, Math.hypot(ev.clientX - r.left, ev.clientY - r.top));
      drag = { t: 'size', h: z, el: el, k: z.__key, bs: o.s || 1, tlx: r.left, tly: r.top, d0: d0 };
      try { z.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    z.addEventListener('pointermove', function (ev) {
      if (!drag || drag.h !== z) return;
      var d = Math.hypot(ev.clientX - drag.tlx, ev.clientY - drag.tly);
      var s = Math.max(0.4, Math.min(3, drag.bs * (d / drag.d0)));
      s = Math.round(s * 100) / 100;
      var o = getSet(drag.k); o.s = s;
      drag.el.style.scale = String(s);
      positionHandles(); updateBar();
    });
    endBind(z);
  }

  function endBind(h) {
    function end() { drag = null; }
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  }

  function buildBar() {
    var bar = document.createElement('div'); bar.className = 'lay-bar';
    var info = document.createElement('span'); info.id = 'lay-info'; info.textContent = '版面編輯:左上把手移動 · 右下角把手改大小';
    var bSave = document.createElement('button'); bSave.textContent = '儲存';
    var bReset = document.createElement('button'); bReset.textContent = '重設全部';
    var bExit = document.createElement('button'); bExit.className = 'x'; bExit.textContent = '離開';
    bSave.onclick = function () {
      var t = JSON.stringify(map, null, 2);
      bSave.textContent = '儲存中…';
      fetch('/save/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: t })
        .then(function (r) { if (!r.ok) throw 0; bSave.textContent = '已儲存 ✓'; })
        .catch(function () { try { navigator.clipboard.writeText(t); } catch (e) {} bSave.textContent = '無法自動存·已複製'; })
        .then(function () { setTimeout(function () { bSave.textContent = '儲存'; }, 1600); });
    };
    bReset.onclick = function () { map = {}; applyAll(); positionHandles(); updateBar(); };
    bExit.onclick = function () { location.href = location.pathname; };
    bar.appendChild(info); bar.appendChild(bSave); bar.appendChild(bReset); bar.appendChild(bExit);
    document.body.appendChild(bar);
  }
  function updateBar() {
    var n = Object.keys(map).length, info = document.getElementById('lay-info');
    if (info) info.textContent = n ? ('版面編輯:已調整 ' + n + ' 種區塊 · 左上移動 / 右下角改大小') : '版面編輯:左上把手移動 · 右下角把手改大小';
  }

  function initEdit() {
    injectCss(); applyAll(); buildBar(); buildHandles();
    watchApp(scheduleHandles);
    window.addEventListener('scroll', positionHandles, { passive: true });
    window.addEventListener('resize', positionHandles);
    setInterval(positionHandles, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEdit); else initEdit();
})();
