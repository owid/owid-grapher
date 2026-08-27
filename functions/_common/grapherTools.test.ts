import { expect, it, describe, DeeplyAllowMatchers } from "vitest"

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { OwidTableSlugs } from "@ourworldindata/types"
import {
    GrapherIdentifier,
    isUnpublishedChartRequestedByUuid,
    rewriteJsonLdText,
} from "./grapherTools.js"

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

describe(isUnpublishedChartRequestedByUuid, () => {
    const uuid: GrapherIdentifier = {
        type: "uuid",
        id: "0191b6c7-5595-70b2-8d30-fa03fccd7add",
    }
    const slug: GrapherIdentifier = { type: "slug", id: "life-expectancy" }

    it("hides a chart that is not published", () => {
        expect(
            isUnpublishedChartRequestedByUuid(uuid, { isPublished: false })
        ).toBe(true)
    })

    it("serves a published chart", () => {
        expect(
            isUnpublishedChartRequestedByUuid(uuid, { isPublished: true })
        ).toBe(false)
    })

    it("serves a config with no isPublished field, as narrative charts have", () => {
        expect(isUnpublishedChartRequestedByUuid(uuid, {})).toBe(false)
    })

    it("leaves the by-slug route alone, which serves published configs only", () => {
        expect(
            isUnpublishedChartRequestedByUuid(slug, { isPublished: false })
        ).toBe(false)
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
