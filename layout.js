/* ===== 版面位置系統 layout.js =====
   正式模式:讀 config/layout.json,把每個 [data-lay] 區塊依存的偏移量套用(CSS translate,不干擾既有動畫)。
   編輯模式(網址加 ?edit=1):顯示綠色把手,可拖曳任意區塊;底部工具列可「複製 layout.json / 重設 / 離開」。
   拖好後把複製到的 JSON 貼進 config/layout.json 存檔 → commit 就上線(跟 config.ini 同套流程)。 */
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

  // 讀 config/layout.json(file:// 讀不到就維持空,不影響顯示)
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
      var k = els[i].getAttribute('data-lay'), o = map[k];
      els[i].style.translate = o ? (o.x + 'px ' + o.y + 'px') : '';
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
  var overlay, handles = {}, raf = 0, drag = null;

  function injectCss() {
    var s = document.createElement('style');
    s.textContent =
      '.lay-overlay{position:fixed;inset:0;z-index:9998;pointer-events:none;}' +
      '.lay-h{position:absolute;pointer-events:auto;cursor:grab;background:rgba(94,203,138,.92);color:#04120b;' +
        'font:600 11px/1 "Space Grotesk",sans-serif;padding:4px 8px;border-radius:7px;white-space:nowrap;' +
        'box-shadow:0 3px 10px rgba(0,0,0,.5);user-select:none;transform:translate(-2px,-120%);}' +
      '.lay-h:active{cursor:grabbing;}' +
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
    for (var k in handles) {
      var h = handles[k], el = h.__el;
      if (!el || !document.body.contains(el)) { h.remove(); delete handles[k]; continue; }
      var r = el.getBoundingClientRect();
      h.style.left = r.left + 'px'; h.style.top = r.top + 'px';
    }
  }
  function scheduleHandles() { cancelAnimationFrame(raf); raf = requestAnimationFrame(buildHandles); }

  function buildHandles() {
    ensureOverlay();
    var els = document.querySelectorAll('[data-lay]'), seen = {};
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k = el.getAttribute('data-lay'); seen[k] = 1;
      var h = handles[k];
      if (!h) { h = document.createElement('div'); h.className = 'lay-h'; h.textContent = '⤢ ' + (LABELS[k] || k); h.__key = k; overlay.appendChild(h); handles[k] = h; wire(h); }
      h.__el = el;
    }
    for (var kk in handles) if (!seen[kk]) { handles[kk].remove(); delete handles[kk]; }
    positionHandles();
  }

  function wire(h) {
    h.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      var el = h.__el; if (!el) return;
      var o = map[h.__key] || { x: 0, y: 0 };
      drag = { h: h, el: el, k: h.__key, bx: o.x, by: o.y, sx: ev.clientX, sy: ev.clientY };
      try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    h.addEventListener('pointermove', function (ev) {
      if (!drag || drag.h !== h) return;
      var nx = Math.round(drag.bx + (ev.clientX - drag.sx)), ny = Math.round(drag.by + (ev.clientY - drag.sy));
      map[drag.k] = { x: nx, y: ny };
      drag.el.style.translate = nx + 'px ' + ny + 'px';
      positionHandles(); updateBar();
    });
    function end() { drag = null; }
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  }

  function buildBar() {
    var bar = document.createElement('div'); bar.className = 'lay-bar';
    var info = document.createElement('span'); info.id = 'lay-info'; info.textContent = '版面編輯:拖綠色把手移動區塊';
    var bCopy = document.createElement('button'); bCopy.textContent = '複製 layout.json';
    var bReset = document.createElement('button'); bReset.textContent = '重設全部';
    var bExit = document.createElement('button'); bExit.className = 'x'; bExit.textContent = '離開';
    bCopy.onclick = function () {
      var t = JSON.stringify(map, null, 2);
      try { navigator.clipboard.writeText(t); } catch (e) {}
      bCopy.textContent = '已複製 ✓'; setTimeout(function () { bCopy.textContent = '複製 layout.json'; }, 1400);
    };
    bReset.onclick = function () { map = {}; applyAll(); positionHandles(); updateBar(); };
    bExit.onclick = function () { location.href = location.pathname; };
    bar.appendChild(info); bar.appendChild(bCopy); bar.appendChild(bReset); bar.appendChild(bExit);
    document.body.appendChild(bar);
  }
  function updateBar() {
    var n = Object.keys(map).length, info = document.getElementById('lay-info');
    if (info) info.textContent = n ? ('版面編輯:已移動 ' + n + ' 個區塊 · 拖綠色把手') : '版面編輯:拖綠色把手移動區塊';
  }

  function initEdit() {
    injectCss(); applyAll(); buildBar(); buildHandles();
    watchApp(scheduleHandles);
    window.addEventListener('scroll', positionHandles, { passive: true });
    window.addEventListener('resize', positionHandles);
    setInterval(positionHandles, 500);   // 保險:圖片/3D 模型載入後尺寸變動時把手跟上
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEdit); else initEdit();
})();
