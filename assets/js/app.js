/* ════════════════════════════════════════════════════════════
   APP — loader, cursor, reveals, magnetics, counters, marquee,
   tilt, accordion, clock, contact form. Vanilla JS, no deps.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────
     FORM_ENDPOINT: paste a Formspree / Web3Forms / Basin URL to
     have the contact form POST straight to your inbox. Leave it
     empty and the form falls back to opening a pre-filled email
     in the visitor's mail client — it works either way.       */
  var CONFIG = {
    FORM_ENDPOINT: '',
    EMAIL: 'aman.teferi.80@gmail.com',
    TIMEZONE: 'Africa/Addis_Ababa'
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lerp = function (a, b, n) { return a + (b - a) * n; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ══ 1. LOADER ══════════════════════════════════════════ */
  (function loader() {
    var el = $('#loader'), bar = $('#loaderBar'), num = $('#loaderCount');
    if (!el) return;
    document.body.classList.add('is-locked');

    var pct = 0, done = false, loaded = false;
    window.addEventListener('load', function () { loaded = true; });

    function finish() {
      if (done) return;
      done = true;
      el.classList.add('is-done');
      document.body.classList.remove('is-locked');
      document.documentElement.classList.add('is-ready');
      setTimeout(function () { el.remove(); }, 1300);
      revealHero();
    }

    /* repeat visits in the same tab session skip the intro entirely */
    var seen = false;
    try { seen = sessionStorage.getItem('at-intro') === '1'; sessionStorage.setItem('at-intro', '1'); } catch (e) {}
    if (seen || reduced) { el.style.transition = 'none'; finish(); return; }

    var timer = setInterval(function () {
      var ceiling = loaded ? 100 : 90;
      pct = Math.min(ceiling, pct + Math.random() * 10 + 9);
      if (bar) bar.style.width = pct + '%';
      if (num) num.textContent = String(Math.floor(pct)).padStart(2, '0');
      if (pct >= 100) { clearInterval(timer); setTimeout(finish, 120); }
    }, 45);

    /* never let a slow font or image hold the page hostage */
    setTimeout(function () { loaded = true; }, 900);
  })();

  function revealHero() {
    $$('.hero [data-reveal], .hero [data-split]').forEach(function (el, i) {
      setTimeout(function () { el.classList.add('is-in'); }, 90 * i);
    });
  }

  /* ══ 2. SPLIT TEXT ══════════════════════════════════════ */
  $$('[data-split]').forEach(function (el) {
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map(function (line) {
      return '<span class="char-line"><span>' + line.trim() + '</span></span>';
    }).join('');
  });

  $$('[data-split-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
  });

  /* ══ 3. REVEAL ON SCROLL ════════════════════════════════ */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var group = el.parentElement ? $$('[data-reveal], [data-split]', el.parentElement) : [el];
      var idx = Math.max(0, group.indexOf(el));
      setTimeout(function () { el.classList.add('is-in'); }, Math.min(idx, 6) * 80);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }) : null;

  if (io) {
    $$('[data-reveal], [data-split]').forEach(function (el) {
      if (el.closest('.hero')) return;   /* hero is released by the loader */
      io.observe(el);
    });
  } else {
    $$('[data-reveal], [data-split]').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ══ 4. COUNTERS ════════════════════════════════════════ */
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = reduced ? 0 : 1500;
    var start = performance.now();

    function fmt(v) {
      var s = v.toFixed(decimals);
      if (decimals === 0) s = Number(s).toLocaleString('en-US');
      return prefix + s + suffix;
    }
    if (!dur) { el.textContent = fmt(target); return; }

    (function tick(now) {
      var p = clamp((now - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    })(start);
  }

  var counters = $$('[data-count]');
  /* the HTML carries the final values (for no-JS and link previews); zero them before animating */
  if (!reduced && 'IntersectionObserver' in window) {
    counters.forEach(function (el) {
      var d = parseInt(el.getAttribute('data-decimals') || '0', 10);
      el.textContent = (el.getAttribute('data-prefix') || '') + (0).toFixed(d) + (el.getAttribute('data-suffix') || '');
    });
  }
  if ('IntersectionObserver' in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        runCounter(e.target);
        cio.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* ══ 5. CUSTOM CURSOR ═══════════════════════════════════ */
  (function cursor() {
    var el = $('#cursor');
    if (!el || !fine) { if (el) el.remove(); return; }
    var dot = $('.cursor__dot', el), ring = $('.cursor__ring', el), label = $('.cursor__label', el);
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;

    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%, -50%)';
    }, { passive: true });

    document.addEventListener('pointerdown', function () { el.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { el.classList.remove('is-down'); });

    (function follow() {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%, -50%)';
      requestAnimationFrame(follow);
    })();

    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cursor], a, button') : null;
      if (!t) return;
      var mode = t.getAttribute && t.getAttribute('data-cursor');
      if (mode === 'view') { el.classList.add('is-view'); label.textContent = 'VIEW'; }
      else { el.classList.add('is-hover'); }
    });
    document.addEventListener('pointerout', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cursor], a, button') : null;
      if (!t) return;
      el.classList.remove('is-hover', 'is-view');
      label.textContent = '';
    });
  })();

  /* ══ 6. NAV + PROGRESS + PARALLAX ═══════════════════════ */
  (function scrollUI() {
    var nav = $('#nav'), progress = $('#scrollProgress');
    var heroInner = $('.hero__inner'), heroTitle = $('.hero__title');
    var last = window.scrollY, ticking = false;

    function frame() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

      if (nav) {
        nav.classList.toggle('is-stuck', y > 40);
        nav.classList.toggle('is-hidden', y > last && y > 400 && !document.body.classList.contains('menu-open'));
      }

      if (!reduced && heroInner && y < window.innerHeight * 1.2) {
        heroInner.style.transform = 'translateY(' + (y * 0.16).toFixed(2) + 'px)';
        heroInner.style.opacity = String(clamp(1 - y / (window.innerHeight * 0.85), 0, 1));
        if (heroTitle) heroTitle.style.letterSpacing = (-0.05 + Math.min(y / window.innerHeight, 1) * 0.02).toFixed(4) + 'em';
      }

      last = y;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
    frame();
  })();

  /* ══ 7. WORD-BY-WORD LIGHT-UP ═══════════════════════════ */
  (function wordLight() {
    var blocks = $$('[data-split-words]');
    if (!blocks.length || reduced) {
      blocks.forEach(function (b) { $$('.word', b).forEach(function (w) { w.classList.add('is-lit'); }); });
      return;
    }
    var ticking = false;
    function frame() {
      blocks.forEach(function (block) {
        var rect = block.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.35), 0, 1);
        var words = $$('.word', block);
        var lit = Math.round(p * words.length * 1.25);
        words.forEach(function (w, i) { w.classList.toggle('is-lit', i < lit); });
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
    frame();
  })();

  /* ══ 8. MARQUEE (scroll-reactive) ═══════════════════════ */
  (function marquee() {
    var wrap = $('[data-marquee]');
    if (!wrap || reduced) return;
    var track = $('.marquee__track', wrap);
    var x = 0, base = 0.6, velocity = 0, lastY = window.scrollY;

    window.addEventListener('scroll', function () {
      velocity = (window.scrollY - lastY) * 0.35;
      lastY = window.scrollY;
    }, { passive: true });

    (function frame() {
      velocity *= 0.92;
      x -= base + velocity;
      var half = track.scrollWidth / 2;
      if (half > 0) {
        if (x <= -half) x += half;
        if (x > 0) x -= half;
      }
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(frame);
    })();
  })();

  /* ══ 9. MAGNETIC ELEMENTS ═══════════════════════════════ */
  if (fine && !reduced) {
    $$('[data-magnetic]').forEach(function (el) {
      var tx = 0, ty = 0, cx = 0, cy = 0, active = false, raf = null;

      function loop() {
        cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
        el.style.transform = 'translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)';
        if (Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1 || active) raf = requestAnimationFrame(loop);
        else { el.style.transform = ''; raf = null; }
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * r.width * 0.32;
        ty = ((e.clientY - r.top) / r.height - 0.5) * r.height * 0.42;
        active = true;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () {
        tx = 0; ty = 0; active = false;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ══ 10. TILT CARDS ═════════════════════════════════════ */
  if (fine && !reduced) {
    $$('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 7).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 9).toFixed(2) + 'deg) translateZ(0)';
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 620);
      });
    });
  }

  /* ══ 11. EXPERIENCE ACCORDION ═══════════════════════════ */
  (function jobs() {
    var list = $$('[data-job]');
    list.forEach(function (job, i) {
      var head = $('.job__head', job);
      var body = $('.job__body', job);
      if (!head || !body) return;

      var id = 'job-body-' + (i + 1);
      body.id = id;
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-controls', id);
      head.setAttribute('data-cursor', 'hover');

      function set(open) {
        job.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));
      }
      set(true);

      function toggle() { set(!job.classList.contains('is-open')); }
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  })();

  /* ══ 12. MOBILE MENU ════════════════════════════════════ */
  (function menu() {
    var burger = $('#burger'), panel = $('#menu');
    if (!burger || !panel) return;

    function close() {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('is-locked', 'menu-open');
    }
    burger.addEventListener('click', function () {
      var open = !panel.classList.contains('is-open');
      if (!open) return close();
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      panel.inert = false;
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('is-locked', 'menu-open');
    });
    $$('.menu__item, .menu__foot a', panel).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { close(); burger.focus(); }
    });
    panel.inert = true;  /* closed menu links stay out of the tab order */
  })();

  /* ══ 13. CLOCKS + YEAR ══════════════════════════════════ */
  (function clock() {
    var nav = $('#navClock'), foot = $('#footClock'), year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
    if (!nav && !foot) return;

    function tick() {
      var now = new Date();
      try {
        if (nav) nav.textContent = now.toLocaleTimeString('en-GB', { timeZone: CONFIG.TIMEZONE, hour12: false }) + ' EAT';
        if (foot) foot.textContent = now.toLocaleTimeString('en-GB', { timeZone: CONFIG.TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });
      } catch (err) {
        if (nav) nav.textContent = now.toLocaleTimeString();
      }
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ══ 14. SMOOTH ANCHORS ═════════════════════════════════ */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });

  /* ══ 15. CONTACT FORM ═══════════════════════════════════ */
  (function form() {
    var el = $('#contactForm');
    if (!el) return;
    var status = $('#formStatus');

    function setError(name, msg) {
      var field = $('[name="' + name + '"]', el);
      if (!field) return;
      var wrap = field.closest('.field');
      var slot = $('[data-error-for="' + name + '"]', el);
      if (wrap) wrap.classList.toggle('has-error', !!msg);
      if (slot) slot.textContent = msg || '';
    }

    function validate(data) {
      var ok = true;
      ['name', 'email', 'message'].forEach(function (k) { setError(k, ''); });
      if (!data.name || data.name.trim().length < 2) { setError('name', 'Tell me your name'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) { setError('email', 'A reachable email, please'); ok = false; }
      if (!data.message || data.message.trim().length < 10) { setError('message', 'A little more detail (10+ characters)'); ok = false; }
      return ok;
    }

    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(el);
      var data = {
        name: (fd.get('name') || '').toString(),
        email: (fd.get('email') || '').toString(),
        message: (fd.get('message') || '').toString()
      };

      if ((fd.get('_gotcha') || '').toString().length) return;      /* bot */
      if (!validate(data)) {
        status.textContent = 'Check the highlighted fields.';
        status.className = 'form__status is-bad';
        return;
      }

      status.textContent = 'Sending…';
      status.className = 'form__status';

      if (CONFIG.FORM_ENDPOINT) {
        el.classList.add('is-sending');
        fetch(CONFIG.FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error('bad status ' + res.status);
          el.reset();
          status.textContent = 'Sent. I\'ll get back to you shortly.';
          status.className = 'form__status is-ok';
        }).catch(function () {
          status.innerHTML = 'That didn\'t go through — email me directly at <a href="mailto:' + CONFIG.EMAIL + '">' + CONFIG.EMAIL + '</a>.';
          status.className = 'form__status is-bad';
        }).finally(function () {
          el.classList.remove('is-sending');
        });
        return;
      }

      /* no endpoint configured — hand the message to the mail client */
      var subject = encodeURIComponent('Portfolio enquiry from ' + data.name);
      var body = encodeURIComponent(data.message + '\n\n— ' + data.name + '\n' + data.email);
      window.location.href = 'mailto:' + CONFIG.EMAIL + '?subject=' + subject + '&body=' + body;
      status.textContent = 'Opening your mail app — hit send and it\'s on its way.';
      status.className = 'form__status is-ok';
    });
  })();

})();
