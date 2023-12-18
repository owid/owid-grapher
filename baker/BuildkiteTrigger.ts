import {
    BUILDKITE_API_ACCESS_TOKEN,
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG,
    BUILDKITE_BRANCH,
} from "../settings/serverSettings.js"

type BuildState =
    | "running"
    | "scheduled"
    | "passed"
    | "failing"
    | "failed"
    | "blocked"
    | "canceled"
    | "canceling"
    | "skipped"
    | "not_run"
    | "finished"

export class BuildkiteTrigger {
    private organizationSlug = "our-world-in-data"
    private pipelineSlug = BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG
    private branch = BUILDKITE_BRANCH

    async triggerBuild(
        message: string,
        env: { [key: string]: string }
    ): Promise<number> {
        // Trigger buildkite build and return its number.
        const url = `https://api.buildkite.com/v2/organizations/${this.organizationSlug}/pipelines/${this.pipelineSlug}/builds`

        const apiAccessToken = BUILDKITE_API_ACCESS_TOKEN
        if (!apiAccessToken) {
            throw new Error(
                "BUILDKITE_API_ACCESS_TOKEN environment variable not set"
            )
        }

        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BUILDKITE_API_ACCESS_TOKEN}`,
        }

        const payload = {
            commit: "HEAD",
            branch: this.branch,
            message: message,
            env: env,
        }

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload),
        })

        if (response.status === 201) {
            console.log("Build successfully triggered!")
            const resp = await response.json()
            return resp.number
        } else {
            const errorText = await response.text()
            throw new Error(`Error: ${response.status}\n${errorText}`)
        }
    }

    async waitForBuildToFinish(buildNumber: number): Promise<void> {
        // Wait for build to finish.
        const url = `https://api.buildkite.com/v2/organizations/${this.organizationSlug}/pipelines/${this.pipelineSlug}/builds/${buildNumber}`

        const headers = {
            Authorization: `Bearer ${BUILDKITE_API_ACCESS_TOKEN}`,
        }

        let state: BuildState = "scheduled"

        while (
            ["running", "scheduled", "canceling", "failing"].includes(state)
        ) {
            // Wait for 10 seconds
            await new Promise((res) => setTimeout(res, 10000))

            const response = await fetch(url, {
                method: "GET",
                headers: headers,
            })
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Error: ${response.status}\n${errorText}`)
            }

            const buildData = await response.json()
            state = buildData.state
        }

        if (!["passed", "skipped", "canceled", "finished"].includes(state)) {
            // failing states: failed, blocked, not_run
            throw new Error(
                `Build ${buildNumber} failed with state "${state}". See Buildkite for details.`
            )
        }
    }

    async runLightningGdocBuild(
        message: string,
        gdocSlugs: string[]
    ): Promise<void> {
        if (!gdocSlugs.length) {
            return
        }
        const buildNumber = await this.triggerBuild(message, {
            LIGHTNING_GDOC_SLUGS: gdocSlugs.join(" "),
        })
        await this.waitForBuildToFinish(buildNumber)
    }

    async runLightningChartBuild(
        message: string,
        chartSlugs: string[]
    ): Promise<void> {
        if (!chartSlugs.length) {
            return
        }
        const buildNumber = await this.triggerBuild(message, {
            LIGHTNING_CHART_SLUGS: chartSlugs.join(" "),
        })
        await this.waitForBuildToFinish(buildNumber)
    }

    async runFullBuild(message: string): Promise<void> {
        const buildNumber = await this.triggerBuild(message, {})
        await this.waitForBuildToFinish(buildNumber)
    }
}
