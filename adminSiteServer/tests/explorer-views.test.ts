import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ExplorerViewsTableName,
    ExplorersTableName,
    JobsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { processOneExplorerViewsJob } from "../../jobQueue/explorerJobProcessor.js"

const env = getAdminTestEnv()

async function processUntilNoQueued(slug: string, max = 5): Promise<void> {
    for (let i = 0; i < max; i++) {
        const queued = await env.testKnex!(JobsTableName)
            .where({ type: "refresh_explorer_views", state: "queued" })
            .andWhereRaw(`JSON_EXTRACT(payload, '$.slug') = ?`, [slug])
        if (queued.length === 0) return
        await processOneExplorerViewsJob()
    }
}

describe("Explorer views async queue", { timeout: 20000 }, () => {
    /*
     Scenario: Happy path end-to-end processing
     - Publishes an explorer that references two valid charts, which enqueues a views refresh job.
     - Runs the worker until no queued jobs remain for this slug.
     - Validates that the job is marked done, explorer status is clean, and two views are created with configs.
    */
    const testExplorerSlug = "test-async-explorer-views"

    it("queues, processes, and marks job done, creating views", async () => {
        // Create charts referenced by explorer
        const chart1 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-1",
                title: "Test Chart 1",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-2",
                title: "Test Chart 2",
                chartTypes: ["ScatterPlot"],
            }),
        })

        const explorerTsv = `explorerTitle\tTest Async Explorer
explorerSubtitle\tTest explorer for async job queue processing.
isPublished\ttrue
graphers
\tchartId\tTest Radio
\t${chart1.chartId}\tTest Chart 1
\t${chart2.chartId}\tTest Chart 2`

        // PUT twice to mark as published and ensure queuing
        // Double PUT quirk: First PUT may only set initial state without queuing;
        // second PUT reliably enqueues the refresh job for published explorers.
        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({ tsv: explorerTsv, commitMessage: "init" }),
        })
        const response = await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: explorerTsv,
                commitMessage: "publish",
            }),
        })
        expect(response.success).toBe(true)
        expect(response.status).toBe("queued")

        const explorer = await env.testKnex!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(explorer).toBeTruthy()
        expect(explorer.viewsRefreshStatus).toBe("queued")

        const job = await env.testKnex!(JobsTableName)
            .where({ type: "refresh_explorer_views", state: "queued" })
            .andWhereRaw(`JSON_EXTRACT(payload, '$.slug') = ?`, [
                testExplorerSlug,
            ])
            .first()
        expect(job).toBeTruthy()
        expect(job.state).toBe("queued")

        const before = await env.getCount(ExplorerViewsTableName)
        expect(before).toBe(0)

        await processUntilNoQueued(testExplorerSlug)

        // Query the last job for this slug and ensure it is done
        const completedJob = await env.testKnex!(JobsTableName)
            .whereRaw(`JSON_EXTRACT(payload, '$.slug') = ?`, [testExplorerSlug])
            .orderBy("id", "desc")
            .first()
        expect(completedJob.state).toBe("done")

        const updatedExplorer = await env.testKnex!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(updatedExplorer.viewsRefreshStatus).toBe("clean")

        const afterCount = await env.getCount(ExplorerViewsTableName)
        expect(afterCount).toBe(2)
    })
})
