/* ===== 購物車 / 下單模組(自成一體;由 shop-config.js 控制開關)=====
   - 加入購物車 → 浮動購物車鈕 → 側邊抽屜 → 結帳表單 → Web3Forms 寄訂單給賣家。
   - 靜態站無金流:這是「下單/詢購」,金流由賣家私下與買家約定。
   - window.SHOP_CONFIG.enabled = false 時,完全不注入任何 UI。
   - app.js 透過 window.SHOP.enabled / SHOP.fmt(name) / SHOP.priceNum(name) / SHOP.add(item) 整合。 */
(function () {
  'use strict';
  var CFG = window.SHOP_CONFIG || {};
  var ENABLED = !!CFG.enabled;
  var CUR = CFG.currency || 'NT$';
  var STORAGE = 'sf_cart_v1';

  function priceNum(name) {
    var p = CFG.prices && CFG.prices[name];
    return (typeof p === 'number' && isFinite(p)) ? p : null;
  }
  function money(n) { return CUR + ' ' + Number(n).toLocaleString(); }
  function fmt(name) { var p = priceNum(name); return p == null ? '' : money(p); }

  // 對外 API(app.js 會用到;關閉時 add/open 為安全空操作)
  var SHOP = window.SHOP = {
    enabled: ENABLED,
    priceNum: priceNum,
    fmt: fmt,
    add: function () {},
    open: function () {}
  };
  if (!ENABLED) return;  // 關閉:不建立任何 UI

  // ---- 購物車狀態(localStorage 保存,換頁/重整都在)----
  var cart = load();
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(cart)); } catch (e) {} refresh(); }
  function count() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function total() { return cart.reduce(function (s, i) { return s + (i.price != null ? i.price * i.qty : 0); }, 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function add(item) {
    if (!item || !item.name) return;
    var ex = cart.filter(function (c) { return c.name === item.name; })[0];
    if (ex) ex.qty++;
    else cart.push({ name: item.name, latin: item.latin || '', price: (typeof item.price === 'number' ? item.price : priceNum(item.name)), qty: 1 });
    save(); toast('已加入購物車:' + item.name); pulseFab();
  }
  function setQty(name, q) { var c = cart.filter(function (x) { return x.name === name; })[0]; if (!c) return; c.qty = Math.max(1, q); save(); renderDrawer(); }
  function removeItem(name) { cart = cart.filter(function (x) { return x.name !== name; }); save(); renderDrawer(); }
  function clearCart() { cart = []; save(); renderDrawer(); }

  SHOP.add = add;
  SHOP.open = openDrawer;

  // ---- 樣式 ----
  var CSS = ''
    + '#sf-fab{position:fixed;right:22px;bottom:22px;z-index:150;width:56px;height:56px;border-radius:50%;'
    + 'display:flex;align-items:center;justify-content:center;cursor:pointer;background:linear-gradient(160deg,#9ad8ab,#6fc08c);'
    + 'color:#0a0f0d;font-size:24px;box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.15) inset;transition:transform .25s cubic-bezier(.2,.8,.2,1);}'
    + '#sf-fab:hover{transform:translateY(-3px) scale(1.05);}'
    + '#sf-fab.pulse{animation:sfFabPulse .5s ease;}'
    + '@keyframes sfFabPulse{0%{transform:scale(1);}40%{transform:scale(1.18);}100%{transform:scale(1);}}'
    + '#sf-fab .b{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#e5533d;color:#fff;'
    + 'font-family:"Space Mono",monospace;font-size:11px;display:none;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);}'
    + '#sf-cart-mask{position:fixed;inset:0;z-index:160;background:rgba(3,7,8,.6);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .3s;}'
    + '#sf-cart-mask.open{opacity:1;pointer-events:auto;}'
    + '#sf-cart{position:fixed;top:0;right:0;bottom:0;z-index:170;width:min(420px,92vw);transform:translateX(105%);transition:transform .38s cubic-bezier(.2,.8,.2,1);'
    + 'background:linear-gradient(165deg,rgba(16,26,22,.96),rgba(8,14,16,.98));backdrop-filter:blur(20px);border-left:1px solid rgba(154,216,171,.18);'
    + 'box-shadow:-20px 0 60px rgba(0,0,0,.5);display:flex;flex-direction:column;color:#eef2ef;font-family:"Space Grotesk",system-ui,sans-serif;}'
    + '#sf-cart.open{transform:translateX(0);}'
    + '#sf-cart .h{display:flex;align-items:center;justify-content:space-between;padding:22px 24px 14px;border-bottom:1px solid rgba(255,255,255,.08);}'
    + '#sf-cart .h .t{font-family:"Newsreader",Georgia,serif;font-size:24px;color:#f4f8f4;}'
    + '#sf-cart .x{cursor:pointer;font-family:"Space Mono",monospace;font-size:13px;color:#cfe9d6;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 13px;}'
    + '#sf-cart .body{flex:1;overflow-y:auto;padding:16px 24px;}'
    + '.sf-item{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);}'
    + '.sf-item .nm{flex:1;min-width:0;}'
    + '.sf-item .nm .n{font-family:"Newsreader",Georgia,serif;font-size:17px;color:#f2f6f2;}'
    + '.sf-item .nm .l{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:12px;color:rgba(154,216,171,.8);}'
    + '.sf-item .nm .p{font-family:"Space Mono",monospace;font-size:12px;color:#bfe6cb;margin-top:3px;}'
    + '.sf-qty{display:flex;align-items:center;gap:8px;}'
    + '.sf-qty button{width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#eef2ef;cursor:pointer;font-size:15px;line-height:1;}'
    + '.sf-qty .q{font-family:"Space Mono",monospace;font-size:14px;min-width:20px;text-align:center;}'
    + '.sf-rm{cursor:pointer;color:#8ba498;font-size:12px;font-family:"Space Mono",monospace;margin-left:6px;}'
    + '.sf-rm:hover{color:#e5836f;}'
    + '#sf-cart .empty{color:#9fb2a8;text-align:center;padding:50px 10px;font-size:14px;}'
    + '#sf-cart .foot{padding:16px 24px 22px;border-top:1px solid rgba(255,255,255,.08);}'
    + '.sf-total{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;}'
    + '.sf-total .k{font-family:"Space Mono",monospace;font-size:12px;color:#9fb2a8;letter-spacing:.1em;}'
    + '.sf-total .v{font-family:"Newsreader",Georgia,serif;font-size:26px;color:#f4f8f4;}'
    + '.sf-btn{display:block;width:100%;text-align:center;font-family:"Space Grotesk",sans-serif;font-size:15px;cursor:pointer;'
    + 'color:#0a0f0d;background:#9ad8ab;border:none;border-radius:999px;padding:13px;box-shadow:0 10px 30px rgba(154,216,171,.3);transition:transform .2s,box-shadow .2s;}'
    + '.sf-btn:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(154,216,171,.4);}'
    + '.sf-btn[disabled]{opacity:.5;cursor:not-allowed;box-shadow:none;transform:none;}'
    + '.sf-btn.ghost{background:transparent;color:#cfe9d6;border:1px solid rgba(255,255,255,.16);box-shadow:none;margin-top:8px;}'
    + '.sf-field{margin-bottom:12px;}'
    + '.sf-field label{display:block;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.08em;color:#9fb2a8;margin-bottom:5px;}'
    + '.sf-field label .req{color:#e5836f;}'
    + '.sf-field input,.sf-field textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:12px;'
    + 'padding:11px 13px;color:#eef2ef;font-family:"Space Grotesk",sans-serif;font-size:14px;outline:none;transition:border-color .2s;}'
    + '.sf-field input:focus,.sf-field textarea:focus{border-color:rgba(154,216,171,.55);}'
    + '.sf-field textarea{resize:vertical;min-height:64px;}'
    + '.sf-note{font-size:12px;color:#8ba498;line-height:1.5;margin:2px 0 14px;}'
    + '.sf-msg{font-size:13px;padding:10px 12px;border-radius:10px;margin-bottom:12px;line-height:1.5;}'
    + '.sf-msg.err{background:rgba(229,83,61,.14);border:1px solid rgba(229,83,61,.4);color:#f0a99b;}'
    + '.sf-msg.ok{background:rgba(154,216,171,.14);border:1px solid rgba(154,216,171,.4);color:#bfe6cb;}'
    + '#sf-toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%) translateY(12px);z-index:180;opacity:0;pointer-events:none;'
    + 'background:rgba(10,18,14,.95);border:1px solid rgba(154,216,171,.35);color:#dfeee4;font-size:13px;padding:10px 18px;border-radius:999px;'
    + 'backdrop-filter:blur(8px);transition:opacity .3s,transform .3s;font-family:"Space Grotesk",sans-serif;}'
    + '#sf-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
    // 卡片/詳情頁上的價格 + 加入購物車鈕(app.js 產生 .pc-shop)
    + '.pc-shop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);}'
    + '.pc-price{font-family:"Space Mono",monospace;font-size:14px;color:#bfe6cb;}'
    + '.cart-btn{cursor:pointer;font-family:"Space Grotesk",sans-serif;font-size:12px;color:#0a0f0d;background:#9ad8ab;border:none;border-radius:999px;padding:7px 14px;white-space:nowrap;transition:transform .2s,box-shadow .2s;}'
    + '.cart-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(154,216,171,.35);}'
    + '.cart-btn:active{transform:scale(.95);}'
    + '.pc-shop.big{margin-top:18px;padding-top:0;border-top:none;}'
    + '.pc-shop.big .pc-price{font-size:20px;color:#eef4ef;font-family:"Newsreader",Georgia,serif;}'
    + '.pc-shop.big .cart-btn{font-size:14px;padding:11px 22px;}'
    + '@media (prefers-reduced-motion: reduce){#sf-cart,#sf-fab,#sf-toast,.cart-btn{transition:none;}#sf-fab.pulse{animation:none;}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // ---- DOM:浮動鈕 + 遮罩 + 抽屜 + toast ----
  var fab = document.createElement('div');
  fab.id = 'sf-fab'; fab.title = '購物車';
  fab.innerHTML = '🛒<span class="b" id="sf-badge">0</span>';
  document.body.appendChild(fab);

  var mask = document.createElement('div'); mask.id = 'sf-cart-mask'; document.body.appendChild(mask);
  var drawer = document.createElement('div'); drawer.id = 'sf-cart'; document.body.appendChild(drawer);
  var toastEl = document.createElement('div'); toastEl.id = 'sf-toast'; document.body.appendChild(toastEl);

  var badge = document.getElementById('sf-badge');
  var _mode = 'cart';   // 'cart' | 'checkout'

  fab.addEventListener('click', openDrawer);
  mask.addEventListener('click', closeDrawer);

  function openDrawer() { _mode = 'cart'; renderDrawer(); drawer.classList.add('open'); mask.classList.add('open'); }
  function closeDrawer() { drawer.classList.remove('open'); mask.classList.remove('open'); }
  function pulseFab() { fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse'); }
  var _toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(_toastT); _toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1900); }

  function refresh() { var n = count(); badge.textContent = n; badge.style.display = n ? 'flex' : 'none'; }

  // ---- 渲染:購物車列表 ----
  function renderDrawer() {
    if (_mode === 'checkout') return renderCheckout();
    var rows = cart.map(function (it) {
      var pline = it.price != null ? money(it.price) : '價格洽詢';
      return '<div class="sf-item" data-name="' + esc(it.name) + '">'
        + '<div class="nm"><div class="n">' + esc(it.name) + '</div>'
        + (it.latin ? '<div class="l">' + esc(it.latin) + '</div>' : '')
        + '<div class="p">' + pline + '</div></div>'
        + '<div class="sf-qty"><button data-cart="dec">−</button><span class="q">' + it.qty + '</span><button data-cart="inc">＋</button></div>'
        + '<span class="sf-rm" data-cart="rm">移除</span></div>';
    }).join('');
    var body = cart.length ? rows : '<div class="empty">購物車是空的<br>到植物頁面按「加入購物車」吧 🌿</div>';
    var foot = cart.length
      ? '<div class="sf-total"><span class="k">總計</span><span class="v">' + money(total()) + '</span></div>'
        + '<button class="sf-btn" data-cart="checkout">前往結帳 →</button>'
        + '<button class="sf-btn ghost" data-cart="clear">清空購物車</button>'
      : '';
    drawer.innerHTML =
      '<div class="h"><span class="t">購物車</span><span class="x" data-cart="close">✕ 關閉</span></div>'
      + '<div class="body">' + body + '</div>'
      + (foot ? '<div class="foot">' + foot + '</div>' : '');
  }

  // ---- 渲染:結帳表單 ----
  function renderCheckout() {
    var itemsMini = cart.map(function (it) {
      return '<div style="display:flex;justify-content:space-between;font-size:13px;color:#cfe9d6;padding:3px 0;">'
        + '<span>' + esc(it.name) + ' ×' + it.qty + '</span>'
        + '<span>' + (it.price != null ? money(it.price * it.qty) : '洽詢') + '</span></div>';
    }).join('');
    drawer.innerHTML =
      '<div class="h"><span class="t">填寫訂單</span><span class="x" data-cart="back">← 返回</span></div>'
      + '<div class="body">'
      + '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);">' + itemsMini
      + '<div class="sf-total" style="margin-top:8px;"><span class="k">總計</span><span class="v" style="font-size:22px;">' + money(total()) + '</span></div></div>'
      + '<div class="sf-field"><label>姓名 / 稱呼 <span class="req">*</span></label><input id="sf-f-name" autocomplete="name"></div>'
      + '<div class="sf-field"><label>Email</label><input id="sf-f-email" type="email" autocomplete="email"></div>'
      + '<div class="sf-field"><label>電話</label><input id="sf-f-phone" type="tel" autocomplete="tel"></div>'
      + '<div class="sf-field"><label>LINE ID</label><input id="sf-f-line"></div>'
      + '<div class="sf-field"><label>備註 / 想詢問的事</label><textarea id="sf-f-note" placeholder="想要的個體 #、數量、面交地點…"></textarea></div>'
      + '<div class="sf-note">姓名必填,並至少留一種聯絡方式(Email / 電話 / LINE)讓賣家回覆你。</div>'
      + '<div id="sf-form-msg"></div>'
      + '</div>'
      + '<div class="foot"><button class="sf-btn" data-cart="submit" id="sf-submit">送出訂單</button></div>';
  }

  function showMsg(kind, text) {
    var m = document.getElementById('sf-form-msg');
    if (m) m.innerHTML = '<div class="sf-msg ' + kind + '">' + esc(text) + '</div>';
  }

  // ---- 送出訂單到 Web3Forms ----
  function submitOrder() {
    var name = val('sf-f-name'), email = val('sf-f-email'), phone = val('sf-f-phone'), line = val('sf-f-line'), note = val('sf-f-note');
    if (!name) { showMsg('err', '請填寫姓名 / 稱呼。'); return; }
    if (!email && !phone && !line) { showMsg('err', '請至少留一種聯絡方式(Email / 電話 / LINE)。'); return; }
    if (!CFG.web3formsKey || /貼上/.test(CFG.web3formsKey)) { showMsg('err', '賣家尚未設定送單服務(Web3Forms key),請直接與賣家聯繫。'); return; }
    if (!cart.length) { showMsg('err', '購物車是空的。'); return; }

    var lines = cart.map(function (it) {
      return '• ' + it.name + (it.latin ? ' (' + it.latin + ')' : '') + '  ×' + it.qty
        + (it.price != null ? '  = ' + money(it.price * it.qty) : '  (價格洽詢)');
    }).join('\n');
    var orderText = lines + '\n──────────\n總計:' + money(total());

    var btn = document.getElementById('sf-submit');
    if (btn) { btn.disabled = true; btn.textContent = '送出中…'; }
    showMsg('ok', '訂單送出中,請稍候…');

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        access_key: CFG.web3formsKey,
        subject: '🌿 植物訂單 — ' + name + '(' + count() + ' 件 / ' + money(total()) + ')',
        from_name: name,
        replyto: email || undefined,
        '買家姓名': name,
        'Email': email || '(未填)',
        '電話': phone || '(未填)',
        'LINE ID': line || '(未填)',
        '備註': note || '(無)',
        '訂單明細': orderText,
        '總金額': money(total())
      })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.success) {
        clearCart();
        drawer.innerHTML = '<div class="h"><span class="t">已送出 ✓</span><span class="x" data-cart="close">✕ 關閉</span></div>'
          + '<div class="body"><div class="sf-msg ok" style="margin-top:8px;">訂單已寄給賣家!賣家會盡快用你留的聯絡方式回覆你,再與你確認金額與取貨方式。謝謝 🌿</div></div>';
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '送出訂單'; }
        showMsg('err', '送出失敗:' + ((data && data.message) || '請稍後再試,或直接聯繫賣家。'));
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '送出訂單'; }
      showMsg('err', '送出失敗(網路問題),請稍後再試或直接聯繫賣家。');
    });
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  // ---- 抽屜內事件委派 ----
  drawer.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-cart]'); if (!a) return;
    var act = a.getAttribute('data-cart');
    var itemEl = ev.target.closest('.sf-item');
    var nm = itemEl ? itemEl.getAttribute('data-name') : null;
    if (act === 'close') closeDrawer();
    else if (act === 'inc') { var c = cart.filter(function (x) { return x.name === nm; })[0]; if (c) setQty(nm, c.qty + 1); }
    else if (act === 'dec') { var d = cart.filter(function (x) { return x.name === nm; })[0]; if (d) setQty(nm, d.qty - 1); }
    else if (act === 'rm') removeItem(nm);
    else if (act === 'clear') clearCart();
    else if (act === 'checkout') { if (cart.length) { _mode = 'checkout'; renderCheckout(); } }
    else if (act === 'back') { _mode = 'cart'; renderDrawer(); }
    else if (act === 'submit') submitOrder();
  });

  refresh();
})();
