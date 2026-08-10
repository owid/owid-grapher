import { expect, it, describe, DeeplyAllowMatchers } from "vitest"

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { OwidTableSlugs } from "@ourworldindata/types"
import { resolveMdimViewQueryStr, rewriteJsonLdText } from "./grapherTools.js"

describe("download", () => {
    const originalTable = SynthesizeGDPTable()
    const originalYColumns: string[] = [
        SampleColumnSlugs.GDP,
        SampleColumnSlugs.Population,
        SampleColumnSlugs.LifeExpectancy,
    ]
    const originalOtherColumns = originalTable.columnSlugs.filter(
        (slug) => !originalYColumns.includes(slug)
    )

    it("doesn't include any y-columns when none are specified", () => {
        const grapherState = new GrapherState({ table: SynthesizeGDPTable() })
        const slugs = grapherState.tableForDownload.columnSlugs
        const expectedSlugs = originalTable.columnSlugs.filter(
            (slug) =>
                !originalYColumns.includes(slug) &&
                slug !== OwidTableSlugs.EntityId
        )
        expect(slugs).toEqual(expectedSlugs)
    })

    it("only includes the chart's y-columns", () => {
        const ySlugCombinations = [
            SampleColumnSlugs.GDP,
            `${SampleColumnSlugs.GDP} ${SampleColumnSlugs.LifeExpectancy}`,
            `${SampleColumnSlugs.Population} ${SampleColumnSlugs.LifeExpectancy}`,
            `${SampleColumnSlugs.GDP} ${SampleColumnSlugs.LifeExpectancy} ${SampleColumnSlugs.Population}`,
        ]

        for (const ySlugs of ySlugCombinations) {
            const grapherState = new GrapherState({
                table: SynthesizeGDPTable(),
                ySlugs,
            })
            const slugs = grapherState.tableForDownload.columnSlugs
            const expectedSlugs = [
                ...originalOtherColumns,
                ...ySlugs.split(" "),
            ].filter((slug) => slug !== OwidTableSlugs.EntityId)
            expectUnorderedEqual(slugs, expectedSlugs)
        }
    })
})

describe(rewriteJsonLdText, () => {
    it("preserves literal ampersands in rewritten contentUrl query params", () => {
        const jsonLdText = JSON.stringify({
            image: {
                contentUrl:
                    "https://ourworldindata.org/grapher/example.png?tab=chart",
            },
        })

        const rewritten = rewriteJsonLdText(
            jsonLdText,
            new URL(
                "https://ourworldindata.org/grapher/example?country=CZE~OWID_EUR&time=latest"
            )
        )

        expect(rewritten).toContain(
            '"contentUrl":"https://ourworldindata.org/grapher/example.png?tab=chart&country=CZE%7EOWID_EUR&time=latest"'
        )
        expect(rewritten).not.toContain("&amp;")
    })

    it("rewrites url and name for multi-dim views", () => {
        const rewritten = rewriteJsonLdText(
            JSON.stringify({
                name: "Childhood vaccination coverage - by vaccine",
                url: "https://ourworldindata.org/grapher/vaccination-coverage",
            }),
            new URL(
                "https://ourworldindata.org/grapher/vaccination-coverage?metric=vaccinated&antigen=hepb_bd"
            ),
            {
                viewQueryStr: "antigen=hepb_bd&metric=vaccinated",
                viewTitle: "Newborns given a hepatitis B vaccine dose",
            }
        )

        const data = JSON.parse(rewritten) as { name: string; url: string }
        expect(data.name).toBe(
            "Newborns given a hepatitis B vaccine dose | Childhood vaccination coverage - by vaccine"
        )
        expect(data.url).toBe(
            "https://ourworldindata.org/grapher/vaccination-coverage?antigen=hepb_bd&metric=vaccinated"
        )
    })

    it("escapes inline-script breaking content in rewritten JSON-LD", () => {
        const rewritten = rewriteJsonLdText(
            JSON.stringify({
                description: "</script><script>alert(1)</script>",
            }),
            new URL("https://ourworldindata.org/grapher/example")
        )

        expect(rewritten).toBe(
            '{"description":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}'
        )
    })
})

describe(resolveMdimViewQueryStr, () => {
    const defaultDimensions = { metric: "coverage", antigen: "dtp3" }

    it("sorts dimension params and drops non-dimension params", () => {
        expect(
            resolveMdimViewQueryStr(
                new URLSearchParams(
                    "metric=vaccinated&antigen=hepb_bd&tab=map"
                ),
                defaultDimensions
            )
        ).toBe("antigen=hepb_bd&metric=vaccinated")
    })

    it("falls back to default choices for missing dimensions", () => {
        expect(
            resolveMdimViewQueryStr(
                new URLSearchParams("metric=vaccinated"),
                defaultDimensions
            )
        ).toBe("antigen=dtp3&metric=vaccinated")
        expect(
            resolveMdimViewQueryStr(new URLSearchParams(), defaultDimensions)
        ).toBe("antigen=dtp3&metric=coverage")
    })
})

/**
 * Helper function to assert that an array contains exactly the expected elements
 * (no more, no less, but order doesn't matter)
 */
function expectUnorderedEqual<T>(
    actual: T[],
    expected: DeeplyAllowMatchers<T>[]
) {
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
}
