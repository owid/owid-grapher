import { afterEach, describe, expect, it, vi } from "vitest"

import { BuildkiteTrigger } from "./BuildkiteTrigger.js"

describe(BuildkiteTrigger, () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("deduplicates gdoc slugs for lightning builds", async () => {
        const buildkite = new BuildkiteTrigger()
        const triggerBuild = vi
            .spyOn(buildkite, "triggerBuild")
            .mockResolvedValue(123)
        const waitForBuildToFinish = vi
            .spyOn(buildkite, "waitForBuildToFinish")
            .mockResolvedValue(undefined)

        await buildkite.runLightningBuild(
            ["hiring-writer-2026", "hiring-writer-2026"],
            {
                title: "Lightning update hiring-writer-2026",
                changesSlackMentions: [],
            }
        )

        expect(triggerBuild).toHaveBeenCalledWith(
            "⚡️ Lightning update hiring-writer-2026",
            {
                LIGHTNING_GDOC_SLUGS: "hiring-writer-2026",
                CHANGES_SLACK_MENTIONS: "",
            }
        )
        expect(waitForBuildToFinish).toHaveBeenCalledWith(123)
    })
})
