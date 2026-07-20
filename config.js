/* ===== config.ini 載入器 =====
   同步讀取 config.ini(GitHub Pages 上為 http,可讀;直接雙擊本機 file:// 開啟則讀不到,會用預設)。
   解析後放到 window.SITE_CONFIG,並把購買功能主開關同步到 SHOP_CONFIG.enabled。
   讀不到任何值都有安全預設,不會壞。 */
(function () {
  'use strict';
  var C = window.SITE_CONFIG = {
    shop: { enabled: true },
    intro: { lobbyEnterDelay: 1.5 },
    handwriting: { cjkSpeed: 3.5, cjkStrokeDelay: 10, latinDuration: 0.42 }
  };

  function coerce(s) {
    s = String(s).trim();
    if (/^(true|yes|on|1)$/i.test(s)) return true;
    if (/^(false|no|off|0)$/i.test(s)) return false;
    var n = parseFloat(s);
    return isNaN(n) ? s : n;
  }
  function parseIni(text) {
    var out = {}, sec = '';
    text.split(/\r?\n/).forEach(function (line) {
      line = line.replace(/[;#].*$/, '').trim();     // 去註解
      if (!line) return;
      var m = line.match(/^\[(.+)\]$/);
      if (m) { sec = m[1].trim().toLowerCase(); out[sec] = out[sec] || {}; return; }
      var eq = line.indexOf('=');
      if (eq > 0) {
        var k = line.slice(0, eq).trim().toLowerCase();
        (out[sec] = out[sec] || {})[k] = coerce(line.slice(eq + 1));
      }
    });
    return out;
  }
  function num(v, dflt) { var n = Number(v); return isNaN(n) ? dflt : n; }

  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'config.ini?t=' + Date.now(), false);   // 同步、破快取
    xhr.send();
    if (xhr.status >= 200 && xhr.status < 300 || xhr.status === 0) {
      var ini = parseIni(xhr.responseText || '');
      if (ini.shop && 'enabled' in ini.shop) C.shop.enabled = !!ini.shop.enabled;
      if (ini.intro && 'lobby_enter_delay' in ini.intro) C.intro.lobbyEnterDelay = num(ini.intro.lobby_enter_delay, C.intro.lobbyEnterDelay);
      if (ini.handwriting) {
        var h = ini.handwriting;
        if ('cjk_speed' in h) C.handwriting.cjkSpeed = num(h.cjk_speed, C.handwriting.cjkSpeed);
        if ('cjk_stroke_delay' in h) C.handwriting.cjkStrokeDelay = num(h.cjk_stroke_delay, C.handwriting.cjkStrokeDelay);
        if ('latin_duration' in h) C.handwriting.latinDuration = num(h.latin_duration, C.handwriting.latinDuration);
      }
    }
  } catch (e) { /* 讀不到 config.ini:全部用預設 */ }

  // config.ini 的 shop.enabled 為購買功能主開關(蓋過 shop-config.js)
  window.SHOP_CONFIG = window.SHOP_CONFIG || {};
  window.SHOP_CONFIG.enabled = C.shop.enabled;
})();
