import { Deploy, DeployMetadata, DeployStatus } from "@ourworldindata/utils"
import * as _ from "lodash-es"
import {
    BUILDKITE_API_ACCESS_TOKEN,
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG,
    BUILDKITE_BRANCH,
    BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL,
} from "../settings/serverSettings.js"
import fs from "fs-extra"

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

interface BuildkiteBuild {
    number: number
    state: BuildState
    message?: string
    created_at?: string
    creator?: {
        name?: string
        email?: string
    }
}

const queuedBuildStates: BuildState[] = ["scheduled"]
const pendingBuildStates: BuildState[] = ["running", "canceling", "failing"]

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

export class BuildkiteTrigger {
    private readonly organizationSlug = "our-world-in-data"
    private readonly pipelineSlug = BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG
    private readonly branch = BUILDKITE_BRANCH
    private readonly buildsUrl = `https://api.buildkite.com/v2/organizations/${this.organizationSlug}/pipelines/${this.pipelineSlug}/builds`

    private get headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BUILDKITE_API_ACCESS_TOKEN}`,
        }
    }

    async triggerBuild(
        message: string,
        env: { [key: string]: string }
    ): Promise<number> {
        // Trigger buildkite build and return its number.
        const apiAccessToken = BUILDKITE_API_ACCESS_TOKEN
        if (!apiAccessToken) {
            throw new Error(
                "BUILDKITE_API_ACCESS_TOKEN environment variable not set"
            )
        }

        const payload = {
            commit: "HEAD",
            branch: this.branch,
            message: message,
            env: { ...env, BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL },
        }

        const response = await fetch(this.buildsUrl, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(payload),
        })

        if (response.status === 201) {
            console.log("Build successfully triggered!")
            const resp = (await response.json()) as BuildkiteBuild
            return resp.number
        } else {
            const errorText = await response.text()
            throw new Error(`Error: ${response.status}\n${errorText}`)
        }
    }

    async waitForBuildToFinish(buildNumber: number): Promise<void> {
        // Wait for build to finish.
        const url = `${this.buildsUrl}/${buildNumber}`

        let state: BuildState = "scheduled"

        while ([...queuedBuildStates, ...pendingBuildStates].includes(state)) {
            // Wait for 10 seconds
            await new Promise((res) => setTimeout(res, 10000))

            const response = await fetch(url, {
                method: "GET",
                headers: this.headers,
            })
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Error: ${response.status}\n${errorText}`)
            }

            const buildData = (await response.json()) as BuildkiteBuild
            state = buildData.state
        }

        if (!["passed", "skipped", "canceled", "finished"].includes(state)) {
            // failing states: failed, blocked, not_run
            throw new Error(
                `Build ${buildNumber} failed with state "${state}". See Buildkite for details.`
            )
        }
    }

    async getUnfinishedDeploys(): Promise<Deploy[]> {
        const url = new URL(this.buildsUrl)
        url.searchParams.set("branch", this.branch)
        url.searchParams.set("per_page", "50")

        const response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        })
        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Error: ${response.status}\n${errorText}`)
        }

        const builds = (await response.json()) as BuildkiteBuild[]
        const queuedChanges = builds
            .filter((build) => queuedBuildStates.includes(build.state))
            .map((build) => this.buildkiteBuildToDeployChange(build))
        const pendingChanges = builds
            .filter((build) => pendingBuildStates.includes(build.state))
            .map((build) => this.buildkiteBuildToDeployChange(build))

        return [
            ...(queuedChanges.length
                ? [
                      {
                          status: DeployStatus.queued,
                          changes: queuedChanges,
                      },
                  ]
                : []),
            ...(pendingChanges.length
                ? [
                      {
                          status: DeployStatus.pending,
                          changes: pendingChanges,
                      },
                  ]
                : []),
        ]
    }

    private buildkiteBuildToDeployChange(build: BuildkiteBuild) {
        return {
            timeISOString: build.created_at,
            authorName: build.creator?.name ?? build.creator?.email,
            authorEmail: build.creator?.email,
            message: build.message ?? `Buildkite build #${build.number}`,
        }
    }

    getLightningBuildMessage(
        gdocSlugs: string[],
        { title }: DeployMetadata
    ): string {
        const uniqueGdocSlugs = _.uniq(gdocSlugs)
        return `⚡️ ${title}${
            uniqueGdocSlugs.length > 1
                ? ` and ${uniqueGdocSlugs.length - 1} more updates`
                : ""
        }`
    }

    async triggerLightningBuild(
        gdocSlugs: string[],
        deployMetadata: DeployMetadata
    ): Promise<number> {
        const uniqueGdocSlugs = _.uniq(gdocSlugs)
        return this.triggerBuild(
            this.getLightningBuildMessage(gdocSlugs, deployMetadata),
            {
                LIGHTNING_GDOC_SLUGS: uniqueGdocSlugs.join(" "),
                CHANGES_SLACK_MENTIONS:
                    deployMetadata.changesSlackMentions.join("\n"),
            }
        )
    }

    async runLightningBuild(
        gdocSlugs: string[],
        deployMetadata: DeployMetadata
    ): Promise<void> {
        const buildNumber = await this.triggerLightningBuild(
            gdocSlugs,
            deployMetadata
        )
        await this.waitForBuildToFinish(buildNumber)
    }

    async getFullBuildMessage({
        title,
        changesSlackMentions,
    }: DeployMetadata): Promise<string> {
        return changesSlackMentions.length
            ? `🚚 ${title}${
                  changesSlackMentions.length > 1
                      ? ` and ${changesSlackMentions.length - 1} more updates`
                      : ""
              } `
            : await defaultCommitMessage()
    }

    async triggerFullBuild(deployMetadata: DeployMetadata): Promise<number> {
        return this.triggerBuild(
            await this.getFullBuildMessage(deployMetadata),
            {
                CHANGES_SLACK_MENTIONS:
                    deployMetadata.changesSlackMentions.join("\n"),
            }
        )
    }

    async runFullBuild(deployMetadata: DeployMetadata): Promise<void> {
        const buildNumber = await this.triggerFullBuild(deployMetadata)
        await this.waitForBuildToFinish(buildNumber)
    }
}
