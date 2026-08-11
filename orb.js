/* ===== SFOrb:載入球體(自製 canvas 點陣球,零依賴、同步顯示、永久可用)=====
   單色白點均勻散佈在球面(費氏球面),繞垂直軸自轉 + 固定俯角 → 點會飄移、明顯在轉;
   前亮後淡的深度層次、微呼吸、輕微明滅。
   用法:var o = SFOrb.mount(container, { size:130, count:340, color:'232,244,238' }); 結束時 o.stop(); */
(function () {
  'use strict';
  function mount(container, opts) {
    opts = opts || {};
    var size = opts.size || 130, count = opts.count || 340, col = opts.color || '232,244,238';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');

    var pts = [], ga = Math.PI * (3 - Math.sqrt(5)), i;   // 費氏球面:點均勻散佈(非對稱→轉得看得出來)
    for (i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = i * ga;
      pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, ph: Math.random() * 6.2832 });
    }

    var cx = cv.width / 2, cy = cv.height / 2, R = size * 0.42 * dpr, focal = size * 2.0 * dpr;
    var t = 0, raf = 0, alive = true;

    function frame() {
      if (!alive) return;
      t += 0.005;
      var ay = t * 0.5, cY = Math.cos(ay), sY = Math.sin(ay);    // 繞垂直軸(水平自轉)
      var ax = t * 0.35, cX = Math.cos(ax), sX = Math.sin(ax);   // 繞橫軸(垂直旋轉,點會上下翻滾)
      var breathe = 0.97 + 0.03 * Math.sin(t * 1.4);
      ctx.clearRect(0, 0, cv.width, cv.height);
      var proj = [], pp, x1, z1, y1, z2;
      for (i = 0; i < pts.length; i++) {
        pp = pts[i];
        x1 = pp.x * cY - pp.z * sY; z1 = pp.x * sY + pp.z * cY;
        y1 = pp.y * cX - z1 * sX; z2 = pp.y * sX + z1 * cX;
        var rb = R * breathe, depth = focal / (focal - z2 * rb);
        proj.push({ sx: cx + x1 * rb * depth, sy: cy + y1 * rb * depth, d: z2, p: pp });
      }
      proj.sort(function (a, b) { return a.d - b.d; });
      for (i = 0; i < proj.length; i++) {
        var q = proj[i], front = (q.d + 1) / 2;
        var tw = 0.82 + 0.18 * Math.sin(t * 2.5 + q.p.ph);
        var a = (0.28 + 0.72 * front) * tw;
        var rad = (0.55 + 1.25 * front) * dpr;
        ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(q.sx, q.sy, rad, 0, 6.2832); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      el: cv,
      stop: function () { alive = false; cancelAnimationFrame(raf); if (cv.parentNode) cv.parentNode.removeChild(cv); }
    };
  }
  window.SFOrb = { mount: mount };
})();
