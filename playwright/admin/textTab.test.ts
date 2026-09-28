/**
 * The Text tab edits the chart's header and footer texts and a few
 * miscellaneous settings.
 *
 * Several text fields (title, subtitle, source, footer note) are "auto"
 * fields: they show an automatic value (derived from the data, or inherited
 * from the indicator's ETL config) until the author types an override, and a
 * link button next to them resets an override to the automatic value. The
 * tests check both halves of that contract: what the field shows for a
 * seeded config, and which config fields an edit or reset writes.
 */
import type { Locator } from "@playwright/test"
import { EntitySelectionMode, LicenseOption } from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

/** The link/unlink button of an auto text field, which resets an override */
const resetButton = (editor: ChartEditorPage, label: string): Locator =>
    editor.field(label).locator("xpath=..").getByRole("button")

/** The `.form-group` of a labelled field, for its help and error texts */
const formGroup = (editor: ChartEditorPage, label: string): Locator =>
    editor
        .field(label)
        .locator("xpath=ancestor::div[contains(@class, 'form-group')][1]")

test.describe("Header", () => {
    test("editing the title writes it to the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        await expect(editor.field("Title")).toHaveValue("Test chart")
        await expect(resetButton(editor, "Title")).toBeEnabled()

        await editor.fill(
            editor.field("Title"),
            "  Life expectancy by country "
        )

        expect(await editor.saveChanges()).toEqual({
            title: "Life expectancy by country",
        })
    })

    test("without a title the automatic title is shown and saved", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                title: undefined,
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("Title")).toHaveValue("Life expectancy")
        await expect(resetButton(editor, "Title")).toBeDisabled()

        // The server needs a title, so the editor fills in the automatic one
        expect(await editor.saveChanges()).toEqual({ title: "Life expectancy" })
    })

    test("resetting an overridden title restores the automatic title", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                title: "A custom title",
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("Title")).toHaveValue("A custom title")

        await resetButton(editor, "Title").click()

        await expect(editor.field("Title")).toHaveValue("Life expectancy")
        await expect(resetButton(editor, "Title")).toBeDisabled()
        expect(await editor.saveChanges()).toEqual({ title: "Life expectancy" })
    })

    const titleAnnotationToggles = [
        {
            name: "hiding the automatic time writes hideAnnotationFieldsInTitle.time",
            label: "Hide automatic time",
            config: lineChart(indicators.lifeExpectancy),
            path: "hideAnnotationFieldsInTitle.time",
        },
        {
            name: "hiding the automatic entity writes hideAnnotationFieldsInTitle.entity",
            label: "Hide automatic entity",
            // The entity toggle only shows when users can't change the entity
            config: {
                ...lineChart(indicators.lifeExpectancy),
                addCountryMode: EntitySelectionMode.Disabled,
            },
            path: "hideAnnotationFieldsInTitle.entity",
        },
        {
            name: "keeping 'Change in' out of relative titles writes hideAnnotationFieldsInTitle.changeInPrefix",
            label: "Don't prepend 'Change in' in relative line charts",
            // The toggle only shows when the chart can be shown in relative mode
            config: {
                ...lineChart(indicators.lifeExpectancy),
                hideRelativeToggle: false,
            },
            path: "hideAnnotationFieldsInTitle.changeInPrefix",
        },
    ]
    for (const row of titleAnnotationToggles) {
        test(row.name, async ({ seedChart, openEditor }) => {
            const editor = await openEditor(await seedChart(row.config))
            await editor.openTab("Text")
            const toggle = editor.checkbox(row.label)
            await expect(toggle).not.toBeChecked()

            await toggle.check()

            expect(await editor.saveChanges()).toEqual({ [row.path]: true })
        })
    }

    test("unticking a title annotation toggle removes the setting", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hideAnnotationFieldsInTitle: { time: true },
            })
        )
        await editor.openTab("Text")
        const toggle = editor.checkbox("Hide automatic time")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            "hideAnnotationFieldsInTitle.time": undefined,
        })
    })

    test("the entity toggle only shows when users can't change the entity", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await expect(editor.checkbox("Hide automatic time")).toBeVisible()
        await expect(editor.checkbox("Hide automatic entity")).toHaveCount(0)
    })

    test("the 'Change in' toggle only shows for charts with a relative mode", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hideRelativeToggle: true,
            })
        )
        await editor.openTab("Text")

        await expect(editor.checkbox("Hide automatic time")).toBeVisible()
        await expect(
            editor.checkbox("Don't prepend 'Change in' in relative line charts")
        ).toHaveCount(0)
    })

    test("editing the slug writes it slugified", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.fill(editor.field("/grapher/"), "Life Expectancy Chart")

        await expect(editor.field("/grapher/")).toHaveValue(
            "life-expectancy-chart"
        )
        expect(await editor.saveChanges()).toEqual({
            slug: "life-expectancy-chart",
        })
    })

    test("resetting the slug derives it from the title", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                slug: "a-custom-slug",
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("/grapher/")).toHaveValue("a-custom-slug")

        await resetButton(editor, "/grapher/").click()

        await expect(editor.field("/grapher/")).toHaveValue("test-chart")
        await expect(resetButton(editor, "/grapher/")).toBeDisabled()
        expect(await editor.saveChanges()).toEqual({ slug: "test-chart" })
    })

    test("editing the subtitle writes it to the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        await editor.fill(editor.field("Subtitle"), "A new subtitle")

        expect(await editor.saveChanges()).toEqual({
            subtitle: "A new subtitle",
        })
    })

    test("resetting an overridden subtitle removes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                subtitle: "A custom subtitle",
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("Subtitle")).toHaveValue("A custom subtitle")

        await resetButton(editor, "Subtitle").click()

        await expect(resetButton(editor, "Subtitle")).toBeDisabled()
        expect(await editor.saveChanges()).toEqual({ subtitle: undefined })
    })

    test("a subtitle can reference an existing detail on demand", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        const subtitle =
            "How long people live, by [life expectancy](#dod:life_expectancy)."

        await editor.fill(editor.field("Subtitle"), subtitle)

        await expect(formGroup(editor, "Subtitle")).not.toContainText(
            "Invalid DoD"
        )
        expect(await editor.saveChanges()).toEqual({ subtitle })
    })

    test("a subtitle referencing an unknown detail on demand blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.fill(
            editor.field("Subtitle"),
            "See [this term](#dod:not_a_term)."
        )

        await expect(formGroup(editor, "Subtitle")).toContainText(
            "Invalid DoD(s) specified: not_a_term"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
        await expect(editor.button("Publish")).toBeDisabled()
    })

    const logoOptions = [
        { option: "CORE+OWID", changes: { logo: "core+owid" } },
        { option: "GV+OWID", changes: { logo: "gv+owid" } },
        { option: "No logo", changes: { hideLogo: true } },
    ]
    for (const row of logoOptions) {
        test(`choosing the ${row.option} logo`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await editor.openTab("Text")
            await expect(editor.radio("OWID")).toBeChecked()

            await editor.radio(row.option).check()

            expect(await editor.saveChanges()).toEqual(row.changes)
        })
    }

    test("choosing a logo for a chart without one shows the logo again", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hideLogo: true,
            })
        )
        await editor.openTab("Text")
        await expect(editor.radio("No logo")).toBeChecked()

        await editor.radio("CORE+OWID").check()

        expect(await editor.saveChanges()).toEqual({
            hideLogo: undefined,
            logo: "core+owid",
        })
    })
})

test.describe("Footer", () => {
    test("the source shows the indicator's sources until overridden", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        await expect(editor.field("Source")).toHaveValue(
            "Our World in Data test fixtures"
        )
        await expect(resetButton(editor, "Source")).toBeDisabled()

        await editor.fill(editor.field("Source"), "World Health Organization")

        await expect(resetButton(editor, "Source")).toBeEnabled()
        expect(await editor.saveChanges()).toEqual({
            sourceDesc: "World Health Organization",
        })
    })

    test("resetting an overridden source removes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                sourceDesc: "World Health Organization",
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("Source")).toHaveValue(
            "World Health Organization"
        )

        await resetButton(editor, "Source").click()

        await expect(editor.field("Source")).toHaveValue(
            "Our World in Data test fixtures"
        )
        expect(await editor.saveChanges()).toEqual({ sourceDesc: undefined })
    })

    test("typing an origin URL writes it with spaces turned into dashes", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.field("Origin url").pressSequentially("/child labor")

        await expect(editor.field("Origin url")).toHaveValue("/child-labor")
        expect(await editor.saveChanges()).toEqual({
            originUrl: "/child-labor",
        })
    })

    test("an origin URL that is neither absolute nor starts with / blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.field("Origin url").fill("poverty")

        await expect(formGroup(editor, "Origin url")).toContainText(
            "Invalid origin URL. If it's a relative URL, make sure it starts with /"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("clearing the origin URL removes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                originUrl: "/life-expectancy",
            })
        )
        await editor.openTab("Text")
        const originUrl = editor.field("Origin url")
        await expect(originUrl).toHaveValue("/life-expectancy")

        await originUrl.fill("")

        expect(await editor.saveChanges()).toEqual({ originUrl: undefined })
    })

    test("editing the footer note writes it to the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.fill(
            editor.field("Footer note"),
            " Data for 2020 is provisional. "
        )

        expect(await editor.saveChanges()).toEqual({
            note: "Data for 2020 is provisional.",
        })
    })

    test("a footer note referencing an unknown detail on demand blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")

        await editor.fill(
            editor.field("Footer note"),
            "See [this term](#dod:not_a_term)."
        )

        await expect(formGroup(editor, "Footer note")).toContainText(
            "Invalid DoD(s) specified: not_a_term"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("choosing a license writes it to the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        const license = editor.field("License")
        await expect(license).toHaveValue("cc-by")

        await license.selectOption({ label: "CC BY-NC-SA" })

        expect(await editor.saveChanges()).toEqual({ license: "cc-by-nc-sa" })
    })

    test("choosing the default license removes the setting", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                license: LicenseOption["cc-by-nd"],
            })
        )
        await editor.openTab("Text")
        const license = editor.field("License")
        await expect(license).toHaveValue("cc-by-nd")

        await license.selectOption({ label: "CC BY" })

        expect(await editor.saveChanges()).toEqual({ license: undefined })
    })
})

test.describe("Related", () => {
    test("adding a related question writes its text and URL", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        const form = await editor.openTab("Text")
        await expect(editor.field("Related question")).toHaveCount(0)

        await editor.button(/Add related question/, form).click()
        await editor.fill(
            editor.field("Related question"),
            "How long do people live?"
        )
        // The URL field only shows once the question has a text
        await expect(formGroup(editor, "URL")).toContainText("Missing URL")
        await editor.fill(
            editor.field("URL"),
            "https://ourworldindata.org/life-expectancy"
        )

        await expect(formGroup(editor, "URL")).not.toContainText("Missing URL")
        await expect(editor.button(/Add related question/, form)).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({
            relatedQuestions: [
                {
                    text: "How long do people live?",
                    url: "https://ourworldindata.org/life-expectancy",
                },
            ],
        })
    })

    test("a related question with a relative URL blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                relatedQuestions: [
                    {
                        text: "How long do people live?",
                        url: "https://ourworldindata.org/life-expectancy",
                    },
                ],
            })
        )
        await editor.openTab("Text")
        await expect(editor.field("Related question")).toHaveValue(
            "How long do people live?"
        )
        await expect(editor.field("URL")).toHaveValue(
            "https://ourworldindata.org/life-expectancy"
        )

        await editor.fill(editor.field("URL"), "ourworldindata.org")

        await expect(formGroup(editor, "URL")).toContainText(
            "URL should start with http(s)://"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("removing the related question removes it from the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                relatedQuestions: [
                    {
                        text: "How long do people live?",
                        url: "https://ourworldindata.org/life-expectancy",
                    },
                ],
            })
        )
        const form = await editor.openTab("Text")

        await editor.button(/Remove related question/, form).click()

        await expect(editor.field("Related question")).toHaveCount(0)
        await expect(editor.button(/Add related question/, form)).toBeVisible()
        expect(await editor.saveChanges()).toEqual({
            relatedQuestions: undefined,
        })
    })
})

test.describe("Misc", () => {
    const textFields = [
        {
            label: "Internal author notes",
            path: "internalNotes",
            value: "Needs review by the health team",
        },
        { label: "Variant name", path: "variantName", value: "IHME" },
    ]
    for (const row of textFields) {
        test(`editing the ${row.label.toLowerCase()} writes ${row.path}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await editor.openTab("Text")
            await expect(editor.field(row.label)).toHaveValue("")

            await editor.fill(editor.field(row.label), ` ${row.value} `)

            expect(await editor.saveChanges()).toEqual({
                [row.path]: row.value,
            })
        })
    }

    test("forcing a data page is saved with the chart", async ({
        seedChart,
        openEditor,
        page,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        await editor.openTab("Text")
        const toggle = editor.checkbox("Force to be a data page")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        // The setting isn't part of the config but sent along with it
        const saveRequest = page.waitForRequest(
            (request) =>
                request.method() === "PUT" &&
                new URL(request.url()).pathname ===
                    `/admin/api/charts/${chart.id}`
        )
        expect(await editor.saveChanges()).toEqual({})
        expect(
            new URL((await saveRequest).url()).searchParams.get("forceDatapage")
        ).toBe("true")

        const reopened = await openEditor(chart)
        await reopened.openTab("Text")
        await expect(reopened.checkbox("Force to be a data page")).toBeChecked()
    })
})

test.describe("Copy as Markdown", () => {
    test("copying the admin URL copies a Markdown link to the editor", async ({
        seedChart,
        openEditor,
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"])
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        const form = await editor.openTab("Text")
        await expect(editor.button("Copy Grapher URL", form)).toHaveCount(0)

        await editor.button("Copy admin URL", form).click()

        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toMatch(
                new RegExp(
                    `^\\[Test chart\\]\\(https?://[^)]+/admin/charts/${chart.id}/edit\\)$`
                )
            )
    })

    test("copying the grapher URL of a published chart copies a Markdown link to it", async ({
        seedChart,
        openEditor,
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"])
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                slug: "published-life-expectancy",
                isPublished: true,
            })
        )
        const form = await editor.openTab("Text")

        await editor.button("Copy Grapher URL", form).click()

        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toMatch(
                /^\[Test chart\]\(https?:\/\/[^)]+\/grapher\/published-life-expectancy\)$/
            )
    })
})

test.describe("Inherited texts", () => {
    test("the Text tab shows the texts inherited from the indicator", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                { ...lineChart(indicators.childMortality), title: undefined },
                { inheritance: true }
            )
        )
        await editor.openTab("Text")

        await expect(editor.field("Title")).toHaveValue(
            "Child mortality rate (inherited title)"
        )
        await expect(editor.field("Subtitle")).toHaveValue(
            "Share of children who die before age five."
        )
        await expect(editor.field("Footer note")).toHaveValue(
            "Inherited note from the indicator."
        )
        for (const label of ["Title", "Subtitle", "Footer note"])
            await expect(resetButton(editor, label)).toBeDisabled()
    })

    test("overriding an inherited subtitle writes only the subtitle", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                { ...lineChart(indicators.childMortality), title: undefined },
                { inheritance: true }
            )
        )
        await editor.openTab("Text")

        await editor.fill(editor.field("Subtitle"), "A chart-specific subtitle")

        await expect(resetButton(editor, "Subtitle")).toBeEnabled()
        await editor.save()
        expect(await editor.storedChanges()).toEqual({
            subtitle: "A chart-specific subtitle",
        })
    })

    test("resetting an overridden note restores the inherited note", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                {
                    ...lineChart(indicators.childMortality),
                    title: undefined,
                    note: "A chart-specific note",
                },
                { inheritance: true }
            )
        )
        await editor.openTab("Text")
        await expect(editor.field("Footer note")).toHaveValue(
            "A chart-specific note"
        )

        await resetButton(editor, "Footer note").click()

        await expect(editor.field("Footer note")).toHaveValue(
            "Inherited note from the indicator."
        )
        await editor.save()
        expect(await editor.storedChanges()).toEqual({ note: undefined })
    })
})
