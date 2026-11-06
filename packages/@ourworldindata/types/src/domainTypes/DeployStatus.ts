/**
 * Committed admin edits request at most one content build per window, plus a
 * trailing one for what the window held (enqueueDeployChange in
 * baker/DeployUtils.ts). An ETL push calls the admin API once per indicator or
 * chart, a few hundred times in minutes; this turns that into a handful of
 * requests.
 *
 * Keep it longer than a content build takes (about 3½ min on prod in November
 * 2026, with the archive), so requests never come faster than builds finish
 * and don't queue up behind the deploy lock. If bakes get slower, raise it.
 */
export const DEPLOY_REQUEST_WINDOW_MS = 5 * 60_000

/** One build of the content deploy pipeline, as the admin's /deploys page lists it */
export interface DeployBuild {
    number: number
    /** Buildkite's build state: "scheduled", "running", "passed", "failed", … */
    state: string
    message: string
    webUrl: string
    createdAt: string
}
