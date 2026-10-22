/**
 * The parts of the chart editor around the tabs' forms: which tabs a chart
 * gets, the open tab in the URL, the preview controls and the prompt that
 * guards unsaved changes. None of the preview controls may change the
 * chart's config.
 */
import type { GrapherInterface } from "@ourworldindata/types"
import { expect, test, type EditorTabName } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart, mapChart, marimekkoChart, scatterPlot } from "./charts.js"

test.describe("tabs", () => {
    const common: EditorTabName[] = ["Basic", "Data", "Text", "Customize"]
    const trailing: EditorTabName[] = ["Revisions", "Refs", "Export", "Debug"]
    const rows: {
        name: string
        config: GrapherInterface
        specificTabs: EditorTabName[]
    }[] = [
        {
            name: "a line chart",
            config: lineChart(indicators.lifeExpectancy),
            specificTabs: [],
        },
        {
            name: "a line chart with a map",
            config: {
                ...lineChart(indicators.lifeExpectancy),
                hasMapTab: true,
            },
            specificTabs: ["Map"],
        },
        {
            name: "a map without a chart",
            config: mapChart(indicators.lifeExpectancy),
            specificTabs: ["Map"],
        },
        {
            name: "a scatter plot",
            config: scatterPlot({
                x: indicators.gdpPerCapita,
                y: indicators.lifeExpectancy,
            }),
            specificTabs: ["Scatter"],
        },
        {
            name: "a Marimekko chart",
            config: marimekkoChart({
                x: indicators.population,
                y: indicators.lifeExpectancy,
            }),
            specificTabs: ["Marimekko"],
        },
    ]
    for (const { name, config, specificTabs } of rows) {
        test(`${name} gets the ${[...common, ...specificTabs].join(", ")} tabs`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(await seedChart(config))

            // the Refs tab's label includes the number of references
            await expect(editor.tabs).toHaveText(
                [...common, ...specificTabs, ...trailing].map(
                    (tab) => new RegExp(`^${tab}`)
                )
            )
        })
    }

    test("the open tab is kept in the URL", async ({
        seedChart,
        openEditor,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        await expect(editor.page).not.toHaveURL(/tab=/)

        await editor.openTab("Customize")
        await expect(editor.page).toHaveURL(/\?tab=customize$/)

        await editor.page.reload()
        await editor.waitUntilReady()
        await expect(editor.tabs.filter({ hasText: "Customize" })).toHaveClass(
            /active/
        )

        await editor.openTab("Basic")
        await expect(editor.page).not.toHaveURL(/tab=/)
    })
})

test.describe("preview", () => {
    test("the mobile preview narrows the chart without changing its config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        const chart = editor.preview.locator(".GrapherComponent")
        const width = async (): Promise<number> =>
            (await chart.boundingBox())?.width ?? 0
        const desktopWidth = await width()

        await editor.page.getByTitle("Mobile preview").click()

        await expect.poll(width).toBeLessThan(desktopWidth / 2)
        expect(await editor.saveChanges()).toEqual({})
    })

    test("emulating a vision deficiency filters the preview without changing the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await expect(editor.preview).not.toHaveAttribute("style", /filter/)

        await editor.page
            .locator(".chart-editor-view")
            .getByRole("combobox")
            .click()
        await editor.page.getByTitle("Protanopia").click()

        await expect(editor.preview).toHaveAttribute(
            "style",
            /filter: url\("?#protanopia"?\)/
        )
        expect(await editor.saveChanges()).toEqual({})
    })

    test("a saved chart links to its preview page", async ({
        seedChart,
        openEditor,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)

        await expect(
            editor.page.getByRole("link", { name: "View Grapher or Data page" })
        ).toHaveAttribute("href", `/admin/charts/${chart.id}/preview`)
    })
})

test.describe("unsaved changes", () => {
    test("leaving the editor with unsaved changes asks for confirmation", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        await editor.fill(editor.field("Subtitle"), "Not saved yet")

        const confirmation = editor.dismissNextDialog()
        await editor.page.getByRole("link", { name: "New chart" }).click()

        expect(await confirmation).toContain("Unsaved changes will be lost")
        await expect(editor.page).toHaveURL(/\/edit/)
        await expect(editor.field("Subtitle")).toHaveValue("Not saved yet")
    })

    test("leaving the editor after saving doesn't ask", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        await editor.fill(editor.field("Subtitle"), "Saved")
        await editor.save()
        let asked = false
        editor.page.on("dialog", async (dialog) => {
            asked = true
            await dialog.dismiss()
        })

        await editor.page.getByRole("link", { name: "New chart" }).click()

        await expect(editor.page).toHaveURL(/\/admin\/charts\/create$/)
        expect(asked).toBe(false)
    })
})
