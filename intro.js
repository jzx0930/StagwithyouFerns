/* ===== 開場滾動飛行 =====
   自成一體:注入自己的樣式與 DOM,開場時暫時隱藏 #app,
   使用者按「進入大廳」或跳過後,清掉開場、還原成正常網站。
   停用方式:把 index.html 裡這支的 <script> 那一行刪掉即可,其餘檔案不受影響。 */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;
  // 同一個分頁看過就不再重播(要重看:開新分頁或無痕)
  try { if (sessionStorage.getItem('sf_intro_seen')) return; } catch (e) {}

  var SCENES = [
    { m: 'models/Platycerium/Platycerium.glb', zh: '鹿角蕨', la: 'Platycerium', el: 84, az: 0 },
    { m: 'models/Pachypodium/Pachypodium.glb', zh: '棒槌',   la: 'Pachypodium', el: 72, az: -16 },
    { m: 'models/Cactaceae/Cactaceae.glb',     zh: '仙人掌', la: 'Cactaceae',   el: 90, az: 14 },
    { m: 'models/Agave/Agave.glb',             zh: '龍舌蘭', la: 'Agave',       el: 76, az: -10 },
    { m: 'models/Caudex/Caudex.glb',           zh: '塊根',   la: 'Caudex',      el: 82, az: 8 }
  ];
  var N = SCENES.length, SCENE_END = 0.84;

  var CSS = ''
    + '#sf-intro{position:fixed;inset:0;z-index:60;overflow:hidden;opacity:1;transition:opacity .6s ease;}'
    + '#sf-intro .p{position:absolute;inset:-8%;background:url("https://lh3.googleusercontent.com/d/1fgb-BT8G4-nd_HuItDWEFv0w51fgmjHE=w2000") center/cover no-repeat;filter:brightness(.5) saturate(.85) blur(3px);transform:scale(1.1);will-change:transform;}'
    + '#sf-intro .n{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,15,28,.4),rgba(4,9,18,.62) 70%,rgba(3,7,14,.74));}'
    + '#sf-intro canvas{position:absolute;inset:0;width:100%;height:100%;}'
    + '#sf-intro .sc{position:absolute;inset:0;opacity:0;will-change:opacity;}'
    + '#sf-intro .sc model-viewer{width:100%;height:100%;--poster-color:transparent;background:transparent;}'
    + '#sf-intro .cap{position:absolute;left:8%;bottom:18%;opacity:0;will-change:opacity,transform;text-shadow:0 2px 18px rgba(0,0,0,.75);}'
    + '#sf-intro .cap .zh{font-family:"Newsreader",Georgia,serif;font-size:clamp(40px,7vw,72px);line-height:1;color:#f4f8f4;}'
    + '#sf-intro .cap .la{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:clamp(16px,2.2vw,24px);color:#9ad8ab;margin-top:8px;}'
    + '#sf-intro .land{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;opacity:0;pointer-events:none;}'
    + '#sf-intro .land.on{pointer-events:auto;}'
    + '#sf-intro .eb{font-family:"Space Mono",monospace;font-size:13px;letter-spacing:.3em;color:#bfe6cb;}'
    + '#sf-intro h1{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:clamp(44px,9vw,90px);margin:12px 0 18px;color:#f4f8f4;}'
    + '#sf-intro .chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:640px;margin:0 auto 30px;}'
    + '#sf-intro .chips span{font-family:"Space Mono",monospace;font-size:13px;color:#9ad8ab;border:1px solid rgba(154,216,171,.32);border-radius:999px;padding:7px 15px;background:rgba(0,0,0,.28);backdrop-filter:blur(8px);}'
    + '#sf-intro .enter{display:inline-block;font-family:"Space Grotesk",sans-serif;font-size:15px;color:#0a0f0d;background:#9ad8ab;border-radius:999px;padding:13px 30px;text-decoration:none;cursor:pointer;box-shadow:0 10px 34px rgba(154,216,171,.35);}'
    + '#sf-intro .bar{position:absolute;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#9ad8ab,#bfe6cb);}'
    + '#sf-intro .hint{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.14em;color:#bfe6cb;opacity:.75;animation:sfbob 2.2s ease-in-out infinite;}'
    + '#sf-intro .skip{position:absolute;top:18px;right:20px;font-family:"Space Mono",monospace;font-size:12px;color:#9fb2a8;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 15px;cursor:pointer;backdrop-filter:blur(8px);}'
    + '@keyframes sfbob{0%,100%{transform:translate(-50%,0);}50%{transform:translate(-50%,6px);}}'
    + '#sf-spacer{height:640vh;}'
    + 'body.sf-on{overflow-x:hidden;}';
  var st = document.createElement('style'); st.id = 'sf-intro-style'; st.textContent = CSS; document.head.appendChild(st);

  // 開場期間先藏住正式站
  var appDisp = app.style.display;
  app.style.display = 'none';
  document.body.classList.add('sf-on');

  var spacer = document.createElement('div'); spacer.id = 'sf-spacer'; document.body.appendChild(spacer);

  var root = document.createElement('div'); root.id = 'sf-intro';
  root.innerHTML =
    '<div class="p" id="sf-p"></div><div class="n"></div><canvas id="sf-fx"></canvas>'
    + '<div id="sf-scenes"></div>'
    + '<div class="land" id="sf-land"><div class="land-in">'
    + '<div class="eb">HERBARIUM · 成長紀錄</div><h1>StagwithyouFerns</h1>'
    + '<div class="chips"><span>鹿角蕨</span><span>棒槌</span><span>仙人掌</span><span>龍舌蘭</span><span>塊根</span><span>大戟</span><span>觀葉</span><span>美照</span></div>'
    + '<a class="enter" id="sf-enter">進入大廳 →</a></div></div>'
    + '<div class="bar" id="sf-bar"></div>'
    + '<div class="hint" id="sf-hint">↓ 往下滾動,飛過你的植物世界 ↓</div>'
    + '<div class="skip" id="sf-skip">跳過開場</div>';
  document.body.appendChild(root);

  var scenesWrap = document.getElementById('sf-scenes');
  var mv = [], scn = [], cap = [];
  SCENES.forEach(function (s) {
    var d = document.createElement('div'); d.className = 'sc';
    var v = document.createElement('model-viewer');
    v.setAttribute('interaction-prompt', 'none'); v.setAttribute('disable-zoom', '');
    v.setAttribute('exposure', '1.05'); v.setAttribute('shadow-intensity', '0.7');
    v.setAttribute('environment-image', 'neutral');
    v.setAttribute('camera-orbit', s.az + 'deg ' + s.el + 'deg 14m');
    v.setAttribute('min-camera-orbit', 'auto 0deg 1m'); v.setAttribute('max-camera-orbit', 'auto 180deg 18m');
    v.setAttribute('field-of-view', '30deg');
    d.appendChild(v); scenesWrap.appendChild(d);
    var c = document.createElement('div'); c.className = 'cap';
    c.innerHTML = '<div class="zh">' + s.zh + '</div><div class="la">' + s.la + '</div>';
    root.appendChild(c);
    mv.push(v); scn.push(d); cap.push(c);
  });

  var bgp = document.getElementById('sf-p'), land = document.getElementById('sf-land'),
      hint = document.getElementById('sf-hint'), bar = document.getElementById('sf-bar');
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  var running = true;
  function frame() {
    if (!running) return;
    var total = document.documentElement.scrollHeight - window.innerHeight;
    var p = total > 0 ? clamp(window.scrollY / total, 0, 1) : 0;
    bar.style.width = (p * 100) + '%';
    var sp = clamp(p / SCENE_END, 0, 1);
    var lp = smooth((p - SCENE_END) / (1 - SCENE_END));
    var fp = sp * N;
    bgp.style.transform = 'translateY(' + (p * -40) + 'px) scale(1.1)';
    for (var i = 0; i < N; i++) {
      var x = fp - (i + 0.5);
      if (Math.abs(x) < 1.35 && !mv[i].getAttribute('src')) mv[i].setAttribute('src', SCENES[i].m);
      var vis = smooth(1 - Math.abs(x) / 0.82) * (1 - lp);
      scn[i].style.opacity = vis;
      cap[i].style.opacity = smooth(1 - Math.abs(x) / 0.5) * (1 - lp);
      cap[i].style.transform = 'translateY(' + (x * 46) + 'px)';
      if (vis > 0.01) {
        var t = clamp((x + 0.82) / 1.64, 0, 1);
        var radius = 15 - t * 13;
        var el = SCENES[i].el + (0.5 - t) * 16;
        var az = SCENES[i].az + x * 24;
        mv[i].cameraOrbit = az.toFixed(1) + 'deg ' + el.toFixed(1) + 'deg ' + radius.toFixed(2) + 'm';
      }
    }
    land.style.opacity = lp;
    if (lp > 0.6) land.classList.add('on'); else land.classList.remove('on');
    land.querySelector('.land-in').style.transform = 'translateY(' + ((1 - lp) * 28) + 'px)';
    hint.style.opacity = p < 0.05 ? 0.75 : 0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 螢火蟲
  var fxStop = false;
  (function () {
    var c = document.getElementById('sf-fx'), g = c.getContext('2d'), W, H, DPR, pts;
    function rs() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = c.width = innerWidth * DPR; H = c.height = innerHeight * DPR; }
    rs(); window.addEventListener('resize', rs);
    pts = []; for (var i = 0; i < 70; i++) pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0007, vy: (Math.random() - .5) * .0007, s: .5 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: .3 + Math.random() * .7 });
    var t = 0;
    (function loop() {
      if (fxStop) return;
      t += .006; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (var k = 0; k < pts.length; k++) { var p = pts[k];
        p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        var tw = .45 + .55 * Math.sin(t * 6 * p.sp + p.ph), a = Math.max(0, tw) * .9;
        var px = p.x * W, py = p.y * H, r = p.s * 1.6 * DPR;
        var rg = g.createRadialGradient(px, py, 0, px, py, r * 5);
        rg.addColorStop(0, 'rgba(226,255,170,' + (a * .9) + ')'); rg.addColorStop(.3, 'rgba(172,240,112,' + (a * .5) + ')'); rg.addColorStop(1, 'rgba(110,200,70,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(px, py, r * 5, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(234,255,196,' + a + ')'; g.beginPath(); g.arc(px, py, r, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'source-over'; requestAnimationFrame(loop);
    })();
  })();

  // 進站 / 清理
  function enter() {
    try { sessionStorage.setItem('sf_intro_seen', '1'); } catch (e) {}
    root.style.opacity = '0';
    setTimeout(function () {
      running = false; fxStop = true;
      if (root.parentNode) root.parentNode.removeChild(root);
      if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
      document.body.classList.remove('sf-on');
      window.scrollTo(0, 0);
      app.style.display = appDisp || '';
      if (window.__fxMode) window.__fxMode('lobby');
    }, 620);
  }
  document.getElementById('sf-enter').addEventListener('click', function (e) { e.preventDefault(); enter(); });
  document.getElementById('sf-skip').addEventListener('click', enter);
})();
