import { SvgTesterSuiteOverview } from "@ourworldindata/types"

export type SvgTesterDisplayStatus =
    | "not-run"
    | "unreadable"
    | "running"
    | "error"
    | "differences"
    | "ok"

export const DISPLAY_STATUS_LABELS: Record<SvgTesterDisplayStatus, string> = {
    "not-run": "Not run",
    unreadable: "No result (file unreadable)",
    running: "No result (killed or still running)",
    error: "Error",
    differences: "Differences",
    ok: "No differences",
}

export function displayStatus(
    status: SvgTesterSuiteOverview
): SvgTesterDisplayStatus {
    if (status.isUnreadable) return "unreadable"
    if (!status.results) return "not-run"
    if (status.results.status === "running") return "running"
    if (status.results.status === "error") return "error"
    if (status.results.status === "differences") return "differences"
    return "ok"
}

/** True only when the run actually finished and reported */
export function hasReportedResult(status: SvgTesterSuiteOverview): boolean {
    const display = displayStatus(status)
    return display === "ok" || display === "differences" || display === "error"
}

/** True when the suite page has something to show: differences or render errors */
export function hasFindings(status: SvgTesterSuiteOverview): boolean {
    const counts = status.results?.counts
    if (!counts) return false
    return counts.differences > 0 || counts.errors > 0
}

export function formatDuration(durationMs: number): string {
    if (durationMs < 1000) return `${durationMs} ms`
    const seconds = durationMs / 1000
    if (seconds < 90) return `${seconds.toFixed(0)} s`
    return `${(seconds / 60).toFixed(1)} min`
}
