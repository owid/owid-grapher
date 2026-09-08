import { expect, it, describe } from "vitest"

import { SynthesizeNonCountryTable } from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ColumnTypeNames, type GrapherValuesJson } from "@ourworldindata/types"
import { getRandomNumberGenerator } from "@ourworldindata/utils"
import { extensions } from "./env.js"
import { constructPageMarkdown } from "./pageMarkdownTools.js"

function makeGrapherState() {
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
    return new GrapherState({
        table,
        ySlugs: "population",
        title: "Population",
        subtitle: "Measured in [terawatt-hours](#dod:watt-hours).",
    })
}

function makeValues(
    entityName: string,
    startValue: string,
    endValue: string
): GrapherValuesJson {
    return {
        entityName,
        startTime: 1950,
        endTime: 2023,
        columns: {
            population: { name: "Population", unit: "people" },
        },
        startValues: {
            y: [{ columnSlug: "population", formattedValue: startValue }],
        },
        endValues: {
            y: [{ columnSlug: "population", formattedValue: endValue }],
        },
        source: "Test source",
    }
}

describe(constructPageMarkdown, () => {
    it("renders one table row per entity, with the values under their years", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            ""
        )

        expect(markdown).toContain("## Values shown in this view")
        expect(markdown).toContain("| Entity | 1950 | 2023 |")
        expect(markdown).toContain("| World | 2.5 billion | 8 billion |")
        expect(markdown).toContain("**Population**, in people.")
    })

    it("keeps the query string on the data URLs so they resolve to the same view", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            "?country=~USA&time=2000..2023"
        )

        expect(markdown).toContain(".csv?country=~USA&time=2000..2023")
        expect(markdown).toContain(
            ".metadata.json?country=~USA&time=2000..2023"
        )
    })

    it("strips detail-on-demand links but keeps their visible label", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            ""
        )

        expect(markdown).not.toContain("#dod:")
        expect(markdown).toContain("Measured in terawatt-hours.")
    })

    it("omits the values section rather than emitting an empty table", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [{ source: "Test source" }],
            ""
        )

        expect(markdown).not.toContain("## Values shown in this view")
        expect(markdown).toContain("## Get this data")
    })
})

describe("the .md extension alongside .readme.md", () => {
    // redirectTools builds this regex from `Object.values(extensions)`, so the
    // order of that object decides whether `.readme.md` keeps its own suffix.
    it("still splits .readme.md as the readme extension", () => {
        const allExtensions = Object.values(extensions)
            .map((ext) => ext.replace(".", "\\."))
            .join("|")
        const regex = new RegExp(
            `^(?<slug>.*?)(?<extension>${allExtensions})?$`
        )

        const match = "life-expectancy.readme.md".match(regex)
        expect(match?.groups?.slug).toBe("life-expectancy")
        expect(match?.groups?.extension).toBe(extensions.readme)
    })

    it("splits a plain .md URL as the markdown extension", () => {
        const allExtensions = Object.values(extensions)
            .map((ext) => ext.replace(".", "\\."))
            .join("|")
        const regex = new RegExp(
            `^(?<slug>.*?)(?<extension>${allExtensions})?$`
        )

        const match = "life-expectancy.md".match(regex)
        expect(match?.groups?.slug).toBe("life-expectancy")
        expect(match?.groups?.extension).toBe(extensions.markdown)
    })
})
