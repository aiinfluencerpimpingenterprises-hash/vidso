// Read Whop's payment history and say *why* charges are failing.
//
// "Payments don't go through" has very different fixes depending on the decline
// code: a card the buyer's bank refused is not something we can fix, while test
// keys in production, a blocked country, or 3D Secure friction are entirely
// ours. Whop returns a `decline_code` per payment, so this classifies rather
// than guesses. Server-only.

// Codes we can act on ourselves. Everything not listed here is treated as the
// buyer's issuer saying no, which is normal background noise at some rate.
const CONFIG_CODES = new Set([
  // Test credentials or a test card reaching live checkout. Fails *everything*.
  'test_mode_decline',
  'test_mode_test_card',
  // The buyer's currency is not accepted. Adaptive pricing covers this.
  'currency_not_supported',
  // Whop or the processor is refusing us, not the card.
  'merchant_blacklist',
  'high_risk',
  'suspected_fraud',
  // Geographic and regulatory blocks.
  'regulatory_blocked',
  'transaction_not_permitted',
  'transaction_not_allowed',
  'invalid_country',
])

// Transient faults on the processor's side; retrying usually clears them.
const PROCESSOR_CODES = new Set([
  'processing_error',
  'issuer_unavailable',
  'issuer_error',
  'provider_declined',
  'try_again_later',
])

export function classifyDecline(code) {
  const key = String(code || '').trim().toLowerCase()
  if (!key) return { bucket: 'unknown', ours: false }
  // three_d_secure_success is a pass, not a decline, so it never lands here.
  if (key.startsWith('three_d_secure') || key === 'authentication_required') {
    return { bucket: 'three_ds', ours: true }
  }
  if (CONFIG_CODES.has(key)) return { bucket: 'config', ours: true }
  if (PROCESSOR_CODES.has(key)) return { bucket: 'processor', ours: false }
  if (key.startsWith('bank_') || key.startsWith('sepa_')) {
    return { bucket: 'bank_rails', ours: false }
  }
  return { bucket: 'issuer', ours: false }
}

function statusOf(row) {
  return String(row?.status || '').trim().toLowerCase()
}

function declineOf(row) {
  return String(row?.decline_code || '').trim().toLowerCase()
}

function isFailure(row) {
  if (declineOf(row)) return true
  const status = statusOf(row)
  return status === 'failed' || status === 'past_due' || status === 'uncollectible'
}

function isSuccess(row) {
  const status = statusOf(row)
  return status === 'paid' || status === 'completed' || !!row?.paid_at
}

/**
 * Turn a page of payments into a verdict. Buckets are ordered by whether we can
 * do anything about them, so the report leads with what is actually actionable.
 */
export function summarizePayments(rows) {
  const list = Array.isArray(rows) ? rows : []
  const byStatus = {}
  const byCode = {}
  const byBucket = {}
  const emailsByCode = {}
  let failed = 0
  let paid = 0

  for (const row of list) {
    const status = statusOf(row) || 'unknown'
    byStatus[status] = (byStatus[status] || 0) + 1
    if (isSuccess(row)) paid++
    if (!isFailure(row)) continue
    failed++
    const code = declineOf(row) || 'unreported'
    const { bucket, ours } = classifyDecline(code)
    byCode[code] = (byCode[code] || 0) + 1
    byBucket[bucket] = (byBucket[bucket] || 0) + 1
    if (!emailsByCode[code]) emailsByCode[code] = { ours, message: row?.failure_message || null, buyers: 0 }
    emailsByCode[code].buyers++
  }

  const attempted = paid + failed
  const failureRate = attempted ? Math.round((failed / attempted) * 100) : 0
  const ourFailures = Object.entries(byBucket)
    .filter(([bucket]) => bucket === 'config' || bucket === 'three_ds')
    .reduce((sum, [, n]) => sum + n, 0)

  return {
    scanned: list.length,
    paid,
    failed,
    attempted,
    failureRate,
    byStatus,
    byBucket,
    declines: Object.entries(byCode)
      .map(([code, count]) => ({
        code,
        count,
        bucket: classifyDecline(code).bucket,
        ours: !!emailsByCode[code]?.ours,
        sampleMessage: emailsByCode[code]?.message || null,
      }))
      .sort((a, b) => b.count - a.count),
    ourFailures,
    verdict: paymentsVerdict({ attempted, failed, failureRate, byBucket, byCode }),
  }
}

function topCode(byCode) {
  let best = ''
  let n = 0
  for (const [code, count] of Object.entries(byCode)) {
    if (count > n) { best = code; n = count }
  }
  return best
}

export function paymentsVerdict({ attempted, failed, failureRate, byBucket, byCode }) {
  if (!attempted) return 'No payments in this window. Nobody reached checkout, so this is a traffic or checkout-link problem, not a card problem.'
  if (byCode?.test_mode_decline || byCode?.test_mode_test_card) {
    return 'Live checkout is running against test credentials, so no real charge can ever succeed. Replace the sandbox Whop API key with the production one and clear any sandbox flag, then redeploy.'
  }
  if (!failed) return 'Every payment in this window succeeded.'

  const config = byBucket?.config || 0
  const threeDs = byBucket?.three_ds || 0
  const issuer = (byBucket?.issuer || 0) + (byBucket?.bank_rails || 0)

  if (config >= failed / 2) {
    return `Most failures (${config} of ${failed}) are configuration or risk blocks on our side, led by ${topCode(byCode)}. These are not the buyers' cards — fix them in the Whop dashboard.`
  }
  if (threeDs >= failed / 2) {
    return `Most failures (${threeDs} of ${failed}) are 3D Secure challenges the buyer never completed. Set three_ds_level to frictionless on the checkout so low-risk charges skip the challenge.`
  }
  if (failureRate >= 50) {
    return `${failureRate}% of attempts are failing, mostly issuer declines (${issuer} of ${failed}, led by ${topCode(byCode)}). A rate this high is not normal card noise: it usually means the amount is large for the buyers' region and their banks are blocking international USD charges. Enable adaptive pricing so they are billed in local currency.`
  }
  return `${failureRate}% of attempts failed, almost all issuer declines led by ${topCode(byCode)}. That is ordinary decline noise; the buyers need to use a different card.`
}

/**
 * Page the company's payments. `probe` takes a path and resolves to whopProbe's
 * `{ ok, data, reason, message }` shape. A failure on the first page is
 * reported rather than swallowed — usually a missing `payment:basic:read`,
 * which would otherwise look identical to "no payments exist".
 */
export async function fetchRecentPayments(probe, companyId, buildQuery, pages = 3, pageSize = 100) {
  const rows = []
  let after = ''
  let error = null
  for (let page = 0; page < pages; page++) {
    const got = await probe('/payments?' + buildQuery({
      company_id: companyId,
      first: pageSize,
      order: 'created_at',
      direction: 'desc',
      after: after || undefined,
    }))
    if (!got?.ok) {
      if (!page) error = { reason: got?.reason || 'whop_error', message: got?.message || 'Could not read payments.' }
      break
    }
    const data = got.data
    const batch = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
    rows.push(...batch)
    const info = data?.page_info || data?.pagination
    after = info && info.has_next_page !== false ? String(info.end_cursor || info.next_cursor || '') : ''
    if (!after) break
  }
  return { rows, error }
}
