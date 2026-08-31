/** Tools overview gallery. `image` is an R2 URL; empty falls back to a tinted icon block.
 * Same public bucket as the Thumbnail Generator empty state. This app is static HTML,
 * so images load via <img src> — there is no Next.js `images.remotePatterns`.
 */
import { panelArchived, panelHiddenFromChrome } from './app-chrome.js'

export const TOOL_SHOT_R2_HOST = 'pub-f40c956471ff49feab622906892ec527.r2.dev'
const R2 = 'https://' + TOOL_SHOT_R2_HOST + '/'

const ICO = {
  imagegen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  videogen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 19V5h12l4 4v10H4z"/><path d="M16 5v4h4"/><path d="M8 13h8M8 17h5"/></svg>',
  ytvideogen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.4 19.54C5.12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 001.94-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>',
  clipper: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  ranking: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 01-10 0V4z"/></svg>',
  captions: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h14"/></svg>',
  voiceover: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  reframe: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/></svg>',
  editor: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h14"/><circle cx="18" cy="12" r="2"/></svg>',
  downloader: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  commentary: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  files: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
}

export const TOOL_GALLERY = [
  { id: 'videogen', name: 'Long Form Generator', description: 'Script, voice, B-roll, and captions', href: '/video-generation', group: 'generate', topics: ['video', 'scripts'], image: R2 + 'Media.png', icon: ICO.videogen },
  { id: 'imagegen', name: 'Thumbnail Generator', description: 'Prompt to a YouTube thumbnail', href: '/image-generation', group: 'generate', topics: ['images'], image: R2 + 'thumbnail.png', icon: ICO.imagegen },
  { id: 'facelessstudio', name: 'Faceless Studio', description: 'Prompt to a faceless explainer video', href: '/faceless-studio', group: 'generate', topics: ['video'], image: R2 + 'Export.png', icon: ICO.videogen },
  { id: 'clipper', name: 'Clipping', description: 'Viral moments from any link', href: '/clipping', group: 'generate', topics: ['shorts'], image: R2 + 'proof1.png', icon: ICO.clipper },
  { id: 'ranking', name: 'Ranking', description: 'Assemble ranked short videos', href: '/ranking', group: 'generate', topics: ['shorts'], image: R2 + 'proof2.png', icon: ICO.ranking },
  { id: 'captions', name: 'AI Captions', description: 'Auto-transcribe any video', href: '/captions', group: 'create', topics: ['shorts', 'utilities'], image: R2 + 'Script.png', icon: ICO.captions },
  { id: 'voiceover', name: 'AI Voiceover', description: 'Studio-quality narration from a script', href: '/voiceover', group: 'create', topics: ['audio'], image: R2 + 'proof4.png', icon: ICO.voiceover },
  { id: 'reframe', name: 'AI Reframe', description: 'Auto-fit landscape footage to 9:16', href: '/reframe', group: 'create', topics: ['video', 'shorts'], image: R2 + 'thumbnail1.png', icon: ICO.reframe },
  { id: 'editor', name: 'Video Editor', description: 'Multi-track timeline', href: '/editor', group: 'edit', topics: ['video'], image: R2 + 'Export.png', icon: ICO.editor },
  { id: 'downloader', name: 'Video Downloader', description: 'Download from any platform', href: '/downloader', group: 'edit', topics: ['utilities'], image: R2 + 'proof5.png', icon: ICO.downloader },
  { id: 'commentary', name: 'Video Commentary', description: 'Voice and captions on clips', href: '/commentary', group: 'edit', topics: ['video', 'audio'], image: R2 + 'thumbnail2.png', icon: ICO.commentary },
  { id: 'files', name: 'My Files', description: 'Your generated videos and thumbnails', href: '/files', group: 'manage', topics: ['utilities'], image: R2 + 'thumbnail3.png', icon: ICO.files },
]

export const CREATIVE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'images', label: 'Images' },
  { id: 'audio', label: 'Audio & Voice' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'shorts', label: 'Shorts & Reels' },
  { id: 'scripts', label: 'Scripts & Copy' },
]

const GROUPS = [
  { id: 'generate', label: 'Generate' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'manage', label: 'Manage' },
]

const SIZES = '(max-width: 640px) 78vw, 280px'

export function liveTools() {
  return TOOL_GALLERY.filter((t) => !panelArchived(t.id) && !panelHiddenFromChrome(t.id))
}

export function toolsForFilter(filterId) {
  const key = String(filterId || 'all')
  const rows = liveTools()
  if (!key || key === 'all') return rows
  return rows.filter((t) => (t.topics || []).includes(key))
}

function cardHtml(tool) {
  const src = String(tool.image || '').trim()
  const img = src
    ? `<img class="tool-shot-img" src="${src}" alt="${tool.name}" width="640" height="360" loading="lazy" decoding="async" sizes="${SIZES}">`
    : ''
  return `<a class="tool-shot" href="${tool.href}" data-go="${tool.id}">
    <div class="tool-shot-media">
      <div class="tool-shot-ph" aria-hidden="true">${tool.icon}</div>
      ${img}
    </div>
    <span class="tool-shot-name">${tool.name} <span class="tool-shot-chevron" aria-hidden="true">›</span></span>
    <span class="tool-shot-desc">${tool.description}</span>
  </a>`
}

function bindGallery(root) {
  root.querySelectorAll('.tool-shot-img').forEach((img) => {
    img.addEventListener('error', () => img.remove())
  })
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-go]')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    window.switchPanel?.(a.getAttribute('data-go'), null)
  })
}

function mountRail(root) {
  const uid = root.id || 'creative-tools'
  root.classList.add('creative-tools')
  root.innerHTML = `
    <div class="creative-tools-bar">
      <h3 class="creative-tools-title">Creative tools</h3>
      <div class="creative-tools-filters" role="tablist" aria-label="Filter tools">
        ${CREATIVE_FILTERS.map((f, i) => `<button type="button" class="creative-filter${i === 0 ? ' is-on' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      <div class="creative-tools-arrows">
        <button type="button" class="creative-arrow" data-dir="-1" aria-label="Previous tools">‹</button>
        <button type="button" class="creative-arrow" data-dir="1" aria-label="Next tools">›</button>
      </div>
    </div>
    <div class="creative-tools-scroller" id="${uid}-scroller">${toolsForFilter('all').map(cardHtml).join('')}</div>`
  const scroller = root.querySelector('.creative-tools-scroller')
  const paint = (filterId) => {
    scroller.innerHTML = toolsForFilter(filterId).map(cardHtml).join('')
    scroller.querySelectorAll('.tool-shot-img').forEach((img) => {
      img.addEventListener('error', () => img.remove())
    })
    scroller.scrollLeft = 0
  }
  root.querySelectorAll('.creative-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.creative-filter').forEach((b) => {
        const on = b === btn
        b.classList.toggle('is-on', on)
        b.setAttribute('aria-selected', on ? 'true' : 'false')
      })
      paint(btn.getAttribute('data-filter'))
    })
  })
  root.querySelectorAll('.creative-arrow').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.getAttribute('data-dir')) || 1
      scroller.scrollBy({ left: dir * Math.min(320, scroller.clientWidth * 0.8), behavior: 'smooth' })
    })
  })
  bindGallery(root)
}

function mountGroups(root) {
  root.innerHTML = GROUPS.map((g) => {
    const items = liveTools().filter((t) => t.group === g.id)
    if (!items.length) return ''
    return `<section class="tools-group" id="tools-group-${g.id}">
      <div class="section-label">${g.label}</div>
      <div class="tools-grid">${items.map(cardHtml).join('')}</div>
    </section>`
  }).join('')
  bindGallery(root)
}

export function initToolsGallery() {
  document.querySelectorAll('[data-creative-tools]').forEach((el) => mountRail(el))
  const grouped = document.getElementById('tools-gallery')
  if (grouped && !grouped.hasAttribute('data-creative-tools')) mountGroups(grouped)
}
