/* ===== SFOrb:點陣思考球體(仿 orbs.jakubantalik.com 的 dotted thinking orb)=====
   單色白點、依緯度環分佈成「點陣地球」,自轉 + 微呼吸 + 前亮後淡的深度層次(乾淨、不發光)。
   用法:var o = SFOrb.mount(container, { size:130, count:360, color:'232,244,238' }); 結束時 o.stop(); */
(function () {
  'use strict';
  function mount(container, opts) {
    opts = opts || {};
    var size = opts.size || 130, count = opts.count || 360, col = opts.color || '232,244,238';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');

    // 依緯度環分佈(每環點數 ∝ 該緯度圓周),做出點陣地球的緯線層次
    var pts = [], rings = Math.max(7, Math.round(Math.sqrt(count * 0.9))), la, lo;
    for (la = 0; la < rings; la++) {
      var phi = Math.PI * (la + 0.5) / rings, y = Math.cos(phi), rr = Math.sin(phi);
      var circ = Math.max(1, Math.round(rings * 2.1 * rr));
      for (lo = 0; lo < circ; lo++) {
        var th = 2 * Math.PI * (lo + (la % 2) * 0.5) / circ;   // 隔環錯半格,排列更自然
        pts.push({ x: Math.cos(th) * rr, y: y, z: Math.sin(th) * rr, ph: Math.random() * 6.2832 });
      }
    }
    var cx = cv.width / 2, cy = cv.height / 2, R = size * 0.42 * dpr, focal = size * 2.0 * dpr;
    var tilt = -0.42, cX = Math.cos(tilt), sX = Math.sin(tilt);   // 固定俯角,讓緯線環看得出來
    var t = 0, raf = 0, alive = true;

    function frame() {
      if (!alive) return;
      t += 0.005;
      var ay = t * 0.8, cY = Math.cos(ay), sY = Math.sin(ay);
      var breathe = 0.97 + 0.03 * Math.sin(t * 1.4);
      ctx.clearRect(0, 0, cv.width, cv.height);
      var proj = [], i, p, x1, z1, y1, z2;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        x1 = p.x * cY - p.z * sY; z1 = p.x * sY + p.z * cY;
        y1 = p.y * cX - z1 * sX; z2 = p.y * sX + z1 * cX;
        var rb = R * breathe, depth = focal / (focal - z2 * rb);
        proj.push({ sx: cx + x1 * rb * depth, sy: cy + y1 * rb * depth, d: z2, p: p });
      }
      proj.sort(function (a, b) { return a.d - b.d; });   // 後 → 前,乾淨層疊
      for (i = 0; i < proj.length; i++) {
        var q = proj[i], front = (q.d + 1) / 2;
        var tw = 0.85 + 0.15 * Math.sin(t * 2.5 + q.p.ph);
        var a = (0.14 + 0.86 * front * front) * tw;         // 後面很淡、前面亮,深度分明
        var rad = (0.5 + 1.5 * front) * dpr;
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
