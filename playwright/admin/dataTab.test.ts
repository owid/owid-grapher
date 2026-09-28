/**
 * The Data tab decides which entities a chart shows and how users can change
 * them.
 */
import { expect, test } from "./harness.js"
import { entities, indicators } from "./fixture.js"
import { scatterPlot } from "./charts.js"

test("excluding an entity adds it to the excluded entities", async ({
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

    await editor
        .field("Exclude individual entities")
        .selectOption(entities.france.name)

    await expect(excluded).toHaveText([entities.france.name])
    expect(await editor.saveChanges()).toEqual({
        excludedEntityNames: [entities.france.name],
    })
})
