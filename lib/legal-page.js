import { mountAnnounce } from './landing-page.js?v=d1fa2'
import { mountLandingToolsMenu } from './landing-tools-menu.js?v=d1fa2'
import { mountLandingFooter } from './landing-footer.js?v=d1fa1'
import { mountLandingIntegrations } from './landing-integrations.js'

export function mountLegalPage() {
  mountAnnounce()
  mountLandingToolsMenu()
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  mountLandingIntegrations()
}
