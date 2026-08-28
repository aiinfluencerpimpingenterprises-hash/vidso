/**
 * Local studio workspace: chats, memories, ask-mode, temp chat, active project.
 * Temporary chats stay in the session and never land in search, the rail, or memory.
 */

const CHAT_KEY = 'vidso_fs_chats'
const MEM_KEY = 'vidso_fs_memory'
const PREF_KEY = 'vidso_fs_prefs'
const TEMP_KEY = 'vidso_fs_temp'
const TEMP_DRAFT_KEY = 'vidso_fs_temp_draft'

function uid() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID()
  } catch (_) {}
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

function userScope() {
  try {
    const token = localStorage.getItem('clipzo_token') || ''
    return token ? token.slice(0, 16) : 'anon'
  } catch (_) {
    return 'anon'
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key + ':' + userScope())
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

function write(key, value) {
  try { localStorage.setItem(key + ':' + userScope(), JSON.stringify(value)) } catch (_) {}
}

export function loadPrefs() {
  const saved = read(PREF_KEY, {})
  return {
    askMode: saved.askMode === 'run' ? 'run' : 'ask',
    projectId: String(saved.projectId || ''),
  }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch }
  write(PREF_KEY, next)
  return next
}

export function getAskMode() {
  return loadPrefs().askMode
}

export function setAskMode(mode) {
  return savePrefs({ askMode: mode === 'run' ? 'run' : 'ask' })
}

export function getActiveProjectId() {
  return loadPrefs().projectId
}

export function setActiveProjectId(id) {
  return savePrefs({ projectId: String(id || '') })
}

export function isTempChat() {
  try { return sessionStorage.getItem(TEMP_KEY) === '1' } catch (_) { return false }
}

export function setTempChat(on) {
  try {
    if (on) sessionStorage.setItem(TEMP_KEY, '1')
    else {
      sessionStorage.removeItem(TEMP_KEY)
      sessionStorage.removeItem(TEMP_DRAFT_KEY)
    }
  } catch (_) {}
  try { document.body.classList.toggle('fs-temp-on', !!on) } catch (_) {}
}

export function saveTempDraft(topic) {
  try { sessionStorage.setItem(TEMP_DRAFT_KEY, String(topic || '')) } catch (_) {}
}

export function loadTempDraft() {
  try { return sessionStorage.getItem(TEMP_DRAFT_KEY) || '' } catch (_) { return '' }
}

export function listChats() {
  const raw = read(CHAT_KEY, [])
  const items = Array.isArray(raw) ? raw : []
  return items
    .filter((c) => c && c.id && !c.temp)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

export function getChat(id) {
  return listChats().find((c) => c.id === id) || null
}

export function upsertChat(partial) {
  if (isTempChat()) return null
  const items = listChats()
  const id = String(partial.id || uid())
  const prev = items.find((c) => c.id === id)
  const next = {
    id,
    title: String(partial.title || prev?.title || 'Untitled chat').slice(0, 80),
    prompt: String(partial.prompt || prev?.prompt || ''),
    projectId: String(partial.projectId || prev?.projectId || ''),
    updatedAt: new Date().toISOString(),
  }
  const rest = items.filter((c) => c.id !== id)
  write(CHAT_KEY, [next, ...rest].slice(0, 80))
  return next
}

export function searchChats(q) {
  const needle = String(q || '').trim().toLowerCase()
  const items = listChats()
  if (!needle) return items
  return items.filter((c) => (c.title + ' ' + c.prompt).toLowerCase().includes(needle))
}

export function listMemories() {
  const items = Array.isArray(read(MEM_KEY, [])) ? read(MEM_KEY, []) : []
  return items
    .filter((m) => m && m.id)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

export function addMemory(text, extra = {}) {
  if (isTempChat() && extra.kind === 'chat') return null
  const body = String(text || '').trim()
  if (!body) return null
  const items = listMemories()
  const row = {
    id: uid(),
    text: body.slice(0, 400),
    kind: extra.kind || 'note',
    createdAt: new Date().toISOString(),
  }
  write(MEM_KEY, [row, ...items].slice(0, 120))
  return row
}

export function importMemories(raw) {
  const chunk = String(raw || '')
  let lines = []
  try {
    const parsed = JSON.parse(chunk)
    if (Array.isArray(parsed)) lines = parsed.map((x) => (typeof x === 'string' ? x : x?.text || '')).filter(Boolean)
    else if (parsed && typeof parsed === 'object' && parsed.text) lines = [parsed.text]
  } catch (_) {
    lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  }
  const added = []
  lines.slice(0, 40).forEach((line) => {
    const row = addMemory(line, { kind: 'import' })
    if (row) added.push(row)
  })
  return added
}
