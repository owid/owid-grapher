import fs from "fs-extra"
import { DeployBuild, DeployMetadata } from "@ourworldindata/utils"
import {
    BUILDKITE_API_ACCESS_TOKEN,
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG,
    BUILDKITE_BRANCH,
    BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL,
} from "../settings/serverSettings.js"

const ORGANIZATION_SLUG = "our-world-in-data"
const REQUEST_TIMEOUT_MS = 10_000

const defaultCommitMessage = async (): Promise<string> => {
    let message = "Automated update"

    // In the deploy.sh script, we write the current git rev to 'public/head.txt'
    // and want to include it in the deploy commit message
    try {
        const sha = await fs.readFile("public/head.txt", "utf8")
        message += `\nowid/owid-grapher@${sha}`
    } catch (err) {
        console.warn(err)
    }

    return message
}

interface BuildkiteBuildResponse {
    number: number
    state: string
    message: string | null
    web_url: string
    created_at: string
    started_at: string | null
    finished_at: string | null
}

export class BuildkiteTrigger {
    private readonly pipelineSlug = BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG
    private readonly branch = BUILDKITE_BRANCH

    private get buildsUrl(): string {
        return `https://api.buildkite.com/v2/organizations/${ORGANIZATION_SLUG}/pipelines/${this.pipelineSlug}/builds`
    }

    private get headers(): Record<string, string> {
        if (!BUILDKITE_API_ACCESS_TOKEN)
            throw new Error(
                "BUILDKITE_API_ACCESS_TOKEN environment variable not set"
            )
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BUILDKITE_API_ACCESS_TOKEN}`,
        }
    }

    /** Trigger a build and return its number, without waiting for it */
    private async triggerBuild(
        message: string,
        env: Record<string, string>
    ): Promise<number> {
        const payload = {
            commit: "HEAD",
            branch: this.branch,
            message: message,
            env: { ...env, BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL },
            // Staging deploys trigger this build for a specific branch via the API.
            // Without this flag, the build is rejected with 422 "Branches have been
            // disabled for this pipeline" whenever the target pipeline has the "Build
            // branches" trigger turned off. We deliberately want this branch build, so
            // bypass the pipeline's branch trigger/filter rules.
            ignore_pipeline_branch_filters: true,
        }

        const response = await fetch(this.buildsUrl, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })

        if (response.status === 201) {
            const build: BuildkiteBuildResponse = await response.json()
            console.log(`Requested Buildkite build ${build.number}`)
            return build.number
        }

        const errorText = await response.text()
        const explanation = errorText.includes("Branches have been disabled")
            ? " — likely cause: this branch no longer exists on GitHub (e.g. its PR was merged/closed) or the pipeline's branch filter is misconfigured in Buildkite"
            : ""
        throw new Error(
            `Error triggering Buildkite build on pipeline "${this.pipelineSlug}" for branch "${this.branch}": ${response.status}\n${errorText}${explanation}`
        )
    }

    /**
     * Request one content deploy (a full bake) and return its build number.
     *
     * `requestedAt` (unix seconds) lets the deploy skip its bake when a full
     * bake that started after it has already gone out ("covered", see
     * templates/common.sh in owid/ops).
     */
    async requestContentBuild(
        { title, changesSlackMentions }: DeployMetadata,
        requestedAt: Date
    ): Promise<number> {
        const message = changesSlackMentions.length
            ? `🚚 ${title}${
                  changesSlackMentions.length > 1
                      ? ` and ${changesSlackMentions.length - 1} more updates`
                      : ""
              }`
            : await defaultCommitMessage()

        return this.triggerBuild(message, {
            CONTENT_DEPLOY: "1",
            DEPLOY_REQUESTED_AT: String(
                Math.floor(requestedAt.getTime() / 1000)
            ),
            CHANGES_SLACK_MENTIONS: changesSlackMentions.join("\n"),
        })
    }

    /** The latest builds of the content deploy pipeline for this branch */
    async listRecentBuilds(count = 30): Promise<DeployBuild[]> {
        const url = new URL(this.buildsUrl)
        url.searchParams.set("branch", this.branch)
        url.searchParams.set("per_page", String(count))
        url.searchParams.set("exclude_jobs", "true")
        url.searchParams.set("exclude_pipeline", "true")

        const response = await fetch(url, {
            headers: this.headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!response.ok)
            throw new Error(
                `Error listing Buildkite builds on pipeline "${this.pipelineSlug}": ${response.status}\n${await response.text()}`
            )

        const builds: BuildkiteBuildResponse[] = await response.json()
        return builds.map((build) => ({
            number: build.number,
            state: build.state,
            message: build.message ?? "",
            webUrl: build.web_url,
            createdAt: build.created_at,
            startedAt: build.started_at ?? undefined,
            finishedAt: build.finished_at ?? undefined,
        }))
    }
}
