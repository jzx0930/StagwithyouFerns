/* ===== config.ini 載入器 =====
   同步讀取 config.ini(GitHub Pages 上為 http 可讀;直接雙擊本機 file:// 開啟則讀不到,會用預設)。
   解析後放到 window.SITE_CONFIG,並套用背景、標題、購買主開關/幣別。全部都有安全預設,讀不到也不會壞。 */
(function () {
  'use strict';
  var C = window.SITE_CONFIG = {
    site: { title: 'StagwithyouFerns', eyebrow: 'HERBARIUM · 成長紀錄', lobbySubtitle: '選一個分類,進入觀看。' },
    background: { imageId: '1fgb-BT8G4-nd_HuItDWEFv0w51fgmjHE', brightness: 0.82 },
    intro: { show: true, sceneDuration: 460, landDuration: 1400, lobbyEnterDelay: 1.5 },
    effects: { particles: true, cardTilt: true, magneticButtons: true, cardEntrance: true, particleBrightness: 1, panelOpacity: 1, metricOpacity: 1 },
    shop: { enabled: true, currency: 'NT$' },
    handwriting: { cjkSpeed: 3.5, cjkStrokeDelay: 10, latinDuration: 0.42 }
  };

  function coerce(s) {
    s = String(s).trim();
    if (/^(true|yes|on)$/i.test(s)) return true;         // bool
    if (/^(false|no|off)$/i.test(s)) return false;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);  // double/整數 → 數字(如 460.0、0.82、1.5)
    return s;                                            // 其餘當文字(title、image_id、currency…)
  }
  function parseIni(text) {
    var out = {}, sec = '';
    text.split(/\r?\n/).forEach(function (line) {
      line = line.replace(/\s+[;#].*$/, '').replace(/^[;#].*$/, '').trim();  // 去註解(行首或前有空白)
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
  function str(v, dflt) { return (v == null || v === '') ? dflt : String(v); }

  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'config.ini?t=' + Date.now(), false);
    xhr.send();
    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
      var ini = parseIni(xhr.responseText || '');
      var S = ini.site || {}, B = ini.background || {}, I = ini.intro || {}, E = ini.effects || {}, SH = ini.shop || {}, H = ini.handwriting || {};
      if ('title' in S) C.site.title = str(S.title, C.site.title);
      if ('eyebrow' in S) C.site.eyebrow = str(S.eyebrow, C.site.eyebrow);
      if ('lobby_subtitle' in S) C.site.lobbySubtitle = str(S.lobby_subtitle, C.site.lobbySubtitle);
      if ('image_id' in B) C.background.imageId = str(B.image_id, C.background.imageId);
      if ('brightness' in B) C.background.brightness = num(B.brightness, 82) / 100;   // 0~100(100=原亮度)
      if ('show' in I) C.intro.show = !!I.show;
      if ('scene_duration' in I) C.intro.sceneDuration = num(I.scene_duration, C.intro.sceneDuration);
      if ('land_duration' in I) C.intro.landDuration = num(I.land_duration, C.intro.landDuration);
      if ('lobby_enter_delay' in I) C.intro.lobbyEnterDelay = num(I.lobby_enter_delay, C.intro.lobbyEnterDelay);
      if ('particles' in E) C.effects.particles = !!E.particles;
      if ('card_tilt' in E) C.effects.cardTilt = !!E.card_tilt;
      if ('magnetic_buttons' in E) C.effects.magneticButtons = !!E.magnetic_buttons;
      if ('card_entrance' in E) C.effects.cardEntrance = !!E.card_entrance;
      if ('particle_brightness' in E) C.effects.particleBrightness = num(E.particle_brightness, 100) / 100;  // 0~100(100=原本)
      if ('panel_opacity' in E) C.effects.panelOpacity = num(E.panel_opacity, 100) / 100;                    // 0~100(100=原本)
      if ('metric_opacity' in E) C.effects.metricOpacity = num(E.metric_opacity, 100) / 100;                 // 0~100(100=原本)
      if ('enabled' in SH) C.shop.enabled = !!SH.enabled;
      if ('currency' in SH) C.shop.currency = str(SH.currency, C.shop.currency);
      if ('cjk_speed' in H) C.handwriting.cjkSpeed = num(H.cjk_speed, C.handwriting.cjkSpeed);
      if ('cjk_stroke_delay' in H) C.handwriting.cjkStrokeDelay = num(H.cjk_stroke_delay, C.handwriting.cjkStrokeDelay);
      if ('latin_duration' in H) C.handwriting.latinDuration = num(H.latin_duration, C.handwriting.latinDuration);
    }
  } catch (e) { /* 讀不到 config.ini:全部用預設 */ }

  // ── 立即套用:背景圖 / 亮度 / 分頁標題 ──
  try {
    var bp = document.querySelector('.bg-photo');
    if (bp) {
      bp.style.backgroundImage = "url('https://lh3.googleusercontent.com/d/" + C.background.imageId + "=w2000')";
      bp.style.filter = 'brightness(' + C.background.brightness + ') saturate(0.95) contrast(1.05)';
    }
    if (C.site.title) document.title = C.site.title;
    document.documentElement.style.setProperty('--panel-op', String(C.effects.panelOpacity));
    document.documentElement.style.setProperty('--metric-op', String(C.effects.metricOpacity));
  } catch (e) {}

  // ── 購買功能:把主開關與幣別同步到 SHOP_CONFIG(蓋過 shop-config.js)──
  window.SHOP_CONFIG = window.SHOP_CONFIG || {};
  window.SHOP_CONFIG.enabled = C.shop.enabled;
  window.SHOP_CONFIG.currency = C.shop.currency;
})();
