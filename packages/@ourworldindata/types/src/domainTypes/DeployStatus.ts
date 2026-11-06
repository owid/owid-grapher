/** One build of the content deploy pipeline, as the admin's /deploys page lists it */
export interface DeployBuild {
    number: number
    /** Buildkite's build state: "scheduled", "running", "passed", "failed", … */
    state: string
    message: string
    webUrl: string
    createdAt: string
}
