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
    difference,
    flatten,
    intersection,
    isNumber,
    makeAnnotationsSlug,
    trimObject,
    uniqBy,
} from "../../clientUtils/Util.js"
import {
    OwidEntityKey,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableWithSource,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
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
import { sortBy, zip } from "lodash"
import { ErrorValueTypes } from "../../coreTable/ErrorValues.js"

export const legacyToOwidTableAndDimensions = (
    json: MultipleOwidVariableDataDimensionsMap,
    grapherConfig: Partial<LegacyGrapherInterface>
): { dimensions: OwidChartDimensionInterface[]; table: OwidTable } => {
    // Entity meta map

    const entityMeta = flatten(
        [...json.values()].map(
            (value) => value.metadata.dimensions.entities.values
        )
    )
    const entityMetaById: OwidEntityKey = Object.fromEntries(
        entityMeta.map((entity) => [entity.id.toString(), entity])
    )

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

    const variableTablesToJoinByYear: OwidTable[] = []
    const variableTablesToJoinByDay: OwidTable[] = []
    const variableTables = dimensionColumns.map((dimension) => {
        const variable = json.get(dimension.variableId)!

        // Copy the base columnDef
        const columnDefs = new Map(baseColumnDefs)

        // Time column
        const timeColumnDef = timeColumnDefFromOwidVariable(variable.metadata)
        columnDefs.set(timeColumnDef.slug, timeColumnDef)

        // Value column
        const valueColumnDef = columnDefFromOwidVariable(variable.metadata)
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
        if (dimension.targetYear !== undefined)
            valueColumnDef.targetTime = dimension.targetYear
        columnDefs.set(valueColumnDef.slug, valueColumnDef)

        // Annotations column
        const [annotationMap, annotationColumnDef] =
            annotationMapAndDefFromOwidVariable(variable.metadata)

        // Column values

        const times = timeColumnValuesFromOwidVariable(
            variable.metadata,
            variable.data
        )
        const entityIds = variable.data.entities ?? []
        const entityNames = entityIds.map(
            (id) => entityMetaById[id].name ?? id.toString()
        )
        const entityCodes = entityIds.map((id) => entityMetaById[id].code)

        // If there is a conversionFactor, apply it.
        let values = variable.data.values || []
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
            columnStore[entityColorColumnSlug] = entityIds.map((entityId) => {
                const entityName = entityMetaById[entityId].name
                const selectedEntityColors = grapherConfig.selectedEntityColors
                return entityName && selectedEntityColors
                    ? selectedEntityColors[entityName]
                    : entityColorMap.get(entityId)
            })
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

        if (variable.metadata.display?.yearIsDay)
            variableTablesToJoinByDay.push(variableTable)
        else variableTablesToJoinByYear.push(variableTable)
        return variableTable
    })

    const variablesJoinedByYear = fullJoinTables(variableTablesToJoinByYear, [
        OwidTableSlugs.year,
        OwidTableSlugs.entityId,
    ])
    const variablesJoinedByDay = fullJoinTables(variableTablesToJoinByDay, [
        OwidTableSlugs.day,
        OwidTableSlugs.entityId,
    ])

    let joinedVariablesTable =
        variableTablesToJoinByYear.length > 0 &&
        variableTablesToJoinByDay.length > 0
            ? fullJoinTables(
                  [variablesJoinedByDay, variablesJoinedByYear],
                  [OwidTableSlugs.entityId]
              )
            : variableTablesToJoinByYear.length > 0
            ? variablesJoinedByYear
            : variablesJoinedByDay

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

const fullJoinTables = (
    tables: OwidTable[],
    indexColumnNames: string[]
): OwidTable => {
    if (tables.length === 0) return new OwidTable()
    else if (tables.length === 1) return tables[0]
    // Get all the index values per table and then figure out the full set of all stringified index values
    const indexValuesPerTable = tables.map((table) =>
        table.rowIndex(indexColumnNames)
    )
    const sharedColumnNames = intersection(
        ...tables.map((table) => table.columnSlugs)
    )
    const allIndexValuesArray = indexValuesPerTable.flatMap((index) => [
        ...index.keys(),
    ])
    const allIndexValues = new Set(allIndexValuesArray)

    // Now identify for each table which columns should be copied (i.e. all non-index columns)
    const columnsToAddPerTable = tables.map((table) =>
        difference(table.columnSlugs, sharedColumnNames)
    )
    // Prepare a special entry for the Table + column names tuple that we will zip and
    // map in the next step. This special entry is the first one and contains only the
    // index columns from the first table and only once
    const firstTableDuplicateForIndices: [
        OwidTable | undefined,
        string[] | undefined
    ] = [tables[0], sharedColumnNames]
    const defsToAddPerTable = [firstTableDuplicateForIndices]
        .concat(zip(tables, columnsToAddPerTable))
        .map(
            (tableAndColumns) =>
                tableAndColumns[0]!
                    .getColumns(tableAndColumns[1]!)
                    .map((col) => {
                        const def = { ...col.def }
                        def.values = []
                        return def
                    }) as OwidColumnDef[]
        )
    for (const index of allIndexValues.values()) {
        // First we handle the index columns (defsToAddPerTable[0])
        for (const def of defsToAddPerTable[0]) {
            // The index columns are special - the first table might not have a value for each of the index columns
            // at the current index (e.g. a year that does not exist in the first table). We therefore have to keep
            // looking in the other tables until we find a table that has the values. Because the index values were
            // generated from the combined set of all index values we are guaranteed to find a value eventually before
            // we exceed the length of the tables array
            let tableIndex = 0
            let indexHits = indexValuesPerTable[tableIndex].get(index)
            while (indexHits === undefined) {
                tableIndex++
                indexHits = indexValuesPerTable[tableIndex].get(index)
            }
            def.values?.push(
                tables[tableIndex].columnStore[def.slug][indexHits[0]]
            )
        }
        // now add all the nonindex value columns
        // note that defsToAddPerTable has one more element than tables (the one duplicate of the
        // first table that we added in the beginning)
        for (let i = 0; i < tables.length; i++) {
            const indexHits = indexValuesPerTable[i].get(index)

            // if (indexHits !== undefined && indexHits.length > 1)
            //     console.error(
            //         `Found more than one matching row in table ${tables[i].tableSlug}`
            //     )
            for (const def of defsToAddPerTable[i + 1]) {
                // There is a special case for the first table that contains the index columns
                // If for a given row this first table doesn't have values for the index row then
                // we need to check the other tables until we find one that has a value for this index
                // for the key column

                if (indexHits !== undefined)
                    def.values?.push(
                        tables[i].columnStore[def.slug][indexHits[0]]
                    )
                // todo: use first or last match?
                else
                    def.values?.push(
                        ErrorValueTypes.NoMatchingValueAfterJoin as any
                    )
            }
        }
    }
    return new OwidTable(
        [],
        defsToAddPerTable.flatMap((defs) => defs)
    )
}

// const fullJoinTables = (tables: OwidTable[]): OwidTable => {
//     if (tables.length === 0) return new OwidTable()
//     else {
//         // Figure out the names of the columns that are shared and are thus the index columns
//         // TODO: we might want to mandate explicitly specifying this or get this from a different understanding of the data model

//         const tableColumnMembership: Map<string, Set<number>> = new Map()
//         // Create a map of column names to sets of table indices. If a column name occurs only once
//         // then the set of this column name will only have one member. If it occurs in all columns the length
//         // of the set will be the number of tables. For columns shared only between some tables (e.g. if
//         // there are two differen time columns and so only entity is shared between some) then the size of the
//         // set will be > 1 and < numtables
//         tables.forEach((table, index) => {
//             for (const columnSlug of table.columnSlugs) {
//                 const columnMembership =
//                     tableColumnMembership.get(columnSlug) ?? new Set()
//                 columnMembership.add(index)
//                 tableColumnMembership.set(columnSlug, columnMembership)
//             }
//         })
//         console.warn("Num tables", tables.length)
//         console.warn("Size of map", tableColumnMembership.size)
//         // Get an array of tuples of tablename, index set; and drop all columns that occur only once
//         const tableColumnMembershipArray = [
//             ...tableColumnMembership.entries(),
//         ].filter((item) => item[1].size > 1)
//         // Now sort it by number of tables sharing the column.
//         // NOTE: this algorithm does not work for a fully arbitrary number of columsn sharing arbitrary index columns
//         // it is instead built with the assumption in mind that tables may share a larger set of index columns or a
//         // smaller one (i.e year+entity or entity only)
//         // TODO: it would be better to have a time aware multi-table join here that can deal with years and days
//         tableColumnMembershipArray.sort((a, b) => b[1].size - a[1].size)
//         // const mergeBatches : [string[], Set<number>][] = []
//         let mergedTables: Set<number> = new Set()
//         let mergeResult: OwidTable | undefined = undefined
//         console.warn(
//             "We have the following table column membership",
//             tableColumnMembershipArray
//         )
//         for (let i = 0; i < tableColumnMembershipArray.length; i++) {
//             const columnSlug = tableColumnMembershipArray[i][0]
//             const initialTableIndicesSet = tableColumnMembershipArray[i][1]
//             const indexColumnsForCurrentJoin = [columnSlug]
//             let currentTableJoinSet = new Set(initialTableIndicesSet)
//             for (let j = i + 1; j < tableColumnMembershipArray.length; j++) {
//                 indexColumnsForCurrentJoin.push(
//                     tableColumnMembershipArray[j][0]
//                 )
//                 currentTableJoinSet = intersectionOfSets([
//                     currentTableJoinSet,
//                     tableColumnMembershipArray[j][1],
//                 ])
//             }
//             const tableJoinSetForCurrentBatch = differenceOfSets([
//                 currentTableJoinSet,
//                 mergedTables,
//             ])
//             console.warn(
//                 "About to try and do a merge",
//                 tableJoinSetForCurrentBatch
//             )
//             if (tableJoinSetForCurrentBatch.size > 0) {
//                 const mergeResultsArray = mergeResult ? [mergeResult] : []
//                 mergeResult = fullJoinTablesWithIndexColumns(
//                     mergeResultsArray.concat(
//                         tables.filter((table, index) =>
//                             tableJoinSetForCurrentBatch.has(index)
//                         )
//                     ),
//                     indexColumnsForCurrentJoin
//                 )
//                 console.warn(
//                     "full join on batch completed - columns",
//                     mergeResult.columnNames
//                 )
//                 mergedTables = unionOfSets([
//                     mergedTables,
//                     tableJoinSetForCurrentBatch,
//                 ])
//             }
//         }
//         return mergeResult!
//     }
// }

const columnDefFromOwidVariable = (
    variable: OwidVariableWithSourceAndDimension
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
    variableMetadata: OwidVariableWithSource
): OwidColumnDef => {
    return variableMetadata.display?.yearIsDay
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
    variableMetadata: OwidVariableWithSource,
    variableData: OwidVariableMixedData
): number[] => {
    const { display } = variableMetadata
    const { years } = variableData
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
    variable: OwidVariableWithSourceAndDimension
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
