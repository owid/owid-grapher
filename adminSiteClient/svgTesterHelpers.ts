import {
    SVG_TESTER_HEARTBEAT_STALE_MS,
    SvgTesterSuiteOverview,
    SvgTesterVerifyRunOverview,
} from "@ourworldindata/types"

export type SvgTesterDisplayStatus =
    | "not-run"
    | "unreadable"
    | "running"
    | "stalled"
    | "error"
    | "differences"
    | "ok"

export const DISPLAY_STATUS_LABELS: Record<SvgTesterDisplayStatus, string> = {
    "not-run": "Not run",
    unreadable: "Results file unreadable",
    running: "Running",
    stalled: "Stopped mid-run",
    error: "Error",
    differences: "Differences",
    ok: "No differences",
}

export function displayStatus(
    status: SvgTesterSuiteOverview
): SvgTesterDisplayStatus {
    if (status.isUnreadable) return "unreadable"
    if (!status.results) return "not-run"
    if (status.results.status === "running")
        return isHeartbeatStale(status.results) ? "stalled" : "running"
    if (status.results.status === "error") return "error"
    if (status.results.status === "differences") return "differences"
    return "ok"
}

/** True only when the run actually finished and reported */
export function hasReportedResult(status: SvgTesterSuiteOverview): boolean {
    const display = displayStatus(status)
    return display === "ok" || display === "differences" || display === "error"
}

/** True for a run that started and hasn't reported, whether it is alive or dead */
export function isUnderway(status: SvgTesterSuiteOverview): boolean {
    const display = displayStatus(status)
    return display === "running" || display === "stalled"
}

/** True when the suite page has something to show: differences or render errors */
export function hasFindings(status: SvgTesterSuiteOverview): boolean {
    const counts = status.results?.counts
    if (!counts) return false
    return counts.differences > 0 || counts.errors > 0
}

/** How far a run has got, or nothing until it knows how much work it has */
export function runProgress(
    results: SvgTesterVerifyRunOverview
): { done: number; total: number; percent: number } | undefined {
    const { total, ok, differences, errors } = results.counts
    if (!total) return undefined
    const done = ok + differences + errors
    return { done, total, percent: Math.round((done / total) * 100) }
}

/**
 * A running suite rewrites its results every few seconds whether or not a chart
 * finished, so a heartbeat that stopped means the run itself stopped.
 */
function isHeartbeatStale(results: SvgTesterVerifyRunOverview): boolean {
    const updatedAt = Date.parse(results.updatedAt)
    // No readable heartbeat means the file predates them, and every one of those
    // runs is long over.
    if (!Number.isFinite(updatedAt)) return true
    return Date.now() - updatedAt > SVG_TESTER_HEARTBEAT_STALE_MS
}

export function formatDuration(durationMs: number): string {
    if (durationMs < 1000) return `${durationMs} ms`
    const seconds = durationMs / 1000
    if (seconds < 90) return `${seconds.toFixed(0)} s`
    return `${(seconds / 60).toFixed(1)} min`
}
