/* ===== 開場自動飛行(先預載模型,再飛)=====
   自成一體:注入樣式與 DOM,開場時暫時隱藏 #app。
   流程:進站 → 逐一預載 5 個模型(顯示「載入中 n/5」)→ 全部載好 → 自動飛過(頭尾慢中間快)→ 落地「進入大廳」。
   停用:刪 index.html 裡載入這支的 <script> 那行即可。
   調整:DUR_PER=每個分類毫秒;easeTrap 的 a=頭尾加減速佔比。 */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;
  try { if (sessionStorage.getItem('sf_intro_seen')) return; } catch (e) {}

  var SCENES = [
    { m: 'models/Caudex/Caudex.glb',           zh: '塊根',   la: 'Caudex',      el: 82, az: 8 },
    { m: 'models/Agave/Agave.glb',             zh: '龍舌蘭', la: 'Agave',       el: 76, az: -10 },
    { m: 'models/Cactaceae/Cactaceae.glb',     zh: '仙人掌', la: 'Cactaceae',   el: 90, az: 14 },
    { m: 'models/Pachypodium/Pachypodium.glb', zh: '棒槌',   la: 'Pachypodium', el: 72, az: -16 },
    { m: 'models/Platycerium/Platycerium.glb', zh: '鹿角蕨', la: 'Platycerium', el: 84, az: 0 }
  ];
  var N = SCENES.length;
  var DUR_PER = 460;          // 每個分類毫秒(現在是很快;預載後即使很快也每株都在)
  var LAND_MS = 1400;
  var LOAD_TIMEOUT = 12000;   // 單一模型逾時保護

  var CSS = ''
    + '#sf-intro{position:fixed;inset:0;z-index:60;overflow:hidden;opacity:1;transition:opacity .72s ease,transform .8s ease;background:#06090a;}'
    + '#sf-intro .p{position:absolute;inset:-8%;background:url("https://lh3.googleusercontent.com/d/1fgb-BT8G4-nd_HuItDWEFv0w51fgmjHE=w2000") center/cover no-repeat;filter:brightness(.5) saturate(.85) blur(3px);transform:scale(1.1);will-change:transform;}'
    + '#sf-intro .n{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,15,28,.4),rgba(4,9,18,.62) 70%,rgba(3,7,14,.74));}'
    + '#sf-intro canvas{position:absolute;inset:0;width:100%;height:100%;}'
    + '#sf-intro .sc{position:absolute;inset:0;opacity:0;will-change:opacity;}'
    + '#sf-intro .sc model-viewer{width:100%;height:100%;--poster-color:transparent;background:transparent;--progress-bar-color:transparent;}'
    + '#sf-intro .cap{position:absolute;left:8%;bottom:18%;opacity:0;will-change:opacity,transform;text-shadow:0 2px 18px rgba(0,0,0,.75);}'
    + '#sf-intro .cap .zh{font-family:"Newsreader",Georgia,serif;font-size:clamp(40px,7vw,72px);line-height:1;color:#f4f8f4;}'
    + '#sf-intro .cap .la{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:clamp(16px,2.2vw,24px);color:#9ad8ab;margin-top:8px;}'
    + '#sf-intro .land{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;opacity:0;pointer-events:none;}'
    + '#sf-intro .land.on{pointer-events:auto;}'
    + '#sf-intro .eb{font-family:"Space Mono",monospace;font-size:13px;letter-spacing:.3em;color:#bfe6cb;}'
    + '#sf-intro h1{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:clamp(44px,9vw,90px);margin:12px 0 18px;color:#f4f8f4;}'
    + '#sf-intro .chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:640px;margin:0 auto 30px;}'
    + '#sf-intro .chips span{font-family:"Space Mono",monospace;font-size:13px;color:#9ad8ab;border:1px solid rgba(154,216,171,.32);border-radius:999px;padding:7px 15px;background:rgba(0,0,0,.28);backdrop-filter:blur(8px);}'
    + '#sf-intro .enter{display:inline-block;position:relative;font-family:"Space Grotesk",sans-serif;font-size:15px;color:#0a0f0d;background:#9ad8ab;border-radius:999px;padding:13px 30px;text-decoration:none;cursor:pointer;box-shadow:0 10px 34px rgba(154,216,171,.35);transition:transform .14s ease,box-shadow .14s ease;}'
    + '#sf-intro .enter .rip{position:absolute;left:50%;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:999px;border:2px solid rgba(154,216,171,.75);transform:scale(0);opacity:0;pointer-events:none;}'
    + '#sf-intro .enter.clicking{animation:sfpress .4s ease;}'
    + '#sf-intro .enter.clicking .rip{animation:sfrip .6s ease-out;}'
    + '@keyframes sfpress{0%{transform:scale(1);}30%{transform:scale(.9);box-shadow:0 4px 14px rgba(154,216,171,.5);}100%{transform:scale(1.05);box-shadow:0 16px 46px rgba(154,216,171,.6);}}'
    + '@keyframes sfrip{0%{transform:scale(0);opacity:.85;}100%{transform:scale(7);opacity:0;}}'
    + '#sf-intro .bar{position:absolute;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#9ad8ab,#bfe6cb);transition:width .2s linear;}'
    + '#sf-intro .skip{position:absolute;top:18px;right:20px;font-family:"Space Mono",monospace;font-size:12px;color:#cfe9d6;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 15px;cursor:pointer;backdrop-filter:blur(8px);z-index:3;}'
    + '#sf-load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:2;transition:opacity .5s ease;}'
    + '#sf-load .t{font-family:"Space Mono",monospace;font-size:13px;letter-spacing:.2em;color:#bfe6cb;}'
    + '#sf-load .track{width:200px;height:3px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden;}'
    + '#sf-load .fill{height:100%;width:0;background:linear-gradient(90deg,#9ad8ab,#bfe6cb);transition:width .3s ease;}'
    + 'body.sf-on{overflow:hidden;}';
  var st = document.createElement('style'); st.id = 'sf-intro-style'; st.textContent = CSS; document.head.appendChild(st);

  var appDisp = app.style.display;
  app.style.display = 'none';
  document.body.classList.add('sf-on');

  var root = document.createElement('div'); root.id = 'sf-intro';
  root.innerHTML =
    '<div class="p" id="sf-p"></div><div class="n"></div><canvas id="sf-fx"></canvas>'
    + '<div id="sf-scenes"></div>'
    + '<div class="land" id="sf-land"><div class="land-in">'
    + '<div class="eb">HERBARIUM · 成長紀錄</div><h1>StagwithyouFerns</h1>'
    + '<div class="chips"><span>鹿角蕨</span><span>棒槌</span><span>仙人掌</span><span>龍舌蘭</span><span>塊根</span><span>大戟</span><span>觀葉</span><span>美照</span></div>'
    + '<a class="enter" id="sf-enter"><span class="rip"></span>進入大廳 →</a></div></div>'
    + '<div id="sf-load"><div class="t" id="sf-loadt">載入中 0 / ' + N + '</div><div class="track"><div class="fill" id="sf-loadf"></div></div></div>'
    + '<div class="bar" id="sf-bar"></div>'
    + '<div class="skip" id="sf-skip">跳過開場 →</div>';
  document.body.appendChild(root);

  var scenesWrap = document.getElementById('sf-scenes');
  var mv = [], scn = [], cap = [];
  SCENES.forEach(function (s) {
    var d = document.createElement('div'); d.className = 'sc';
    var v = document.createElement('model-viewer');
    v.setAttribute('interaction-prompt', 'none'); v.setAttribute('disable-zoom', '');
    v.setAttribute('exposure', '1.05'); v.setAttribute('shadow-intensity', '0.7');
    v.setAttribute('environment-image', 'neutral');
    v.setAttribute('camera-orbit', s.az + 'deg ' + s.el + 'deg 15m');
    v.setAttribute('min-camera-orbit', 'auto 0deg 1m'); v.setAttribute('max-camera-orbit', 'auto 180deg 18m');
    v.setAttribute('field-of-view', '30deg');
    v.setAttribute('interpolation-decay', '200');
    v.setAttribute('poster', s.m.replace('.glb', '-poster.webp'));
    d.appendChild(v); scenesWrap.appendChild(d);
    var c = document.createElement('div'); c.className = 'cap';
    c.innerHTML = '<div class="zh">' + s.zh + '</div><div class="la">' + s.la + '</div>';
    root.appendChild(c);
    mv.push(v); scn.push(d); cap.push(c);
  });

  var bgp = document.getElementById('sf-p'), land = document.getElementById('sf-land'),
      bar = document.getElementById('sf-bar'), loadBox = document.getElementById('sf-load'),
      loadT = document.getElementById('sf-loadt'), loadF = document.getElementById('sf-loadf');
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ── 並行預載模型(壓縮後檔案小,可同時載,較快)──
  var loaded = 0, flightStarted = false;
  mv.forEach(function (v, i) {
    var done = false;
    function next() {
      if (done) return; done = true;
      loaded++;
      loadT.textContent = '載入中 ' + loaded + ' / ' + N;
      loadF.style.width = (loaded / N * 100) + '%';
      if (loaded >= N) startFlight();
    }
    v.addEventListener('load', next, { once: true });
    v.addEventListener('error', next, { once: true });
    setTimeout(next, LOAD_TIMEOUT);
    v.setAttribute('src', SCENES[i].m);
  });
  setTimeout(function () { if (!flightStarted) startFlight(); }, LOAD_TIMEOUT + 2000); // 全域保護

  // ── 飛行 ──
  var running = false, t0 = null, landScheduled = false, flightEntered = false;
  var FP_START = -0.5, FP_END = N - 0.35;
  var SCENE_MS = (FP_END - FP_START) * DUR_PER;

  // 梯形速度曲線:頭尾慢(加速/減速)、中間維持較快勻速。
  function easeTrap(u) {
    var a = 0.28, tot = 1 - a, c;
    if (u < a) c = (u * u) / (2 * a);
    else if (u < 1 - a) c = a / 2 + (u - a);
    else { var w = u - (1 - a); c = a / 2 + (1 - 2 * a) + (w - (w * w) / (2 * a)); }
    return clamp(c / tot, 0, 1);
  }

  function startFlight() {
    if (flightStarted) return;
    flightStarted = true;
    loadBox.style.opacity = '0';
    setTimeout(function () { if (loadBox.parentNode) loadBox.style.display = 'none'; }, 500);
    running = true; t0 = null;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!running) return;
    if (t0 === null) t0 = now;
    var el = now - t0;
    var scenePhase = easeTrap(clamp(el / SCENE_MS, 0, 1));
    var fp = FP_START + scenePhase * (FP_END - FP_START);
    var lp = smooth((el - SCENE_MS) / LAND_MS);

    bar.style.width = (clamp(el / (SCENE_MS + LAND_MS), 0, 1) * 100) + '%';
    bgp.style.transform = 'translateY(' + (scenePhase * -46) + 'px) scale(1.1)';

    for (var i = 0; i < N; i++) {
      var x = fp - (i + 0.5);
      var vis = smooth(1 - Math.abs(x) / 0.85) * (1 - lp);
      scn[i].style.opacity = vis;
      cap[i].style.opacity = smooth(1 - Math.abs(x) / 0.5) * (1 - lp);
      cap[i].style.transform = 'translateY(' + (x * 44) + 'px)';
      if (vis > 0.008) {
        var t = clamp((x + 0.85) / 1.7, 0, 1);
        var radius = 15 - smooth(t) * 12.5;
        var elev = SCENES[i].el + (0.5 - t) * 15;
        var az = SCENES[i].az + x * 22;
        mv[i].cameraOrbit = az.toFixed(1) + 'deg ' + elev.toFixed(1) + 'deg ' + radius.toFixed(2) + 'm';
      }
    }
    land.style.opacity = lp;
    if (lp > 0.55) land.classList.add('on'); else land.classList.remove('on');
    land.querySelector('.land-in').style.transform = 'translateY(' + ((1 - lp) * 28) + 'px)';

    if (lp >= 1) {
      if (!landScheduled) { landScheduled = true; setTimeout(autoEnter, 3000); }
      return;
    }
    requestAnimationFrame(frame);
  }

  // 螢火蟲(載入階段就開始)
  var fxStop = false;
  (function () {
    var c = document.getElementById('sf-fx'), g = c.getContext('2d'), W, H, DPR, pts;
    function rs() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = c.width = innerWidth * DPR; H = c.height = innerHeight * DPR; }
    rs(); window.addEventListener('resize', rs);
    pts = []; for (var i = 0; i < 64; i++) pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0006, vy: (Math.random() - .5) * .0006, s: .5 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: .3 + Math.random() * .7 });
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

  function autoEnter() {
    if (flightEntered) return;
    var b = document.getElementById('sf-enter');
    if (b) b.classList.add('clicking');
    setTimeout(enter, 380);
  }

  function enter() {
    if (flightEntered) return; flightEntered = true;
    try { sessionStorage.setItem('sf_intro_seen', '1'); } catch (e) {}
    root.style.opacity = '0';
    root.style.transform = 'scale(1.08)';
    setTimeout(function () {
      running = false; fxStop = true;
      if (root.parentNode) root.parentNode.removeChild(root);
      document.body.classList.remove('sf-on');
      window.scrollTo(0, 0);
      app.style.display = appDisp || '';
      if (window.__fxMode) window.__fxMode('lobby');
    }, 720);
  }
  document.getElementById('sf-enter').addEventListener('click', function (e) { e.preventDefault(); autoEnter(); });
  document.getElementById('sf-skip').addEventListener('click', enter);
})();
