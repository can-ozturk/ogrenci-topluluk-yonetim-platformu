/* ==========================================================================
   Atatürk Topluluğu — Fare Takipli Partikül Ağı (js/particles.js)
   Saf Canvas + requestAnimationFrame. Harici kütüphane yok.
   - Sıcak taş/krem partiküller (~%13'ü bayrak kırmızısı / bordo, hafif parıltılı)
   - Yakın partiküller arasında ince ağ çizgileri
   - Fare (veya parmak) çevresinde gecikmeli yörünge kümesi, ışık hâlesi
   - Tıklama / dokunma: dışa doğru dalga
   - Sekme gizlenince durur, prefers-reduced-motion'da hareket ciddi azalır
   Canvas pointer-events: none olduğundan form kullanımını engellemez.
   ========================================================================== */

(function (window, document) {
  "use strict";

  var canvas = document.getElementById("particleCanvas");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var CONFIG = {
    linkDistance: 120,
    pointerRadius: 160,
    redShare: 0.13,
    desktop: { min: 90, max: 140, density: 11000 },
    mobile: { min: 40, max: 60, density: 9000 },
    maxDpr: 2,
    rippleLife: 0.9,
    rippleSpeed: 520,
    rippleBand: 70
  };

  /* Tema paletleri: [r, g, b] */
  var PALETTES = {
    dark: { cream: [230, 220, 200], red: [214, 38, 82] },
    light: { cream: [244, 236, 222], red: [214, 32, 78] }
  };

  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  var state = {
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    ripples: [],
    rafId: 0,
    lastTime: 0,
    theme: "",
    palette: PALETTES.dark,
    sprites: null,
    motion: 1,
    pointer: { x: -9999, y: -9999, active: false, strength: 0 }
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function rgba(rgb, alpha) {
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  }

  /* ------------------------------------------------------------------------
     Parıltı sprite'ları (shadowBlur yerine ön-çizimli, performanslı)
     ------------------------------------------------------------------------ */
  function createSprite(rgb) {
    var size = 64;
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgba(rgb, 0.9));
    grad.addColorStop(0.25, rgba(rgb, 0.35));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function applyTheme() {
    var theme =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    if (theme === state.theme) return;
    state.theme = theme;
    state.palette = PALETTES[theme];
    state.sprites = {
      cream: createSprite(state.palette.cream),
      red: createSprite(state.palette.red)
    };
  }

  /* ------------------------------------------------------------------------
     Partikül
     ------------------------------------------------------------------------ */
  function createParticle(w, h) {
    var isRed = Math.random() < CONFIG.redShare;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      angle: Math.random() * Math.PI * 2,
      speed: rand(0.08, 0.26),
      vx: 0,
      vy: 0,
      r: rand(1, 3),
      alpha: isRed ? rand(0.4, 0.7) : rand(0.2, 0.6),
      red: isRed,
      glow: isRed || Math.random() < 0.22,
      pull: 0,
      orbit: rand(34, 118),
      swirl: Math.random() < 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2
    };
  }

  function targetCount() {
    var cfg = state.width < 700 ? CONFIG.mobile : CONFIG.desktop;
    var n = Math.round((state.width * state.height) / cfg.density);
    n = Math.max(cfg.min, Math.min(cfg.max, n));
    return state.motion < 1 ? Math.round(n * 0.6) : n;
  }

  function syncParticleCount() {
    var target = targetCount();
    while (state.particles.length < target) {
      state.particles.push(createParticle(state.width, state.height));
    }
    if (state.particles.length > target) {
      state.particles.length = target;
    }
  }

  /* ------------------------------------------------------------------------
     Boyutlandırma
     ------------------------------------------------------------------------ */
  function resize() {
    var oldW = state.width;
    var oldH = state.height;

    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    if (oldW && oldH) {
      var sx = state.width / oldW;
      var sy = state.height / oldH;
      for (var i = 0; i < state.particles.length; i++) {
        state.particles[i].x *= sx;
        state.particles[i].y *= sy;
      }
    }
    syncParticleCount();
  }

  /* ------------------------------------------------------------------------
     Güncelleme
     ------------------------------------------------------------------------ */
  function update(dt, now) {
    var w = state.width;
    var h = state.height;
    var p = state.pointer;
    var motion = state.motion;
    var R = CONFIG.pointerRadius;
    var damping = Math.pow(0.93, dt);
    var i, j, part;

    p.strength += ((p.active ? 1 : 0) - p.strength) * Math.min(1, 0.08 * dt);

    /* Dalgaları ilerlet */
    for (i = state.ripples.length - 1; i >= 0; i--) {
      state.ripples[i].t += (dt * 16.667) / 1000;
      if (state.ripples[i].t >= CONFIG.rippleLife) {
        state.ripples.splice(i, 1);
      }
    }

    for (i = 0; i < state.particles.length; i++) {
      part = state.particles[i];

      /* Yavaş, organik süzülme */
      part.angle += (Math.random() - 0.5) * 0.03 * dt;
      var driftX = Math.cos(part.angle) * part.speed * motion;
      var driftY = Math.sin(part.angle) * part.speed * motion;

      /* Fare etkileşimi: gecikmeli (easing) çekim + yörünge + hafif girdap */
      var dx = part.x - p.x;
      var dy = part.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var inRange = p.active && d < R;
      part.pull += ((inRange ? 1 : 0) - part.pull) * Math.min(1, (inRange ? 0.05 : 0.018) * dt);

      if (part.pull > 0.002 && d > 0.001) {
        var nx = dx / d;
        var ny = dy / d;
        var gain = part.pull * (motion < 1 ? 0.35 : 1);
        var radial = (part.orbit - d) * 0.0012 * gain;
        var swirl = part.swirl * 0.03 * gain;
        part.vx += (nx * radial - ny * swirl) * dt;
        part.vy += (ny * radial + nx * swirl) * dt;
      }

      /* Tıklama dalgaları */
      for (j = 0; j < state.ripples.length; j++) {
        var rp = state.ripples[j];
        var rx = part.x - rp.x;
        var ry = part.y - rp.y;
        var rd = Math.sqrt(rx * rx + ry * ry);
        var delta = Math.abs(rd - rp.t * CONFIG.rippleSpeed);
        if (delta < CONFIG.rippleBand && rd > 0.001) {
          var push =
            (1 - rp.t / CONFIG.rippleLife) * (1 - delta / CONFIG.rippleBand) * 2.6;
          part.vx += (rx / rd) * push * dt;
          part.vy += (ry / rd) * push * dt;
        }
      }

      part.vx *= damping;
      part.vy *= damping;
      part.x += (driftX + part.vx) * dt;
      part.y += (driftY + part.vy) * dt;

      /* Kenarlardan taşınca karşı taraftan devam et */
      if (part.x < -20) part.x = w + 20;
      else if (part.x > w + 20) part.x = -20;
      if (part.y < -20) part.y = h + 20;
      else if (part.y > h + 20) part.y = -20;
    }
  }

  /* ------------------------------------------------------------------------
     Çizim
     ------------------------------------------------------------------------ */
  function draw(now) {
    var w = state.width;
    var h = state.height;
    var p = state.pointer;
    var pal = state.palette;
    var R = CONFIG.pointerRadius;
    var L = CONFIG.linkDistance;
    var parts = state.particles;
    var i, j, a, b, dx, dy, d, alpha;

    ctx.clearRect(0, 0, w, h);

    /* İmleç çevresinde yumuşak ışık hâlesi */
    if (p.strength > 0.01) {
      var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 150);
      halo.addColorStop(0, rgba(pal.cream, 0.11 * p.strength));
      halo.addColorStop(1, rgba(pal.cream, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(p.x - 150, p.y - 150, 300, 300);
    }

    /* Tıklama dalgası halkaları (çok silik) */
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.cream, 1);
    for (i = 0; i < state.ripples.length; i++) {
      var rp = state.ripples[i];
      ctx.globalAlpha = 0.08 * (1 - rp.t / CONFIG.rippleLife);
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.t * CONFIG.rippleSpeed, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* Partiküller arası ağ çizgileri */
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = rgba(pal.cream, 1);
    for (i = 0; i < parts.length; i++) {
      a = parts[i];
      for (j = i + 1; j < parts.length; j++) {
        b = parts[j];
        dx = a.x - b.x;
        if (dx > L || dx < -L) continue;
        dy = a.y - b.y;
        if (dy > L || dy < -L) continue;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < L) {
          ctx.globalAlpha = (1 - d / L) * 0.17;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    /* İmleç ile yakın partiküller arası çizgiler: yaklaştıkça parlar */
    if (p.strength > 0.01) {
      for (i = 0; i < parts.length; i++) {
        a = parts[i];
        dx = a.x - p.x;
        dy = a.y - p.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) {
          var closeness = 1 - d / R;
          ctx.globalAlpha =
            (0.06 + 0.5 * closeness * closeness) * p.strength * Math.min(1, a.pull * 1.6 + 0.25);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(a.x, a.y);
          ctx.stroke();
        }
      }
    }

    /* Partiküller */
    for (i = 0; i < parts.length; i++) {
      a = parts[i];
      var tw = a.red ? 0.78 + 0.22 * Math.sin(now * 0.0019 + a.phase) : 1;
      alpha = Math.min(1, a.alpha * tw + a.pull * 0.22);
      var rgb = a.red ? pal.red : pal.cream;

      if (a.glow) {
        var gs = a.r * (a.red ? 10 : 8);
        ctx.globalAlpha = alpha * (a.red ? 0.6 : 0.4);
        ctx.drawImage(a.red ? state.sprites.red : state.sprites.cream, a.x - gs / 2, a.y - gs / 2, gs, gs);
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = rgba(rgb, 1);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------------
     Döngü
     ------------------------------------------------------------------------ */
  function frame(now) {
    state.rafId = window.requestAnimationFrame(frame);

    var dt = state.lastTime ? (now - state.lastTime) / 16.667 : 1;
    state.lastTime = now;
    if (dt > 3) dt = 3;

    applyTheme();
    update(dt, now);
    draw(now);
  }

  function start() {
    if (state.rafId) return;
    state.lastTime = 0;
    state.rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (!state.rafId) return;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  /* ------------------------------------------------------------------------
     Girdi olayları (fare + dokunma, pasif; sayfa kaydırmayı/etkileşimi engellemez)
     ------------------------------------------------------------------------ */
  function setPointer(e) {
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.active = true;
  }

  function addRipple(x, y) {
    if (state.motion < 1) return;
    state.ripples.push({ x: x, y: y, t: 0 });
    if (state.ripples.length > 4) state.ripples.shift();
  }

  function bindEvents() {
    window.addEventListener("pointermove", setPointer, { passive: true });

    window.addEventListener(
      "pointerdown",
      function (e) {
        setPointer(e);
        addRipple(e.clientX, e.clientY);
      },
      { passive: true }
    );

    function release(e) {
      if (e.pointerType && e.pointerType !== "mouse") {
        state.pointer.active = false;
      }
    }
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });

    document.documentElement.addEventListener("mouseleave", function () {
      state.pointer.active = false;
    });
    window.addEventListener("blur", function () {
      state.pointer.active = false;
    });

    var resizeRaf = 0;
    window.addEventListener("resize", function () {
      if (resizeRaf) return;
      resizeRaf = window.requestAnimationFrame(function () {
        resizeRaf = 0;
        resize();
      });
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    if (reducedMotionQuery) {
      var onMotionChange = function () {
        state.motion = reducedMotionQuery.matches ? 0.2 : 1;
        syncParticleCount();
      };
      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", onMotionChange);
      } else if (typeof reducedMotionQuery.addListener === "function") {
        reducedMotionQuery.addListener(onMotionChange);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Başlat
     ------------------------------------------------------------------------ */
  state.motion = reducedMotionQuery && reducedMotionQuery.matches ? 0.2 : 1;
  applyTheme();
  resize();
  bindEvents();
  if (!document.hidden) start();
})(window, document);
