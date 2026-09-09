import { expect, it, describe } from "vitest"

import { SynthesizeNonCountryTable } from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ColumnTypeNames, type GrapherValuesJson } from "@ourworldindata/types"
import { getRandomNumberGenerator } from "@ourworldindata/utils"
import { extensions } from "./env.js"
import { constructPageMarkdown, prefersMarkdown } from "./pageMarkdownTools.js"

function makeGrapherState(overrides: Record<string, unknown> = {}) {
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
        ...overrides,
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

    it("puts the extension before the query, exactly once", () => {
        // initGrapher sets manager.baseUrl and queryStr, which is what makes
        // canonicalUrl carry the query in production.
        const grapherState = makeGrapherState({
            manager: {
                baseUrl: "https://ourworldindata.org/grapher/population",
            },
            queryStr: "?country=~USA&time=2000..2023",
        })
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            "?country=~USA&time=2000..2023"
        )

        // `canonicalUrl` is baseUrl + queryStr, so naively appending the extension
        // to it produced `/slug?country=~USA.csv?country=~USA`: a URL pointing at
        // the HTML page with a mangled country value. Assert on whole lines, since
        // a substring check passes on that corrupted form too.
        expect(markdown).toContain(
            "- Data as CSV: https://ourworldindata.org/grapher/population.csv?country=~USA&time=2000..2023"
        )
        expect(markdown).not.toMatch(/\?country=~USA[^\s]*\.csv/)
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

    it("lists every entity, not just the ones the chart selects", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            ""
        )

        expect(markdown).toContain("## Latest value for every entity")
        // SynthesizeNonCountryTable generates entities the chart never selects;
        // the point of this section is that they show up anyway.
        for (const entityName of grapherState.tableForDownload.get("population")
            .uniqEntityNames) {
            expect(markdown).toContain(`| ${entityName} |`)
        }
    })

    it("names the shared year in prose when every entity reports the same one", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            ""
        )

        // The synthesized table is complete, so every entity shares the end year
        // and a per-row Year column would repeat it for nothing.
        expect(markdown).toMatch(/All entities in \d{4}\./)
        expect(markdown).not.toContain("| Entity | Population | Year |")
    })

    it("headings the About section with the indicator title as text", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [makeValues("World", "2.5 billion", "8 billion")],
            ""
        )

        // `titlePublicOrDisplayName` is IndicatorTitleWithFragments, so
        // interpolating it directly renders "[object Object]".
        expect(markdown).not.toContain("[object Object]")
        expect(markdown).toContain("### Population")
    })

    it("reads a scatter plot's x indicator from the x datapoint", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        // constructGrapherValuesJson puts the y series in `points.y` and the x-axis
        // indicator in `points.x`; searching only `y` left every x cell blank.
        const values: GrapherValuesJson = {
            entityName: "World",
            startTime: 1950,
            endTime: 2023,
            columns: {
                population: { name: "Population", unit: "people" },
                gdp: { name: "GDP", unit: "int-$" },
            },
            startValues: {
                y: [
                    { columnSlug: "population", formattedValue: "2.5 billion" },
                ],
                x: { columnSlug: "gdp", formattedValue: "$10 trillion" },
            },
            endValues: {
                y: [{ columnSlug: "population", formattedValue: "8 billion" }],
                x: { columnSlug: "gdp", formattedValue: "$100 trillion" },
            },
            source: "Test source",
        }

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [values],
            ""
        )

        expect(markdown).toContain("| World | $10 trillion | $100 trillion |")
    })

    it("uses the datapoint's formatted time for subannual charts", () => {
        const grapherState = makeGrapherState()
        const columns = grapherState.tableForDownload.getColumns(["population"])

        // On a daily chart Time is a day offset from the epoch, so joining the raw
        // numbers produced headings like "18262" instead of a date.
        const values: GrapherValuesJson = {
            entityName: "World",
            startTime: 18262,
            endTime: 19000,
            columns: { population: { name: "Population", unit: "people" } },
            startValues: {
                y: [
                    {
                        columnSlug: "population",
                        formattedValue: "1",
                        formattedTime: "Jan 1, 2020",
                    },
                ],
            },
            endValues: {
                y: [
                    {
                        columnSlug: "population",
                        formattedValue: "2",
                        formattedTime: "Jan 8, 2022",
                    },
                ],
            },
            source: "Test source",
        }

        const markdown = constructPageMarkdown(
            grapherState,
            columns,
            [values],
            ""
        )

        expect(markdown).toContain("| Entity | Jan 1, 2020 | Jan 8, 2022 |")
        expect(markdown).not.toContain("18262")
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

describe(prefersMarkdown, () => {
    it("is false for a browser, which asks for HTML and never markdown", () => {
        expect(
            prefersMarkdown(
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            )
        ).toBe(false)
    })

    it("is true for an agent fetcher that lists markdown first", () => {
        expect(prefersMarkdown("text/markdown, text/html, */*")).toBe(true)
    })

    it("is true when markdown is the only type asked for", () => {
        expect(prefersMarkdown("text/markdown")).toBe(true)
    })

    it("respects q-values over list order", () => {
        expect(prefersMarkdown("text/html;q=0.8, text/markdown")).toBe(true)
        expect(prefersMarkdown("text/markdown;q=0.5, text/html")).toBe(false)
    })

    it("lets HTML win when it is listed before markdown at equal weight", () => {
        expect(prefersMarkdown("text/html, text/markdown")).toBe(false)
    })

    it("is false for wildcards, an empty header or no header", () => {
        expect(prefersMarkdown("*/*")).toBe(false)
        expect(prefersMarkdown("")).toBe(false)
        expect(prefersMarkdown(null)).toBe(false)
        expect(prefersMarkdown(undefined)).toBe(false)
    })
})
