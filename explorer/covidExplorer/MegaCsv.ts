import { CoreTable } from "coreTable/CoreTable"
import { CsvString, ColumnTypeNames } from "coreTable/CoreTableConstants"
import { OwidColumnDef, OwidTableSlugs } from "coreTable/OwidTableConstants"
import { flatten } from "grapher/utils/Util"
import { MegaRow, CovidRow, MegaColumnMap } from "./CovidConstants"
import { CovidExplorerTable } from "./CovidExplorerTable"
import {
    megaDateToTime,
    calculateCovidRowsForGroup,
    euCountries,
} from "./CovidExplorerUtils"

export const MegaColumnDefs = Object.keys(MegaColumnMap).map((slug) => {
    return {
        ...MegaColumnMap[slug],
        slug,
    } as OwidColumnDef
})

export const MegaCsvToCovidExplorerTable = (megaCsv: CsvString) => {
    const coreTable = new CoreTable<MegaRow>(megaCsv, MegaColumnDefs, {
        tableDescription: "Load from MegaCSV",
    })
        .withRenamedColumns({
            location: OwidTableSlugs.entityName,
            iso_code: OwidTableSlugs.entityCode,
        }) // todo: after a rename, the row interface has changed. how can we update the child tables with correct typings?
        .filter(
            (row: MegaRow) => row.location !== "International",
            "Drop International rows"
        )
        .appendColumns([
            {
                slug: OwidTableSlugs.time,
                type: ColumnTypeNames.Date,
                fn: ((row: MegaRow) => megaDateToTime(row.date)) as any,
            }, // todo: improve typings on ColumnFn.
        ])

    // todo: this can be better expressed as a group + reduce.
    const continentGroups = coreTable.get("continent")!.valuesToRows
    const continentNames = Array.from(continentGroups.keys()).filter(
        (cont) => cont
    )

    const continentRows = flatten(
        continentNames.map((continentName) => {
            const rows = Array.from(
                continentGroups.get(continentName)!.values()
            ) as CovidRow[]
            return calculateCovidRowsForGroup(rows, continentName)
        })
    )

    const euRows = calculateCovidRowsForGroup(
        coreTable.rows.filter((row) => euCountries.has(row.entityName)) as any,
        "European Union"
    )

    // Drop the last day in aggregates containing Spain & Sweden
    euRows.pop()

    const tableWithRows = coreTable
        .withRows(
            continentRows as any,
            `Added ${continentRows.length} continent rows`
        )
        .withRows(euRows as any, `Added ${euRows.length} EU rows`)

    return new CovidExplorerTable(
        (tableWithRows.rows as any) as CovidRow[], // todo: clean up typings
        tableWithRows.defs,
        {
            parent: tableWithRows as any,
            tableDescription: "Loaded into CovidExplorerTable",
        }
    )
}
