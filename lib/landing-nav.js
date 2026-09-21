/** Single marketing-nav config. Labels, descriptions, hrefs, and badges live here. */

import { APP_HOME_HREF, PRICING_HREF, TOOL_MENU_ITEMS } from './public-tools.js'
import {
  MODELS_HREF,
  MODELS_PROMO,
  MODEL_GROUPS,
  modelHref,
  modelsByGroup,
} from './vidso-models.js'
import { LANDING_R2 } from './landing-media.js'

export const NAV_OPEN_MS = 100
export const NAV_CLOSE_MS = 200

export const FEATURES_PROMO = LANDING_R2 + '/features-promo.jpg'
export const FEATURES_PROMO_COPY = {
  caption: 'See what Vidso can make',
  browse: 'View all',
  browseHref: '/home#formats',
}

export const MODELS_NAV_PROMO = {
  src: MODELS_PROMO,
  caption: 'Explore the models behind Vidso',
  browse: 'Browse all models',
  browseHref: MODELS_HREF,
}

function tool(id, extra = {}) {
  const item = TOOL_MENU_ITEMS[id]
  return {
    id,
    label: extra.label || item.name,
    description: extra.description || item.description,
    href: extra.href || (id === 'mcp' ? item.href : APP_HOME_HREF),
    badge: extra.badge || '',
  }
}

function modelItem(model) {
  return {
    id: model.id,
    label: model.name,
    description: model.blurb,
    href: modelHref(model.id),
    badge: '',
  }
}

/** Tools mega. Every href is a live route. Ranking extras stay gated and out of this list. */
export const TOOLS_COLUMNS = [
  { id: 'create', label: 'Create', items: [tool('videogen'), tool('imagegen')] },
  {
    id: 'short-form',
    label: 'Short form',
    items: [tool('clipper'), tool('ranking'), tool('reframe'), tool('commentary')],
  },
  { id: 'audio', label: 'Audio and captions', items: [tool('voiceover'), tool('captions')] },
  { id: 'edit', label: 'Edit', items: [tool('editor'), tool('downloader')] },
  {
    id: 'popular',
    label: 'Popular',
    popular: true,
    items: [tool('videogen'), tool('imagegen'), tool('clipper'), tool('mcp')],
  },
]

export const TOOLS_CTA = { label: 'Start Creating', href: APP_HOME_HREF }

export const MODELS_COLUMNS = MODEL_GROUPS.map((g) => ({
  id: g.id,
  label: g.nav,
  items: modelsByGroup(g.id).map(modelItem),
}))

export const FEATURES_ITEMS = [
  tool('videogen', { label: 'AI Video Generator' }),
  tool('imagegen', { label: 'AI Thumbnail Generator' }),
  tool('voiceover'),
  tool('captions'),
  tool('clipper', { label: 'Auto Clipping' }),
  tool('ranking', { label: 'Ranking Videos' }),
  tool('reframe'),
  tool('editor'),
  tool('downloader'),
  tool('commentary'),
  tool('mcp'),
]

export const RESOURCES_COLUMNS = [
  {
    id: 'help',
    label: 'Need help',
    items: [
      { id: 'faq', label: 'Help Center / FAQ', description: '', href: '/home#faq', badge: '' },
      { id: 'support', label: 'Contact support', description: '', href: 'mailto:support@vidso.pro', badge: '' },
    ],
  },
]

export const NAV_OMITTED = [
  { menu: 'Features', label: 'Vidso CLI', reason: 'Installer commands are placeholders. No CLI ships in this repo.' },
  { menu: 'Models', label: 'Compare models', reason: 'No compare page exists. /models is the catalog.' },
  { menu: 'Resources', label: 'Tutorials', reason: 'No tutorials page is built.' },
  { menu: 'Resources', label: 'Blog', reason: 'No blog route exists.' },
  { menu: 'Resources', label: "What's New", reason: 'No updates page exists.' },
  { menu: 'Resources', label: 'Changelog', reason: 'No changelog route exists.' },
  { menu: 'Resources', label: 'Discord', reason: 'No Discord URL is configured. Email support is the real help link.' },
  { menu: 'Tools', label: 'Faceless Studio', reason: 'Archived. ROADMAP_SECTIONS keeps it off the landing page.' },
  { menu: 'Tools', label: 'Ads generator', reason: 'Not built. Gated behind ROADMAP_SECTIONS.' },
  { menu: 'Tools', label: 'UGC studio', reason: 'Not built. Gated behind ROADMAP_SECTIONS.' },
]

export const NAV_ITEMS = [
  { id: 'tools', label: 'Tools', type: 'mega', kind: 'tools' },
  { id: 'models', label: 'Models', type: 'mega', kind: 'models' },
  { id: 'features', label: 'Features', type: 'mega', kind: 'features' },
  { id: 'resources', label: 'Resources', type: 'mega', kind: 'resources' },
  { id: 'pricing', label: 'Pricing', type: 'link', href: PRICING_HREF },
]

export function allNavLinks() {
  const rows = []
  for (const col of TOOLS_COLUMNS) {
    for (const item of col.items) rows.push({ menu: 'Tools', column: col.label, ...item })
  }
  for (const col of MODELS_COLUMNS) {
    for (const item of col.items) rows.push({ menu: 'Models', column: col.label, ...item })
  }
  for (const item of FEATURES_ITEMS) rows.push({ menu: 'Features', column: 'Features', ...item })
  for (const col of RESOURCES_COLUMNS) {
    for (const item of col.items) rows.push({ menu: 'Resources', column: col.label, ...item })
  }
  rows.push({ menu: 'Pricing', column: 'Pricing', id: 'pricing', label: 'Pricing', description: '', href: PRICING_HREF, badge: '' })
  return rows
}
