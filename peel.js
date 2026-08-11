/* ===== SFPeel:撕貼紙捲曲 =====
   peelButton(tab, onComplete):把個體按鈕畫成一張乾淨小貼紙,沿頂邊捲成圓筒(正面按鈕、翻過頂露深綠背面),
     跟手指捲、過半甩飛→onComplete;點擊自動捲完甩飛;不夠彈回。直接畫(不截圖),清晰不糊。
   (舊的整片時間軸截圖捲曲 begin/prepare 仍保留,目前未使用。) */
(function () {
  'use strict';

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // 把材質 tex 依 peelY(頂邊往下的捲線)畫成圓筒捲曲;R=捲曲半徑
  function drawCurl(octx, tex, W, H, peelY, R) {
    var ts = tex.width / W, HALF = Math.PI / 2;
    octx.clearRect(-40, -Math.ceil(R * 2) - 80, W + 80, H + Math.ceil(R * 2) + 160);
    if (peelY < H) {                                   // 還黏著的下半
      octx.save(); octx.beginPath(); octx.rect(0, peelY, W, H - peelY); octx.clip();
      octx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, W, H); octx.restore();
    }
    var y0 = Math.max(0, Math.floor(peelY - 3.5 * R));  // 只畫可見捲弧
    for (var y = y0; y < peelY; y++) {
      var a = peelY - y, th = a / R;
      if (th > 3.4) continue;
      var dy = peelY - R * Math.sin(th);
      var hh = Math.max(0.5, Math.abs(Math.cos(th)) * 1.35);
      if (th <= HALF + 0.02) {                          // 正面(不加任何變暗/陰影)
        octx.drawImage(tex, 0, Math.floor(y * ts), tex.width, Math.max(1, Math.ceil(ts)), 0, dy, W, hh);
      } else {                                          // 背面(深綠)
        octx.fillStyle = 'rgba(20,42,35,0.97)'; octx.fillRect(0, dy, W, hh);
        octx.fillStyle = 'rgba(154,216,171,0.10)'; octx.fillRect(0, dy, W, Math.min(hh, 1));
      }
    }
    var cy = peelY - R;                                 // 捲脊高光
    var hg = octx.createLinearGradient(0, cy - 6, 0, cy + 6);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    octx.fillStyle = hg; octx.fillRect(0, cy - 6, W, 12);
  }

  function drawSticker(fx, W, H, text, active, dpr) {
    fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
    var r = H / 2;
    // 乾淨綠色乙烯貼紙(不分選中,避免深色本體看起來像陰影暗塊)
    roundRect(fx, 0.75, 0.75, W - 1.5, H - 1.5, r);
    var g = fx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ace3bd'); g.addColorStop(1, '#7ec996'); fx.fillStyle = g;
    fx.fill();
    fx.lineWidth = 1; fx.strokeStyle = 'rgba(255,255,255,0.5)'; fx.stroke();
    // 上緣一道高光,像貼紙的乙烯反光
    var sh = fx.createLinearGradient(0, 0, 0, H * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(fx, 0.75, 0.75, W - 1.5, H - 1.5, r); fx.fillStyle = sh; fx.fill();
    fx.fillStyle = '#06110b';
    fx.font = '500 13px "Space Grotesk", system-ui, sans-serif';
    fx.textAlign = 'center'; fx.textBaseline = 'middle';
    fx.fillText(text, W / 2, H / 2 + 0.5);
  }

  function peelButton(tab, onComplete) {
    var r = tab.getBoundingClientRect(), W = r.width, H = r.height;
    if (!W || !H) return null;
    var R = Math.max(20, H * 0.75);                     // 小貼紙的捲曲半徑
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var padT = Math.ceil(R * 2) + 26, padX = 26, padB = 22;
    var text = (tab.textContent || '').replace(/\s+/g, ' ').trim();
    var active = tab.classList.contains('active');
    // 前面材質(直接畫,清晰)
    var fc = document.createElement('canvas'); fc.width = Math.round(W * dpr); fc.height = Math.round(H * dpr);
    drawSticker(fc.getContext('2d'), W, H, text, active, dpr);
    // 疊在按鈕上的畫布
    var cv = document.createElement('canvas');
    cv.width = Math.round((W + padX * 2) * dpr); cv.height = Math.round((H + padT + padB) * dpr);
    cv.style.cssText = 'position:fixed;left:' + (r.left - padX) + 'px;top:' + (r.top - padT) + 'px;width:' + (W + padX * 2) + 'px;height:' + (H + padT + padB) + 'px;z-index:60;pointer-events:none;will-change:transform,opacity;';
    document.body.appendChild(cv);
    var octx = cv.getContext('2d'); octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.translate(padX, padT);
    tab.style.visibility = 'hidden';
    var peelY = 0, alive = true, SPAN = H * 1.35;
    function render() { drawCurl(octx, fc, W, H, peelY, R); }
    render();
    function cleanup(restore) { alive = false; if (cv.parentNode) cv.parentNode.removeChild(cv); if (restore) tab.style.visibility = ''; }
    function fling() {
      cv.style.transition = 'transform .5s cubic-bezier(.4,0,.7,-0.15), opacity .5s ease-in';
      cv.style.transform = 'translate(6%,-150%) rotate(10deg) scale(.8)'; cv.style.opacity = '0';
      setTimeout(function () { cleanup(false); if (onComplete) onComplete(); }, 480);
    }
    function snapBack() { var f = peelY, s = performance.now(); (function step(n) { var t = Math.min(1, (n - s) / 260), e = 1 - Math.pow(1 - t, 3); peelY = f * (1 - e); render(); if (t < 1) requestAnimationFrame(step); else cleanup(true); })(performance.now()); }
    return {
      move: function (dy) { if (!alive) return; peelY = Math.max(0, Math.min(H, dy / SPAN * H)); render(); },
      auto: function () { var s = performance.now(); (function step(n) { if (!alive) return; var t = Math.min(1, (n - s) / 380), e = 1 - Math.pow(1 - t, 3); peelY = H * e; render(); if (t < 1) requestAnimationFrame(step); else fling(); })(performance.now()); },
      release: function () { if (!alive) return; if (peelY > H * 0.5) fling(); else snapBack(); }
    };
  }

  window.SFPeel = { peelButton: peelButton };
})();
