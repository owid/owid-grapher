import { BUILDKITE_API_ACCESS_TOKEN } from "../settings/serverSettings.js"

export class BuildkiteTrigger {
    private organizationSlug = "our-world-in-data"
    private pipelineSlug = "grapher-cloudflare-pages-deploy-queue"

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
            branch: "master",
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

        let status = ""

        // Poll the status every 10 seconds (or your preferred interval)
        while (status !== "passed" && status !== "failed") {
            const response = await fetch(url, {
                method: "GET",
                headers: headers,
            })
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Error: ${response.status}\n${errorText}`)
            }

            const buildData = await response.json()
            status = buildData.state

            if (status !== "passed" && status !== "failed") {
                await new Promise((res) => setTimeout(res, 10000)) // Wait for 10 seconds
            }
        }

        if (status === "passed") {
            return
        } else {
            throw new Error("Build failed! See Buildkite for details.")
        }
    }

    async runLightningBuild(
        message: string,
        gdocSlugs: string[]
    ): Promise<void> {
        const buildNumber = await this.triggerBuild(message, {
            LIGHTNING_GDOC_SLUGS: gdocSlugs.join(" "),
        })
        await this.waitForBuildToFinish(buildNumber)
    }

    async runFullBuild(message: string): Promise<void> {
        const buildNumber = await this.triggerBuild(message, {})
        await this.waitForBuildToFinish(buildNumber)
    }
}
