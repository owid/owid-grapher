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
    getYearFromISOStringAndDayOffset,
    intersection,
    isNumber,
    makeAnnotationsSlug,
    trimObject,
    uniqBy,
    zip,
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
import { ErrorValueTypes } from "../../coreTable/ErrorValues.js"
import { makeKeyFn } from "../../coreTable/CoreTableUtils.js"

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
    const variableTablesWithYearToJoinByEntityOnly: OwidTable[] = []
    dimensionColumns.forEach((dimension) => {
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
                .dropColumns([timeColumnDef.slug])
            // We keep variables that have a targetTime set in a special bucket and will join them
            // on entity only (disregarding the year since we already filtered all other years out for
            // those variables)
            variableTablesWithYearToJoinByEntityOnly.push(variableTable)
        } else if (variable.metadata.display?.yearIsDay)
            variableTablesToJoinByDay.push(variableTable)
        else variableTablesToJoinByYear.push(variableTable)
    })

    // If we only had years then all we would need to do is a single fullJoinTables call and
    // we'd be done with it. But since we also have days this is a bit trickier. The
    // basic approach is to say that if we have day variables then we should join those internally
    // on day+entity first and day+entity becomes the primary index for our final table.
    // We then join this merged days table with all the year based variables.
    // The multi table join iterates over all the unique index values (day+entity).
    // To join this with years we derive the year from the day. The fullJoinTables then uses a number
    // of fallbacks when trying to find matching rows in the various tables: we first try to join by day+entity,
    // then by year+entity and finally entity only.
    // This last join by entity only is important so that variables that don't have values for years
    // that come up in the day+entity index we still retain the values. E.g. our continents table
    // has values for all countries but only for the year 2015. If we join that with covid era days
    // we still want to retain the continents so we have the fallback to entity only (this was also
    // the only behaviour prior to July 2022). Remember that tolerance will only be applied much later -
    // here we are only concerned with merging mutliple variables into an inputTable that retains information.
    // Another approach would be to convert years into days when we have days - then we could simplify the fallback
    // join key logic described above.
    // Another caveat is that by switching to day+entity as the primary index that we use to join we can drop some entities.
    // This happens e.g. with Antarctica if the continents table is used. Continents contains an entry for the entity Antarctica for 2015
    // that maps it (and 3 other territories) to the Antarctica continent. If the days variables don't have values for any of the
    // Antarctica entities then they will not be enumerated for the final join table and thus they will be dropped from the final table.
    // This is maybe counter to what you would expect from a full join but is simply an artifact of making days+entities the primary
    // index and not backporting years to days. We might want to revisit this in the future and/or also apply tolerance already
    // at this level here.

    // Merge all day based variables together (returns an empty table if there are none)
    const variablesJoinedByDay = fullJoinTables(variableTablesToJoinByDay, [
        OwidTableSlugs.day,
        OwidTableSlugs.entityId,
    ])

    let joinedVariablesTable: OwidTable
    // If we have both day and year based variables we need to do some special logic as described above
    if (
        variableTablesToJoinByYear.length > 0 &&
        variableTablesToJoinByDay.length > 0
    ) {
        // Derive the year from the day column and add it to the joined days table
        const daysColumn = variablesJoinedByDay.getColumns([
            OwidTableSlugs.day,
        ])[0]
        const yearsForDaysValues = []
        for (let i = 0; i < daysColumn.values.length; i++) {
            yearsForDaysValues.push(
                getYearFromISOStringAndDayOffset(
                    EPOCH_DATE,
                    daysColumn.values[i] as number
                )
            )
        }
        const newYearColumn = {
            ...daysColumn,
            slug: OwidTableSlugs.year,
            name: OwidTableSlugs.year,
            values: yearsForDaysValues,
        } as unknown as OwidColumnDef
        const variablesJoinedByDayWithYearFilled =
            variablesJoinedByDay.appendColumns([newYearColumn])

        // Now join the already merged days table with all the years. It is imporant
        // to not join the years together into one table already before so that each
        // table lookup for fallback values is looked at individually.
        // See the longer comment above for the idea behind the fallback cascade here of
        // trying to merge first by day+entity, then year+entity and finally entity only
        joinedVariablesTable = fullJoinTables(
            [variablesJoinedByDayWithYearFilled, ...variableTablesToJoinByYear],
            [OwidTableSlugs.day, OwidTableSlugs.entityId],
            [
                [OwidTableSlugs.year, OwidTableSlugs.entityId],
                [OwidTableSlugs.entityId],
            ]
        )
        // If we have scatter/marimekko varables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.day, OwidTableSlugs.entityId],
                [[OwidTableSlugs.entityId]]
            )
    } else if (variableTablesToJoinByYear.length > 0) {
        // If we only have year based variables then life is easy and we just join
        // those together without any special cases
        joinedVariablesTable = fullJoinTables(variableTablesToJoinByYear, [
            OwidTableSlugs.year,
            OwidTableSlugs.entityId,
        ])

        // If we have scatter/marimekko varables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.year, OwidTableSlugs.entityId],
                [[OwidTableSlugs.entityId]]
            )
    } else {
        // If we only have day variables life is also easy but this case is rare
        joinedVariablesTable = variablesJoinedByDay

        // If we have scatter/marimekko varables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.day, OwidTableSlugs.entityId],
                [[OwidTableSlugs.entityId]]
            )
    }

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
    indexColumnNames: OwidTableSlugs[],
    mergeFallbackLookupColumns?: OwidTableSlugs[][]
): OwidTable => {
    // This function merges a number of OwidTables together using a given list of columns
    // to be used as the merge key. The merge key columns are used to construct a full set
    // of index values from the various tables - all tables are enumerated, we create
    // a merged string value from the index column values for each row and then we create
    // a set from all these string values.
    // Note that not every table has to have values for all columns - not even all the index
    // columns have to exist on all tables (the index columns have to exist on the first table though)!
    // The reason for this and how this can possibly work
    // is that we also have a list of fallback merge columns. This is required so we can handle
    // not just the easy case where we have year+entity for every table to be merged (which in our
    // data model is by far the most common default), but also handle cases where we merge year and
    // day based variables together. For this latter case we need to still contstruct the set of index
    // values for the final table, but then when we try to look up values in the various tables to
    // merge together we will not find values by day+entity for the year based tables. So for this
    // case we get a series of fallback column tuples that we try in turn if the main index lookup
    // fails. These fallback tuples are year+entity first and then entity only. The reasoning here is
    // that e.g. when merging population to a day variable we want to merge the values from the year
    // matching the day from the population variable (year+entity lookup) but for variables that don't
    // have overlapping years (e.g. continents that only has 2015 as the single year) we want to fall back
    // to merging by entity alone as a last resort
    if (tables.length === 0) return new OwidTable()
    else if (tables.length === 1) return tables[0]

    // Get all the index values per table and then figure out the full set of all stringified index values
    const indexValuesPerTable = tables.map((table) =>
        // When we get a mergeFallbackLookupColumn then it can happen that a table does not have all the
        // columns of the main index. In this case, just return an empty map because that will lead all
        // lookups by main index to fail and we'll try the fallback index
        !mergeFallbackLookupColumns ||
        difference(indexColumnNames, table.columnSlugs).length === 0
            ? table.rowIndex(indexColumnNames)
            : new Map()
    )

    // Construct all the fallback index lookup values for all tables. mergeFallbackLookupColumns is an
    // array of array that is supposed to be treated as a sequence of tuples of column names
    const mergeFallbackLookupValuesPerTable = mergeFallbackLookupColumns
        ? mergeFallbackLookupColumns.map((fallbackColumns) =>
              tables.map((table) => table.rowIndex(fallbackColumns))
          )
        : undefined

    // Figure out which column names are shared. Shared columns (the index columns but also in our
    // data model stuff like entityCode and entityName that we usually have in addition to entityId)
    // will end up only once in the final table. This is a bit of a footgun for arbitrary data models
    // as we don't make sure that the values are equal for the same index values (we only assume that
    // this is true) - but this is how we have handled it in the past and it works with the setup we
    // have.
    const sharedColumnNames = intersection(
        ...tables.map((table) => table.columnSlugs)
    )
    const allIndexValuesArray = indexValuesPerTable.flatMap((index) => [
        ...index.keys(),
    ])
    const allIndexValues = new Set(allIndexValuesArray)

    // Now identify for each table which columns should be copied (i.e. all non-index columns).
    const columnsToAddPerTable = tables.map((table) =>
        difference(table.columnSlugs, sharedColumnNames)
    )
    // Prepare a special entry for the Table + column names tuple that we will zip and
    // map in the next step. This special entry is the first table and contains only the
    // unique columns (index + other tables that are shared among all tables).
    // We will preferentially get the unique values from the first table but because
    // the first table is not guaranteed to contain all index values we'll later on
    // try other tables for these shared columns if the given row index does
    // not exist in the first table
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
    // Now loop over all unique index values and for each assemble as full a row as we can manage by looking
    // up the values in the different source tables
    for (const index of allIndexValues.values()) {
        // First we handle the unique/index columns (defsToAddPerTable[0])
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
        // Now figure out the fallback merge lookup index value from the first table.
        // This is the fallback index we use when looking up values and we don't find a value in the normal index.
        // This is the case when we join year and day variables and then use day+entityid as the key but the year
        // variables don't have those - so for the year variables we then check if there is a match using year+entityId
        // where the year to use comes from the first table that by convention HAS TO contain a year column with the
        // value to merge years on.
        const indexHits = indexValuesPerTable[0].get(index)
        const fallbackMergeIndices =
            mergeFallbackLookupColumns && indexHits
                ? mergeFallbackLookupColumns.map((columnSet) =>
                      makeKeyFn(tables[0].columnStore, columnSet)(indexHits![0])
                  )
                : undefined
        // now add all the nonindex value columns. We now loop over all tables and for each non-shared column
        // we look up the value for the current row. We find the value for the current row by first trying to
        // look up a match based on the shared index values, indexValuesPerTable[i]. If we don't have a hit
        // for this row in this table then we try the fallbackMergeIndices in turn to see if we can merge
        // based on these fallback indexes. If no option leads to a match we store ErrorValueTypes.NoMatchingValueAfterJoin
        // in the cell.

        // note that defsToAddPerTable has one more element than tables (the one duplicate of the
        // first table that we added in the beginning that we use as the primary source for the shared columns)
        for (let i = 0; i < tables.length; i++) {
            let indexHits = indexValuesPerTable[i].get(index)

            if (indexHits !== undefined && indexHits.length > 1)
                // This case should be rare but it can come up. The old algorithm ran into this often because it
                // joined a lot more stuff on entity only and then when you look up by entity into a table that has
                // several years you end up with multiple matches. The old algorithm used to just pick one value.
                // We still do this utlimately but because we try to match even day and year variables by year+entity
                // first we should usually be able to find a unique match. The error output is here so that when
                // something is weird in an edge case then this shows up as a debugging hint in the console.
                console.error(
                    `Found more than one matching row in table ${tables[i].tableSlug}`
                )
            for (const def of defsToAddPerTable[i + 1]) {
                // If the main index led to a hit then we just copy the value into the new row from the source table
                if (indexHits !== undefined)
                    def.values?.push(
                        tables[i].columnStore[def.slug][indexHits[0]]
                    )
                else {
                    // If the main index did not lead to a hit then we try the fallback indices in turn
                    indexHits = undefined
                    for (
                        let fallbackIndex = 0;
                        fallbackMergeIndices &&
                        mergeFallbackLookupValuesPerTable &&
                        indexHits === undefined &&
                        fallbackIndex < fallbackMergeIndices!.length;
                        fallbackIndex++
                    ) {
                        indexHits = mergeFallbackLookupValuesPerTable[
                            fallbackIndex
                        ][i].get(fallbackMergeIndices[fallbackIndex])
                    }
                    if (indexHits !== undefined)
                        // If any of the fallbacks led to a hit then we use this hit
                        def.values?.push(
                            tables[i].columnStore[def.slug][indexHits[0]]
                        )
                    // If none of the fallback values worked either we write ErrorValueTypes.NoMatchingValueAfterJoin into the cell
                    else
                        def.values?.push(
                            ErrorValueTypes.NoMatchingValueAfterJoin as any
                        )
                }
            }
        }
    }
    return new OwidTable(
        [],
        defsToAddPerTable.flatMap((defs) => defs)
    )
}

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
