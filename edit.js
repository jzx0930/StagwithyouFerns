/* ===== edit.js — 管理者的編輯視窗(網站內編輯與後台頁面共用)=====
   window.SWFEdit
     .ready()                              Promise<boolean> 目前是否為已登入的管理者
     .note(plant, done)                    編輯植物介紹
     .sources(plant, indiv|null, done)     編輯來源 · 母株文字(indiv 為 null 時在視窗裡選個體)
     .setCover(plant, indiv, photo, scope, done)   scope = 'plant'(並鎖定)或 'indiv'
     .coverPicker(plant, done)             從這株所有照片裡挑封面
     .article(article|null, done)          編輯 / 新增知識庫文章
     .removeArticle(article, done)         刪除文章(先隱藏,隔天寫回檔案時真正移除)
   每次儲存都會把該列標成 web_edited = true:匯入不會蓋掉它,每日排程會把它寫回 GitHub 的檔案。
   plant 物件要有 key(由 backend.js 從資料庫讀出來時帶上)。
*/
(function () {
  'use strict';
  var A = window.SWFAuth;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function thumb(id, w) { return /^https?:|[\/.]/.test(id) ? id : 'https://lh3.googleusercontent.com/d/' + id + '=w' + (w || 300); }
  function enc(v) { return encodeURIComponent(v); }
  function labelOf(iv) { return (iv.label || '無編號') + (iv.name ? ' ' + iv.name : '') + (iv.id ? '(' + iv.id + ')' : ''); }

  var CSS = '.sfe-back{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.62);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:5vh 14px}' +
    '.sfe-box{width:min(720px,100%);background:#141a1b;color:#e9efe9;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:20px 22px;font:15px/1.6 system-ui,"Noto Sans TC",sans-serif}' +
    '.sfe-box h3{margin:0 0 4px;font-size:18px;font-weight:600}.sfe-hint{font-size:13px;opacity:.65;margin:0 0 12px;white-space:pre-line}' +
    '.sfe-f{margin:0 0 12px}.sfe-f label{display:block;font-size:13px;opacity:.75;margin-bottom:4px}' +
    '.sfe-f input,.sfe-f textarea,.sfe-f select{width:100%;box-sizing:border-box;background:#0c1011;color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;font:inherit}' +
    '.sfe-f textarea{min-height:120px;resize:vertical;line-height:1.55}.sfe-f input:focus,.sfe-f textarea:focus,.sfe-f select:focus{outline:2px solid #7fd4a2;outline-offset:1px}' +
    '.sfe-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}' +
    '.sfe-btn{cursor:pointer;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;border-radius:999px;padding:7px 16px;font:inherit;font-size:14px}' +
    '.sfe-btn:hover{border-color:#7fd4a2}.sfe-btn.pri{background:#7fd4a2;color:#0b1410;border-color:#7fd4a2;font-weight:600}.sfe-btn.danger{color:#ff9a9a;border-color:rgba(255,120,120,.5)}' +
    '.sfe-btn[disabled]{opacity:.5;cursor:default}.sfe-err{color:#ff9a9a;font-size:13px;min-height:1.2em;margin-top:8px}' +
    '.sfe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:8px 0 14px}' +
    '.sfe-ph{border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;font-size:12px}.sfe-ph img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#0c1011}' +
    '.sfe-ph div{padding:6px;display:flex;flex-direction:column;gap:4px}.sfe-ph .cur{color:#7fd4a2}.sfe-ph button{font-size:12px;padding:3px 8px}' +
    '.sfe-sub{font-size:13px;opacity:.75;margin:10px 0 0}';
  function ensureCss() {
    if (document.getElementById('sfe-css')) return;
    var st = document.createElement('style'); st.id = 'sfe-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  // 通用編輯視窗。opts: {title, hint, fields:[{key,label,type,value,options,rows,placeholder,onChange}], html, saveLabel, onSave(values), extra:[{label,cls,onClick(close)}]}
  function modal(opts) {
    ensureCss();
    var back = document.createElement('div'); back.className = 'sfe-back';
    var fields = (opts.fields || []).map(function (f) {
      var id = 'sfe-' + f.key, ctl;
      if (f.type === 'area') ctl = '<textarea id="' + id + '" rows="' + (f.rows || 8) + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
      else if (f.type === 'select') ctl = '<select id="' + id + '">' + f.options.map(function (o) {
        var v = typeof o === 'string' ? o : o.value, t = typeof o === 'string' ? o : o.text;
        return '<option value="' + esc(v) + '"' + (v === f.value ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
      else ctl = '<input id="' + id + '" type="text" value="' + esc(f.value || '') + '" placeholder="' + esc(f.placeholder || '') + '">';
      return '<div class="sfe-f"><label for="' + id + '">' + esc(f.label) + '</label>' + ctl + '</div>';
    }).join('');
    back.innerHTML = '<div class="sfe-box" role="dialog" aria-modal="true"><h3>' + esc(opts.title) + '</h3>' +
      (opts.hint ? '<p class="sfe-hint">' + esc(opts.hint) + '</p>' : '') + fields + (opts.html || '') +
      '<div class="sfe-row">' + (opts.onSave ? '<button class="sfe-btn pri" data-k="save">' + esc(opts.saveLabel || '儲存') + '</button>' : '') +
      '<button class="sfe-btn" data-k="cancel">' + (opts.onSave ? '取消' : '關閉') + '</button>' +
      (opts.extra || []).map(function (x, i) { return '<button class="sfe-btn ' + (x.cls || '') + '" data-x="' + i + '">' + esc(x.label) + '</button>'; }).join('') +
      '</div><div class="sfe-err" role="alert"></div></div>';
    document.body.appendChild(back);
    var err = back.querySelector('.sfe-err');
    function close() { document.removeEventListener('keydown', onKey); if (back.parentNode) back.parentNode.removeChild(back); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    function values() { var v = {}; (opts.fields || []).forEach(function (f) { v[f.key] = back.querySelector('#sfe-' + f.key).value; }); return v; }
    function busy(on) { [].forEach.call(back.querySelectorAll('button'), function (b) { b.disabled = on; }); }
    function fail(e) { busy(false); err.textContent = (e && e.message) || '儲存失敗'; }
    (opts.fields || []).forEach(function (f) {
      if (f.onChange) back.querySelector('#sfe-' + f.key).addEventListener('change', function (ev) { f.onChange(ev.target.value, back); });
    });
    back.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.getAttribute('data-k') === 'cancel') return close();
      if (b.getAttribute('data-k') === 'save') {
        err.textContent = ''; busy(true);
        Promise.resolve().then(function () { return opts.onSave(values()); }).then(close, fail);
        return;
      }
      var xi = b.getAttribute('data-x');
      if (xi !== null && opts.extra && opts.extra[xi]) {
        err.textContent = ''; busy(true);
        Promise.resolve().then(function () { return opts.extra[xi].onClick(close); }).then(function () { busy(false); }, fail);
        return;
      }
      if (opts.onClick) { err.textContent = ''; Promise.resolve().then(function () { return opts.onClick(b, close); }).catch(fail); }
    });
    var first = back.querySelector('textarea,input,select'); if (first) first.focus();
    return { el: back, close: close };
  }

  function needKey(plant) { if (!plant || !plant.key) throw new Error('目前是離線備援資料(讀不到資料庫),暫時不能編輯。'); }
  // 寫入後確認真的有改到(RLS 擋下時 PATCH 會回空陣列而不是錯誤)
  function mustHit(rows) { if (!rows || !rows.length) throw new Error('沒有改到任何資料(可能不是管理者帳號,或這筆資料已不存在)。'); return rows; }
  var UPSERT = 'resolution=merge-duplicates,return=representation';

  function note(plant, done) {
    needKey(plant);
    var cur = (window.PLANT_NOTES && window.PLANT_NOTES[plant.name]) || '';
    modal({
      title: '編輯介紹:' + plant.name,
      hint: '語法:**粗體**、***斜體(通常放學名)***;直接按 Enter 換行。',
      fields: [{ key: 'body', label: '植物介紹', type: 'area', rows: 16, value: cur }],
      onSave: function (v) {
        return A.api('POST', 'plant_notes?on_conflict=plant_key', [{ plant_key: plant.key, body: v.body, web_edited: true }], UPSERT)
          .then(mustHit).then(function () {
            window.PLANT_NOTES = window.PLANT_NOTES || {}; window.PLANT_NOTES[plant.name] = v.body;
            if (done) done();
          });
      }
    });
  }

  function sources(plant, indiv, done) {
    needKey(plant);
    var ivs = plant.individuals || [];
    if (!ivs.length) throw new Error('這株還沒有個體,無法填來源 · 母株。');
    var cur = indiv || ivs[0];
    function val(iv) { var s = (window.PLANT_SOURCES && window.PLANT_SOURCES[plant.name] && window.PLANT_SOURCES[plant.name][iv.label || '']) || {}; return { source: s.source || '', mother: s.mother || '' }; }
    var v0 = val(cur), fields = [];
    if (!indiv && ivs.length > 1) fields.push({ key: 'iv', label: '個體', type: 'select', value: String(ivs.indexOf(cur)),
      options: ivs.map(function (iv, i) { return { value: String(i), text: labelOf(iv) }; }),
      onChange: function (i, box) { cur = ivs[+i]; var x = val(cur); box.querySelector('#sfe-source').value = x.source; box.querySelector('#sfe-mother').value = x.mother; } });
    fields.push({ key: 'source', label: '來源(跟誰買、哪裡來)', type: 'area', rows: 3, value: v0.source });
    fields.push({ key: 'mother', label: '母株(母本資訊)', type: 'area', rows: 4, value: v0.mother });
    modal({
      title: '來源 · 母株:' + plant.name + (indiv ? ' ' + (indiv.label || '') : ''),
      hint: '如果這個個體在 Drive 的「母株」資料夾放了 .txt,網站會優先顯示那份文字。',
      fields: fields,
      onSave: function (v) {
        var row = { plant_key: plant.key, label: cur.label || '', source: v.source.trim(), mother: v.mother.trim(), web_edited: true };
        return A.api('POST', 'sources?on_conflict=plant_key,label', [row], UPSERT).then(mustHit).then(function () {
          var S = window.PLANT_SOURCES = window.PLANT_SOURCES || {};
          (S[plant.name] = S[plant.name] || {})[row.label] = { source: row.source, mother: row.mother };
          if (done) done();
        });
      }
    });
  }

  function setCover(plant, indiv, photo, scope, done) {
    needKey(plant);
    var p = scope === 'plant'
      ? A.api('PATCH', 'plants?key=eq.' + enc(plant.key), { cover: photo, cover_locked: true, web_edited: true }, 'return=representation')
          .then(mustHit).then(function () { plant.cover = photo; plant.coverLocked = true; })
      : A.api('PATCH', 'individuals?id=eq.' + enc(indiv.id), { cover: photo, web_edited: true }, 'return=representation')
          .then(mustHit).then(function () { indiv.cover = photo; });
    return p.then(function () { if (done) done(); });
  }

  function coverPicker(plant, done) {
    needKey(plant);
    function html() {
      return (plant.individuals || []).map(function (iv, i) {
        var ph = (iv.timeline || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        if (!ph.length) return '';
        return '<p class="sfe-sub">' + esc(labelOf(iv)) + '</p><div class="sfe-grid">' + ph.map(function (t) {
          return '<div class="sfe-ph"><img loading="lazy" src="' + esc(thumb(t.photo)) + '" alt=""><div><span>' + esc(t.date || '') +
            (plant.cover === t.photo ? ' <span class="cur">植物封面</span>' : '') + (iv.cover === t.photo ? ' <span class="cur">個體封面</span>' : '') + '</span>' +
            '<button class="sfe-btn" data-ph="' + esc(t.photo) + '" data-iv="' + i + '" data-scope="plant">設為植物封面</button>' +
            (iv.id ? '<button class="sfe-btn" data-ph="' + esc(t.photo) + '" data-iv="' + i + '" data-scope="indiv">設為個體封面</button>' : '') +
            '</div></div>';
        }).join('') + '</div>';
      }).join('') || '<p class="sfe-hint">這株還沒有照片。</p>';
    }
    var m = modal({
      title: '選封面:' + plant.name, hint: '植物封面選定後會鎖定,之後自動同步不會換掉它。', html: '<div id="sfe-cov">' + html() + '</div>',
      onClick: function (b) {
        var ph = b.getAttribute('data-ph'); if (!ph) return;
        return setCover(plant, plant.individuals[+b.getAttribute('data-iv')], ph, b.getAttribute('data-scope'), function () {
          m.el.querySelector('#sfe-cov').innerHTML = html(); if (done) done();
        });
      }
    });
  }

  function article(a, done) {
    var isNew = !a, cats = window.SF_KNOWLEDGE_CATS || [];
    a = a || { id: '', cat: cats[0] || '', group: '鹿角蕨', title: '', lead: '', body: [], img: '', short: '' };
    modal({
      title: isNew ? '新增文章' : '編輯文章',
      hint: '內文一行一段。「# 小標」是小標題,「• 文字」是條列,空一行是段落留白,\n「!img 圖片路徑或 Drive 檔案 ID|圖說」是插圖。',
      fields: [
        { key: 'title', label: '標題', value: a.title },
        { key: 'lead', label: '導言(列表上顯示的一兩句話)', type: 'area', rows: 2, value: a.lead },
        { key: 'cat', label: '分類', type: 'select', value: a.cat, options: cats },
        { key: 'group', label: '植物類別(知識庫上方的篩選,例:鹿角蕨、仙人掌、塊根、介質)', value: a.group || '' },
        { key: 'body', label: '內文', type: 'area', rows: 18, value: (a.body || []).join('\n') },
        { key: 'img', label: '封面圖(Drive 檔案 ID 或網址;可留空)', value: a.img || '' }
      ].concat(a.cat === '介質介紹' || isNew ? [{ key: 'short', label: '介質名稱(只有「介質介紹」需要;要和 Drive 介質子資料夾同名)', value: a.short || '' }] : []),
      onSave: function (v) {
        if (!v.title.trim()) throw new Error('請輸入標題');
        var row = { id: a.id || ('w' + Date.now().toString(36)), cat: v.cat, grp: v.group.trim(), title: v.title.trim(), lead: v.lead.trim(),
          body: v.body.replace(/\r/g, '').split('\n'), img: v.img.trim(), short: (v.short || a.short || '').trim(), is_public: true, web_edited: true };
        if (row.img !== (a.img || '')) row.img_credit = '';
        var pre = isNew
          ? A.api('GET', 'articles?select=sort&order=sort.desc&limit=1').then(function (r) { row.sort = ((r && r[0] && r[0].sort) || 0) + 1; })
          : Promise.resolve();
        return pre.then(function () { return A.api('POST', 'articles?on_conflict=id', [row], UPSERT); }).then(mustHit).then(function () {
          var K = window.SF_KNOWLEDGE = window.SF_KNOWLEDGE || [];
          var o = { id: row.id, cat: row.cat, group: row.grp, title: row.title, lead: row.lead, body: row.body };
          if (row.short) o.short = row.short; if (row.img) o.img = row.img;
          if (a.imgCredit && row.img === (a.img || '')) o.imgCredit = a.imgCredit;
          var i = K.map(function (x) { return x.id; }).indexOf(row.id);
          if (i >= 0) K[i] = o; else K.push(o);
          if (done) done(o);
        });
      }
    });
  }

  function removeArticle(a, done) {
    modal({
      title: '刪除文章?', hint: '「' + a.title + '」會立刻從網站隱藏;明天凌晨自動整理時會從檔案正式移除。',
      extra: [{ label: '確定刪除', cls: 'danger', onClick: function (close) {
        return A.api('PATCH', 'articles?id=eq.' + enc(a.id), { is_public: false, web_edited: true }, 'return=representation').then(mustHit).then(function () {
          window.SF_KNOWLEDGE = (window.SF_KNOWLEDGE || []).filter(function (x) { return x.id !== a.id; });
          close(); if (done) done();
        });
      } }]
    });
  }

  function ready() { return (A && window.SWF && window.SWF.enabled()) ? A.isAdmin() : Promise.resolve(false); }
  // 包一層:同步丟出的錯誤(例如離線備援)改用視窗顯示
  function safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { modal({ title: '無法編輯', hint: e.message }); } }; }

  window.SWFEdit = { ready: ready, modal: modal, note: safe(note), sources: safe(sources), setCover: setCover,
    coverPicker: safe(coverPicker), article: safe(article), removeArticle: safe(removeArticle) };
})();
