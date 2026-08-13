/* Magnetic ambient dot grid — shared by landing, app, and legal pages.
   Usage: <canvas id="dot-grid" aria-hidden="true"></canvas>
   Optional: data-mode="subtle" for denser UI (lower opacity / sparser dots).
*/
(function () {
  if (document.getElementById('dot-grid-style')) return;
  var style = document.createElement('style');
  style.id = 'dot-grid-style';
  style.textContent =
    '#dot-grid{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:block}';
  document.head.appendChild(style);

  function boot() {
    var canvas = document.getElementById('dot-grid');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var mode = (canvas.getAttribute('data-mode') || 'landing').toLowerCase();
    var subtle = mode === 'subtle';

    var fine = false, reduce = false;
    try {
      fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    var interactive = fine && !reduce;
    var dpr = 1, cssW = 0, cssH = 0;
    var dots = [];
    var spacing = 34;
    var baseR = 1.05;
    var radius = 140;
    var radius2 = radius * radius;
    var maxPush = 18;
    var mx = -9999, my = -9999;
    var smx = -9999, smy = -9999;
    var hasPointer = false;
    var raf = 0;
    var running = false;
    var pageVisible = true;
    var canvasVisible = true;

    // Landing is a bit more present; app/legal stay fainter for dense UI.
    var baseAlpha = subtle ? 0.07 : 0.14;
    var inflAlpha = subtle ? 0.26 : 0.42;
    var redMixMax = subtle ? 0.4 : 0.55;
    var maxDots = subtle ? 750 : 1100;
    var spacingBump = subtle ? 6 : 0;

    function pickSpacing() {
      var w = window.innerWidth || 1200;
      var base = w < 480 ? 40 : w < 900 ? 36 : 32;
      return base + spacingBump;
    }

    function rebuild() {
      cssW = window.innerWidth || 1;
      cssH = window.innerHeight || 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      spacing = pickSpacing();
      var cols = Math.ceil(cssW / spacing) + 1;
      var rows = Math.ceil(cssH / spacing) + 1;
      while (cols * rows > maxDots) {
        spacing += 2;
        cols = Math.ceil(cssW / spacing) + 1;
        rows = Math.ceil(cssH / spacing) + 1;
      }
      var ox = (cssW - (cols - 1) * spacing) * 0.5;
      var oy = (cssH - (rows - 1) * spacing) * 0.5;
      dots.length = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var hx = ox + c * spacing;
          var hy = oy + r * spacing;
          dots.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, influence: 0 });
        }
      }
      radius = Math.max(110, Math.min(170, spacing * 4.2));
      radius2 = radius * radius;
      maxPush = Math.max(14, Math.min(22, spacing * 0.55));
      baseR = cssW < 480 ? 1.15 : subtle ? 0.95 : 1.05;
      drawStaticOrFrame(true);
    }

    function isLight() {
      return document.documentElement.getAttribute('data-theme') === 'light';
    }

    function drawStaticOrFrame(forceStatic) {
      ctx.clearRect(0, 0, cssW, cssH);
      var light = isLight();
      var baseA = light ? (subtle ? 0.09 : 0.13) : baseAlpha;
      var inflA = light ? (subtle ? 0.22 : 0.34) : inflAlpha;
      var n = dots.length;
      for (var i = 0; i < n; i++) {
        var d = dots[i];
        var infl = forceStatic || !interactive ? 0 : d.influence;
        var a = baseA + infl * inflA;
        var rr = baseR * (1 + infl * 0.85);
        var redMix = infl * redMixMax;
        var r, g, b;
        if (light) {
          // Dark dots with warm brand tint near cursor
          r = Math.round(28 + redMix * 190);
          g = Math.round(28 + redMix * 20);
          b = Math.round(32 + redMix * 20);
        } else {
          r = 245;
          g = Math.round(245 - redMix * 170);
          b = Math.round(244 - redMix * 156);
        }
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
        ctx.arc(d.x, d.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick() {
      raf = 0;
      if (!pageVisible || !canvasVisible) {
        running = false;
        return;
      }

      if (hasPointer) {
        smx += (mx - smx) * 0.18;
        smy += (my - smy) * 0.18;
      } else {
        smx += (mx - smx) * 0.08;
        smy += (my - smy) * 0.08;
      }

      var moving = false;
      var n = dots.length;
      var spring = 0.14;
      var damp = 0.78;

      for (var i = 0; i < n; i++) {
        var d = dots[i];
        var dx = d.hx - smx;
        var dy = d.hy - smy;
        var dist2 = dx * dx + dy * dy;
        var infl = 0;
        var tx = d.hx, ty = d.hy;

        if (hasPointer && dist2 < radius2 && dist2 > 0.0001) {
          var dist = Math.sqrt(dist2);
          var t = 1 - dist / radius;
          var fall = t * t * (3 - 2 * t);
          infl = fall;
          var push = fall * maxPush;
          tx = d.hx + (dx / dist) * push;
          ty = d.hy + (dy / dist) * push;
        }

        d.vx += (tx - d.x) * spring;
        d.vy += (ty - d.y) * spring;
        d.vx *= damp;
        d.vy *= damp;
        d.x += d.vx;
        d.y += d.vy;
        d.influence += (infl - d.influence) * 0.22;

        if (
          Math.abs(d.vx) > 0.02 ||
          Math.abs(d.vy) > 0.02 ||
          Math.abs(d.influence - infl) > 0.01 ||
          Math.abs(d.x - d.hx) > 0.15 ||
          Math.abs(d.y - d.hy) > 0.15
        ) {
          moving = true;
        } else if (!hasPointer) {
          d.x = d.hx;
          d.y = d.hy;
          d.vx = 0;
          d.vy = 0;
          d.influence = 0;
        }
      }

      drawStaticOrFrame(false);
      var settling =
        moving || hasPointer || Math.abs(mx - smx) > 0.5 || Math.abs(my - smy) > 0.5;
      if (settling) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    function kick() {
      if (!interactive) return;
      if (!pageVisible || !canvasVisible) return;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    }

    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (!hasPointer) {
        hasPointer = true;
        smx = mx;
        smy = my;
      }
      kick();
    }
    function onLeave() {
      hasPointer = false;
      mx = -9999;
      my = -9999;
      kick();
    }

    function onVisibility() {
      pageVisible = document.visibilityState !== 'hidden';
      if (pageVisible) kick();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        running = false;
      }
    }

    rebuild();

    var resizeTimer = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          rebuild();
          kick();
        }, 120);
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', onVisibility);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          canvasVisible = !!(entries[0] && entries[0].isIntersecting);
          if (canvasVisible) kick();
          else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            running = false;
          }
        },
        { threshold: 0 }
      );
      io.observe(canvas);
    }

    if (interactive) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave, { passive: true });
      document.addEventListener('mouseleave', onLeave, { passive: true });
    }

    window.addEventListener('vidso:theme', function () {
      drawStaticOrFrame(!interactive);
      kick();
    });
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        drawStaticOrFrame(!interactive);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
