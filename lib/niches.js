/**
 * Niche picker for new Vidso users: the faceless long-form niches that are
 * breaking out now, with how well each tends to pay.
 *
 * "Breaking out" comes from Vidso's November 2026 study of 3,071 recent
 * long-form videos on 134 channels, each scored against its own channel's
 * median views; every proof line is a real video from that study.
 *
 * "Pays" is a tier, not a number. YouTube publishes no RPM by niche and the
 * third-party estimates disagree widely (finance alone is quoted anywhere from
 * $4-12 to $15-50 per 1,000 views), but they agree on the order: finance,
 * business, tech and health pay most; space, psychology and history sit in the
 * middle; true crime and mysteries pay least because more of it gets limited
 * ads. Sources: outlierkit.com/resources/youtube-niches-guide,
 * blog.autonolab.com (98 faceless niches), fluxnote.io/blog/youtube-rpm-by-niche-2026,
 * overseeros.com/blog/youtube-rpm-by-niche (all read 2026-11-20).
 */

export const PAY = {
  high: { label: 'Pays well', note: 'Among the best-paying niches: advertisers pay more to reach this audience.' },
  mid: { label: 'Pays OK', note: 'Middle of the pack for ad pay.' },
  low: { label: 'Pays less', note: 'Lower ad pay, partly because more videos get limited ads. Grows fast on views.' },
}

export const NICHES = [
  {
    id: 'history', name: 'History & ancient life', pay: 'mid',
    blurb: 'How people lived, fought and ruled, told as stories.',
    proof: { channel: 'Lore Explained', title: 'What Did Ancient Humans Do For Pleasure?', x: 6731 },
    ideas: ['What did medieval peasants actually eat?', 'Where did Mansa Musa get so much gold?', 'Why you wouldn\'t survive a night in a Roman city', 'The battle that saved the Roman Empire'],
  },
  {
    id: 'military', name: 'Military & war explained', pay: 'mid',
    blurb: 'Units, weapons and battles, one clear explainer at a time.',
    proof: { channel: 'Paint it', title: 'All U.S. Special Operations Forces Explained', x: 2273 },
    ideas: ['Every special forces unit in the world, explained', 'The commander who lost a fleet in six minutes', 'Why the Navy still builds battleships', 'The German major who saw D-Day first'],
  },
  {
    id: 'business', name: 'Business rise & fall', pay: 'high',
    blurb: 'How famous companies won big and then lost it.',
    proof: { channel: 'Fortune & Fall', title: 'WTF Happened to Labubu?', x: 1750 },
    ideas: ['The rise and fall of Blockbuster', 'What happened to Subway?', 'How one decision almost killed Lego', 'Why Starbucks is losing America'],
  },
  {
    id: 'psychology', name: 'Psychology', pay: 'mid',
    blurb: 'Why people think and act the way they do.',
    proof: { channel: 'Big Brain Explains', title: 'The Psychology Of Gen X (Raised Without Applause)', x: 833 },
    ideas: ['The psychology of people who stay up late', 'The psychology of people who never ask for help', 'Why Millennials can\'t relax', 'The psychology of people who cut everyone off'],
  },
  {
    id: 'space', name: 'Space & science', pay: 'mid',
    blurb: 'The universe at a scale people can picture.',
    proof: { channel: 'Universe Unfold', title: 'Timelapse to the Future of Earth', x: 151 },
    ideas: ['A light-year is so huge your brain can\'t picture it', 'TON 618: the black hole bigger than our solar system', 'What happens if you fall into Jupiter', 'Why the Mariana Trench is scarier than space'],
  },
  {
    id: 'philosophy', name: 'Philosophy & stoicism', pay: 'mid',
    blurb: 'Big ideas from great thinkers, made practical.',
    proof: { channel: 'Philosophy Fanatic', title: 'Why So Many Great Philosophers Hated Women', x: 154 },
    ideas: ['Focus on yourself and stay silent: the Stoic way', 'Why are we afraid of death? 10 philosophers answer', 'Marcus Aurelius on how to stop overthinking', 'What Nietzsche really meant by God is dead'],
  },
  {
    id: 'crime', name: 'True crime & mysteries', pay: 'low',
    blurb: 'Real cases and unexplained events, told carefully.',
    proof: { channel: 'The Lost Discovery', title: '49 Mysterious Events That No One Can Explain', x: 157 },
    ideas: ['The disappearance of the Roanoke colony', '10 unsolved mysteries caught on camera', 'The case that DNA reopened after 23 years', 'The ship that vanished in the Bermuda Triangle'],
  },
  {
    id: 'tech', name: 'AI & tech explained', pay: 'high',
    blurb: 'What new tech really does and what it changes.',
    proof: { channel: 'Economy Media', title: 'How AI Became More Expensive Than The Workers It Replaced', x: 54 },
    ideas: ['How AI became more expensive than workers', 'Why tech companies are cancelling AI data centers', 'How Starlink actually works', '12 ways the AI boom could end'],
  },
  {
    id: 'finance', name: 'Money & economics', pay: 'high',
    blurb: 'How money, markets and economies really work.',
    proof: { channel: 'Little Bit Better', title: 'Once You Understand Economics, You Can\'t Be MANIPULATED Anymore', x: 21 },
    ideas: ['Once you understand inflation, you\'ll never save the same way', 'Which rich country goes bankrupt first?', 'How the petrodollar controls the world', 'Why your salary buys less every year'],
  },
  {
    id: 'health', name: 'Health & the body', pay: 'high',
    blurb: 'What habits really do to your body, step by step.',
    proof: { channel: 'PhysiqueLab', title: 'What Happens to Your Body If You Plank Only 1 Minute a Day', x: 289 },
    ideas: ['What happens to your body if you walk 10,000 steps a day', 'What eating once a day does to you, hour by hour', 'What happens when you quit sugar for 30 days', 'Why you wake up at 3am'],
  },
  {
    id: 'geography', name: 'Geography', pay: 'mid',
    blurb: 'Why places look, grow and empty out the way they do.',
    proof: { channel: 'Geography By Geoff', title: 'Why Almost NOBODY Lives On Australia\'s West Coast', x: 13 },
    ideas: ['Why almost nobody lives in northern Maine', 'Why Egypt is 95% empty', 'The countries that might not exist in 50 years', 'Why Canada\'s north is still empty'],
  },
]

const BY_ID = Object.fromEntries(NICHES.map((n) => [n.id, n]))
export const nicheById = (id) => BY_ID[id] || null

/** Best first: pay tier, then how hard the niche is breaking out. */
export function rankedNiches() {
  const w = { high: 3, mid: 2, low: 1 }
  return [...NICHES].sort((a, b) => (w[b.pay] * 2 + Math.log10(b.proof.x)) - (w[a.pay] * 2 + Math.log10(a.proof.x)))
}

/** Short "6,731×" style label for a breakout multiple. */
export function breakoutLabel(x) {
  return Number(x).toLocaleString('en-US') + '×'
}

/** A user-typed niche ("cars", "anime lore") becomes a custom niche with general ideas. */
export function customNiche(text) {
  const name = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!name) return null
  return {
    id: 'custom', name, pay: '', blurb: '', proof: null,
    ideas: [`The rise and fall of the biggest name in ${name}`, `${name}: what nobody tells beginners`, `Every type of ${name} explained`, `The strangest story in ${name} history`],
  }
}
