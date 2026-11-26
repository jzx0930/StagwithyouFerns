/* ===== auction.js — 競標(資料在 Supabase swf schema;規則全部由資料庫的 swf.place_bid() 把關)=====
   window.SWFAuction
     .on()                         動態後端有開才有競標
     .load()                       Promise<boolean> 讀全部競標(登入者另外讀自己出過價的場次);內容有變回傳 true
     .any() / .attention()         有沒有任何競標 / 需要注意的數量(出價被超過 + 得標還沒看過)
     .forIndiv(id)                 這個個體目前(或最近結束)的競標
     .liveFor(plantKey)            這株有沒有個體正在競標(卡片上的「競標中」標記)
     .blockHTML(indivId)           詳情頁:競標區塊的空殼(該個體沒有競標就回傳空字串)
     .mount(opts)                  詳情頁畫好後呼叫:填內容、倒數、定時更新。opts = { indivId, admin, id }
     .pageHTML(ctx)                競標列表頁的內容。ctx = { find(individualId) -> {p, iv} | null, img(driveId, w) -> url }
   出價只能呼叫 rpc/place_bid;金額、時間、直購、自動延長都在資料庫裡判斷,前端只是顯示。
   結標通知信:第一個發現「已結標但還沒通知」的瀏覽器向資料庫領取(claim_auction_notice),領到的人用 Web3Forms 寄給站主。
*/
(function () {
  'use strict';
  var CFG = window.SWF_BACKEND || {}, A = window.SWFAuth;
  var rows = [], myIds = {}, loaded = false, offset = 0;      // offset = 伺服器時間 − 本機時間(毫秒)
  var cur = null, tick = null, poll = null, bidsCache = {};
  var RECENT = 14 * 86400000;                                  // 結標後還顯示幾天

  function on() { return !!(CFG.enabled && CFG.url && CFG.anonKey && A); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function enc(v) { return encodeURIComponent(v); }
  function $(id) { return document.getElementById(id); }
  function uid() { var s = A && A.session(); return (s && s.user && s.user.id) || null; }
  function now() { return Date.now() + offset; }
  function money(n) { return (((window.SHOP_CONFIG || {}).currency) || 'NT$') + ' ' + Number(n).toLocaleString(); }
  function when(iso) { var d = new Date(iso); if (isNaN(d)) return ''; function z(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + '.' + z(d.getMonth() + 1) + '.' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  function left(ms) {
    if (ms <= 0) return '已結束';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return '剩 ' + d + ' 天 ' + h + ' 小時';
    if (h) return '剩 ' + h + ' 小時 ' + m + ' 分';
    if (m) return '剩 ' + m + ' 分 ' + (s % 60) + ' 秒';
    return '剩 ' + s + ' 秒';
  }
  // 狀態以時間為準(資料庫的 status 可能還沒被標成結束)
  function phase(a) {
    if (a.status === 'ended' || now() >= +new Date(a.ends_at)) return 'ended';
    if (now() < +new Date(a.starts_at)) return 'soon';
    return 'live';
  }
  function need(a) { return a.current_price == null ? Math.max(a.start_price, 1) : a.current_price + a.min_increment; }

  function pub(method, path, body) {
    var h = { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey, 'Accept-Profile': CFG.schema || 'swf', 'Content-Profile': CFG.schema || 'swf' };
    if (body) h['Content-Type'] = 'application/json';
    return fetch(String(CFG.url).replace(/\/+$/, '') + '/rest/v1/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
        return j;
      }); });
  }
  // 登入者用自己的身分讀(才知道哪些出價是自己的);訪客用公開金鑰
  function get(path) { return uid() ? A.api('GET', path) : pub('GET', path); }

  // ---------- 讀資料 ----------
  var COLS = 'id,individual_id,plant_key,plant_name,indiv_label,note,start_price,min_increment,buy_now_price,starts_at,ends_at,status,ended_reason,current_price,bid_count,leader_name,mine,notified,server_now';
  function load() {
    if (!on()) return Promise.resolve(false);
    var sig = JSON.stringify([rows.map(strip), myIds]);
    var me = uid();
    return Promise.all([
      get('auctions_public?select=' + COLS + '&order=ends_at.asc&limit=300'),
      me ? A.api('GET', 'bids_public?select=auction_id&mine=is.true&limit=1000').then(null, function () { return []; }) : Promise.resolve([])
    ]).then(function (r) {
      var list = r[0] || [];
      if (list[0] && list[0].server_now) offset = +new Date(list[0].server_now) - Date.now();
      rows = list.filter(function (a) { return phase(a) !== 'ended' || now() - +new Date(a.ends_at) < RECENT; });
      myIds = {}; (r[1] || []).forEach(function (b) { myIds[b.auction_id] = 1; });
      loaded = true;
      rows.forEach(function (a) { if (phase(a) === 'ended' && !a.notified) notifyOwner(a); });
      return JSON.stringify([rows.map(strip), myIds]) !== sig;
    }, function () { loaded = true; return false; });        // 資料庫還沒有競標的表(尚未執行 swf_005)→ 當作沒有競標
  }
  function strip(a) { var o = {}; for (var k in a) if (k !== 'server_now' && k !== 'notified') o[k] = a[k]; return o; }

  function any() { return rows.length > 0; }
  function forIndiv(id) {
    if (!id) return null;
    var hit = rows.filter(function (a) { return a.individual_id === id; });
    if (!hit.length) return null;
    var live = hit.filter(function (a) { return phase(a) !== 'ended'; });
    return live[0] || hit.sort(function (x, y) { return +new Date(y.ends_at) - +new Date(x.ends_at); })[0];
  }
  function liveFor(key) { return !!key && rows.some(function (a) { return a.plant_key === key && phase(a) === 'live'; }); }

  // 站內通知:我出過價、現在被超過的場次 + 我得標但還沒看過的場次
  function seenWon() { try { return JSON.parse(localStorage.getItem('swf_auc_won') || '{}'); } catch (e) { return {}; } }
  function markWon(id) { try { var s = seenWon(); s[id] = 1; localStorage.setItem('swf_auc_won', JSON.stringify(s)); } catch (e) {} }
  function myState(a) {
    if (!myIds[a.id]) return '';
    var p = phase(a);
    if (p === 'ended') return a.mine ? 'won' : 'lost';
    return a.mine ? 'lead' : 'outbid';
  }
  function attention() {
    if (!uid()) return 0;
    var s = seenWon();
    return rows.filter(function (a) { var m = myState(a); return m === 'outbid' || (m === 'won' && !s[a.id]); }).length;
  }

  // ---------- 結標通知信(寄給站主)----------
  function notifyOwner(a) {
    a.notified = true;                                          // 這個分頁不再重試
    var key = (window.SHOP_CONFIG || {}).web3formsKey;
    pub('POST', 'rpc/claim_auction_notice', { a_id: a.id }).then(function (got) {
      if (got !== true || !key || /貼上/.test(key)) return;
      var title = a.plant_name + (a.indiv_label ? ' ' + a.indiv_label : '');
      var result = a.bid_count ? '得標金額 ' + money(a.current_price) + '(' + (a.leader_name || '') + ',共 ' + a.bid_count + ' 次出價)' : '沒有人出價(流標)';
      return fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: key, subject: '🌿 競標結束 — ' + title + (a.bid_count ? '(' + money(a.current_price) + ')' : '(流標)'), from_name: 'StagwithyouFerns 競標',
          '植物': title + (a.individual_id ? '(' + a.individual_id + ')' : ''), '結果': result,
          '結標方式': a.ended_reason === 'buy_now' ? '直購' : '時間到', '結標時間': when(a.ends_at),
          '下一步': '到後台「競標」分頁查看得標者的 Email 並聯絡對方。' })
      });
    }).then(null, function () {});
  }

  // ---------- 詳情頁的競標區塊 ----------
  function blockHTML(indivId) {
    if (!on() || !forIndiv(indivId)) return '';
    return '<section class="auc" id="auc-box" aria-label="競標"></section>';
  }
  function stop() { if (tick) clearInterval(tick); if (poll) clearInterval(poll); tick = poll = null; }
  function mount(opts) {
    stop(); opts = opts || {};
    var a = forIndiv(opts.indivId);
    if (!on() || !a || !$('auc-box')) { cur = null; return; }
    cur = { id: a.id, admin: !!opts.admin, deep: opts.id || a.individual_id || '' };
    paint();
    loadBids(a.id);
    tick = setInterval(function () {
      var el = $('auc-left'), x = byId(cur && cur.id);
      if (!el || !x) return stop();
      var ms = +new Date(x.ends_at) - now();
      el.textContent = phase(x) === 'soon' ? '開始:' + when(x.starts_at) : left(ms);
      if (ms <= 0 && x.status !== 'ended') { x.status = 'ended'; refresh(); }      // 時間到 → 重新讀一次結果
    }, 1000);
    poll = setInterval(function () { if (!$('auc-box')) return stop(); var x = byId(cur && cur.id); if (x && phase(x) !== 'ended') refresh(); }, 20000);
  }
  function byId(id) { for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]; return null; }
  function refresh() {
    if (!cur) return Promise.resolve();
    var id = cur.id;
    return get('auctions_public?select=' + COLS + '&id=eq.' + id).then(function (r) {
      var a = r && r[0]; if (!a) return;
      offset = +new Date(a.server_now) - Date.now();
      for (var i = 0; i < rows.length; i++) if (rows[i].id === id) rows[i] = a;
      if (phase(a) === 'ended' && !a.notified) notifyOwner(a);
      if (cur && cur.id === id) { paint(); loadBids(id, true); }
    }, function () {});
  }
  function loadBids(id, force) {
    if (!force && bidsCache[id]) return paintBids(id);
    get('bids_public?select=id,amount,created_at,bidder_name,mine&auction_id=eq.' + id + '&order=amount.desc&limit=100').then(function (r) {
      bidsCache[id] = r || []; paintBids(id);
    }, function () {});
  }
  function paintBids(id) {
    var el = $('auc-bids'); if (!el || !cur || cur.id !== id) return;
    var list = bidsCache[id] || [];
    el.innerHTML = list.length ? '<div class="auc-sub">出價紀錄</div>' + list.map(function (b, i) {
      return '<div class="auc-bid' + (i === 0 ? ' top' : '') + '"><span class="n">' + esc(b.bidder_name) + (b.mine ? '<i class="auc-me">你</i>' : '') + '</span>' +
        '<span class="t">' + when(b.created_at) + '</span><span class="m">' + money(b.amount) + '</span></div>';
    }).join('') : '';
  }
  function paint() {
    var box = $('auc-box'), a = byId(cur && cur.id); if (!box || !a) return;
    var p = phase(a), me = uid(), mine = myState(a);
    if (mine === 'won') markWon(a.id);
    var tag = p === 'live' ? '<span class="auc-tag live">競標中</span>' : p === 'soon' ? '<span class="auc-tag">即將開始</span>' : '<span class="auc-tag end">已結標</span>';
    var price = a.current_price == null
      ? '<div class="k">起標價</div><div class="v">' + money(a.start_price) + '</div><div class="s">' + (p === 'ended' ? '沒有人出價(流標)' : '還沒有人出價') + '</div>'
      : '<div class="k">' + (p === 'ended' ? '得標金額' : '目前出價') + '</div><div class="v">' + money(a.current_price) + '</div>' +
        '<div class="s">' + a.bid_count + ' 次出價 · ' + (a.mine ? '<b class="auc-you">' + (p === 'ended' ? '你得標了' : '你目前最高') + '</b>' : (p === 'ended' ? '得標:' : '最高:') + esc(a.leader_name || '')) + '</div>';
    var body = '';
    if (p === 'ended') {
      body = a.mine ? '<p class="auc-note auc-win">🎉 恭喜得標!站主會用你登入的 Google Email 聯絡你,確認付款與取貨方式。</p>'
           : (mine === 'lost' ? '<p class="auc-note">這一場你沒有得標,謝謝參與。</p>' : '');
    } else if (p === 'soon') {
      body = '<p class="auc-note">起標價 ' + money(a.start_price) + ',每次至少加 ' + money(a.min_increment) + '。</p>';
    } else if (cur.admin) {
      body = '<p class="auc-note">你是管理者,不能對自己的競標出價。要修改或取消請到 <a href="admin.html">後台 →「競標」</a>。</p>';
    } else if (!me) {
      body = '<div class="auc-row"><button class="auc-btn" data-auc="login">登入後出價</button><span class="auc-mute">用 Google 帳號登入即可。下一口至少 ' + money(need(a)) + '</span></div>';
    } else {
      var n = need(a);
      body = (mine === 'outbid' ? '<p class="auc-note auc-warn">你的出價已經被超過了。</p>' : '') +
        '<div class="auc-row"><label class="auc-mute" for="auc-amt">出價金額</label>' +
        '<input id="auc-amt" type="number" inputmode="numeric" min="' + n + '" step="' + a.min_increment + '" value="' + n + '">' +
        '<button class="auc-btn" data-auc="bid"' + (a.mine ? ' disabled title="你目前已經是最高出價"' : '') + '>出價</button>' +
        (a.buy_now_price ? '<button class="auc-btn ghost" data-auc="buy">直購 ' + money(a.buy_now_price) + '</button>' : '') + '</div>' +
        '<p class="auc-mute">下一口至少 ' + money(n) + '(每次加 ' + money(a.min_increment) + ' 以上)。出價後不能取消;結標前 5 分鐘內有人出價會自動延長 5 分鐘。</p>';
    }
    box.innerHTML = '<div class="auc-h">' + tag + '<span class="auc-left" id="auc-left">' + (p === 'soon' ? '開始:' + when(a.starts_at) : p === 'ended' ? '結標:' + when(a.ends_at) : left(+new Date(a.ends_at) - now())) + '</span>' +
        (p !== 'ended' ? '<span class="auc-mute">結標 ' + when(a.ends_at) + '</span>' : '') + '</div>' +
      '<div class="auc-price">' + price + '</div>' +
      (a.note ? '<div class="auc-desc">' + esc(a.note) + '</div>' : '') + body +
      '<div class="auc-msg" id="auc-msg" role="alert"></div><div id="auc-bids"></div>';
    paintBids(a.id);
  }
  function say(t) { var m = $('auc-msg'); if (m) m.textContent = t || ''; }

  // 出價 / 直購:按第一次只變成「確定…?」,再按一次才送出(出價不能取消)
  function act(btn, kind) {
    var a = byId(cur && cur.id); if (!a) return;
    if (!uid()) return askLogin();
    var amt = kind === 'buy' ? a.buy_now_price : Math.floor(+(($('auc-amt') || {}).value));
    if (kind === 'bid') {
      if (!amt || isNaN(amt)) return say('請輸入出價金額。');
      if (amt < need(a)) return say('出價至少要 ' + money(need(a)) + '。');
    }
    if (btn.getAttribute('data-sure') !== String(amt)) {
      var old = btn.textContent;
      btn.setAttribute('data-sure', String(amt));
      btn.textContent = (kind === 'buy' || (a.buy_now_price && amt >= a.buy_now_price) ? '確定以 ' + money(Math.min(amt, a.buy_now_price || amt)) + ' 直購?' : '確定出價 ' + money(amt) + '?');
      say('');
      setTimeout(function () { if (btn.getAttribute('data-sure')) { btn.removeAttribute('data-sure'); btn.textContent = old; } }, 5000);
      return;
    }
    btn.removeAttribute('data-sure'); btn.disabled = true; say('送出中…');
    A.api('POST', 'rpc/place_bid', { a_id: a.id, amt: amt }).then(function (res) {
      myIds[a.id] = 1;
      say(res && res.bought ? '已直購成交。' : '出價成功。');
      return refresh();
    }, function (e) { btn.disabled = false; say((e && e.message) || '沒有成功,請再試一次。'); refresh(); });
  }
  function askLogin() { if (window.SWFEdit) window.SWFEdit.login(null, cur && cur.deep ? '?id=' + enc(cur.deep) : ''); }

  // ---------- 競標列表頁 ----------
  function card(a, ctx) {
    var f = a.individual_id ? ctx.find(a.individual_id) : null, p = phase(a), m = myState(a);
    var cover = f ? ctx.img((f.iv && f.iv.cover) || f.p.cover, 700) : null;
    var title = f ? f.p.name : a.plant_name, label = f && f.iv ? (f.iv.label || '') + (f.iv.name ? ' ' + f.iv.name : '') : a.indiv_label;
    var chip = m === 'lead' ? '<span class="auc-chip ok">你目前最高</span>' : m === 'outbid' ? '<span class="auc-chip warn">已被超過</span>'
             : m === 'won' ? '<span class="auc-chip ok">你得標了</span>' : m === 'lost' ? '<span class="auc-chip">未得標</span>' : '';
    return '<div class="auc-card' + (f ? '' : ' off') + '"' + (f ? ' data-act="open-auc" data-iv="' + esc(a.individual_id) + '" role="button" tabindex="0"' : '') + '>' +
      '<div class="auc-cv">' + (cover ? '<img src="' + esc(cover) + '" alt="' + esc(title) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '') +
        (p === 'live' ? '<span class="auc-tag live">競標中</span>' : p === 'soon' ? '<span class="auc-tag">即將開始</span>' : '<span class="auc-tag end">已結標</span>') + '</div>' +
      '<div class="auc-cb"><div class="auc-cn">' + esc(title) + '</div><div class="auc-cl">' + esc(label || '') + (a.individual_id ? ' · ' + esc(a.individual_id) : '') + '</div>' +
        '<div class="auc-cp">' + (a.current_price == null ? '起標 ' + money(a.start_price) : money(a.current_price)) + '</div>' +
        '<div class="auc-cs">' + (p === 'ended' ? (a.bid_count ? '得標:' + esc(a.leader_name || '') : '流標') + ' · ' + when(a.ends_at)
            : p === 'soon' ? '開始:' + when(a.starts_at) : a.bid_count + ' 次出價 · ' + left(+new Date(a.ends_at) - now())) + '</div>' + chip + '</div></div>';
  }
  function pageHTML(ctx) {
    function sec(title, list) { return list.length ? '<div class="auc-sec"><h2>' + title + '</h2><div class="auc-grid">' + list.map(function (a) { return card(a, ctx); }).join('') + '</div></div>' : ''; }
    var live = rows.filter(function (a) { return phase(a) === 'live'; }), soon = rows.filter(function (a) { return phase(a) === 'soon'; });
    var ended = rows.filter(function (a) { return phase(a) === 'ended'; }).sort(function (x, y) { return +new Date(y.ends_at) - +new Date(x.ends_at); });
    var mine = rows.filter(function (a) { return myState(a); });
    var out = mine.filter(function (a) { return myState(a) === 'outbid'; }).length, won = mine.filter(function (a) { return myState(a) === 'won'; }).length;
    var notice = (out || won) ? '<div class="auc-notice">' + (out ? '你有 ' + out + ' 場出價已被超過。' : '') + (won ? '你得標了 ' + won + ' 場,站主會用 Google Email 聯絡你。' : '') + '</div>' : '';
    mine.forEach(function (a) { if (myState(a) === 'won') markWon(a.id); });
    var html = notice + sec('我的出價', mine) + sec('進行中', live) + sec('即將開始', soon) + sec('最近結標', ended);
    return html || '<p class="auc-mute" style="margin-top:30px">' + (loaded ? '目前沒有競標。' : '載入中…') + '</p>';
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-auc]') : null;
      if (!t) return;
      var k = t.getAttribute('data-auc');
      if (k === 'login') askLogin();
      else if (k === 'bid' || k === 'buy') act(t, k);
    });
  }

  window.SWFAuction = { on: on, load: load, any: any, attention: attention, forIndiv: forIndiv, liveFor: liveFor,
    blockHTML: blockHTML, mount: mount, pageHTML: pageHTML, stop: stop, _phase: phase, _need: need, _left: left };
})();
