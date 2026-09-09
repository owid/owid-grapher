import { CookieKey } from "@ourworldindata/grapher"

/**
 * Whether this browser belongs to a staff member, which is what gates the
 * admin-only affordances on public pages (the gdoc/admin bar, "Copy for
 * social", the link to a page's admin preview).
 *
 * Set by visiting /identifyadmin on the static site; an iframe on owid.cloud
 * triggers that visit, so anyone who has been in the admin has it. It marks a
 * browser as staff's - it is not a credential, and grants nothing: everything
 * it reveals is either already public or separately authenticated.
 */
export function hasAdminCookie(): boolean {
    try {
        // Reading cookies can throw when the page is in a sandboxed iframe
        // (see https://github.com/owid/owid-grapher/pull/2452)
        return document.cookie.includes(CookieKey.isAdmin)
    } catch {
        return false
    }
}
