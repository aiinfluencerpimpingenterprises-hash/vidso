/**
 * Faceless Studio home gallery. Real config, not markup.
 * image is a public URL; empty uses the shared tinted placeholder.
 *
 * Name changes vs the first draft:
 * - Ranked Countdown -> Numbered Countdown (Ranking is an existing tool)
 * - How It Works -> Process Walkthrough (clashes with the How it works tab)
 * - Viral Moment -> Hook Burst (Clipping already has Find Viral Moments)
 */

export const STUDIO_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'long', label: 'Long form' },
  { id: 'explainers', label: 'Explainers' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'packaging', label: 'Packaging' },
]

const ICO = {
  list: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  film: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 5v14M17 5v14M2 12h20"/></svg>',
  book: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  bolt: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>',
  search: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
  ranks: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/></svg>',
  gear: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  flask: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6L5 20h14L14 9V3"/><path d="M8 14h8"/></svg>',
  coin: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c.5-1 2-1.5 2.5-1.5s2 .4 2 1.5-1 1.5-2.5 1.5S9 12 9 13.2 10.5 15 12 15s2.4-.4 2.8-1.2"/></svg>',
  clock: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chip: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  board: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  hook: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10M8 7l4-4 4 4"/><path d="M6 14a6 6 0 0012 0"/></svg>',
  facts: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
  quote: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17h4l2-6V7H5v4h4zM15 17h4l2-6V7h-8v4h4z"/></svg>',
  recap: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 109-9"/><path d="M3 5v7h7"/></svg>',
  image: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  type: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>',
  intro: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="M10 9l6 3-6 3V9z"/></svg>',
  end: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 12h8M12 8v8"/></svg>',
}

export const STUDIO_SECTIONS = [
  {
    id: 'long',
    title: 'LONG FORM',
    accentWords: 2,
    sub: 'Pick a format and Vidso handles script, voice, B-roll, and captions.',
    cards: [
      {
        id: 'top-10-listicle',
        name: 'Top 10 Listicle',
        icon: ICO.list,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A top 10 listicle about [topic]. Open with a hook, count down from 10 to 1, and close with a reason to watch the next video.',
      },
      {
        id: 'documentary-style',
        name: 'Documentary Style',
        icon: ICO.film,
        image: '',
        length: 'long_900',
        aspect: '16:9',
        scaffold: 'A documentary-style video about [topic]. Use a calm narrator, scene-setting B-roll, and a clear beginning, middle, and end.',
      },
      {
        id: 'story-time',
        name: 'Story Time',
        icon: ICO.book,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A story-time video about [topic]. Start in the middle of the action, then fill in how we got here, and land a payoff.',
      },
      {
        id: 'motivational',
        name: 'Motivational',
        icon: ICO.bolt,
        image: '',
        length: 'long_300',
        aspect: '16:9',
        scaffold: 'A motivational video about [topic]. Short, punchy lines. Build from a problem to a shift the viewer can use today.',
      },
      {
        id: 'case-study',
        name: 'Case Study',
        icon: ICO.search,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A case study about [topic]. Cover the situation, what was tried, the result, and the lesson worth copying.',
      },
      {
        id: 'numbered-countdown',
        name: 'Numbered Countdown',
        icon: ICO.ranks,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A numbered countdown about [topic]. Rank items with a reason for each place, and save the strongest for last.',
      },
    ],
  },
  {
    id: 'explainers',
    title: 'EXPLAINERS',
    accentWords: 1,
    sub: 'Turn any topic into a clear, visual explainer video.',
    cards: [
      {
        id: 'process-walkthrough',
        name: 'Process Walkthrough',
        icon: ICO.gear,
        image: '',
        length: 'long_300',
        aspect: '16:9',
        scaffold: 'An explainer that walks through how [topic] works, step by step, in plain language with matching B-roll.',
      },
      {
        id: 'science-explainer',
        name: 'Science Explainer',
        icon: ICO.flask,
        image: '',
        length: 'long_300',
        aspect: '16:9',
        scaffold: 'A science explainer about [topic]. Start with the question, then the mechanism, then why it matters.',
      },
      {
        id: 'finance-breakdown',
        name: 'Finance Breakdown',
        icon: ICO.coin,
        image: '',
        length: 'long_300',
        aspect: '16:9',
        scaffold: 'A finance breakdown of [topic]. Define the terms, show the numbers simply, and flag the common mistake.',
      },
      {
        id: 'history-explainer',
        name: 'History Explainer',
        icon: ICO.clock,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A history explainer about [topic]. Timeline first, then the turning point, then what it changed.',
      },
      {
        id: 'tech-deep-dive',
        name: 'Tech Deep Dive',
        icon: ICO.chip,
        image: '',
        length: 'long_600',
        aspect: '16:9',
        scaffold: 'A tech deep dive on [topic]. Assume a smart viewer. Cover how it is built, what broke, and what is next.',
      },
      {
        id: 'whiteboard-style',
        name: 'Whiteboard Style',
        icon: ICO.board,
        image: '',
        length: 'long_300',
        aspect: '16:9',
        scaffold: 'A whiteboard-style explainer of [topic]. Teach one idea at a time, as if drawing it on a board.',
      },
    ],
  },
  {
    id: 'shorts',
    title: 'SHORTS',
    accentWords: 1,
    sub: 'Vertical cuts built for Shorts, Reels, and TikTok.',
    cards: [
      {
        id: 'hook-and-payoff',
        name: 'Hook and Payoff',
        icon: ICO.hook,
        image: '',
        length: 'shorts_45',
        aspect: '9:16',
        scaffold: 'A vertical short about [topic]. First line is the hook. Pay off in under 45 seconds. No slow intro.',
      },
      {
        id: 'quick-facts',
        name: 'Quick Facts',
        icon: ICO.facts,
        image: '',
        length: 'shorts_30',
        aspect: '9:16',
        scaffold: 'A quick-facts short about [topic]. Four tight facts, one punchline, then a follow for more.',
      },
      {
        id: 'countdown-short',
        name: 'Countdown',
        icon: ICO.list,
        image: '',
        length: 'shorts_45',
        aspect: '9:16',
        scaffold: 'A vertical countdown about [topic]. Three to five items, fastest at the start, best at the end.',
      },
      {
        id: 'quote-card',
        name: 'Quote Card',
        icon: ICO.quote,
        image: '',
        length: 'shorts_30',
        aspect: '9:16',
        scaffold: 'A quote-card short about [topic]. One strong line on screen, a 15 to 30 second read, then a CTA.',
      },
      {
        id: 'hook-burst',
        name: 'Hook Burst',
        icon: ICO.bolt,
        image: '',
        length: 'shorts_30',
        aspect: '9:16',
        scaffold: 'A hook-burst short about [topic]. Pattern interrupt in the first second, then one idea, then cut.',
      },
      {
        id: 'clip-recap',
        name: 'Clip Recap',
        icon: ICO.recap,
        image: '',
        length: 'shorts_60',
        aspect: '9:16',
        scaffold: 'A clip-recap short of [topic]. Recap the key beats as if the viewer missed the long version.',
      },
    ],
  },
  {
    id: 'packaging',
    title: 'PACKAGING',
    accentWords: 1,
    sub: 'Everything that goes around the video.',
    cards: [
      {
        id: 'thumbnail-pack',
        name: 'Thumbnail Pack',
        icon: ICO.image,
        image: '',
        route: 'imagegen',
        length: 'long_180',
        aspect: '16:9',
        scaffold: 'YouTube thumbnail pack for a faceless video about [topic]. High contrast, readable title, one clear subject.',
      },
      {
        id: 'title-variations',
        name: 'Title Variations',
        icon: ICO.type,
        image: '',
        length: 'long_180',
        aspect: '16:9',
        scaffold: 'Write a short spoken video that pitches 8 YouTube title options for [topic], with why each one could work.',
      },
      {
        id: 'channel-intro',
        name: 'Channel Intro',
        icon: ICO.intro,
        image: '',
        length: 'shorts_30',
        aspect: '16:9',
        scaffold: 'A 15 to 30 second channel intro about [topic]. Who this is for, what they get, and a reason to subscribe.',
      },
      {
        id: 'end-screen',
        name: 'End Screen',
        icon: ICO.end,
        image: '',
        length: 'shorts_30',
        aspect: '16:9',
        scaffold: 'A 20 second end screen for a video about [topic]. Recap one takeaway, then point to the next watch.',
      },
    ],
  },
]

export function studioPresetsAll() {
  return STUDIO_SECTIONS.flatMap((s) => s.cards.map((c) => ({ ...c, section: s.id })))
}

export function studioPresetById(id) {
  return studioPresetsAll().find((c) => c.id === id) || null
}

export function studioSectionsForFilter(filterId) {
  const key = String(filterId || 'all')
  if (key === 'all') return STUDIO_SECTIONS
  return STUDIO_SECTIONS.filter((s) => s.id === key)
}

export function studioHeadingHtml(title, accentWords, esc) {
  const parts = String(title || '').trim().split(/\s+/).filter(Boolean)
  const n = Math.max(1, Math.min(Number(accentWords) || 1, parts.length))
  const head = parts.slice(0, n).join(' ')
  const rest = parts.slice(n).join(' ')
  return `<span class="accent">${esc(head)}</span>${rest ? ' ' + esc(rest) : ''}`
}
