/* ===== SFOrb:載入球體(官方 thinking-orbs 元件,orbs.jakubantalik.com,MIT)=====
   來源優先序:
     1) 本機 vendor:vendor/thinking-orbs.js(自帶 React,離線可用)— 由 tools/orb-vendor/build.bat 產生。
     2) 抓不到才退回 esm.sh CDN 動態載入(需連網)。
   兩者都失敗就不顯示,不影響其他功能。
   用法:var o = SFOrb.mount(container, { size:120, state:'solving' }); 結束時 o.stop();
   states:working / searching / solving / listening / connecting / weaving / composing / breathing / shaping */
(function () {
  'use strict';
  var ready = false, failed = false, Rt = null, cr = null, Orb = null, queue = [];

  function ok(R, CR, O) { Rt = R; cr = CR; Orb = O; ready = true; queue.forEach(render); queue = []; }
  function render(e) { try { var root = cr(e.container); root.render(Rt.createElement(Orb, e.props)); e.root = root; } catch (x) {} }

  // 1) 本機 vendor 優先
  var s = document.createElement('script');
  s.src = 'vendor/thinking-orbs.js?v=1';
  s.onload = function () {
    var v = window.__ORB__;
    if (v && v.ThinkingOrb && v.createRoot) ok(v.React, v.createRoot, v.ThinkingOrb);
    else esmFallback();
  };
  s.onerror = esmFallback;
  document.head.appendChild(s);

  // 2) 退回 esm.sh
  function esmFallback() {
    var RV = '18.3.1', TV = '0.2.0';
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
