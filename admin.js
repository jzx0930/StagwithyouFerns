/* ===== admin.js — 後台頁面(admin.html)=====
   分頁:植物(介紹 / 來源·母株 / 封面)、知識庫(新增 / 編輯 / 刪除)、同步(收件匣、紀錄、立即同步、待寫回的修改)
   編輯視窗與寫入邏輯都在 edit.js(和網站內編輯共用);這裡只負責清單與版面。
*/
(function () {
  'use strict';
  var A = window.SWFAuth, E = window.SWFEdit, CFG = window.SWF_BACKEND || {};
  var root = document.getElementById('root');
  var st = { tab: 'plants', q: '', only: 'all', plants: [], inbox: [], runs: [], pending: null, err: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function hasNote(p) { return !!(window.PLANT_NOTES && window.PLANT_NOTES[p.name]); }
  function photos(p) { return (p.individuals || []).reduce(function (n, iv) { return n + (iv.timeline || []).length; }, 0); }

  // ---------- 登入 ----------
  function loginView(msg) {
    root.innerHTML = '<div class="login card"><h2>StagwithyouFerns 後台</h2>' +
      '<p class="mute">用 PlantDex 的帳號登入(帳號共用)。</p>' +
      '<button class="btn pri" id="gg" style="width:100%">用 Google 登入</button>' +
      '<p class="mute" style="margin:14px 0 0;text-align:center">或用 Email 和密碼</p>' +
      '<label for="em">Email</label><input id="em" type="email" autocomplete="username">' +
      '<label for="pw">密碼</label><input id="pw" type="password" autocomplete="current-password">' +
      '<div class="err" id="lerr">' + esc(msg || '') + '</div>' +
      '<button class="btn" id="go">登入</button> <a class="btn" href="index.html">回網站</a></div>';
    document.getElementById('gg').onclick = function () { A.signInWithGoogle(); };
    function submit() {
      var em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value;
      var err = document.getElementById('lerr');
      if (!em || !pw) { err.textContent = '請輸入 Email 和密碼'; return; }
      err.textContent = '登入中…';
      A.signIn(em, pw).then(boot, function (e) { err.textContent = e.message; });
    }
    document.getElementById('go').onclick = submit;
    document.getElementById('pw').onkeydown = function (e) { if (e.key === 'Enter') submit(); };
  }

  // ---------- 資料 ----------
  function loadAll() {
    return window.SWF.loadAll().then(function (d) {
      st.plants = d.plants.filter(function (p) { return p.category !== '日記'; });
      return Promise.all([
        A.api('GET', 'sync_inbox?select=id,created_at,kind,title,status&status=eq.open&order=created_at.desc&limit=200'),
        A.api('GET', 'sync_runs?select=id,started_at,finished_at,status,summary&order=id.desc&limit=8'),
        Promise.all(['plant_notes', 'sources', 'plants', 'individuals', 'articles'].map(function (t) {
          return A.api('GET', t + '?select=web_edited&web_edited=eq.true&limit=1000').then(function (r) { return [t, (r || []).length]; }, function () { return [t, null]; });
        }))
      ]);
    }).then(function (r) { st.inbox = r[0] || []; st.runs = r[1] || []; st.pending = r[2]; });
  }

  // ---------- 畫面 ----------
  function plantsTab() {
    var q = st.q.toLowerCase();
    var list = st.plants.filter(function (p) {
      if (st.only === 'nonote' && hasNote(p)) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.latin || '') + ' ' + (p.pid || '') + ' ' + p.category).toLowerCase().indexOf(q) >= 0;
    });
    var missing = st.plants.filter(function (p) { return !hasNote(p); }).length;
    return '<div class="tools"><input type="text" id="q" placeholder="搜尋名稱 / 學名 / ID" value="' + esc(st.q) + '">' +
      '<span class="chip' + (st.only === 'all' ? ' on' : '') + '" data-only="all">全部 ' + st.plants.length + '</span>' +
      '<span class="chip' + (st.only === 'nonote' ? ' on' : '') + '" data-only="nonote">缺介紹 ' + missing + '</span></div>' +
      '<div class="card">' + (list.length ? list.slice(0, 300).map(function (p) {
        var i = st.plants.indexOf(p);
        return '<div class="row"><div class="nm">' + esc(p.name) + '<small>' + esc(p.pid || '') + ' · ' + esc(p.category) + ' · ' + (p.individuals || []).length + ' 個體 · ' + photos(p) + ' 張</small>' +
          (hasNote(p) ? '' : '<span class="badge">缺介紹</span>') + (p.coverLocked ? '<span class="badge g">封面已鎖定</span>' : '') + '</div>' +
          '<button class="btn sm" data-a="note" data-i="' + i + '">介紹</button>' +
          '<button class="btn sm" data-a="src" data-i="' + i + '">來源·母株</button>' +
          '<button class="btn sm" data-a="cover" data-i="' + i + '">封面</button>' +
          (p.pid ? '<a class="btn sm" target="_blank" href="index.html?id=' + encodeURIComponent(p.pid) + '">開啟</a>' : '') + '</div>';
      }).join('') : '<p class="mute">沒有符合的植物。</p>') + '</div>';
  }

  function kbTab() {
    var K = window.SF_KNOWLEDGE || [], cats = window.SF_KNOWLEDGE_CATS || [];
    return '<div class="tools"><button class="btn pri" data-a="art-new">+ 新增文章</button><span class="mute">共 ' + K.length + ' 篇</span></div>' +
      cats.map(function (c) {
        var items = K.filter(function (a) { return a.cat === c; });
        return '<div class="card"><h2>' + esc(c) + ' <span class="mute">' + items.length + '</span></h2>' + (items.length ? items.map(function (a) {
          return '<div class="row"><div class="nm">' + esc(a.title) + '<small>' + esc(a.group || '') + '</small></div>' +
            '<button class="btn sm" data-a="art" data-id="' + esc(a.id) + '">編輯</button>' +
            '<button class="btn sm" data-a="art-del" data-id="' + esc(a.id) + '">刪除</button></div>';
        }).join('') : '<p class="mute">這個分類還沒有文章。</p>') + '</div>';
      }).join('');
  }

  var KIND = { new_plant: '新植物', rename: '改名', missing: '照片不見', duplicate: '重複上傳', loose: '散落照片', diary_loose: '日記散照',
               naming: '命名不合規', folder: '不認得的資料夾', media: '介質', denied: '讀不到' };
  function syncTab() {
    var repo = CFG.repo || '';
    var pend = (st.pending || []).filter(function (x) { return x[1]; });
    var zh = { plant_notes: '介紹', sources: '來源·母株', plants: '植物封面', individuals: '個體封面', articles: '文章' };
    return '<div class="card"><h2>立即同步</h2>' +
      '<p class="mute">每天凌晨 3:10 會自動:把網頁上的修改寫回 GitHub 的檔案 → 讀 Drive 新照片 → 更新網站。<br>' +
      '想現在就跑:按下面的按鈕到 GitHub,點「Run workflow」,把「只預演」的勾取消,再按綠色的 Run workflow。大約 1–2 分鐘完成。</p>' +
      (repo ? '<a class="btn pri" target="_blank" href="https://github.com/' + esc(repo) + '/actions/workflows/sync.yml">到 GitHub 執行同步</a>' : '') +
      '<p class="mute" style="margin-top:12px">尚未寫回檔案的網頁修改:' + (st.pending === null ? '—'
        : (st.pending || []).some(function (x) { return x[1] === null; }) ? '<span class="bad">資料庫還沒升級,請先在 Supabase 執行 swf_002_web_edit.sql,否則無法儲存。</span>'
        : pend.length ? pend.map(function (x) { return zh[x[0]] + ' ' + x[1] + ' 筆'; }).join('、') : '沒有') + '</p></div>' +
      '<div class="card"><h2>收件匣 <span class="mute">' + st.inbox.length + ' 項待確認</span></h2>' + (st.inbox.length ? st.inbox.map(function (x) {
        return '<div class="row"><div class="nm"><span class="badge">' + esc(KIND[x.kind] || x.kind) + '</span> ' + esc(x.title) + '<small>' + when(x.created_at) + '</small></div>' +
          '<button class="btn sm" data-a="inbox" data-id="' + x.id + '" data-s="applied">已處理</button>' +
          '<button class="btn sm" data-a="inbox" data-id="' + x.id + '" data-s="ignored">忽略</button></div>';
      }).join('') : '<p class="mute">沒有待確認的事項。</p>') + '</div>' +
      '<div class="card"><h2>最近的同步紀錄</h2>' + (st.runs.length ? st.runs.map(function (r) {
        var s = r.summary || {}, parts = [];
        [['photos', '照片'], ['mother', '母株照'], ['diary', '日記'], ['individuals', '新個體'], ['plants', '新植物'], ['moved', '搬移'], ['removed', '移除個體'], ['notes', '文字'], ['media', '介質圖']]
          .forEach(function (k) { if (s[k[0]]) parts.push(k[1] + ' ' + s[k[0]]); });
        return '<div class="row"><div class="nm">' + when(r.finished_at || r.started_at) + ' <span class="' + (r.status === 'ok' ? 'ok' : 'bad') + '">' + (r.status === 'ok' ? '成功' : esc(r.status)) + '</span>' +
          '<small>' + (parts.join('、') || '沒有變動') + (s.inbox ? ';待確認 ' + s.inbox : '') + '</small></div></div>';
      }).join('') : '<p class="mute">還沒有紀錄。</p>') + '</div>';
  }

  function view() {
    var s = A.session() || { user: {} };
    var tabs = [['plants', '植物'], ['kb', '知識庫'], ['sync', '同步' + (st.inbox.length ? '<span class="badge">' + st.inbox.length + '</span>' : '')]];
    root.innerHTML = '<header><h1>StagwithyouFerns 後台</h1><span class="sp"></span><span class="mute">' + esc(s.user.email || '') + '</span>' +
      '<a class="btn sm" href="index.html">回網站</a><button class="btn sm" data-a="reload">重新整理</button><button class="btn sm" data-a="out">登出</button></header>' +
      (st.err ? '<p class="err">' + esc(st.err) + '</p>' : '') +
      '<div class="tabs">' + tabs.map(function (t) { return '<div class="tab' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join('') + '</div>' +
      (st.tab === 'plants' ? plantsTab() : st.tab === 'kb' ? kbTab() : syncTab());
    var q = document.getElementById('q');
    if (q) q.oninput = function () { st.q = q.value; var pos = q.selectionStart; view(); var n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  }

  function artById(id) { var K = window.SF_KNOWLEDGE || []; for (var i = 0; i < K.length; i++) if (K[i].id === id) return K[i]; return null; }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-a],[data-tab],[data-only]'); if (!t) return;
    if (t.getAttribute('data-tab')) { st.tab = t.getAttribute('data-tab'); return view(); }
    if (t.getAttribute('data-only')) { st.only = t.getAttribute('data-only'); return view(); }
    var a = t.getAttribute('data-a'), p = st.plants[+t.getAttribute('data-i')];
    if (a === 'note') E.note(p, view);
    else if (a === 'src') E.sources(p, null, view);
    else if (a === 'cover') E.coverPicker(p, view);
    else if (a === 'art-new') E.article(null, view);
    else if (a === 'art') E.article(artById(t.getAttribute('data-id')), view);
    else if (a === 'art-del') E.removeArticle(artById(t.getAttribute('data-id')), view);
    else if (a === 'inbox') {
      t.disabled = true;
      A.api('PATCH', 'sync_inbox?id=eq.' + t.getAttribute('data-id'), { status: t.getAttribute('data-s'), resolved_at: new Date().toISOString() }, 'return=representation')
        .then(function () { st.inbox = st.inbox.filter(function (x) { return String(x.id) !== t.getAttribute('data-id'); }); view(); },
              function (er) { st.err = er.message; view(); });
    }
    else if (a === 'reload') boot();
    else if (a === 'out') A.signOut().then(function () { loginView(''); });
  });

  function boot() {
    if (!window.SWF || !window.SWF.enabled()) { root.innerHTML = '<p class="err">動態後端沒有啟用(config/supabase.js 的 enabled 是 false),後台無法使用。</p>'; return; }
    if (!A.session()) return loginView('');
    root.innerHTML = '<p class="mute">載入中…</p>';
    A.isAdmin().then(function (ok) {
      if (!ok) { var em = (A.session() || { user: {} }).user.email; return A.signOut().then(function () { loginView((em || '這個帳號') + ' 不是管理者。'); }); }
      st.err = '';
      return loadAll().then(view, function (e) { st.err = '讀取資料失敗:' + e.message; view(); });
    });
  }
  A.handleRedirect().then(function (err) { if (err) { loginView('Google 登入失敗:' + err); } else boot(); });
})();
