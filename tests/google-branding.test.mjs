import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the OAuth homepage is a small static page Google can fetch without JS', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(vercel.rewrites.some((r) => r.source === '/'), false)
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.ok(Buffer.byteLength(html) < 12_000)
  assert.match(html, /<h1>Vidso makes long-form YouTube videos<\/h1>/)
  assert.match(html, /href="\/privacy"/)
  assert.match(html, /href="\/terms"/)
  assert.match(html, /google-site-verification/)
  assert.match(html, /rel="canonical" href="https:\/\/www\.vidso\.pro\/"/)
  assert.doesNotMatch(html, /location\.replace\(['"]\/home/)
  assert.doesNotMatch(html, /<video/)
  assert.doesNotMatch(html, /t\.whop\.tw/)
})

test('Search Console HTML file verification is at the site root', () => {
  const a = readFileSync(new URL('../googleyHxnlqDRCP6NXQ1Cu8QglsQjyz7NxsOu2anCc1Tt1NI.html', import.meta.url), 'utf8')
  const b = readFileSync(new URL('../googleewq8xStt8tEBZ80eVf-Fmucu902PQeY3rhV-M87thKg.html', import.meta.url), 'utf8')
  assert.match(a, /^google-site-verification: yHxnlqDRCP6NXQ1Cu8QglsQjyz7NxsOu2anCc1Tt1NI\s*$/)
  assert.match(b, /^google-site-verification: ewq8xStt8tEBZ80eVf-Fmucu902PQeY3rhV-M87thKg\s*$/)
})

test('robots.txt lets Google crawl the homepage', () => {
  const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8')
  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Allow: \//)
  assert.match(robots, /Googlebot/)
})
