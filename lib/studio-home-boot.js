import { mountStudioHome, studioHomeGo } from '/lib/studio-home-mount.js'

function paint() {
  const main = document.getElementById('fs-main')
  if (!main) return
  if (main.dataset.fsMounted === 'full') return
  try {
    mountStudioHome(main)
  } catch (e) {
    try { console.warn('[studio-home]', e) } catch (_) {}
  }
}

window.__mountStudioHome = paint
window.__studioHomeGo = (view) => {
  if (window.fsStudioGo) {
    window.fsStudioGo(view)
    return
  }
  studioHomeGo(view)
}

paint()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', paint)
}
setTimeout(paint, 50)
setTimeout(paint, 400)
