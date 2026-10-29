import { parse as parseYaml } from "yaml"
import { expect, test } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

test("the config section shows the live patch config", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await editor.openTab("Text")
    await editor.fill(editor.field("Subtitle"), "An unsaved subtitle")

    const form = await editor.openTab("Debug")

    const yaml = await editor
        .section("Config", form)
        .locator("textarea")
        .inputValue()
    expect(parseYaml(yaml)).toMatchObject({
        title: "Test chart",
        subtitle: "An unsaved subtitle",
    })
})

test("copying the YAML for the ETL leaves out chart-specific fields", async ({
    seedChart,
    openEditor,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const editor = await openEditor(
        await seedChart({
            ...lineChart(indicators.lifeExpectancy),
            subtitle: "A subtitle for the ETL",
        })
    )
    await editor.openTab("Debug")

    await editor.button("Copy YAML for ETL").click()

    await expect(
        editor.page.getByText("Copied YAML to clipboard")
    ).toBeVisible()
    const copied = parseYaml(
        await editor.page.evaluate(() => navigator.clipboard.readText())
    )
    expect(copied).toMatchObject({
        title: "Test chart",
        subtitle: "A subtitle for the ETL",
    })
    for (const field of ["id", "dimensions", "version", "isPublished"])
        expect(copied).not.toHaveProperty(field)
})
