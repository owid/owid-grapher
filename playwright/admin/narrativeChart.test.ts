import type { APIRequestContext, Page } from "@playwright/test"
import type { GrapherInterface } from "@ourworldindata/types"
import { ChartEditorPage, expect, test, type SeededChart } from "./harness.js"
import { entities, indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

interface SeededNarrativeChart {
    id: number
    chartConfigId: string
}

async function seedNarrativeChart(
    request: APIRequestContext,
    parent: SeededChart,
    config: GrapherInterface
): Promise<SeededNarrativeChart> {
    const response = await request.post("/admin/api/narrative-charts", {
        data: {
            type: "chart",
            name: `narrative-chart-${parent.id}`,
            parentChartId: parent.id,
            config,
        },
    })
    const json = await response.json()
    expect(json, `seeding a narrative chart: ${json.errorMsg}`).toMatchObject({
        success: true,
    })
    const narrativeChart = await (
        await request.get(
            `/admin/api/narrative-charts/${json.narrativeChartId}.config.json`
        )
    ).json()
    return {
        id: json.narrativeChartId,
        chartConfigId: narrativeChart.chartConfigId,
    }
}

async function expectPreviewShowsChart(
    editor: ChartEditorPage,
    title: string
): Promise<void> {
    await editor.waitUntilReady()
    await expect(editor.preview.getByText(title)).toBeVisible()
    await expect(
        editor.preview.getByText("No table loaded yet"),
        "the chart's data has loaded"
    ).toHaveCount(0)
    await expect(
        editor.preview.getByText(entities.france.name).first(),
        "the chart's entities are selected"
    ).toBeVisible()
}

/**
 * Holds back the requests for chart configs until the editor's indicator
 * database has loaded. The editor applies the config layers to the chart
 * once, when that database arrives, so a page that mounts the editor before
 * its config is here opens an empty chart. With the few test indicators the
 * database is usually faster anyway; this makes the order deterministic.
 *
 * A page that waits for its config before mounting the editor never requests
 * the database first, so the config is released after a while regardless.
 */
async function delayConfigUntilDatabaseLoaded(page: Page): Promise<void> {
    const databaseLoaded = page
        .waitForResponse((response) =>
            response.url().endsWith("/api/editorData/variables.json")
        )
        .catch(() => undefined)
    const timeout = new Promise((resolve) => setTimeout(resolve, 2_000))
    await page.route(
        (url) => url.pathname.endsWith(".config.json"),
        async (route) => {
            await Promise.race([databaseLoaded, timeout])
            await route.continue()
        }
    )
}

test("opens a narrative chart on its config", async ({
    page,
    request,
    seedChart,
}) => {
    const parent = await seedChart(lineChart(indicators.lifeExpectancy))
    const narrativeChart = await seedNarrativeChart(request, parent, {
        ...lineChart(indicators.lifeExpectancy),
        title: "A narrative chart",
    })

    await delayConfigUntilDatabaseLoaded(page)
    await page.goto(`/admin/narrative-charts/${narrativeChart.id}/edit`, {
        waitUntil: "commit",
    })

    await expectPreviewShowsChart(
        new ChartEditorPage(page),
        "A narrative chart"
    )
})

test("creates a narrative chart from its parent's config", async ({
    page,
    request,
    seedChart,
}) => {
    // Any chart config can be the parent of the create page, so the config
    // of a narrative chart stands in for a multi-dimensional view
    const parent = await seedChart(lineChart(indicators.lifeExpectancy))
    const { chartConfigId } = await seedNarrativeChart(request, parent, {
        ...lineChart(indicators.lifeExpectancy),
        title: "The parent view",
    })

    await delayConfigUntilDatabaseLoaded(page)
    await page.goto(
        `/admin/narrative-charts/create?type=multiDim&chartConfigId=${chartConfigId}`,
        { waitUntil: "commit" }
    )

    await expectPreviewShowsChart(new ChartEditorPage(page), "The parent view")
})
