/** Tools overview gallery. `image` is an R2 URL; empty falls back to a tinted icon block.
 * Same public bucket as the Thumbnail Generator empty state. This app is static HTML,
 * so images load via <img src> — there is no Next.js `images.remotePatterns`.
 */
export const TOOL_SHOT_R2_HOST = 'pub-f40c956471ff49feab622906892ec527.r2.dev'

const ICO = {
  imagegen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  videogen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 19V5h12l4 4v10H4z"/><path d="M16 5v4h4"/><path d="M8 13h8M8 17h5"/></svg>',
  ytvideogen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 001.94-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>',
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
  { id: 'imagegen', name: 'Thumbnail Generator', description: 'Prompt to a YouTube thumbnail', href: '/image-generation', group: 'generate', image: '', icon: ICO.imagegen },
  { id: 'videogen', name: 'Long Form Generator', description: 'Script, voice, B-roll, and captions', href: '/video-generation', group: 'generate', image: '', icon: ICO.videogen },
  { id: 'ytvideogen', name: 'YouTube Generator', description: 'Beta: real YouTube clips for each script section', href: '/youtube-generation', group: 'generate', image: '', icon: ICO.ytvideogen },
  { id: 'clipper', name: 'Clipping', description: 'Viral moments from any link', href: '/clipping', group: 'generate', image: '', icon: ICO.clipper },
  { id: 'ranking', name: 'Ranking', description: 'Assemble ranked short videos', href: '/ranking', group: 'generate', image: '', icon: ICO.ranking },
  { id: 'captions', name: 'AI Captions', description: 'Auto-transcribe any video', href: '/captions', group: 'create', image: '', icon: ICO.captions },
  { id: 'voiceover', name: 'AI Voiceover', description: 'Studio-quality narration from a script', href: '/voiceover', group: 'create', image: '', icon: ICO.voiceover },
  { id: 'reframe', name: 'AI Reframe', description: 'Auto-fit landscape footage to 9:16', href: '/reframe', group: 'create', image: '', icon: ICO.reframe },
  { id: 'editor', name: 'Video Editor', description: 'Multi-track timeline', href: '/editor', group: 'edit', image: '', icon: ICO.editor },
  { id: 'downloader', name: 'Video Downloader', description: 'Download from any platform', href: '/downloader', group: 'edit', image: '', icon: ICO.downloader },
  { id: 'commentary', name: 'Video Commentary', description: 'Voice and captions on clips', href: '/commentary', group: 'edit', image: '', icon: ICO.commentary },
  { id: 'files', name: 'My Files', description: 'Uploads and exports', href: '/files', group: 'manage', image: '', icon: ICO.files },
]

const GROUPS = [
  { id: 'generate', label: 'Generate' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'manage', label: 'Manage' },
]

const SIZES = '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(50vw - 28px), 400px'

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
    <span class="tool-shot-name">${tool.name}</span>
    <span class="tool-shot-desc">${tool.description}</span>
  </a>`
}

export function initToolsGallery() {
  const root = document.getElementById('tools-gallery')
  if (!root) return
  root.innerHTML = GROUPS.map((g) => {
    const items = TOOL_GALLERY.filter((t) => t.group === g.id)
    if (!items.length) return ''
    return `<section class="tools-group" id="tools-group-${g.id}">
      <div class="section-label">${g.label}</div>
      <div class="tools-grid">${items.map(cardHtml).join('')}</div>
    </section>`
  }).join('')
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
