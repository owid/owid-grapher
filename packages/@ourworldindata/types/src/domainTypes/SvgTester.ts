export const SVG_TESTER_SUITES = [
    "graphers",
    "grapher-views",
    "mdims",
    "thumbnails",
] as const
export type SvgTesterSuite = (typeof SVG_TESTER_SUITES)[number]

export const SVG_TESTER_DIRECTORIES = ["references", "differences"] as const
export type SvgTesterDirectory = (typeof SVG_TESTER_DIRECTORIES)[number]

export const SVG_TESTER_VERIFY_RESULTS_FILENAME = "verify-results.json"

export type SvgTesterVerifyRunStatus =
    | "running"
    | "ok"
    | "differences"
    | "error"

export interface SvgTesterVerifyDifferenceEntry {
    viewId: string
    queryStr?: string
    chartType?: string
    svgFilename: string
    changedRatio?: number
}

export interface SvgTesterVerifyErrorEntry {
    viewId: string
    kind: "timeout" | "render"
    message: string
}

export interface SvgTesterVerifyRunSummary {
    suite: SvgTesterSuite
    status: SvgTesterVerifyRunStatus
    startedAt: string
    durationMs: number
    grapherCommit: string | null
    svgsCommit: string | null
    counts: {
        total: number
        ok: number
        differences: number
        errors: number
    }
    differences: SvgTesterVerifyDifferenceEntry[]
    errors: SvgTesterVerifyErrorEntry[]
}

export interface SvgTesterSuiteStatus {
    suite: SvgTesterSuite
    /** Null when the suite has never run */
    results: SvgTesterVerifyRunSummary | null
    /** True when the results describe a different grapher commit than the one checked out */
    isStale: boolean
    /** True when the file exists but could not be parsed (killed mid-write). */
    isUnreadable: boolean
}
