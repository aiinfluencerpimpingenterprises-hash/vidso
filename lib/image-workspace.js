import {
  DEFAULT_IMAGE_ASPECT,
  DEFAULT_IMAGE_QUALITY,
  IMAGE_ASPECTS,
  IMAGE_QUALITIES,
  IMG_MAX_REF_BYTES,
  IMG_MAX_REFS,
  IMG_PAGE_SIZE,
  IMG_REF_PREFIX,
  IMG_EMPTY_SAMPLES,
  aspectCss,
  isHistorySidecarName,
} from '/lib/image-gen.js'
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS, imageModelById } from '/lib/fal-image.js'

const IMG_MODEL_KEY = 'vidso_img_model'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function uid() {
  return 'p-' + Math.random().toString(36).slice(2, 10)
}

export function initImageWorkspace(deps) {
  const {
    api,
    getUser,
    openPaywall,
    loadUsage,
    loadFiles,
    resolveAccess,
  } = deps

  let items = []
  let filter = 'all'
  let offset = 0
  let hasMore = false
  let loadingList = false
  let selectedId = null
  let refs = []
  let count = 1
  let aspect = DEFAULT_IMAGE_ASPECT
  let quality = DEFAULT_IMAGE_QUALITY
  let generating = false
  let detailPrevFocus = null
  let loadGen = 0
  let listReady = false

  const $ = (id) => document.getElementById(id)

  function currentModel() {
    return imageModelById($('img-model')?.value || DEFAULT_IMAGE_MODEL)
  }

  function can4k() {
    try {
      const access = resolveAccess(getUser())
      return !!(access?.entitlements?.image_4k)
    } catch (_) { return false }
  }

  function promptValue() {
    return String($('img-prompt')?.value || '').trim()
  }

  function syncGenerateEnabled() {
    const btn = $('img-btn')
    if (!btn) return
    btn.disabled = generating || !promptValue()
  }

  function closePopovers(except) {
    ;['img-aspect-wrap', 'img-quality-wrap', 'img-model-wrap'].forEach((id) => {
      if (except && id === except) return
      const el = $(id)
      if (!el) return
      el.classList.remove('is-open')
      el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false')
    })
    document.querySelectorAll('.img-more.is-open, .img-detail-overflow.is-open').forEach((el) => {
      if (except && el === except) return
      el.classList.remove('is-open')
    })
  }

  window.closeImgModelMenu = () => {
    const wrap = $('img-model-wrap')
    const btn = $('img-model-btn')
    if (!wrap) return
    wrap.classList.remove('is-open')
    if (btn) btn.setAttribute('aria-expanded', 'false')
  }

  window.toggleImgModelMenu = () => {
    const wrap = $('img-model-wrap')
    const btn = $('img-model-btn')
    if (!wrap) return
    const open = !wrap.classList.contains('is-open')
    closePopovers(open ? 'img-model-wrap' : null)
    wrap.classList.toggle('is-open', open)
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  window.setImgModel = (id) => {
    const model = imageModelById(id)
    const input = $('img-model')
    const name = $('img-model-name')
    if (input) input.value = model.id
    if (name) name.textContent = model.name
    document.querySelectorAll('#img-model-menu .img-model-opt').forEach((el) => {
      el.classList.toggle('is-on', el.dataset.id === model.id)
    })
    try { localStorage.setItem(IMG_MODEL_KEY, model.id) } catch (_) {}
    window.closeImgModelMenu()
    syncRefButton()
  }

  function renderImgModelMenu() {
    const menu = $('img-model-menu')
    if (!menu) return
    let last = ''
    menu.innerHTML = IMAGE_MODELS.map((m) => {
      const head = m.group !== last ? `<div class="img-model-group">${esc(m.group)}</div>` : ''
      last = m.group
      return `${head}<button type="button" class="img-model-opt" role="option" data-id="${esc(m.id)}" onclick="setImgModel('${esc(m.id)}')"><span><b>${esc(m.name)}</b><span>${esc(m.hint)}</span></span></button>`
    }).join('')
  }

  function initImgModelPicker() {
    renderImgModelMenu()
    let saved = ''
    try { saved = localStorage.getItem(IMG_MODEL_KEY) || '' } catch (_) {}
    window.setImgModel(IMAGE_MODELS.some((m) => m.id === saved) ? saved : DEFAULT_IMAGE_MODEL)
  }

  window.fillImgPrompt = (text) => {
    const el = $('img-prompt')
    if (!el) return
    el.value = text
    el.focus()
    autosizePrompt()
    syncGenerateEnabled()
  }

  function autosizePrompt() {
    const el = $('img-prompt')
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 88) + 'px'
  }

  function syncRefButton() {
    const btn = $('img-ref-btn')
    if (!btn) return
    const ok = !!currentModel().imageInput
    btn.disabled = !ok || refs.length >= IMG_MAX_REFS
    btn.title = ok
      ? (refs.length >= IMG_MAX_REFS ? 'You can add up to ' + IMG_MAX_REFS + ' reference images.' : 'Add a reference image')
      : 'This model is text only. Switch to a model that accepts a reference image.'
    btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false')
  }

  function renderRefs() {
    const row = $('img-refs')
    if (!row) return
    row.hidden = !refs.length
    row.innerHTML = refs.map((r) => `
      <button type="button" class="img-ref-thumb" data-ref="${esc(r.id)}" aria-label="Remove reference">
        <img src="${esc(r.preview)}" alt="">
        <span aria-hidden="true">×</span>
      </button>`).join('')
    syncRefButton()
  }

  function addRefFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((f) => /^image\//.test(f.type || ''))
    for (const file of incoming) {
      if (refs.length >= IMG_MAX_REFS) break
      if (file.size > IMG_MAX_REF_BYTES) {
        setBarError('Each reference image must be under 8 MB.')
        continue
      }
      const id = uid()
      const preview = URL.createObjectURL(file)
      refs.push({ id, file, preview, name: file.name })
    }
    renderRefs()
  }

  function removeRef(id) {
    const hit = refs.find((r) => r.id === id)
    if (hit?.preview?.startsWith('blob:')) try { URL.revokeObjectURL(hit.preview) } catch (_) {}
    refs = refs.filter((r) => r.id !== id)
    renderRefs()
  }

  function uploadedFileUrl(data) {
    return data?.url || data?.file?.url || data?.upload?.url || data?.public_url || ''
  }

  async function refToUrl(r) {
    if (r.url && /^https?:/i.test(r.url) && !r.file) return r.url
    if (r.file && api.upload?.file) {
      try {
        const named = new File([r.file], IMG_REF_PREFIX + r.id + '.jpg', { type: r.file.type || 'image/jpeg' })
        const fd = new FormData()
        fd.append('file', named)
        const rec = await api.upload.file(fd)
        const url = uploadedFileUrl(rec)
        if (url) {
          r.url = url
          return url
        }
      } catch (_) {}
    }
    if (r.file) return fileToDataUri(r.file)
    return r.url || ''
  }

  async function fileToDataUri(file) {
    const bitmap = await createImageBitmap(file)
    const max = 1280
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', 0.84)
  }

  function setBarError(msg) {
    const el = $('img-bar-error')
    if (!el) return
    el.hidden = !msg
    el.textContent = msg || ''
  }

  function renderAspectMenu() {
    const menu = $('img-aspect-menu')
    if (!menu) return
    menu.innerHTML = `<p class="img-pop-label" id="img-aspect-label">Aspect ratio</p>` + IMAGE_ASPECTS.map((a) => {
      const glyph = a.id === 'auto'
        ? '<span class="img-ratio-glyph g-auto"></span>'
        : `<span class="img-ratio-glyph" style="width:${6 + Math.round(10 * (a.w / Math.max(a.w, a.h)))}px;height:${6 + Math.round(10 * (a.h / Math.max(a.w, a.h)))}px"></span>`
      return `<button type="button" class="img-pop-opt${aspect === a.id ? ' is-on' : ''}" role="option" data-aspect="${a.id}">${glyph}<span>${a.label}</span>${aspect === a.id ? '<span class="img-pop-check" aria-hidden="true">✓</span>' : ''}</button>`
    }).join('')
    const chip = $('img-aspect-btn')
    if (chip) {
      const cur = IMAGE_ASPECTS.find((a) => a.id === aspect)
      $('img-aspect-val').textContent = cur?.label || aspect
    }
  }

  function renderQualityMenu() {
    const menu = $('img-quality-menu')
    if (!menu) return
    const studio = can4k()
    menu.innerHTML = `<p class="img-pop-label" id="img-quality-label">Select quality</p>` + IMAGE_QUALITIES.map((q) => {
      const locked = q === '4K' && !studio
      return `<button type="button" class="img-pop-opt${quality === q ? ' is-on' : ''}${locked ? ' is-locked' : ''}" role="option" data-quality="${q}">
        <span>${q}</span>
        ${q === '4K' ? '<span class="img-pop-badge">Studio</span>' : ''}
        ${quality === q ? '<span class="img-pop-check" aria-hidden="true">✓</span>' : ''}
      </button>`
    }).join('')
    const val = $('img-quality-val')
    if (val) val.textContent = quality
  }

  function syncCount() {
    const label = $('img-count-label')
    if (label) label.textContent = count + '/4'
    const minus = $('img-count-minus')
    const plus = $('img-count-plus')
    if (minus) minus.disabled = count <= 1
    if (plus) plus.disabled = count >= 4
  }

  window.stepImgCount = (delta) => {
    count = Math.max(1, Math.min(4, count + delta))
    const sel = $('img-count')
    if (sel) sel.value = String(count)
    syncCount()
  }

  window.setImgRatio = (ratio) => {
    aspect = IMAGE_ASPECTS.some((a) => a.id === ratio) ? ratio : DEFAULT_IMAGE_ASPECT
    const sel = $('img-ratio')
    if (sel) sel.value = aspect
    renderAspectMenu()
    closePopovers()
  }

  window.onImgPromptKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateImage()
    }
  }

  function visibleItems() {
    if (filter === 'favs') return items.filter((it) => it.favorited || it.pending)
    return items
  }

  function fillEmptyFan() {
    const cards = document.querySelectorAll('#img-empty-fan .img-empty-card')
    IMG_EMPTY_SAMPLES.forEach((url, i) => {
      const card = cards[i]
      if (!card) return
      const src = String(url || '').trim()
      card.replaceChildren()
      if (!src) return
      const img = document.createElement('img')
      img.src = src
      img.alt = ''
      img.width = 384
      img.height = 216
      img.sizes = '(max-width: 380px) 185px, 182px'
      img.loading = 'lazy'
      img.decoding = 'async'
      img.setAttribute('aria-hidden', 'true')
      img.addEventListener('error', () => img.remove())
      card.appendChild(img)
    })
  }

  function renderGrid() {
    const grid = $('img-grid')
    const empty = $('img-empty')
    const pane = $('img-results-pane')
    if (!grid) return
    const list = visibleItems()
    const hero = listReady && filter !== 'favs' && !items.length
    if (empty) empty.hidden = !hero
    if (pane) pane.classList.toggle('is-empty', hero)
    if (hero) {
      grid.innerHTML = ''
      return
    }
    grid.innerHTML = list.map((it) => {
      const ar = aspectCss(it.aspect_ratio)
      if (it.pending) {
        return `<div class="img-tile is-pending" style="--ar:${ar}" aria-busy="true">
          <div class="img-tile-skel"></div>
        </div>`
      }
      if (it.error) {
        return `<div class="img-tile is-error" style="--ar:${ar}">
          <div class="img-tile-fail">
            <p>${esc(it.error)}</p>
            <button type="button" class="img-retry" data-retry="${esc(it.localId || '')}">Retry</button>
          </div>
        </div>`
      }
      const src = it.storage_url || it.url || ''
      return `<div class="img-tile${it.favorited ? ' is-fav' : ''}" style="--ar:${ar}">
        <button type="button" class="img-tile-hit" data-open="${esc(it.id)}" aria-label="${esc(it.prompt || 'Generated thumbnail')}">
          <img src="${esc(src)}" alt="${esc(it.prompt || 'Generated thumbnail')}" loading="lazy">
        </button>
        <div class="img-tile-hover" aria-hidden="false">
          <button type="button" class="img-ico" data-fav="${esc(it.id)}" aria-label="${it.favorited ? 'Remove favorite' : 'Favorite'}" title="Favorite">${heartSvg(it.favorited)}</button>
          <button type="button" class="img-ico" data-dl="${esc(it.id)}" aria-label="Download" title="Download">${dlSvg()}</button>
          <button type="button" class="img-ico" data-copy="${esc(it.id)}" aria-label="Copy image" title="Copy">${copySvg()}</button>
          <div class="img-more">
            <button type="button" class="img-ico" data-more="${esc(it.id)}" aria-haspopup="true" aria-label="More" title="More">${moreSvg()}</button>
            <div class="img-more-menu" role="menu">
              <button type="button" role="menuitem" data-del="${esc(it.id)}">Delete</button>
            </div>
          </div>
        </div>
      </div>`
    }).join('')
  }

  function heartSvg(on) {
    return on
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 21s-6.5-4.35-9.33-8.18C.8 10.3 1.2 6.9 4.05 5.4 6.2 4.27 8.55 5 12 8.1c3.45-3.1 5.8-3.83 7.95-2.7 2.85 1.5 3.25 4.9 1.38 7.42C18.5 16.65 12 21 12 21z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 8.6c.4 2.4-.8 4.6-2.9 6.7L12 21l-5.9-5.7C4 13.2 2.8 11 .4 8.6 2.1 5.6 6 4.6 8.6 6.6 10 7.6 11 8.7 12 10c1-1.3 2-2.4 3.4-3.4 2.6-2 6.5-1 7.4 2z"/></svg>'
  }
  function dlSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>'
  }
  function copySvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>'
  }
  function moreSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>'
  }

  function findItem(id) {
    return items.find((it) => it.id === id || it.localId === id)
  }

  async function loadPage(reset) {
    if (loadingList) return
    loadingList = true
    const gen = ++loadGen
    if (reset) {
      offset = 0
      hasMore = false
    }
    try {
      const data = await api.generate.images({
        offset: reset ? 0 : offset,
        limit: IMG_PAGE_SIZE,
        favorites: filter === 'favs',
      })
      if (gen !== loadGen) return
      const next = Array.isArray(data.items) ? data.items : []
      if (reset) items = items.filter((it) => it.pending || it.error).concat(next)
      else {
        const seen = new Set(items.map((it) => it.id))
        items = items.concat(next.filter((it) => !seen.has(it.id)))
      }
      offset = (reset ? 0 : offset) + next.length
      hasMore = !!data.hasMore
      listReady = true
      renderGrid()
    } catch (_) {
      listReady = true
      if (reset && !items.length) renderGrid()
    } finally {
      loadingList = false
    }
  }

  async function toggleFav(id) {
    const it = findItem(id)
    if (!it || it.pending) return
    const next = !it.favorited
    it.favorited = next
    renderGrid()
    if (selectedId === id) renderDetail()
    try {
      const rec = await api.generate.imagePatch(id, { favorited: next })
      Object.assign(it, rec)
    } catch (_) {
      it.favorited = !next
    }
    renderGrid()
    if (selectedId === id) renderDetail()
  }

  async function downloadItem(id) {
    const it = findItem(id)
    const src = it?.storage_url || it?.url
    if (!src) return
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = (it.prompt || 'thumbnail').slice(0, 40).replace(/\s+/g, '-') + '.jpg'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (_) {
      window.open(src, '_blank', 'noopener')
    }
  }

  async function copyItem(id) {
    const it = findItem(id)
    const src = it?.storage_url || it?.url
    if (!src) return
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
    } catch (_) {
      try { await navigator.clipboard.writeText(src) } catch (__) {}
    }
  }

  async function shareItem(id) {
    const it = findItem(id)
    const src = it?.storage_url || it?.url
    if (!src) return
    try { await navigator.clipboard.writeText(src) } catch (_) {}
  }

  async function deleteItem(id) {
    const it = findItem(id)
    if (!it || it.pending) return
    try {
      await api.generate.imageDelete(id)
      items = items.filter((x) => x.id !== id)
      if (selectedId === id) closeDetail()
      renderGrid()
      loadFiles?.()
    } catch (e) {
      setBarError(e.message || 'Could not delete this thumbnail.')
    }
  }

  function openDetail(id) {
    const it = findItem(id)
    if (!it || it.pending || it.error) return
    selectedId = id
    detailPrevFocus = document.activeElement
    renderDetail()
    const root = $('img-detail')
    if (!root) return
    root.classList.remove('hidden')
    root.setAttribute('aria-hidden', 'false')
    $('img-detail-close')?.focus()
  }

  function closeDetail() {
    const root = $('img-detail')
    if (!root) return
    root.classList.add('hidden')
    root.setAttribute('aria-hidden', 'true')
    selectedId = null
    if (detailPrevFocus && typeof detailPrevFocus.focus === 'function') {
      try { detailPrevFocus.focus() } catch (_) {}
    }
    detailPrevFocus = null
  }

  function renderDetail() {
    const it = findItem(selectedId)
    const root = $('img-detail')
    if (!it || !root) return
    const src = it.storage_url || it.url || ''
    const img = $('img-detail-img')
    if (img) {
      img.src = src
      img.alt = it.prompt || 'Generated thumbnail'
    }
    const promptEl = $('img-detail-prompt')
    if (promptEl) promptEl.textContent = it.prompt || ''
    const refsEl = $('img-detail-refs')
    const refs = Array.isArray(it.reference_images) ? it.reference_images : []
    if (refsEl) {
      refsEl.hidden = !refs.length
      refsEl.innerHTML = refs.map((r) => {
        const url = typeof r === 'string' ? r : (r.url || r.preview || '')
        return url ? `<img src="${esc(url)}" alt="">` : ''
      }).join('')
    }
    const model = imageModelById(it.model)
    $('img-detail-model').textContent = model?.name || it.model || '—'
    $('img-detail-quality').textContent = it.quality || '—'
    $('img-detail-size').textContent = (it.width && it.height) ? `${it.width}×${it.height}` : (it.aspect_ratio || '—')
    $('img-detail-created').textContent = it.created_at ? new Date(it.created_at).toLocaleString() : '—'
    const fav = $('img-detail-fav')
    if (fav) {
      fav.classList.toggle('is-on', !!it.favorited)
      fav.setAttribute('aria-pressed', it.favorited ? 'true' : 'false')
      fav.innerHTML = heartSvg(it.favorited)
    }
  }

  function moveDetail(dir) {
    const list = visibleItems().filter((it) => !it.pending && !it.error)
    const i = list.findIndex((it) => it.id === selectedId)
    if (i < 0) return
    const next = list[i + dir]
    if (!next) return
    selectedId = next.id
    renderDetail()
  }

  function trapDetailFocus(e) {
    if (e.key !== 'Tab') return
    const root = $('img-detail')
    if (!root || root.classList.contains('hidden')) return
    const focusable = [...root.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function useAsReference(it) {
    if (refs.length >= IMG_MAX_REFS) {
      setBarError('You can add up to ' + IMG_MAX_REFS + ' reference images.')
      return
    }
    const src = it.storage_url || it.url
    if (!src) return
    refs.push({ id: uid(), preview: src, url: src, name: 'reference' })
    renderRefs()
    closeDetail()
  }

  async function recreate(it) {
    if (it.model) window.setImgModel(it.model)
    if (it.aspect_ratio) window.setImgRatio(it.aspect_ratio)
    if (it.quality && IMAGE_QUALITIES.includes(it.quality)) {
      if (it.quality === '4K' && !can4k()) {
        openPaywall?.({ force: true, reason: 'upgrade' })
        return
      }
      quality = it.quality
      renderQualityMenu()
    }
    window.fillImgPrompt(it.prompt || '')
    if (Array.isArray(it.reference_images) && it.reference_images.length) {
      refs = it.reference_images.slice(0, IMG_MAX_REFS).map((r) => {
        const url = typeof r === 'string' ? r : (r.url || r.preview)
        return { id: uid(), preview: url, url, name: 'reference' }
      })
      renderRefs()
    }
    closeDetail()
    await generateImage()
  }

  async function generateImage() {
    const prompt = promptValue()
    if (!prompt || generating) return
    if (quality === '4K' && !can4k()) {
      openPaywall?.({ force: true, reason: 'upgrade' })
      return
    }
    setBarError('')
    generating = true
    syncGenerateEnabled()
    const btn = $('img-btn')
    btn?.classList.add('is-loading')
    const model = currentModel()
    let imageUrls = []
    try {
      if (refs.length && !model.imageInput) {
        throw new Error('This model is text only. Pick a model that accepts a reference image.')
      }
      imageUrls = await Promise.all(refs.map((r) => refToUrl(r)))
    } catch (e) {
      generating = false
      btn?.classList.remove('is-loading')
      syncGenerateEnabled()
      setBarError(e.message || 'Could not read the reference image.')
      return
    }

    const batch = []
    for (let i = 0; i < count; i++) {
      const localId = uid()
      const placeholder = { id: localId, localId, pending: true, aspect_ratio: aspect, batch_index: i, prompt, model: model.id, quality }
      batch.push(placeholder)
      items.unshift(placeholder)
    }
    listReady = true
    renderGrid()

    const bodyBase = {
      prompt,
      model: model.id,
      aspect_ratio: aspect,
      quality,
      resolution: quality,
      num_images: 1,
    }
    if (imageUrls.length) bodyBase.image_urls = imageUrls

    await Promise.all(batch.map(async (slot, i) => {
      try {
        const data = await api.generate.image(bodyBase)
        const url = data.urls?.[0]
        if (!url) throw new Error('No image came back.')
        let saved = null
        try {
          const pack = await api.generate.imageSave({
            url,
            prompt,
            model: model.id,
            aspect_ratio: aspect,
            quality,
            batch_index: i,
            width: data.width,
            height: data.height,
            reference_images: imageUrls,
          })
          saved = pack.items?.[0] || null
        } catch (_) {}
        const rec = saved || {
          id: slot.localId,
          storage_url: url,
          url,
          prompt,
          model: model.id,
          aspect_ratio: aspect,
          quality,
          batch_index: i,
          width: data.width,
          height: data.height,
          created_at: new Date().toISOString(),
          favorited: false,
          reference_images: imageUrls,
        }
        const idx = items.findIndex((it) => it.localId === slot.localId)
        if (idx >= 0) items[idx] = rec
      } catch (e) {
        if ((e.status === 403 || e.needsUpgrade) && !window._imgPaywallOnce) {
          window._imgPaywallOnce = true
          openPaywall?.({ force: true, reason: 'upgrade' })
          setTimeout(() => { window._imgPaywallOnce = false }, 800)
        }
        const idx = items.findIndex((it) => it.localId === slot.localId)
        if (idx >= 0) {
          items[idx] = {
            ...slot,
            pending: false,
            error: e.message || 'This image failed.',
            retryBody: bodyBase,
          }
        }
      }
    }))

    generating = false
    btn?.classList.remove('is-loading')
    syncGenerateEnabled()
    renderGrid()
    loadUsage?.()
    loadFiles?.()
  }

  async function retrySlot(localId) {
    const slot = findItem(localId)
    if (!slot?.retryBody) return
    slot.pending = true
    slot.error = ''
    renderGrid()
    try {
      const data = await api.generate.image(slot.retryBody)
      const url = data.urls?.[0]
      if (!url) throw new Error('No image came back.')
      let saved = null
      try {
        const pack = await api.generate.imageSave({
          url,
          prompt: slot.retryBody.prompt,
          model: slot.retryBody.model,
          aspect_ratio: slot.retryBody.aspect_ratio,
          quality: slot.retryBody.quality,
          batch_index: slot.batch_index || 0,
          width: data.width,
          height: data.height,
          reference_images: slot.retryBody.image_urls || [],
        })
        saved = pack.items?.[0] || null
      } catch (_) {}
      const idx = items.findIndex((it) => it.localId === localId)
      if (idx >= 0) {
        items[idx] = saved || {
          id: localId,
          storage_url: url,
          url,
          prompt: slot.retryBody.prompt,
          model: slot.retryBody.model,
          aspect_ratio: slot.retryBody.aspect_ratio,
          quality: slot.retryBody.quality,
          created_at: new Date().toISOString(),
        }
      }
    } catch (e) {
      slot.pending = false
      slot.error = e.message || 'This image failed.'
    }
    renderGrid()
    loadUsage?.()
    loadFiles?.()
  }

  window.generateImage = generateImage

  window.imgWorkspaceShow = () => {
    renderAspectMenu()
    renderQualityMenu()
    syncCount()
    syncRefButton()
    syncGenerateEnabled()
    if (!items.length) loadPage(true)
  }

  function onGridClick(e) {
    const retry = e.target.closest('[data-retry]')
    if (retry) { retrySlot(retry.getAttribute('data-retry')); return }
    const fav = e.target.closest('[data-fav]')
    if (fav) { e.preventDefault(); toggleFav(fav.getAttribute('data-fav')); return }
    const dl = e.target.closest('[data-dl]')
    if (dl) { e.preventDefault(); downloadItem(dl.getAttribute('data-dl')); return }
    const copy = e.target.closest('[data-copy]')
    if (copy) { e.preventDefault(); copyItem(copy.getAttribute('data-copy')); return }
    const del = e.target.closest('[data-del]')
    if (del) { e.preventDefault(); deleteItem(del.getAttribute('data-del')); return }
    const more = e.target.closest('[data-more]')
    if (more) {
      e.preventDefault()
      const wrap = more.closest('.img-more')
      const open = !wrap.classList.contains('is-open')
      closePopovers()
      wrap.classList.toggle('is-open', open)
      return
    }
    const hit = e.target.closest('[data-open]')
    if (hit) openDetail(hit.getAttribute('data-open'))
  }

  function bind() {
    initImgModelPicker()
    renderAspectMenu()
    renderQualityMenu()
    syncCount()
    syncRefButton()
    fillEmptyFan()
    renderGrid()

    $('img-prompt')?.addEventListener('input', () => {
      autosizePrompt()
      syncGenerateEnabled()
    })
    $('img-ref-btn')?.addEventListener('click', () => {
      if ($('img-ref-btn').disabled) return
      $('img-ref-input')?.click()
    })
    $('img-ref-input')?.addEventListener('change', (e) => {
      addRefFiles(e.target.files)
      e.target.value = ''
    })
    $('img-refs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ref]')
      if (btn) removeRef(btn.getAttribute('data-ref'))
    })
    $('img-aspect-btn')?.addEventListener('click', () => {
      const wrap = $('img-aspect-wrap')
      const open = !wrap.classList.contains('is-open')
      closePopovers(open ? 'img-aspect-wrap' : null)
      wrap.classList.toggle('is-open', open)
      $('img-aspect-btn').setAttribute('aria-expanded', open ? 'true' : 'false')
      if (open) $('img-aspect-menu')?.querySelector('.img-pop-opt.is-on, .img-pop-opt')?.focus()
    })
    $('img-aspect-menu')?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-aspect]')
      if (opt) window.setImgRatio(opt.getAttribute('data-aspect'))
    })
    $('img-quality-btn')?.addEventListener('click', () => {
      renderQualityMenu()
      const wrap = $('img-quality-wrap')
      const open = !wrap.classList.contains('is-open')
      closePopovers(open ? 'img-quality-wrap' : null)
      wrap.classList.toggle('is-open', open)
      $('img-quality-btn').setAttribute('aria-expanded', open ? 'true' : 'false')
      if (open) $('img-quality-menu')?.querySelector('.img-pop-opt.is-on, .img-pop-opt')?.focus()
    })
    $('img-quality-menu')?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-quality]')
      if (!opt) return
      const q = opt.getAttribute('data-quality')
      if (q === '4K' && !can4k()) {
        closePopovers()
        openPaywall?.({ force: true, reason: 'upgrade' })
        return
      }
      quality = q
      renderQualityMenu()
      closePopovers()
    })
    $('img-filter-all')?.addEventListener('click', () => {
      filter = 'all'
      $('img-filter-all').classList.add('is-on')
      $('img-filter-favs').classList.remove('is-on')
      $('img-filter-all').setAttribute('aria-selected', 'true')
      $('img-filter-favs').setAttribute('aria-selected', 'false')
      loadPage(true)
    })
    $('img-filter-favs')?.addEventListener('click', () => {
      filter = 'favs'
      $('img-filter-favs').classList.add('is-on')
      $('img-filter-all').classList.remove('is-on')
      $('img-filter-favs').setAttribute('aria-selected', 'true')
      $('img-filter-all').setAttribute('aria-selected', 'false')
      loadPage(true)
    })
    $('img-grid')?.addEventListener('click', onGridClick)
    $('img-btn')?.addEventListener('click', (e) => {
      e.preventDefault()
      generateImage()
    })

    const bar = $('img-bar')
    bar?.addEventListener('dragover', (e) => { e.preventDefault(); bar.classList.add('is-drop') })
    bar?.addEventListener('dragleave', () => bar.classList.remove('is-drop'))
    bar?.addEventListener('drop', (e) => {
      e.preventDefault()
      bar.classList.remove('is-drop')
      if (currentModel().imageInput) addRefFiles(e.dataTransfer?.files)
    })

    $('img-detail-close')?.addEventListener('click', closeDetail)
    $('img-detail-copy')?.addEventListener('click', () => {
      const t = $('img-detail-prompt')?.textContent || ''
      navigator.clipboard.writeText(t).catch(() => {})
    })
    $('img-detail-dl')?.addEventListener('click', () => downloadItem(selectedId))
    $('img-detail-fav')?.addEventListener('click', () => toggleFav(selectedId))
    $('img-detail-share')?.addEventListener('click', () => shareItem(selectedId))
    $('img-detail-del')?.addEventListener('click', () => deleteItem(selectedId))
    $('img-detail-recreate')?.addEventListener('click', () => {
      const it = findItem(selectedId)
      if (it) recreate(it)
    })
    $('img-detail-ref')?.addEventListener('click', () => {
      const it = findItem(selectedId)
      if (it) useAsReference(it)
    })
    $('img-detail-more')?.addEventListener('click', () => {
      $('img-detail-overflow')?.classList.toggle('is-open')
    })

    document.addEventListener('paste', (e) => {
      const panel = $('panel-imagegen')
      if (!panel?.classList.contains('active')) return
      const files = [...(e.clipboardData?.files || [])]
      if (files.length && currentModel().imageInput) addRefFiles(files)
    })
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.img-pop, .img-model, .img-more, .img-detail-overflow')) closePopovers()
    })
    document.addEventListener('keydown', (e) => {
      const detail = $('img-detail')
      const detailOpen = detail && !detail.classList.contains('hidden')
      if (detailOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeDetail(); return }
        if (e.key === 'ArrowLeft') { e.preventDefault(); moveDetail(-1); return }
        if (e.key === 'ArrowRight') { e.preventDefault(); moveDetail(1); return }
        trapDetailFocus(e)
        return
      }
      const menu = e.target.closest('.img-pop-menu, #img-model-menu')
      if (menu && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const opts = [...menu.querySelectorAll('[role="option"]')]
        if (!opts.length) return
        e.preventDefault()
        const i = Math.max(0, opts.indexOf(document.activeElement))
        let next = i
        if (e.key === 'ArrowDown') next = (i + 1) % opts.length
        if (e.key === 'ArrowUp') next = (i - 1 + opts.length) % opts.length
        if (e.key === 'Home') next = 0
        if (e.key === 'End') next = opts.length - 1
        opts[next]?.focus()
        return
      }
      if (e.key === 'Escape') closePopovers()
    })

    const sentinel = $('img-sentinel')
    if (sentinel && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting) && hasMore && !loadingList) loadPage(false)
      }, { root: $('img-results-pane'), rootMargin: '200px' })
      io.observe(sentinel)
    }
  }

  bind()
  if ($('panel-imagegen')?.classList.contains('active')) window.imgWorkspaceShow()

  return {
    isHistorySidecarName,
    show: window.imgWorkspaceShow,
  }
}
