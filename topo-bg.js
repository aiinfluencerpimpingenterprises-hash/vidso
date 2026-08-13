/* Interactive topographic contour background — shared site-wide.
   Source art: /topo-bg.svg (exact contour asset; optional R2 override).
   Usage: include <script src="/topo-bg.js"></script> — auto-mounts a fixed
   <canvas id="topo-bg"> if missing. Optional: data-mode="subtle" on the canvas
   (or body[data-topo="subtle"]) for denser UI (fainter opacity + content scrim).

   Approach: SVG rasterized to canvas + cursor lens warp + radial line brighten
   + whole-layer parallax. Touch / prefers-reduced-motion → static.
*/
(function () {
  var R2_SRC = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/topo-bg.svg';
  var LOCAL_SRC = '/topo-bg.svg';

  // ONE place to tune resting opacity.
  var OPACITY = {
    landing: 0.65,
    subtle: 0.45
  };

  if (document.getElementById('topo-bg-style')) return;

  var style = document.createElement('style');
  style.id = 'topo-bg-style';
  style.textContent =
    '#topo-bg{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:block}' +
    'body.topo-subtle .content-scrim,' +
    'body.topo-subtle .legal-shell,' +
    'body.topo-subtle .legal,' +
    'body.topo-subtle .auth-modal,' +
    'body.topo-subtle .modal,' +
    'body.topo-subtle .settings-panel,' +
    'body.topo-subtle .tool-card,' +
    'body.topo-subtle .ui-card{position:relative}' +
    'body.topo-subtle .content-scrim::before,' +
    'body.topo-subtle .legal-shell::before{' +
      'content:"";position:absolute;inset:-12px;border-radius:inherit;' +
      'background:radial-gradient(ellipse at 50% 28%,rgba(11,11,12,.62),rgba(11,11,12,.28) 55%,transparent 80%);' +
      'pointer-events:none;z-index:0' +
    '}' +
    'body.topo-subtle .content-scrim > *,' +
    'body.topo-subtle .legal-shell > *{position:relative;z-index:1}';
  document.head.appendChild(style);

  function ensureCanvas() {
    var c = document.getElementById('topo-bg');
    if (c) return c;
    c = document.createElement('canvas');
    c.id = 'topo-bg';
    c.setAttribute('aria-hidden', 'true');
    var modeAttr = document.body && document.body.getAttribute('data-topo');
    if (modeAttr) c.setAttribute('data-mode', modeAttr);
    if (document.body) {
      document.body.insertBefore(c, document.body.firstChild);
    } else {
      document.documentElement.appendChild(c);
    }
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('load failed: ' + src)); };
      img.src = src;
    });
  }

  function boot() {
    var canvas = ensureCanvas();
    if (!canvas.getContext) return;
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var mode = (canvas.getAttribute('data-mode') ||
      (document.body && document.body.getAttribute('data-topo')) ||
      'landing').toLowerCase();
    var subtle = mode === 'subtle';
    if (subtle && document.body) document.body.classList.add('topo-subtle');

    var baseOpacity = subtle ? OPACITY.subtle : OPACITY.landing;

    var fine = false;
    var reduce = false;
    try {
      fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    var interactive = fine && !reduce;

    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var srcImg = null;
    var tile = null; // offscreen raster of SVG covering viewport
    var tileW = 0;
    var tileH = 0;
    var lens = null;
    var lensSide = 0;

    // Cursor + smoothed state
    var mx = cssW * 0.5;
    var my = cssH * 0.5;
    var smx = mx;
    var smy = my;
    var hasPointer = false;
    var glow = 0; // 0..1
    var targetGlow = 0;

    // Parallax (opposite cursor), max ~18px
    var parallaxMax = subtle ? 14 : 20;
    var px = 0;
    var py = 0;
    var tpx = 0;
    var tpy = 0;

    var raf = 0;
    var running = false;
    var pageVisible = true;

    function coverRect(iw, ih, cw, ch) {
      var scale = Math.max(cw / iw, ch / ih);
      var tw = iw * scale;
      var th = ih * scale;
      return { x: (cw - tw) * 0.5, y: (ch - th) * 0.5, w: tw, h: th, scale: scale };
    }

    function rebuildTile() {
      if (!srcImg || !srcImg.naturalWidth) return;
      cssW = window.innerWidth || 1;
      cssH = window.innerHeight || 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var cover = coverRect(srcImg.naturalWidth, srcImg.naturalHeight, cssW, cssH);
      // Extra pad so parallax + lens never reveal edges
      var pad = parallaxMax * 2 + 40;
      tileW = Math.ceil(cover.w + pad * 2);
      tileH = Math.ceil(cover.h + pad * 2);
      tile = document.createElement('canvas');
      tile.width = Math.floor(tileW * dpr);
      tile.height = Math.floor(tileH * dpr);
      var tctx = tile.getContext('2d');
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.clearRect(0, 0, tileW, tileH);
      tctx.drawImage(srcImg, pad, pad, cover.w, cover.h);
      tile._pad = pad;
      tile._cover = cover;
    }

    function paintStatic() {
      if (!tile) return;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.save();
      ctx.globalAlpha = baseOpacity;
      var pad = tile._pad;
      ctx.drawImage(
        tile,
        0, 0, tile.width, tile.height,
        -pad, -pad, tileW, tileH
      );
      ctx.restore();
    }

    function paintInteractive() {
      if (!tile) return;
      ctx.clearRect(0, 0, cssW, cssH);

      // Smooth toward targets
      smx += (mx - smx) * 0.18;
      smy += (my - smy) * 0.18;
      glow += (targetGlow - glow) * 0.16;
      px += (tpx - px) * 0.12;
      py += (tpy - py) * 0.12;

      var pad = tile._pad;

      // Base layer with parallax
      ctx.save();
      ctx.globalAlpha = baseOpacity;
      ctx.drawImage(
        tile,
        0, 0, tile.width, tile.height,
        -pad + px, -pad + py, tileW, tileH
      );
      ctx.restore();

      if (glow > 0.01) {
        var radius = subtle ? 160 : 210;
        var lensScale = 1.07 + glow * 0.06;

        // --- Soft red brighten under cursor (lines feel "lit") ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(smx, smy, radius, 0, Math.PI * 2);
        ctx.clip();
        // Additive brighten so contours feel lit under the cursor
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.35 + 0.4 * glow) * baseOpacity;
        ctx.drawImage(
          tile,
          0, 0, tile.width, tile.height,
          -pad + px, -pad + py, tileW, tileH
        );
        ctx.restore();

        // --- Localized lens warp: magnified disk of the topo ---
        ctx.save();
        var g = ctx.createRadialGradient(smx, smy, radius * 0.15, smx, smy, radius);
        // Soft falloff via reused intermediate canvas
        var side = Math.ceil(radius * 2 * lensScale + 4);
        if (!lens || lensSide !== side || lens.width !== Math.floor(side * dpr)) {
          lens = document.createElement('canvas');
          lensSide = side;
          lens.width = Math.floor(side * dpr);
          lens.height = Math.floor(side * dpr);
        }
        var lctx = lens.getContext('2d');
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.clearRect(0, 0, side, side);

        // Source rect in screen space mapped into tile draw coords
        var srcX = smx - radius;
        var srcY = smy - radius;
        var srcS = radius * 2;

        // Draw magnified region from the already-composited look by resampling tile
        lctx.save();
        lctx.translate(side / 2, side / 2);
        lctx.scale(lensScale, lensScale);
        lctx.translate(-side / 2, -side / 2);
        // Map: screen (srcX,srcY) corresponds to tile draw origin (-pad+px, -pad+py)
        lctx.globalAlpha = baseOpacity * (0.85 + glow * 0.15);
        lctx.drawImage(
          tile,
          0, 0, tile.width, tile.height,
          -pad + px - srcX, -pad + py - srcY, tileW, tileH
        );
        lctx.restore();

        // Soft circular alpha mask
        lctx.globalCompositeOperation = 'destination-in';
        var lg = lctx.createRadialGradient(side / 2, side / 2, radius * 0.2, side / 2, side / 2, radius);
        lg.addColorStop(0, 'rgba(0,0,0,' + (0.75 + glow * 0.2).toFixed(3) + ')');
        lg.addColorStop(0.55, 'rgba(0,0,0,' + (0.4 * glow + 0.15).toFixed(3) + ')');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = lg;
        lctx.fillRect(0, 0, side, side);

        ctx.drawImage(lens, 0, 0, lens.width, lens.height, smx - side / 2, smy - side / 2, side, side);
        ctx.restore();
      }
    }

    function frame() {
      raf = 0;
      if (!pageVisible) {
        running = false;
        return;
      }
      if (!interactive) {
        paintStatic();
        running = false;
        return;
      }
      paintInteractive();

      var settling =
        Math.abs(mx - smx) > 0.15 ||
        Math.abs(my - smy) > 0.15 ||
        Math.abs(tpx - px) > 0.05 ||
        Math.abs(tpy - py) > 0.05 ||
        Math.abs(targetGlow - glow) > 0.005 ||
        glow > 0.01;

      if (settling) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }

    function kick() {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      hasPointer = true;
      targetGlow = 1;
      // Parallax opposite cursor from center
      var nx = (mx / (cssW || 1) - 0.5) * 2;
      var ny = (my / (cssH || 1) - 0.5) * 2;
      tpx = -nx * parallaxMax;
      tpy = -ny * parallaxMax;
      kick();
    }

    function onLeave() {
      hasPointer = false;
      targetGlow = 0;
      tpx = 0;
      tpy = 0;
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

    function startWith(img) {
      srcImg = img;
      rebuildTile();
      if (interactive) {
        paintInteractive();
      } else {
        paintStatic();
      }
    }

    // Prefer R2 exact asset; fall back to local repo copy.
    loadImage(R2_SRC)
      .catch(function () { return loadImage(LOCAL_SRC); })
      .then(startWith)
      .catch(function (err) {
        console.warn('[topo-bg] failed to load contour asset', err);
      });

    var resizeTimer = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          if (!srcImg) return;
          rebuildTile();
          kick();
          if (!interactive) paintStatic();
        }, 120);
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', onVisibility);

    if (interactive) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave, { passive: true });
      document.addEventListener('mouseleave', onLeave, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
