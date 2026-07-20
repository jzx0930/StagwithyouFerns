/* ===== 植物照片牆 / 成長紀錄站 — 邏輯 ===== */
(function () {
  'use strict';

  var DEFAULT_CATS = ['鹿角蕨', '棒槌樹', '美照'];
  // 模型 CDN 開關:留空=用同源(GitHub Pages,本身就是 Fastly CDN)。
  // 要改用 jsDelivr:設成 'https://cdn.jsdelivr.net/gh/jzx0930/StagwithyouFerns@main/'
  // 注意:jsDelivr @main 會快取最久 7 天,還在改模型時先別開,免得看到舊檔。
  var MODEL_CDN = '';

  var state = {
    view: 'lobby',
    tab: 0,
    selected: 0,
    indiv: 0,
    data: null,
    cats: null,
    lbUrl: null,
    lbScale: 1
  };

  var app = document.getElementById('app');
  var lightbox = document.getElementById('lightbox');

  // ---- 工具 ----
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function driveImg(v, w) {
    if (!v) return null;
    if (/^https?:/i.test(v)) return v;
    return 'https://lh3.googleusercontent.com/d/' + v + '=w' + (w || 1000);
  }
  function coverImg(v, w, alt) {
    var url = driveImg(v, w);
    if (!url) return '';
    return '<img class="cover-img" src="' + esc(url) + '" alt="' + esc(alt || '') +
      '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">';
  }
  function parseCat(nm) {
    var s = String(nm || '');
    var m = s.match(/[A-Za-z][A-Za-z .\-]*$/);
    var latin = m ? m[0].trim() : '';
    var zh = latin ? s.slice(0, s.length - m[0].length).trim() : s.trim();
    if (!zh) zh = s.trim();
    return { zh: zh, latin: latin };
  }
  function normCats() {
    var raw = state.cats || DEFAULT_CATS;
    return raw.map(function (c) {
      var o = (typeof c === 'string') ? { name: c, cover: '' } : c;
      var pc = parseCat(o.name);
      var mpath = '';
      if (o.model === true || o.model === 'auto') { if (pc.latin) mpath = MODEL_CDN + 'models/' + pc.latin + '/' + pc.latin + '.glb'; }
      else if (typeof o.model === 'string' && o.model) { mpath = o.model; }
      return { name: o.name, zh: pc.zh, latin: pc.latin, cover: o.cover || '', fx: o.fx, model: mpath };
    });
  }
  function catOf(p, cats) { return p.category || cats[0].zh; }
  function normIndiv(p) {
    if (Array.isArray(p.individuals) && p.individuals.length) return p.individuals;
    return [{ label: '', cover: p.cover || '', timeline: p.timeline || [] }];
  }
  function photoCount(p) {
    return normIndiv(p).reduce(function (s, iv) { return s + ((iv.timeline || []).length); }, 0);
  }

  // ---- 資料載入 ----
  function load() {
    fetch('./data.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && Array.isArray(d.plants)) {
          state.data = d.plants;
          state.cats = Array.isArray(d.categories) ? d.categories : null;
        } else { state.data = []; }
        render();
      })
      .catch(function () { state.data = []; render(); });
  }

  function go(view) { state.view = view; window.scrollTo(0, 0); render(); }

  // ---- 畫面 ----
  function headerHTML(eyebrow, title, subtitle, withStats, totalPlants, totalPhotos, mid) {
    var stats = withStats ?
      '<div class="stats">' +
        '<div class="stat"><div class="num">' + totalPlants + '</div><div class="lbl">種植物</div></div>' +
        '<div class="stat"><div class="num">' + totalPhotos + '</div><div class="lbl">張照片</div></div>' +
      '</div>' : '';
    return '<div class="head' + (mid ? ' has-mid' : '') + '"><div>' +
      '<div class="eyebrow">' + esc(eyebrow) + '</div>' +
      (title ? '<h1 class="title">' + esc(title) + '</h1>' : '') +
      '<p class="subtitle">' + esc(subtitle) + '</p>' +
      '</div>' + (mid || '') + stats + '</div>';
  }

  // GSAP 交錯進場(有載 GSAP 才跑;沒有就靜態顯示,不影響功能)。
  function animCards(sel, y) {
    if (!window.gsap) return;
    try {
      window.gsap.from(sel, {
        opacity: 0, y: (y || 24), duration: 0.5, stagger: 0.05,
        ease: 'power2.out', clearProps: 'opacity,transform', overwrite: true
      });
    } catch (e) {}
  }
  window.__animLobby = function () { animCards('#app .cat-card', 26); };

  // 進階微互動:植物卡跟隨滑鼠 3D 傾斜 + 按鈕磁吸(需 GSAP;觸控/減少動態自動跳過)。
  var _reduceMotion = false;
  try { _reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function wireTilt() {
    document.querySelectorAll('#app .plant-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        window.gsap.to(card, { rotateY: px * 8, rotateX: -py * 8, y: -8, scale: 1.02, transformPerspective: 800, transformOrigin: 'center', duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('pointerleave', function () {
        window.gsap.to(card, { rotateY: 0, rotateX: 0, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      });
    });
  }

  function wireMagnetic() {
    document.querySelectorAll('#app .pill-btn, #app .tab').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = btn.getBoundingClientRect();
        window.gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      btn.addEventListener('pointerleave', function () {
        window.gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.4)', overwrite: 'auto' });
      });
    });
  }

  function wireInteractions() {
    if (!window.gsap || _reduceMotion) return;
    wireTilt();
    wireMagnetic();
  }

  function renderLobby() {
    var cats = normCats();
    var data = state.data || [];
    var totalPlants = data.length;
    var totalPhotos = data.reduce(function (s, p) { return s + photoCount(p); }, 0);

    var cards = cats.map(function (c, i) {
      var count = data.filter(function (p) { return catOf(p, cats) === c.zh; }).length;
      var useModel = !!c.model;
      var useFern = !useModel && ((c.fx === 'staghorn-fern') || (c.zh === '鹿角蕨'));
      var visual;
      if (useModel) {
        // 真實 3D 模型(.glb)當互動封面,可拖曳旋轉檢視
        visual = '<model-viewer src="' + esc(c.model) + '" poster="' + esc(c.model.replace(/\.glb$/i, '-poster.webp')) + '" camera-controls auto-rotate autoplay auto-rotate-delay="0" rotation-per-second="24deg" disable-zoom interaction-prompt="none" exposure="1.05" shadow-intensity="0.9" environment-image="neutral" touch-action="pan-y" alt="' + esc(c.name) + ' 3D"></model-viewer>';
      } else if (useFern) {
        // 互動式程序生成 3D 鹿角蕨元件(滑鼠視差)
        visual = '<staghorn-fern accent="#9ccb6f" frond-color="#7c9a56" basal-color="#45502a" fronds="9"></staghorn-fern>';
      } else {
        var cover = c.cover;
        if (!cover) { var fp = data.find(function (p) { return catOf(p, cats) === c.zh && p.cover; }); if (fp) cover = fp.cover; }
        visual = '<div class="placeholder"><span>＋ 分類封面</span></div>' + coverImg(cover, 1000, c.name);
      }
      return '<div class="cat-card' + ((useModel || useFern) ? ' fern-card' : '') + '" data-act="enter" data-i="' + i + '">' +
        visual +
        '<div class="cat-shade"></div>' +
        '<div class="cat-meta"><div class="cat-nameblock"><div class="cat-name">' + esc(c.zh) + '</div>' +
        (c.latin ? '<div class="cat-latin">' + esc(c.latin) + '</div>' : '') + '</div>' +
        '<div class="chip">' + count + ' 種</div></div>' +
      '</div>';
    }).join('');

    app.innerHTML = '<div class="wrap">' +
      headerHTML('Herbarium · 分類選單', '', '選一個分類,進入觀看。', true, totalPlants, totalPhotos) +
      '<div class="card-grid">' + cards + '</div></div>';
    animCards('#app .cat-card', 26);
  }

  function renderGrid() {
    var cats = normCats();
    var tabIdx = Math.min(state.tab, cats.length - 1);
    var activeCat = cats[tabIdx].zh;
    var data = state.data || [];

    var tabs = cats.map(function (c, i) {
      var n = data.filter(function (p) { return catOf(p, cats) === c.zh; }).length;
      return '<div class="tab' + (i === tabIdx ? ' active' : '') + '" data-act="tab" data-i="' + i + '">' +
        esc(c.zh) + '<span class="c">' + n + '</span></div>';
    }).join('');

    var indexed = data.map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) { return catOf(x.p, cats) === activeCat; });

    var cards = indexed.map(function (x) {
      var p = x.p;
      var cover = coverImg(p.cover, 900, p.name);
      var ph = cover ? '' : '<div class="placeholder"><span>＋ 封面照片</span></div>';
      return '<div class="plant-card" data-act="open" data-i="' + x.i + '">' +
        '<div class="pc-cover">' + ph + cover +
          '<span class="pc-count">' + photoCount(p) + ' 張</span></div>' +
        '<div class="pc-body">' +
          '<div class="pc-name">' + esc(p.name) + '</div>' +
          '<div class="pc-latin">' + esc(p.latin || '') + '</div>' +
          '<div class="rule"></div>' +
          '<div class="pc-foot"><span class="pc-date">入手 ' + esc(p.date || '') + '</span>' +
            '<span class="pc-go">看成長 →</span></div>' +
          (p.note ? '<div class="pc-note">— ' + esc(p.note) + '</div>' : '') +
        '</div></div>';
    }).join('');

    var totalPhotos = indexed.reduce(function (s, x) { return s + photoCount(x.p); }, 0);
    var cat = cats[tabIdx];
    var hero = cat.model ?
      '<div class="cat-hero"><model-viewer src="' + esc(cat.model) + '" poster="' + esc(cat.model.replace(/\.glb$/i, '-poster.webp')) + '" camera-controls auto-rotate autoplay auto-rotate-delay="0" rotation-per-second="24deg" disable-zoom interaction-prompt="none" exposure="1.05" shadow-intensity="0.9" environment-image="neutral" touch-action="pan-y" alt="' + esc(activeCat) + ' 3D"></model-viewer></div>' : '';
    var empty = indexed.length ? '' :
      '<p class="subtitle" style="margin-top:8px;">這個分類還沒有植物。</p>';

    app.innerHTML = '<div class="wrap">' +
      '<div class="back-row"><span class="pill-btn" data-act="lobby">← 回到分類大廳</span></div>' +
      headerHTML('Herbarium · 成長紀錄', activeCat, '點任一株,進入牠的成長時間軸。', true, indexed.length, totalPhotos, hero) +
      '<div class="tabs">' + tabs + '</div>' +
      '<div class="card-grid">' + cards + '</div>' + empty +
      '</div>';
    animCards('#app .plant-card', 20);
  }

  function renderDetail() {
    var data = state.data || [];
    var sel = data[state.selected] || data[0] || { name: '', latin: '', date: '', individuals: [] };
    var indivs = normIndiv(sel);
    var ii = Math.min(state.indiv || 0, indivs.length - 1);
    if (ii < 0) ii = 0;
    var cur = indivs[ii] || { label: '', timeline: [] };

    var entries = (cur.timeline || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    entries.reverse();
    var total = entries.length;

    var rows = entries.map(function (e, i) {
      var parts = String(e.date || '').split('.');
      var y = parts[0] || '', md = (parts[1] || '') + '.' + (parts[2] || '');
      var num = String(i + 1).padStart(2, '0');
      var tot = String(total).padStart(2, '0');
      var photo;
      if (e.photo) {
        var url = driveImg(e.photo, 1600);
        var big = driveImg(e.photo, 2600);
        photo = '<div class="tl-photo">' +
          '<img src="' + esc(url) + '" alt="' + esc(e.tag || '') + '" onerror="this.style.display=\'none\'">' +
          '<span class="tag">' + esc(e.tag || '') + '</span>' +
          '<span class="idx">' + num + ' / ' + tot + '</span>' +
          '<span class="fs-btn" data-act="zoom" data-url="' + esc(big) + '">⤢ 全螢幕</span>' +
        '</div>';
      } else {
        photo = '<div class="tl-empty"><span>尚未加入照片</span><span class="tag">' + esc(e.tag || '') + '</span></div>';
      }
      return '<div class="tl-row">' +
        '<div class="tl-when"><div class="y">' + esc(y) + '</div><div class="md">' + esc(md) + '</div></div>' +
        '<div class="tl-axis"><div class="line"></div><div class="dot"></div></div>' +
        '<div class="tl-main"><div class="tl-card">' + photo +
          '<div class="tl-note">' + esc(e.note || '') + '</div></div></div>' +
      '</div>';
    }).join('');
    if (!total) rows = '<p class="subtitle" style="margin-left:108px;">這個個體還沒有照片。</p>';

    var showIndiv = indivs.length > 1 || (indivs.length === 1 && !!cur.label);
    var picker = '';
    if (showIndiv) {
      picker = '<div class="tl-head"><h2>選擇個體</h2><div class="tl-order">共 ' + indivs.length + ' 株</div></div>' +
        '<div class="tabs">' + indivs.map(function (iv, i) {
          var lbl = iv.label || '未編號';
          return '<div class="tab' + (i === ii ? ' active' : '') + '" data-act="indiv" data-i="' + i + '">' +
            esc(lbl) + '<span class="c">' + ((iv.timeline || []).length) + '</span></div>';
        }).join('') + '</div>';
    }

    var no = String(state.selected + 1).padStart(3, '0');
    var indivMetric = showIndiv
      ? '<div class="metric"><div class="k">目前個體</div><div class="v">' + esc(cur.label || '未編號') + '</div></div>'
      : '';

    app.innerHTML = '<div class="wrap narrow">' +
      '<span class="pill-btn" data-act="lobby-from-detail">← 回到照片牆</span>' +
      '<div style="margin:34px 0 12px;">' +
        '<div class="eyebrow">No. ' + no + ' · Growth Log</div>' +
        '<h1 class="title">' + esc(sel.name) + '</h1>' +
        '<div class="detail-latin">' + esc(sel.latin || '') + '</div>' +
      '</div>' +
      '<div class="metrics">' +
        '<div class="metric"><div class="k">入手 / 種植</div><div class="v">' + esc(sel.date || '') + '</div></div>' +
        '<div class="metric"><div class="k">累積照片</div><div class="v">' + photoCount(sel) + ' 張</div></div>' +
        indivMetric +
      '</div>' +
      picker +
      '<div class="tl-head"><h2>成長時間軸</h2><div class="tl-order">最新 → 最早</div></div>' +
      '<div>' + rows + '</div>' +
      '<div class="detail-footer"><span class="pill-btn" data-act="back-grid">↑ 回到照片牆</span></div>' +
    '</div>';
  }

  function render() {
    if (state.view === 'lobby') renderLobby();
    else if (state.view === 'grid') renderGrid();
    else renderDetail();
    if (window.__fxMode) window.__fxMode(state.view);
    wireInteractions();   // 掛上滑鼠傾斜 / 磁吸(每次重繪後重掛)
  }

  // ---- 事件委派 ----
  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var i = parseInt(t.getAttribute('data-i'), 10);
    if (act === 'enter') { state.tab = i; go('grid'); }
    else if (act === 'tab') { state.tab = i; render(); }
    else if (act === 'open') { state.selected = i; state.indiv = 0; go('detail'); }
    else if (act === 'indiv') { state.indiv = i; render(); }
    else if (act === 'lobby' || act === 'lobby-from-detail') { go('lobby'); }
    else if (act === 'back-grid') { go('grid'); }
    else if (act === 'zoom') { openLightbox(t.getAttribute('data-url')); }
  });

  // ---- 燈箱 ----
  function openLightbox(url) {
    if (!url) return;
    state.lbUrl = url; state.lbScale = 1;
    renderLightbox();
  }
  function closeLightbox() { state.lbUrl = null; state.lbScale = 1; lightbox.hidden = true; lightbox.innerHTML = ''; }
  function cycleZoom() { var s = state.lbScale; state.lbScale = s >= 3.4 ? 1 : (s >= 1.9 ? 3.5 : 2); renderLightbox(); }
  function renderLightbox() {
    var sc = state.lbScale;
    lightbox.hidden = false;
    lightbox.classList.toggle('zoomed', sc !== 1);
    var imgStyle = sc === 1 ? '' : 'width:' + (sc * 100) + 'vw;';
    var label = sc === 1 ? '點圖片放大看細節' : (Math.round(sc * 100) + '% · 點圖片切換');
    lightbox.innerHTML =
      '<img src="' + esc(state.lbUrl) + '" alt="" style="' + imgStyle + '">' +
      '<div class="lb-close" data-lb="close">✕ 關閉</div>' +
      '<div class="lb-label">' + label + '</div>';
  }
  lightbox.addEventListener('click', function (ev) {
    if (ev.target.tagName === 'IMG') { ev.stopPropagation(); cycleZoom(); return; }
    closeLightbox();
  });

  // ---- 3D 互動粒子背景(純 Canvas,滑鼠視差) ----
  function init3D() {
    var bg = document.getElementById('bg');
    if (!bg || !document.createElement('canvas').getContext) return;
    var canvas = document.createElement('canvas');
    canvas.id = 'fx3d';
    bg.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var W, H, DPR, cx, cy, R;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = Math.floor(window.innerWidth * DPR);
      H = canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.62;
    }
    resize();
    window.addEventListener('resize', resize);

    var N = 130, focal = 3.0, pts = [];
    for (var k = 0; k < N; k++) {
      pts.push({
        x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 2 - 1,
        vx: (Math.random() - 0.5) * 0.0011, vy: (Math.random() - 0.5) * 0.0011, vz: (Math.random() - 0.5) * 0.0011,
        s: 0.5 + Math.random() * 1.6, ph: Math.random() * Math.PI * 2, sp: 0.3 + Math.random() * 0.7
      });
    }

    var tRotY = 0, tRotX = 0, rotY = 0, rotX = 0, autoYaw = 0, t = 0, fade = 1, targetFade = 1;
    window.addEventListener('pointermove', function (e) {
      var mx = (e.clientX / window.innerWidth) * 2 - 1;
      var my = (e.clientY / window.innerHeight) * 2 - 1;
      tRotY = mx * 0.5; tRotX = -my * 0.35;
    });
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma == null) return;
      tRotY = Math.max(-1, Math.min(1, e.gamma / 45)) * 0.5;
      tRotX = Math.max(-1, Math.min(1, e.beta / 90)) * 0.35;
    });
    window.__fxMode = function (view) { targetFade = (view === 'lobby') ? 1 : 0.2; };

    // 背景隨捲動視差移動(螢火蟲維持固定飄浮)
    var bgPhoto = document.querySelector && document.querySelector('.bg-photo');
    function parallax() {
      if (!bgPhoto) return;
      var sh = (document.documentElement || {}).scrollHeight || 0;
      var max = sh - window.innerHeight;
      var frac = max > 0 ? Math.min(1, Math.max(0, (window.scrollY || 0) / max)) : 0;
      var shift = (0.16 - frac * 0.32) * window.innerHeight;
      bgPhoto.style.transform = 'translateY(' + shift.toFixed(1) + 'px) scale(1.05)';
    }
    window.addEventListener('scroll', parallax, { passive: true });
    window.addEventListener('resize', parallax);
    parallax();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame() {
      t += 0.006;
      if (!reduce) autoYaw += 0.0003;
      rotY += (tRotY - rotY) * 0.05;
      rotX += (tRotX - rotX) * 0.05;
      fade += (targetFade - fade) * 0.05;

      var ay = rotY + autoYaw, ax = rotX;
      var cosY = Math.cos(ay), sinY = Math.sin(ay), cosX = Math.cos(ax), sinX = Math.sin(ax);

      ctx.clearRect(0, 0, W, H);
      if (fade < 0.02) { requestAnimationFrame(frame); return; }
      ctx.globalCompositeOperation = 'lighter';

      var proj = new Array(N), i, p;
      for (i = 0; i < N; i++) {
        p = pts[i];
        if (!reduce) {
          p.x += p.vx; p.y += p.vy; p.z += p.vz;
          if (p.x > 1) p.x = -1; else if (p.x < -1) p.x = 1;
          if (p.y > 1) p.y = -1; else if (p.y < -1) p.y = 1;
          if (p.z > 1) p.z = -1; else if (p.z < -1) p.z = 1;
        }
        var x1 = p.x * cosY - p.z * sinY;
        var z1 = p.x * sinY + p.z * cosY;
        var y1 = p.y * cosX - z1 * sinX;
        var z2 = p.y * sinX + z1 * cosX;
        var depth = focal / (focal - z2);
        proj[i] = { sx: cx + x1 * R * depth, sy: cy + y1 * R * depth, sc: depth, p: p };
      }

      // 螢火蟲:不畫點與點之間的連線

      for (i = 0; i < N; i++) {
        var q = proj[i]; p = q.p;
        var tw = 0.45 + 0.55 * Math.sin(t * 6 * p.sp + p.ph);
        var r = Math.max(0.4, p.s * q.sc * 1.5 * DPR);
        var a1 = Math.max(0, Math.min(1, tw)) * Math.min(1, q.sc * 0.9) * fade;
        if (a1 <= 0.004) continue;
        var g = ctx.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, r * 5);
        g.addColorStop(0, 'rgba(226,255,170,' + (a1 * 0.95) + ')');
        g.addColorStop(0.3, 'rgba(172,240,112,' + (a1 * 0.5) + ')');
        g.addColorStop(1, 'rgba(110,200,70,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(234,255,196,' + a1 + ')';
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }
    frame();
  }

  // ---- 啟動 ----
  init3D();
  load();
})();
