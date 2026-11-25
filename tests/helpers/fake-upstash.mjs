// A tiny in-memory stand-in for the store behind lib/kv.js: Upstash's REST API,
// or Supabase's tubeops_kv RPC (docs/supabase-kv.sql). install swaps global
// fetch for calls to the fake URL and sets the env vars for that backend.

export const FAKE_URL = 'https://fake-upstash.test'
export const FAKE_SUPABASE = 'https://fake-project.supabase.test'
export const BACKENDS = ['upstash', 'supabase']

const ENV_NAMES = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']

export function installFakeUpstash({ backend = 'upstash' } = {}) {
  const data = new Map()
  const realFetch = globalThis.fetch
  const prev = Object.fromEntries(ENV_NAMES.map((n) => [n, process.env[n]]))
  for (const n of ENV_NAMES) delete process.env[n]
  if (backend === 'supabase') {
    process.env.SUPABASE_URL = FAKE_SUPABASE
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'
  } else {
    process.env.UPSTASH_REDIS_REST_URL = FAKE_URL
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  }
  let down = false

  function run([cmd, ...args]) {
    const op = String(cmd).toUpperCase()
    const key = args[0]
    switch (op) {
      case 'GET': return data.has(key) ? data.get(key) : null
      case 'SET': {
        const flags = args.slice(2).map((a) => String(a).toUpperCase())
        const exists = data.has(key)
        const prior = exists ? data.get(key) : null
        if (flags.includes('NX') && exists) return flags.includes('GET') ? prior : null
        data.set(key, String(args[1]))
        return flags.includes('GET') ? prior : 'OK'
      }
      case 'DEL': return data.delete(key) ? 1 : 0
      case 'EXPIRE': return data.has(key) ? 1 : 0
      case 'HGETALL': {
        const h = data.get(key) || {}
        return Object.entries(h).flat()
      }
      case 'HINCRBY': {
        const h = data.get(key) || {}
        h[args[1]] = String((Number(h[args[1]]) || 0) + Number(args[2]))
        data.set(key, h)
        return Number(h[args[1]])
      }
      case 'HSETNX': {
        const h = data.get(key) || {}
        if (args[1] in h) return 0
        h[args[1]] = String(args[2])
        data.set(key, h)
        return 1
      }
      case 'SADD': {
        const s = data.get(key) || new Set()
        let n = 0
        for (const m of args.slice(1)) if (!s.has(m)) { s.add(m); n++ }
        data.set(key, s)
        return n
      }
      case 'SREM': {
        const s = data.get(key) || new Set()
        let n = 0
        for (const m of args.slice(1)) if (s.delete(m)) n++
        return n
      }
      case 'SMEMBERS': return [...(data.get(key) || [])]
      default: throw new Error('fake upstash: unsupported ' + op)
    }
  }

  globalThis.fetch = async (url, init) => {
    const u = String(url)
    if (u.startsWith(FAKE_SUPABASE)) {
      if (down) throw new Error('store down')
      if (u !== FAKE_SUPABASE + '/rest/v1/rpc/tubeops_kv') return new Response('{}', { status: 404 })
      if (init.headers?.apikey !== 'sb_secret_test') return new Response('{}', { status: 401 })
      const { cmd, args } = JSON.parse(init.body)
      const result = run([cmd, ...args])
      return new Response(JSON.stringify(result ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (!u.startsWith(FAKE_URL)) return realFetch(url, init)
    if (down) throw new Error('store down')
    const result = run(JSON.parse(init.body))
    return new Response(JSON.stringify({ result }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return {
    data,
    setDown(v) { down = !!v },
    restore() {
      globalThis.fetch = realFetch
      for (const n of ENV_NAMES) {
        if (prev[n] === undefined) delete process.env[n]
        else process.env[n] = prev[n]
      }
    },
  }
}
