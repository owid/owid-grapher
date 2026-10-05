import * as _ from "lodash-es"
import * as R from "remeda"
import { OwidTable } from "@ourworldindata/core-table"
import { trimObject } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    TransformType,
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
            !isIndicatorDimension(dimension) && dimension.slug !== undefined
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
    const defs = table.defs.map((def): OwidColumnDef => {
        const display = displayBySlug.get(def.slug)
        if (!display) return def
        return {
            ...def,
            display: { ...def.display, ...display },
            ...(display.color ? { color: display.color } : {}),
        }
    })
    return new OwidTable(table.columnStore, defs, {
        parent: table,
        tableDescription: "Applied slot display",
        transformCategory: TransformType.UpdateColumnDefs,
    })
}

const scaleByConversionFactor = (
    table: OwidTable,
    displayBySlug: DisplayBySlug
): OwidTable => {
    const columnStore = { ...table.columnStore }
    const defs = table.defs.map((def): OwidColumnDef => {
        const conversionFactor = displayBySlug.get(def.slug)?.conversionFactor
        if (conversionFactor === undefined) return def

        if (conversionFactor !== 1)
            columnStore[def.slug] = columnStore[def.slug].map((value) =>
                _.isNumber(value) ? value * conversionFactor : value
            )
        return def.type === ColumnTypeNames.Integer &&
            !_.isInteger(conversionFactor)
            ? { ...def, type: ColumnTypeNames.Numeric }
            : def
    })
    return new OwidTable(columnStore, defs, {
        parent: table,
        tableDescription: "Scaled by conversion factor",
        transformCategory: TransformType.UpdateRows,
    })
}
