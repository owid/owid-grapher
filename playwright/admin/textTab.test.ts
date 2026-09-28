/**
 * The Text tab edits the chart's header and footer texts.
 */
import { expect, test } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

test("editing the subtitle writes it to the config", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "A new subtitle")

    expect(await editor.saveChanges()).toEqual({ subtitle: "A new subtitle" })
})
