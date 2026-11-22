import test from 'node:test'
import assert from 'node:assert/strict'
import { channelUrlFrom, fetchChannelInfo, parseReferenceResponse, referencePrompt } from '../lib/reference-agent.js'

test('channel links and handles become channel page URLs', () => {
  assert.equal(channelUrlFrom('@kurzgesagt'), 'https://www.youtube.com/@kurzgesagt')
  assert.equal(channelUrlFrom('youtube.com/@kurzgesagt/videos'), 'https://www.youtube.com/@kurzgesagt')
  assert.equal(channelUrlFrom('https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q'), 'https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q')
  assert.equal(channelUrlFrom('https://m.youtube.com/c/Vsauce'), 'https://www.youtube.com/c/Vsauce')
  assert.equal(channelUrlFrom('https://www.youtube.com/watch?v=abc'), null)
  assert.equal(channelUrlFrom('https://example.com/@x'), null)
  assert.equal(channelUrlFrom(''), null)
})

test('reads name, description and recent titles from public pages', async () => {
  const page = '<link rel="canonical" href="https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q"><meta property="og:title" content="Kurzgesagt &amp; Co"><meta property="og:description" content="Animation videos">'
  const feed = '<feed><entry><title>Dying Is Complicated</title></entry><entry><title>How Does Ketamine Work?</title></entry></feed>'
  const fetchImpl = async (url) => ({ ok: true, text: async () => (String(url).includes('feeds/videos.xml') ? feed : page) })
  const info = await fetchChannelInfo('@kurzgesagt', { fetchImpl })
  assert.equal(info.id, 'UCsXVk37bltHxD1rDPwtNM8Q')
  assert.equal(info.title, 'Kurzgesagt & Co')
  assert.deepEqual(info.titles, ['Dying Is Complicated', 'How Does Ketamine Work?'])
  assert.match(referencePrompt(info), /Dying Is Complicated/)
  await assert.rejects(fetchChannelInfo('not a link', { fetchImpl }), /YouTube channel link/)
})

test('reference answer is validated', () => {
  const out = parseReferenceResponse('{"genre":"education","niche":"space","angle":"explainer","about":"science explained with animation","summary":"Animated explainers."}')
  assert.deepEqual(out, { genre: 'education', niche: 'space', angle: 'explainer', about: 'Channel about science explained with animation', summary: 'Animated explainers.' })
  assert.equal(parseReferenceResponse('{"genre":"opera","about":"Channel about birds"}').genre, 'education')
  assert.equal(parseReferenceResponse('nope'), null)
})
