// todo: Remove this file when we've migrated OWID data and OWID charts to next version

import { ChartTypeName } from "../core/GrapherConstants.js"
import { Color } from "../../coreTable/CoreTableConstants.js"
import {
    ColumnTypeNames,
    CoreColumnDef,
} from "../../coreTable/CoreColumnDef.js"
import { LegacyGrapherInterface } from "../core/GrapherInterface.js"
import {
    diffDateISOStringInDays,
    isNumber,
    makeAnnotationsSlug,
    trimObject,
    uniqBy,
} from "../../clientUtils/Util.js"
import {
    OwidVariablesAndEntityKey,
    OwidVariableWithDataAndSource,
    OwidEntityKey,
} from "../../clientUtils/OwidVariable.js"
import {
    StandardOwidColumnDefs,
    OwidTableSlugs,
    OwidColumnDef,
    EntityId,
} from "../../coreTable/OwidTableConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { ColumnSlug, EPOCH_DATE } from "../../clientUtils/owidTypes.js"
import { OwidChartDimensionInterface } from "../../clientUtils/OwidVariableDisplayConfigInterface.js"

export const legacyToOwidTableAndDimensions = (
    json: OwidVariablesAndEntityKey,
    grapherConfig: Partial<LegacyGrapherInterface>
): { dimensions: OwidChartDimensionInterface[]; table: OwidTable } => {
    // Entity meta map

    const entityMetaById: OwidEntityKey = json.entityKey

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

    const entityColorColumnSlug =
        entityColorMap.size > 0 || grapherConfig.selectedEntityColors
            ? OwidTableSlugs.entityColor
            : undefined
    if (entityColorColumnSlug) {
        baseColumnDefs.set(entityColorColumnSlug, {
            slug: entityColorColumnSlug,
            type: ColumnTypeNames.Color,
            name: entityColorColumnSlug,
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
        const timeColumnDef = timeColumnDefFromOwidVariable(variable)
        columnDefs.set(timeColumnDef.slug, timeColumnDef)

        // Value column
        const valueColumnDef = columnDefFromOwidVariable(variable)
        const valueColumnColor =
            dimension.display?.color ??
            columnColorMap.get(dimension.variableId.toString())
        // Ensure the column slug is unique by copying it from the dimensions
        // (there can be two columns of the same variable with different targetTimes)
        valueColumnDef.slug = dimension.slug
        // Because database columns can contain mixed types, we want to avoid
        // parsing for Grapher data until we fix that.
        valueColumnDef.skipParsing = true
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
        const [annotationMap, annotationColumnDef] =
            annotationMapAndDefFromOwidVariable(variable)

        // Column values

        const times = timeColumnValuesFromOwidVariable(variable)
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
            columnStore[annotationColumnDef.slug] = entityNames.map(
                (entityName) => annotationMap!.get(entityName)
            )
        }

        if (entityColorColumnSlug) {
            columnStore[entityColorColumnSlug] = entityIds.map(
                (entityId) =>
                    grapherConfig.selectedEntityColors?.[
                        entityMetaById[entityId].name
                    ] ?? entityColorMap.get(entityId)
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
            (grapherConfig.type === ChartTypeName.ScatterPlot ||
                grapherConfig.type === ChartTypeName.Marimekko) &&
            isNumber(targetTime)
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

const fullJoinTables = (tables: OwidTable[]): OwidTable =>
    tables.reduce((joinedTable, table) => joinedTable.fullJoin(table))

const columnDefFromOwidVariable = (
    variable: OwidVariableWithDataAndSource
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
        nonRedistributable,
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
        nonRedistributable,
        sourceLink: source?.link,
        sourceName: source?.name,
        dataPublishedBy: source?.dataPublishedBy,
        dataPublisherSource: source?.dataPublisherSource,
        retrievedDate: source?.retrievedDate,
        additionalInfo: source?.additionalInfo,
        owidVariableId: variable.id,
        type: isContinent
            ? ColumnTypeNames.Continent
            : ColumnTypeNames.NumberOrString,
    }
}

const timeColumnDefFromOwidVariable = (
    variable: OwidVariableWithDataAndSource
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

const timeColumnValuesFromOwidVariable = (
    variable: OwidVariableWithDataAndSource
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

const convertLegacyYears = (years: number[], zeroDay: string): number[] => {
    // Only shift years if the variable zeroDay is different from EPOCH_DATE
    // When the dataset uses days (`yearIsDay == true`), the days are expressed as integer
    // days since the specified `zeroDay`, which can be different for different variables.
    // In order to correctly join variables with different `zeroDay`s in a single chart, we
    // normalize all days to be in reference to a single epoch date.
    const diff = diffDateISOStringInDays(zeroDay, EPOCH_DATE)
    return years.map((y) => y + diff)
}

const annotationMapAndDefFromOwidVariable = (
    variable: OwidVariableWithDataAndSource
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

const annotationsToMap = (annotations: string): Map<string, string> => {
    // Todo: let's delete this and switch to traditional columns
    const entityAnnotationsMap = new Map<string, string>()
    const delimiter = ":"
    annotations.split("\n").forEach((line) => {
        const [key, ...words] = line.split(delimiter)
        entityAnnotationsMap.set(key.trim(), words.join(delimiter).trim())
    })
    return entityAnnotationsMap
}
