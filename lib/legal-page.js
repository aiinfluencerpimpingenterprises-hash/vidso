import { mountAnnounce, mountNavShrink } from './landing-page.js?v=d1fa9'
import { mountLandingFooter } from './landing-footer.js?v=d1fa1'
import { mountLandingIntegrations } from './landing-integrations.js'

export function mountLegalPage() {
  mountAnnounce()
  mountNavShrink()
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  mountLandingIntegrations()
}
