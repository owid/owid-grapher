import { replaceDef } from "./CoreTableUtils"
import { OwidTable } from "./OwidTable"
import { SampleColumnSlugs, SynthesizeGDPTable } from "./OwidTableSynthesizers"
import { toPercentageColumnDef } from "./OwidTableUtil"

describe(toPercentageColumnDef, () => {
    it("should format resulting column as percent", () => {
        const table = SynthesizeGDPTable(undefined, undefined, {
            numDecimalPlaces: 0,
            conversionFactor: 100,
        })
        const gdpColumn = table.get(SampleColumnSlugs.GDP)

        // Convert GDP column to percentage
        const columnDefs = replaceDef(table.defs, [
            toPercentageColumnDef(gdpColumn.def),
        ])

        // Create new table with new column def
        const newTable = new OwidTable(``, columnDefs)
        const percentageColumn = newTable.get(SampleColumnSlugs.GDP)

        expect(percentageColumn.formatValue(10.12)).toEqual("10.12%")
        expect(percentageColumn.formatValueForMobile(10.12)).toEqual("10.12%")
    })
})
