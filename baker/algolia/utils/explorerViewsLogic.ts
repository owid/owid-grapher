import { ExplorerType, OwidColumnDef } from "@ourworldindata/types"
import {
    ExplorerChartCreationMode,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import { ExplorerViewBaseRecord } from "./types.js"

/**
 * Matches "duplicate 1234", to catch the (hacky) rows that are using the `duplicate` transformation to create
 * different views of the same indicator in indicator-based explorers
 */
const TRANSFORM_DUPLICATE_ID_REGEX = /duplicate (\d+)$/

const EXPLORER_TYPE_BY_CHART_CREATION_MODE: Record<
    ExplorerChartCreationMode,
    ExplorerType
> = {
    [ExplorerChartCreationMode.FromGrapherId]: ExplorerType.Grapher,
    [ExplorerChartCreationMode.FromVariableIds]: ExplorerType.Indicator,
    [ExplorerChartCreationMode.FromExplorerTableColumnSlugs]: ExplorerType.Csv,
}

export function getDuplicateTransformationRows(
    columnDefs: OwidColumnDef[]
): OwidColumnDef[] {
    return columnDefs.filter((row) =>
        row.transform?.match(TRANSFORM_DUPLICATE_ID_REGEX)
    )
}

export function getExplorerType(program: ExplorerProgram): ExplorerType {
    return EXPLORER_TYPE_BY_CHART_CREATION_MODE[program.chartCreationMode]
}

/**
 * Enhances explorer records by adding missing yVariableIds from transform definitions.
 *
 * Some indicator explorers have their variable IDs defined in the transforms column rather than
 * directly in yVariableIds. (e.g. https://github.com/owid/owid-content/commit/6f17c705d331a13380e9a52f3d319c9a51054625)
 *
 * This function extracts those IDs from "duplicate" transforms and adds them to the appropriate base records.
 *
 * Example:
 * - Base record: { ySlugs: ["gdp"], yVariableIds: [] }
 * - Transform: { slug: "gdp", transform: "duplicate 1234" }
 * - Result: { ySlugs: ["gdp"], yVariableIds: [1234] }
 */
export function addDuplicateYVariableIds(
    baseRecords: ExplorerViewBaseRecord[],
    duplicateTransforms: OwidColumnDef[]
): ExplorerViewBaseRecord[] {
    // e.g. { "gdp" => 1234 }
    const slugToVariableId = duplicateTransforms.reduce(
        (map, { slug, transform }) => {
            const match = transform?.match(TRANSFORM_DUPLICATE_ID_REGEX)
            if (match) {
                map.set(slug, parseInt(match[1]))
            }
            return map
        },
        new Map<string, number>()
    )

    return baseRecords.map((record) => {
        const yVariableIds = record.ySlugs
            .map((slug) => slugToVariableId.get(slug))
            .filter((id): id is number => !!id)

        return {
            ...record,
            yVariableIds: [...record.yVariableIds, ...yVariableIds],
        }
    })
}
