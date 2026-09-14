import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

/**
 * Logs expand/collapse of a metadata section toggle.
 *
 * One shared helper, deliberately: the data page metadata experiment compares
 * these events across arms, so the control design (AboutThisData,
 * MetadataSection) and the treatment design (IndicatorMetadataBox) must emit
 * byte-identical event names — a rename applied to one copy would silently
 * desynchronise the arms and bias every engagement metric. `target` is a
 * codified identifier rather than the rendered label, so events survive page
 * translation.
 */
export function logExpandableToggle(target: string, isOpen: boolean): void {
    analytics.logSiteClick(
        isOpen ? "expand_expandable_toggle" : "collapse_expandable_toggle",
        target
    )
}
