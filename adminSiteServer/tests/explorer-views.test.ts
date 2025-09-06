import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ExplorerViewsTableName,
    ExplorersTableName,
    ChartConfigsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { processOneExplorerViewsJob } from "../../jobQueue/explorerJobProcessor.js"

const env = getAdminTestEnv()

describe("Explorer Views Integration", { timeout: 15000 }, () => {
    const testExplorerSlug = "test-food-prices"

    const testExplorerTsv = `explorerTitle	Test Food Prices
explorerSubtitle	Test explorer for explorer views integration.
isPublished	true
selection	Nigeria	Bangladesh
subNavId	explorers
subNavCurrentId	${testExplorerSlug}
wpBlockId
tab	map
graphers
	grapherId	Diet Radio	Cost or Affordability Radio	Affordability metric Radio
	4955	Healthy diet	Affordability	Share that cannot afford
	4958	Healthy diet	Affordability	Number that cannot afford`

    // Helper functions for testing explorer views
    async function getExplorerViewsCount(
        explorerSlug: string
    ): Promise<number> {
        const count = await env.testKnex!(ExplorerViewsTableName)
            .where({ explorerSlug })
            .count("* as count")
            .first()
        return Number(count?.count || 0)
    }

    async function getExplorerViewsWithConfigs(explorerSlug: string) {
        return await env.testKnex!(ExplorerViewsTableName)
            .select("dimensions", "chartConfigId", "error")
            .where({ explorerSlug })
            .orderBy("id")
    }

    async function getChartConfigsCount(): Promise<number> {
        const count = await env.testKnex!(ChartConfigsTableName)
            .count("* as count")
            .first()
        return Number(count?.count || 0)
    }

    async function verifyChartConfigExists(
        chartConfigId: string
    ): Promise<boolean> {
        const config = await env.testKnex!(ChartConfigsTableName)
            .where({ id: chartConfigId })
            .first()
        return !!config
    }

    it("should create explorer views when a new explorer is added via API", async () => {
        // Verify clean state
        expect(await env.getCount(ExplorersTableName)).toBe(0)
        expect(await env.getCount(ExplorerViewsTableName)).toBe(0)
        expect(await getChartConfigsCount()).toBe(0)

        // Create the charts that the explorer will reference
        const chart1Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-4955",
                title: "Test Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-4958",
                title: "Test Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        // Create explorer via API
        const response = await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test explorer creation",
            }),
        })

        expect(response.success).toBe(true)

        // Check that explorer was created
        const explorerCount = await env.getCount(ExplorersTableName)
        expect(explorerCount).toBe(1)

        // Verify the explorer exists - new explorers are initially unpublished
        const explorer = await env.testKnex!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(explorer).toBeTruthy()
        expect(explorer.isPublished).toBe(0) // New explorers are unpublished by default (0 = false)

        // Since the explorer is not published, no views should be created initially
        const viewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCount).toBe(0)

        // Now update the explorer to be published
        // Note: the upsertExplorer function changes isPublished to false for new explorers,
        // but our original TSV has isPublished\ttrue, so we need to ensure it's set to true
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer",
            }),
        })

        // Verify the explorer is now published and views are created
        const publishedExplorer = await env.testKnex!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(publishedExplorer.isPublished).toBe(1) // 1 = true for published

        // Views are not created immediately - they need async processing
        const viewsCountBefore = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCountBefore).toBe(0)

        // Process the async job to create explorer views
        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        // Check that explorer views were created
        const publishedViewsCount =
            await getExplorerViewsCount(testExplorerSlug)
        expect(publishedViewsCount).toBeGreaterThan(0)

        // Verify view structure
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        expect(views.length).toBe(2) // Two charts in our test data

        // Check that each view has the expected structure
        for (const view of views) {
            expect(view.dimensions).toBeTruthy()

            // Parse the explorer view JSON
            const parsedView = JSON.parse(view.dimensions)
            // The actual property names are simpler (without "Radio" suffix)
            expect(parsedView).toHaveProperty("Diet", "Healthy diet")
            expect(parsedView).toHaveProperty(
                "Cost or Affordability",
                "Affordability"
            )
            expect(parsedView).toHaveProperty("Affordability metric")

            // Either should have a chartConfigId or an error, but not both
            if (view.chartConfigId) {
                expect(view.error).toBeNull()
                expect(await verifyChartConfigExists(view.chartConfigId)).toBe(
                    true
                )
            } else {
                expect(view.error).toBeTruthy()
                expect(view.chartConfigId).toBeNull()
            }
        }

        // Check that chart configs were created for successful views
        const successfulViews = views.filter((v) => v.chartConfigId)
        const finalChartConfigsCount = await getChartConfigsCount()
        // Should have at least the original 2 charts plus configs for successful views
        expect(finalChartConfigsCount).toBeGreaterThanOrEqual(
            2 + successfulViews.length
        )
    })

    it("should update explorer views when an explorer is modified via API", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4955",
                title: "Test Update Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4958",
                title: "Test Update Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })
        const chart3Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4954",
                title: "Test Update Chart 4954",
                chartTypes: ["LineChart"],
            }),
        })

        // Create initial published explorer
        const initialTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: initialTsv,
                commitMessage: "Initial explorer creation",
            }),
        })

        const initialViewsCount = await getExplorerViewsCount(testExplorerSlug)

        // Update the explorer with modified TSV (add a third chart)
        const updatedTsv =
            initialTsv +
            `\n\t${chart3Response.chartId}\tNutrient adequate diet\tAffordability\tShare that cannot afford`

        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: updatedTsv,
                commitMessage: "Add third chart option",
            }),
        })

        // Views are not created immediately - they need async processing
        const viewsCountBefore = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCountBefore).toBe(0)

        // Process the async job to create explorer views
        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        // Check that views were updated
        const updatedViewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(updatedViewsCount).toBe(3) // Should now have 3 views
        expect(updatedViewsCount).toBeGreaterThan(initialViewsCount)

        // Verify the new view exists
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        const nutrientAdequateView = views.find((v) => {
            const parsed = JSON.parse(v.dimensions)
            return parsed["Diet"] === "Nutrient adequate diet"
        })
        expect(nutrientAdequateView).toBeTruthy()

        // Chart configs should have been created for any new successful views
        const finalChartConfigsCount = await getChartConfigsCount()
        // Should have original 3 charts plus configs for successful views
        expect(finalChartConfigsCount).toBeGreaterThanOrEqual(3)
    })

    it("should clean up explorer views when explorer is deleted via API", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-delete-4955",
                title: "Test Delete Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-delete-4958",
                title: "Test Delete Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        // Create explorer first
        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test deletion cleanup",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer for deletion test",
            }),
        })

        // Views are not created immediately - they need async processing
        const viewsCountBefore = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCountBefore).toBe(0)

        // Process the async job to create explorer views
        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        const initialViewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(initialViewsCount).toBeGreaterThan(0)

        // Get chart config IDs before deletion
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        const chartConfigIds = views
            .filter((v) => v.chartConfigId)
            .map((v) => v.chartConfigId)

        // Delete the explorer via API
        await env.request({
            method: "DELETE",
            path: `/explorers/${testExplorerSlug}`,
        })

        // Verify explorer is deleted
        const explorerExists = await env.testKnex!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(explorerExists).toBeFalsy()

        // Verify all explorer views are deleted (CASCADE)
        const remainingViews = await getExplorerViewsCount(testExplorerSlug)
        expect(remainingViews).toBe(0)

        // Verify chart configs are deleted (CASCADE from explorer_views)
        for (const chartConfigId of chartConfigIds) {
            const configExists = await verifyChartConfigExists(chartConfigId)
            expect(configExists).toBe(false)
        }

        const finalChartConfigsCount = await getChartConfigsCount()
        // Should only have the original 2 test charts left (explorer view configs are deleted)
        expect(finalChartConfigsCount).toBe(2)
    })

    it("should handle error cases gracefully", async () => {
        // Create an explorer with invalid grapher IDs that will cause errors
        const invalidTsv = `explorerTitle	Invalid Test Explorer
explorerSubtitle	Explorer with invalid grapher IDs.
isPublished	true
selection	Nigeria	Bangladesh
subNavId	explorers
subNavCurrentId	test-invalid
wpBlockId
tab	map
graphers
	grapherId	Diet Radio	Cost or Affordability Radio	Affordability metric Radio
	99999	Healthy diet	Affordability	Share that cannot afford
	99998	Healthy diet	Affordability	Number that cannot afford`

        await env.request({
            method: "PUT",
            path: "/explorers/test-invalid",
            body: JSON.stringify({
                tsv: invalidTsv,
                commitMessage: "Test error handling",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        // This allows explorer views to be created even for invalid chart IDs (they'll have errors)
        const publishedInvalidTsv = invalidTsv.includes("isPublished\tfalse")
            ? invalidTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : invalidTsv // TSV already has isPublished\ttrue
        await env.request({
            method: "PUT",
            path: "/explorers/test-invalid",
            body: JSON.stringify({
                tsv: publishedInvalidTsv,
                commitMessage: "Publish explorer for error test",
            }),
        })

        // Views are not created immediately - they need async processing
        const viewsCountBefore = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCountBefore).toBe(0)

        // Process the async job to create explorer views
        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        // Views should still be created but with error messages
        const viewsCount = await getExplorerViewsCount("test-invalid")
        expect(viewsCount).toBeGreaterThan(0)

        const views = await getExplorerViewsWithConfigs("test-invalid")

        // All views should have errors due to invalid grapher IDs
        for (const view of views) {
            expect(view.error).toBeTruthy()
            expect(view.chartConfigId).toBeNull()
            expect(view.error.length).toBeLessThanOrEqual(500) // Error message truncation
        }

        // No chart configs should be created for failed views
        const chartConfigsCount = await getChartConfigsCount()
        expect(chartConfigsCount).toBe(0)
    })

    it("should handle unpublished explorers correctly", async () => {
        // Create an unpublished explorer
        const unpublishedTsv = testExplorerTsv.replace(
            "isPublished	true",
            "isPublished	false"
        )

        await env.request({
            method: "PUT",
            path: `/explorers/test-unpublished`,
            body: JSON.stringify({
                tsv: unpublishedTsv,
                commitMessage: "Test unpublished explorer",
            }),
        })

        // Verify explorer exists but is not published
        const explorer = await env.testKnex!(ExplorersTableName)
            .where({ slug: "test-unpublished" })
            .first()
        expect(explorer).toBeTruthy()
        expect(explorer.isPublished).toBe(0) // 0 = false for unpublished

        // No explorer views should be created for unpublished explorers
        const viewsCount = await getExplorerViewsCount("test-unpublished")
        expect(viewsCount).toBe(0)

        // No chart configs should be created
        const chartConfigsCount = await getChartConfigsCount()
        expect(chartConfigsCount).toBe(0)
    })

    it("should verify explorer view JSON structure and parameter accuracy", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-json-4955",
                title: "Test JSON Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-json-4958",
                title: "Test JSON Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test JSON structure",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await env.request({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer for JSON test",
            }),
        })

        // Views are not created immediately - they need async processing
        const viewsCountBefore = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCountBefore).toBe(0)

        // Process the async job to create explorer views
        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        expect(views.length).toBe(2)

        // Verify each view has properly structured JSON
        const expectedParams = [
            {
                Diet: "Healthy diet",
                "Cost or Affordability": "Affordability",
                "Affordability metric": "Share that cannot afford",
            },
            {
                Diet: "Healthy diet",
                "Cost or Affordability": "Affordability",
                "Affordability metric": "Number that cannot afford",
            },
        ]

        for (let i = 0; i < views.length; i++) {
            const view = views[i]
            const parsedView = JSON.parse(view.dimensions)

            // Verify structure matches expected parameters
            expect(parsedView).toEqual(expectedParams[i])

            // Verify JSON keys are consistently ordered (alphabetical)
            // Sort keys client-side since MySQL doesn't guarantee JSON key order
            const keys = Object.keys(parsedView).sort()
            const expectedKeys = Object.keys(expectedParams[i]).sort()
            expect(keys).toEqual(expectedKeys)
        }
    })
})
