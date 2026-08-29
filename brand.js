/* Shared Vidso brand assets (Cloudflare R2). Loaded as a classic script: sets globals. */
(function (global) {
  var R2_BASE = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev';

  global.VIDSO_R2_BASE = R2_BASE;
  global.VIDSO_LOGO_URL = R2_BASE + '/vidso-logo.png';
  global.VIDSO_SUPPORT_EMAIL = 'support@vidso.pro';
  global.VIDSO_INSTAGRAM_URL = 'https://www.instagram.com/vidso.pro/';

  var SOCIAL_SVG = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
  };

  function vidsoSocialItems() {
    return [
      {
        key: 'instagram',
        href: global.VIDSO_INSTAGRAM_URL,
        label: 'Vidso on Instagram',
        external: true,
        icon: SOCIAL_SVG.instagram
      },
      {
        key: 'email',
        href: 'mailto:' + global.VIDSO_SUPPORT_EMAIL,
        label: 'Email Vidso',
        external: false,
        icon: SOCIAL_SVG.mail
      }
    ];
  }

  function ensureVidsoSocialStyles() {
    if (typeof document === 'undefined' || document.getElementById('vidso-social-css')) return;
    var style = document.createElement('style');
    style.id = 'vidso-social-css';
    style.textContent = [
      '.foot-social{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px}',
      '.foot-social a,.foot-social a.foot-social-link{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;margin:0;padding:0;border-radius:10px;border:1px solid var(--line-2,rgba(245,245,244,.15));background:transparent;color:var(--faint,rgba(245,245,244,.45));text-decoration:none;transition:color .2s ease,border-color .2s ease,background .2s ease}',
      '.foot-social a:hover,.foot-social a:focus-visible{color:var(--a1,var(--blue,#E94B58));border-color:rgba(var(--glow,233,75,88),.55);background:rgba(var(--glow,233,75,88),.08)}',
      '.foot-social a:focus-visible{outline:2px solid var(--a1,var(--blue,#E94B58));outline-offset:3px}',
      '.foot-social svg{width:18px;height:18px;display:block;pointer-events:none}',
      '@media (max-width:380px){.foot-social{margin-top:16px;gap:8px}.foot-social a,.foot-social a.foot-social-link{width:38px;height:38px}}',
      '@media (min-width:1100px){.foot-social{margin-top:20px;gap:12px}}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }

  global.applyVidsoSocialLinks = function applyVidsoSocialLinks() {
    if (typeof document === 'undefined') return;
    ensureVidsoSocialStyles();
    var items = vidsoSocialItems();
    var roots = document.querySelectorAll('[data-vidso-socials]');
    for (var i = 0; i < roots.length; i++) {
      var html = '';
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        html += '<a class="foot-social-link" href="' + item.href + '" aria-label="' + item.label + '"';
        if (item.external) html += ' target="_blank" rel="noopener noreferrer"';
        html += '>' + item.icon + '</a>';
      }
      roots[i].innerHTML = html;
    }
  };

  global.vidsoSupportMailto = function vidsoSupportMailto(subject) {
    var href = 'mailto:' + global.VIDSO_SUPPORT_EMAIL;
    if (subject) href += '?subject=' + encodeURIComponent(subject);
    return href;
  };

  /** Fill every [data-vidso-support] with the support mailto from VIDSO_SUPPORT_EMAIL. */
  global.applyVidsoSupportLinks = function applyVidsoSupportLinks() {
    var email = global.VIDSO_SUPPORT_EMAIL;
    var nodes = document.querySelectorAll('[data-vidso-support]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var subject = el.getAttribute('data-subject') || '';
      var label = el.getAttribute('data-label');
      if (el.tagName === 'A') {
        el.setAttribute('href', global.vidsoSupportMailto(subject));
        if (el.hasAttribute('data-fill-text') || !String(el.textContent || '').trim()) {
          el.textContent = label || email;
        }
      } else {
        el.textContent = email;
      }
    }
  };
  global.VIDSO_TRUSTED_CREATOR_FILES = [
    'trustedcreators1.png',
    'trustedcreators2.png',
    'trustedcreators3.png',
    'trustedcreators4.png',
    'trustedcreators5.png'
  ];

  /** Apply R2 logo URL to every <img data-vidso-logo> currently in the DOM. */
  global.applyVidsoLogos = function applyVidsoLogos() {
    var imgs = document.querySelectorAll('img[data-vidso-logo]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      img.src = global.VIDSO_LOGO_URL;
      if (!img.getAttribute('alt')) img.setAttribute('alt', 'Vidso');
    }
  };

  if (typeof document !== 'undefined') {
    ensureVidsoSocialStyles();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        global.applyVidsoLogos();
        global.applyVidsoSupportLinks();
        global.applyVidsoSocialLinks();
      });
    } else {
      global.applyVidsoLogos();
      global.applyVidsoSupportLinks();
      global.applyVidsoSocialLinks();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
