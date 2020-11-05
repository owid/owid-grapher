// todo: Remove this file when we've migrated OWID data and OWID charts to next version

import { ChartTypeName, EPOCH_DATE } from "grapher/core/GrapherConstants"
import { Color, ColumnSlug } from "coreTable/CoreTableConstants"
import { ColumnTypeNames, CoreColumnDef } from "coreTable/CoreColumnDef"

import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import {
    diffDateISOStringInDays,
    isNumber,
    trimObject,
    uniqBy,
} from "grapher/utils/Util"

import {
    LegacyVariablesAndEntityKey,
    LegacyEntityMeta,
    LegacyVariableConfig,
    LegacyChartDimensionInterface,
} from "./LegacyVariableCode"
import {
    StandardOwidColumnDefs,
    OwidTableSlugs,
    OwidColumnDef,
    EntityId,
} from "./OwidTableConstants"
import { OwidTable } from "./OwidTable"

export const makeAnnotationsSlug = (columnSlug: ColumnSlug) =>
    `${columnSlug}-annotations`

export const legacyToOwidTableAndDimensions = (
    json: LegacyVariablesAndEntityKey,
    grapherConfig: Partial<LegacyGrapherInterface>
): { dimensions: LegacyChartDimensionInterface[]; table: OwidTable } => {
    // Entity meta map

    const entityMetaById: { [id: string]: LegacyEntityMeta } = json.entityKey

    // Color maps

    const entityColorMap = new Map<EntityId, Color>()
    const columnColorMap = new Map<ColumnSlug, Color>()

    const dimensions = grapherConfig.dimensions || []

    grapherConfig.selectedData
        ?.filter((item) => item.entityId && item.color)
        .forEach((item) => {
            entityColorMap.set(item.entityId, item.color!)
            const varId = dimensions[item.index]?.variableId
            if (varId) columnColorMap.set(varId.toString(), item.color!)
        })

    // Base column defs, shared by all variable tables

    const baseColumnDefs: Map<ColumnSlug, CoreColumnDef> = new Map()
    StandardOwidColumnDefs.forEach((def) => {
        baseColumnDefs.set(def.slug, def)
    })

    const colorColumnSlug =
        entityColorMap.size > 0 ? OwidTableSlugs.entityColor : undefined
    if (colorColumnSlug) {
        baseColumnDefs.set(colorColumnSlug, {
            slug: colorColumnSlug,
            type: ColumnTypeNames.Color,
            name: colorColumnSlug,
        })
    }

    // We need to create a column for each unique [variable, targetTime] pair. So there can be
    // multiple columns for a single variable.
    const newDimensions = dimensions.map((dimension) => ({
        ...dimension,
        slug: dimension.targetYear
            ? `${dimension.variableId}-${dimension.targetYear}`
            : `${dimension.variableId}`,
    }))
    const dimensionColumns = uniqBy(newDimensions, (dim) => dim.slug)
    const variableTables = dimensionColumns.map((dimension) => {
        const variable = json.variables[dimension.variableId]

        // Copy the base columnDef
        const columnDefs = new Map(baseColumnDefs)

        // Time column
        const timeColumnDef = timeColumnDefFromLegacyVariable(variable)
        columnDefs.set(timeColumnDef.slug, timeColumnDef)

        // Value column
        const valueColumnDef = columnDefFromLegacyVariable(variable)
        const valueColumnColor = columnColorMap.get(
            dimension.variableId.toString()
        )
        // Ensure the column slug is unique by copying it from the dimensions
        // (there can be two columns of the same variable with different targetTimes)
        valueColumnDef.slug = dimension.slug
        if (valueColumnColor) {
            valueColumnDef.color = valueColumnColor
        }
        if (dimension) {
            valueColumnDef.display = {
                ...trimObject(valueColumnDef.display),
                ...trimObject(dimension.display),
            }
        }
        columnDefs.set(valueColumnDef.slug, valueColumnDef)

        // Annotations column
        const [
            annotationMap,
            annotationColumnDef,
        ] = annotationMapAndDefFromLegacyVariable(variable)

        // Column values

        const times = timeColumnValuesFromLegacyVariable(variable)
        const entityIds = variable.entities ?? []
        const entityNames = entityIds.map((id) => entityMetaById[id].name)
        const entityCodes = entityIds.map((id) => entityMetaById[id].code)

        // If there is a conversionFactor, apply it.
        let values = variable.values || []
        const conversionFactor = valueColumnDef.display?.conversionFactor
        if (conversionFactor !== undefined) {
            values = values.map((value) =>
                isNumber(value) ? value * conversionFactor : value
            )
        }

        const columnStore: { [key: string]: any[] } = {
            [OwidTableSlugs.entityId]: entityIds,
            [OwidTableSlugs.entityCode]: entityCodes,
            [OwidTableSlugs.entityName]: entityNames,
            [timeColumnDef.slug]: times,
            [valueColumnDef.slug]: values,
        }

        if (annotationColumnDef) {
            columnStore[
                annotationColumnDef.slug
            ] = entityNames.map((entityName) => annotationMap!.get(entityName))
        }

        if (colorColumnSlug) {
            columnStore[colorColumnSlug] = entityIds.map((entityId) =>
                entityColorMap.get(entityId)
            )
        }

        // Build the tables

        let variableTable = new OwidTable(
            columnStore,
            Array.from(columnDefs.values())
        )

        // If there is a targetTime set on the dimension, we need to perform the join on the
        // entities columns only, excluding any time columns.
        // We do this by dropping the column. We interpolate before which adds an originalTime
        // column which can be used to recover the time.
        const targetTime = dimension?.targetYear
        if (
            grapherConfig.type === ChartTypeName.ScatterPlot &&
            targetTime !== undefined
        ) {
            variableTable = variableTable
                // interpolateColumnWithTolerance() won't handle injecting times beyond the current
                // allTimes. So if targetYear is 2018, and we have data up to 2017, the
                // interpolation won't add the 2018 rows (unless we apply the interpolation after
                // the big join).
                // This is why we use filterByTargetTimes() which handles that case.
                .filterByTargetTimes(
                    [targetTime],
                    valueColumnDef.display?.tolerance
                )
                // Interpolate with 0 to add originalTimes column
                .interpolateColumnWithTolerance(valueColumnDef.slug, 0)
                // Drop the time column to join table only on entity
                .dropColumns([timeColumnDef.slug])
        }

        return variableTable
    })

    let joinedVariablesTable = variableTables.length
        ? fullJoinTables(variableTables)
        : new OwidTable()

    // Inject a common "time" column that is used as the main time column for the table
    // e.g. for the timeline.
    for (const dayOrYearSlug of [OwidTableSlugs.day, OwidTableSlugs.year]) {
        if (joinedVariablesTable.columnSlugs.includes(dayOrYearSlug)) {
            joinedVariablesTable = joinedVariablesTable.duplicateColumn(
                dayOrYearSlug,
                {
                    slug: OwidTableSlugs.time,
                    name: OwidTableSlugs.time,
                }
            )
            // Do not inject multiple columns, terminate after one is successful
            break
        }
    }

    return { dimensions: newDimensions, table: joinedVariablesTable }
}

const fullJoinTables = (tables: OwidTable[]) =>
    tables.reduce((joinedTable, table) => joinedTable.fullJoin(table))

const columnDefFromLegacyVariable = (
    variable: LegacyVariableConfig
): OwidColumnDef => {
    const slug = variable.id.toString() // For now, the variableId will be the column slug
    const {
        unit,
        shortUnit,
        description,
        coverage,
        datasetId,
        datasetName,
        source,
        display,
    } = variable

    // Without this the much used var 123 appears as "Countries Continent". We could rename in Grapher but not sure the effects of that.
    const isContinent = variable.id == 123
    const name = isContinent ? "Continent" : variable.name

    return {
        name,
        slug,
        isDailyMeasurement: variable.display?.yearIsDay,
        unit,
        shortUnit,
        description,
        coverage,
        datasetId,
        datasetName,
        display,
        source,
        owidVariableId: variable.id,
        type: isContinent ? ColumnTypeNames.Continent : ColumnTypeNames.Numeric,
    }
}

const timeColumnDefFromLegacyVariable = (
    variable: LegacyVariableConfig
): OwidColumnDef => {
    return variable.display?.yearIsDay
        ? {
              slug: OwidTableSlugs.day,
              type: ColumnTypeNames.Day,
              name: "Day",
          }
        : {
              slug: OwidTableSlugs.year,
              type: ColumnTypeNames.Year,
              name: "Year",
          }
}

const timeColumnValuesFromLegacyVariable = (
    variable: LegacyVariableConfig
): number[] => {
    const { display, years } = variable
    const yearsNeedTransform =
        display &&
        display.yearIsDay &&
        display.zeroDay !== undefined &&
        display.zeroDay !== EPOCH_DATE
    const yearsRaw = years || []
    return yearsNeedTransform
        ? convertLegacyYears(yearsRaw, display!.zeroDay!)
        : yearsRaw
}

const convertLegacyYears = (years: number[], zeroDay: string) => {
    // Only shift years if the variable zeroDay is different from EPOCH_DATE
    // When the dataset uses days (`yearIsDay == true`), the days are expressed as integer
    // days since the specified `zeroDay`, which can be different for different variables.
    // In order to correctly join variables with different `zeroDay`s in a single chart, we
    // normalize all days to be in reference to a single epoch date.
    const diff = diffDateISOStringInDays(zeroDay, EPOCH_DATE)
    return years.map((y) => y + diff)
}

const annotationMapAndDefFromLegacyVariable = (
    variable: LegacyVariableConfig
): [Map<string, string>, OwidColumnDef] | [] => {
    if (variable.display?.entityAnnotationsMap) {
        const slug = makeAnnotationsSlug(variable.id.toString())
        const annotationMap = annotationsToMap(
            variable.display.entityAnnotationsMap
        )
        const columnDef = {
            slug,
            type: ColumnTypeNames.SeriesAnnotation,
            name: slug,
        }
        return [annotationMap, columnDef]
    }
    return []
}

const annotationsToMap = (annotations: string) => {
    // Todo: let's delete this and switch to traditional columns
    const entityAnnotationsMap = new Map<string, string>()
    const delimiter = ":"
    annotations.split("\n").forEach((line) => {
        const [key, ...words] = line.split(delimiter)
        entityAnnotationsMap.set(key.trim(), words.join(delimiter).trim())
    })
    return entityAnnotationsMap
}
