/* ===== admin.js — 後台頁面(admin.html)=====
   分頁:植物(介紹 / 來源·母株 / 封面)、知識庫(新增 / 編輯 / 刪除 / 排序)、關於頁、競標(開標 / 修改 / 取消 / 出價名單)、留言(隱藏 / 顯示 / 刪除)、詢問單、同步(收件匣、紀錄、立即同步、待寫回的修改)
   編輯視窗與寫入邏輯都在 edit.js(和網站內編輯共用);這裡只負責清單與版面。
*/
(function () {
  'use strict';
  var A = window.SWFAuth, E = window.SWFEdit, CFG = window.SWF_BACKEND || {};
  var root = document.getElementById('root');
  var st = { tab: 'plants', q: '', only: 'all', plants: [], inbox: [], runs: [], pending: null, err: '', inq: [], inqOnly: 'new', busy: false, cm: [], cmOnly: 'all', views: {}, auc: [], aucOk: true };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function hasNote(p) { return !!(window.PLANT_NOTES && window.PLANT_NOTES[p.name]); }
  function photos(p) { return (p.individuals || []).reduce(function (n, iv) { return n + (iv.timeline || []).length; }, 0); }

  // ---------- 登入 ----------
  function loginView(msg) {
    root.innerHTML = '<div class="login card"><h2>StagwithyouFerns 後台</h2>' +
      '<p class="mute">用 Google 帳號登入(與 PlantDex 共用帳號)。</p>' +
      '<button class="btn pri" id="gg" style="width:100%">用 Google 登入</button>' +
      '<div class="err" id="lerr">' + esc(msg || '') + '</div>' +
      '<a class="btn" href="index.html">回網站</a></div>';
    document.getElementById('gg').onclick = function () { A.signInWithGoogle(); };
  }

  // ---------- 資料 ----------
  function loadAll() {
    return window.SWF.loadAll().then(function (d) {
      st.plants = d.plants.filter(function (p) { return p.category !== '日記'; });
      return E.loadPrivate();      // 私人知識庫(只有管理者讀得到)
    }).then(function () {
      return Promise.all([
        A.api('GET', 'sync_inbox?select=id,created_at,kind,title,status&status=eq.open&order=created_at.desc&limit=200'),
        A.api('GET', 'sync_runs?select=id,started_at,finished_at,status,summary&order=id.desc&limit=8'),
        Promise.all(['plant_notes', 'sources', 'plants', 'individuals', 'articles', 'about'].map(function (t) {
          return A.api('GET', t + '?select=web_edited&web_edited=eq.true&limit=1000').then(function (r) { return [t, (r || []).length]; }, function () { return [t, null]; });
        })),
        A.api('GET', 'inquiries?select=id,created_at,name,contact,items,message,status&order=created_at.desc&limit=300').then(null, function () { return []; }),
        A.api('GET', 'comments?select=id,plant_key,body,created_at,user_id,is_hidden&order=created_at.desc&limit=300').then(null, function () { return []; }),
        A.api('GET', 'comments_public?select=id,display_name&order=created_at.desc&limit=300').then(null, function () { return []; }),
        A.api('GET', 'views?select=plant_key,count&limit=5000').then(null, function () { return []; }),
        loadAuctions()
      ]);
    }).then(function (r) {
      st.inbox = r[0] || []; st.runs = r[1] || []; st.pending = r[2]; st.inq = r[3] || [];
      var names = {}; (r[5] || []).forEach(function (x) { names[x.id] = x.display_name; });
      st.cm = (r[4] || []).map(function (c) { c.display_name = names[c.id] || ''; return c; });
      st.views = {}; (r[6] || []).forEach(function (v) { st.views[v.plant_key] = v.count; });
    });
  }

  // 競標:先把時間到了的標成結束,再讀全部(資料庫還沒有競標的表 → aucOk = false)
  function loadAuctions() {
    return A.api('POST', 'rpc/settle_expired', {}).then(null, function () {}).then(function () {
      return A.api('GET', 'auctions?select=*&order=id.desc&limit=300');
    }).then(function (r) { st.auc = r || []; st.aucOk = true; }, function () { st.auc = []; st.aucOk = false; });
  }

  // ---------- 畫面 ----------
  function plantsTab() {
    var q = st.q.toLowerCase();
    var list = st.plants.filter(function (p) {
      if (st.only === 'nonote' && hasNote(p)) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.latin || '') + ' ' + (p.pid || '') + ' ' + p.category).toLowerCase().indexOf(q) >= 0;
    });
    if (st.only === 'hot') list = list.slice().sort(function (a, b) { return (st.views[b.key] || 0) - (st.views[a.key] || 0); });
    var missing = st.plants.filter(function (p) { return !hasNote(p); }).length;
    return '<div class="tools"><input type="text" id="q" placeholder="搜尋名稱 / 學名 / ID" value="' + esc(st.q) + '">' +
      '<span class="chip' + (st.only === 'all' ? ' on' : '') + '" data-only="all">全部 ' + st.plants.length + '</span>' +
      '<span class="chip' + (st.only === 'nonote' ? ' on' : '') + '" data-only="nonote">缺介紹 ' + missing + '</span>' +
      '<span class="chip' + (st.only === 'hot' ? ' on' : '') + '" data-only="hot">依瀏覽數排序</span></div>' +
      '<div class="card">' + (list.length ? list.slice(0, 300).map(function (p) {
        var i = st.plants.indexOf(p);
        return '<div class="row"><div class="nm">' + esc(p.name) + '<small>' + esc(p.pid || '') + ' · ' + esc(p.category) + ' · ' + (p.individuals || []).length + ' 個體 · ' + photos(p) + ' 張' + (st.views[p.key] ? ' · 👁 ' + st.views[p.key] : '') + '</small>' +
          (hasNote(p) ? '' : '<span class="badge">缺介紹</span>') + (p.coverLocked ? '<span class="badge g">封面已鎖定</span>' : '') + '</div>' +
          '<button class="btn sm" data-a="note" data-i="' + i + '">介紹</button>' +
          '<button class="btn sm" data-a="src" data-i="' + i + '">來源·母株</button>' +
          '<button class="btn sm" data-a="cover" data-i="' + i + '">封面</button>' +
          (p.pid ? '<a class="btn sm" target="_blank" href="index.html?id=' + encodeURIComponent(p.pid) + '">開啟</a>' : '') + '</div>';
      }).join('') : '<p class="mute">沒有符合的植物。</p>') + '</div>';
  }

  function kbTab() {
    var K = window.SF_KNOWLEDGE || [], cats = window.SF_KNOWLEDGE_CATS || [];
    var pc = window.SF_KNOWLEDGE_PRIVATE_CATS || [], np = K.filter(function (a) { return a.adminOnly; }).length;
    return '<div class="tools"><button class="btn pri" data-a="art-new">+ 新增文章</button><span class="mute">共 ' + K.length + ' 篇' +
      (np ? '(其中 🔒 私人 ' + np + ' 篇,只有你登入後看得到)' : '') + '</span></div>' +
      cats.map(function (c) {
        var items = K.filter(function (a) { return a.cat === c; });
        return '<div class="card"><h2>' + (pc.indexOf(c) >= 0 ? '🔒 ' : '') + esc(c) + ' <span class="mute">' + items.length + '</span></h2>' + (items.length ? items.map(function (a, n) {
          var dis = st.busy ? ' disabled' : '';
          return '<div class="row"><div class="nm">' + (a.adminOnly ? '🔒 ' : '') + esc(a.title) + '<small>' + esc(a.group || '') + '</small></div>' +
            '<button class="btn sm" title="上移" aria-label="上移" data-a="art-up" data-id="' + esc(a.id) + '"' + (n === 0 ? ' disabled' : dis) + '>↑</button>' +
            '<button class="btn sm" title="下移" aria-label="下移" data-a="art-dn" data-id="' + esc(a.id) + '"' + (n === items.length - 1 ? ' disabled' : dis) + '>↓</button>' +
            '<button class="btn sm" data-a="art" data-id="' + esc(a.id) + '">編輯</button>' +
            '<button class="btn sm" data-a="art-del" data-id="' + esc(a.id) + '">刪除</button></div>';
        }).join('') : '<p class="mute">這個分類還沒有文章。</p>') + '</div>';
      }).join('');
  }

  // 關於頁:預覽 + 編輯
  function aboutTab() {
    var lines = window.SF_ABOUT || [];
    return '<div class="card"><h2>關於頁</h2><div class="tools"><button class="btn pri" data-a="about">✎ 編輯關於頁</button>' +
      '<a class="btn" target="_blank" href="index.html">到網站看(大廳 →「關於」)</a></div>' +
      '<div class="about-pre">' + (lines.length ? lines.map(function (l) { return l === '' ? '<br>' : '<div>' + esc(l) + '</div>'; }).join('') : '<p class="mute">還沒有內容。</p>') + '</div></div>';
  }

  // 競標
  function aucPhase(a) {
    if (a.status === 'cancelled') return 'cancelled';
    if (a.status === 'ended' || Date.now() >= +new Date(a.ends_at)) return 'ended';
    return Date.now() < +new Date(a.starts_at) ? 'soon' : 'live';
  }
  function aucTodo() { return st.auc.filter(function (a) { return aucPhase(a) === 'ended' && !a.handled && a.bid_count > 0; }).length; }
  function nt(n) { return 'NT$ ' + Number(n).toLocaleString(); }
  function aucRow(a) {
    var ph = aucPhase(a), p = plantOf(a.plant_key);
    var tag = ph === 'live' ? '<span class="badge g">進行中</span>' : ph === 'soon' ? '<span class="badge">即將開始</span>'
            : ph === 'cancelled' ? '<span class="badge">已取消</span>' : (a.bid_count ? (a.handled ? '<span class="badge g">已處理</span>' : '<span class="badge">待聯絡得標者</span>') : '<span class="badge">流標</span>');
    var price = a.current_price == null ? '起標 ' + nt(a.start_price) + ' · 還沒有人出價' : (ph === 'ended' ? '得標 ' : '目前 ') + nt(a.current_price) + ' · ' + a.bid_count + ' 次出價';
    var b = '';
    if (ph === 'live' || ph === 'soon') b += '<button class="btn sm" data-a="auc-edit" data-id="' + a.id + '">修改</button><button class="btn sm" data-a="auc-cancel" data-id="' + a.id + '">取消競標</button>';
    if (a.bid_count) b += '<button class="btn sm' + (ph === 'ended' && !a.handled ? ' pri' : '') + '" data-a="auc-bidders" data-id="' + a.id + '">' + (ph === 'ended' ? '得標者 / 出價名單' : '出價名單') + '</button>';
    if (ph === 'ended' && a.bid_count) b += '<button class="btn sm" data-a="auc-handled" data-id="' + a.id + '" data-h="' + (a.handled ? '0' : '1') + '">' + (a.handled ? '改回未處理' : '標為已處理') + '</button>';
    if (a.individual_id) b += '<a class="btn sm" target="_blank" href="index.html?id=' + encodeURIComponent(a.individual_id) + '">開啟</a>';
    return '<div class="row inq"><div class="nm">' + tag + ' ' + esc(a.plant_name) + ' ' + esc(a.indiv_label || '') + '<small>' + esc(a.individual_id || (p ? '' : '(個體已不存在)')) + '</small>' +
      '<div class="inq-b">' + price + (a.buy_now_price ? ' · 直購 ' + nt(a.buy_now_price) : '') + ' · 每次加 ' + nt(a.min_increment) + '</div>' +
      '<div class="inq-b">' + (ph === 'soon' ? '開始 ' + when(a.starts_at) + ' · ' : '') + (ph === 'ended' ? '已結標 ' : '結標 ') + when(a.ends_at) + (a.ended_reason === 'buy_now' ? '(直購成交)' : '') + '</div>' +
      (a.note ? '<div class="inq-b inq-msg">' + esc(a.note) + '</div>' : '') + '</div>' + b + '</div>';
  }
  function aucTab() {
    if (!st.aucOk) return '<div class="card"><h2>競標</h2><p class="bad">資料庫還沒有競標功能。請到 Supabase → SQL Editor 執行 <b>Docs/migrations/swf_005_auctions.sql</b>,再回來按「重新整理」。</p></div>';
    var act = st.auc.filter(function (a) { var p = aucPhase(a); return p === 'live' || p === 'soon'; });
    var todo = st.auc.filter(function (a) { return aucPhase(a) === 'ended' && !a.handled && a.bid_count > 0; });
    var rest = st.auc.filter(function (a) { return act.indexOf(a) < 0 && todo.indexOf(a) < 0; });
    function sec(title, list, empty) { return '<div class="card"><h2>' + title + ' <span class="mute">' + list.length + '</span></h2>' + (list.length ? list.map(aucRow).join('') : '<p class="mute">' + empty + '</p>') + '</div>'; }
    return '<div class="tools"><button class="btn pri" data-a="auc-new">+ 開始新的競標</button>' +
        '<span class="mute">也可以在網站的植物頁按「🔨 開始競標這個個體」。結標後這裡會出現得標者的 Email,由你自己聯絡(網站不收款)。</span></div>' +
      sec('已結標,待聯絡得標者', todo, '沒有待處理的。') + sec('進行中 / 即將開始', act, '目前沒有進行中的競標。') + sec('已處理 / 流標 / 已取消', rest, '還沒有紀錄。');
  }
  function aucById(id) { for (var i = 0; i < st.auc.length; i++) if (String(st.auc[i].id) === String(id)) return st.auc[i]; return null; }
  function reloadAuc() { return loadAuctions().then(view); }

  // 留言:全部留言(含已隱藏),可隱藏 / 重新顯示 / 刪除
  function plantOf(key) { for (var i = 0; i < st.plants.length; i++) if (st.plants[i].key === key) return st.plants[i]; return null; }
  function cmSeen() { try { return +localStorage.getItem('swf_admin_cm_seen') || 0; } catch (e) { return 0; } }
  function cmNew() { var s = cmSeen(); return st.cm.filter(function (c) { return c.id > s; }).length; }
  function cmTab() {
    var hid = st.cm.filter(function (c) { return c.is_hidden; }).length;
    var list = st.cm.filter(function (c) { return st.cmOnly === 'all' || c.is_hidden; });
    var seen = cmSeen();
    var html = '<div class="tools"><span class="chip' + (st.cmOnly === 'all' ? ' on' : '') + '" data-cm="all">全部 ' + st.cm.length + '</span>' +
        '<span class="chip' + (st.cmOnly === 'hidden' ? ' on' : '') + '" data-cm="hidden">已隱藏 ' + hid + '</span>' +
        '<span class="mute">留言一送出就會公開;不適合的可以隱藏(訪客看不到,可再顯示)或刪除(無法復原)。</span></div>' +
      '<div class="card">' + (list.length ? list.map(function (c) {
        var p = plantOf(c.plant_key);
        return '<div class="row inq"><div class="nm">' + (c.id > seen ? '<span class="badge">新</span> ' : '') + (c.is_hidden ? '<span class="badge">已隱藏</span> ' : '') +
            esc(c.display_name || (!c.user_id ? '訪客' : c.is_hidden ? '(已隱藏的留言)' : '植友')) + '<small>' + when(c.created_at) + ' · ' +
            (p ? (p.pid ? '<a target="_blank" href="index.html?id=' + encodeURIComponent(p.pid) + '">' + esc(p.name) + '</a>' : esc(p.name)) : '(植物已不存在)') + '</small>' +
            '<div class="inq-b inq-msg">' + esc(c.body) + '</div></div>' +
          '<button class="btn sm" data-a="cm-hide" data-id="' + c.id + '" data-h="' + (c.is_hidden ? '0' : '1') + '">' + (c.is_hidden ? '重新顯示' : '隱藏') + '</button>' +
          '<button class="btn sm" data-a="cm-del" data-id="' + c.id + '">刪除</button></div>';
      }).join('') : '<p class="mute">' + (st.cm.length ? '沒有已隱藏的留言。' : '目前還沒有留言。') + '</p>') + '</div>';
    var top = st.cm.reduce(function (m, c) { return Math.max(m, c.id); }, 0);      // 看過這一頁 → 「新」的數量歸零
    if (top > seen) { try { localStorage.setItem('swf_admin_cm_seen', String(top)); } catch (e) {} }
    return html;
  }

  // 詢問單:訪客按「購買 / 詢問」送出的聯絡資料(只有管理者讀得到)
  var INQ = { 'new': '未處理', replied: '已回覆', done: '完成' };
  function itemText(it) {
    if (it == null) return '';
    if (typeof it !== 'object') return String(it);
    var nm = it.name || it.title || it.plant || '', id = it.id || it.pid || '', extra = [];
    if (it.label) extra.push(it.label);
    if (it.price != null && it.price !== '') extra.push('NT$ ' + it.price);
    return (nm || JSON.stringify(it)) + (id ? '(' + id + ')' : '') + (it.qty > 1 ? ' ×' + it.qty : '') + (extra.length ? ' · ' + extra.join(' · ') : '');
  }
  function inqTab() {
    var n = { all: st.inq.length }; ['new', 'replied', 'done'].forEach(function (k) { n[k] = st.inq.filter(function (x) { return x.status === k; }).length; });
    var list = st.inq.filter(function (x) { return st.inqOnly === 'all' || x.status === st.inqOnly; });
    return '<div class="tools">' + [['new', '未處理'], ['replied', '已回覆'], ['done', '完成'], ['all', '全部']].map(function (k) {
        return '<span class="chip' + (st.inqOnly === k[0] ? ' on' : '') + '" data-inq="' + k[0] + '">' + k[1] + ' ' + n[k[0]] + '</span>'; }).join('') + '</div>' +
      '<div class="card">' + (list.length ? list.map(function (x) {
        var items = Array.isArray(x.items) ? x.items : (x.items ? [x.items] : []);
        var mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.contact || '');
        return '<div class="row inq"><div class="nm"><span class="badge' + (x.status === 'new' ? '' : ' g') + '">' + INQ[x.status] + '</span> ' + esc(x.name) +
            '<small>' + when(x.created_at) + '</small>' +
            '<div class="inq-b">聯絡方式:' + (mail ? '<a href="mailto:' + esc(x.contact) + '">' + esc(x.contact) + '</a>' : esc(x.contact)) + '</div>' +
            (items.length ? '<div class="inq-b">想要的植物:' + items.map(function (it) { return esc(itemText(it)); }).join('、') + '</div>' : '') +
            (x.message ? '<div class="inq-b inq-msg">' + esc(x.message) + '</div>' : '') + '</div>' +
          [['replied', '標為已回覆'], ['done', '完成'], ['new', '改回未處理']].filter(function (k) { return k[0] !== x.status; }).map(function (k) {
            return '<button class="btn sm" data-a="inq" data-id="' + x.id + '" data-s="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
      }).join('') : '<p class="mute">' + (st.inq.length ? '這個狀態沒有詢問單。' : '目前沒有詢問單。訪客在網站上按「購買 / 詢問」送出後會出現在這裡(商店功能目前是關閉的,要等互動功能上線才會有資料)。') + '</p>') + '</div>';
  }

  var KIND = { new_plant: '新植物', rename: '改名', missing: '照片不見', duplicate: '重複上傳', loose: '散落照片', diary_loose: '日記散照',
               naming: '命名不合規', folder: '不認得的資料夾', media: '介質', denied: '讀不到' };
  function syncTab() {
    var repo = CFG.repo || '';
    var pend = (st.pending || []).filter(function (x) { return x[1]; });
    var zh = { plant_notes: '介紹', sources: '來源·母株', plants: '植物封面', individuals: '個體封面', articles: '文章', about: '關於頁' };
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
    var newInq = st.inq.filter(function (x) { return x.status === 'new'; }).length;
    var nCm = st.tab === 'cm' ? 0 : cmNew();
    var nAuc = aucTodo();
    var tabs = [['plants', '植物'], ['kb', '知識庫'], ['about', '關於頁'], ['auc', '競標' + (nAuc ? '<span class="badge">' + nAuc + '</span>' : '')], ['cm', '留言' + (nCm ? '<span class="badge">' + nCm + '</span>' : '')], ['inq', '詢問單' + (newInq ? '<span class="badge">' + newInq + '</span>' : '')], ['sync', '同步' + (st.inbox.length ? '<span class="badge">' + st.inbox.length + '</span>' : '')]];
    root.innerHTML = '<header><h1>StagwithyouFerns 後台</h1><span class="sp"></span><span class="mute">' + esc(s.user.email || '') + '</span>' +
      '<a class="btn sm" href="index.html">回網站</a><button class="btn sm" data-a="reload">重新整理</button><button class="btn sm" data-a="out">登出</button></header>' +
      (st.err ? '<p class="err">' + esc(st.err) + '</p>' : '') +
      '<div class="tabs">' + tabs.map(function (t) { return '<div class="tab' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join('') + '</div>' +
      (st.tab === 'plants' ? plantsTab() : st.tab === 'kb' ? kbTab() : st.tab === 'about' ? aboutTab() : st.tab === 'auc' ? aucTab() : st.tab === 'cm' ? cmTab() : st.tab === 'inq' ? inqTab() : syncTab());
    var q = document.getElementById('q');
    if (q) q.oninput = function () { st.q = q.value; var pos = q.selectionStart; view(); var n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  }

  function artById(id) { var K = window.SF_KNOWLEDGE || []; for (var i = 0; i < K.length; i++) if (K[i].id === id) return K[i]; return null; }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-a],[data-tab],[data-only],[data-inq],[data-cm]'); if (!t) return;
    if (t.getAttribute('data-cm')) { st.cmOnly = t.getAttribute('data-cm'); return view(); }
    if (t.getAttribute('data-inq')) { st.inqOnly = t.getAttribute('data-inq'); return view(); }
    if (t.getAttribute('data-tab')) { st.tab = t.getAttribute('data-tab'); return view(); }
    if (t.getAttribute('data-only')) { st.only = t.getAttribute('data-only'); return view(); }
    var a = t.getAttribute('data-a'), p = st.plants[+t.getAttribute('data-i')];
    if (a === 'note') E.note(p, view);
    else if (a === 'src') E.sources(p, null, view);
    else if (a === 'cover') E.coverPicker(p, view);
    else if (a === 'art-new') E.article(null, view);
    else if (a === 'art') E.article(artById(t.getAttribute('data-id')), view);
    else if (a === 'art-del') E.removeArticle(artById(t.getAttribute('data-id')), view);
    else if (a === 'art-up' || a === 'art-dn') {
      if (st.busy) return;
      st.busy = true; st.err = ''; view();
      E.moveArticle(artById(t.getAttribute('data-id')), a === 'art-up' ? -1 : 1)
        .then(function () { st.busy = false; view(); }, function (er) { st.busy = false; st.err = '排序沒有成功:' + er.message; view(); });
    }
    else if (a === 'about') E.about(view);
    else if (a === 'auc-new') E.auction({ plants: st.plants }, reloadAuc);
    else if (a === 'auc-edit') E.auction({ row: aucById(t.getAttribute('data-id')) }, reloadAuc);
    else if (a === 'auc-cancel') E.cancelAuction(aucById(t.getAttribute('data-id')), reloadAuc);
    else if (a === 'auc-bidders') E.auctionBidders(aucById(t.getAttribute('data-id')));
    else if (a === 'auc-handled') {
      t.disabled = true;
      var hv = t.getAttribute('data-h') === '1', hid = t.getAttribute('data-id');
      A.api('PATCH', 'auctions?id=eq.' + hid, { handled: hv }, 'return=representation').then(function (rows) {
        if (!rows || !rows.length) throw new Error('沒有改到資料');
        var x = aucById(hid); if (x) x.handled = hv;
        st.err = ''; view();
      }).then(null, function (er) { st.err = '沒有更新:' + er.message; view(); });
    }
    else if (a === 'cm-hide') {
      t.disabled = true;
      var hide = t.getAttribute('data-h') === '1';
      A.api('PATCH', 'comments?id=eq.' + t.getAttribute('data-id'), { is_hidden: hide }, 'return=representation').then(function (rows) {
        if (!rows || !rows.length) throw new Error('沒有改到資料');
        st.cm.forEach(function (c) { if (String(c.id) === t.getAttribute('data-id')) c.is_hidden = hide; });
        st.err = ''; view();
      }).then(null, function (er) { st.err = '留言沒有更新:' + er.message; view(); });
    }
    else if (a === 'cm-del') {
      var cid = t.getAttribute('data-id');
      E.modal({ title: '刪除留言?', hint: '刪除後無法復原。只是不想讓訪客看到的話,用「隱藏」就好。',
        extra: [{ label: '確定刪除', cls: 'danger', onClick: function (close) {
          return A.api('DELETE', 'comments?id=eq.' + cid, null, 'return=representation').then(function (rows) {
            if (!rows || !rows.length) throw new Error('沒有刪到資料');
            st.cm = st.cm.filter(function (c) { return String(c.id) !== cid; });
            close(); view();
          });
        } }] });
    }
    else if (a === 'inq') {
      t.disabled = true;
      A.api('PATCH', 'inquiries?id=eq.' + t.getAttribute('data-id'), { status: t.getAttribute('data-s') }, 'return=representation')
        .then(function (rows) {
          if (!rows || !rows.length) throw new Error('沒有改到資料');
          st.inq.forEach(function (x) { if (String(x.id) === t.getAttribute('data-id')) x.status = t.getAttribute('data-s'); });
          st.err = ''; view();
        }).then(null, function (er) { st.err = '狀態沒有更新:' + er.message; view(); });
    }
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
