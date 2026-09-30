/**
 * The Revisions tab lists the chart's saved versions; the Refs tab lists
 * where the chart is used and manages the URLs that redirect to it.
 */
import { expect, test } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

test.describe("Revisions tab", () => {
    test("each save adds a revision that can be compared to the previous one", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        const form = await editor.openTab("Revisions")
        const revisions = form.locator(".list-group-item")
        // creating the chart stored its first revision
        await expect(revisions).toHaveCount(1)
        await expect(form.getByRole("button", { name: /Compare/ })).toHaveCount(
            0
        )

        await editor.openTab("Text")
        await editor.fill(editor.field("Subtitle"), "A revised subtitle")
        await editor.save()
        await editor.openTab("Revisions")

        await expect(revisions).toHaveCount(2)
        await expect(revisions.first()).toContainText("by Admin")
        await revisions
            .first()
            .getByRole("button", { name: /Compare/ })
            .click()
        const diff = editor.page.getByRole("dialog")
        await expect(diff).toContainText('"subtitle": "A revised subtitle"')
    })
})

test.describe("Refs tab", () => {
    test("adding a redirect stores it and lists it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        const form = await editor.openTab("Refs")
        const slugInput = form.getByPlaceholder("URL")
        await expect(editor.button("Add redirect", form)).toBeDisabled()

        await slugInput.fill(`old-slug-of-${chart.id}`)
        await form.getByPlaceholder("e.g. 'tab=map'").fill("tab=map")
        await editor.button("Add redirect", form).click()

        const listed = form.locator(".list-group-item")
        await expect(listed).toHaveCount(1)
        await expect(listed).toContainText(`old-slug-of-${chart.id}`)
        await expect(listed).toContainText("?tab=map")
        await expect(slugInput).toHaveValue("")
        const stored = await (
            await request.get(`/admin/api/charts/${chart.id}.redirects.json`)
        ).json()
        expect(stored.redirects).toMatchObject([
            { slug: `old-slug-of-${chart.id}`, targetQueryParam: "tab=map" },
        ])
    })

    test("a narrative chart derived from the chart is listed as a reference", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const name = `derived-from-${chart.id}`
        const response = await request.post("/admin/api/narrative-charts", {
            data: {
                type: "chart",
                name,
                parentChartId: chart.id,
                config: { title: "A narrative about life expectancy" },
            },
        })
        const { narrativeChartId } = await response.json()
        expect(narrativeChartId).toEqual(expect.any(Number))
        const editor = await openEditor(chart)

        await expect(editor.tabs.filter({ hasText: /^Refs/ })).toHaveText(
            "Refs (1)"
        )
        const form = await editor.openTab("Refs")
        await expect(
            form.getByRole("link", {
                name: "A narrative about life expectancy",
            })
        ).toHaveAttribute(
            "href",
            `/admin/narrative-charts/${narrativeChartId}/edit`
        )
    })

    test("a chart with references can't be deleted", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        await request.post("/admin/api/narrative-charts", {
            data: {
                type: "chart",
                name: `keeps-alive-${chart.id}`,
                parentChartId: chart.id,
                config: {},
            },
        })
        const editor = await openEditor(chart)
        await expect(editor.tabs.filter({ hasText: /^Refs/ })).toHaveText(
            "Refs (1)"
        )

        const alert = editor.acceptNextDialog()
        await editor.button("Delete").click()

        expect(await alert).toContain("Cannot delete chart")
        const stored = await request.get(
            `/admin/api/charts/${chart.id}.config.json`
        )
        expect(stored.ok()).toBe(true)
    })
})
