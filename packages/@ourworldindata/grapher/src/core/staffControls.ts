import { get as getCookie } from "es-cookie"
import { CookieKey } from "./GrapherConstants.js"

function hasAdminCookie(): boolean {
    // This cookie is set by visiting ourworldindata.org/identifyadmin on the static site.
    // There is an iframe on owid.cloud to trigger a visit to that page.
    try {
        // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
        // see https://github.com/owid/owid-grapher/pull/2452
        return !!getCookie(CookieKey.isAdmin)
    } catch {
        return false
    }
}

function isStagingOrLocalhost(): boolean {
    if (typeof location === "undefined") return false
    return (
        location.host.includes("staging") || location.host.includes("localhost")
    )
}

/**
 * Whether to show staff-only controls (edit links, copy buttons, …).
 *
 * The isAdmin cookie is `Secure`, so browsers never send it to staging servers,
 * which are served over plain http. We therefore show the controls on staging
 * and localhost regardless of the cookie.
 *
 * This is about visibility, not access control: anyone can set the cookie.
 */
export function shouldShowStaffControls(): boolean {
    return hasAdminCookie() || isStagingOrLocalhost()
}
