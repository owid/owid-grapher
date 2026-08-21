// todo: Remove this file when we've migrated OWID data and OWID charts to next version

import * as _ from "lodash-es"
import {
    ColumnTypeNames,
    CoreColumnDef,
    CoreColumnStore,
    StandardOwidColumnDefs,
    OwidTableSlugs,
    OwidColumnDef,
    OwidVariableDimensions,
    OwidVariableDataMetadataDimensions,
    ErrorValue,
    OwidChartDimensionInterfaceWithMandatorySlug,
    OwidChartDimensionInterface,
    EntityName,
    TimeInterval,
} from "@ourworldindata/types"
import {
    OwidTable,
    ErrorValueTypes,
    makeAnnotationsSlug,
} from "@ourworldindata/core-table"
import {
    diffDatesInDays,
    epochDate,
    getYearFromISOStringAndDayOffset,
    intersection,
    trimObject,
    OwidEntityKey,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableWithSource,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    ColumnSlug,
    EPOCH_DATE,
    OwidVariableType,
    getTimeInterval,
    isSubYearly,
    findFinestCommonTimeInterval,
    snapToIntervalStart,
    dayjs,
} from "@ourworldindata/utils"
import { isContinentsVariableId } from "./GrapherConstants"
import * as R from "remeda"
import { getDimensionColumnSlug } from "../chart/ChartDimension.js"

/**
 * A lightweight table representation used while joining variables: just the
 * column values and defs, without any of the OwidTable machinery. Building a
 * real OwidTable for every variable would re-parse each non-skipParsing column
 * (a per-cell String()/parseFloat round trip that allocates a new array per
 * column); instead we construct the values with the right types directly and
 * only build one OwidTable at the very end.
 */
export interface JoinTable {
    columnStore: CoreColumnStore
    defs: OwidColumnDef[]
    numRows: number
}

export const owidTableToJoinTable = (table: OwidTable): JoinTable => ({
    columnStore: table.columnStore,
    defs: table.getColumns(table.columnSlugs).map((col) => col.def),
    numRows: table.numRows,
})

export const joinTableToOwidTable = (joinTable: JoinTable): OwidTable =>
    // Passing the values via the defs marks the columns as already typed, so
    // the constructor doesn't re-parse them
    new OwidTable(
        [],
        joinTable.defs.map((def) => ({
            ...def,
            values: joinTable.columnStore[def.slug],
        }))
    )

/** Mirrors what StringColumn.parse() would do with a missing value */
const toStringValueOrError = (
    value: string | undefined | null
): string | ErrorValue =>
    value === undefined
        ? ErrorValueTypes.UndefinedButShouldBeString
        : value === null
          ? ErrorValueTypes.NullButShouldBeString
          : value

export const legacyToOwidTableAndDimensionsWithMandatorySlug = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
): OwidTable => {
    const dimensionsWithSlug = dimensions?.map((dimension) => ({
        ...dimension,
        slug:
            dimension.slug ??
            getDimensionColumnSlug(dimension.variableId, dimension.targetYear),
    }))
    return legacyToOwidTableAndDimensions(
        json,
        dimensionsWithSlug,
        selectedEntityColors
    )
}

export const legacyToOwidTableAndDimensions = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterfaceWithMandatorySlug[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
): OwidTable => {
    // Entity meta map

    const entityMeta = [...json.values()].flatMap(
        (value) => value.metadata.dimensions.entities.values
    )
    const entityMetaById = new Map(
        entityMeta.map((entity) => [entity.id, entity])
    )

    // Base column defs, shared by all variable tables

    const baseColumnDefs: Map<ColumnSlug, OwidColumnDef> = new Map()
    StandardOwidColumnDefs.forEach((def) => {
        baseColumnDefs.set(def.slug, def)
    })

    // We need to create a column for each unique [variable, targetTime] pair. So there can be
    // multiple columns for a single variable.
    const dimensionColumns = _.uniqBy(dimensions, (dim) => dim.slug)

    const variableTablesToJoinByYear: JoinTable[] = []
    const variableTablesToJoinByDay: JoinTable[] = []
    const variableTablesWithYearToJoinByEntityOnly: JoinTable[] = []
    for (const dimension of dimensionColumns) {
        const variable = json.get(dimension.variableId)

        // TODO: this shouldn't happen but it does sometimes
        // when adding dimensions in the chart editor
        if (!variable) continue

        // Copy the base columnDef
        const columnDefs = new Map(baseColumnDefs)

        // Time column
        const timeColumnDef = timeColumnDefFromOwidVariable(variable.metadata)
        columnDefs.set(timeColumnDef.slug, timeColumnDef)

        // Value column
        const valueColumnDef = columnDefFromOwidVariable(variable.metadata)
        const valueColumnColor = dimension.display?.color
        // Ensure the column slug is unique by copying it from the dimensions
        // (there can be two columns of the same variable with different targetTimes)
        if (dimension.slug) valueColumnDef.slug = dimension.slug
        else throw new Error("Dimension slug was undefined")
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
            // if entityMetaById.get(id) does not exist, then we don't have
            // entity from variable metadata in MySQL. This can happen because
            // we take data from S3 and metadata from MySQL. After we unify it,
            // it should no longer be a problem
            (id) => entityMetaById.get(id)?.name ?? id.toString()
        )
        // see comment above about entityMetaById.get(id). Codes can be missing
        // and are stored as ErrorValues then, just like column parsing would
        const entityCodes = entityIds.map((id) =>
            toStringValueOrError(entityMetaById.get(id)?.code)
        )

        // If there is a conversionFactor, apply it.
        let values = variable.data.values || []
        const conversionFactor = valueColumnDef.display?.conversionFactor
        if (conversionFactor !== undefined) {
            values = values.map((value) =>
                _.isNumber(value) ? value * conversionFactor : value
            )

            // If a non-int conversion factor is applied to an integer column,
            // we end up with a numeric column.
            if (
                valueColumnDef.type === ColumnTypeNames.Integer &&
                !_.isInteger(conversionFactor)
            )
                valueColumnDef.type = ColumnTypeNames.Numeric
        }

        const columnStore: CoreColumnStore = {
            [OwidTableSlugs.EntityId]: entityIds,
            [OwidTableSlugs.EntityCode]: entityCodes,
            [OwidTableSlugs.EntityName]: entityNames,
            [timeColumnDef.slug]: times,
            [valueColumnDef.slug]: values,
        }

        if (annotationColumnDef) {
            // Missing annotations are stored as ErrorValues, just like column
            // parsing would
            columnStore[annotationColumnDef.slug] = entityNames.map(
                (entityName) =>
                    toStringValueOrError(annotationMap!.get(entityName))
            )
            columnDefs.set(annotationColumnDef.slug, annotationColumnDef)
        }
        // Build the tables

        const variableTable: JoinTable = {
            columnStore,
            defs: Array.from(columnDefs.values()),
            numRows: entityIds.length,
        }

        // If there is a targetTime set on the dimension, we need to perform the join on the
        // entities columns only, excluding any time columns.
        // We do this by dropping the column. We interpolate before which adds an originalTime
        // column which can be used to recover the time.
        const targetTime = dimension?.targetYear
        if (_.isNumber(targetTime)) {
            // These transforms need a real OwidTable, so we build one just for
            // this variable
            const owidTable = joinTableToOwidTable(variableTable)
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
                .interpolateColumnWithTolerance(valueColumnDef.slug, {
                    toleranceOverride: 0,
                })
                .dropColumns([timeColumnDef.slug])
            // We keep variables that have a targetTime set in a special bucket and will join them
            // on entity only (disregarding the year since we already filtered all other years out for
            // those variables)
            variableTablesWithYearToJoinByEntityOnly.push(
                owidTableToJoinTable(owidTable)
            )
        } else if (isSubYearly(getTimeInterval(variable.metadata.display)))
            variableTablesToJoinByDay.push(variableTable)
        else variableTablesToJoinByYear.push(variableTable)
    }

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
    // here we are only concerned with merging multiple variables into an inputTable that retains information.
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
        OwidTableSlugs.Day,
        OwidTableSlugs.EntityId,
    ])

    let joinedVariablesTable: JoinTable
    // If we have both day and year based variables we need to do some special logic as described above
    if (
        variableTablesToJoinByYear.length > 0 &&
        variableTablesToJoinByDay.length > 0
    ) {
        // Derive the year from the day column and add it to the joined days table
        const daysValues = variablesJoinedByDay.columnStore[OwidTableSlugs.Day]
        const getYearFromISOStringMemoized = _.memoize((dayValue: number) =>
            getYearFromISOStringAndDayOffset(EPOCH_DATE, dayValue)
        )
        const yearsForDaysValues = daysValues.map((dayValue) =>
            getYearFromISOStringMemoized(dayValue as number)
        )

        const variablesJoinedByDayWithYearFilled: JoinTable = {
            columnStore: {
                ...variablesJoinedByDay.columnStore,
                [OwidTableSlugs.Year]: yearsForDaysValues,
            },
            defs: [
                ...variablesJoinedByDay.defs,
                {
                    slug: OwidTableSlugs.Year,
                    name: OwidTableSlugs.Year,
                    type: ColumnTypeNames.Year,
                },
            ],
            numRows: variablesJoinedByDay.numRows,
        }

        // Now join the already merged days table with all the years. It is important
        // to not join the years together into one table already before so that each
        // table lookup for fallback values is looked at individually.
        // See the longer comment above for the idea behind the fallback cascade here of
        // trying to merge first by day+entity, then year+entity and finally entity only
        joinedVariablesTable = fullJoinTables(
            [variablesJoinedByDayWithYearFilled, ...variableTablesToJoinByYear],
            [OwidTableSlugs.Day, OwidTableSlugs.EntityId],
            [
                [OwidTableSlugs.Year, OwidTableSlugs.EntityId],
                [OwidTableSlugs.EntityId],
            ]
        )
        // If we have scatter/marimekko variables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.Day, OwidTableSlugs.EntityId],
                [[OwidTableSlugs.EntityId]]
            )
    } else if (variableTablesToJoinByYear.length > 0) {
        // If we only have year based variables then life is easy and we just join
        // those together without any special cases
        joinedVariablesTable = fullJoinTables(variableTablesToJoinByYear, [
            OwidTableSlugs.Year,
            OwidTableSlugs.EntityId,
        ])

        // If we have scatter/marimekko variables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.Year, OwidTableSlugs.EntityId],
                [[OwidTableSlugs.EntityId]]
            )
    } else {
        // If we only have day variables life is also easy but this case is rare
        joinedVariablesTable = variablesJoinedByDay

        // If we have scatter/marimekko variables that had a targetTime set
        // then these are now joined in by matching entity only
        if (variableTablesWithYearToJoinByEntityOnly.length > 0)
            joinedVariablesTable = fullJoinTables(
                [
                    joinedVariablesTable,
                    ...variableTablesWithYearToJoinByEntityOnly,
                ],
                [OwidTableSlugs.Day, OwidTableSlugs.EntityId],
                [[OwidTableSlugs.EntityId]]
            )
    }

    // A bucket can hold several intervals (e.g. a daily and a monthly indicator
    // both live in the day bucket), but the joined table has a single time
    // column, which should be tagged with the finest of them
    joinedVariablesTable = withFinestTimeColumnInterval(
        joinedVariablesTable,
        variableTablesToJoinByDay,
        OwidTableSlugs.Day
    )
    joinedVariablesTable = withFinestTimeColumnInterval(
        joinedVariablesTable,
        variableTablesToJoinByYear,
        OwidTableSlugs.Year
    )

    // Inject a common "time" column that is used as the main time column for the table
    // e.g. for the timeline.
    for (const dayOrYearSlug of [OwidTableSlugs.Day, OwidTableSlugs.Year]) {
        const sourceDef = joinedVariablesTable.defs.find(
            (def) => def.slug === dayOrYearSlug
        )
        if (sourceDef) {
            joinedVariablesTable = {
                columnStore: {
                    ...joinedVariablesTable.columnStore,
                    [OwidTableSlugs.Time]:
                        joinedVariablesTable.columnStore[dayOrYearSlug].slice(),
                },
                defs: [
                    ...joinedVariablesTable.defs,
                    {
                        ...sourceDef,
                        slug: OwidTableSlugs.Time,
                        name: OwidTableSlugs.Time,
                    },
                ],
                numRows: joinedVariablesTable.numRows,
            }
            // Do not inject multiple columns, terminate after one is successful
            break
        }
    }

    // Append the entity color column if we have selected entity colors
    if (!_.isEmpty(selectedEntityColors)) {
        const entityColorColumnSlug = OwidTableSlugs.EntityColor

        const valueFn = (
            entityName: EntityName | undefined
        ): string | ErrorValue => {
            if (!entityName) return ErrorValueTypes.UndefinedButShouldBeString
            return entityName && selectedEntityColors
                ? (selectedEntityColors[entityName] ??
                      ErrorValueTypes.UndefinedButShouldBeString)
                : ErrorValueTypes.UndefinedButShouldBeString
        }

        const entityNames =
            joinedVariablesTable.columnStore[OwidTableSlugs.EntityName] ?? []
        const values = entityNames.map((entityName) =>
            valueFn(entityName as EntityName)
        )

        joinedVariablesTable = {
            columnStore: {
                ...joinedVariablesTable.columnStore,
                [entityColorColumnSlug]: values,
            },
            defs: [
                ...joinedVariablesTable.defs,
                {
                    slug: entityColorColumnSlug,
                    name: entityColorColumnSlug,
                    type: ColumnTypeNames.Color,
                },
            ],
            numRows: joinedVariablesTable.numRows,
        }
    }
    return joinTableToOwidTable(joinedVariablesTable)
}

type JoinKeyFn = (rowIndex: number) => number

// String join keys ("2020 123") would mean a number-to-string conversion, a
// concatenation and string hashing for every row of every table - by far the
// most expensive part of the join. Our index columns (year/day and entityId)
// are always integers, so we instead encode a [time, entityId] tuple as the
// single number time * 2^26 + entityId, which is exact as long as
// |time| < 2^26 (years and days since epoch are far below 67 million) and
// 0 <= entityId < 2^26 (database ids). We validate this upfront and throw if
// any value doesn't fit.
// Note that this must be multiplication, not a bit shift: the composite key
// uses up to 52 bits, but JS bitwise operators truncate to 32-bit integers.
// Multiplication and addition are exact up to 2^53.
const NUMERIC_KEY_BASE = 2 ** 26

/**
 * Builds, for each table, a function that computes the numeric join key for
 * one of its rows over the given columns: the column value itself for a single
 * column, v0 * 2^26 + v1 for a pair (see above). Throws if any value doesn't
 * fit the encoding. Tables with `tableNeedsKeys` set to false are skipped
 * during validation and get a key function that must not be called (they may
 * lack the key columns entirely).
 */
const makeJoinKeyFns = (
    tables: JoinTable[],
    columnSlugs: string[],
    tableNeedsKeys: boolean[]
): JoinKeyFn[] => {
    if (columnSlugs.length !== 1 && columnSlugs.length !== 2)
        throw new Error(
            `Cannot join on ${columnSlugs.length} columns, only 1 or 2 are supported`
        )
    for (let t = 0; t < tables.length; t++) {
        if (!tableNeedsKeys[t]) continue
        const columnStore = tables[t].columnStore
        const numRows = tables[t].numRows
        columnSlugs.forEach((slug, i) => {
            const column = columnStore[slug]
            if (!column)
                throw new Error(
                    `Join column '${slug}' is missing from a table (columns: ${tables[
                        t
                    ].defs
                        .map((def) => def.slug)
                        .join(", ")})`
                )
            for (let row = 0; row < numRows; row++) {
                const value = column[row]
                if (typeof value !== "number" || !Number.isSafeInteger(value))
                    throw new Error(
                        `Join key value '${value}' in column '${slug}' is not an integer`
                    )
                if (
                    columnSlugs.length === 2 &&
                    (i === 0
                        ? Math.abs(value) >= NUMERIC_KEY_BASE
                        : value < 0 || value >= NUMERIC_KEY_BASE)
                )
                    throw new Error(
                        `Join key value ${value} in column '${slug}' does not fit the composite key encoding`
                    )
            }
        })
    }
    return tables.map((table) => {
        const columnStore = table.columnStore
        const col0 = columnStore[columnSlugs[0]]
        const col1 =
            columnSlugs.length === 2 ? columnStore[columnSlugs[1]] : undefined
        return col1
            ? (rowIndex): number =>
                  (col0[rowIndex] as number) * NUMERIC_KEY_BASE +
                  (col1[rowIndex] as number)
            : (rowIndex): number => col0[rowIndex] as number
    })
}

// Exported for benchmarking and testing (see LegacyToOwidTable.bench.ts), not
// meant to be used outside of this module.
export const fullJoinTables = (
    tables: JoinTable[],
    indexColumnNames: OwidTableSlugs[],
    mergeFallbackLookupColumns?: OwidTableSlugs[][]
): JoinTable => {
    // This function merges a number of tables together using a given list of columns
    // to be used as the merge key. The merge key columns are used to construct a full set
    // of index values from the various tables - all tables are enumerated, we create
    // a merged key value from the index column values for each row and then we create
    // a set from all these key values.
    // Note that not every table has to have values for all columns - not even all the index
    // columns have to exist on all tables (the index columns have to exist on the first table though)!
    // The reason for this and how this can possibly work
    // is that we also have a list of fallback merge columns. This is required so we can handle
    // not just the easy case where we have year+entity for every table to be merged (which in our
    // data model is by far the most common default), but also handle cases where we merge year and
    // day based variables together. For this latter case we need to still construct the set of index
    // values for the final table, but then when we try to look up values in the various tables to
    // merge together we will not find values by day+entity for the year based tables. So for this
    // case we get a series of fallback column tuples that we try in turn if the main index lookup
    // fails. These fallback tuples are year+entity first and then entity only. The reasoning here is
    // that e.g. when merging population to a day variable we want to merge the values from the year
    // matching the day from the population variable (year+entity lookup) but for variables that don't
    // have overlapping years (e.g. continents that only has 2015 as the single year) we want to fall back
    // to merging by entity alone as a last resort
    if (tables.length === 0) return { columnStore: {}, defs: [], numRows: 0 }
    else if (tables.length === 1) return tables[0]

    const columnSlugsPerTable = tables.map((table) =>
        table.defs.map((def) => def.slug)
    )

    // When we get a mergeFallbackLookupColumn then it can happen that a table does not
    // have all the columns of the main index. Those tables get no main index keys at all,
    // so all main lookups miss for them and we go through the fallback indexes instead
    const tableHasMainIndexColumns = columnSlugsPerTable.map(
        (columnSlugs) =>
            !mergeFallbackLookupColumns ||
            _.difference(indexColumnNames, columnSlugs).length === 0
    )
    const mainKeyFns = makeJoinKeyFns(
        tables,
        indexColumnNames,
        tableHasMainIndexColumns
    )

    // Pass 1: assign an output row to every distinct index key, in order of first
    // occurrence across the tables (this determines the row order of the joined table)
    const outputRowByKey = new Map<number, number>()
    for (let t = 0; t < tables.length; t++) {
        if (!tableHasMainIndexColumns[t]) continue
        const keyFn = mainKeyFns[t]
        const numRows = tables[t].numRows
        for (let row = 0; row < numRows; row++) {
            const key = keyFn(row)
            if (!outputRowByKey.has(key))
                outputRowByKey.set(key, outputRowByKey.size)
        }
    }
    const numOutputRows = outputRowByKey.size

    // Pass 2: for each table, resolve which of its rows (if any) belongs to each
    // output row. After this the actual row assembly is just array reads - no more
    // hashing. -1 means the table has no row for that output row. Note that these
    // arrays hold row indices into the source tables (not the up-to-52-bit join
    // keys), so int32 is plenty.
    const mainSourceRowPerTable = tables.map(() =>
        new Int32Array(numOutputRows).fill(-1)
    )
    const numMultipleMatchesPerTable = new Array(tables.length).fill(0)
    for (let t = 0; t < tables.length; t++) {
        if (!tableHasMainIndexColumns[t]) continue
        const keyFn = mainKeyFns[t]
        const sourceRow = mainSourceRowPerTable[t]
        const numRows = tables[t].numRows
        for (let row = 0; row < numRows; row++) {
            const outputRow = outputRowByKey.get(keyFn(row))!
            if (sourceRow[outputRow] === -1) sourceRow[outputRow] = row
            // Several rows of one table mapping to the same index key should be rare
            // but can come up. We keep the first row and log (once per table, after
            // the join) as a debugging hint in the console for weird edge cases.
            else numMultipleMatchesPerTable[t]++
        }
    }

    // Construct all the fallback indexes for all tables. mergeFallbackLookupColumns is an
    // array of arrays that is supposed to be treated as a sequence of tuples of column names.
    // Each lookup maps a table's fallback keys to rows, and comes with a key function that
    // turns a row of the first table into the lookup key for its fallback column tuple.
    // When we look up values and don't find a match in the main index we use these as the
    // fallback lookup keys. This is the case when we join year and day variables and then
    // use day+entityId as the key but the year variables don't have those - so for the year
    // variables we then check if there is a match using year+entityId where the year to use
    // comes from the first table that by convention HAS TO contain a year column with the
    // value to merge years on.
    const fallbackLookups = mergeFallbackLookupColumns?.map((columnSet) => {
        const keyFns = makeJoinKeyFns(
            tables,
            columnSet,
            tables.map(() => true)
        )
        return {
            firstTableKeyFn: keyFns[0],
            lastRowByKeyPerTable: tables.map((table, t) => {
                const keyFn = keyFns[t]
                const lastRowByKey = new Map<number, number>()
                const numRows = table.numRows
                // Later rows overwrite earlier ones, so a lookup yields the LAST row with
                // a given fallback key. In the usual case the fallback key should have
                // enough information to match just one row (e.g. year+entity). But for
                // cases when we join day and year variables we have as the ultimate
                // fallback a match by entity only and an entity like Germany of course has
                // many rows in e.g. the population variable. If this join here were
                // properly time and tolerance aware then we could avoid matching on entity
                // alone as the ultimate fallback but for now this function is not that
                // clever. We could thus choose any of the matching rows. Pre July 2022 the
                // code always chose the first one, which is often the first year that the
                // variable has data for for the given entity. This is not great, e.g. when
                // using a covid date based variable and joining it to population or
                // similar. Using the last row could in theory be pretty wrong as well but
                // in practice it often means a very close match. The proper solution as
                // mentioned above would be to never fall back to entity matches only and
                // move the tolerance matching into this function as well instead.
                for (let row = 0; row < numRows; row++)
                    lastRowByKey.set(keyFn(row), row)
                return lastRowByKey
            }),
        }
    })

    // Figure out which column names are shared. Shared columns (the index columns but also in our
    // data model stuff like entityCode and entityName that we usually have in addition to entityId)
    // will end up only once in the final table. This is a bit of a footgun for arbitrary data models
    // as we don't make sure that the values are equal for the same index values (we only assume that
    // this is true) - but this is how we have handled it in the past and it works with the setup we
    // have.
    const sharedColumnNames = intersection(...columnSlugsPerTable)

    // Now identify for each table which columns should be copied (i.e. all non-index columns).
    const columnsToAddPerTable = columnSlugsPerTable.map((columnSlugs) =>
        _.difference(columnSlugs, sharedColumnNames)
    )
    // Prepare the output column defs with preallocated value arrays (we know the number
    // of output rows already - one per unique index value). For each def we also keep a
    // reference to the column store array it is copied from so that we don't have to
    // re-resolve it for every cell.
    const makeOutputDefs = (
        table: JoinTable,
        columnNames: string[]
    ): { def: OwidColumnDef; values: any[]; sourceValues: any[] }[] => {
        const defsBySlug = new Map(table.defs.map((def) => [def.slug, def]))
        return columnNames.map((slug) => {
            const values = new Array(numOutputRows)
            return {
                def: { ...defsBySlug.get(slug)! },
                values,
                sourceValues: table.columnStore[slug],
            }
        })
    }
    // The shared columns end up only once in the output. We preferentially get their
    // values from the first table but because the first table is not guaranteed to
    // contain all index values we'll try the other tables in turn if the given row
    // index does not exist in the first table. For this we need each table's column
    // store array per shared column.
    const sharedDefs = makeOutputDefs(tables[0], sharedColumnNames)
    const sharedSourceValuesPerTable = tables.map((table) =>
        sharedColumnNames.map((slug) => table.columnStore[slug])
    )
    const ownDefsPerTable = R.zip(tables, columnsToAddPerTable).map(
        ([table, columnNames]) => makeOutputDefs(table, columnNames)
    )

    // Now assemble the output rows. All main index information is in the
    // mainSourceRowPerTable arrays already, so this loop is hashing-free except
    // for fallback lookups.
    for (let outputRow = 0; outputRow < numOutputRows; outputRow++) {
        // The first table with a row for this output row becomes the source for the
        // shared columns. The first table might not have one (e.g. a year that does not
        // exist in the first table) but because the output rows were generated from the
        // combined keys of all tables we are guaranteed to find a table with a row
        let sharedSourceTable = 0
        while (mainSourceRowPerTable[sharedSourceTable][outputRow] === -1)
            sharedSourceTable++
        const sharedRow = mainSourceRowPerTable[sharedSourceTable][outputRow]
        const sharedSourceValues = sharedSourceValuesPerTable[sharedSourceTable]
        for (let i = 0; i < sharedDefs.length; i++)
            sharedDefs[i].values[outputRow] = sharedSourceValues[i][sharedRow]

        // Figure out the fallback merge lookup keys from the first table (if the first
        // table has a row for this output row - otherwise there is nothing to derive
        // the fallback keys, e.g. the year, from)
        const firstTableRow = mainSourceRowPerTable[0][outputRow]
        const fallbackKeys =
            fallbackLookups && firstTableRow !== -1
                ? fallbackLookups.map((lookup) =>
                      lookup.firstTableKeyFn(firstTableRow)
                  )
                : undefined
        // Now add all the non-shared value columns. We loop over all tables and for
        // each resolve the source row for this output row: from the main index if it
        // had a match, otherwise by trying the fallbackKeys in turn. If no option
        // leads to a match we store ErrorValueTypes.NoMatchingValueAfterJoin in the
        // cells of this table's columns.
        for (let i = 0; i < tables.length; i++) {
            let sourceRow: number = mainSourceRowPerTable[i][outputRow]
            if (sourceRow === -1 && fallbackKeys && fallbackLookups) {
                for (
                    let fallback = 0;
                    fallback < fallbackKeys.length;
                    fallback++
                ) {
                    const fallbackRow = fallbackLookups[
                        fallback
                    ].lastRowByKeyPerTable[i].get(fallbackKeys[fallback])
                    if (fallbackRow !== undefined) {
                        sourceRow = fallbackRow
                        break
                    }
                }
            }
            if (sourceRow !== -1)
                for (const ownDef of ownDefsPerTable[i])
                    ownDef.values[outputRow] = ownDef.sourceValues[sourceRow]
            else
                // If neither the main index nor the fallbacks led to a hit we write
                // ErrorValueTypes.NoMatchingValueAfterJoin into the cells
                for (const ownDef of ownDefsPerTable[i])
                    ownDef.values[outputRow] =
                        ErrorValueTypes.NoMatchingValueAfterJoin
        }
    }

    numMultipleMatchesPerTable.forEach((count, i) => {
        if (count > 0)
            console.error(
                `Found ${count} duplicate rows for the join index in table #${i} (columns ${columnSlugsPerTable[
                    i
                ].join(", ")})`
            )
    })

    const outputEntries = [...sharedDefs, ...ownDefsPerTable.flat()]
    const columnStore: CoreColumnStore = {}
    for (const entry of outputEntries)
        columnStore[entry.def.slug] = entry.values
    return {
        columnStore,
        defs: outputEntries.map((entry) => entry.def),
        numRows: numOutputRows,
    }
}

/**
 * Relabels the joined time column with the finest interval that can represent
 * every joined variable table's times (each of their time columns knows its own)
 */
const withFinestTimeColumnInterval = (
    joinedTable: OwidTable,
    variableTables: OwidTable[],
    slug: OwidTableSlugs.Day | OwidTableSlugs.Year
): OwidTable => {
    const intervals = variableTables.map(
        (table) => table.get(slug).timeInterval
    )
    if (new Set(intervals).size < 2) return joinedTable
    const timeColumnDef =
        TIME_COLUMN_DEF_BY_INTERVAL[findFinestCommonTimeInterval(intervals)]
    return joinedTable.updateDefs((def) =>
        def.slug === slug ? { ...def, ...timeColumnDef } : def
    )
}

const variableTypeToColumnType = (type: OwidVariableType): ColumnTypeNames => {
    switch (type) {
        case "ordinal":
            return ColumnTypeNames.Ordinal
        case "string":
            return ColumnTypeNames.String
        case "int":
            return ColumnTypeNames.Integer
        case "float":
            return ColumnTypeNames.Numeric
        case "mixed":
        default:
            return ColumnTypeNames.NumberOrString
    }
}

const getSortFromDimensions = (
    dimensions: OwidVariableDimensions
): string[] | undefined => {
    const values = dimensions.values?.values
    if (!values) return

    const sort = values
        .map((value) => value.name)
        .filter((name) => name !== undefined)

    if (sort.length === 0) return

    return sort
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
        descriptionShort,
        descriptionProcessing,
        descriptionKey,
        descriptionFromProducer,
        source,
        origins,
        display,
        timespan,
        nonRedistributable,
        presentation,
        catalogPath,
        updatePeriodDays,
        shortName,
    } = variable

    const isContinent = isContinentsVariableId(variable.id)
    const name = variable.name

    // The column's type
    const parsedType = variable.type
        ? variableTypeToColumnType(variable.type)
        : ColumnTypeNames.NumberOrString

    // Override the column type for the special Continents variable
    const type = isContinent ? ColumnTypeNames.Continent : parsedType

    // Extract the sort order for ordinal variables from their dimension metadata.
    // This preserves the author-specified ordering of categorical values
    // (e.g., "Low", "Medium", "High").
    const sort =
        parsedType === ColumnTypeNames.Ordinal
            ? getSortFromDimensions(variable.dimensions)
            : undefined

    return {
        name,
        slug,
        unit,
        shortUnit,
        description,
        descriptionShort,
        descriptionProcessing,
        descriptionKey,
        descriptionFromProducer,
        coverage,
        datasetId,
        datasetName,
        display,
        color: display?.color,
        nonRedistributable,
        sourceLink: source?.link,
        sourceName: source?.name,
        dataPublishedBy: source?.dataPublishedBy,
        dataPublisherSource: source?.dataPublisherSource,
        retrievedDate: source?.retrievedDate,
        additionalInfo: source?.additionalInfo,
        timespan,
        origins,
        presentation,
        catalogPath,
        updatePeriodDays,
        owidVariableId: variable.id,
        owidProcessingLevel: variable.processingLevel,
        owidSchemaVersion: variable.schemaVersion,
        type,
        sort,
        shortName,
    }
}

// Maps each time interval to the time column it produces. Sub-yearly intervals
// all share the `day` slug (days-since-epoch) so they join in the same bucket
const TIME_COLUMN_DEF_BY_INTERVAL: Record<TimeInterval, OwidColumnDef> = {
    [TimeInterval.Day]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Day,
        name: "Day",
    },
    [TimeInterval.Week]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Week,
        name: "Week",
    },
    [TimeInterval.Month]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Month,
        name: "Month",
    },
    [TimeInterval.Quarter]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Quarter,
        name: "Quarter",
    },
    [TimeInterval.Year]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Year,
        name: "Year",
    },
    [TimeInterval.Decade]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Decade,
        name: "Decade",
    },
}

const timeColumnDefFromOwidVariable = (
    variableMetadata: OwidVariableWithSource
): OwidColumnDef => {
    return TIME_COLUMN_DEF_BY_INTERVAL[
        getTimeInterval(variableMetadata.display)
    ]
}

const timeColumnValuesFromOwidVariable = (
    variableMetadata: OwidVariableWithSource,
    variableData: OwidVariableMixedData
): number[] => {
    const { display } = variableMetadata
    const { years } = variableData

    const interval = getTimeInterval(display)

    // Shift day-encoded values expressed relative to a custom zeroDay onto the
    // shared EPOCH_DATE, so variables with different zeroDays are comparable
    const yearsNeedTransform =
        display &&
        isSubYearly(interval) &&
        display.zeroDay !== undefined &&
        display.zeroDay !== EPOCH_DATE
    let times = yearsNeedTransform
        ? convertLegacyYears(years || [], display.zeroDay!)
        : years || []

    // Snap sub-yearly values (except plain days) to the start of their period,
    // so variables that pick different representative days for the same period
    // still align. Memoized because the snapping goes through dayjs and the
    // same times come up once per entity
    if (isSubYearly(interval) && interval !== TimeInterval.Day) {
        const snapMemoized = _.memoize((time: number) =>
            snapToIntervalStart(time, interval)
        )
        times = times.map(snapMemoized)
    }

    return times
}

const convertLegacyYears = (years: number[], zeroDay: string): number[] => {
    // Only shift years if the variable zeroDay is different from EPOCH_DATE
    // When the dataset uses days, the days are expressed as integer
    // days since the specified `zeroDay`, which can be different for different variables.
    // In order to correctly join variables with different `zeroDay`s in a single chart, we
    // normalize all days to be in reference to a single epoch date.
    const diff = diffDatesInDays(dayjs.utc(zeroDay), epochDate())
    return years.map((y) => y + diff)
}

const annotationMapAndDefFromOwidVariable = (
    variable: OwidVariableWithSourceAndDimension
): [Map<string, string>, OwidColumnDef] | [] => {
    if (variable.display?.entityAnnotationsMap) {
        const slug = variable.id.toString()
        const annotationsSlug = makeAnnotationsSlug(slug)
        const annotationMap = annotationsToMap(
            variable.display.entityAnnotationsMap
        )
        const columnDef: OwidColumnDef = {
            slug: annotationsSlug,
            type: ColumnTypeNames.SeriesAnnotation,
            name: annotationsSlug,
            display: { includeInTable: false },
            derivedFrom: { columnSlug: slug, relationship: "annotations" },
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

/**
 * Loads a single variable into an OwidTable.
 */
export function buildVariableTable(
    variable: OwidVariableDataMetadataDimensions
): OwidTable {
    const entityMeta = variable.metadata.dimensions.entities.values
    const entityMetaById: OwidEntityKey = Object.fromEntries(
        entityMeta.map((entity) => [entity.id.toString(), entity])
    )

    // Base column defs, present in all OwidTables
    const baseColumnDefs: Map<ColumnSlug, CoreColumnDef> = new Map(
        StandardOwidColumnDefs.map((def) => [def.slug, def])
    )

    const columnDefs = new Map(baseColumnDefs)

    // Time column
    const timeColumnDef = timeColumnDefFromOwidVariable(variable.metadata)
    columnDefs.set(timeColumnDef.slug, timeColumnDef)

    // Value column
    const valueColumnDef = columnDefFromOwidVariable(variable.metadata)
    // Because database columns can contain mixed types, we want to avoid
    // parsing for Grapher data until we fix that.
    valueColumnDef.skipParsing = true
    columnDefs.set(valueColumnDef.slug, valueColumnDef)

    // Column values

    const times = timeColumnValuesFromOwidVariable(
        variable.metadata,
        variable.data
    )
    const entityIds = variable.data.entities ?? []
    const entityNames = entityIds.map(
        // if entityMetaById[id] does not exist, then we don't have entity
        // from variable metadata in MySQL. This can happen because we take
        // data from S3 and metadata from MySQL. After we unify it, it should
        // no longer be a problem
        (id) => entityMetaById[id]?.name ?? id.toString()
    )
    // see comment above about entityMetaById[id]
    const entityCodes = entityIds.map((id) => entityMetaById[id]?.code)

    // If there is a conversionFactor, apply it.
    let values = variable.data.values || []
    const conversionFactor = valueColumnDef.display?.conversionFactor
    if (conversionFactor !== undefined) {
        values = values.map((value) =>
            _.isNumber(value) ? value * conversionFactor : value
        )

        // If a non-int conversion factor is applied to an integer column,
        // we end up with a numeric column.
        if (
            valueColumnDef.type === ColumnTypeNames.Integer &&
            !_.isInteger(conversionFactor)
        )
            valueColumnDef.type = ColumnTypeNames.Numeric
    }

    const columnStore: { [key: string]: any[] } = {
        [OwidTableSlugs.EntityId]: entityIds,
        [OwidTableSlugs.EntityCode]: entityCodes,
        [OwidTableSlugs.EntityName]: entityNames,
        [timeColumnDef.slug]: times,
        [valueColumnDef.slug]: values,
    }

    return new OwidTable(columnStore, Array.from(columnDefs.values()))
}
