import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"
import {
    max,
    min,
    intersectionOfSets,
    findClosestTimeIndex,
    sumBy,
    flatten,
    uniq,
    sortNumeric,
    isPresent,
    last,
    keyBy,
    groupBy,
    isNumber,
    isEmpty,
    getClosestTimePairs,
    sortedFindClosest,
    pairs,
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
import { ErrorValue, ErrorValueTypes, isNotErrorValue } from "./ErrorValues"
import { TimeBound } from "grapher/utils/TimeBounds"
import {
    getOriginalTimeColumnSlug,
    makeOriginalTimeSlugFromColumnSlug,
    timeColumnSlugFromColumnDef,
} from "./OwidTableUtil"
import {
    imemo,
    linearInterpolation,
    toleranceInterpolation,
    replaceDef,
    InterpolationProvider,
} from "./CoreTableUtils"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"

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
        return this.sortedByTime.get(this.timeColumn.slug).values
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
        const slug = isEmpty(def?.annotationsColumnSlug)
            ? makeAnnotationsSlug(columnSlug)
            : def.annotationsColumnSlug
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

    originalTimeDomainFor(
        slugs: ColumnSlug[]
    ): [Time | undefined, Time | undefined] {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => min(col.originalTimes))
        const maxes = cols.map((col) => max(col.originalTimes))
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
        // todo: we should set a time column onload so we don't have to worry about it again.
        const timeColumnSlug = this.timeColumn?.slug || OwidTableSlugs.time
        // Sorting by time, because incidentally some parts of the code depended on this method
        // returning sorted rows.
        return this.sortedByTime.columnFilter(
            timeColumnSlug,
            (time) => time >= adjustedStart && time <= adjustedEnd,
            `Keep only rows with Time between ${adjustedStart} - ${adjustedEnd}`
        )
    }

    filterByTargetTimes(targetTimes: Time[], tolerance: Integer = 0) {
        const timeColumn = this.timeColumn!
        const timeValues = timeColumn.valuesIncludingErrorValues
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

    dropRowsWithErrorValuesForColumn(slug: ColumnSlug) {
        return this.columnFilter(
            slug,
            (value) => isNotErrorValue(value),
            `Drop rows with empty or ErrorValues in ${slug} column`
        )
    }

    // TODO rewrite with column ops
    // TODO move to CoreTable
    dropRowsWithErrorValuesForAnyColumn(slugs: ColumnSlug[]) {
        return this.rowFilter(
            (row) => slugs.every((slug) => isNotErrorValue(row[slug])),
            `Drop rows with empty or ErrorValues in any column: ${slugs.join(
                ", "
            )}`
        )
    }

    // TODO rewrite with column ops
    // TODO move to CoreTable
    dropRowsWithErrorValuesForAllColumns(slugs: ColumnSlug[]) {
        return this.rowFilter(
            (row) => slugs.some((slug) => isNotErrorValue(row[slug])),
            `Drop rows with empty or ErrorValues in every column: ${slugs.join(
                ", "
            )}`
        )
    }

    private sumsByTime(columnSlug: ColumnSlug) {
        const timeValues = this.timeColumn.values
        const values = this.get(columnSlug).values as number[]
        const map = new Map<number, number>()
        timeValues.forEach((time, index) =>
            map.set(time, (map.get(time) ?? 0) + values[index])
        )
        return map
    }

    // todo: this needs tests (and/or drop in favor of someone else's package)
    // Shows how much each entity contributed to the given column for each time period
    toPercentageFromEachEntityForEachTime(columnSlug: ColumnSlug) {
        if (!this.has(columnSlug)) return this
        const timeColumn = this.timeColumn!
        const col = this.get(columnSlug)
        const timeTotals = this.sumsByTime(columnSlug)
        const timeValues = timeColumn.values
        const newDefs = replaceDef(this.defs, [
            {
                ...col.def,
                type: ColumnTypeNames.Percentage,
            },
        ])
        const newColumnStore: CoreColumnStore = {
            ...this.columnStore,
            [columnSlug]: this.columnStore[columnSlug].map((val, index) => {
                const timeTotal = timeTotals.get(timeValues[index])
                if (timeTotal === 0) return ErrorValueTypes.DivideByZeroError
                return (100 * (val as number)) / timeTotal!
            }),
        }
        return this.transform(
            newColumnStore,
            newDefs,
            `Transformed ${columnSlug} column to be % contribution of each entity for that time`,
            TransformType.UpdateColumnDefsAndApply
        )
    }

    // If you want to see how much each column contributed to the entity for that year, use this.
    // NB: Uses absolute value. So if one entity added 100, and another -100, they both would have contributed "50%" to that year.
    // Otherwise we'd have NaN.
    toPercentageFromEachColumnForEachEntityAndTime(columnSlugs: ColumnSlug[]) {
        columnSlugs = columnSlugs.filter((slug) => this.has(slug))
        if (!columnSlugs.length) return this

        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return { ...def, type: ColumnTypeNames.RelativePercentage }
            return def
        })

        const columnStore = this.columnStore
        const columnStorePatch: CoreColumnStore = {}

        const totals = new Array(this.numRows).fill(0).map((_, i) =>
            sumBy(columnSlugs, (slug) => {
                const value = columnStore[slug][i]
                return isNumber(value) ? Math.abs(value) : 0
            })
        )

        columnSlugs.forEach((slug) => {
            columnStorePatch[slug] = columnStore[slug].map((value, i) => {
                const total = totals[i]
                if (!isNumber(value) || !isNumber(total)) return value
                if (total === 0) return ErrorValueTypes.DivideByZeroError
                return (100 * Math.abs(value)) / total
            })
        })

        const newColumnStore = {
            ...columnStore,
            ...columnStorePatch,
        }

        return this.transform(
            newColumnStore,
            newDefs,
            `Transformed columns from absolute numbers to % of abs sum of ${columnSlugs.join(
                ","
            )} `,
            TransformType.UpdateColumnDefs
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
                                    ErrorValueTypes.MissingValuePlaceholder
                            } else if (!isNumber(value)) {
                                newRow[valueSlug] =
                                    ErrorValueTypes.NaNButShouldBeNumber
                            } else if (comparisonValue !== undefined) {
                                // Note: comparisonValue can be negative!
                                // +value / -comparisonValue = negative growth, which is incorrect.
                                newRow[valueSlug] =
                                    (100 * (value - comparisonValue)) /
                                    Math.abs(comparisonValue)
                            } else if (value === 0) {
                                newRow[valueSlug] =
                                    ErrorValueTypes.MissingValuePlaceholder
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
        const indices = this.rowIndicesByEntityName.get(entityName)
        if (!indices) return undefined
        const values = this.get(columnSlug).valuesIncludingErrorValues
        const descending = indices.slice().reverse()
        const index = descending.find(
            (index) => !(values[index] instanceof ErrorValue)
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

    // Retrieves the two columns `columnSlug` and `timeColumnSlug` from the table and
    // passes their values to the respective interpolation method.
    // `withAllRows` is expected to be completed and sorted.
    private interpolate<K>(
        withAllRows: this,
        columnSlug: ColumnSlug,
        timeColumnSlug: ColumnSlug,
        interpolation: InterpolationProvider<K>,
        context: K
    ) {
        const groupBoundaries = withAllRows.groupBoundaries(this.entityNameSlug)
        const newValues = withAllRows
            .get(columnSlug)
            .valuesIncludingErrorValues.slice() as number[]
        const newTimes = withAllRows
            .get(timeColumnSlug)
            .valuesIncludingErrorValues.slice() as Time[]

        groupBoundaries.forEach((_, index) => {
            interpolation(
                newValues,
                newTimes,
                context,
                groupBoundaries[index],
                groupBoundaries[index + 1]
            )
        })

        return {
            values: newValues,
            times: newTimes,
        }
    }

    // TODO generalize `interpolateColumnWithTolerance` and `interpolateColumnLinearly` more
    // There are finicky details in both of them that complicate this
    interpolateColumnWithTolerance(
        columnSlug: ColumnSlug,
        toleranceOverride?: number
    ) {
        // If the column doesn't exist, return the table unchanged.
        if (!this.has(columnSlug)) return this

        const column = this.get(columnSlug)
        const columnDef = column.def as OwidColumnDef
        const tolerance = toleranceOverride ?? column.display.tolerance ?? 0

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
                this.entityNameSlug,
                timeColumnOfTable.slug,
            ]).sortBy([this.entityNameSlug, timeColumnOfTable.slug])

            const interpolationResult = this.interpolate(
                withAllRows,
                columnSlug,
                timeColumnOfValue.slug,
                toleranceInterpolation,
                { timeTolerance: tolerance }
            )

            columnStore = {
                ...withAllRows.columnStore,
                [columnSlug]: interpolationResult.values,
                [originalTimeSlug]: interpolationResult.times,
            }
        } else {
            // If there is no tolerance still append the tolerance column
            columnStore = {
                ...this.columnStore,
                [originalTimeSlug]:
                    timeColumnOfValue.valuesIncludingErrorValues,
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

    interpolateColumnLinearly(columnSlug: ColumnSlug) {
        // If the column doesn't exist, return the table unchanged.
        if (!this.has(columnSlug)) return this

        const column = this.get(columnSlug)
        const columnDef = column?.def as OwidColumnDef

        const maybeTimeColumnSlug =
            getOriginalTimeColumnSlug(this, columnSlug) ??
            timeColumnSlugFromColumnDef(columnDef)
        const timeColumn =
            this.get(maybeTimeColumnSlug) ??
            (this.get(OwidTableSlugs.time) as CoreColumn) // CovidTable does not have a day or year column so we need to use time.

        // todo: we can probably do this once early in the pipeline so we dont have to do it again since complete and sort can be expensive.
        const withAllRows = this.complete([
            this.entityNameSlug,
            timeColumn.slug,
        ]).sortBy([this.entityNameSlug, timeColumn.slug])

        const interpolationResult = this.interpolate(
            withAllRows,
            columnSlug,
            timeColumn.slug,
            linearInterpolation,
            {}
        )

        const columnStore = {
            ...withAllRows.columnStore,
            [columnSlug]: interpolationResult.values,
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

    interpolateColumnsByClosestTimeMatch(
        columnSlugA: ColumnSlug,
        columnSlugB: ColumnSlug
    ): this {
        if (!this.has(columnSlugA) || !this.has(columnSlugB)) return this

        const columnA = this.get(columnSlugA)
        const columnB = this.get(columnSlugB)

        const toleranceA = columnA.display.tolerance ?? 0
        const toleranceB = columnB.display.tolerance ?? 0

        // If the columns are of mismatching time types, then we can't do any time matching.
        // This can happen when we have a ScatterPlot with days in one column, and a column with
        // xOverrideYear.
        // We also don't need to do any time matching when the tolerance of both columns is 0.
        if (
            this.timeColumn.isMissing ||
            this.timeColumn.slug !== columnA.originalTimeColumnSlug ||
            this.timeColumn.slug !== columnB.originalTimeColumnSlug ||
            // Check for a non-zero, non-undefined tolerance
            (toleranceA === 0 && toleranceB === 0)
        ) {
            return this
        }

        const maxDiff = Math.max(toleranceA, toleranceB)

        const withAllRows = this.complete([
            this.entityNameSlug,
            this.timeColumn.slug,
        ]).sortBy([this.entityNameSlug, this.timeColumn.slug])

        // Existing columns
        const valuesA = withAllRows.get(columnA.slug).valuesIncludingErrorValues
        const valuesB = withAllRows.get(columnB.slug).valuesIncludingErrorValues
        const times = withAllRows.timeColumn
            .valuesIncludingErrorValues as Time[]

        // New columns
        const newValuesA = new Array(times.length).fill(
            ErrorValueTypes.NoValueWithinTolerance
        )
        const newValuesB = new Array(times.length).fill(
            ErrorValueTypes.NoValueWithinTolerance
        )
        const newTimesA = new Array(times.length).fill(
            ErrorValueTypes.NoValueWithinTolerance
        )
        const newTimesB = new Array(times.length).fill(
            ErrorValueTypes.NoValueWithinTolerance
        )

        const groupBoundaries = withAllRows.groupBoundaries(this.entityNameSlug)

        pairs(groupBoundaries).forEach(([startIndex, endIndex]) => {
            const availableTimesA = []
            const availableTimesB = []

            for (let index = startIndex; index < endIndex; index++) {
                if (isNotErrorValue(valuesA[index]))
                    availableTimesA.push(times[index])
                if (isNotErrorValue(valuesB[index]))
                    availableTimesB.push(times[index])
            }

            const timePairs = getClosestTimePairs(
                availableTimesA,
                availableTimesB,
                maxDiff
            )
            const timeAtoTimeB = new Map(timePairs)
            const pairedTimesInA = sortNumeric(
                Array.from(timeAtoTimeB.keys())
            ) as Time[]

            for (let index = startIndex; index < endIndex; index++) {
                const currentTime = times[index]

                const candidateTimeA = sortedFindClosest(
                    pairedTimesInA,
                    currentTime
                )

                if (candidateTimeA === undefined) continue

                const candidateIndexA = times.indexOf(
                    candidateTimeA,
                    startIndex
                )

                if (Math.abs(currentTime - candidateTimeA) > toleranceA)
                    continue

                const candidateTimeB = timeAtoTimeB.get(candidateTimeA)

                if (
                    candidateTimeB === undefined ||
                    Math.abs(currentTime - candidateTimeB) > toleranceB
                ) {
                    continue
                }

                const candidateIndexB = times.indexOf(
                    candidateTimeB,
                    startIndex
                )

                newValuesA[index] = valuesA[candidateIndexA]
                newValuesB[index] = valuesB[candidateIndexB]
                newTimesA[index] = times[candidateIndexA]
                newTimesB[index] = times[candidateIndexB]
            }
        })

        const originalTimeColumnASlug = makeOriginalTimeSlugFromColumnSlug(
            columnA.slug
        )
        const originalTimeColumnBSlug = makeOriginalTimeSlugFromColumnSlug(
            columnB.slug
        )

        const columnStore = {
            ...withAllRows.columnStore,
            [columnA.slug]: newValuesA,
            [columnB.slug]: newValuesB,
            [originalTimeColumnASlug]: newTimesA,
            [originalTimeColumnBSlug]: newTimesB,
        }

        return withAllRows.transform(
            columnStore,
            [
                ...withAllRows.defs,
                {
                    ...withAllRows.timeColumn.def,
                    slug: originalTimeColumnASlug,
                },
                {
                    ...withAllRows.timeColumn.def,
                    slug: originalTimeColumnBSlug,
                },
            ],
            `Interpolated values`,
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
        const timeValues = timeColumn.valuesIncludingErrorValues
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

    get isBlank() {
        return (
            this.tableDescription.startsWith(BLANK_TABLE_MESSAGE) &&
            !this.numRows
        )
    }
}

const BLANK_TABLE_MESSAGE = `Table is empty.`

// This just assures that even an emtpty OwidTable will have an entityName column. Probably a cleaner way to do this pattern (add a defaultColumns prop??)
export const BlankOwidTable = (
    tableSlug = `blankOwidTable`,
    extraTableDescription = ""
) =>
    new OwidTable(
        undefined,
        [
            { slug: OwidTableSlugs.entityName },
            { slug: OwidTableSlugs.year, type: ColumnTypeMap.Year },
        ],
        {
            tableDescription: BLANK_TABLE_MESSAGE + extraTableDescription,
            tableSlug,
        }
    )
