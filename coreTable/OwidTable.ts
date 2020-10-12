import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"
import {
    max,
    min,
    parseDelimited,
    intersectionOfSets,
    findClosestTimeIndex,
    sum,
    flatten,
    uniq,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import {
    ColumnTypeNames,
    ColumnSlug,
    Integer,
    CoreRow,
    Time,
} from "coreTable/CoreTableConstants"
import { CoreTable, TransformType } from "./CoreTable"
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
import { legacyToOwidTable } from "./LegacyToOwidTable"

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends CoreTable<OwidRow> {
    static fromDelimited(csvOrTsv: string, defs: OwidColumnDef[] = []) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []

        const missingColumns = RequiredColumnDefs.filter(
            (def) => !colSlugs.includes(def.slug)
        )

        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns.join(
                    ","
                )}'`
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
        const map = new Map<EntityId, EntityName>()
        this.rows.forEach((row) => {
            map.set(row.entityId, row.entityName)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed private get entityCodeToNameMap() {
        const map = new Map<EntityCode, EntityName>()
        this.rows.forEach((row) => {
            if (row.entityCode) map.set(row.entityCode, row.entityName)
            else map.set(row.entityName, row.entityName)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityNameToIdMap() {
        const map = new Map<EntityName, number>()
        this.rows.forEach((row) => {
            map.set(row.entityName, row.entityId)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityNameToCodeMap() {
        const map = new Map<EntityName, EntityCode>()
        this.rows.forEach((row) => {
            map.set(row.entityName, row.entityCode)
        })
        return map
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
        return max(this.allTimes)
    }

    @computed get minTime() {
        return min(this.allTimes)
    }

    @computed get allTimes() {
        return this.rows.map(rowTime)
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
        return this.rowsBy<Time>(this.timeColumn.slug)
    }

    getTimeOptionsForColumns(columnSlugs: ColumnSlug[]) {
        return uniq(
            flatten(
                this.getColumns(columnSlugs)
                    .filter((col) => col)
                    .map((col) => col.uniqTimes)
            )
        ).sort()
    }

    copySelectionFrom(table: OwidTable) {
        return this.setSelectedEntities(table.selectedEntityNames)
    }

    filterByEntityName(name: EntityName) {
        return new OwidTable(
            this.rowsByEntityName.get(name) || [],
            this.defs,
            this,
            `Filter out all entities except '${name}'`,
            TransformType.FilterRows
        )
    }

    // todo: speed up
    filterByTime(start: Time, end: Time) {
        // We may want to do this in Grapher instead of here.
        const adjustedStart = start === Infinity ? this.maxTime! : start
        const adjustedEnd = end === -Infinity ? this.minTime! : end

        return this.filterBy((row) => {
            const time = rowTime(row)
            return time >= adjustedStart && time <= adjustedEnd
        }, `Keep only rows with Time between ${adjustedStart} - ${adjustedEnd}`)
    }

    filterByPopulation(minPop: number) {
        return this.filterBy((row) => {
            const name = row.entityName
            const pop = populationMap[name]
            return !pop || this.isSelected(row) || pop >= minPop
        }, `Filter out countries with population less than ${minPop}`)
    }

    filterByTargetTime(targetTime: Time, tolerance: Integer) {
        const timeSlug = this.timeColumn.slug
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

        return this.filterBy(
            (row) => matchingRows.has(row),
            `Keep one row per entity closest to time ${targetTime} with tolerance ${tolerance}`
        )
    }

    // Shows how much each entity contributed to the given column for each time period
    toPercentageFromEachEntityForEachTime(columnSlug: ColumnSlug) {
        const newDefs = this.defs.map((def) => {
            if (columnSlug === def.slug)
                return { ...def, type: ColumnTypeNames.Percentage }
            return def
        })
        const rowsForYear = this.rowsByTime
        const timeColumnSlug = this.timeColumn.slug
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
            this,
            `Transformed ${columnSlug} column to be % contribution of each entity for that time`,
            TransformType.UpdateColumns
        )
    }

    // If you want to see how much each column contributed to that entity for that year, use this.
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
                const total = sum(columnSlugs.map((slug) => row[slug]))
                columnSlugs.forEach((slug) => {
                    newRow[slug] = (100 * row[slug]) / total
                })
                return newRow
            }),
            newDefs,
            this,
            `Transformed columns from absolute values to % of sum of ${columnSlugs.join(
                ","
            )} `,
            TransformType.UpdateColumns
        )
    }

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
            this,
            `Transformed columns from absolute values to % of time ${startTime} for columns ${columnSlugs.join(
                ","
            )} `,
            TransformType.UpdateColumns
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
            .filter((row) => row) as OwidRow[]
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

    // todo: change return type?
    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        this.setSelectedEntities(codesInData.map((code) => map.get(code)!))
        return codesInData
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

    // todo: remove?
    getLabelForEntityName(entityName: string) {
        return entityName
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

    @computed get selectedEntityCodes() {
        const map = this.entityNameToCodeMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter((code) => code) as string[]
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

    getColorForEntityName(entityName: string) {
        return this.get(OwidTableSlugs.entityColor)?.getLatestValueForEntity(
            entityName
        )
    }

    entitiesWith(columnSlugs: string[]): Set<string> {
        if (!columnSlugs.length) return new Set()
        if (columnSlugs.length === 1)
            return new Set(this.get(columnSlugs[0])!.uniqEntityNames)

        return intersectionOfSets<string>(
            columnSlugs.map((slug) => new Set(this.get(slug)!.uniqEntityNames))
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
