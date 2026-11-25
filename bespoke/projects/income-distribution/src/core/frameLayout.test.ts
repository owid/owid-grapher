import { describe, expect, it } from "vitest"

import { resolveFrameLayout, type FrameLayoutInput } from "./frameLayout.js"

const base: FrameLayoutInput = {
    legend: "auto",
    editCountries: "auto",
    view: "global",
    povertyLine: null,
    isNarrow: false,
    hasNoCountries: false,
    hasUnlabelled: false,
    editCountriesBottom: undefined,
}
const layout = (overrides: Partial<FrameLayoutInput>) =>
    resolveFrameLayout({ ...base, ...overrides })

describe(resolveFrameLayout, () => {
    it("floats the legend over a wide global chart, and puts it above a narrow one", () => {
        expect(layout({})).toMatchObject({
            showOverlayLegend: true,
            showInlineLegend: false,
            showToolbar: false,
            showEditCountries: false,
        })
        expect(layout({ isNarrow: true })).toMatchObject({
            showOverlayLegend: false,
            showInlineLegend: true,
            showToolbar: true,
        })
    })

    it("hides every legend when asked, or when there's nothing to draw", () => {
        expect(layout({ legend: "hidden" })).toMatchObject({
            showOverlayLegend: false,
            showInlineLegend: false,
        })
        expect(
            layout({ view: "countries", hasNoCountries: true })
        ).toMatchObject({
            showOverlayLegend: false,
            listsLeftovers: true,
        })
    })

    it("in the countries view without a line, only lists the countries left unlabelled", () => {
        const countries = { view: "countries" as const }
        expect(layout(countries)).toMatchObject({
            showOverlayLegend: false,
            listsLeftovers: true,
            leftoverLegendTop: 38,
        })
        expect(layout({ ...countries, hasUnlabelled: true })).toMatchObject({
            showOverlayLegend: true,
            listsLeftovers: true,
        })
        // Below the button when there is one
        expect(
            layout({ ...countries, editCountriesBottom: 32 }).leftoverLegendTop
        ).toBe(40)
        // A line turns the legend into the share bars, for every country
        expect(layout({ ...countries, povertyLine: 3 })).toMatchObject({
            showOverlayLegend: true,
            listsLeftovers: false,
            leftoverLegendTop: undefined,
        })
        // The swatch legend always lists everyone
        expect(layout({ ...countries, legend: "swatches" })).toMatchObject({
            showOverlayLegend: true,
            listsLeftovers: false,
        })
    })

    it("puts Edit countries over the plot, in the legend, in the toolbar, or nowhere", () => {
        const countries = { view: "countries" as const }
        expect(layout(countries)).toMatchObject({
            showEditCountries: true,
            showOverlayEditCountries: true,
            showLegendEditCountries: false,
            showToolbar: false,
        })
        expect(layout({ ...countries, editCountries: "legend" })).toMatchObject(
            {
                showOverlayEditCountries: false,
                showLegendEditCountries: true,
            }
        )
        expect(layout({ ...countries, isNarrow: true })).toMatchObject({
            showOverlayEditCountries: false,
            showLegendEditCountries: false,
            showToolbar: true,
        })
        expect(layout({ ...countries, editCountries: "hidden" })).toMatchObject(
            {
                showEditCountries: false,
                showToolbar: false,
            }
        )
    })
})
