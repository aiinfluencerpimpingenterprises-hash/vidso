import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

test('the OAuth homepage URL serves the marketing page, not a JS bounce', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const home = vercel.rewrites.find((r) => r.source === '/')
  assert.equal(home?.destination, '/home/index.html')
  assert.equal(existsSync(new URL('../index.html', import.meta.url)), false)
  const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
  assert.match(html, /rel="canonical" href="https:\/\/www\.vidso\.pro\/"/)
  assert.match(html, /google-site-verification/)
  assert.doesNotMatch(html, /location\.replace\('\/home'/)
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
