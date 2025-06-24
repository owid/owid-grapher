import * as _ from "lodash-es"
import {
    intersectionOfSets,
    findClosestTimeIndex,
    sortNumeric,
    getClosestTimePairs,
    sortedFindClosest,
    cagr,
    makeAnnotationsSlug,
    isPresent,
    TimeBound,
    ColumnSlug,
    imemo,
    ToleranceStrategy,
    differenceOfSets,
    sortedFindClosestIndex,
} from "@ourworldindata/utils"
import {
    Time,
    TransformType,
    CoreColumnStore,
    Color,
    CoreValueType,
    ColumnTypeNames,
    EntityName,
    OwidColumnDef,
    OwidRow,
    OwidTableSlugs,
    ErrorValue,
} from "@ourworldindata/types"
import { CoreTable } from "./CoreTable.js"
import { ErrorValueTypes, isNotErrorValue } from "./ErrorValues.js"
import {
    getOriginalTimeColumnSlug,
    makeOriginalValueSlugFromColumnSlug,
    makeOriginalTimeSlugFromColumnSlug,
    timeColumnSlugFromColumnDef,
    toPercentageColumnDef,
} from "./OwidTableUtil.js"
import {
    linearInterpolation,
    toleranceInterpolation,
    replaceDef,
    InterpolationProvider,
    InterpolationContext,
} from "./CoreTableUtils.js"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns.js"

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends CoreTable<OwidRow, OwidColumnDef> {
    @imemo get availableEntityNames(): any[] {
        return Array.from(this.availableEntityNameSet)
    }

    @imemo get availableEntityNameSet(): Set<string> {
        return this.entityNameColumn.uniqValuesAsSet
    }

    @imemo get entityNameColumn(): CoreColumn {
        return (
            this.getFirstColumnWithType(ColumnTypeNames.EntityName) ??
            this.get(OwidTableSlugs.entityName)
        )
    }

    @imemo get minTime(): Time {
        return _.min(this.allTimes) as Time
    }

    @imemo get maxTime(): number | undefined {
        return _.max(this.allTimes)
    }

    @imemo private get allTimes(): Time[] {
        return this.get(this.timeColumn.slug).values
    }

    @imemo get rowIndicesByEntityName(): Map<string, number[]> {
        return this.rowIndex([this.entityNameSlug])
    }

    getAnnotationColumnSlug(columnDef: OwidColumnDef): string | undefined {
        return _.isEmpty(columnDef?.annotationsColumnSlug)
            ? makeAnnotationsSlug(columnDef.slug)
            : columnDef.annotationsColumnSlug
    }

    // todo: instead of this we should probably make annotations another property on charts—something like "annotationsColumnSlugs"
    getAnnotationColumnForColumn(columnSlug: ColumnSlug): CoreColumn {
        const def = this.get(columnSlug).def as OwidColumnDef
        const slug = this.getAnnotationColumnSlug(def)
        return this.get(slug)
    }

    getTimesUniqSortedAscForColumns(columnSlugs: ColumnSlug[]): number[] {
        // todo: should be easy to speed up if necessary.
        return sortNumeric(
            _.uniq(
                this.getColumns(columnSlugs)
                    .filter((col) => col)
                    .flatMap((col) => col.uniqTimesAsc)
            )
        )
    }

    timeDomainFor(slugs: ColumnSlug[]): [Time | undefined, Time | undefined] {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => col.minTime)
        const maxes = cols.map((col) => col.maxTime)
        return [_.min(mins), _.max(maxes)]
    }

    originalTimeDomainFor(
        slugs: ColumnSlug[]
    ): [Time | undefined, Time | undefined] {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => _.min(col.originalTimes))
        const maxes = cols.map((col) => _.max(col.originalTimes))
        return [_.min(mins), _.max(maxes)]
    }

    filterByEntityNames(names: EntityName[]): this {
        const namesSet = new Set(names)
        return this.columnFilter(
            this.entityNameSlug,
            (value) => namesSet.has(value as string),
            `Filter out all entities except '${names}'`
        )
    }

    filterByEntityNamesUsingIncludeExcludePattern({
        excluded,
        included,
    }: {
        excluded?: EntityName[]
        included?: EntityName[]
    }): this {
        if (!included && !excluded) return this

        const excludedSet = new Set(excluded)
        const includedSet = new Set(included)

        const excludeFilter = (entityName: EntityName): boolean =>
            !excludedSet.has(entityName)
        const includeFilter =
            includedSet.size > 0
                ? (entityName: EntityName): boolean =>
                      includedSet.has(entityName)
                : (): boolean => true

        const filterFn = (entityName: any): boolean =>
            excludeFilter(entityName) && includeFilter(entityName)

        const excludedList = excluded ? excluded.join(", ") : ""
        const includedList = included ? included.join(", ") : ""

        return this.columnFilter(
            this.entityNameSlug,
            filterFn,
            `Excluded entities specified by author: ${excludedList} - Included entities specified by author: ${includedList}`
        )
    }

    // Does a stable sort by time. You can refer to this table for fast time filtering.
    @imemo private get sortedByTime(): this {
        if (this.timeColumn.isMissing) return this
        return this.sortBy([this.timeColumn.slug])
    }

    filterByTimeRange(start: TimeBound, end: TimeBound): this {
        if (this.isBlank) return this

        // We may want to do this time adjustment in Grapher instead of here.
        const adjustedStart = start === Infinity ? this.maxTime! : start
        const adjustedEnd = end === -Infinity ? this.minTime! : end
        // todo: we should set a time column onload so we don't have to worry about it again.
        const timeColumnSlug = this.timeColumn?.slug || OwidTableSlugs.time

        const description = `Keep only rows with Time between ${adjustedStart} - ${adjustedEnd}`

        // perf: if the time range is greater than the table's time range, we can skip the filter
        if (adjustedStart <= this.minTime && adjustedEnd >= this.maxTime!)
            return this.noopTransform(description).sortedByTime

        return this.columnFilter(
            timeColumnSlug,
            (time) =>
                (time as number) >= adjustedStart &&
                (time as number) <= adjustedEnd,
            description

            // Sorting by time, because incidentally some parts of the code depended on this method
            // returning sorted rows.
        ).sortedByTime
    }

    filterByTargetTimes(targetTimes: Time[], tolerance = 0): this {
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

    hasAnyColumnNoValidValue(slugs: ColumnSlug[]): boolean {
        return slugs.some((slug) => this.get(slug).numValues === 0)
    }

    dropAllRows(): this {
        return this.dropRowsAt(this.indices, "Drop all rows")
    }

    dropRowsWithErrorValuesForColumn(slug: ColumnSlug): this {
        return this.columnFilter(
            slug,
            (value) => isNotErrorValue(value),
            `Drop rows with empty or ErrorValues in ${slug} column`
        )
    }

    // TODO rewrite with column ops
    // TODO move to CoreTable
    dropRowsWithErrorValuesForAnyColumn(slugs: ColumnSlug[]): this {
        return this.rowFilter(
            (row) => slugs.every((slug) => isNotErrorValue(row[slug])),
            `Drop rows with empty or ErrorValues in any column: ${slugs.join(
                ", "
            )}`
        )
    }

    // TODO rewrite with column ops
    // TODO move to CoreTable
    dropRowsWithErrorValuesForAllColumns(slugs: ColumnSlug[]): this {
        return this.rowFilter(
            (row) => slugs.some((slug) => isNotErrorValue(row[slug])),
            `Drop rows with empty or ErrorValues in every column: ${slugs.join(
                ", "
            )}`
        )
    }

    // Drop _all rows_ for an entity if there is any column that has no valid values for that entity.
    dropEntitiesThatHaveNoDataInSomeColumn(columnSlugs: ColumnSlug[]): this {
        const indexesByEntityName = this.rowIndicesByEntityName

        // Iterate over all entities, and remove them as we go if they have no data in some column
        const entityNamesToKeep = new Set(indexesByEntityName.keys())

        for (const slug of columnSlugs) {
            const col = this.get(slug)

            // Optimization, if there are no error values in this column, we can skip this column
            if (col.numErrorValues === 0) continue

            for (const entityName of entityNamesToKeep) {
                const indicesForEntityName = indexesByEntityName.get(entityName)
                if (!indicesForEntityName)
                    throw new Error("Unexpected: entity not found in index map")

                // Optimization: We don't care about the number of valid/error values, we just need
                // to know if there is at least one valid value
                const hasSomeValidValueForEntityInCol =
                    indicesForEntityName.some((index) =>
                        isNotErrorValue(col.valuesIncludingErrorValues[index])
                    )

                // Optimization: If we find a column that this entity has no data in we can remove
                // it immediately, no need to iterate over other columns also
                if (!hasSomeValidValueForEntityInCol)
                    entityNamesToKeep.delete(entityName)
            }
        }

        const entityNamesToDrop = differenceOfSets([
            this.availableEntityNameSet,
            entityNamesToKeep,
        ])
        const droppedEntitiesStr =
            entityNamesToDrop.size > 0
                ? [...entityNamesToDrop].join(", ")
                : "(None)"

        if (entityNamesToDrop.size === 0) {
            return this.noopTransform(
                `Drop entities that have no data in some column`
            )
        }

        return this.columnFilter(
            this.entityNameSlug,
            (rowEntityName) => entityNamesToKeep.has(rowEntityName as string),
            `Drop ${entityNamesToDrop.size} entities that have no data in some column: ${columnSlugs.join(", ")}.\nDropped entities: ${droppedEntitiesStr}`
        )
    }

    // Drop _all rows_ for an entity if all columns have at least one invalid or missing value for that entity.
    dropEntitiesThatHaveSomeMissingOrErrorValueInAllColumns(
        columnSlugs: ColumnSlug[]
    ): this {
        const indexesByEntityName = this.rowIndicesByEntityName
        const uniqTimes = new Set(this.allTimes)

        // entity names to iterate over
        const entityNamesToIterateOver = new Set(indexesByEntityName.keys())

        // set of entities we want to keep
        const entityNamesToKeep = new Set<string>()

        // total number of entities
        const entityCount = entityNamesToIterateOver.size

        // helper function to generate operation name
        const makeOpName = (entityNamesToKeep: Set<EntityName>): string => {
            const entityNamesToDrop = differenceOfSets([
                this.availableEntityNameSet,
                entityNamesToKeep,
            ])
            const droppedEntitiesStr =
                entityNamesToDrop.size > 0
                    ? [...entityNamesToDrop].join(", ")
                    : "(None)"
            return `Drop entities that have some missing or error value in all column: ${columnSlugs.join(", ")}.\nDropped entities: ${droppedEntitiesStr}`
        }

        // Optimization: if there is a column that has a valid data entry for
        // every entity and every time, we are done
        for (const slug of columnSlugs) {
            const col = this.get(slug)

            if (
                col.numValues === entityCount * uniqTimes.size &&
                col.numErrorValues === 0
            ) {
                const entityNamesToKeep = new Set(indexesByEntityName.keys())

                return this.columnFilter(
                    this.entityNameSlug,
                    (rowEntityName) =>
                        entityNamesToKeep.has(rowEntityName as string),
                    makeOpName(entityNamesToKeep)
                )
            }
        }

        for (const slug of columnSlugs) {
            const col = this.get(slug)

            for (const entityName of entityNamesToIterateOver) {
                const indicesForEntityName = indexesByEntityName.get(entityName)
                if (!indicesForEntityName)
                    throw new Error("Unexpected: entity not found in index map")

                // Optimization: If the column is missing values for the entity,
                // we know we can't make a decision yet, so we skip this entity
                if (indicesForEntityName.length < uniqTimes.size) continue

                // Optimization: We don't care about the number of valid/error
                // values, we just need to know if there is at least one invalid value
                const hasSomeInvalidValueForEntityInCol =
                    indicesForEntityName.some(
                        (index) =>
                            !isNotErrorValue(
                                col.valuesIncludingErrorValues[index]
                            )
                    )

                // Optimization: If all values are valid, we know we want to keep this entity,
                // so we remove it from the entities to iterate over
                if (!hasSomeInvalidValueForEntityInCol) {
                    entityNamesToKeep.add(entityName)
                    entityNamesToIterateOver.delete(entityName)
                }
            }
        }

        return this.columnFilter(
            this.entityNameSlug,
            (rowEntityName) => entityNamesToKeep.has(rowEntityName as string),
            makeOpName(entityNamesToKeep)
        )
    }

    private sumsByTime(columnSlug: ColumnSlug): Map<number, number> {
        const timeValues = this.timeColumn.values
        const values = this.get(columnSlug).values as number[]
        if (timeValues.length !== values.length)
            // Throwing here may seem drastic but this will lead to an error in any case if the lengths are different
            // (can happen when dropping rows with errors is done incorrectly).
            // When it happens then throwing here is an easier to diagnose error
            throw Error(
                `Tried to run sumsByTime when timeValues (${timeValues.length}) and values (${values.length}) had different length`
            )
        const map = new Map<number, number>()
        timeValues.forEach((time, index) =>
            map.set(time, (map.get(time) ?? 0) + values[index])
        )
        return map
    }

    // todo: this needs tests (and/or drop in favor of someone else's package)
    // Shows how much each entity contributed to the given column for each time period
    toPercentageFromEachEntityForEachTime(columnSlug: ColumnSlug): this {
        if (!this.has(columnSlug)) return this
        const timeColumn = this.timeColumn!
        const col = this.get(columnSlug)
        const timeTotals = this.sumsByTime(columnSlug)
        const timeValues = timeColumn.values
        const newDefs = replaceDef(this.defs, [
            toPercentageColumnDef(col.def, ColumnTypeNames.RelativePercentage),
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
    toPercentageFromEachColumnForEachEntityAndTime(
        columnSlugs: ColumnSlug[]
    ): this {
        columnSlugs = columnSlugs.filter((slug) => this.has(slug))
        if (!columnSlugs.length) return this

        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return toPercentageColumnDef(
                    def,
                    ColumnTypeNames.RelativePercentage
                )
            return def
        })

        const columnStore = this.columnStore
        const columnStorePatch: CoreColumnStore = {}

        const totals = new Array(this.numRows).fill(0).map((__, i) =>
            _.sumBy(columnSlugs, (slug) => {
                const value = columnStore[slug][i]
                return _.isNumber(value) ? Math.abs(value) : 0
            })
        )

        columnSlugs.forEach((slug) => {
            columnStorePatch[slug] = columnStore[slug].map((value, i) => {
                const total = totals[i]
                if (!_.isNumber(value) || !_.isNumber(total)) return value
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
    ): this {
        if (this.timeColumn.isMissing) return this
        const timeColumnSlug = this.timeColumn.slug
        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return toPercentageColumnDef(
                    def,
                    ColumnTypeNames.PercentChangeOverTime
                )
            return def
        })
        const newRows = Object.values(
            _.groupBy(this.sortedByTime.rows, (row) => row[this.entityNameSlug])
        ).flatMap((rowsForSingleEntity) => {
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
                        } else if (!_.isNumber(value)) {
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

        return this.transform(
            newRows,
            newDefs,
            `Transformed columns from absolute values to % of time ${startTimeBound} for columns ${columnSlugs.join(
                ","
            )} `,
            TransformType.UpdateColumnDefs
        )
    }

    keepMinTimeAndMaxTimeForEachEntityOnly(): this {
        const indexMap = this.rowIndicesByEntityName
        const timeColumn = this.timeColumn
        if (timeColumn.isMissing) return this
        const timeValues = timeColumn.valuesIncludingErrorValues
        const matchingIndices = new Set<number>()
        indexMap.forEach((indices) =>
            [_.minBy, _.maxBy]
                .map((f) => f(indices, (index) => timeValues[index]))
                .filter(isPresent)
                .forEach((index) => matchingIndices.add(index))
        )
        return this.columnFilter(
            timeColumn.slug,
            (row, index) => matchingIndices.has(index),
            `Keep minTime & maxTime rows only for each entity`
        )
    }

    private getAverageAnnualChangeIndicesByEntity(
        columnSlugs: ColumnSlug[]
    ): Map<EntityName, [number, number]> {
        const columns = columnSlugs.map((slug) => this.get(slug))
        const indexMap = this.rowIndicesByEntityName
        const timeValues = this.timeColumn.valuesIncludingErrorValues

        // Find indices of min & max rows
        const entityNameToIndices = new Map<EntityName, [number, number]>()
        indexMap.forEach((indices, entityName) => {
            // We are discarding every row which contains a 0 for any columnSlug.
            // Technically, to be more correct, we should support distinct min/max indices for each
            // columnSlug, but that only makes a tiny difference in a tiny subset of charts.
            const nonZeroValueIndices = indices.filter((index) =>
                columns.every((col) => {
                    const value = col.valuesIncludingErrorValues[index]
                    return _.isNumber(value) && value !== 0
                })
            )
            const minIndex = _.minBy(
                nonZeroValueIndices,
                (index) => timeValues[index]
            )
            const maxIndex = _.maxBy(indices, (index) => timeValues[index])
            if (minIndex === undefined || maxIndex === undefined) return

            const allValuePairsHaveDistinctTime = columns.every((col) => {
                const originalTimes =
                    this.columnStore[col.originalTimeColumnSlug]
                return originalTimes[minIndex] !== originalTimes[maxIndex]
            })
            if (allValuePairsHaveDistinctTime)
                entityNameToIndices.set(entityName, [minIndex, maxIndex])
        })

        return entityNameToIndices
    }

    toAverageAnnualChangeForEachEntity(columnSlugs: ColumnSlug[]): this {
        columnSlugs = columnSlugs.filter((slug) => this.has(slug))
        if (
            this.timeColumn.isMissing ||
            !(this.timeColumn instanceof ColumnTypeMap.Year) ||
            columnSlugs.length === 0
        )
            return this

        const columns = columnSlugs.map((slug) => this.get(slug))
        const entityNameToIndices =
            this.getAverageAnnualChangeIndicesByEntity(columnSlugs)

        // Overwrite table rows
        const rows: OwidRow[] = []
        entityNameToIndices.forEach((indices) => {
            const [startRow, endRow] = this.rowsAt(indices)
            const newRow: OwidRow = {
                ...endRow,
            }
            columns.forEach((col) => {
                const timeSlug = col.originalTimeColumnSlug
                const yearsElapsed = endRow[timeSlug] - startRow[timeSlug]
                newRow[col.slug] = cagr(
                    startRow[col.slug],
                    endRow[col.slug],
                    yearsElapsed
                )
            })
            rows.push(newRow)
        })

        const newDefs = replaceDef(
            this.defs,
            columns.map((col) =>
                toPercentageColumnDef(
                    col.def,
                    ColumnTypeNames.PercentChangeOverTime
                )
            )
        )

        return this.transform(
            rows,
            newDefs,
            `Average annual change for columns: ${columnSlugs.join(", ")}`,
            TransformType.UpdateRows
        )
    }

    // Give our users a clean CSV of each Grapher. Assumes an Owid Table with entityName.
    toPrettyCsv(
        useShortNames: boolean = false,
        activeColumnSlugs: string[] | undefined = undefined
    ): string {
        let table
        if (activeColumnSlugs?.length) {
            const timeColumnToInclude = [
                OwidTableSlugs.year,
                OwidTableSlugs.day,
                this.timeColumn.slug, // needed for explorers, where the time column may be called anything
            ].find((colSlug) => this.has(colSlug))

            if (!timeColumnToInclude)
                throw new Error(
                    "Expected to find a time column to include in the CSV"
                )

            table = this.select([
                timeColumnToInclude,
                this.entityNameSlug,
                ...activeColumnSlugs,
            ])
        } else {
            table = this.dropColumns([
                OwidTableSlugs.entityId,
                OwidTableSlugs.time,
                OwidTableSlugs.entityColor,
            ])
        }
        return table
            .sortBy([this.entityNameSlug])
            .toCsvWithColumnNames(useShortNames)
    }

    @imemo get entityNameColorIndex(): Map<EntityName, Color> {
        return this.valueIndex(
            this.entityNameSlug,
            OwidTableSlugs.entityColor
        ) as Map<EntityName, Color>
    }

    getColorForEntityName(entityName: EntityName): Color | undefined {
        return this.entityNameColorIndex.get(entityName)
    }

    @imemo get columnDisplayNameToColorMap(): Map<string, Color> {
        return new Map(
            this.columnsAsArray
                .filter((col) => col.def.color)
                .map((col) => [col.displayName, col.def.color!])
        )
    }

    // This assumes the table is sorted where the times for entity names go in asc order.
    // The whole table does not have to be sorted by time.
    getLatestValueForEntity(
        entityName: EntityName,
        columnSlug: ColumnSlug
    ): CoreValueType | undefined {
        const indices = this.rowIndicesByEntityName.get(entityName)
        if (!indices) return undefined
        const values = this.get(columnSlug).valuesIncludingErrorValues
        const descending = indices.toReversed()
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
    private interpolate<K extends InterpolationContext>(
        withAllRows: this,
        columnSlug: ColumnSlug,
        timeColumnSlug: ColumnSlug,
        interpolation: InterpolationProvider<K>,
        context: K
    ): { values: number[]; times: number[] } {
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
        toleranceOverride?: number,
        toleranceStrategyOverride?: ToleranceStrategy
    ): this {
        // If the column doesn't exist, return the table unchanged.
        if (!this.has(columnSlug)) return this

        const column = this.get(columnSlug)
        const columnDef = column.def as OwidColumnDef
        const tolerance = toleranceOverride ?? column.tolerance ?? 0
        const toleranceStrategy =
            toleranceStrategyOverride ??
            column.toleranceStrategy ??
            ToleranceStrategy.closest

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

            const interpolateInBothDirections =
                !toleranceStrategy ||
                toleranceStrategy === ToleranceStrategy.closest
            const interpolateBackwards =
                interpolateInBothDirections ||
                toleranceStrategy === ToleranceStrategy.backwards
            const interpolateForwards =
                interpolateInBothDirections ||
                toleranceStrategy === ToleranceStrategy.forwards

            const interpolationResult = this.interpolate(
                withAllRows,
                columnSlug,
                timeColumnOfValue.slug,
                toleranceInterpolation,
                {
                    timeToleranceBackwards: interpolateBackwards
                        ? tolerance
                        : 0,
                    timeToleranceForwards: interpolateForwards ? tolerance : 0,
                }
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
                    display: {
                        includeInTable: false,
                    },
                },
            ],
            `Interpolated values in column ${columnSlug} with tolerance ${tolerance} and appended column ${originalTimeSlug} with the original times`,
            TransformType.UpdateColumnDefs
        )
    }

    interpolateColumnLinearly(
        columnSlug: ColumnSlug,
        extrapolate: boolean = false
    ): this {
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

        const originalColumnSlug =
            makeOriginalValueSlugFromColumnSlug(columnSlug)
        const originalColumnDef = {
            ...columnDef,
            slug: originalColumnSlug,
            display: { includeInTable: false },
        }

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
            { extrapolateAtStart: extrapolate, extrapolateAtEnd: extrapolate }
        )

        const columnStore = {
            ...withAllRows.columnStore,
            [originalColumnSlug]: withAllRows.columnStore[columnSlug],
            [columnSlug]: interpolationResult.values,
        }

        return this.transform(
            columnStore,
            [
                ...this.defs,
                originalColumnDef,
                {
                    ...timeColumn.def,
                },
            ],
            `Interpolated values in column ${columnSlug} linearly and appended column ${originalColumnSlug} with the original values`,
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

        const toleranceA = columnA.tolerance ?? 0
        const toleranceB = columnB.tolerance ?? 0

        // If the columns are of mismatching time types, then we can't do any time matching.
        // This can happen when we have a ScatterPlot with days in one column, and a column with
        // xOverrideYear.
        // We also don't need to do any time matching when the tolerance of both columns is 0.
        if (
            this.timeColumn.isMissing ||
            this.timeColumn.slug !== columnA.originalTimeColumnSlug ||
            this.timeColumn.slug !== columnB.originalTimeColumnSlug ||
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

        for (let i = 1; i < groupBoundaries.length; i++) {
            const startIndex = groupBoundaries[i - 1]
            const endIndex = groupBoundaries[i]
            const numRows = endIndex - startIndex

            const availableTimesA = []
            const availableTimesB = []

            for (let index = startIndex; index < endIndex; index++) {
                if (isNotErrorValue(valuesA[index]))
                    availableTimesA.push(times[index])
                if (isNotErrorValue(valuesB[index]))
                    availableTimesB.push(times[index])
            }

            if (availableTimesA.length === 0 || availableTimesB.length === 0) {
                // If one of the columns has no values, we can't do any interpolation
                continue
            }
            if (
                availableTimesA.length === numRows &&
                availableTimesB.length === numRows
            ) {
                // If all values are available, we can skip the interpolation and just copy all values
                for (let index = startIndex; index < endIndex; index++) {
                    newValuesA[index] = valuesA[index]
                    newValuesB[index] = valuesB[index]
                    newTimesA[index] = times[index]
                    newTimesB[index] = times[index]
                }
                continue
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

                if (Math.abs(currentTime - candidateTimeA) > toleranceA)
                    continue

                const candidateTimeB = timeAtoTimeB.get(candidateTimeA)

                if (
                    candidateTimeB === undefined ||
                    Math.abs(currentTime - candidateTimeB) > toleranceB
                ) {
                    continue
                }

                const candidateIndexA = sortedFindClosestIndex(
                    times,
                    candidateTimeA,
                    startIndex,
                    endIndex
                )

                const candidateIndexB = sortedFindClosestIndex(
                    times,
                    candidateTimeB,
                    startIndex,
                    endIndex
                )

                newValuesA[index] = valuesA[candidateIndexA]
                newValuesB[index] = valuesB[candidateIndexB]
                newTimesA[index] = times[candidateIndexA]
                newTimesB[index] = times[candidateIndexB]
            }
        }

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

    sampleEntityName(howMany = 1): any[] {
        return this.availableEntityNames.slice(0, howMany)
    }

    get isBlank(): boolean {
        return !this.numRows
    }
}

const BLANK_TABLE_MESSAGE = `Table is empty.`

// This just assures that even an emtpty OwidTable will have an entityName column. Probably a cleaner way to do this pattern (add a defaultColumns prop??)
export const BlankOwidTable = (
    tableSlug = `blankOwidTable`,
    extraTableDescription = ""
): OwidTable =>
    new OwidTable(
        undefined,
        [
            { slug: OwidTableSlugs.entityName },
            { slug: OwidTableSlugs.year, type: ColumnTypeNames.Year },
        ],
        {
            tableDescription: BLANK_TABLE_MESSAGE + extraTableDescription,
            tableSlug,
        }
    )
