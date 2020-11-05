import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"
import {
    max,
    min,
    intersectionOfSets,
    findClosestTimeIndex,
    sum,
    flatten,
    uniq,
    sortNumeric,
    isPresent,
    sortedIndexBy,
    last,
    keyBy,
    groupBy,
    isNumber,
} from "grapher/utils/Util"
import {
    ColumnSlug,
    Integer,
    Time,
    TransformType,
    CoreColumnStore,
    Color,
} from "coreTable/CoreTableConstants"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { CoreTable } from "./CoreTable"
import { populationMap } from "./PopulationMap"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import {
    EntityName,
    OwidColumnDef,
    OwidRow,
    OwidTableSlugs,
} from "./OwidTableConstants"
import {
    legacyToOwidTableAndDimensions,
    makeAnnotationsSlug,
} from "./LegacyToOwidTable"
import { InvalidCell, InvalidCellTypes, isValid } from "./InvalidCells"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
} from "./CoreTablePrinters"
import { TimeBound } from "grapher/utils/TimeBounds"
import {
    getOriginalTimeColumnSlug,
    makeOriginalTimeSlugFromColumnSlug,
    timeColumnSlugFromColumnDef,
} from "./OwidTableUtil"
import {
    imemo,
    interpolateColumnsLinearly,
    interpolateColumnsWithTolerance,
    replaceDef,
} from "./CoreTableUtils"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"
import { OwidSourceProps } from "./OwidSource"

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends CoreTable<OwidRow, OwidColumnDef> {
    entityType = "Country"

    @imemo get availableEntityNames() {
        return Array.from(this.availableEntityNameSet)
    }

    @imemo get availableEntityNameSet() {
        return new Set(this.entityNameColumn.uniqValues)
    }

    // todo: can we remove at some point?
    @imemo get entityIdToNameMap() {
        return this.valueIndex(
            this.entityIdColumn.slug,
            this.entityNameColumn.slug
        ) as Map<number, string>
    }

    // todo: can we remove at some point?
    @imemo get entityCodeToNameMap() {
        return this.valueIndex(
            this.entityCodeColumn.slug,
            this.entityNameColumn.slug
        ) as Map<string, string>
    }

    // todo: can we remove at some point?
    @imemo get entityNameToIdMap() {
        return this.valueIndex(
            this.entityNameColumn.slug,
            this.entityIdColumn.slug
        ) as Map<string, number>
    }

    // todo: can we remove at some point?
    @imemo get entityNameToCodeMap() {
        return this.valueIndex(
            this.entityNameColumn.slug,
            this.entityCodeColumn.slug
        ) as Map<string, string>
    }

    @imemo get maxTime() {
        return last(this.allTimes)
    }

    @imemo get entityIdColumn() {
        return (
            this.getFirstColumnWithType(ColumnTypeNames.EntityId) ??
            this.get(OwidTableSlugs.entityId)
        )
    }

    @imemo get entityCodeColumn() {
        return (
            this.getFirstColumnWithType(ColumnTypeNames.EntityCode) ??
            this.get(OwidTableSlugs.entityCode)
        )
    }

    @imemo get minTime() {
        return this.allTimes[0]
    }

    @imemo private get allTimes(): Time[] {
        return this.sortedByTime.get(this.timeColumn.slug).parsedValues
    }

    @imemo get hasDayColumn() {
        return this.has(OwidTableSlugs.day)
    }

    @imemo get rowIndicesByEntityName() {
        return this.rowIndex([this.entityNameSlug])
    }

    // todo: instead of this we should probably make annotations another property on charts—something like "annotationsColumnSlugs"
    getAnnotationColumnForColumn(columnSlug: ColumnSlug) {
        const def = this.get(columnSlug).def as OwidColumnDef
        const slug =
            (def && def.annotationsColumnSlug) ??
            makeAnnotationsSlug(columnSlug)
        return this.get(slug)
    }

    getTimesUniqSortedAscForColumns(columnSlugs: ColumnSlug[]) {
        // todo: should be easy to speed up if necessary.
        return sortNumeric(
            uniq(
                flatten(
                    this.getColumns(columnSlugs)
                        .filter((col) => col)
                        .map((col) => col.uniqTimesAsc)
                )
            )
        )
    }

    timeDomainFor(slugs: ColumnSlug[]): [Time | undefined, Time | undefined] {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => col.minTime)
        const maxes = cols.map((col) => col.maxTime)
        return [min(mins), max(maxes)]
    }

    filterByEntityNames(names: EntityName[]) {
        const namesSet = new Set(names)
        return this.columnFilter(
            this.entityNameSlug,
            (value) => namesSet.has(value as string),
            `Filter out all entities except '${names}'`
        )
    }

    // Does a stable sort by time. You can refer to this table for fast time filtering.
    @imemo private get sortedByTime() {
        if (this.timeColumn.isMissing) return this
        return this.sortBy([this.timeColumn.slug])
    }

    filterByTimeRange(start: TimeBound, end: TimeBound): this {
        // We may want to do this time adjustment in Grapher instead of here.
        const adjustedStart = start === Infinity ? this.maxTime! : start
        const adjustedEnd = end === -Infinity ? this.minTime! : end

        const sortedTable = this.sortedByTime
        const rowsSortedByTime = sortedTable.rows

        // todo: we should set a time column onload so we don't have to worry about it again.
        const timeColumnSlug = this.timeColumn?.slug || OwidTableSlugs.time
        const firstRowIndex = sortedIndexBy(
            rowsSortedByTime,
            { [timeColumnSlug]: adjustedStart } as any,
            (row) => row[timeColumnSlug]
        )
        const lastRowIndex = sortedIndexBy(
            rowsSortedByTime,
            { [timeColumnSlug]: adjustedEnd + 1 } as any,
            (row) => row[timeColumnSlug]
        )

        // NB: this one does something tricky in that it is a 2 step transform. Probably want to do indexes instead.
        return sortedTable.transform(
            rowsSortedByTime.slice(firstRowIndex, lastRowIndex),
            this.defs,
            `Keep only rows with Time between ${adjustedStart} - ${adjustedEnd}`,
            TransformType.FilterRows
        )
    }

    filterByTargetTimes(targetTimes: Time[], tolerance: Integer = 0) {
        const timeColumn = this.timeColumn!
        const timeValues = timeColumn.allValues
        const entityNameToIndices = this.rowIndicesByEntityName
        const matchingIndices = new Set<number>()
        this.availableEntityNames.forEach((entityName) => {
            const indices = entityNameToIndices.get(entityName) || []
            const allTimes = indices.map(
                (index) => timeValues[index]
            ) as number[]

            targetTimes.forEach((targetTime) => {
                const index = findClosestTimeIndex(
                    allTimes,
                    targetTime,
                    tolerance
                )
                if (index !== undefined) matchingIndices.add(indices[index])
            })
        })

        return this.columnFilter(
            this.entityNameSlug,
            (row, index) => matchingIndices.has(index),
            `Keep a row for each entity for each of the closest times ${targetTimes.join(
                ", "
            )} with tolerance ${tolerance}`
        )
    }

    dropRowsWithInvalidValuesForColumn(slug: ColumnSlug) {
        return this.columnFilter(
            slug,
            (value) => isValid(value),
            `Drop rows with empty or invalid values in ${slug} column`
        )
    }

    dropRowsWithInvalidValuesForAnyColumn(slugs: ColumnSlug[]) {
        return this.rowFilter(
            (row) => slugs.every((slug) => isValid(row[slug])),
            `Drop rows with empty or invalid values in any column: ${slugs.join(
                ", "
            )}`
        )
    }

    dropRowsWithInvalidValuesForAllColumns(slugs: ColumnSlug[]) {
        return this.rowFilter(
            (row) => slugs.some((slug) => isValid(row[slug])),
            `Drop rows with empty or invalid values in every column: ${slugs.join(
                ", "
            )}`
        )
    }

    private sumsByTime(columnSlug: ColumnSlug) {
        const timeValues = this.timeColumn.parsedValues
        const values = this.get(columnSlug).parsedValues as number[]
        const map = new Map<number, number>()
        timeValues.forEach((time, index) =>
            map.set(time, (map.get(time) ?? 0) + values[index])
        )
        return map
    }

    // todo: this needs tests (and/or drop in favor of someone else's package)
    // Shows how much each entity contributed to the given column for each time period
    toPercentageFromEachEntityForEachTime(columnSlug: ColumnSlug) {
        const timeColumn = this.timeColumn!
        const col = this.get(columnSlug)
        const timeTotals = this.sumsByTime(columnSlug)
        const timeValues = timeColumn.parsedValues
        const newDef = {
            ...col.def,
            type: ColumnTypeNames.Percentage,
            values: col.parsedValues.map((val, index) => {
                const timeTotal = timeTotals.get(timeValues[index])
                if (timeTotal === undefined || timeTotal === 0)
                    return InvalidCellTypes.DivideByZeroError
                return (100 * (val as number)) / timeTotal
            }),
        }

        return new OwidTable(
            this.columnStore,
            replaceDef(this.defs, [newDef]),
            {
                parent: this,
                tableDescription: `Transformed ${columnSlug} column to be % contribution of each entity for that time`,
                transformCategory: TransformType.UpdateColumnDefs,
            }
        )
    }

    // If you want to see how much each column contributed to the entity for that year, use this.
    // NB: Uses absolute value. So if one entity added 100, and another -100, they both would have contributed "50%" to that year.
    // Otherwise we'd have NaN.
    toPercentageFromEachColumnForEachEntityAndTime(columnSlugs: ColumnSlug[]) {
        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return { ...def, type: ColumnTypeNames.RelativePercentage }
            return def
        })
        return new OwidTable(
            this.rows.map((row) => {
                const newRow = {
                    ...row,
                }
                const total = sum(
                    columnSlugs
                        .map((slug) => row[slug])
                        .filter(isValid)
                        .map((val) => Math.abs(val))
                )
                columnSlugs.forEach((slug) => {
                    const value =
                        total === 0
                            ? InvalidCellTypes.DivideByZeroError
                            : row[slug]
                    newRow[slug] = isValid(value)
                        ? (100 * value) / total
                        : value
                })
                return newRow
            }),
            newDefs,
            {
                parent: this,
                tableDescription: `Transformed columns from absolute numbers to % of abs sum of ${columnSlugs.join(
                    ","
                )} `,
                transformCategory: TransformType.UpdateColumnDefs,
            }
        )
    }

    // todo: this needs tests (and/or drop in favor of someone else's package)
    // If you wanted to build a table showing something like GDP growth relative to 1950, use this.
    toTotalGrowthForEachColumnComparedToStartTime(
        startTimeBound: TimeBound,
        columnSlugs: ColumnSlug[]
    ) {
        if (this.timeColumn.isMissing) return this
        const timeColumnSlug = this.timeColumn.slug
        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return { ...def, type: ColumnTypeNames.PercentChangeOverTime }
            return def
        })
        const newRows = flatten(
            Object.values(
                groupBy(
                    this.sortedByTime.rows,
                    (row) => row[this.entityNameSlug]
                )
            ).map((rowsForSingleEntity) => {
                columnSlugs.forEach((valueSlug) => {
                    let comparisonValue: number
                    rowsForSingleEntity = rowsForSingleEntity.map(
                        (row: Readonly<OwidRow>) => {
                            const newRow = {
                                ...row,
                            }

                            const value = row[valueSlug]

                            if (row[timeColumnSlug] < startTimeBound) {
                                newRow[valueSlug] =
                                    InvalidCellTypes.MissingValuePlaceholder
                            } else if (!isNumber(value)) {
                                newRow[valueSlug] =
                                    InvalidCellTypes.NaNButShouldBeNumber
                            } else if (comparisonValue !== undefined) {
                                // Note: comparisonValue can be negative!
                                // +value / -comparisonValue = negative growth, which is incorrect.
                                newRow[valueSlug] =
                                    (100 * (value - comparisonValue)) /
                                    Math.abs(comparisonValue)
                            } else if (value === 0) {
                                newRow[valueSlug] =
                                    InvalidCellTypes.MissingValuePlaceholder
                            } else {
                                comparisonValue = value
                                newRow[valueSlug] = 0
                            }

                            return newRow
                        }
                    )
                })
                return rowsForSingleEntity
            })
        )

        return this.transform(
            newRows,
            newDefs,
            `Transformed columns from absolute values to % of time ${startTimeBound} for columns ${columnSlugs.join(
                ","
            )} `,
            TransformType.UpdateColumnDefs
        )
    }

    // Return slugs that would be good to chart
    @imemo get suggestedYColumnSlugs() {
        const skips = new Set<ColumnSlug>([
            OwidTableSlugs.entityId,
            OwidTableSlugs.time,
            OwidTableSlugs.year,
            OwidTableSlugs.day,
        ])
        return this.numericColumnSlugs.filter((slug) => !skips.has(slug))
    }

    // Give our users a clean CSV of each Grapher. Assumes an Owid Table with entityName.
    toPrettyCsv() {
        return this.dropConstantColumns()
            .dropColumns([
                OwidTableSlugs.entityId,
                OwidTableSlugs.time,
                OwidTableSlugs.entityColor,
            ])
            .sortBy([this.entityNameSlug])
            .toCsvWithColumnNames()
    }

    // Pretty print all column sources (currently just used in debugging)
    sourcesTable(options: AlignedTextTableOptions) {
        const header = Object.values(OwidSourceProps)
        return toAlignedTextTable(
            [`slug`, ...header],
            this.defs.map((def) => {
                return { ...def.source, slug: def.slug }
            }),
            options
        )
    }

    @imemo get entityNameColorIndex() {
        return this.valueIndex(
            this.entityNameSlug,
            OwidTableSlugs.entityColor
        ) as Map<EntityName, Color>
    }

    getColorForEntityName(entityName: EntityName) {
        return this.entityNameColorIndex.get(entityName)
    }

    @imemo get columnDisplayNameToColorMap() {
        return keyBy(this.columnsAsArray, (col) => col.displayName)
    }

    getColorForColumnByDisplayName(displayName: string) {
        return this.columnDisplayNameToColorMap[displayName]?.def.color
    }

    // This assumes the table is sorted where the times for entity names go in asc order.
    // The whole table does not have to be sorted by time.
    getLatestValueForEntity(entityName: EntityName, columnSlug: ColumnSlug) {
        const indices = this.rowIndicesByEntityName.get(entityName)!
        const values = this.get(columnSlug).allValues
        const descending = indices.slice().reverse()
        const index = descending.find(
            (index) => !(values[index] instanceof InvalidCell)
        )
        return index !== undefined ? values[index] : undefined
    }

    entitiesWith(columnSlugs: ColumnSlug[]): Set<EntityName> {
        if (!columnSlugs.length) return new Set()
        if (columnSlugs.length === 1)
            return new Set(this.get(columnSlugs[0]).uniqEntityNames)

        return intersectionOfSets<EntityName>(
            columnSlugs.map((slug) => new Set(this.get(slug).uniqEntityNames))
        )
    }

    interpolateColumnWithTolerance(
        columnSlug: ColumnSlug,
        toleranceOverride?: number
    ) {
        const column = this.get(columnSlug)
        const columnDef = column.def as OwidColumnDef
        const tolerance = toleranceOverride ?? column.display.tolerance ?? 0
        const entityNameSlug = this.entityNameSlug

        const timeColumnOfTable = !this.timeColumn.isMissing
            ? this.timeColumn
            : // CovidTable does not have a day or year column so we need to use time.
              (this.get(OwidTableSlugs.time) as CoreColumn)

        const maybeTimeColumnOfValue =
            getOriginalTimeColumnSlug(this, columnSlug) ??
            timeColumnSlugFromColumnDef(columnDef)
        const timeColumnOfValue = this.get(maybeTimeColumnOfValue)
        const originalTimeSlug = makeOriginalTimeSlugFromColumnSlug(columnSlug)

        let columnStore: CoreColumnStore
        if (tolerance) {
            const withAllRows = this.complete([
                entityNameSlug,
                timeColumnOfTable.slug,
            ]).sortBy([entityNameSlug, timeColumnOfTable.slug])

            const groupBoundaries = withAllRows.groupBoundaries(entityNameSlug)
            const newValues = withAllRows
                .get(columnSlug)
                .allValues.slice() as number[]
            const newTimes = withAllRows
                .get(timeColumnOfValue.slug)
                .allValues.slice() as Time[]

            groupBoundaries.forEach((_, index) => {
                interpolateColumnsWithTolerance(
                    newValues,
                    newTimes,
                    tolerance,
                    groupBoundaries[index],
                    groupBoundaries[index + 1]
                )
            })

            columnStore = {
                ...withAllRows.columnStore,
                [columnSlug]: newValues,
                [originalTimeSlug]: newTimes,
            }
        } else {
            // If there is no tolerance still append the tolerance column
            columnStore = {
                ...this.columnStore,
                [originalTimeSlug]: timeColumnOfValue.allValues,
            }
        }

        return this.transform(
            columnStore,
            [
                ...this.defs,
                {
                    ...timeColumnOfValue.def,
                    slug: originalTimeSlug,
                },
            ],
            `Interpolated values in column ${columnSlug} with tolerance ${tolerance} and appended column ${originalTimeSlug} with the original times`,
            TransformType.UpdateColumnDefs
        )
    }

    interpolateColumnsLinearly(columnSlug: ColumnSlug) {
        const column = this.get(columnSlug)
        // If the column doesn't exist, return the table unchanged.
        if (!column) return this

        const columnDef = column?.def as OwidColumnDef

        const maybeTimeColumnSlug =
            getOriginalTimeColumnSlug(this, columnSlug) ??
            timeColumnSlugFromColumnDef(columnDef)
        const timeColumn =
            this.get(maybeTimeColumnSlug) ??
            (this.get(OwidTableSlugs.time) as CoreColumn) // CovidTable does not have a day or year column so we need to use time.

        const withAllRows = this.complete([
            OwidTableSlugs.entityName,
            timeColumn.slug,
        ]).sortBy([OwidTableSlugs.entityName, timeColumn.slug])

        const groupBoundaries = withAllRows.groupBoundaries(
            OwidTableSlugs.entityName
        )
        const newValues = withAllRows
            .get(columnSlug)!
            .allValues.slice() as number[]
        const newTimes = withAllRows
            .get(timeColumn.slug)!
            .allValues.slice() as Time[]

        groupBoundaries.forEach((index) => {
            interpolateColumnsLinearly(
                newValues,
                newTimes,
                groupBoundaries[index],
                groupBoundaries[index + 1]
            )
        })

        const columnStore = {
            ...withAllRows.columnStore,
            [columnSlug]: newValues,
        }

        return this.transform(
            columnStore,
            [
                ...this.defs,
                {
                    ...timeColumn.def,
                },
            ],
            `Interpolated values in column ${columnSlug} linearly`,
            TransformType.UpdateColumnDefs
        )
    }

    // This takes both the Variables and Dimensions data and generates an OwidTable.
    static fromLegacy(
        json: LegacyVariablesAndEntityKey,
        grapherConfig: Partial<LegacyGrapherInterface> = {}
    ) {
        const { table } = legacyToOwidTableAndDimensions(json, grapherConfig)
        return table
    }

    // one datum per entityName. use the closest value to target year within tolerance.
    // selected rows only. value from any primary column.
    // getClosestRowForEachSelectedEntity(targetYear, tolerance)
    // Make sure we use the closest value to the target year within tolerance (preferring later)
    getClosestIndexForEachEntity(
        entityNames: EntityName[],
        targetTime: Time,
        tolerance: Integer
    ) {
        const indexMap = this.rowIndicesByEntityName
        const timeColumn = this.timeColumn
        if (this.timeColumn.isMissing) return []
        const timeValues = timeColumn.allValues
        return entityNames
            .map((name) => {
                const rowIndices = indexMap.get(name)
                if (!rowIndices) return null

                const rowIndex = findClosestTimeIndex(
                    rowIndices.map((index) => timeValues[index]) as number[],
                    targetTime,
                    tolerance
                )
                return rowIndex ? rowIndices[rowIndex] : null
            })
            .filter(isPresent)
    }

    filterByPopulationExcept(minPop: number, entityNames: string[] = []) {
        const set = new Set(entityNames)
        return this.columnFilter(
            this.entityNameSlug,
            (value) => {
                const name = value as string
                const pop = populationMap[name]
                return !pop || set.has(name) || pop >= minPop
            },
            `Filter out countries with population less than ${minPop}`
        )
    }

    filterBySelectedOnly(selectedEntityNames: string[]) {
        const set = new Set(selectedEntityNames)
        return this.columnFilter(
            this.entityNameSlug,
            (name) => set.has(name as string),
            `Keep selected rows only`
        )
    }

    @imemo get availableEntities() {
        const { entityNameToCodeMap, entityNameToIdMap } = this
        return this.availableEntityNames.map((entityName) => {
            return {
                entityName,
                entityId: entityNameToIdMap.get(entityName),
                entityCode: entityNameToCodeMap.get(entityName),
            }
        })
    }

    sampleEntityName(howMany = 1) {
        return this.availableEntityNames.slice(0, howMany)
    }
}

// This just assures that even an emtpty OwidTable will have an entityName column. Probably a cleaner way to do this pattern (add a defaultColumns prop??)
export const BlankOwidTable = () =>
    new OwidTable(
        undefined,
        [
            { slug: OwidTableSlugs.entityName },
            { slug: OwidTableSlugs.year, type: ColumnTypeMap.Year },
        ],
        { tableDescription: `Loaded Blank OwidTable` }
    )
