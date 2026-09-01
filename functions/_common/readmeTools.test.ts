import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import {
    type CoreColumn,
    SynthesizeNonCountryTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ColumnTypeNames, type OwidColumnDef } from "@ourworldindata/types"
import { getRandomNumberGenerator } from "@ourworldindata/utils"
import { constructReadme } from "./readmeTools.js"

describe(constructReadme, () => {
    it("strips detail-on-demand links but keeps their visible label", () => {
        const table = SynthesizeNonCountryTable({
            columnDefs: [
                {
                    slug: "population",
                    type: ColumnTypeNames.Population,
                    name: "Population",
                    sourceName: "Test source",
                    descriptionShort:
                        "Measured in [terawatt-hours](#dod:watt-hours).",
                    generator: getRandomNumberGenerator(1e7, 1e9),
                    growthRateGenerator: getRandomNumberGenerator(-5, 5),
                },
            ],
        })
        const grapherState = new GrapherState({ table, ySlugs: "population" })
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const readme = constructReadme(
            grapherState,
            columns,
            new URLSearchParams("")
        )

        expect(readme).not.toContain("#dod:")
        expect(readme).toContain("Measured in terawatt-hours.")
    })

    it("credits the source name alongside the origin producer", () => {
        const table = SynthesizeNonCountryTable({
            columnDefs: [
                {
                    slug: "population",
                    type: ColumnTypeNames.Population,
                    name: "Population",
                    sourceName: "WHO",
                    origins: [
                        { producer: "IHME", datePublished: "2020-01-01" },
                    ],
                    generator: getRandomNumberGenerator(1e7, 1e9),
                    growthRateGenerator: getRandomNumberGenerator(-5, 5),
                },
            ],
        })
        const grapherState = new GrapherState({ table, ySlugs: "population" })
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const readme = constructReadme(
            grapherState,
            columns,
            new URLSearchParams("")
        )

        const attribution = "WHO; IHME (2020) – processed by Our World in Data"
        expect(readme).toContain(attribution)
        expect(readme).toContain(`Source: ${attribution}`)
    })

    it("puts every indicator under the heading that introduces it", () => {
        // The per-indicator sections are children of "Detailed information ..."; at
        // the levels they used to use, an indicator was a sibling of that heading and
        // the second half of the readme had no structure at all.
        const readme = constructReadme(
            ...readmeArgs({
                sourceName: "Test source",
                descriptionKey: "Only counts utility-scale generation.",
                descriptionFromProducer: "Compiled from national statistics.",
                descriptionProcessing: "We convert everything to TWh.",
            })
        )

        const headings = readme
            .split("\n")
            .filter((line) => /^#{1,6} /.test(line))
        expect(headings).toEqual([
            "# Population - Data package",
            "## CSV structure",
            "## Metadata.json structure",
            "## How we process data at Our World in Data",
            "## Detailed information about the data",
            "### Population",
            "#### How to cite this data",
            "#### What you should know about this data",
            "#### How this data is described by its producers",
            "#### Notes on our processing step for this indicator",
        ])
    })

    it("drops the full citation and softens the next-update date", () => {
        // The full citation restated producer names the Sources section now gives in
        // detail; metadata.json still carries it. The next-update date is our last
        // update plus the producer's stated period, so it is an expectation.
        const readme = constructReadme(
            ...readmeArgs({
                origins: [
                    {
                        producer: "IHME",
                        title: "Global Burden of Disease",
                        datePublished: "2020-01-01",
                        dateAccessed: "2020-06-01",
                        urlMain: "https://example.org/gbd",
                    },
                ],
                updatePeriodDays: 365,
            })
        )

        expect(readme).toContain("Next expected update:")
        expect(readme).not.toContain("Next update:")
        expect(readme).not.toContain("#### In-line citation")
        expect(readme).not.toContain("[original data]")
        // The attribution sits with the other facts about the indicator, above the
        // citation rather than trailing it.
        expect(readme.indexOf("Source: ")).toBeLessThan(
            readme.indexOf("#### How to cite this data")
        )
    })

    it("lists each source once, with what a re-user needs to know about it", () => {
        // Two indicators drawing on the same origin used to produce two identical
        // source blocks, each holding only a retrieval date and a URL.
        const readme = constructReadme(
            ...readmeArgs(
                {
                    origins: [
                        {
                            producer: "IHME",
                            title: "Global Burden of Disease",
                            description: "Estimates of disease burden.",
                            datePublished: "2020-01-01",
                            dateAccessed: "2020-06-01",
                            urlMain: "https://example.org/gbd",
                            urlDownload: "https://example.org/gbd.csv",
                            citationFull: "IHME (2020). GBD.",
                            license: {
                                name: "CC BY 4.0",
                                url: "https://example.org/license",
                            },
                        },
                    ],
                },
                2
            )
        )

        expect(
            readme.match(/^### IHME – Global Burden of Disease$/gm)
        ).toHaveLength(1)
        expect(readme).toContain("Producer: IHME")
        expect(readme).toContain("Published: 2020-01-01")
        expect(readme).toContain("Direct download: https://example.org/gbd.csv")
        expect(readme).toContain(
            "License: CC BY 4.0 (https://example.org/license)"
        )
        expect(readme).toContain("Citation: IHME (2020). GBD.")
        // One heading for the document, after the indicators, rather than a block
        // repeated inside each of them. Matched on the exact line because a single
        // deduplicated source is titled "## Source", not "## Sources".
        const headings = readme
            .split("\n")
            .filter((line) =>
                /^## (Source|Sources|Detailed information)/.test(line)
            )
        expect(headings).toEqual([
            "## Detailed information about each time series",
            "## Source",
        ])
    })
})

/**
 * A GrapherState over `count` synthetic columns sharing `def`, plus the rest of
 * `constructReadme`'s arguments.
 */
function readmeArgs(
    def: Partial<OwidColumnDef>,
    count = 1
): [GrapherState, CoreColumn[], URLSearchParams] {
    const slugs = _.range(count).map((i) =>
        i === 0 ? "population" : `population${i}`
    )
    const table = SynthesizeNonCountryTable({
        columnDefs: slugs.map((slug) => ({
            ...def,
            slug,
            type: ColumnTypeNames.Population,
            name: slug === "population" ? "Population" : `Population ${slug}`,
            generator: getRandomNumberGenerator(1e7, 1e9),
            growthRateGenerator: getRandomNumberGenerator(-5, 5),
        })),
    })
    const grapherState = new GrapherState({ table, ySlugs: slugs.join(" ") })
    return [
        grapherState,
        grapherState.tableForDownload.getColumns(slugs),
        new URLSearchParams(""),
    ]
}
