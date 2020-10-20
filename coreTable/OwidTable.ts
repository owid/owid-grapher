import {
    LegacyVariablesAndEntityKey,
    OwidSourceProperty,
} from "./LegacyVariableCode"
import {
    max,
    min,
    parseDelimited,
    intersectionOfSets,
    findClosestTimeIndex,
    sum,
    flatten,
    uniq,
    sortNumeric,
    isPresent,
    sortBy,
    sortedIndexBy,
    last,
    intersection,
    keyBy,
    groupBy,
    fillUndefinedWithClosest,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import {
    ColumnTypeNames,
    ColumnSlug,
    Integer,
    Time,
    TransformType,
    PrimitiveType,
} from "coreTable/CoreTableConstants"
import { CoreTable } from "./CoreTable"
import { populationMap } from "./PopulationMap"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import {
    EntityCode,
    EntityId,
    EntityName,
    OwidColumnDef,
    OwidRow,
    OwidTableSlugs,
    RequiredColumnDefs,
} from "./OwidTableConstants"
import { legacyToOwidTable, makeAnnotationsSlug } from "./LegacyToOwidTable"
import { InvalidCell, InvalidCellTypes, isValid } from "./InvalidCells"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
} from "./CoreTablePrinters"
import { TimeBound } from "grapher/utils/TimeBounds"
import {
    makeOriginalTimeSlugFromColumnSlug,
    timeColumnSlugFromColumnDef,
} from "./OwidTableUtil"

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends CoreTable<OwidRow, OwidColumnDef> {
    static fromDelimited(csvOrTsv: string, defs: OwidColumnDef[] = []) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []

        const missingColumns = RequiredColumnDefs.filter(
            (def) => !colSlugs.includes(def.slug)
        )

        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns
                    .map((col) => col.slug)
                    .join(",")}'`
            )

        const rows = (parsed as any) as OwidRow[]
        return new OwidTable(rows, [...RequiredColumnDefs, ...defs])
    }

    @computed get entityType() {
        return "Country"
    }

    @computed get availableEntityNames() {
        return Array.from(this.availableEntityNameSet)
    }

    @computed get numAvailableEntityNames() {
        return this.availableEntityNames.length
    }

    @computed get availableEntityNameSet() {
        return new Set(this.rows.map((row) => row.entityName))
    }

    // todo: can we remove at some point?
    @computed get entityIdToNameMap() {
        return this.makeIndex(
            OwidTableSlugs.entityId,
            OwidTableSlugs.entityName
        ) as Map<number, string>
    }

    // todo: can we remove at some point?
    @computed private get entityCodeToNameMap() {
        return this.makeIndex(
            OwidTableSlugs.entityCode,
            OwidTableSlugs.entityName
        ) as Map<string, string>
    }

    makeIndex(indexColumnSlug: ColumnSlug, valueColumnSlug: ColumnSlug) {
        const indexCol = this.get(indexColumnSlug)
        const valueCol = this.get(valueColumnSlug)

        if (!indexCol || !valueCol) return new Map()

        const indexValues = indexCol.allValues
        const valueValues = valueCol.allValues
        const indices = intersection(
            indexCol.validRowIndices,
            valueCol.validRowIndices
        )
        const map = new Map<PrimitiveType, PrimitiveType>()
        indices.forEach((index) => {
            map.set(indexValues[index], valueValues[index])
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityNameToIdMap() {
        return this.makeIndex(
            OwidTableSlugs.entityName,
            OwidTableSlugs.entityId
        ) as Map<string, number>
    }

    // todo: can we remove at some point?
    @computed get entityNameToCodeMap() {
        return this.makeIndex(
            OwidTableSlugs.entityName,
            OwidTableSlugs.entityCode
        ) as Map<string, string>
    }

    @computed get entityIndex() {
        const map = new Map<EntityName, OwidRow[]>()
        this.rows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    @computed get maxTime() {
        return last(this.allTimes)
    }

    @computed get minTime() {
        return this.allTimes[0]
    }

    @computed private get allTimes(): Time[] {
        return this.sortedByTime.get(this.timeColumn?.slug)?.parsedValues ?? []
    }

    @computed get hasDayColumn() {
        return this.has(OwidTableSlugs.day)
    }

    @computed get dayColumn() {
        return this.get(OwidTableSlugs.day)
    }

    @computed get rowsByEntityName() {
        return this.rowsBy<EntityName>(OwidTableSlugs.entityName)
    }

    @computed get rowsByTime() {
        return this.rowsBy<Time>(this.timeColumn!.slug)
    }

    // todo: instead of this we should probably make annotations another property on charts—something like "annotationsColumnSlugs"
    getAnnotationColumnForColumn(columnSlug: ColumnSlug) {
        const def = this.get(columnSlug)?.def as OwidColumnDef
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

    copySelectionFrom(table: OwidTable) {
        return this.setSelectedEntities(table.selectedEntityNames)
    }

    timeDomainFor(slugs: ColumnSlug[]): [Time | undefined, Time | undefined] {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => col.minTime)
        const maxes = cols.map((col) => col.maxTime)
        return [min(mins), max(maxes)]
    }

    filterByEntityName(name: EntityName) {
        // todo; why not a filter by?
        return new OwidTable(this.rowsByEntityName.get(name) || [], this.defs, {
            parent: this,
            tableDescription: `Filter out all entities except '${name}'`,
            transformCategory: TransformType.FilterRows,
        })
    }

    // Does a stable sort by time. Mobx will cache this, and then you can refer to this table for
    // fast time filtering.
    @computed private get sortedByTime() {
        const timeColumnSlug = this.timeColumn!.slug!
        return this.transform(
            sortBy(this.rows, (row) => row[timeColumnSlug]),
            this.defs,
            `Sort rows by time before filtering for speed`,
            TransformType.SortRows
        )
    }

    filterByTime(start: TimeBound, end: TimeBound): this {
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

    filterByPopulation(minPop: number) {
        return this.filter((row) => {
            const name = row.entityName
            const pop = populationMap[name]
            return !pop || this.isSelected(row) || pop >= minPop
        }, `Filter out countries with population less than ${minPop}`)
    }

    filterByTargetTime(targetTime: Time, tolerance: Integer = 0) {
        const timeSlug = this.timeColumn!.slug
        const entityNameToRows = this.rowsByEntityName
        const matchingRows = new Set<OwidRow>()
        this.availableEntityNames.forEach((entityName) => {
            const rows = entityNameToRows.get(entityName) || []

            const rowIndex = findClosestTimeIndex(
                rows.map((row) => row[timeSlug]) as number[],
                targetTime,
                tolerance
            )
            if (rowIndex !== undefined) matchingRows.add(rows[rowIndex])
        })

        return this.filter(
            (row) => matchingRows.has(row),
            `Keep one row per entity closest to time ${targetTime} with tolerance ${tolerance}`
        )
    }

    // todo: this needs tests (and/or drop in favor of someone else's package)
    // Shows how much each entity contributed to the given column for each time period
    toPercentageFromEachEntityForEachTime(columnSlug: ColumnSlug) {
        const newDefs = this.defs.map((def) => {
            if (columnSlug === def.slug)
                return { ...def, type: ColumnTypeNames.Percentage }
            return def
        })
        const rowsForYear = this.rowsByTime
        const timeColumnSlug = this.timeColumn!.slug
        return new OwidTable(
            this.rows.map((row) => {
                const newRow = {
                    ...row,
                }
                const total = sum(
                    rowsForYear
                        .get(row[timeColumnSlug])!
                        .map((row) => row[columnSlug])
                )
                newRow[columnSlug] = (100 * row[columnSlug]) / total
                return newRow
            }),
            newDefs,
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
        startTime: Time,
        columnSlugs: ColumnSlug[]
    ) {
        const newDefs = this.defs.map((def) => {
            if (columnSlugs.includes(def.slug))
                return { ...def, type: ColumnTypeNames.PercentChangeOverTime }
            return def
        })
        return new OwidTable(
            this.rows.map((row) => {
                const newRow = {
                    ...row,
                }
                columnSlugs.forEach((slug) => {
                    const comparisonValue = this.get(slug)!
                        .valueByEntityNameAndTime.get(row.entityName)
                        ?.get(startTime)
                    newRow[slug] =
                        typeof comparisonValue === "number"
                            ? -100 + (100 * row[slug]) / comparisonValue
                            : undefined
                })
                return newRow
            }),
            newDefs,
            {
                parent: this,
                tableDescription: `Transformed columns from absolute values to % of time ${startTime} for columns ${columnSlugs.join(
                    ","
                )} `,
                transformCategory: TransformType.UpdateColumnDefs,
            }
        )
    }

    // Give our users a clean CSV of each Grapher. Assumes an Owid Table with entityName.
    toPrettyCsv() {
        return this.withoutConstantColumns()
            .withoutColumns([
                OwidTableSlugs.entityId,
                OwidTableSlugs.time,
                OwidTableSlugs.entityColor,
            ])
            .sortBy([OwidTableSlugs.entityName])
            .toCsvWithColumnNames()
    }

    // one datum per entityName. use the closest value to target year within tolerance.
    // selected rows only. value from any primary column.
    // getClosestRowForEachSelectedEntity(targetYear, tolerance)
    // Make sure we use the closest value to the target year within tolerance (preferring later)
    getClosestRowForEachSelectedEntity(targetTime: Time, tolerance: Integer) {
        const rowMap = this.rowsByEntityName
        const timeSlug = this.timeColumn?.slug
        if (!timeSlug) return []
        return this.selectedEntityNames
            .map((name) => {
                const rows = rowMap.get(name)
                if (!rows) return null

                const rowIndex = findClosestTimeIndex(
                    rows.map((row) => row[timeSlug]) as number[],
                    targetTime,
                    tolerance
                )
                return rowIndex ? rows[rowIndex] : null
            })
            .filter(isPresent)
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]) {
        const set = new Set(entityNames)
        this.clearSelection()
        return this.selectRows(
            this.rows.filter((row) => set.has(row.entityName))
        )
    }

    @action.bound addToSelection(entityNames: EntityName[]) {
        const set = new Set(entityNames)
        return this.selectRows(
            this.rows.filter((row) => set.has(row.entityName))
        )
    }

    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        return this.setSelectedEntities(
            codesInData.map((code) => map.get(code)!)
        )
    }

    getEntityNamesFromCodes(input: (EntityCode | EntityName)[]) {
        const map = this.entityCodeToNameMap
        return input.map((item) => map.get(item) || item)
    }

    @action.bound setSelectedEntitiesByEntityId(entityIds: EntityId[]) {
        const map = this.entityIdToNameMap
        return this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    isEntitySelected(entityName: EntityName) {
        return this.selectedEntityNameSet.has(entityName)
    }

    // Pretty print all column sources (currently just used in debugging)
    sourcesTable(options: AlignedTextTableOptions) {
        const header: OwidSourceProperty[] = [
            `name`,
            `retrievedDate`,
            `dataPublishedBy`,
            `dataPublisherSource`,
            `additionalInfo`,
        ]
        return toAlignedTextTable(
            [`slug`, ...header],
            this.defs.map((def) => {
                return { ...def.source, slug: def.slug }
            }),
            options
        )
    }

    @computed get unselectedEntityNames() {
        return this.unselectedRows.map((row) => row.entityName)
    }

    @computed get selectedEntityNames() {
        return Array.from(this.selectedEntityNameSet)
    }

    @computed get numSelectedEntities() {
        return this.selectedEntityNames.length
    }

    @computed private get selectedEntityNameSet() {
        return new Set<EntityName>(
            Array.from(this.selectedRows.values()).map((row) => row.entityName)
        )
    }

    @computed get selectedEntityCodes(): EntityCode[] {
        const map = this.entityNameToCodeMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    @computed get selectedEntityCodesOrNames(): (EntityCode | EntityName)[] {
        const map = this.entityNameToCodeMap
        return this.selectedEntityNames.map((name) => map.get(name) ?? name)
    }

    @computed get selectedEntityIds(): EntityId[] {
        const map = this.entityNameToIdMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    @action.bound toggleSelection(entityName: EntityName) {
        return this.isEntitySelected(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    @action.bound selectEntity(entityName: EntityName) {
        this.selectRows(this.rowsByEntityName.get(entityName) ?? [])
        return this
    }

    // Mainly for testing
    @action.bound selectSample(howMany = 1) {
        return this.setSelectedEntities(
            this.availableEntityNames.slice(0, howMany)
        )
    }

    @action.bound deselectEntity(entityName: EntityName) {
        return this.deselectRows(this.rowsByEntityName.get(entityName) ?? [])
    }

    getColorForEntityName(entityName: EntityName) {
        return this.getLatestValueForEntity(
            entityName,
            OwidTableSlugs.entityColor
        )
    }

    @computed get columnDisplayNameToColorMap() {
        return keyBy(this.columnsAsArray, (col) => col.displayName)
    }

    getColorForColumnByDisplayName(displayName: string) {
        return this.columnDisplayNameToColorMap[displayName]?.def.color
    }

    // This assumes the table is sorted where the times for entity names go in asc order.
    // The whole table does not have to be sorted by time.
    getLatestValueForEntity(entityName: EntityName, columnSlug: ColumnSlug) {
        const rows = this.rowsByEntityName.get(entityName) || []
        const hit = rows
            .slice()
            .reverse()
            .find((row) => !(row[columnSlug] instanceof InvalidCell))
        return hit ? hit[columnSlug] : undefined
    }

    entitiesWith(columnSlugs: ColumnSlug[]): Set<EntityName> {
        if (!columnSlugs.length) return new Set()
        if (columnSlugs.length === 1)
            return new Set(this.get(columnSlugs[0])!.uniqEntityNames)

        return intersectionOfSets<EntityName>(
            columnSlugs.map((slug) => new Set(this.get(slug)!.uniqEntityNames))
        )
    }

    fillColumnWithTolerance(columnSlug: ColumnSlug, tolerance: number) {
        const column = this.get(columnSlug)
        const columnDef = column?.def as OwidColumnDef
        const timeColumnSlug = timeColumnSlugFromColumnDef(columnDef)
        const timeColumnDef = this.get(timeColumnSlug)?.def as OwidColumnDef
        const originalTimeSlug = makeOriginalTimeSlugFromColumnSlug(columnSlug)

        const originalRows = this.sortedByTime.rows
        const allTimes = originalRows.map((row) => row[timeColumnSlug])

        const rows = flatten(
            Object.values(groupBy(originalRows, (row) => row.entityId)).map(
                (rows) => {
                    const { entityId, entityCode, entityName } = rows[0]
                    const existingTimesSet = new Set(
                        rows.map((row) => row[timeColumnSlug])
                    )
                    const timesToInject = allTimes.filter(
                        (time) => !existingTimesSet.has(time)
                    )
                    rows = sortBy(
                        rows.concat(
                            timesToInject.map(
                                (time) =>
                                    ({
                                        [timeColumnSlug]: time,
                                        entityId,
                                        entityCode,
                                        entityName,
                                    } as OwidRow)
                            )
                        ),
                        timeColumnSlug
                    )
                    // Copy over times to originalTime column. That is the one that will be overriden
                    // in fillUndefinedWithClosest().
                    rows = rows.map((row) => ({
                        ...row,
                        [originalTimeSlug]: row[timeColumnSlug],
                    }))
                    return fillUndefinedWithClosest(
                        rows,
                        columnSlug,
                        originalTimeSlug,
                        tolerance
                    )
                }
            )
        )

        const defs: OwidColumnDef[] = [
            ...this.defs,
            {
                ...timeColumnDef,
                slug: originalTimeSlug,
            },
        ]

        return this.transform(
            rows,
            defs,
            `Applied tolerance to column ${columnSlug} and appended column ${originalTimeSlug}`,
            TransformType.UpdateColumnDefs
        )
    }

    // This takes both the Variables and Dimensions data and generates an OwidTable.
    static fromLegacy(
        json: LegacyVariablesAndEntityKey,
        grapherConfig: Partial<LegacyGrapherInterface> = {}
    ) {
        const { rows, defs } = legacyToOwidTable(json, grapherConfig)
        return new OwidTable(rows, defs)
    }
}
