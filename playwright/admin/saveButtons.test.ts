/**
 * The buttons below the editor form: saving a draft or new chart, publishing
 * and unpublishing, copying the chart, deleting it and deriving a narrative
 * chart from it. Their contract is with the server, so besides the request
 * the editor sends, the tests check what the admin API stores afterwards.
 */
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"
import type { APIRequestContext } from "@playwright/test"
import type { GrapherInterface } from "@ourworldindata/types"

async function storedConfig(
    request: APIRequestContext,
    chartId: number
): Promise<GrapherInterface> {
    const response = await request.get(
        `/admin/api/charts/${chartId}.config.json`
    )
    expect(response.ok()).toBe(true)
    return response.json()
}

function chartIdInEditorUrl(editor: ChartEditorPage): number {
    const match = new URL(editor.page.url()).pathname.match(
        /^\/admin\/charts\/(\d+)\/edit$/
    )
    expect(match, `${editor.page.url()} is a chart editor URL`).not.toBeNull()
    return Number(match![1])
}

test.describe("saving", () => {
    test("creating a draft stores the new chart and opens its editor", async ({
        openNewChartEditor,
        request,
    }) => {
        const editor = await openNewChartEditor()
        await expect(editor.button("Publish")).toHaveCount(0)
        await editor.openTab("Text")
        await editor.fill(editor.field("Title"), "A new chart")

        const patch = await editor.save()

        expect(patch).toMatchObject({ title: "A new chart" })
        await expect(editor.page).toHaveURL(/\/admin\/charts\/\d+\/edit$/)
        const chartId = chartIdInEditorUrl(editor)
        expect(await storedConfig(request, chartId)).toMatchObject({
            id: chartId,
            isPublished: false,
            title: "A new chart",
        })
        await expect(editor.button("Save draft")).toBeVisible()
    })

    test("saving a draft stores the edited config", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        await editor.openTab("Text")
        await editor.fill(editor.field("Title"), "An edited title")

        await editor.saveWith(editor.button("Save draft"))

        expect(await storedConfig(request, chart.id)).toMatchObject({
            title: "An edited title",
            isPublished: false,
        })
    })
})

test.describe("publishing", () => {
    test("publishing a draft stores it as published under its slug", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart({
            ...lineChart(indicators.lifeExpectancy),
            title: "Life expectancy of some countries",
        })
        const editor = await openEditor(chart)

        void editor.acceptNextDialog()
        const patch = await editor.saveWith(editor.button("Publish"))

        // a draft doesn't need a slug, so publishing derives it from the title
        expect(patch).toMatchObject({
            isPublished: true,
            slug: "life-expectancy-of-some-countries",
        })
        expect(await storedConfig(request, chart.id)).toMatchObject({
            isPublished: true,
            slug: "life-expectancy-of-some-countries",
        })
        await expect(editor.button("Unpublish")).toBeVisible()
        await expect(editor.button("Update chart")).toBeVisible()
    })

    test("dismissing the publish confirmation keeps the chart a draft", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        let savesSent = 0
        editor.page.on("request", (request) => {
            if (request.method() === "PUT") savesSent++
        })

        const confirmation = editor.dismissNextDialog()
        await editor.button("Publish").click()
        expect(await confirmation).toContain("Publish chart at")

        await expect(editor.button("Publish")).toBeVisible()
        expect(savesSent).toBe(0)
        expect(await storedConfig(request, chart.id)).toMatchObject({
            isPublished: false,
        })
    })

    test("unpublishing a published chart stores it as a draft", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart({
            ...lineChart(indicators.lifeExpectancy),
            slug: "a-published-chart",
            isPublished: true,
        })
        const editor = await openEditor(chart)
        await expect(editor.button("Update chart")).toBeVisible()

        void editor.acceptNextDialog()
        const patch = await editor.saveWith(editor.button("Unpublish"))

        expect(patch.isPublished).toBeUndefined()
        expect(await storedConfig(request, chart.id)).toMatchObject({
            isPublished: false,
            slug: "a-published-chart",
        })
        await expect(editor.button("Publish")).toBeVisible()
    })
})

test("saving as new stores a copy of the edited chart and opens it", async ({
    seedChart,
    openEditor,
    request,
}) => {
    const chart = await seedChart({
        ...lineChart(indicators.lifeExpectancy),
        slug: "the-original-chart",
        isPublished: true,
    })
    const editor = await openEditor(chart)
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "Only in the copy")

    const [popup] = await Promise.all([
        editor.page.waitForEvent("popup"),
        editor.button("Save as new").click(),
    ])

    await expect(popup).toHaveURL(/\/admin\/charts\/\d+\/edit$/)
    const copyId = Number(new URL(popup.url()).pathname.split("/")[3])
    expect(copyId).not.toBe(chart.id)
    const copy = await storedConfig(request, copyId)
    expect(copy).toMatchObject({
        title: "Test chart",
        subtitle: "Only in the copy",
        dimensions: [
            { property: "y", variableId: indicators.lifeExpectancy.id },
        ],
        // the copy starts as an unpublished draft without the original's slug
        isPublished: false,
    })
    expect(copy.slug).not.toBe("the-original-chart")
    // the unsaved edit only went into the copy
    expect((await storedConfig(request, chart.id)).subtitle).toBeUndefined()
})

test("deleting a chart removes it and returns to the chart list", async ({
    seedChart,
    openEditor,
    request,
}) => {
    const chart = await seedChart(lineChart(indicators.lifeExpectancy))
    const editor = await openEditor(chart)

    const confirmation = editor.acceptNextDialog()
    await editor.button("Delete").click()
    expect(await confirmation).toContain("Delete the chart")

    await expect(editor.page).toHaveURL(/\/admin\/charts$/)
    const response = await request.get(
        `/admin/api/charts/${chart.id}.config.json`
    )
    expect(response.status()).toBe(404)
})

test("saving as a narrative chart stores the edited config under the given name", async ({
    seedChart,
    openEditor,
    request,
}) => {
    const chart = await seedChart(lineChart(indicators.lifeExpectancy))
    const editor = await openEditor(chart)
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "Only in the narrative chart")
    const name = `narrative-chart-of-${chart.id}`

    await editor.button("Save as narrative chart").click()
    const modal = editor.page.getByRole("dialog", {
        name: "Save as narrative chart",
    })
    await modal.getByLabel("Name").fill(name)
    const [popup] = await Promise.all([
        editor.page.waitForEvent("popup"),
        modal.getByRole("button", { name: "Create" }).click(),
    ])

    await expect(popup).toHaveURL(/\/admin\/narrative-charts\/\d+\/edit$/)
    const narrativeChartId = new URL(popup.url()).pathname.split("/")[3]
    const narrativeChart = await (
        await request.get(
            `/admin/api/narrative-charts/${narrativeChartId}.config.json`
        )
    ).json()
    expect(narrativeChart).toMatchObject({
        name,
        configPatch: { subtitle: "Only in the narrative chart" },
    })
    // the pending edit is not saved to the parent chart
    expect((await storedConfig(request, chart.id)).subtitle).toBeUndefined()
})
