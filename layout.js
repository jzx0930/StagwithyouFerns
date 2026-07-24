/* ===== 版面位置 / 大小系統 layout.js =====
   位置與大小都「按類型(data-lay key)」套用:同一種區塊(如所有植物的時間軸、所有照片)共用一組設定,
   在任一頁拖一次,全部同類型區塊一起改變。

   正式模式:讀 config/layout.json,對每個 [data-lay] 套用位移(translate)與縮放(scale),不干擾既有動畫。
   編輯模式(?edit=1):每區塊有「移動把手(左上標籤)」+「8 個縮放把手(四角+四邊)」;
             邊把手只改單一方向、角把手改兩方向,拖某邊固定對邊。底部工具列「儲存 / 重設 / 離開」。

   layout.json 格式:{ "detail.timeline": { "x":-120, "y":10, "sx":1.1, "sy":1.0 }, ... }
   (x/y=位移px;sx/sy=水平/垂直縮放倍率;舊版單一 s 仍相容,會當 sx=sy=s) */
(function () {
  'use strict';
  var editing = /[?&]edit=1(?:&|$)/.test(location.search);
  var map = {};

  var LABELS = {
    'lobby.header': '大廳標題', 'lobby.cards': '分類卡牆',
    'grid.back': '返回鈕', 'grid.header': '分類標題', 'grid.tabs': '分類頁籤', 'grid.cards': '植物卡牆',
    'detail.back': '返回鈕', 'detail.title': '植物名', 'detail.metrics': '指標列',
    'detail.picker': '選擇個體', 'detail.intro': '植物介紹', 'detail.timelineHead': '時間軸標題',
    'detail.timeline': '成長時間軸', 'detail.photo': '照片'
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

  function sxOf(o) { return o ? (o.sx != null ? o.sx : (o.s != null ? o.s : 1)) : 1; }
  function syOf(o) { return o ? (o.sy != null ? o.sy : (o.s != null ? o.s : 1)) : 1; }

  function apply1(el, o) {
    el.style.transformOrigin = 'top left';
    el.style.translate = (o && (o.x || o.y)) ? ((o.x || 0) + 'px ' + (o.y || 0) + 'px') : '';
    var sx = sxOf(o), sy = syOf(o);
    el.style.scale = (sx !== 1 || sy !== 1) ? (sx + ' ' + sy) : '';
  }
  function applyAll() {
    var els = document.querySelectorAll('[data-lay]');
    for (var i = 0; i < els.length; i++) apply1(els[i], map[els[i].getAttribute('data-lay')]);
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
  var DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var overlay, byKey = {}, raf = 0, drag = null;

  function clamp(v) { return Math.max(0.2, Math.min(4, v)); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function getSet(k) { var o = map[k]; if (!o) { o = {}; map[k] = o; } return o; }

  function injectCss() {
    var s = document.createElement('style');
    s.textContent =
      '.lay-overlay{position:fixed;inset:0;z-index:9998;pointer-events:none;}' +
      '.lay-h{position:absolute;pointer-events:auto;cursor:grab;background:rgba(94,203,138,.92);color:#04120b;' +
        'font:600 11px/1 "Space Grotesk",sans-serif;padding:4px 8px;border-radius:7px;white-space:nowrap;' +
        'box-shadow:0 3px 10px rgba(0,0,0,.5);user-select:none;transform:translate(-2px,-130%);}' +
      '.lay-h:active{cursor:grabbing;}' +
      '.lay-z{position:absolute;pointer-events:auto;width:12px;height:12px;transform:translate(-50%,-50%);' +
        'background:#fff;border:1.5px solid rgba(94,203,138,.95);border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.55);}' +
      '.lay-z.n,.lay-z.s{cursor:ns-resize;}.lay-z.e,.lay-z.w{cursor:ew-resize;}' +
      '.lay-z.ne,.lay-z.sw{cursor:nesw-resize;}.lay-z.nw,.lay-z.se{cursor:nwse-resize;}' +
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
  function ensureOverlay() { if (!overlay) { overlay = document.createElement('div'); overlay.className = 'lay-overlay'; document.body.appendChild(overlay); } }

  function positionHandles() {
    for (var k in byKey) {
      var H = byKey[k], el = H.el;
      if (!el || !document.body.contains(el)) { removeSet(k); continue; }
      var r = el.getBoundingClientRect();
      var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      H.move.style.left = r.left + 'px'; H.move.style.top = r.top + 'px';
      var P = { nw: [r.left, r.top], n: [cx, r.top], ne: [r.right, r.top], e: [r.right, cy], se: [r.right, r.bottom], s: [cx, r.bottom], sw: [r.left, r.bottom], w: [r.left, cy] };
      for (var d in H.dirs) { H.dirs[d].style.left = P[d][0] + 'px'; H.dirs[d].style.top = P[d][1] + 'px'; }
    }
  }
  function removeSet(k) { var H = byKey[k]; if (!H) return; H.move.remove(); for (var d in H.dirs) H.dirs[d].remove(); delete byKey[k]; }
  function scheduleHandles() { cancelAnimationFrame(raf); raf = requestAnimationFrame(buildHandles); }

  function buildHandles() {
    ensureOverlay();
    var els = document.querySelectorAll('[data-lay]'), seen = {}, i, el, k;
    for (i = 0; i < els.length; i++) {
      el = els[i]; k = el.getAttribute('data-lay'); seen[k] = 1;
      if (!byKey[k]) {
        var H = { dirs: {} };
        var m = document.createElement('div'); m.className = 'lay-h'; m.textContent = '⤢ ' + (LABELS[k] || k); m.__key = k; overlay.appendChild(m); wireMove(m); H.move = m;
        DIRS.forEach(function (d) { var z = document.createElement('div'); z.className = 'lay-z ' + d; z.__key = k; z.__dir = d; overlay.appendChild(z); wireResize(z); H.dirs[d] = z; });
        byKey[k] = H;
      }
      byKey[k].el = el;
    }
    for (k in byKey) if (!seen[k]) removeSet(k);
    positionHandles();
  }

  function wireMove(h) {
    h.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); var H = byKey[h.__key], el = H && H.el; if (!el) return;
      var o = map[h.__key] || {};
      drag = { node: h, k: h.__key, mode: 'move', bx: o.x || 0, by: o.y || 0, sx: ev.clientX, sy: ev.clientY };
      try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    h.addEventListener('pointermove', function (ev) {
      if (!drag || drag.node !== h) return;
      var o = getSet(drag.k); o.x = Math.round(drag.bx + (ev.clientX - drag.sx)); o.y = Math.round(drag.by + (ev.clientY - drag.sy));
      applyAll(); positionHandles(); updateBar();
    });
    endBind(h);
  }

  function wireResize(z) {
    z.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); var H = byKey[z.__key], el = H && H.el; if (!el) return;
      var r = el.getBoundingClientRect(), o = map[z.__key] || {};
      drag = { node: z, k: z.__key, mode: 'size', dir: z.__dir, el: el,
        x0: o.x || 0, y0: o.y || 0, sx0: sxOf(o), sy0: syOf(o),
        left: r.left, top: r.top, w: r.width || 1, h: r.height || 1 };
      try { z.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    z.addEventListener('pointermove', function (ev) {
      if (!drag || drag.node !== z) return;
      var dir = drag.dir, o = getSet(drag.k);
      var sx = drag.sx0, sy = drag.sy0, x = drag.x0, y = drag.y0;
      var hor = dir.indexOf('e') >= 0 ? 'e' : (dir.indexOf('w') >= 0 ? 'w' : '');
      var ver = dir.indexOf('s') >= 0 ? 's' : (dir.indexOf('n') >= 0 ? 'n' : '');
      if (hor === 'e') { sx = clamp(drag.sx0 * (ev.clientX - drag.left) / drag.w); }
      else if (hor === 'w') { var nw = (drag.left + drag.w) - ev.clientX; sx = clamp(drag.sx0 * nw / drag.w); x = drag.x0 + (ev.clientX - drag.left); }
      if (ver === 's') { sy = clamp(drag.sy0 * (ev.clientY - drag.top) / drag.h); }
      else if (ver === 'n') { var nh = (drag.top + drag.h) - ev.clientY; sy = clamp(drag.sy0 * nh / drag.h); y = drag.y0 + (ev.clientY - drag.top); }
      o.x = Math.round(x); o.y = Math.round(y); o.sx = r2(sx); o.sy = r2(sy); if ('s' in o) delete o.s;
      applyAll(); positionHandles(); updateBar();
    });
    endBind(z);
  }

  function endBind(h) { function end() { drag = null; } h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end); }

  function buildBar() {
    var bar = document.createElement('div'); bar.className = 'lay-bar';
    var info = document.createElement('span'); info.id = 'lay-info'; info.textContent = '版面編輯:左上把手移動 · 四角四邊把手改大小';
    var bSave = document.createElement('button'); bSave.textContent = '儲存';
    var bReset = document.createElement('button'); bReset.textContent = '重設全部';
    var bExit = document.createElement('button'); bExit.className = 'x'; bExit.textContent = '離開';
    bSave.onclick = function () {
      var t = JSON.stringify(map, null, 2); bSave.textContent = '儲存中…';
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
    if (info) info.textContent = n ? ('版面編輯:已調整 ' + n + ' 種區塊 · 左上移動 / 四角四邊改大小') : '版面編輯:左上把手移動 · 四角四邊把手改大小';
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
