/* ===== 植物照片牆 / 成長紀錄站 — 邏輯 ===== */
(function () {
  'use strict';

  var DEFAULT_CATS = ['鹿角蕨', '棒槌', '日記'];
  // 模型 CDN 開關:留空=用同源(GitHub Pages,本身就是 Fastly CDN)。
  // 要改用 jsDelivr:設成 'https://cdn.jsdelivr.net/gh/jzx0930/StagwithyouFerns@main/'
  // 注意:jsDelivr @main 會快取最久 7 天,還在改模型時先別開,免得看到舊檔。
  var MODEL_CDN = '';

  // 社群連結(大廳底部)。要改網址/增減平台改這裡即可。
  var SOCIAL = [
    { name: 'Instagram', url: 'https://www.instagram.com/stagwithyou.ferns/',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>' },
    { name: 'Threads', url: 'https://www.threads.com/@stagwithyou.ferns',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.1 11.2c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.8-4.6-4.8-1.7 0-3.1.7-3.9 2.1l1.5 1c.6-.9 1.5-1.2 2.4-1.2 1.4 0 2.5 1 2.7 2.5-.6-.1-1.2-.2-1.9-.2-2.5 0-4.1 1.4-4 3.4.1 1.7 1.5 2.7 3.2 2.7 1.5 0 3-.8 3.5-2.7.3.6.5 1.3.5 1.9 0 2-1.6 4-5 4-3.1 0-5-2-5-5.7 0-3.7 1.9-5.8 5-5.8 2.2 0 4 1 4.9 3l1.6-.6C16.9 5.4 14.6 4 11.6 4 7.3 4 4.5 6.9 4.5 12s2.8 7.9 7.1 7.9c4.5 0 6.8-2.9 6.8-5.7 0-1.6-.7-2.8-1.3-3zm-4.7 3.3c-.9 0-1.5-.4-1.5-1.1 0-.7.7-1.2 2-1.2.5 0 1 .1 1.5.2-.2 1.4-1.1 2.1-2 2.1z"/></svg>' },
    { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61562676299178',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.6 21v-7.1h2.4l.4-2.9h-2.8V9.1c0-.8.3-1.4 1.5-1.4h1.4V5.1c-.7-.1-1.5-.2-2.4-.2-2.4 0-3.9 1.4-3.9 4v2.1H7.7v2.9h2.5V21h3.4z"/></svg>' }
  ];
  function socialBar() {
    var about = '<span class="social-link about-link" data-act="about" role="button" tabindex="0" aria-label="關於" title="關於">關於</span>';
    var kb = '<span class="social-link about-link" data-act="knowledge" role="button" tabindex="0" aria-label="知識庫" title="知識庫">知識庫</span>';
    var nav = '<span class="nav-links">' + about + kb + '</span>';
    return '<div class="social-bar" data-lay="lobby.social">' + nav + SOCIAL.map(function (s) {
      return '<a class="social-link" href="' + s.url + '" target="_blank" rel="noopener noreferrer" aria-label="' + s.name + '" title="' + s.name + '">' + s.icon + '<span>' + s.name + '</span></a>';
    }).join('') + '</div>';
  }

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
  // 筆記格式:先轉義,再套用 ***斜體***(學名)、**粗體** 與換行。
  function fmtNote(s) {
    var e = esc(s || '');
    e = e.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<em>$1</em>');
    e = e.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return e.replace(/\n/g, '<br>');
  }
  // 植物筆記:優先取獨立筆記檔 plant-notes.js(不受 Drive 重建影響),沒有才用 data.json 的 note。
  function noteOf(p) {
    return (window.PLANT_NOTES && p && window.PLANT_NOTES[p.name]) || (p && p.note) || '';
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
  // 個體顯示:有暱稱→「暱稱（#NN）」;只有編號→「#NN」;只有暱稱→「暱稱」;都沒有→「未編號」
  // 個體編號排序用:從 label 取出數字(#08→8);無編號→-1(排最前)
  function indivNum(lb) { var m = String(lb == null ? '' : lb).match(/\d+/); return m ? parseInt(m[0], 10) : -1; }
  function indivLabel(iv) {
    var nm = iv && iv.name, lb = iv && iv.label;
    if (nm && lb) return nm + '（' + lb + '）';
    return nm || lb || '未編號';
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
    if (window.SITE_CONFIG && SITE_CONFIG.effects && SITE_CONFIG.effects.cardEntrance === false) return;
    try {
      window.gsap.from(sel, {
        opacity: 0, y: (y || 24), duration: 0.5, stagger: 0.05,
        ease: 'power2.out', clearProps: 'opacity,transform', overwrite: true
      });
    } catch (e) {}
  }
  window.__animLobby = function () { animCards('#app .cat-card', 26); };

  // 購物:價格 + 加入購物車(只有 SHOP.enabled 才出現)。
  function shopRow(p, idx, big) {
    if (!(window.SHOP && window.SHOP.enabled)) return '';
    var price = window.SHOP.fmt(p.name) || '價格洽詢';
    return '<div class="pc-shop' + (big ? ' big' : '') + '">' +
      '<span class="pc-price">' + esc(price) + '</span>' +
      '<button class="cart-btn" data-act="add-cart" data-i="' + idx + '">＋ 加入購物車</button>' +
    '</div>';
  }

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
    var fx = (window.SITE_CONFIG && SITE_CONFIG.effects) || {};
    if (fx.cardTilt !== false) wireTilt();
    if (fx.magneticButtons !== false) wireMagnetic();
  }

  // 進入植物詳情時,名稱「一筆一畫」手寫出來(中文走 Hanzi Writer 筆順;英數淡入),寫完淡入 latin。
  var _lastTyped = -1;
  function _hwFallback(el, ch, size) {
    el.textContent = ch;
    el.style.font = '400 ' + size + 'px var(--serif)';
    el.style.color = 'var(--ink-strong)';
    el.style.lineHeight = size + 'px';
  }
  function runDetailIntro() {
    var t = document.getElementById('sf-dtitle'), la = document.getElementById('sf-dlatin');
    if (!t) return;
    var full = t.textContent;
    var showAll = function () { t.textContent = full; if (la) la.style.opacity = '1'; };
    if (_reduceMotion || !window.HanziWriter) { showAll(); return; }        // 降級:直接顯示
    if (state.selected === _lastTyped) { showAll(); return; }               // 切換個體不重寫
    _lastTyped = state.selected;

    var HW = (window.SITE_CONFIG && SITE_CONFIG.handwriting) || {};
    var spd = HW.cjkSpeed || 3.5;
    var dly = (typeof HW.cjkStrokeDelay === 'number') ? HW.cjkStrokeDelay : 10;
    var ld = HW.latinDuration || 0.42;
    var size = Math.round(parseFloat(getComputedStyle(t).fontSize) || 50);
    var isCJK = function (c) { return /[㐀-鿿豈-﫿]/.test(c); };
    var chars = Array.from(full);
    t.textContent = '';
    t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.flexWrap = 'wrap'; t.style.minHeight = size + 'px';
    if (la) la.style.opacity = '0';

    // 全部字「同時」開寫(平行、快):中文照筆順、英數用手寫體由左到右書寫揭示;全部寫完淡入 latin。
    var pending = 0;
    function done() {
      if (--pending > 0) return;
      if (la) { if (window.gsap) window.gsap.to(la, { opacity: 1, duration: 0.4, ease: 'power2.out' }); else la.style.opacity = '1'; }
    }
    chars.forEach(function (ch) {
      if (ch === ' ') { var sp = document.createElement('span'); sp.style.width = '0.35em'; t.appendChild(sp); return; }
      pending++;
      if (isCJK(ch)) {
        var d = document.createElement('div'); d.style.cssText = 'width:' + size + 'px;height:' + size + 'px;flex:0 0 auto;'; t.appendChild(d);
        var moved = false, go = function () { if (moved) return; moved = true; done(); };
        setTimeout(go, 3500);
        try {
          var w = window.HanziWriter.create(d, ch, {
            width: size, height: size, padding: 1, showOutline: false, showCharacter: false,
            strokeColor: '#f4f8f4', strokeAnimationSpeed: spd, delayBetweenStrokes: dly,
            onLoadCharDataError: function () { _hwFallback(d, ch, size); go(); }
          });
          w.animateCharacter({ onComplete: go });
        } catch (e) { _hwFallback(d, ch, size); go(); }
      } else {
        var s = document.createElement('span');
        s.textContent = ch;
        s.style.cssText = "font-family:'Caveat',cursive;font-weight:600;font-size:" + Math.round(size * 1.12) + "px;line-height:" + size + "px;color:#f4f8f4;white-space:pre;clip-path:inset(0 100% 0 0);-webkit-clip-path:inset(0 100% 0 0);transition:clip-path " + ld + "s ease,-webkit-clip-path " + ld + "s ease;";
        t.appendChild(s);
        var moved2 = false, go2 = function () { if (moved2) return; moved2 = true; done(); };
        s.addEventListener('transitionend', go2, { once: true });
        setTimeout(go2, 1000);
        requestAnimationFrame(function () { s.style.clipPath = 'inset(0 0 0 0)'; s.style.webkitClipPath = 'inset(0 0 0 0)'; });
      }
    });
    if (pending === 0 && la) la.style.opacity = '1';
  }

  // ---- 知識庫(文章在 knowledge.js)----
  function kbBodyHTML(body) {
    var html = '', inUl = false;
    function closeUl() { if (inUl) { html += '</ul>'; inUl = false; } }
    (body || []).forEach(function (ln) {
      if (ln == null || ln === '') { closeUl(); html += '<div class="kb-gap"></div>'; return; }
      if (/^#\s/.test(ln)) { closeUl(); html += '<h3 class="kb-h">' + esc(ln.replace(/^#\s/, '')) + '</h3>'; return; }
      if (/^[•\-]\s/.test(ln)) { if (!inUl) { html += '<ul class="kb-ul">'; inUl = true; } html += '<li>' + esc(ln.replace(/^[•\-]\s/, '')) + '</li>'; return; }
      closeUl(); html += '<p class="kb-p">' + esc(ln) + '</p>';
    });
    closeUl();
    return html;
  }
  function renderKnowledge() {
    var cats = (window.SF_KNOWLEDGE_CATS || []), arts = (window.SF_KNOWLEDGE || []);
    var cur = state.kbGroup || '全部';
    // 依文章出現順序收集不重複的「植物類別」
    var groups = [];
    arts.forEach(function (a) { var g = a.group || '其他'; if (groups.indexOf(g) < 0) groups.push(g); });
    var chips = '<div class="kb-filter" data-lay="kb.filter">' +
      ['全部'].concat(groups).map(function (g) {
        return '<span class="kb-chip' + (g === cur ? ' on' : '') + '" data-act="kb-group" data-id="' + esc(g) + '">' + esc(g) + '</span>';
      }).join('') + '</div>';
    var shown = arts.filter(function (a) { return cur === '全部' || (a.group || '其他') === cur; });
    var secs = cats.map(function (c) {
      var items = shown.filter(function (a) { return a.cat === c; });
      if (!items.length) return '';
      return '<div class="kb-sec"><div class="kb-cat">' + esc(c) + '</div><div class="kb-grid">' +
        items.map(function (a) {
          return '<div class="kb-card" data-act="article" data-id="' + esc(a.id) + '">' +
            '<div class="kb-ctitle">' + esc(a.title) + '</div>' +
            (a.lead ? '<div class="kb-clead">' + esc(a.lead) + '</div>' : '') +
            '<div class="kb-more">閱讀 →</div></div>';
        }).join('') + '</div></div>';
    }).join('');
    app.innerHTML = '<div class="wrap kb-wrap">' +
      '<div class="back-row" data-lay="kb.back"><span class="pill-btn" data-act="lobby">← 回到分類大廳</span></div>' +
      '<div data-lay="kb.header">' + headerHTML('Knowledge · 植物知識庫', '知識庫', '照護、病蟲害、繁殖與科普——把經驗整理成一篇篇。', false) + '</div>' +
      chips +
      secs + '</div>';
    animCards('#app .kb-card', 18);
  }
  function renderArticle() {
    var arts = (window.SF_KNOWLEDGE || []), a = null;
    for (var i = 0; i < arts.length; i++) { if (arts[i].id === state.article) { a = arts[i]; break; } }
    if (!a) { go('knowledge'); return; }
    var cover = a.img ? '<div class="kb-cover">' + coverImg(a.img, 1400, a.title) + '</div>' : '';
    app.innerHTML = '<div class="wrap narrow kb-article">' +
      '<div class="back-row" data-lay="kb.abk"><span class="pill-btn" data-act="knowledge">← 回到知識庫</span></div>' +
      '<div class="eyebrow">' + esc(a.cat) + '</div>' +
      '<h1 class="title kb-arttitle">' + esc(a.title) + '</h1>' +
      (a.lead ? '<div class="kb-artlead">' + esc(a.lead) + '</div>' : '') +
      cover +
      '<div class="kb-body">' + kbBodyHTML(a.body) + '</div>' +
      '<div class="detail-footer"><span class="pill-btn" data-act="knowledge">↑ 回到知識庫</span></div>' +
    '</div>';
  }

  // ---- 搜尋:打中文/學名/分類,點結果直接跳到該株成長頁 ----
  function plantCatIndex(p) {
    var cats = normCats(), zh = catOf(p, cats);
    for (var i = 0; i < cats.length; i++) { if (cats[i].zh === zh) return i; }
    return 0;
  }
  function searchMatches(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    var data = state.data || [], out = [];
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      var hay = ((p.name || '') + ' ' + (p.latin || '') + ' ' + (p.category || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) { out.push({ i: i, p: p }); if (out.length >= 16) break; }
    }
    return out;
  }
  function renderSearchResults(q) {
    var box = document.getElementById('sf-results');
    if (!box) return;
    if (!q || !q.trim()) { box.innerHTML = ''; box.classList.remove('open'); return; }
    var ms = searchMatches(q), cats = normCats();
    if (!ms.length) { box.innerHTML = '<div class="search-empty">找不到「' + esc(q) + '」</div>'; box.classList.add('open'); return; }
    box.innerHTML = ms.map(function (m) {
      var zh = catOf(m.p, cats);
      return '<div class="search-item" data-act="search-open" data-i="' + m.i + '">' +
        '<span class="si-name">' + esc(m.p.name) + '</span>' +
        (m.p.latin ? '<span class="si-latin">' + esc(m.p.latin) + '</span>' : '<span class="si-latin"></span>') +
        '<span class="si-cat">' + esc(zh) + '</span></div>';
    }).join('');
    box.classList.add('open');
  }
  function openFromSearch(i) {
    var p = (state.data || [])[i];
    if (!p) return;
    state.selected = i; state.indiv = 0; state.indivOpen = false; state.tab = plantCatIndex(p);
    go('detail');
  }
  function wireSearch() {
    var inp = document.getElementById('sf-search');
    if (!inp) return;
    inp.addEventListener('input', function () { renderSearchResults(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var ms = searchMatches(inp.value); if (ms.length) openFromSearch(ms[0].i); }
      else if (e.key === 'Escape') { inp.value = ''; renderSearchResults(''); }
    });
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
        visual = '<model-viewer src="' + esc(c.model) + '" poster="' + esc(c.model.replace(/\.glb$/i, '-poster.webp')) + '" camera-controls auto-rotate autoplay auto-rotate-delay="0" rotation-per-second="24deg" disable-zoom interaction-prompt="none" exposure="1.05" shadow-intensity="0.9" environment-image="neutral" touch-action="pan-y" alt="' + esc(c.name) + ' 3D"><div slot="poster" class="mv-orb"></div></model-viewer>';
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

    app.innerHTML = '<div class="wrap lobby">' +
      '<div data-lay="lobby.header">' + headerHTML('Herbarium · 分類選單', '', ((window.SITE_CONFIG && SITE_CONFIG.site && SITE_CONFIG.site.lobbySubtitle) || '選一個分類,進入觀看。'), true, totalPlants, totalPhotos, socialBar()) + '</div>' +
      '<div class="lobby-search" data-lay="lobby.search">' +
        '<input id="sf-search" type="search" placeholder="🔍 搜尋植物(中文 / 學名 / 分類)…" autocomplete="off" aria-label="搜尋植物">' +
        '<div id="sf-results" class="search-results"></div>' +
      '</div>' +
      '<div class="card-grid" data-lay="lobby.cards">' + cards + '</div></div>';
    animCards('#app .cat-card', 26);
    wireSearch();
  }

  // ---- 關於頁(獨立整頁;文案在 about.js,字型延遲載入)----
  var _wenkaiLoaded = false;
  function loadAboutFont() {
    if (_wenkaiLoaded) return;
    _wenkaiLoaded = true;
    var url = window.SF_ABOUT_FONT;
    if (!url) return;                       // 留空=用網站預設襯線
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url;
    document.head.appendChild(l);
  }
  function renderAbout() {
    loadAboutFont();
    var lines = (window.SF_ABOUT && window.SF_ABOUT.length) ? window.SF_ABOUT : ['（關於文案待補:編輯 about.js）'];
    var body = lines.map(function (ln) {
      if (ln === '' || ln == null) return '<div class="ab-gap"></div>';
      if (/^—/.test(ln)) return '<div class="ab-sig">' + esc(ln) + '</div>';
      return '<div class="ab-line">' + esc(ln) + '</div>';
    }).join('');
    app.innerHTML = '<div class="wrap about-wrap">' +
      '<div class="about-scrim"></div>' +
      '<div class="back-row" data-lay="about.back"><span class="pill-btn" data-act="lobby">← 回到分類大廳</span></div>' +
      '<div class="about-doc" data-lay="about.doc">' + body + '</div>' +
    '</div>';
    animCards('#app .ab-line', 14);
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
          (noteOf(p) ? '<div class="pc-note">— ' + esc(noteOf(p).replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 48)) + (noteOf(p).length > 48 ? '…' : '') + '</div>' : '') +
          shopRow(p, x.i, false) +
        '</div></div>';
    }).join('');

    var totalPhotos = indexed.reduce(function (s, x) { return s + photoCount(x.p); }, 0);
    var cat = cats[tabIdx];
    var hero = cat.model ?
      '<div class="cat-hero"><model-viewer src="' + esc(cat.model) + '" poster="' + esc(cat.model.replace(/\.glb$/i, '-poster.webp')) + '" camera-controls auto-rotate autoplay auto-rotate-delay="0" rotation-per-second="24deg" disable-zoom interaction-prompt="none" exposure="1.05" shadow-intensity="0.9" environment-image="neutral" touch-action="pan-y" alt="' + esc(activeCat) + ' 3D"><div slot="poster" class="mv-orb"></div></model-viewer></div>' : '';
    var empty = indexed.length ? '' :
      '<p class="subtitle" style="margin-top:8px;">這個分類還沒有植物。</p>';

    app.innerHTML = '<div class="wrap">' +
      '<div class="back-row" data-lay="grid.back"><span class="pill-btn" data-act="lobby">← 回到分類大廳</span></div>' +
      '<div data-lay="grid.header">' + headerHTML('Herbarium · 成長紀錄', activeCat, '點任一株,進入牠的成長時間軸。', true, indexed.length, totalPhotos, hero + '<div class="tabs grid-tabs" data-lay="grid.tabs">' + tabs + '</div>') + '</div>' +
      '<div class="lobby-search grid-searchbar" data-lay="grid.search">' +
        '<input id="sf-search" type="search" placeholder="🔍 搜尋植物(中文 / 學名 / 分類)…" autocomplete="off" aria-label="搜尋植物">' +
        '<div id="sf-results" class="search-results"></div>' +
      '</div>' +
      '<div class="card-grid" data-lay="grid.cards">' + cards + '</div>' + empty +
      '</div>';
    animCards('#app .plant-card', 20);
    wireSearch();
  }

  // 來源 · 母株:文字取自 sources.js(不被 Drive 重建覆蓋),照片取自個體的 mother(由 Drive「母株」夾同步)
  function motherSection(sel, cur) {
    var src = (window.PLANT_SOURCES && PLANT_SOURCES[sel.name] && PLANT_SOURCES[sel.name][(cur && cur.label) || '']) || null;
    var photos = (cur && cur.mother) || [];
    var hasText = src && (src.source || src.mother);
    if (!hasText && !photos.length) return '';
    var rows = '';
    if (src && src.source) rows += '<div class="mother-row"><span class="mk">來源</span><span class="mv">' + fmtNote(src.source) + '</span></div>';
    if (src && src.mother) rows += '<div class="mother-row"><span class="mk">母株</span><span class="mv">' + fmtNote(src.mother) + '</span></div>';
    var pics = photos.length ? '<div class="mother-photos">' + photos.map(function (id) {
      var url = driveImg(id, 1200), big = driveImg(id, 2400);
      return '<div class="m-photo" data-act="zoom" data-url="' + esc(big) + '">' +
        '<img src="' + esc(url) + '" alt="母株" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' +
        '<span class="fs-btn" data-act="zoom" data-url="' + esc(big) + '">⤢ 全螢幕</span></div>';
    }).join('') + '</div>' : '';
    return '<div class="mother-sec" data-lay="detail.mother">' +
      '<div class="tl-head"><h2>來源 · 母株</h2></div>' +
      '<div class="mother-body">' + rows + pics + '</div></div>';
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
        photo = '<div class="tl-photo" data-lay="detail.photo" data-act="zoom" data-url="' + esc(big) + '">' +
          '<img src="' + esc(url) + '" alt="' + esc(e.tag || '') + '" onerror="this.style.display=\'none\'">' +
          '<span class="tag">' + esc(e.tag || '') + '</span>' +
          '<span class="fs-btn" data-act="zoom" data-url="' + esc(big) + '">⤢ 全螢幕</span>' +
        '</div>';
      } else {
        photo = '<div class="tl-empty" data-lay="detail.photo"><span>尚未加入照片</span><span class="tag">' + esc(e.tag || '') + '</span></div>';
      }
      return '<div class="tl-row">' +
        '<div class="tl-when"><div class="y">' + esc(y) + '</div><div class="md">' + esc(md) + '</div></div>' +
        '<div class="tl-axis"><div class="line"></div><div class="dot"></div></div>' +
        '<div class="tl-main"><div class="tl-card">' + photo +
          (e.note ? '<div class="tl-note">' + fmtNote(e.note) + '</div>' : '') +
        '</div></div>' +
      '</div>';
    }).join('');
    if (!total) rows = '<p class="subtitle" style="margin-left:108px;">這個個體還沒有照片。</p>';

    var showIndiv = indivs.length > 1 || (indivs.length === 1 && (!!cur.label || !!cur.name));
    var picker = '';
    if (showIndiv) {
      // 依個體編號(#NN)排序;保留原始 index 給 data-i
      var order = indivs.map(function (iv, i) { return { iv: iv, i: i }; }).sort(function (a, b) {
        return indivNum(a.iv.label) - indivNum(b.iv.label) || a.i - b.i;
      });
      var open = !!state.indivOpen;
      var options = order.map(function (o) {
        return '<div class="iv-opt' + (o.i === ii ? ' sel' : '') + '" data-act="indiv" data-i="' + o.i + '">' +
          '<span class="iv-nm">' + esc(indivLabel(o.iv)) + '</span>' +
          '<span class="iv-c">' + ((o.iv.timeline || []).length) + '</span></div>';
      }).join('');
      picker = '<div class="tl-head"><h2>選擇個體</h2><div class="tl-order">共 ' + indivs.length + ' 株</div></div>' +
        '<div class="iv-dd' + (open ? ' open' : '') + '">' +
          '<button class="iv-current" data-act="indiv-toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<span class="iv-nm">' + esc(indivLabel(cur)) + '</span>' +
            '<span class="iv-c">' + ((cur.timeline || []).length) + ' 張</span>' +
            '<span class="iv-caret">▾</span></button>' +
          '<div class="iv-list">' + options + '</div>' +
        '</div>';
    }

    var no = String(state.selected + 1).padStart(3, '0');
    var indivMetric = showIndiv
      ? '<div class="metric"><div class="k">目前個體</div><div class="v">' + esc(indivLabel(cur)) + '</div></div>'
      : '';

    app.innerHTML = '<div class="wrap narrow">' +
      '<span class="pill-btn" data-act="lobby-from-detail" data-lay="detail.back">← 回到照片牆</span>' +
      '<div style="margin:34px 0 12px;" data-lay="detail.title">' +
        '<div class="eyebrow">No. ' + no + ' · Growth Log</div>' +
        '<h1 class="title" id="sf-dtitle">' + esc(sel.name) + '</h1>' +
        '<div class="detail-latin" id="sf-dlatin">' + esc(sel.latin || '') + '</div>' +
      '</div>' +
      '<div class="metrics" data-lay="detail.metrics">' +
        '<div class="metric"><div class="k">入手 / 種植</div><div class="v">' + esc(sel.date || '') + '</div></div>' +
        '<div class="metric"><div class="k">累積照片</div><div class="v">' + photoCount(sel) + ' 張</div></div>' +
        indivMetric +
      '</div>' +
      shopRow(sel, state.selected, true) +
      (noteOf(sel) ? '<div class="plant-intro" data-lay="detail.intro">' + fmtNote(noteOf(sel)) + '</div>' : '') +
      (picker ? '<div data-lay="detail.picker">' + picker + '</div>' : '') +
      motherSection(sel, cur) +
      '<div class="tl-head" data-lay="detail.timelineHead"><h2>成長時間軸</h2><div class="tl-order">最新 → 最早</div></div>' +
      '<div data-lay="detail.timeline">' + rows + '</div>' +
      '<div class="detail-footer"><span class="pill-btn" data-act="back-grid">↑ 回到照片牆</span></div>' +
    '</div>';
  }

  function render() {
    if (state.view !== 'detail') _lastTyped = -1;   // 離開詳情後,下次再進同一株會重打
    if (state.view === 'lobby') renderLobby();
    else if (state.view === 'grid') renderGrid();
    else if (state.view === 'about') renderAbout();
    else if (state.view === 'knowledge') renderKnowledge();
    else if (state.view === 'article') renderArticle();
    else renderDetail();
    if (window.__fxMode) window.__fxMode(state.view);
    wireInteractions();   // 掛上滑鼠傾斜 / 磁吸(每次重繪後重掛)
    mountModelOrbs();     // 3D 模型 poster 放點陣光球,載入後停掉
    if (state.view === 'detail') runDetailIntro();
  }

  // 在每個 <model-viewer> 的 poster 插槽放一顆點陣光球,模型載好(load 事件)或逾時就停掉
  function mountModelOrbs() {
    if (!window.SFOrb) return;
    var mvs = app.querySelectorAll('model-viewer');
    for (var i = 0; i < mvs.length; i++) {
      (function (mv) {
        var host = mv.querySelector('.mv-orb');
        if (!host || host.__orbed) return;
        host.__orbed = 1;
        var orb = SFOrb.mount(host, { size: 108, count: 150 });
        var done = function () { if (orb) { orb.stop(); orb = null; } };
        mv.addEventListener('load', done, { once: true });
        setTimeout(done, 20000);
      })(mvs[i]);
    }
  }

  // ---- 事件委派 ----
  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var i = parseInt(t.getAttribute('data-i'), 10);
    if (act === 'about') { go('about'); }
    else if (act === 'knowledge') { go('knowledge'); }
    else if (act === 'kb-group') { state.kbGroup = t.getAttribute('data-id'); render(); }
    else if (act === 'article') { state.article = t.getAttribute('data-id'); go('article'); }
    else if (act === 'search-open') { openFromSearch(i); }
    else if (act === 'enter') { state.tab = i; go('grid'); }
    else if (act === 'tab') { state.tab = i; render(); }
    else if (act === 'open') { state.selected = i; state.indiv = 0; state.indivOpen = false; go('detail'); }
    else if (act === 'indiv') { state.indiv = i; state.indivOpen = false; render(); }
    else if (act === 'indiv-toggle') { state.indivOpen = !state.indivOpen; render(); }
    else if (act === 'lobby' || act === 'lobby-from-detail') { go('lobby'); }
    else if (act === 'back-grid') { go('grid'); }
    else if (act === 'zoom') { openLightbox(t.getAttribute('data-url')); }
    else if (act === 'add-cart') {
      ev.stopPropagation();
      var pp = (state.data || [])[i];
      if (pp && window.SHOP && window.SHOP.enabled) {
        window.SHOP.add({ name: pp.name, latin: pp.latin, price: window.SHOP.priceNum(pp.name) });
      }
    }
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
    function curPB() { return (window.SITE_CONFIG && SITE_CONFIG.effects && typeof SITE_CONFIG.effects.particleBrightness === 'number') ? SITE_CONFIG.effects.particleBrightness : 1; }  // 螢火蟲亮度倍率(每幀讀,調整器可即時改)

    function frame() {
      var pB = curPB();
      if (window.__introActive) { requestAnimationFrame(frame); return; }   // 開場飛越期間暫停(看不到,省效能)
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
        var a1 = Math.max(0, Math.min(1, tw)) * Math.min(1, q.sc * 0.9) * fade * pB;
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
  // 回到頂部浮動鈕:捲動超過一段距離才出現,點了平滑回到最上方
  function initToTop() {
    var btn = document.createElement('button');
    btn.id = 'to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', '回到最上方');
    btn.innerHTML = '↑';
    btn.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    });
    document.body.appendChild(btn);
    function onScroll() { btn.classList.toggle('show', (window.scrollY || window.pageYOffset || 0) > 360); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (!(window.SITE_CONFIG && SITE_CONFIG.effects && SITE_CONFIG.effects.particles === false)) init3D();
  initToTop();
  load();
})();
