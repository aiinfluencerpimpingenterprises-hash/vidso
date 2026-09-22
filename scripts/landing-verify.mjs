import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '.verify-shots')
const URL = process.env.VERIFY_URL || 'http://127.0.0.1:8765/home'
mkdirSync(OUT, { recursive: true })

const report = { url: URL, viewports: {}, notes: [] }

async function prepare(page) {
  await page.evaluate(() => {
    try { window.ScrollTrigger?.getAll?.().forEach((t) => t.kill()) } catch (_) {}
    document.querySelectorAll('.rv-copy,.rv-line,.rv-media,.rv-item,.rv-eye,.rv-sub,h1,h2,.hero-copy,.hero-prompt,.hero-marquee,.hero-trust,.sub,.trust-badge').forEach((el) => {
      el.style.opacity = '1'
      el.style.transform = 'none'
      el.style.filter = 'none'
    })
  })
}

async function go(page, sel) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector)
    if (!el) return
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72))
  }, sel)
  await page.waitForTimeout(250)
}

async function shot(page, name, fullPage = false) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage })
  return file
}

async function measure(page) {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    const sections = [...document.querySelectorAll('.loved, .showcase, .shorts, .workflow-tiles, .lp-feat, .mcp-excerpt, .mcp-hero, .formats-float, .why-stack, .faq, .final, .format-econ, .compare, .comp-compare, .pricing, .results')]
    const gaps = []
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1].getBoundingClientRect()
      const b = sections[i].getBoundingClientRect()
      const scroll = window.scrollY
      gaps.push({
        from: sections[i - 1].className.split(' ')[0],
        to: sections[i].className.split(' ')[0],
        gap: Math.round((b.top + scroll) - (a.bottom + scroll)),
      })
    }
    const heroCards = [...document.querySelectorAll('.hero-card')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        i: el.getAttribute('data-i'),
        w: Math.round(r.width),
        h: Math.round(r.height),
        left: Math.round(r.left),
        top: Math.round(r.top),
        blank: !el.querySelector('img,video'),
        text: (el.textContent || '').trim(),
      }
    })
    const overlay = document.getElementById('demo-overlay')
    const pin = document.getElementById('hero-pin')
    const pinVh = ''
    const shorts = [...document.querySelectorAll('.shorts-card')].map((el) => ({
      label: el.querySelector('.shorts-lab')?.textContent || '',
      blank: !el.querySelector('.shorts-shot img, .shorts-shot video'),
      cardText: (el.querySelector('.shorts-shot')?.textContent || '').trim(),
    }))
    const showcaseBadges = [...document.querySelectorAll('.cover-badge')].map((el) => el.textContent)
    const h1 = document.querySelectorAll('h1').length
    const consoleOk = true
    return {
      overflow,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      gaps,
      heroCards,
      overlayPresent: !!overlay,
      pinVh,
      shorts,
      showcaseBadges,
      h1,
      oldIdeas: !!document.body.innerText.includes('Turn any idea into a video'),
      scriptOverlay: !!document.body.innerText.includes('Script to final cut'),
      longformEyebrow: !!document.querySelector('.showcase .eyebrow'),
      shortsTitle: document.querySelector('.shorts-title')?.textContent || '',
    }
  })
}

async function runViewport(browser, width, height, key) {
  const page = await browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(900)
  await prepare(page)
  const top = await measure(page)
  await shot(page, `${key}-00-full.png`, true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await shot(page, `${key}-01-hero.png`)

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.15))
  await page.waitForTimeout(400)
  await shot(page, `${key}-02-dark-or-pin.png`)

  await go(page, '#ideas')
  await shot(page, `${key}-05-formats.png`)

  await go(page, '#showcase')
  await shot(page, `${key}-06-showcase.png`)

  await go(page, '#why-vidso')
  await shot(page, `${key}-07-one-platform.png`)

  await go(page, '#connect-claude')
  await shot(page, `${key}-08-mcp.png`)

  await go(page, '#feat-longform')
  await shot(page, `${key}-09-longform-feat.png`)

  await go(page, '#feat-thumbs')
  await shot(page, `${key}-10-thumbs.png`)

  await go(page, '#how')
  await shot(page, `${key}-11-faceless.png`)

  await go(page, '#ugc')
  await shot(page, `${key}-12-ugc.png`)

  await go(page, '#top-models')
  await shot(page, `${key}-13-models.png`)

  await go(page, '.comp-cta')
  await shot(page, `${key}-15-comp-cta.png`)

  await go(page, '#final')
  await shot(page, `${key}-16-final.png`)

  if (width >= 1024) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(200)
    const btn = page.locator('.hero-cta .btn-glow')
    const box = await btn.boundingBox()
    if (box) {
      await page.screenshot({
        path: path.join(OUT, `${key}-17-cta-zoom.png`),
        clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: box.width + 48, height: box.height + 48 },
      })
    }
    await go(page, '.final-box .btn-glow, .final-box .btn-primary')
    const fbox = await page.locator('.final-box .btn-glow, .final-box .btn-primary').first().boundingBox()
    if (fbox) {
      await page.screenshot({
        path: path.join(OUT, `${key}-18-final-cta-zoom.png`),
        clip: { x: Math.max(0, fbox.x - 24), y: Math.max(0, fbox.y - 24), width: fbox.width + 48, height: fbox.height + 48 },
      })
    }
  }

  const mid = await measure(page)
  report.viewports[key] = { width, height, top, mid, errors }
  await page.close()
}

const browser = await chromium.launch({ headless: true })
try {
  await runViewport(browser, 1440, 900, 'd1440')
  await runViewport(browser, 1024, 900, 'd1024')
  await runViewport(browser, 390, 844, 'd390')
} finally {
  await browser.close()
}

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
