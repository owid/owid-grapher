import { describe, it, expect } from "vitest"
import { getMultiDimViewTitle } from "./MultiDimBaker.js"

describe(getMultiDimViewTitle, () => {
    const metadata = {
        name: "School life expectancy, pre-primary",
        display: { name: "Pre-primary education" },
        presentation: {
            titlePublic: "School life expectancy in pre-primary education",
        },
    }

    it("uses the chart config's title, as shown on the chart, over the indicator's public title", () => {
        expect(
            getMultiDimViewTitle(
                metadata,
                {
                    title: "Expected years of schooling among children in pre-primary education",
                },
                undefined
            )
        ).toBe(
            "Expected years of schooling among children in pre-primary education"
        )
    })

    it("falls back to the indicator's public title, then display name, then name", () => {
        expect(getMultiDimViewTitle(metadata, {}, undefined)).toBe(
            "School life expectancy in pre-primary education"
        )
        expect(
            getMultiDimViewTitle(
                { ...metadata, presentation: {} },
                undefined,
                undefined
            )
        ).toBe("Pre-primary education")
        expect(
            getMultiDimViewTitle({ name: metadata.name }, undefined, undefined)
        ).toBe("School life expectancy, pre-primary")
    })
})
