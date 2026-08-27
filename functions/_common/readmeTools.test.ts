import { expect, it, describe } from "vitest"

import { SynthesizeNonCountryTable } from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ColumnTypeNames } from "@ourworldindata/types"
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
})
