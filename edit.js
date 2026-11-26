/* ===== edit.js — 管理者的編輯視窗(網站內編輯與後台頁面共用)=====
   window.SWFEdit
     .ready()                              Promise<boolean> 目前是否為已登入的管理者
     .note(plant, done)                    編輯植物介紹
     .sources(plant, indiv|null, done)     編輯來源 · 母株文字(indiv 為 null 時在視窗裡選個體)
     .setCover(plant, indiv, photo, scope, done)   scope = 'plant'(並鎖定)或 'indiv'
     .coverPicker(plant, done)             從這株所有照片裡挑封面
     .article(article|null, done)          編輯 / 新增知識庫文章
     .removeArticle(article, done)         刪除文章(先隱藏,隔天寫回檔案時真正移除)
     .moveArticle(article, dir, done)      同分類內上移(-1)/ 下移(+1):和相鄰那篇交換排序
     .about(done)                          編輯關於頁(內文 + 字型)
     .auction(ctx, done)                   競標:開標({plant, indiv} 或 {plants} 讓管理者挑)/ 修改({row})
     .cancelAuction(row, done)             取消競標
     .auctionBidders(row)                  出價名單(含 Email,只有管理者讀得到)
     .loadPrivate()                        Promise<boolean> 讀「只有管理者看得到」的私人分類與文章,併進知識庫(有變動回傳 true)
     .mergePrivate() / .clearPrivate()     重新併入(資料重讀後)/ 移除(登出後)私人內容
   私人文章(admin_only = true)只存在資料庫,不會寫進 knowledge.js,訪客讀不到(資料庫 RLS 把關)。
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
      else ctl = '<input id="' + id + '" type="' + (['password', 'email', 'number', 'datetime-local'].indexOf(f.type) >= 0 ? f.type : 'text') + '"' + (f.type === 'number' ? ' min="0" step="1" inputmode="numeric"' : '') + ' value="' + esc(f.value || '') + '" placeholder="' + esc(f.placeholder || '') + '">';
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

  // ---------- 私人知識庫(admin_only):只存在資料庫,只有管理者讀得到 ----------
  var priv = { ok: false, cats: [], arts: [] };
  function privCats() { return priv.cats.slice(); }
  function mergePrivate() {
    var K = (window.SF_KNOWLEDGE || []).filter(function (x) { return !x.adminOnly; });
    var ids = {}; priv.arts.forEach(function (a) { ids[a.id] = 1; });
    K = K.filter(function (x) { return !ids[x.id]; }).concat(priv.arts);
    var old = window.SF_KNOWLEDGE_PRIVATE_CATS || [];
    var C = (window.SF_KNOWLEDGE_CATS || []).filter(function (c) { return old.indexOf(c) < 0 && priv.cats.indexOf(c) < 0; }).concat(priv.cats);
    window.SF_KNOWLEDGE = K; window.SF_KNOWLEDGE_CATS = C; window.SF_KNOWLEDGE_PRIVATE_CATS = priv.cats.slice();
  }
  function clearPrivate() {
    var had = priv.arts.length || priv.cats.length;
    priv = { ok: false, cats: [], arts: [] }; mergePrivate();
    return !!had;
  }
  function privArt(r) {
    var o = { id: r.id, cat: r.cat, group: r.grp || '', title: r.title, lead: r.lead || '', body: r.body || [], adminOnly: true };
    if (r.short) o.short = r.short; if (r.img) o.img = r.img; if (r.img_credit) o.imgCredit = r.img_credit;
    return o;
  }
  function loadPrivate() {
    if (!A || !A.session()) return Promise.resolve(clearPrivate());
    return Promise.all([
      A.api('GET', 'article_cats?select=name,sort&admin_only=eq.true&order=sort.asc,name.asc'),
      A.api('GET', 'articles?select=id,cat,grp,title,lead,body,img,img_credit,short,sort&admin_only=eq.true&is_public=eq.true&order=sort.asc,id.asc&limit=1000')
    ]).then(function (r) {
      var sig = JSON.stringify([priv.cats, priv.arts]);
      priv = { ok: true, cats: (r[0] || []).map(function (c) { return c.name; }), arts: (r[1] || []).map(privArt) };
      mergePrivate();
      return sig !== JSON.stringify([priv.cats, priv.arts]);
    }, function () { return false; });   // 資料庫還沒有 admin_only 欄位(尚未執行 swf_003)→ 當作沒有私人內容
  }

  function article(a, done) {
    var isNew = !a, cats = window.SF_KNOWLEDGE_CATS || [], pc = privCats();
    a = a || { id: '', cat: cats[0] || '', group: '鹿角蕨', title: '', lead: '', body: [], img: '', short: '' };
    modal({
      title: isNew ? '新增文章' : '編輯文章',
      hint: '內文一行一段。「# 小標」是小標題,「• 文字」是條列,空一行是段落留白,\n「!img 圖片路徑或 Drive 檔案 ID|圖說」是插圖。',
      fields: [
        { key: 'title', label: '標題', value: a.title },
        { key: 'lead', label: '導言(列表上顯示的一兩句話)', type: 'area', rows: 2, value: a.lead },
        { key: 'cat', label: '分類', type: 'select', value: a.cat, options: cats.map(function (c) { return { value: c, text: pc.indexOf(c) >= 0 ? '🔒 ' + c + '(私人分類)' : c }; }) }
      ].concat(priv.ok ? [{ key: 'vis', label: '誰看得到(私人分類裡的文章一律是私人)', type: 'select', value: a.adminOnly ? 'private' : 'public',
          options: [{ value: 'public', text: '公開:所有訪客' }, { value: 'private', text: '🔒 私人:只有我登入後看得到(不會寫進公開檔案)' }] }] : []).concat([
        { key: 'group', label: '植物類別(知識庫上方的篩選,例:鹿角蕨、仙人掌、塊根、介質)', value: a.group || '' },
        { key: 'body', label: '內文', type: 'area', rows: 18, value: (a.body || []).join('\n') },
        { key: 'img', label: '封面圖(Drive 檔案 ID 或網址;可留空)', value: a.img || '' }
      ]).concat(a.cat === '介質介紹' || isNew ? [{ key: 'short', label: '介質名稱(只有「介質介紹」需要;要和 Drive 介質子資料夾同名)', value: a.short || '' }] : []),
      onSave: function (v) {
        if (!v.title.trim()) throw new Error('請輸入標題');
        var isPriv = priv.ok && (v.vis === 'private' || pc.indexOf(v.cat) >= 0);
        // 私人文章不寫回檔案 → 不用標 web_edited;但「公開改私人」要標,讓每日匯出把它從 knowledge.js 拿掉
        var row = { id: a.id || ('w' + Date.now().toString(36)), cat: v.cat, grp: v.group.trim(), title: v.title.trim(), lead: v.lead.trim(),
          body: v.body.replace(/\r/g, '').split('\n'), img: v.img.trim(), short: (v.short || a.short || '').trim(), is_public: true,
          web_edited: !(isPriv && (isNew || a.adminOnly)) };
        if (priv.ok) row.admin_only = isPriv;
        if (row.img !== (a.img || '')) row.img_credit = '';
        var pre = isNew
          ? A.api('GET', 'articles?select=sort&order=sort.desc&limit=1' + (priv.ok ? '&admin_only=eq.' + isPriv : '')).then(function (r) {
              row.sort = ((r && r[0] && r[0].sort) || (isPriv ? 9000 : 0)) + 1; })
          : Promise.resolve();
        return pre.then(function () { return A.api('POST', 'articles?on_conflict=id', [row], UPSERT); }).then(mustHit).then(function () {
          var o = { id: row.id, cat: row.cat, group: row.grp, title: row.title, lead: row.lead, body: row.body };
          if (row.short) o.short = row.short; if (row.img) o.img = row.img;
          if (a.imgCredit && row.img === (a.img || '')) o.imgCredit = a.imgCredit;
          if (isPriv) o.adminOnly = true;
          priv.arts = priv.arts.filter(function (x) { return x.id !== row.id; });
          if (isPriv) priv.arts.push(o);
          var K = window.SF_KNOWLEDGE = window.SF_KNOWLEDGE || [];
          var i = K.map(function (x) { return x.id; }).indexOf(row.id);
          if (i >= 0) K[i] = o; else K.push(o);
          if (done) done(o);
        });
      }
    });
  }

  function removeArticle(a, done) {
    var isPriv = !!a.adminOnly;
    modal({
      title: '刪除文章?',
      hint: isPriv ? '「' + a.title + '」是私人文章,只存在資料庫:按下後會直接刪除,無法復原。'
                   : '「' + a.title + '」會立刻從網站隱藏;明天凌晨自動整理時會從檔案正式移除。',
      extra: [{ label: '確定刪除', cls: 'danger', onClick: function (close) {
        var req = isPriv
          ? A.api('DELETE', 'articles?id=eq.' + enc(a.id) + '&admin_only=eq.true', null, 'return=representation')
          : A.api('PATCH', 'articles?id=eq.' + enc(a.id), { is_public: false, web_edited: true }, 'return=representation');
        return req.then(mustHit).then(function () {
          priv.arts = priv.arts.filter(function (x) { return x.id !== a.id; });
          window.SF_KNOWLEDGE = (window.SF_KNOWLEDGE || []).filter(function (x) { return x.id !== a.id; });
          close(); if (done) done();
        });
      } }]
    });
  }

  // 同分類內上移 / 下移:和相鄰那篇交換 sort。回傳 Promise<boolean>(到頂 / 到底時 false)
  function moveArticle(a, dir, done) {
    var K = window.SF_KNOWLEDGE || [];
    var same = K.filter(function (x) { return x.cat === a.cat; });
    var b = same[same.map(function (x) { return x.id; }).indexOf(a.id) + dir];
    if (!b || !a.id) return Promise.resolve(false);
    return A.api('GET', 'articles?select=id,sort&id=in.(' + [a.id, b.id].map(function (v) { return enc('"' + v + '"'); }).join(',') + ')').then(function (rows) {
      var s = {}; (rows || []).forEach(function (r) { s[r.id] = r.sort; });
      if (!(a.id in s) || !(b.id in s)) throw new Error('找不到這篇文章(可能剛被刪除),請重新整理。');
      var sa = s[b.id], sb = s[a.id];
      if (sa === sb) sa = sb + dir;          // 兩篇排序值剛好一樣:直接往要去的方向挪一格
      // 私人文章不寫回檔案,不用標 web_edited;公開文章要標,每日匯出才會把新順序寫回 knowledge.js
      return A.api('PATCH', 'articles?id=eq.' + enc(a.id), { sort: sa, web_edited: !a.adminOnly }, 'return=representation').then(mustHit).then(function () {
        return A.api('PATCH', 'articles?id=eq.' + enc(b.id), { sort: sb, web_edited: !b.adminOnly }, 'return=representation').then(mustHit).then(null, function (e) {
          // 第二筆沒寫成:把第一筆改回去,避免兩篇卡在同一個排序值
          return A.api('PATCH', 'articles?id=eq.' + enc(a.id), { sort: sb }, 'return=minimal').then(function () { throw e; }, function () { throw e; });
        });
      });
    }).then(function () {
      var ia = K.indexOf(a), ib = K.indexOf(b);
      if (ia >= 0 && ib >= 0) { K[ia] = b; K[ib] = a; }
      if (done) done();
      return true;
    });
  }

  function about(done) {
    modal({
      title: '編輯關於頁',
      hint: '一行文字 = 頁面上一行;空一行 = 段落留白;開頭是「—」的那行會當成署名。',
      fields: [
        { key: 'lines', label: '內文', type: 'area', rows: 22, value: (window.SF_ABOUT || []).join('\n') },
        { key: 'font', label: '字型樣式表網址(留空 = 用網站預設字型;不確定就不要動)', value: window.SF_ABOUT_FONT || '' }
      ],
      onSave: function (v) {
        var arr = v.lines.replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); });
        while (arr.length && arr[arr.length - 1] === '') arr.pop();
        while (arr.length && arr[0] === '') arr.shift();
        if (!arr.length) throw new Error('內文不能是空的');
        var f = v.font.trim();
        if (f && !/^https:\/\//.test(f)) throw new Error('字型網址要以 https:// 開頭');
        return A.api('POST', 'about?on_conflict=id', [{ id: 1, lines: arr, font: f, web_edited: true }], UPSERT).then(mustHit).then(function () {
          window.SF_ABOUT = arr; window.SF_ABOUT_FONT = f;
          if (done) done();
        });
      }
    });
  }

  // ---------- 競標(管理者)----------
  function localInput(d) { function z(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  function ivText(iv) { return (iv.label || '無編號') + (iv.name ? ' ' + iv.name : '') + '(' + iv.id + ')'; }
  function withIds(p) { return (p.individuals || []).filter(function (iv) { return iv.id; }); }
  function aucError(e) {
    var m = (e && e.message) || '';
    if (/uq_swf_auction_open/.test(m)) return new Error('這個個體已經有一場還沒結束的競標。');
    if (/Could not find the (table|function)|does not exist/i.test(m)) return new Error('資料庫還沒有競標功能,請先在 Supabase 執行 swf_005_auctions.sql。');
    return e;
  }
  function auction(ctx, done) {
    ctx = ctx || {};
    var row = ctx.row || null, plant = ctx.plant || null, indiv = ctx.indiv || null, fields = [];
    var pick = (!row && !plant) ? (ctx.plants || []).filter(function (p) { return p.key && withIds(p).length; }) : null;
    if (!row) {
      if (pick) {
        if (!pick.length) throw new Error('沒有可以競標的個體。');
        plant = pick[0];
        fields.push({ key: 'plant', label: '植物', type: 'select', value: '0',
          options: pick.map(function (p, i) { return { value: String(i), text: p.name + (p.pid ? '(' + p.pid + ')' : '') + ' · ' + p.category }; }),
          onChange: function (i, box) {
            plant = pick[+i];
            box.querySelector('#sfe-iv').innerHTML = withIds(plant).map(function (iv) { return '<option value="' + esc(iv.id) + '">' + esc(ivText(iv)) + '</option>'; }).join('');
          } });
      } else needKey(plant);
      var ivs0 = withIds(plant);
      if (!ivs0.length) throw new Error('這株還沒有個體編號,無法競標。');
      if (!indiv || !indiv.id) indiv = ivs0[0];
      if (pick || ivs0.length > 1) fields.push({ key: 'iv', label: '個體', type: 'select', value: indiv.id, options: ivs0.map(function (iv) { return { value: iv.id, text: ivText(iv) }; }) });
    }
    var locked = !!(row && row.bid_count > 0);      // 已經有人出價:起標價不能再改
    if (!locked) fields.push({ key: 'start', label: '起標價(NT$)', type: 'number', value: row ? String(row.start_price) : '' });
    fields.push({ key: 'inc', label: '每次最低加價(NT$)', type: 'number', value: String(row ? row.min_increment : 50) });
    fields.push({ key: 'buy', label: '直購價(NT$;留空 = 不設直購。有人出到這個價就直接結標)', type: 'number', value: row && row.buy_now_price ? String(row.buy_now_price) : '' });
    if (!row) fields.push({ key: 'starts', label: '開始時間(留空 = 立刻開始)', type: 'datetime-local', value: '' });
    var d0 = new Date(Date.now() + 7 * 86400000); d0.setHours(21, 0, 0, 0);
    fields.push({ key: 'ends', label: '結標時間(結標前 5 分鐘內有人出價會自動延長 5 分鐘)', type: 'datetime-local', value: localInput(row ? new Date(row.ends_at) : d0) });
    fields.push({ key: 'note', label: '說明(尺寸、運送 / 面交、付款方式…;可留空,最多 1000 字)', type: 'area', rows: 4, value: row ? row.note || '' : '' });
    modal({
      title: row ? '修改競標:' + row.plant_name + ' ' + (row.indiv_label || '') : '開始競標' + (pick ? '' : ':' + plant.name),
      hint: row ? (locked ? '已經有 ' + row.bid_count + ' 次出價(目前 NT$ ' + row.current_price + '),起標價不能再改。' : '還沒有人出價,所有欄位都可以改。')
                : '以個體為單位。出價者要用 Google 登入;結標後到後台「競標」看得標者的 Email,自己聯絡對方(網站不收款)。',
      fields: fields, saveLabel: row ? '儲存' : '開始競標',
      onSave: function (v) {
        var start = locked ? row.start_price : (String(v.start).trim() === '' ? NaN : Math.floor(+v.start));
        var inc = Math.floor(+v.inc), buy = String(v.buy).trim() === '' ? null : Math.floor(+v.buy);
        if (isNaN(start) || start < 0) throw new Error('請輸入起標價(0 以上的整數)。');
        if (isNaN(inc) || inc < 1) throw new Error('每次最低加價至少要 1。');
        if (buy !== null && (isNaN(buy) || buy <= start)) throw new Error('直購價要高於起標價。');
        if (row && buy !== null && row.current_price != null && buy <= row.current_price) throw new Error('直購價要高於目前的出價。');
        var ends = new Date(v.ends), starts = (!row && v.starts) ? new Date(v.starts) : null;
        if (isNaN(ends)) throw new Error('請選擇結標時間。');
        if (starts && isNaN(starts)) throw new Error('開始時間的格式不對。');
        if (+ends <= Math.max(Date.now(), starts ? +starts : 0)) throw new Error('結標時間要是未來的時間,而且要在開始時間之後。');
        var note = String(v.note || '').replace(/\r/g, '').trim();
        if (note.length > 1000) throw new Error('說明太長了(最多 1000 字)。');
        var body = { note: note, min_increment: inc, buy_now_price: buy, ends_at: ends.toISOString() };
        if (!locked) body.start_price = start;
        var req;
        if (row) {
          req = A.api('PATCH', 'auctions?id=eq.' + enc(row.id), body, 'return=representation');
        } else {
          if (fields.some(function (f) { return f.key === 'iv'; })) indiv = withIds(plant).filter(function (iv) { return iv.id === v.iv; })[0] || indiv;
          body.individual_id = indiv.id; body.plant_key = plant.key; body.plant_name = plant.name;
          body.indiv_label = (indiv.label || '') + (indiv.name ? ' ' + indiv.name : '');
          if (starts) body.starts_at = starts.toISOString();
          // 先把時間已到的舊競標標成結束,同一個個體才開得了新的一場
          req = A.api('POST', 'rpc/settle_expired', {}).then(null, function () {}).then(function () { return A.api('POST', 'auctions', [body], 'return=representation'); });
        }
        return req.then(mustHit).then(function (rows) { if (done) done(rows[0]); }, function (e) { throw aucError(e); });
      }
    });
  }
  function cancelAuction(row, done) {
    modal({
      title: '取消競標?', hint: '「' + row.plant_name + ' ' + (row.indiv_label || '') + '」' + (row.bid_count ? '已經有 ' + row.bid_count + ' 次出價。' : '還沒有人出價。') + '取消後訪客就看不到這一場,出價紀錄也不再顯示。',
      extra: [{ label: '確定取消競標', cls: 'danger', onClick: function (close) {
        return A.api('PATCH', 'auctions?id=eq.' + enc(row.id), { status: 'cancelled' }, 'return=representation').then(mustHit).then(function () { close(); if (done) done(); });
      } }]
    });
  }
  function auctionBidders(row) {
    return A.api('POST', 'rpc/auction_bidders', { a_id: row.id }).then(function (list) {
      list = list || [];
      var ended = row.status === 'ended' || Date.now() >= +new Date(row.ends_at);
      modal({
        title: '出價名單:' + row.plant_name + ' ' + (row.indiv_label || ''),
        hint: list.length ? (ended ? '第一列是得標者。請用 Email 聯絡對方確認付款與取貨方式。' : '競標還在進行中,第一列是目前最高出價。') : '還沒有人出價。',
        html: list.map(function (b, i) {
          return '<div class="sfe-f" style="margin:0;padding:8px 0;border-top:1px solid rgba(255,255,255,.1)">' + (i === 0 ? '<b>' + (ended ? '得標 ' : '最高 ') + '</b>' : '') +
            'NT$ ' + Number(b.amount).toLocaleString() + ' · ' + esc(b.display_name || '(沒有設定名稱)') + ' · ' +
            (b.email ? '<a href="mailto:' + esc(b.email) + '" style="color:#7fd4a2">' + esc(b.email) + '</a>' : '(沒有 Email)') +
            '<div style="font-size:12px;opacity:.6">' + esc(new Date(b.created_at).toLocaleString()) + '</div></div>';
        }).join('')
      });
    }, function (e) { modal({ title: '讀不到出價名單', hint: (e && e.message) || '' }); });
  }

  // 登入視窗(訪客與管理者共用)。只提供 Google 登入:第一次登入會自動建立帳號,等於註冊
  function login(done, returnQuery) {
    modal({
      title: '登入', hint: '用 Google 帳號登入。第一次登入會自動建立帳號;帳號與 PlantDex 共用。',
      html: '<div class="sfe-row" style="margin:4px 0 6px"><button class="sfe-btn pri" data-g="1" style="width:100%">用 Google 登入</button></div>',
      onClick: function (b) { if (b.getAttribute('data-g')) A.signInWithGoogle(returnQuery); }
    });
  }
  function account(isAdmin, done) {
    var s = A.session() || { user: {} };
    modal({
      title: '帳號', hint: '已登入:' + (s.user.email || '') + (isAdmin ? '\n你是這個網站的管理者。' : ''),
      extra: (isAdmin ? [{ label: '進入後台', cls: 'pri', onClick: function () { location.href = 'admin.html'; } }] : [])
        .concat([{ label: '登出', onClick: function (close) { return A.signOut().then(function () { close(); if (done) done(); }); } }])
    });
  }

  function ready() { return (A && window.SWF && window.SWF.enabled()) ? A.isAdmin() : Promise.resolve(false); }
  // 包一層:同步丟出的錯誤(例如離線備援)改用視窗顯示
  function safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { modal({ title: '無法編輯', hint: e.message }); } }; }

  window.SWFEdit = { ready: ready, modal: modal, login: login, account: account, note: safe(note), sources: safe(sources), setCover: setCover,
    coverPicker: safe(coverPicker), article: safe(article), removeArticle: safe(removeArticle),
    loadPrivate: loadPrivate, mergePrivate: mergePrivate, clearPrivate: clearPrivate,
    about: safe(about), moveArticle: moveArticle,
    auction: safe(auction), cancelAuction: safe(cancelAuction), auctionBidders: auctionBidders };
})();
