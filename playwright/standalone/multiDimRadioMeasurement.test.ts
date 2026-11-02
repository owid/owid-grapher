import { expect, test } from "@playwright/test"
import { compileString } from "sass"

// Exercise the real styles in a layout engine: DOM mocks cannot detect flex
// shrinking inside the hidden copy that supplies the radio/dropdown decision.
test("radio measurements include enough room for full labels in each responsive layout", async ({
    page,
}) => {
    const { css } = compileString(
        `
        @import "packages/@ourworldindata/components/src/styles/variables.scss";
        @import "packages/@ourworldindata/components/src/styles/colors.scss";
        @import "packages/@ourworldindata/components/src/styles/typography-constants.scss";
        @import "packages/@ourworldindata/components/src/styles/mixins.scss";
        @import "site/multiDim/MultiDimDataPageContent.scss";
        @import "site/multiDim/DimensionDropdown.scss";
        @import "site/multiDim/DimensionRadioGroup.scss";
        * { box-sizing: border-box; }
        `,
        { loadPaths: [process.cwd()], silenceDeprecations: ["import"] }
    )
    await page.setViewportSize({ width: 400, height: 800 })
    await page.setContent(`
        <style>${css}</style>
        <div class="md-settings__radio-group-options md-radio-measure" aria-hidden="true">
            <div class="md-settings__radio-field">
                <span class="md-settings__radio"><span class="md-settings__radio-label">Short</span></span>
            </div>
            <div class="md-settings__radio-field">
                <span class="md-settings__radio"><span class="md-settings__radio-label">A considerably longer choice name</span></span>
            </div>
        </div>
    `)
    const labels = page.locator(".md-settings__radio-label")
    const fields = page.locator(".md-settings__radio-field")
    const mobileWidths = await fields.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
    )
    expect(mobileWidths[0]).toEqual(mobileWidths[1])
    const group = page.locator(".md-radio-measure")
    const mobileWidth = await group.evaluate(
        (element) => element.getBoundingClientRect().width
    )
    // Start on mobile, then cross the breakpoint in both directions. Both
    // layouts must fit the labels, but only mobile needs equal-width options.
    for (const width of [400, 800, 400]) {
        await page.setViewportSize({ width, height: 800 })
        expect(
            await labels.evaluateAll((elements) =>
                elements.map(
                    (element) => element.scrollWidth <= element.clientWidth
                )
            )
        ).toEqual([true, true])
        const optionWidths = await fields.evaluateAll((elements) =>
            elements.map((element) => element.getBoundingClientRect().width)
        )
        const totalWidth = await group.evaluate(
            (element) => element.getBoundingClientRect().width
        )
        if (width === 400) {
            expect(optionWidths).toEqual(mobileWidths)
            expect(totalWidth).toEqual(mobileWidth)
        } else {
            expect(optionWidths[1]).toBeGreaterThan(optionWidths[0])
            expect(totalWidth).toBeLessThan(mobileWidth)
            expect(optionWidths[1]).toBeCloseTo(mobileWidths[1], 1)
        }
    }
})
