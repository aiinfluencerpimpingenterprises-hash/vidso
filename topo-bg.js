/* Site-wide topographic background — R2 SVG only (no generated pattern).
   Usage: <script src="/topo-bg.js"></script>
   Auto-mounts #topo-bg if missing. Optional: data-mode="subtle" on the layer
   (or body[data-topo="subtle"]) for denser UI.

   Opacity (ONE place): landing ~0.6, subtle ~0.35.
   Interaction: whole-layer parallax only (no redraw / warp of the SVG).
*/
(function () {
  var R2_SRC = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/topo-bg.svg';

  var OPACITY = {
    landing: 0.6,
    subtle: 0.35
  };

  if (document.getElementById('topo-bg-style')) return;

  var style = document.createElement('style');
  style.id = 'topo-bg-style';
  style.textContent =
    '#topo-bg{' +
      'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:0;overflow:hidden;' +
      'transform:translate3d(0,0,0);will-change:transform;' +
    '}' +
    '#topo-bg .topo-bg-img{' +
      'position:absolute;left:50%;top:50%;' +
      'width:110%;height:110%;' +
      'transform:translate(-50%,-50%) scale(1.05);' +
      'object-fit:cover;object-position:center;' +
      'display:block;user-select:none;-webkit-user-drag:none;' +
    '}' +
    'body.topo-subtle .content-scrim,' +
    'body.topo-subtle .legal-shell{position:relative}' +
    'body.topo-subtle .content-scrim::before,' +
    'body.topo-subtle .legal-shell::before{' +
      'content:"";position:absolute;inset:-12px;border-radius:inherit;' +
      'background:radial-gradient(ellipse at 50% 28%,rgba(11,11,12,.62),rgba(11,11,12,.28) 55%,transparent 80%);' +
      'pointer-events:none;z-index:0' +
    '}' +
    'body.topo-subtle .content-scrim > *,' +
    'body.topo-subtle .legal-shell > *{position:relative;z-index:1}';
  document.head.appendChild(style);

  function ensureLayer() {
    var el = document.getElementById('topo-bg');
    var modeAttr =
      (el && el.getAttribute('data-mode')) ||
      (document.body && document.body.getAttribute('data-topo')) ||
      'landing';

    if (!el) {
      el = document.createElement('div');
      el.id = 'topo-bg';
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('data-mode', modeAttr);
      if (document.body) document.body.insertBefore(el, document.body.firstChild);
      else document.documentElement.appendChild(el);
    } else {
      // Replace legacy <canvas> mounts with a div layer.
      if (el.tagName !== 'DIV') {
        var next = document.createElement('div');
        next.id = 'topo-bg';
        next.setAttribute('aria-hidden', 'true');
        next.setAttribute('data-mode', modeAttr);
        el.parentNode.replaceChild(next, el);
        el = next;
      } else if (!el.getAttribute('data-mode')) {
        el.setAttribute('data-mode', modeAttr);
      }
    }

    var img = el.querySelector('img.topo-bg-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'topo-bg-img';
      img.alt = '';
      img.decoding = 'async';
      img.setAttribute('aria-hidden', 'true');
      img.src = R2_SRC;
      el.appendChild(img);
    } else if (img.src.indexOf('topo-bg.svg') === -1) {
      img.src = R2_SRC;
    }

    return el;
  }

  function boot() {
    var layer = ensureLayer();
    var mode = (layer.getAttribute('data-mode') || 'landing').toLowerCase();
    var subtle = mode === 'subtle';
    if (subtle && document.body) document.body.classList.add('topo-subtle');

    var opacity = subtle ? OPACITY.subtle : OPACITY.landing;
    layer.style.opacity = String(opacity);

    var fine = false;
    var reduce = false;
    try {
      fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    if (!fine || reduce) return;

    var parallaxMax = subtle ? 14 : 18;
    var mx = 0.5;
    var my = 0.5;
    var smx = 0.5;
    var smy = 0.5;
    var px = 0;
    var py = 0;
    var tpx = 0;
    var tpy = 0;
    var raf = 0;
    var running = false;

    function apply() {
      layer.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
    }

    function frame() {
      raf = 0;
      smx += (mx - smx) * 0.12;
      smy += (my - smy) * 0.12;
      tpx = -(smx - 0.5) * 2 * parallaxMax;
      tpy = -(smy - 0.5) * 2 * parallaxMax;
      px += (tpx - px) * 0.12;
      py += (tpy - py) * 0.12;
      apply();

      var settling =
        Math.abs(mx - smx) > 0.001 ||
        Math.abs(my - smy) > 0.001 ||
        Math.abs(tpx - px) > 0.05 ||
        Math.abs(tpy - py) > 0.05;

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

    window.addEventListener(
      'pointermove',
      function (e) {
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        mx = e.clientX / w;
        my = e.clientY / h;
        kick();
      },
      { passive: true }
    );

    function reset() {
      mx = 0.5;
      my = 0.5;
      kick();
    }
    window.addEventListener('pointerleave', reset, { passive: true });
    document.addEventListener('mouseleave', reset, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
