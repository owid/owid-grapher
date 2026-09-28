import { expect, test } from "./harness.js"
import { indicators, entities } from "./fixture.js"
import { lineChart, scatterPlot } from "./charts.js"

test("editing the subtitle writes it to the patch", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "A new subtitle")

    expect(await editor.save()).toMatchObject({ subtitle: "A new subtitle" })
})

test("excluding an entity from a scatter plot", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(
            scatterPlot({
                x: indicators.gdpPerCapita,
                y: indicators.lifeExpectancy,
            })
        )
    )
    const form = await editor.openTab("Data")
    const excluded = form.locator(".excludedEntities li")
    await expect(excluded).toHaveCount(0)

    await editor.field("Exclude individual entities").selectOption(
        entities.france.name
    )

    await expect(excluded).toHaveText([entities.france.name])
    const patch = await editor.save()
    expect(patch.excludedEntityNames).toEqual([entities.france.name])
})
