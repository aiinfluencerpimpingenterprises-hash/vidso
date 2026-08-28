/** Long Form caption fonts for the generator dropdown + live preview. */

function cssName(name, fallback) {
  const quoted = /[\s\d]/.test(name) || name.includes('.') ? `'${name}'` : name
  return quoted + ', ' + fallback
}

function g(label, google, extra = {}) {
  const family = google || label
  return {
    label,
    css: extra.css || cssName(family, extra.fallback || 'sans-serif'),
    google: family,
    compact: extra.compact || /Press Start|Silkscreen|VT323/i.test(label),
    weight: extra.weight || 0,
  }
}

function sys(label, css, extra = {}) {
  return { label, css, google: '', compact: !!extra.compact, weight: extra.weight || 0 }
}

const FEATURED = [
  g('DM Mono', 'DM Mono', { fallback: 'monospace' }),
  sys('Arial', 'Arial, Helvetica, sans-serif'),
  sys('Arial Black', "'Arial Black', Arial, sans-serif", { weight: 900 }),
  g('DM Sans Black', 'DM Sans', { weight: 900 }),
  g('Inter', 'Inter'),
  sys('LEMON MILK BOLD', "'LEMON MILK BOLD', 'Lemon Milk', Impact, sans-serif", { weight: 800 }),
  sys('MADE Tommy', "'MADE Tommy', 'Arial Black', sans-serif"),
  sys('MADE Tommy Black', "'MADE Tommy Black', 'Arial Black', sans-serif", { weight: 900 }),
  sys('GEOMETOS', 'Geometos, Impact, sans-serif', { weight: 800 }),
  sys('HEAVITAS', 'Heavitas, Impact, sans-serif', { weight: 800 }),
  g('KOULEN', 'Koulen'),
  sys('Times New Roman', "'Times New Roman', Times, serif"),
  sys('Impact', 'Impact, Haettenschweiler, sans-serif', { weight: 800 }),
  g('Lilita One', 'Lilita One'),
  sys('Haettenschweiler', 'Haettenschweiler, Impact, sans-serif'),
  sys('INTEGRAL CF', "'Integral CF', Impact, sans-serif", { weight: 800 }),
  sys('Charles Wright Bold', "'Charles Wright Bold', 'Times New Roman', serif", { weight: 800 }),
  g('Anton', 'Anton', { css: 'Anton, Impact, sans-serif' }),
  g('Bangers', 'Bangers', { css: 'Bangers, cursive', fallback: 'cursive' }),
  g('Montserrat', 'Montserrat', { css: "'Montserrat', sans-serif" }),
  g('Baloo 2', 'Baloo 2', { css: "'Baloo 2', cursive", fallback: 'cursive' }),
  g('Luckiest Guy', 'Luckiest Guy', { css: "'Luckiest Guy', cursive", fallback: 'cursive' }),
  g('Permanent Marker', 'Permanent Marker', { css: "'Permanent Marker', cursive", fallback: 'cursive' }),
  sys('TikTok Sans', "'TikTok Sans 18pt', 'TikTok Sans', sans-serif"),
  g('Bebas Neue', 'Bebas Neue', { css: "'Bebas Neue', sans-serif" }),
  g('Oswald', 'Oswald', { css: "'Oswald', sans-serif" }),
  g('Press Start 2P', 'Press Start 2P', { css: "'Press Start 2P', monospace", fallback: 'monospace', compact: true }),
]

const WEB_SAFE = [
  sys('Helvetica', 'Helvetica, Arial, sans-serif'),
  sys('Georgia', 'Georgia, serif'),
  sys('Verdana', 'Verdana, Geneva, sans-serif'),
  sys('Tahoma', 'Tahoma, Geneva, sans-serif'),
  sys('Trebuchet MS', "'Trebuchet MS', Helvetica, sans-serif"),
  sys('Comic Sans MS', "'Comic Sans MS', 'Comic Sans', cursive"),
]

const SANS = [
  'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Source Sans 3', 'Source Sans Pro',
  'Ubuntu', 'Nunito', 'Raleway', 'PT Sans', 'Noto Sans', 'Work Sans', 'Quicksand',
  'Josefin Sans', 'Nunito Sans', 'Rubik', 'Karla', 'Cabin', 'Barlow', 'DM Sans',
  'Fira Sans', 'Mulish', 'Manrope', 'Outfit', 'Space Grotesk', 'Lexend', 'Sora',
  'Urbanist', 'Plus Jakarta Sans', 'Figtree', 'Kanit', 'Hind', 'Dosis',
  'Libre Franklin', 'Exo 2', 'Mukta', 'Titillium Web', 'Overpass', 'Archivo',
  'Signika', 'Asap', 'Albert Sans', 'Be Vietnam Pro', 'Commissioner', 'Jost',
  'Public Sans',
].map((n) => g(n, n))

const SERIF = [
  'Noto Serif', 'Merriweather', 'Playfair Display', 'Lora', 'PT Serif',
  'Libre Baskerville', 'Bitter', 'EB Garamond', 'Crimson Text', 'Cormorant Garamond',
  'Arvo', 'Vollkorn', 'Spectral', 'DM Serif Display', 'Crimson Pro', 'Alegreya',
  'Cardo', 'Gelasio', 'Literata',
].map((n) => g(n, n, { fallback: 'serif' }))

const DISPLAY = [
  ['Righteous', 'Righteous'],
  ['Fredoka', 'Fredoka'],
  ['Fredoka One', 'Fredoka'],
  ['VT323', 'VT323', { fallback: 'monospace', compact: true }],
  ['Orbitron', 'Orbitron'],
  ['Audiowide', 'Audiowide'],
  ['Russo One', 'Russo One'],
  ['Black Ops One', 'Black Ops One'],
  ['Creepster', 'Creepster', { fallback: 'cursive' }],
  ['Fascinate', 'Fascinate'],
  ['Fascinate Inline', 'Fascinate Inline'],
  ['Flavors', 'Flavors', { fallback: 'cursive' }],
  ['Monoton', 'Monoton'],
  ['Plaster', 'Plaster'],
  ['Stalinist One', 'Stalinist One'],
  ['UnifrakturMaguntia', 'UnifrakturMaguntia'],
  ['Wallpoet', 'Wallpoet'],
  ['Alfa Slab One', 'Alfa Slab One'],
  ['Bungee', 'Bungee'],
  ['Bungee Shade', 'Bungee Shade'],
  ['Rubik Mono One', 'Rubik Mono One'],
  ['Abril Fatface', 'Abril Fatface', { fallback: 'serif' }],
  ['Bowlby One SC', 'Bowlby One SC'],
  ['Bungee Inline', 'Bungee Inline'],
  ['Londrina Solid', 'Londrina Solid'],
  ['Secular One', 'Secular One'],
  ['Bungee Spice', 'Bungee Spice'],
  ['Silkscreen', 'Silkscreen', { compact: true }],
  ['Yeseva One', 'Yeseva One', { fallback: 'serif' }],
  ['Passion One', 'Passion One'],
  ['Concert One', 'Concert One'],
  ['Bree Serif', 'Bree Serif', { fallback: 'serif' }],
  ['Acme', 'Acme'],
  ['Fugaz One', 'Fugaz One'],
  ['Graduate', 'Graduate'],
  ['Bungee Hairline', 'Bungee Hairline'],
  ['Chewy', 'Chewy', { fallback: 'cursive' }],
  ['Shrikhand', 'Shrikhand'],
  ['Rampart One', 'Rampart One'],
  ['Bungee Outline', 'Bungee Outline'],
  ['Modak', 'Modak'],
  ['Titan One', 'Titan One'],
  ['Chango', 'Chango'],
  ['Rubik Glitch', 'Rubik Glitch'],
  ['Rubik Burned', 'Rubik Burned'],
].map(([label, google, extra]) => g(label, google, extra))

const HANDWRITING = [
  'Dancing Script', 'Pacifico', 'Great Vibes', 'Satisfy', 'Kaushan Script',
  'Lobster', 'Caveat', 'Indie Flower', 'Shadows Into Light', 'Architects Daughter',
  'Kalam', 'Patrick Hand', 'Rock Salt', 'Special Elite', 'Sacramento', 'Amatic SC',
  'Courgette', 'Cookie', 'Yellowtail', 'Handlee', 'Marck Script', 'Gloria Hallelujah',
  'Allura', 'Alex Brush', 'Bad Script', 'Covered By Your Grace', 'Reenie Beanie',
  'Tangerine', 'Nothing You Could Do', 'Homemade Apple', 'Cedarville Cursive',
  'Edu AU VIC WA NT Hand', 'Charm', 'Mrs Saint Delafield', 'Pinyon Script',
].map((n) => g(n, n, { fallback: 'cursive' }))

const MONO = [
  'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Roboto Mono', 'IBM Plex Mono',
  'Space Mono', 'Ubuntu Mono', 'Inconsolata', 'Anonymous Pro',
].map((n) => g(n, n, { fallback: 'monospace', compact: true }))

function dedupeGroups(groups) {
  const seen = new Set()
  return groups.map((group) => ({
    label: group.label,
    fonts: group.fonts.filter((font) => {
      const key = font.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  })).filter((group) => group.fonts.length)
}

export const FACELESS_CAPTION_FONT_GROUPS = dedupeGroups([
  { label: 'Featured', fonts: FEATURED },
  { label: 'Web safe', fonts: WEB_SAFE },
  { label: 'Sans', fonts: SANS },
  { label: 'Serif', fonts: SERIF },
  { label: 'Display', fonts: DISPLAY },
  { label: 'Handwriting', fonts: HANDWRITING },
  { label: 'Monospace', fonts: MONO },
])

export const DEFAULT_CAPTION_FONT_CSS = 'Bangers, cursive'

export function captionFontList() {
  return FACELESS_CAPTION_FONT_GROUPS.flatMap((g) => g.fonts)
}

export function captionGoogleFamilies() {
  return [...new Set(captionFontList().map((f) => f.google).filter(Boolean))]
}

export function googleFontsStylesheetHref(families) {
  const list = (families || []).filter(Boolean)
  if (!list.length) return ''
  return 'https://fonts.googleapis.com/css2?' + list.map((name) => (
    'family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;700;800;900'
  )).join('&') + '&display=swap'
}

const loadedHrefs = new Set()

export function ensureCaptionGoogleFonts() {
  if (typeof document === 'undefined') return
  const families = captionGoogleFamilies()
  const size = 18
  for (let i = 0; i < families.length; i += size) {
    const href = googleFontsStylesheetHref(families.slice(i, i + size))
    if (!href || loadedHrefs.has(href)) continue
    loadedHrefs.add(href)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }
}

export function fillCaptionFontSelect(sel) {
  if (!sel) return
  const prev = sel.value
  sel.innerHTML = ''
  for (const group of FACELESS_CAPTION_FONT_GROUPS) {
    const og = document.createElement('optgroup')
    og.label = group.label
    for (const font of group.fonts) {
      const opt = document.createElement('option')
      opt.value = font.css
      opt.textContent = font.label
      if (font.weight) opt.dataset.weight = String(font.weight)
      if (font.compact) opt.dataset.compact = '1'
      if (font.css === DEFAULT_CAPTION_FONT_CSS) opt.selected = true
      og.appendChild(opt)
    }
    sel.appendChild(og)
  }
  const values = [...sel.options].map((o) => o.value)
  if (prev && values.includes(prev)) sel.value = prev
  else sel.value = DEFAULT_CAPTION_FONT_CSS
}
