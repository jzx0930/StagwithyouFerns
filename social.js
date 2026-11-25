/* ===== social.js — 互動功能:瀏覽數 / 收藏 / 留言(資料在 Supabase swf schema)=====
   window.SWFSocial
     .on()                         動態後端有開才有互動功能
     .sync()                       Promise<boolean> 依登入狀態讀(或清掉)自己的收藏;收藏清單有變回傳 true
     .isFav(key) / .favKeys()      這株有沒有收藏 / 全部收藏的 plant key
     .barHTML(plant)               詳情頁:收藏鈕 + 瀏覽數(只回傳空殼,內容由 mount 填)
     .commentsHTML(plant)          詳情頁:留言區空殼
     .mount(plant, {admin, id})    畫面畫好後呼叫:計一次瀏覽、填入瀏覽數 / 收藏狀態 / 留言
   誰能做什麼由資料庫 RLS 把關:訪客只能讀;登入才能收藏、留言;只能刪自己的留言,管理者可隱藏或刪除任何留言。
   plant 要有 key(backend.js 從資料庫讀出來時帶上);離線備援(data.json)沒有 key,互動功能自動不出現。
*/
(function () {
  'use strict';
  var CFG = window.SWF_BACKEND || {}, A = window.SWFAuth;
  var favs = null;                 // null = 沒登入;{key:1} = 已登入者的收藏
  var cur = null;                  // 目前詳情頁:{ key, admin, id }
  var viewCache = {};              // key -> 瀏覽數
  var cmCache = { key: null, rows: null, t: 0 };
  var MAXLEN = 1000;

  function on() { return !!(CFG.enabled && CFG.url && CFG.anonKey && A); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function enc(v) { return encodeURIComponent(v); }
  function $(id) { return document.getElementById(id); }
  function day(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2); }
  function uid() { var s = A && A.session(); return (s && s.user && s.user.id) || null; }

  // 訪客也能做的請求(公開金鑰):讀瀏覽數 / 留言、計一次瀏覽
  function pub(method, path, body) {
    var h = { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey, 'Accept-Profile': CFG.schema || 'swf', 'Content-Profile': CFG.schema || 'swf' };
    if (body) h['Content-Type'] = 'application/json';
    return fetch(String(CFG.url).replace(/\/+$/, '') + '/rest/v1/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; }); });
  }

  // ---------- 收藏 ----------
  function sync() {
    if (!on()) return Promise.resolve(false);
    var before = favs ? Object.keys(favs).sort().join() : null;
    if (!uid()) { favs = null; return Promise.resolve(before !== null && before !== ''); }
    return A.api('GET', 'favorites?select=plant_key&limit=2000').then(function (rows) {
      favs = {}; (rows || []).forEach(function (r) { favs[r.plant_key] = 1; });
      return Object.keys(favs).sort().join() !== (before || '');
    }, function () { favs = favs || {}; return false; });
  }
  function isFav(key) { return !!(favs && key && favs[key]); }
  function favKeys() { return favs ? Object.keys(favs) : []; }
  function toggleFav() {
    if (!cur) return;
    if (!uid()) return askLogin();
    var key = cur.key, was = isFav(key), btn = $('soc-fav');
    if (btn) btn.disabled = true;
    var req = was ? A.api('DELETE', 'favorites?plant_key=eq.' + enc(key) + '&user_id=eq.' + enc(uid()))
                  : A.api('POST', 'favorites?on_conflict=user_id,plant_key', [{ plant_key: key }], 'resolution=ignore-duplicates,return=minimal');
    req.then(function () {
      favs = favs || {}; if (was) delete favs[key]; else favs[key] = 1;
      paintFav();
    }, function (e) { paintFav(); note('soc-bar-msg', (e && e.message) || '沒有成功,請再試一次'); });
  }
  function paintFav() {
    var b = $('soc-fav'); if (!b || !cur) return;
    var f = isFav(cur.key);
    b.disabled = false; b.className = 'soc-fav' + (f ? ' on' : '');
    b.setAttribute('aria-pressed', f ? 'true' : 'false');
    b.textContent = f ? '♥ 已收藏' : '♡ 收藏';
  }

  // ---------- 瀏覽數 ----------
  function countView(key) {
    var seen = [];
    try { seen = JSON.parse(sessionStorage.getItem('swf_seen') || '[]'); } catch (e) {}
    if (seen.indexOf(key) >= 0) return Promise.resolve();      // 同一次造訪同一株只算一次
    seen.push(key);
    try { sessionStorage.setItem('swf_seen', JSON.stringify(seen.slice(-400))); } catch (e) {}
    delete viewCache[key];
    return pub('POST', 'rpc/add_view', { p: key }).then(null, function () {});
  }
  function paintViews(key) {
    var el = $('soc-views'); if (!el || !cur || cur.key !== key) return;
    var n = viewCache[key];
    el.textContent = n ? '👁 ' + Number(n).toLocaleString() + ' 次瀏覽' : '';
  }
  function loadViews(key) {
    if (key in viewCache) { paintViews(key); return; }
    pub('GET', 'views?select=count&plant_key=eq.' + enc(key)).then(function (rows) {
      viewCache[key] = (rows && rows[0] && rows[0].count) || 0; paintViews(key);
    }, function () {});
  }

  // ---------- 留言 ----------
  function loadComments(key, force) {
    if (!force && cmCache.key === key && cmCache.rows && Date.now() - cmCache.t < 30000) { paintComments(key); return Promise.resolve(); }
    return pub('GET', 'comments_public?select=id,body,created_at,user_id,display_name&plant_key=eq.' + enc(key) + '&order=created_at.asc&limit=300').then(function (rows) {
      cmCache = { key: key, rows: rows || [], t: Date.now() }; paintComments(key);
    }, function () {
      var l = $('soc-cm-list'); if (l && cur && cur.key === key) l.innerHTML = '<p class="soc-mute">留言暫時讀不到,請稍後再試。</p>';
    });
  }
  function paintComments(key) {
    var list = $('soc-cm-list'); if (!list || !cur || cur.key !== key) return;
    var rows = cmCache.rows || [], me = uid();
    var n = $('soc-cm-n'); if (n) n.textContent = rows.length ? rows.length + ' 則' : '';
    list.innerHTML = rows.length ? rows.map(function (c) {
      var mine = me && c.user_id === me;
      var acts = (cur.admin ? '<button class="soc-x" data-soc="cm-hide" data-id="' + c.id + '">隱藏</button>' : '') +
                 (mine || cur.admin ? '<button class="soc-x" data-soc="cm-del" data-id="' + c.id + '">刪除</button>' : '');
      return '<div class="soc-c"><div class="soc-c-h"><b>' + esc(c.display_name || '植友') + '</b>' + (mine ? '<span class="soc-me">你</span>' : '') +
        '<span class="soc-d">' + day(c.created_at) + '</span>' + acts + '</div><div class="soc-c-b">' + esc(c.body) + '</div></div>';
    }).join('') : '<p class="soc-mute">還沒有留言,當第一個留言的人吧。</p>';
    paintForm();
  }
  function paintForm() {
    var f = $('soc-cm-form'); if (!f) return;
    f.innerHTML = uid()
      ? '<textarea id="soc-cm-text" maxlength="' + MAXLEN + '" rows="3" placeholder="想說點什麼…(最多 ' + MAXLEN + ' 字)" aria-label="留言內容"></textarea>' +
        '<div class="soc-row"><button class="soc-btn" data-soc="cm-send">送出留言</button><span class="soc-msg" id="soc-cm-msg" role="alert"></span></div>'
      : '<div class="soc-row"><button class="soc-btn" data-soc="login">登入後留言</button><span class="soc-mute">用 Google 帳號登入即可,不用另外註冊。</span></div>';
  }
  function note(id, text) { var m = $(id); if (m) m.textContent = text || ''; }
  function sendComment(btn) {
    if (!cur) return;
    if (!uid()) return askLogin();
    var ta = $('soc-cm-text'), body = ta ? ta.value.replace(/\r/g, '').trim() : '', key = cur.key;
    if (!body) return note('soc-cm-msg', '請先輸入留言內容');
    if (body.length > MAXLEN) return note('soc-cm-msg', '留言太長了(最多 ' + MAXLEN + ' 字)');
    btn.disabled = true; note('soc-cm-msg', '送出中…');
    A.api('POST', 'comments', [{ plant_key: key, body: body }], 'return=minimal').then(function () {
      return loadComments(key, true);
    }).then(null, function (e) {
      btn.disabled = false; note('soc-cm-msg', '沒有送出:' + ((e && e.message) || '請再試一次'));
    });
  }
  // 刪除 / 隱藏:第一次按先變成「確定?」,再按一次才執行
  function actComment(btn, kind) {
    if (!cur) return;
    if (btn.getAttribute('data-sure') !== '1') {
      btn.setAttribute('data-sure', '1'); btn.textContent = kind === 'del' ? '確定刪除?' : '確定隱藏?';
      setTimeout(function () { if (btn.getAttribute('data-sure') === '1') { btn.removeAttribute('data-sure'); btn.textContent = kind === 'del' ? '刪除' : '隱藏'; } }, 4000);
      return;
    }
    var id = btn.getAttribute('data-id'), key = cur.key;
    btn.disabled = true;
    var req = kind === 'del' ? A.api('DELETE', 'comments?id=eq.' + enc(id), null, 'return=representation')
                             : A.api('PATCH', 'comments?id=eq.' + enc(id), { is_hidden: true }, 'return=representation');
    req.then(function (rows) {
      if (!rows || !rows.length) throw new Error('沒有改到(可能不是你的留言)');
      return loadComments(key, true);
    }).then(null, function (e) { btn.disabled = false; btn.removeAttribute('data-sure'); btn.textContent = (e && e.message) || '失敗'; });
  }

  // 登入後回到同一株(把植物 ID 帶在網址上)
  function askLogin() {
    if (!window.SWFEdit) return;
    window.SWFEdit.login(null, cur && cur.id ? '?id=' + enc(cur.id) : '');
  }

  // ---------- 詳情頁 ----------
  function barHTML(p) {
    if (!on() || !p || !p.key) return '';
    return '<div class="soc-bar" id="soc-bar"><button class="soc-fav" id="soc-fav" data-soc="fav" aria-pressed="false">♡ 收藏</button>' +
      '<span class="soc-views" id="soc-views"></span><span class="soc-msg" id="soc-bar-msg" role="alert"></span></div>';
  }
  function commentsHTML(p) {
    if (!on() || !p || !p.key) return '';
    return '<section class="soc-cm" id="soc-cm" aria-label="留言"><div class="tl-head"><h2>留言</h2><div class="tl-order" id="soc-cm-n"></div></div>' +
      '<div id="soc-cm-list"><p class="soc-mute">載入中…</p></div><div id="soc-cm-form"></div></section>';
  }
  function mount(p, opts) {
    opts = opts || {};
    if (!on() || !p || !p.key || !$('soc-bar')) { cur = null; return; }
    var key = p.key;
    cur = { key: key, admin: !!opts.admin, id: opts.id || p.pid || '' };
    paintFav();
    (opts.admin ? Promise.resolve() : countView(key)).then(function () { loadViews(key); });   // 管理者自己看不算瀏覽
    loadComments(key);
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-soc]') : null;
      if (!t) return;
      var a = t.getAttribute('data-soc');
      if (a === 'fav') toggleFav();
      else if (a === 'login') askLogin();
      else if (a === 'cm-send') sendComment(t);
      else if (a === 'cm-del') actComment(t, 'del');
      else if (a === 'cm-hide') actComment(t, 'hide');
    });
  }

  window.SWFSocial = { on: on, sync: sync, isFav: isFav, favKeys: favKeys, barHTML: barHTML, commentsHTML: commentsHTML, mount: mount };
})();
