/* ════════════════════════════════════════════════════════════
   HERO CANVAS — flow-field particles + drifting light blobs.
   Pure 2D canvas, no libraries. Pauses off-screen and on
   hidden tabs; sits out entirely for prefers-reduced-motion.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { canvas.style.display = 'none'; return; }

  var ctx = canvas.getContext('2d', { alpha: true });
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var particles = [];
  var blobs = [];
  var running = true, visible = true, raf = null, t = 0;

  var PALETTE = ['#d7ff3e', '#35e7ff', '#6e4bff', '#ff5a3c'];
  var mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  var lowPower = (navigator.hardwareConcurrency || 8) <= 4 || window.matchMedia('(pointer: coarse)').matches;

  function count() {
    var n = Math.round((W * H) / 14000);
    return Math.max(30, Math.min(n, lowPower ? 70 : 150));
  }

  function seed() {
    particles = [];
    for (var i = 0; i < count(); i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0, vy: 0,
        r: Math.random() * 1.7 + 0.5,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        a: Math.random() * 0.5 + 0.25,
        s: Math.random() * 0.5 + 0.55
      });
    }
    blobs = [
      { x: W * 0.22, y: H * 0.34, r: Math.max(W, H) * 0.34, c: 'rgba(110, 75, 255, 0.40)', sx: 0.00021, sy: 0.00017, px: 0.20, py: 0.16 },
      { x: W * 0.78, y: H * 0.62, r: Math.max(W, H) * 0.30, c: 'rgba(215, 255, 62, 0.20)', sx: 0.00015, sy: 0.00024, px: 0.18, py: 0.20 },
      { x: W * 0.55, y: H * 0.18, r: Math.max(W, H) * 0.26, c: 'rgba(53, 231, 255, 0.16)', sx: 0.00027, sy: 0.00013, px: 0.15, py: 0.12 }
    ];
  }

  /* cheap, smooth pseudo-noise field — good enough, very fast */
  function field(x, y, time) {
    return Math.sin(x * 0.0022 + time) * 1.4 +
           Math.cos(y * 0.0026 - time * 0.8) * 1.4 +
           Math.sin((x + y) * 0.0013 + time * 0.5);
  }

  function drawBlobs() {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var cx = b.x + Math.sin(t * b.sx * 1000) * W * b.px;
      var cy = b.y + Math.cos(t * b.sy * 1000) * H * b.py;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - b.r, cy - b.r, b.r * 2, b.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLinks() {
    var max = 118, max2 = max * max;
    ctx.lineWidth = 0.6;
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        if (dx > max || dx < -max) continue;
        var dy = particles[i].y - particles[j].y;
        if (dy > max || dy < -max) continue;
        var d2 = dx * dx + dy * dy;
        if (d2 > max2) continue;
        ctx.strokeStyle = 'rgba(242, 239, 232,' + (0.13 * (1 - d2 / max2)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  function step() {
    t += 0.0022;
    ctx.clearRect(0, 0, W, H);
    drawBlobs();

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var angle = field(p.x, p.y, t) * Math.PI;
      p.vx += Math.cos(angle) * 0.045 * p.s;
      p.vy += Math.sin(angle) * 0.045 * p.s;

      if (mouse.active) {
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < 26000 && md2 > 0.5) {
          var force = (1 - md2 / 26000) * 0.9;
          var md = Math.sqrt(md2);
          p.vx += (mdx / md) * force;
          p.vy += (mdy / md) * force;
        }
      }

      p.vx *= 0.94; p.vy *= 0.94;
      p.x += p.vx; p.y += p.vy;

      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;

      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawLinks();
    raf = requestAnimationFrame(step);
  }

  function play() {
    if (raf || !running || !visible) return;
    raf = requestAnimationFrame(step);
  }
  function pause() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  window.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = mouse.y > -200 && mouse.y < rect.height + 200;
  }, { passive: true });
  window.addEventListener('pointerleave', function () { mouse.active = false; });

  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    running ? play() : pause();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? play() : pause();
    }, { threshold: 0 }).observe(canvas);
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 180);
  }, { passive: true });

  resize();

  /* start once the page has settled so the canvas never competes with first paint */
  function boot() {
    var go = function () { running = !document.hidden; play(); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1200 });
    else setTimeout(go, 300);
  }
  running = false;
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
})();
