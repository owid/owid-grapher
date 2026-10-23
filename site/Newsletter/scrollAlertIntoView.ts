import { getPrefersReducedMotion } from "@ourworldindata/components"

/**
 * Called from the submit handler after a `flushSync` state update has put the
 * alert in the DOM, so a failed submit scrolls to its message even when the
 * submit button sits below the fields.
 */
export function scrollAlertIntoView(alert: HTMLElement | null): void {
    alert?.scrollIntoView({
        behavior: getPrefersReducedMotion() ? "auto" : "smooth",
        block: "center",
    })
}
