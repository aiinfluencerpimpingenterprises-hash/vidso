import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '.verify-shots')
const URL = process.env.VERIFY_URL || 'http://127.0.0.1:8765/home'
mkdirSync(OUT, { recursive: true })

const report = { url: URL, viewports: {}, notes: [] }

async function shot(page, name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage: false })
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
    const video = document.getElementById('demo-frame')
    const loved = document.querySelector('.loved')
    let lovedGap = null
    if (video && loved) {
      const vr = video.getBoundingClientRect()
      const lr = loved.getBoundingClientRect()
      lovedGap = Math.round((lr.top + window.scrollY) - (vr.bottom + window.scrollY))
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
      lovedGap,
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
  const top = await measure(page)
  await shot(page, `${key}-01-hero.png`)

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.15))
  await page.waitForTimeout(400)
  await shot(page, `${key}-02-dark-or-pin.png`)

  await page.evaluate(() => {
    const demo = document.getElementById('demo-hero')
    if (demo) demo.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(700)
  await shot(page, `${key}-03-settled-loved.png`)

  let pause = null
  if (width >= 1024) {
    await page.locator('#demo-frame').click({ position: { x: 40, y: 40 }, force: true }).catch(() => {})
    const pauseBtn = page.locator('#demo-pause')
    await page.locator('#demo-frame').hover()
    await page.waitForTimeout(200)
    if (await pauseBtn.count()) {
      await pauseBtn.click({ force: true })
      await page.waitForTimeout(200)
      const before = await page.evaluate(() => {
        const v = document.getElementById('demo-video')
        return { paused: v?.paused, t: v?.currentTime || 0, href: location.href, label: document.getElementById('demo-pause')?.getAttribute('aria-label') }
      })
      await page.evaluate(() => window.scrollBy(0, 80))
      await page.waitForTimeout(5200)
      const after = await page.evaluate(() => {
        const v = document.getElementById('demo-video')
        return { paused: v?.paused, t: v?.currentTime || 0, href: location.href, label: document.getElementById('demo-pause')?.getAttribute('aria-label') }
      })
      pause = { before, after, stayed: after.paused === true && Math.abs(after.t - before.t) < 0.35 && !after.href.includes('/signup') }
      await shot(page, `${key}-04-paused.png`)
    }
  }

  await page.locator('.showcase').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await shot(page, `${key}-05-longform.png`)

  await page.locator('.shorts').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await shot(page, `${key}-06-shorts.png`)

  await page.locator('#connect-claude').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, `${key}-07-mcp.png`)

  await page.locator('.comp-cta').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await shot(page, `${key}-08-comp-cta.png`)

  await page.locator('.final-box').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await shot(page, `${key}-09-final.png`)

  await page.locator('#feat-longform').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, `${key}-10-longform-feat.png`)

  await page.locator('#feat-thumbs').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, `${key}-11-thumbs.png`)

  const results = page.locator('#results-root, .results')
  if (await results.count()) {
    await results.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await shot(page, `${key}-12-channels.png`)
  }

  await page.locator('.formats-float').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await shot(page, `${key}-13-formats.png`)

  if (width >= 1024) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(200)
    const btn = page.locator('.hero-cta .btn-glow')
    const box = await btn.boundingBox()
    if (box) {
      await page.screenshot({
        path: path.join(OUT, `${key}-14-cta-zoom.png`),
        clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: box.width + 48, height: box.height + 48 },
      })
    }
    await page.locator('.final-box .btn-glow, .final-box .btn-primary').first().scrollIntoViewIfNeeded()
    const fbox = await page.locator('.final-box .btn-glow, .final-box .btn-primary').first().boundingBox()
    if (fbox) {
      await page.screenshot({
        path: path.join(OUT, `${key}-15-final-cta-zoom.png`),
        clip: { x: Math.max(0, fbox.x - 24), y: Math.max(0, fbox.y - 24), width: fbox.width + 48, height: fbox.height + 48 },
      })
    }
  }

  const mid = await measure(page)
  report.viewports[key] = { width, height, top, mid, pause, errors }
  await page.close()
}

const browser = await chromium.launch({ headless: true })
try {
  await runViewport(browser, 1440, 900, 'd1440')
  await runViewport(browser, 390, 844, 'd390')
} finally {
  await browser.close()
}

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
