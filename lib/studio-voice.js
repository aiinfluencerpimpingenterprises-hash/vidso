export function pickDefaultVoiceId(voices, current) {
  const list = Array.isArray(voices) ? voices : []
  const cur = String(current || '').trim()
  if (cur && list.some((v) => String(v?.id || '') === cur)) return cur
  return String(list[0]?.id || '')
}
