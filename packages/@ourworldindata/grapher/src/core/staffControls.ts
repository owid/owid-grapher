/**
 * Whether to show staff-only controls (edit links, copy buttons, …).
 *
 * Labs is reachable only over the tailnet, so everyone on it is staff. Master
 * checks for the isAdmin cookie or a staging host here, and labs.owid.io has
 * neither: the cookie is set only on ourworldindata.org, and the name doesn't
 * contain "staging".
 */
export function shouldShowStaffControls(): boolean {
    return true
}
