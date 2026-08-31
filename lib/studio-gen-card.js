/**
 * Faceless Studio generate status card — circular percent, no confirm modal.
 */

export function clampGenerationProgress(n) {
  const x = Math.round(Number(n) || 0)
  if (x < 0) return 0
  if (x > 100) return 100
  return x
}

export function generationProgressToward(elapsedMs, cap = 90, tauMs = 16000) {
  const t = Math.max(0, Number(elapsedMs) || 0)
  const capN = clampGenerationProgress(cap)
  const tau = Math.max(1, Number(tauMs) || 16000)
  if (capN <= 3) return capN
  return Math.min(capN, Math.round(3 + (capN - 3) * (1 - Math.exp(-t / tau))))
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

export function generationCardHtml({ progress = 0, label = 'generating', error = '' } = {}) {
  const pct = clampGenerationProgress(progress)
  const deg = Math.round((pct / 100) * 360)
  if (error) {
    return `<aside class="fs-gen-card is-err" id="fs-gen-card" role="status">
      <span class="fs-gen-ring is-err" aria-hidden="true"><span class="fs-gen-spin"></span></span>
      <span class="fs-gen-copy">
        <strong>failed</strong>
        <em>${esc(error)}</em>
      </span>
    </aside>`
  }
  return `<aside class="fs-gen-card" id="fs-gen-card" role="status" aria-live="polite">
    <span class="fs-gen-ring" style="--fs-gen-deg:${deg}deg" aria-hidden="true"><span class="fs-gen-spin"></span></span>
    <span class="fs-gen-copy">
      <strong>${esc(label || 'generating')}</strong>
      <em>${pct}%...</em>
    </span>
  </aside>`
}
