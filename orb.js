/* ===== SFOrb:載入球體(自製 canvas,零依賴)=====
   淡淡的靜止點陣球(維持球型)為底,上面一條「亮的經線」繞垂直軸旋轉橫掃 + 一條「亮的緯線」上下移動;
   前亮後淡的深度感、輕微明滅。球本身不轉,只有那兩條線在動。
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

    // 靜止底球:經緯格線
    var base = [], M = Math.max(14, Math.round(Math.sqrt(count * 1.5))), P = Math.max(8, Math.round(M * 0.7)), m, p;
    for (m = 0; m < M; m++) {
      var lon = 2 * Math.PI * m / M, cl = Math.cos(lon), sl = Math.sin(lon);
      for (p = 1; p < P; p++) {
        var phi = Math.PI * p / P, y = Math.cos(phi), r = Math.sin(phi);
        base.push({ x: cl * r, y: y, z: sl * r, ph: Math.random() * 6.2832 });
      }
    }
    base.push({ x: 0, y: 1, z: 0, ph: 0 }); base.push({ x: 0, y: -1, z: 0, ph: 0 });

    var LN = Math.max(10, P + 4);                 // 掃描線上的點數
    var cx = cv.width / 2, cy = cv.height / 2, R = size * 0.42 * dpr, focal = size * 2.0 * dpr;
    var tilt = -0.32, cX = Math.cos(tilt), sX = Math.sin(tilt);   // 固定俯角(球不轉)
    var t = 0, raf = 0, alive = true;

    function push(arr, x, y, z, w, ph) {
      var y1 = y * cX - z * sX, z1 = y * sX + z * cX;             // 只套固定俯角
      var depth = focal / (focal - z1 * R);
      arr.push({ sx: cx + x * R * depth, sy: cy + y1 * R * depth, d: z1, w: w, ph: ph });
    }

    function frame() {
      if (!alive) return;
      t += 1;
      var lonSweep = t * 0.02;                                    // 亮經線:繞垂直軸橫掃
      var latPhi = Math.PI * (0.5 + 0.42 * Math.sin(t * 0.018));  // 亮緯線:上下移動
      ctx.clearRect(0, 0, cv.width, cv.height);
      var arr = [], i;
      for (i = 0; i < base.length; i++) { var b = base[i]; push(arr, b.x, b.y, b.z, 0.16, b.ph); }   // 淡底球
      var clS = Math.cos(lonSweep), slS = Math.sin(lonSweep);     // 亮經線(直)
      for (i = 1; i < P + 2; i++) { var ph1 = Math.PI * i / (P + 2), yy = Math.cos(ph1), rr = Math.sin(ph1); push(arr, clS * rr, yy, slS * rr, 1, 0); }
      var yL = Math.cos(latPhi), rL = Math.sin(latPhi);           // 亮緯線(橫)
      for (i = 0; i < LN; i++) { var lo = 2 * Math.PI * i / LN; push(arr, Math.cos(lo) * rL, yL, Math.sin(lo) * rL, 1, 0); }

      arr.sort(function (a, b) { return a.d - b.d; });
      for (i = 0; i < arr.length; i++) {
        var o = arr[i], front = (o.d + 1) / 2;
        var tw = o.w < 0.5 ? (0.7 + 0.3 * Math.sin(t * 0.05 + o.ph)) : 1;
        var al = o.w * (0.3 + 0.7 * front) * tw;
        var rad = (0.5 + (o.w < 0.5 ? 1.0 : 1.6) * front) * dpr;
        ctx.fillStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(o.sx, o.sy, rad, 0, 6.2832); ctx.fill();
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
