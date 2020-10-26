import { CoreTable } from "coreTable/CoreTable"
import { CsvString } from "coreTable/CoreTableConstants"
import { InvalidCellTypes } from "coreTable/InvalidCells"
import { OwidColumnDef, OwidTableSlugs } from "coreTable/OwidTableConstants"
import { flatten } from "grapher/utils/Util"
import { MegaRow, CovidRow, MegaColumnMap, MegaSlugs } from "./CovidConstants"
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

export const MegaCsvToCovidExplorerTable = (
    megaCsv: CsvString,
    metaDataFromGrapherBackend?: any
) => {
    const coreTable = new CoreTable<MegaRow>(megaCsv, MegaColumnDefs, {
        tableDescription: "Load from MegaCSV",
        rowConversionFunction: (object) => {
            for (const key in object) {
                const value = object[key]
                if (key === MegaSlugs.location) {
                    delete object[key]
                    object[OwidTableSlugs.entityName] = value
                } else if (key === MegaSlugs.iso_code) {
                    delete object[key]
                    object[OwidTableSlugs.entityCode] = value
                } else if (key === MegaSlugs.date) {
                    object[OwidTableSlugs.time] = megaDateToTime(value)
                } else if (
                    key === MegaSlugs.test_units ||
                    key === MegaSlugs.continent
                ) {
                    object[key] = value.toString()
                } else {
                    const number = +value
                    if (!isNaN(number)) object[key] = number
                    else
                        object[key] =
                            InvalidCellTypes.UndefinedButShouldBeNumber
                }
            }
            return object
        },
    }).columnFilter(
        OwidTableSlugs.entityName,
        (name) => name !== "International",
        "Drop International rows"
    )

    // todo: this can be better expressed as a group + reduce.
    const continentGroups = coreTable.get(MegaSlugs.continent)!.valuesToIndices
    const continentNames = Array.from(continentGroups.keys()).filter(
        (cont) => cont
    )

    const continentRows = flatten(
        continentNames.map((continentName) => {
            const rows = coreTable.rowsAt(
                Array.from(continentGroups.get(continentName)!.values())
            )
            return calculateCovidRowsForGroup(
                (rows as any) as CovidRow[],
                continentName
            )
        })
    )

    const euRows = calculateCovidRowsForGroup(
        coreTable.columnFilter(
            OwidTableSlugs.entityName,
            (name) => euCountries.has(name as string),
            "Get EU countries"
        ).rows,
        "European Union"
    )

    // Drop the last day in aggregates containing Spain & Sweden
    euRows.pop()

    const tableWithRows = coreTable
        .appendRows(
            continentRows as any,
            `Added ${continentRows.length} continent rows`
        )
        .appendRows(euRows as any, `Added ${euRows.length} EU rows`)

    return new CovidExplorerTable(
        tableWithRows.columnStore,
        tableWithRows.defs,
        {
            parent: tableWithRows as any,
            tableDescription: "Loaded into CovidExplorerTable",
        }
    )
        .updateColumnsToHideInDataTable()
        .loadColumnDefTemplatesFromGrapherBackend(metaDataFromGrapherBackend)
}
