import * as _ from "lodash-es"
import * as R from "remeda"
import { OwidTable } from "@ourworldindata/core-table"
import { trimObject } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    isIndicatorDimension,
    type ColumnSlug,
    type OwidChartDimensionInterface,
    type OwidColumnDef,
    type OwidVariableDisplayConfigInterface,
} from "@ourworldindata/types"

export interface ColumnDisplayOverride {
    columnSlug: ColumnSlug
    display?: OwidVariableDisplayConfigInterface
}

type DisplayBySlug = Map<ColumnSlug, OwidVariableDisplayConfigInterface>

export const applyDimensionDisplayAndConversionFactor = (
    table: OwidTable,
    dimensions: OwidChartDimensionInterface[]
): OwidTable =>
    applyDisplayAndConversionFactor(
        table,
        dimensions.flatMap((dimension) =>
            !isIndicatorDimension(dimension)
                ? [{ columnSlug: dimension.slug, display: dimension.display }]
                : []
        )
    )

export const applyDisplayAndConversionFactor = (
    table: OwidTable,
    overrides: ColumnDisplayOverride[]
): OwidTable => {
    const displayEntries = R.pipe(
        overrides,
        R.uniqueBy((override) => override.columnSlug),
        R.filter(({ columnSlug }) => table.has(columnSlug)),
        R.map(
            ({ columnSlug, display }) =>
                [columnSlug, trimObject(display ?? {})] as const
        ),
        R.filter(([, display]) => !R.isEmpty(display))
    )
    const displayBySlug = new Map(displayEntries)
    if (displayBySlug.size === 0) return table

    return scaleByConversionFactor(
        mergeDisplayIntoDefs(table, displayBySlug),
        displayBySlug
    )
}

const mergeDisplayIntoDefs = (
    table: OwidTable,
    displayBySlug: DisplayBySlug
): OwidTable => {
    return table.updateDefs((def): OwidColumnDef => {
        const display = displayBySlug.get(def.slug)
        if (!display) return def

        const mergedDef: OwidColumnDef = {
            ...def,
            display: { ...def.display, ...display },
        }
        if (display.color) mergedDef.color = display.color

        if (
            def.type === ColumnTypeNames.Integer &&
            display.conversionFactor !== undefined &&
            !_.isInteger(display.conversionFactor)
        )
            mergedDef.type = ColumnTypeNames.Numeric

        return mergedDef
    })
}

const scaleByConversionFactor = (
    table: OwidTable,
    displayBySlug: DisplayBySlug
): OwidTable => {
    let scaledTable = table
    for (const [slug, { conversionFactor }] of displayBySlug) {
        if (conversionFactor === undefined || conversionFactor === 1) continue
        scaledTable = scaledTable.replaceCells([slug], (value) =>
            _.isNumber(value) ? value * conversionFactor : value
        )
    }
    return scaledTable
}
