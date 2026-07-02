/*!
 * <staghorn-fern> — an interactive animated 3D staghorn fern (鹿角蕨) web component.
 * Framework-agnostic. Drop into any HTML page:
 *
 *   <script src="staghorn-fern.js"></script>
 *   <staghorn-fern style="width:520px;height:520px"></staghorn-fern>
 *
 * Attributes (all optional):
 *   accent       CSS hex for glow light + spores        default "#9ccb6f"
 *   frond-color  antler frond color                     default "#7c9a56"
 *   basal-color  basal shield-frond color               default "#45502a"
 *   fronds       number of antler fronds (5–14)         default 9
 *   sway         wind sway multiplier (0 = still)       default 1
 *   parallax     "true"/"false" — follow the pointer    default true
 *   background   canvas clear color, or "transparent"   default transparent
 *   pixel-ratio  cap devicePixelRatio                   default 2
 *
 * Notes:
 *   • The element sizes itself to its box — give it a width & height via CSS.
 *   • Three.js (r128+) auto-loads from CDN if window.THREE is absent; or preload your own.
 *   • Respects prefers-reduced-motion (renders a still frame). Pauses when offscreen.
 */
(function () {
  'use strict';
  if (customElements.get('staghorn-fern')) return;

  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var _threePromise = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (_threePromise) return _threePromise;
    _threePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = THREE_SRC;
      s.onload = function () { resolve(window.THREE); };
      s.onerror = function () { reject(new Error('Failed to load Three.js')); };
      document.head.appendChild(s);
    });
    return _threePromise;
  }

  function hexToNum(h, fallback) {
    if (!h) return fallback;
    var m = String(h).trim().replace('#', '');
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    var n = parseInt(m, 16);
    return isNaN(n) ? fallback : n;
  }

  class StaghornFern extends HTMLElement {
    static get observedAttributes() {
      return ['accent', 'frond-color', 'basal-color', 'fronds', 'sway', 'parallax', 'background', 'pixel-ratio'];
    }

    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._root.innerHTML =
        '<style>:host{display:block;position:relative;width:100%;height:100%}' +
        'canvas{position:absolute;inset:0;width:100%;height:100%;display:block}</style>' +
        '<canvas></canvas>';
      this._canvas = this._root.querySelector('canvas');
      this._raf = null;
      this._ready = false;
      this._target = { x: 0, y: 0 };
      this._reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._onMove = this._onMove.bind(this);
    }

    connectedCallback() {
      var self = this;
      loadThree().then(function () {
        if (!self.isConnected) return;
        self._build();
        self._ready = true;
        self._observe();
        if (self.hasParallax()) window.addEventListener('pointermove', self._onMove);
        self._start();
      }).catch(function (e) { console.error('[staghorn-fern]', e); });
    }

    disconnectedCallback() {
      this._stop();
      window.removeEventListener('pointermove', this._onMove);
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._renderer) { try { this._renderer.dispose(); } catch (e) {} }
      this._ready = false;
    }

    attributeChangedCallback() {
      if (!this._ready) return;
      // rebuild for any visual attribute change
      this._stop();
      if (this._renderer) { try { this._renderer.dispose(); } catch (e) {} }
      this._build();
      var moving = this.hasParallax();
      window.removeEventListener('pointermove', this._onMove);
      if (moving) window.addEventListener('pointermove', this._onMove);
      this._start();
    }

    // ---- config helpers ----
    hasParallax() { return (this.getAttribute('parallax') || 'true') !== 'false'; }
    swayAmt() { var v = parseFloat(this.getAttribute('sway')); return isNaN(v) ? 1 : Math.max(0, v); }
    frondCount() { var v = parseInt(this.getAttribute('fronds'), 10); return isNaN(v) ? 9 : Math.max(5, Math.min(14, v)); }

    _onMove(e) {
      this._target.x = ((e.clientX / window.innerWidth) * 2 - 1) * 0.35;
      this._target.y = ((e.clientY / window.innerHeight) * 2 - 1) * 0.25;
    }

    _observe() {
      var self = this;
      if ('ResizeObserver' in window) {
        this._ro = new ResizeObserver(function () { self._resize(); });
        this._ro.observe(this);
      }
      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) { en.isIntersecting ? self._start() : self._stop(); });
        }, { threshold: 0.01 });
        this._io.observe(this);
      }
    }

    _resize() {
      if (!this._renderer) return;
      var w = this.clientWidth || 1, h = this.clientHeight || 1;
      this._renderer.setSize(w, h, false);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      if (this._reduced || !this._raf) this._renderOnce();
    }

    // ---- geometry helpers ----
    _strap(len, w0, w1) {
      var THREE = window.THREE;
      var g = new THREE.BufferGeometry();
      var v = new Float32Array([
        -w0 / 2, 0, 0, w0 / 2, 0, 0, w1 / 2, len, 0,
        -w0 / 2, 0, 0, w1 / 2, len, 0, -w1 / 2, len, 0
      ]);
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      g.computeVertexNormals();
      return g;
    }

    _grow(len, w, depth, mat) {
      var THREE = window.THREE;
      var seg = new THREE.Object3D();
      seg.add(new THREE.Mesh(this._strap(len, w, w * 0.66), mat));
      if (depth > 0) {
        var tip = new THREE.Object3D();
        tip.position.y = len;
        tip.rotation.x = -0.12 - Math.random() * 0.1;
        seg.add(tip);
        var spread = 0.36 + Math.random() * 0.22;
        var sides = [-1, 1];
        for (var i = 0; i < 2; i++) {
          var b = new THREE.Object3D();
          b.rotation.z = sides[i] * spread + (Math.random() - 0.5) * 0.12;
          tip.add(b);
          b.add(this._grow(len * (0.62 + Math.random() * 0.12), w * 0.64, depth - 1, mat));
        }
      }
      return seg;
    }

    _envTexture() {
      var THREE = window.THREE;
      var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      var g = c.getContext('2d');
      var grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, '#a7c6d8'); grd.addColorStop(0.5, '#3a5040'); grd.addColorStop(1, '#101c12');
      g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
      function blob(x, y, r, col) {
        var rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      blob(320, 130, 280, 'rgba(240,248,225,0.9)');
      blob(720, 200, 220, 'rgba(150,200,140,0.5)');
      blob(520, 400, 240, 'rgba(120,160,110,0.5)');
      var tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    }

    _build() {
      var THREE = window.THREE;
      var w = this.clientWidth || 480, h = this.clientHeight || 480;
      var pr = parseFloat(this.getAttribute('pixel-ratio')) || 2;

      var bg = this.getAttribute('background') || 'transparent';
      var transparent = (bg === 'transparent' || bg === 'none');

      var renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: transparent });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr));
      renderer.setSize(w, h, false);
      if (!transparent) renderer.setClearColor(hexToNum(bg, 0x0a1410), 1);
      this._renderer = renderer;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0.4, 8.6);
      this._scene = scene; this._camera = camera;

      var env = this._envTexture();
      var accent = hexToNum(this.getAttribute('accent'), 0x9ccb6f);
      var frondCol = hexToNum(this.getAttribute('frond-color'), 0x7c9a56);
      var basalCol = hexToNum(this.getAttribute('basal-color'), 0x45502a);

      scene.add(new THREE.AmbientLight(0x33463a, 0.9));
      var key = new THREE.DirectionalLight(0xf4f8ea, 1.15); key.position.set(-4, 7, 6); scene.add(key);
      var fill = new THREE.DirectionalLight(0x6f9e6a, 0.75); fill.position.set(6, 2, 4); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xbfe0b0, 1.0); rim.position.set(-2, 1, -6); scene.add(rim);
      var glow = new THREE.PointLight(accent, 0.7, 22); glow.position.set(2.6, 1, 3); scene.add(glow);
      this._glow = glow;

      var group = new THREE.Group();
      group.position.set(0, -1.5, 0);
      scene.add(group);
      this._group = group;

      // basal shield frond
      var shieldShape = new THREE.Shape();
      var N = 26, R = 1.15;
      for (var i = 0; i <= N; i++) {
        var a = (i / N) * Math.PI * 2;
        var lobe = 1 + 0.14 * Math.sin(a * 6) + 0.06 * Math.sin(a * 11);
        var rr = R * lobe;
        var x = Math.cos(a) * rr, y = Math.sin(a) * rr * 1.05 + 0.9;
        if (i === 0) shieldShape.moveTo(x, y); else shieldShape.lineTo(x, y);
      }
      var basalGeo = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 3, steps: 1 });
      var basal = new THREE.Mesh(basalGeo, new THREE.MeshStandardMaterial({ color: basalCol, metalness: 0.04, roughness: 1.0, envMap: env, envMapIntensity: 0.18, side: THREE.DoubleSide, flatShading: true }));
      basal.position.z = -0.35;
      group.add(basal);

      // foliar antler fronds
      var frondMat = new THREE.MeshStandardMaterial({ color: frondCol, metalness: 0.05, roughness: 0.86, envMap: env, envMapIntensity: 0.32, side: THREE.DoubleSide });
      this._fronds = [];
      var count = this.frondCount();
      for (var f = 0; f < count; f++) {
        var frac = count > 1 ? (f / (count - 1)) : 0.5;   // 0..1 across the fan
        var zAng = (frac - 0.5) * 2;                        // -1..1
        var lean = -0.35 * zAng + (Math.random() - 0.5) * 0.2;
        var len = 1.25 - Math.abs(zAng) * 0.42;
        var pivot = new THREE.Object3D();
        pivot.position.set(0, 0.55, 0.05);
        pivot.rotation.z = zAng * 0.55;
        pivot.rotation.x = lean;
        pivot.rotation.y = (Math.random() - 0.5) * 0.3;
        pivot.add(this._grow(len, 0.24 + Math.random() * 0.05, 3, frondMat));
        group.add(pivot);
        this._fronds.push({ pivot: pivot, baseZ: pivot.rotation.z, baseX: pivot.rotation.x, ph: f * 0.7, sp: 0.5 + Math.random() * 0.4, amp: 0.03 + Math.random() * 0.03 });
      }

      // floating spores
      var dN = 70, dp = new Float32Array(dN * 3);
      for (var d = 0; d < dN; d++) { dp[d * 3] = (Math.random() * 2 - 1) * 6; dp[d * 3 + 1] = (Math.random() * 2 - 1) * 5 + 1; dp[d * 3 + 2] = (Math.random() * 2 - 1) * 4; }
      var dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      var dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: accent, size: 0.03, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      scene.add(dust);
      this._dust = dust;

      this._clock = new THREE.Clock();
      this._renderOnce();
    }

    _frame(t) {
      var g = this._group, sw = this.swayAmt(), par = this.hasParallax();
      g.rotation.y = (par ? this._target.x : 0) + Math.sin(t * 0.25) * 0.12 * (0.4 + 0.6 * sw);
      g.rotation.x = -0.05 + Math.sin(t * 0.2) * 0.03 - (par ? this._target.y : 0);
      var gust = 0.6 + 0.4 * Math.sin(t * 0.5);
      for (var i = 0; i < this._fronds.length; i++) {
        var fr = this._fronds[i];
        fr.pivot.rotation.z = fr.baseZ + Math.sin(t * fr.sp + fr.ph) * fr.amp * gust * sw;
        fr.pivot.rotation.x = fr.baseX + Math.cos(t * fr.sp * 0.8 + fr.ph) * fr.amp * 0.6 * sw;
      }
      if (this._glow) this._glow.intensity = 0.85 + 0.35 * Math.sin(t * 1.1);
      if (this._dust) this._dust.rotation.y = t * 0.03;
    }

    _renderOnce() {
      if (!this._renderer) return;
      this._frame(this._clock ? this._clock.getElapsedTime() : 0);
      this._renderer.render(this._scene, this._camera);
    }

    _start() {
      if (this._raf || !this._renderer) return;
      if (this._reduced) { this._renderOnce(); return; }
      var self = this;
      var loop = function () {
        self._frame(self._clock.getElapsedTime());
        self._renderer.render(self._scene, self._camera);
        self._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    _stop() {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }
  }

  customElements.define('staghorn-fern', StaghornFern);
})();
