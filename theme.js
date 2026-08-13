/* Vidso light/dark theme — data-theme on <html>, persisted in localStorage.
   Default: dark. Include /theme-boot.js inline in <head> to avoid FOUC, or call
   VidsoTheme.apply() early. This file wires toggle buttons. */
(function () {
  var KEY = 'vidso-theme';

  function normalize(t) {
    return t === 'light' ? 'light' : 'dark';
  }

  function stored() {
    try {
      return normalize(localStorage.getItem(KEY));
    } catch (e) {
      return 'dark';
    }
  }

  function apply(theme, persist) {
    theme = normalize(theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (persist !== false) {
      try {
        localStorage.setItem(KEY, theme);
      } catch (e) {}
    }
    syncButtons(theme);
    try {
      window.dispatchEvent(new CustomEvent('vidso:theme', { detail: { theme: theme } }));
    } catch (e) {}
  }

  function syncButtons(theme) {
    var next = theme === 'light' ? 'dark' : 'light';
    var label = next === 'light' ? 'Switch to light theme' : 'Switch to dark theme';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    });
  }

  function toggle() {
    var cur = document.documentElement.getAttribute('data-theme') || stored();
    apply(cur === 'light' ? 'dark' : 'light', true);
  }

  // Ensure attribute exists even if boot script missing
  if (!document.documentElement.getAttribute('data-theme')) {
    apply(stored(), false);
  } else {
    syncButtons(normalize(document.documentElement.getAttribute('data-theme')));
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {
    syncButtons(normalize(document.documentElement.getAttribute('data-theme') || stored()));
    document.addEventListener(
      'click',
      function (e) {
        var btn = e.target.closest('[data-theme-toggle]');
        if (!btn) return;
        e.preventDefault();
        toggle();
      },
      false
    );
  });

  window.VidsoTheme = { apply: apply, toggle: toggle, get: function () {
    return normalize(document.documentElement.getAttribute('data-theme') || stored());
  } };
})();
