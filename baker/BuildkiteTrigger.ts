import { DeployMetadata } from "@ourworldindata/utils"
import {
    BUILDKITE_API_ACCESS_TOKEN,
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG,
    BUILDKITE_BRANCH,
} from "../settings/serverSettings.js"
import { defaultCommitMessage } from "./DeployUtils.js"

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

    async runLightningBuild(
        gdocSlugs: string[],
        { title, changesSlackMentions }: DeployMetadata
    ): Promise<void> {
        const message = `⚡️ ${title}${
            gdocSlugs.length > 1
                ? ` and ${gdocSlugs.length - 1} more updates`
                : ""
        }`
        const buildNumber = await this.triggerBuild(message, {
            LIGHTNING_GDOC_SLUGS: gdocSlugs.join(" "),
            CHANGES_SLACK_MENTIONS: changesSlackMentions.join("\n"),
        })
        await this.waitForBuildToFinish(buildNumber)
    }

    async runFullBuild({
        title,
        changesSlackMentions,
    }: DeployMetadata): Promise<void> {
        const message = changesSlackMentions.length
            ? `🚚 ${title}${
                  changesSlackMentions.length > 1
                      ? ` and ${changesSlackMentions.length - 1} more updates`
                      : ""
              } `
            : await defaultCommitMessage()

        const buildNumber = await this.triggerBuild(message, {
            CHANGES_SLACK_MENTIONS: changesSlackMentions.join("\n"),
        })
        await this.waitForBuildToFinish(buildNumber)
    }
}
