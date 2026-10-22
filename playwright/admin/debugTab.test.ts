/**
 * The Debug tab shows the chart's configs and switches inheritance from the
 * parent indicator's config on and off.
 *
 * Toggling inheritance must not fold the parent's values into the chart's own
 * patch: when inheritance is switched off, values that were inherited stop
 * applying instead of becoming explicit overrides, and when it is switched
 * on, the parent's values start applying without being copied.
 */
import { parse as parseYaml } from "yaml"
import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

// the ETL config of the childMortality indicator
const inherited = indicators.childMortality.grapherConfigETL

async function storedInheritance(
    request: APIRequestContext,
    chartId: number
): Promise<boolean> {
    const parent = await (
        await request.get(`/admin/api/charts/${chartId}.parent.json`)
    ).json()
    return Boolean(parent.isInheritanceEnabled)
}

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

test.describe("inheritance", () => {
    test("an inheriting chart of an indicator without a config has nothing to inherit", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy), {
                inheritance: true,
            })
        )
        const form = await editor.openTab("Debug")

        await expect(editor.section("Parent indicator", form)).toContainText(
            "does not yet have an associated grapherState config"
        )
        await expect(editor.section("Parent config", form)).toHaveCount(0)
    })

    test("enabling inheritance applies the indicator's config without copying it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: false,
        })
        const editor = await openEditor(chart)
        await expect(editor.preview).not.toContainText(inherited.subtitle)
        const form = await editor.openTab("Debug")
        await expect(
            editor.section("Parent config (not currently applied)", form)
        ).toBeVisible()
        const toggle = editor.checkbox("Enable inheritance")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        await expect(editor.section("Parent config", form)).toBeVisible()
        await expect(editor.preview).toContainText(inherited.subtitle)
        expect(await editor.saveChanges()).toEqual({})
        expect(await storedInheritance(request, chart.id)).toBe(true)
    })

    test("disabling inheritance stops applying the indicator's config without copying it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: true,
        })
        const editor = await openEditor(chart)
        await expect(editor.preview).toContainText(inherited.subtitle)
        await expect(editor.preview).toContainText(inherited.note)
        await editor.openTab("Debug")
        const toggle = editor.checkbox("Enable inheritance")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        await expect(editor.preview).not.toContainText(inherited.subtitle)
        await expect(editor.preview).not.toContainText(inherited.note)
        expect(await editor.saveChanges()).toEqual({})
        expect(await storedInheritance(request, chart.id)).toBe(false)
    })
})
