/**
 * The Export tab downloads a static version of the chart. Its settings only
 * shape that export: they hide elements from the downloaded file but must
 * never end up in the chart's config.
 */
import { readFile } from "node:fs/promises"
import type { GrapherInterface } from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { discreteBarChart, lineChart } from "./charts.js"

const texts = {
    title: "Life expectancy in two countries",
    subtitle: "A subtitle for the static export",
    note: "A note for the static export",
    originUrl: "https://ourworldindata.org/life-expectancy",
}

const chartWithAllTexts = (): GrapherInterface => ({
    ...lineChart(indicators.lifeExpectancy),
    ...texts,
})

async function downloadSvg(editor: ChartEditorPage): Promise<string> {
    const [download] = await Promise.all([
        editor.page.waitForEvent("download"),
        editor.button(/Download SVG/).click(),
    ])
    return readFile(await download.path(), "utf8")
}

/** The text content of the exported title */
function titleText(svg: string): string {
    const title = svg.match(/<a id="title"[^>]*>(.*?)<\/a>/s)?.[1] ?? ""
    return title.replace(/<[^>]+>/g, "")
}

test.describe("displayed elements", () => {
    const rows = [
        { toggle: "Title", hiddenText: texts.title },
        { toggle: "Subtitle", hiddenText: texts.subtitle },
        { toggle: "Note", hiddenText: texts.note },
        {
            toggle: "Origin URL",
            hiddenText: "ourworldindata.org/life-expectancy",
        },
    ]
    for (const row of rows) {
        test(`unticking "${row.toggle}" leaves it out of the export`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(chartWithAllTexts())
            )
            await editor.openTab("Export")
            expect(await downloadSvg(editor)).toContain(row.hiddenText)

            await editor.checkbox(row.toggle).uncheck()

            const svg = await downloadSvg(editor)
            expect(svg).not.toContain(row.hiddenText)
            for (const other of rows.filter((other) => other !== row))
                expect(svg).toContain(other.hiddenText)
        })
    }

    test('unticking "Title suffix: automatic time" leaves the year out of the title', async ({
        seedChart,
        openEditor,
    }) => {
        // Known bug: the suffix toggles mutate the nested
        // `settings.forceHideAnnotationFieldsInTitle` object, which the Export
        // tab's `currentSettings` doesn't dereference, so the reaction that
        // applies the settings to the chart doesn't run. They only take effect
        // after another export setting has changed.
        test.fail()
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Export")
        expect(titleText(await downloadSvg(editor))).toBe("Test chart2020")

        await editor.checkbox("Title suffix: automatic time").uncheck()

        expect(titleText(await downloadSvg(editor))).toBe("Test chart")
    })

    test('ticking "Details on demand" adds the referenced details to the export', async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                subtitle: "How long people [live](#dod:life_expectancy)",
            })
        )
        await editor.openTab("Export")
        const detail = "The average number of years a newborn would live."
        const toggle = editor.checkbox("Details on demand")
        await expect(toggle).not.toBeChecked()
        expect(await downloadSvg(editor)).not.toContain(detail)

        await toggle.check()

        expect(await downloadSvg(editor)).toContain(detail)
    })

    test("export settings don't change the chart's config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(chartWithAllTexts()))
        await editor.openTab("Export")
        for (const toggle of ["Title", "Subtitle", "Note", "Origin URL"])
            await editor.checkbox(toggle).uncheck()

        // the save buttons are hidden on the Export tab
        await expect(editor.button("Save draft")).toHaveCount(0)
        await editor.openTab("Text")
        await expect(editor.preview).toContainText(texts.title)

        expect(await editor.saveChanges()).toEqual({})
    })
})

test("downloads are named after the chart and the preview size", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart({
            ...lineChart(indicators.lifeExpectancy),
            slug: "life-expectancy-export",
        })
    )
    await editor.openTab("Export")

    const [png] = await Promise.all([
        editor.page.waitForEvent("download"),
        editor.button(/Download PNG/).click(),
    ])
    expect(png.suggestedFilename()).toBe("life-expectancy-export-desktop.png")

    await editor.page.getByTitle("Mobile preview").click()
    const [svg] = await Promise.all([
        editor.page.waitForEvent("download"),
        editor.button(/Download SVG/).click(),
    ])
    expect(svg.suggestedFilename()).toBe("life-expectancy-export-mobile.svg")
})

test("only published charts link to the animation wizard", async ({
    seedChart,
    openEditor,
}) => {
    const draft = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await draft.openTab("Export")
    await expect(draft.section("Animate chart")).toHaveCount(0)

    const published = await openEditor(
        await seedChart({
            ...lineChart(indicators.lifeExpectancy),
            slug: "an-animated-chart",
            isPublished: true,
        })
    )
    await published.openTab("Export")
    const link = published.section("Animate chart").getByRole("link")
    await expect(link).toHaveAttribute("href", /chart-animation/)
    await expect(link).toHaveAttribute(
        "href",
        /animation_chart_url=.*an-animated-chart/
    )
})
