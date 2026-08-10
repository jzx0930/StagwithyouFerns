/* ===== SFPeel:成長時間軸「撕貼紙真捲曲」引擎 =====
   prepare(el):用 html2canvas 把 el 截成材質快取(進詳情頁時預先做,撕的時候才即時)。
   begin(el, onComplete):以快取材質蓋一張 canvas、隱藏 el,回傳控制器 {move(dy)/auto()/release()};
     沿頂邊把材質畫成圓筒捲曲(前面時間軸、過頂露深綠背面),過半或點擊→甩飛→onComplete。
   截不到材質(未 prepare 完)時 begin 回 null,呼叫端就退回瞬間切換。 */
(function () {
  'use strict';
  var H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var R = 48;            // 卷曲半徑(越大越鬆)
  var h2cP = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve();
    if (h2cP) return h2cP;
    h2cP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = H2C; s.onload = function () { res(); }; s.onerror = rej;
      document.head.appendChild(s);
    });
    return h2cP;
  }
  function prepare(el) {
    if (!el) return;
    loadH2C().then(function () {
      return window.html2canvas(el, { backgroundColor: null, useCORS: true, scale: Math.min(2, window.devicePixelRatio || 1), logging: false });
    }).then(function (cv) { el.__tex = cv; }).catch(function () { el.__tex = null; });
  }

  function drawCurl(octx, tex, W, H, peelY) {
    var ts = tex.width / W;   // 材質對元件像素比
    octx.clearRect(-4, -Math.ceil(R * 2) - 60, W + 8, H + Math.ceil(R * 2) + 120);
    // 未捲的下半(還黏著)
    if (peelY < H) {
      octx.save(); octx.beginPath(); octx.rect(0, peelY, W, H - peelY); octx.clip();
      octx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, W, H); octx.restore();
      var g = octx.createLinearGradient(0, peelY, 0, peelY + 46);   // 捲摺下方陰影
      g.addColorStop(0, 'rgba(0,0,0,0.40)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g; octx.fillRect(0, peelY, W, 46);
    }
    // 捲起的上半:只畫「可見捲弧」那段(約 3.5R),更上面的已捲進滾筒內側(隱藏),省效能
    var HALF = Math.PI / 2, y0 = Math.max(0, Math.floor(peelY - 3.5 * R));
    for (var y = y0; y < peelY; y++) {
      var a = peelY - y, th = a / R;
      if (th > 3.4) continue;                       // 超過 ~195° 不畫
      var dy = peelY - R * Math.sin(th);            // 目的 y(頂邊在 peelY-R)
      var hh = Math.max(0.5, Math.abs(Math.cos(th)) * 1.35);
      if (th <= HALF + 0.02) {                       // 正面(時間軸)
        octx.drawImage(tex, 0, Math.floor(y * ts), tex.width, Math.max(1, Math.ceil(ts)), 0, dy, W, hh);
        var c = Math.cos(th);
        if (c < 0.99) { octx.fillStyle = 'rgba(0,0,0,' + ((1 - c) * 0.34) + ')'; octx.fillRect(0, dy, W, hh); }
      } else {                                        // 背面(深綠玻璃)
        octx.fillStyle = 'rgba(20,42,35,0.97)'; octx.fillRect(0, dy, W, hh);
        octx.fillStyle = 'rgba(154,216,171,0.10)'; octx.fillRect(0, dy, W, Math.min(hh, 1));
      }
    }
    // 頂邊高光(捲脊)
    var cy = peelY - R;
    var hg = octx.createLinearGradient(0, cy - 7, 0, cy + 7);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.16)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    octx.fillStyle = hg; octx.fillRect(0, cy - 7, W, 14);
  }

  function begin(el, onComplete) {
    var tex = el.__tex; if (!tex) return null;
    var r = el.getBoundingClientRect(), W = r.width, H = r.height;
    var pad = Math.ceil(R * 2) + 60, dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round((H + pad) * dpr);
    cv.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + (r.top - pad) + 'px;width:' + W + 'px;height:' + (H + pad) + 'px;z-index:50;pointer-events:none;will-change:transform,opacity;';
    document.body.appendChild(cv);
    var octx = cv.getContext('2d'); octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.translate(0, pad);   // 讓 y=0 = 元件頂
    el.style.visibility = 'hidden';
    var peelY = 0, alive = true;
    function render() { drawCurl(octx, tex, W, H, peelY); }
    render();
    function cleanup(restore) { alive = false; if (cv.parentNode) cv.parentNode.removeChild(cv); if (restore) el.style.visibility = ''; }
    function fling() {
      cv.style.transition = 'transform .52s cubic-bezier(.4,0,.7,-0.12), opacity .52s ease-in';
      cv.style.transform = 'translate(12%,-132%) rotate(13deg) scale(.82)'; cv.style.opacity = '0';
      setTimeout(function () { cleanup(false); if (onComplete) onComplete(); }, 500);
    }
    function snapBack() {
      var from = peelY, s = performance.now();
      (function step(n) { var t = Math.min(1, (n - s) / 300), e = 1 - Math.pow(1 - t, 3); peelY = from * (1 - e); render(); if (t < 1) requestAnimationFrame(step); else cleanup(true); })(performance.now());
    }
    return {
      move: function (dy) { if (!alive) return; peelY = Math.max(0, Math.min(H, dy)); render(); },
      auto: function () { var s = performance.now(); (function step(n) { if (!alive) return; var t = Math.min(1, (n - s) / 440), e = 1 - Math.pow(1 - t, 3); peelY = H * e; render(); if (t < 1) requestAnimationFrame(step); else fling(); })(performance.now()); },
      release: function () { if (!alive) return; if (peelY > H * 0.42) fling(); else snapBack(); }
    };
  }

  window.SFPeel = { prepare: prepare, begin: begin };
})();
