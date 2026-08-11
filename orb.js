/* ===== SFOrb:點陣思考球體(仿 orbs.jakubantalik.com 的 dotted thinking orb)=====
   單色白點,排成「經緯網格地球」(有直的經線),繞垂直軸自轉 → 經線橫掃過去、明顯在轉;
   前亮後淡的深度層次、微呼吸、輕微明滅,乾淨不發光。
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

    // 經緯網格:M 條經線(直的子午線)× 每條 P 個點;繞垂直軸轉時經線會掃過去(看得出旋轉)
    var pts = [], M = Math.max(14, Math.round(Math.sqrt(count * 1.6))), P = Math.max(8, Math.round(M * 0.62)), m, p;
    for (m = 0; m < M; m++) {
      var lon = 2 * Math.PI * m / M, cl = Math.cos(lon), sl = Math.sin(lon);
      for (p = 1; p < P; p++) {
        var phi = Math.PI * p / P, yy = Math.cos(phi), rr = Math.sin(phi);
        pts.push({ x: cl * rr, y: yy, z: sl * rr, ph: Math.random() * 6.2832 });
      }
    }
    pts.push({ x: 0, y: 1, z: 0, ph: 0 }); pts.push({ x: 0, y: -1, z: 0, ph: 0 });   // 兩極

    var cx = cv.width / 2, cy = cv.height / 2, R = size * 0.42 * dpr, focal = size * 2.0 * dpr;
    var tilt = -0.32, cX = Math.cos(tilt), sX = Math.sin(tilt);   // 固定俯角,看得到球面弧度
    var t = 0, raf = 0, alive = true;

    function frame() {
      if (!alive) return;
      t += 0.005;
      var ay = t * 0.55, cY = Math.cos(ay), sY = Math.sin(ay);   // 繞垂直軸自轉
      var breathe = 0.97 + 0.03 * Math.sin(t * 1.4);
      ctx.clearRect(0, 0, cv.width, cv.height);
      var proj = [], i, pp, x1, z1, y1, z2;
      for (i = 0; i < pts.length; i++) {
        pp = pts[i];
        x1 = pp.x * cY - pp.z * sY; z1 = pp.x * sY + pp.z * cY;
        y1 = pp.y * cX - z1 * sX; z2 = pp.y * sX + z1 * cX;
        var rb = R * breathe, depth = focal / (focal - z2 * rb);
        proj.push({ sx: cx + x1 * rb * depth, sy: cy + y1 * rb * depth, d: z2, p: pp });
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
