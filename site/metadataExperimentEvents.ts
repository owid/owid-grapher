import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

/**
 * Logs expand/collapse of a metadata section toggle. Shared by both data page
 * designs so they emit identical event names. `target` is a codified id, not
 * the rendered label, so events survive page translation.
 */
export function logExpandableToggle(target: string, isOpen: boolean): void {
    analytics.logSiteClick(
        isOpen ? "expand_expandable_toggle" : "collapse_expandable_toggle",
        target
    )
}
