/* Static topographic contour background — shared by landing, app, and legal.
   Usage: <canvas id="topo-bg" aria-hidden="true"></canvas>
   Optional: data-mode="subtle" for denser UI (fainter strokes).
*/
(function () {
  if (document.getElementById('topo-bg-style')) return;
  var style = document.createElement('style');
  style.id = 'topo-bg-style';
  style.textContent =
    '#topo-bg{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:block}' +
    'body.topo-subtle .content-scrim,' +
    'body.topo-subtle .legal-shell{position:relative}' +
    'body.topo-subtle .content-scrim::before,' +
    'body.topo-subtle .legal-shell::before{' +
      'content:"";position:absolute;inset:-8px;border-radius:inherit;' +
      'background:radial-gradient(ellipse at 50% 30%,rgba(11,11,12,.55),rgba(11,11,12,.22) 55%,transparent 78%);' +
      'pointer-events:none;z-index:0' +
    '}' +
    'body.topo-subtle .content-scrim > *,' +
    'body.topo-subtle .legal-shell > *{position:relative;z-index:1}';
  document.head.appendChild(style);

  function boot() {
    var canvas = document.getElementById('topo-bg');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var mode = (canvas.getAttribute('data-mode') || 'landing').toLowerCase();
    var subtle = mode === 'subtle';
    if (subtle) document.body.classList.add('topo-subtle');

    var dpr = 1;
    var cssW = 0;
    var cssH = 0;

    // Brand red strokes; landing a touch more present, app/legal fainter.
    var strokeA = subtle ? 0.055 : 0.11;
    var strokeASoft = subtle ? 0.028 : 0.055;
    var lineW = subtle ? 0.85 : 1.05;

    function seeded(n) {
      var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    function noise2(x, y, seed) {
      var n = seeded(x * 12.9898 + y * 78.233 + seed * 45.164);
      var m = seeded(x * 39.346 + y * 11.135 + seed * 91.77);
      return (n + m) * 0.5;
    }

    function drawRing(cx, cy, rx, ry, seed, points, alpha) {
      ctx.beginPath();
      for (var i = 0; i <= points; i++) {
        var t = (i / points) * Math.PI * 2;
        var nx = Math.cos(t);
        var ny = Math.sin(t);
        // Organic warp — smooth elevation jitter, not a rigid ellipse.
        var warp =
          0.86 +
          0.18 * noise2(nx * 2.1, ny * 2.1, seed) +
          0.1 * noise2(nx * 4.4, ny * 4.4, seed + 3) +
          0.05 * Math.sin(t * 3 + seed);
        var x = cx + nx * rx * warp;
        var y = cy + ny * ry * warp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(233,75,88,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = lineW;
      ctx.stroke();
    }

    function drawCluster(cx, cy, baseR, rings, seed, squash) {
      for (var r = 1; r <= rings; r++) {
        var t = r / rings;
        var rx = baseR * t;
        var ry = baseR * t * squash;
        // Slight center drift per ring so contours feel like a real topo map.
        var ox = (noise2(r, 1, seed) - 0.5) * baseR * 0.06;
        var oy = (noise2(r, 2, seed + 1) - 0.5) * baseR * 0.06;
        var a = strokeA * (1 - t * 0.55) + strokeASoft * t;
        var pts = Math.max(36, Math.floor(48 + t * 36));
        drawRing(cx + ox, cy + oy, rx, ry, seed + r * 0.37, pts, a);
      }
    }

    function paint() {
      cssW = window.innerWidth || 1;
      cssH = window.innerHeight || 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      var minSide = Math.min(cssW, cssH);
      var clusters = [
        { x: cssW * 0.18, y: cssH * 0.28, r: minSide * 0.42, rings: 9, seed: 1.1, squash: 0.72 },
        { x: cssW * 0.78, y: cssH * 0.22, r: minSide * 0.36, rings: 8, seed: 2.4, squash: 0.8 },
        { x: cssW * 0.62, y: cssH * 0.68, r: minSide * 0.48, rings: 11, seed: 3.7, squash: 0.68 },
        { x: cssW * 0.28, y: cssH * 0.78, r: minSide * 0.34, rings: 7, seed: 5.2, squash: 0.85 },
        { x: cssW * 0.5, y: cssH * 0.45, r: minSide * 0.26, rings: 6, seed: 6.8, squash: 0.9 }
      ];

      // On short mobile viewports, keep fewer overlapping clusters for clarity.
      if (cssW < 520) {
        clusters = [
          { x: cssW * 0.35, y: cssH * 0.32, r: minSide * 0.55, rings: 8, seed: 1.1, squash: 0.75 },
          { x: cssW * 0.75, y: cssH * 0.7, r: minSide * 0.48, rings: 9, seed: 3.7, squash: 0.7 },
          { x: cssW * 0.2, y: cssH * 0.82, r: minSide * 0.4, rings: 6, seed: 5.2, squash: 0.85 }
        ];
      }

      for (var i = 0; i < clusters.length; i++) {
        var c = clusters[i];
        drawCluster(c.x, c.y, c.r, c.rings, c.seed, c.squash);
      }
    }

    paint();

    var resizeTimer = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(paint, 140);
      },
      { passive: true }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
