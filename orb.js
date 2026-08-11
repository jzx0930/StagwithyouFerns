/* ===== SFOrb:載入球體(官方 thinking-orbs 元件,orbs.jakubantalik.com,MIT)=====
   來源:index.html 會先同步載入 vendor/thinking-orbs.js(自帶 React)→ window.__ORB__。
     有 → 直接同步用(球能立刻顯示,不錯過短命的載入畫面)。
     沒有(還沒 vendor / 檔案缺)→ 退回 esm.sh CDN 動態載入(非同步,需連網)。
   用法:var o = SFOrb.mount(container, { size:120, state:'solving' }); 結束時 o.stop();
   states:working / searching / solving / listening / connecting / weaving / composing / breathing / shaping */
(function () {
  'use strict';
  var ready = false, failed = false, Rt = null, cr = null, Orb = null, queue = [];

  function ok(R, CR, O) { Rt = R; cr = CR; Orb = O; ready = true; queue.forEach(render); queue = []; }
  function render(e) { try { var root = cr(e.container); root.render(Rt.createElement(Orb, e.props)); e.root = root; } catch (x) {} }

  var v = window.__ORB__;
  if (v && v.ThinkingOrb && v.createRoot) {
    ok(v.React || (v.ThinkingOrb && v.React), v.createRoot, v.ThinkingOrb);   // 本機 vendor:同步就緒
  } else {
    var RV = '18.3.1', TV = '0.2.0';                                         // 後備:esm.sh
    Promise.all([
      import('https://esm.sh/react@' + RV),
      import('https://esm.sh/react-dom@' + RV + '/client'),
      import('https://esm.sh/thinking-orbs@' + TV + '?deps=react@' + RV + ',react-dom@' + RV)
    ]).then(function (m) {
      ok(m[0].default || m[0], m[1].createRoot, m[2].ThinkingOrb || m[2].default);
    }).catch(function () { failed = true; });
  }

  function mount(container, opts) {
    opts = opts || {};
    var e = { container: container, props: { state: opts.state || 'solving', size: opts.size || 120 }, root: null };
    if (opts.speed) e.props.speed = opts.speed;
    if (ready) render(e); else if (!failed) queue.push(e);
    return {
      el: container,
      stop: function () {
        if (e.root) { try { e.root.unmount(); } catch (x) {} }
        else { var i = queue.indexOf(e); if (i >= 0) queue.splice(i, 1); }
        if (container) container.innerHTML = '';
      }
    };
  }
  window.SFOrb = { mount: mount };
})();
