/* ===== SFOrb:載入球體(自製 canvas,零依賴)=====
   完整的點陣「經緯格線球」一直都在(球不整顆轉);隨機挑「一條經線或一條緯線」,
   像俄羅斯方塊那樣轉 90°(隨機正轉/逆轉),一次只有一條在轉,轉完再換下一條。
   用法:var o = SFOrb.mount(container, { size:130, count:340, color:'232,244,238' }); 結束時 o.stop(); */
(function () {
  'use strict';
  function rot(x, y, z, axis, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    if (axis === 'y') return [x * c - z * s, y, x * s + z * c];
    if (axis === 'x') return [x, y * c - z * s, y * s + z * c];
    return [x * c - y * s, x * s + y * c, z];  // z
  }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function mount(container, opts) {
    opts = opts || {};
    var size = opts.size || 130, count = opts.count || 340, col = opts.color || '232,244,238';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');

    // 經緯格線交點:meridians[m] = 一條經線的點;parallels[p] = 一條緯線的點
    var M = Math.max(14, Math.round(Math.sqrt(count * 1.5))), P = Math.max(8, Math.round(M * 0.72));
    var baseAll = [], meridians = [], parallels = [], m, p;
    for (p = 1; p < P; p++) parallels[p] = [];
    for (m = 0; m < M; m++) {
      var lon = 2 * Math.PI * m / M, cl = Math.cos(lon), sl = Math.sin(lon), mer = [];
      for (p = 1; p < P; p++) {
        var phi = Math.PI * p / P, y = Math.cos(phi), r = Math.sin(phi);
        var pt = { x: cl * r, y: y, z: sl * r, ph: Math.random() * 6.2832 };
        mer.push(pt); parallels[p].push(pt); baseAll.push(pt);
      }
      meridians.push(mer);
    }
    baseAll.push({ x: 0, y: 1, z: 0, ph: 0 }); baseAll.push({ x: 0, y: -1, z: 0, ph: 0 });

    var cx = cv.width / 2, cy = cv.height / 2, R = size * 0.42 * dpr, focal = size * 2.0 * dpr;
    var tilt = -0.32, cX = Math.cos(tilt), sX = Math.sin(tilt);   // 固定俯角(球不整顆轉)
    var t = 0, raf = 0, alive = true;
    var ROT = 22, HOLD = 12, FADE = 16, GAP = 10;                 // 轉/停/淡出/間隔(frame)
    var act = null;

    function nextActive() {
      var isMer = Math.random() < 0.55;
      var line, axis;
      if (isMer) { line = meridians[(Math.random() * M) | 0]; axis = 'y'; }               // 經線繞垂直軸掃
      else { line = parallels[1 + ((Math.random() * (P - 1)) | 0)] || parallels[1]; axis = Math.random() < 0.5 ? 'x' : 'z'; } // 緯線翻轉
      act = { line: line, axis: axis, target: (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2, f: 0 };
    }
    nextActive();

    function put(arr, x, y, z, w, ph) {
      var y1 = y * cX - z * sX, z1 = y * sX + z * cX, depth = focal / (focal - z1 * R);
      arr.push({ sx: cx + x * R * depth, sy: cy + y1 * R * depth, d: z1, w: w, ph: ph });
    }

    function frame() {
      if (!alive) return;
      t += 1;
      ctx.clearRect(0, 0, cv.width, cv.height);
      var arr = [], i;
      for (i = 0; i < baseAll.length; i++) { var b = baseAll[i]; put(arr, b.x, b.y, b.z, 0.5, b.ph); }  // 完整底球

      if (act) {                                            // 目前這條線轉動
        act.f += 1;
        var ang = act.target, fade = 1;
        if (act.f <= ROT) ang = act.target * ease(act.f / ROT);
        else if (act.f <= ROT + HOLD) ang = act.target;
        else if (act.f <= ROT + HOLD + FADE) { ang = act.target; fade = 1 - (act.f - ROT - HOLD) / FADE; }
        else if (act.f > ROT + HOLD + FADE + GAP) { nextActive(); ang = 0; fade = 1; }
        else { ang = act.target; fade = 0; }
        if (fade > 0) for (i = 0; i < act.line.length; i++) {
          var q = act.line[i], rq = rot(q.x, q.y, q.z, act.axis, ang);
          put(arr, rq[0], rq[1], rq[2], 1 + fade, q.ph);    // w>1 標記為亮線
        }
      }

      arr.sort(function (a, b) { return a.d - b.d; });
      for (i = 0; i < arr.length; i++) {
        var o = arr[i], front = (o.d + 1) / 2, bright = o.w > 1;
        var wv = bright ? (o.w - 1) : o.w;                  // 亮線的 fade 存在 w-1
        var tw = bright ? 1 : (0.72 + 0.28 * Math.sin(t * 0.05 + o.ph));
        var al = (bright ? wv : 1) * (bright ? 0.55 : o.w) * (0.34 + 0.66 * front) * tw;
        var rad = (0.5 + (bright ? 1.7 : 1.0) * front) * dpr;
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
