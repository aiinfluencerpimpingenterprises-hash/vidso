/* Shared Vidso brand assets (Cloudflare R2). Loaded as a classic script: sets globals. */
(function (global) {
  var R2_BASE = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev';

  global.VIDSO_R2_BASE = R2_BASE;
  global.VIDSO_LOGO_URL = R2_BASE + '/vidso-logo.png';
  global.VIDSO_SUPPORT_EMAIL = 'support@vidso.pro';

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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        global.applyVidsoLogos();
        global.applyVidsoSupportLinks();
      });
    } else {
      global.applyVidsoLogos();
      global.applyVidsoSupportLinks();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
