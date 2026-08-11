/* ===== SFOrb:載入球體 =====
   直接使用官方 npm 元件「thinking-orbs」(orbs.jakubantalik.com,MIT,作者 Jakub Antalik)——原版效果。
   我們是純 script 無打包站,故用 esm.sh CDN 動態載入 React + 元件,掛進容器。
   用法:var o = SFOrb.mount(container, { size:120, state:'solving' }); 結束時 o.stop();
   states:working / searching / solving / listening / connecting / weaving / composing / breathing / shaping
   載不到(離線/CDN 擋)時不顯示,不影響其他功能。 */
(function () {
  'use strict';
  var ready = false, failed = false, React = null, createRoot = null, Orb = null, queue = [];
  var RV = '18.3.1', TV = '0.2.0';

  Promise.all([
    import('https://esm.sh/react@' + RV),
    import('https://esm.sh/react-dom@' + RV + '/client'),
    import('https://esm.sh/thinking-orbs@' + TV + '?deps=react@' + RV + ',react-dom@' + RV)
  ]).then(function (mods) {
    React = mods[0].default || mods[0];
    createRoot = mods[1].createRoot;
    Orb = mods[2].ThinkingOrb || mods[2].default;
    ready = true;
    queue.forEach(render); queue = [];
  }).catch(function () { failed = true; });

  function render(entry) {
    try { var root = createRoot(entry.container); root.render(React.createElement(Orb, entry.props)); entry.root = root; } catch (e) {}
  }
  function mount(container, opts) {
    opts = opts || {};
    var entry = { container: container, props: { state: opts.state || 'solving', size: opts.size || 120 }, root: null };
    if (opts.speed) entry.props.speed = opts.speed;
    if (ready) render(entry); else if (!failed) queue.push(entry);
    return {
      el: entry.container,
      stop: function () {
        if (entry.root) { try { entry.root.unmount(); } catch (e) {} }
        else { var i = queue.indexOf(entry); if (i >= 0) queue.splice(i, 1); }
        if (entry.container) entry.container.innerHTML = '';
      }
    };
  }
  window.SFOrb = { mount: mount };
})();
