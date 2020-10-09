import {
    LegacyVariablesAndEntityKey,
    LegacyVariableDisplayConfigInterface,
} from "./LegacyVariableCode"
import {
    max,
    min,
    parseDelimited,
    intersectionOfSets,
    getRandomNumberGenerator,
    range,
    findClosestTimeIndex,
    sampleFrom,
    sum,
    Grid,
    trimGrid,
    getDropIndexes,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import { SortOrder, Time, TimeRange } from "grapher/core/GrapherConstants"
import {
    ColumnTypeNames,
    ColumnSlug,
    EntityId,
    EntityCode,
    Integer,
    EntityName,
    CoreRow,
    CoreColumnSpec,
} from "./CoreTableConstants"
import {
    AbstractCoreColumn,
    AbstractCoreTable,
    DroppedForTesting,
} from "./CoreTable"
import { countries } from "utils/countries"
import { populationMap } from "./PopulationMap"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import {
    OwidColumnSpec,
    OwidRow,
    OwidTableSlugs,
    RequiredColumnSpecs,
} from "./OwidTableConstants"
import { legacyToOwidTable } from "./LegacyToOwidTable"

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends AbstractCoreTable<OwidRow> {
    static fromDelimited(csvOrTsv: string, specs: OwidColumnSpec[] = []) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []

        const missingColumns = RequiredColumnSpecs.filter(
            (spec) => !colSlugs.includes(spec.slug)
        )

        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns.join(
                    ","
                )}'`
            )

        const rows = (parsed as any) as OwidRow[]
        return new OwidTable(rows, [...RequiredColumnSpecs, ...specs])
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

    private rowsBy<T>(columnSlug: ColumnSlug) {
        const map = new Map<T, OwidRow[]>()
        this.rows.forEach((row) => {
            const key = row[columnSlug]
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(row)
        })
        return map
    }

    // Todo: figure out correct inheritance method here
    get rootTable(): OwidTable {
        return this.parent ? (this.parent.rootTable as OwidTable) : this
    }

    copySelectionFrom(table: OwidTable) {
        return this.setSelectedEntities(table.selectedEntityNames)
    }

    filterByEntityName(name: EntityName) {
        return new OwidTable(
            this.rowsByEntityName.get(name) || [],
            this.specs,
            this,
            `Filter out all entities except '${name}'`
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

    withoutRows(rows: OwidRow[]) {
        const set = new Set(rows)
        return this.filterBy(
            (row) => !set.has(row),
            `Dropping ${rows.length} rows`
        )
    }

    // for testing. Preserves ordering.
    dropRandomRows(howMany = 1, seed = Date.now()) {
        if (!howMany) return this // todo: clone?
        const indexesToDrop = getDropIndexes(this.numRows, howMany, seed)
        return this.filterBy(
            (row, index) => !indexesToDrop.has(index),
            `Dropping a random ${howMany} rows`
        )
    }

    dropRandomCells(
        howMany = 1,
        columnSlugs: ColumnSlug[] = [],
        seed = Date.now()
    ) {
        const specs = this.columnsAsArray.map((col) => {
            const { spec } = col
            if (!columnSlugs.includes(col.slug)) return spec
            const indexesToDrop = getDropIndexes(
                col.parsedValues.length,
                howMany,
                seed
            )
            return {
                ...spec,
                fn: (row: OwidRow, index: number) =>
                    indexesToDrop.has(index)
                        ? new DroppedForTesting()
                        : row[col.slug],
            }
        })
        return new (this.constructor as any)(
            this.rows,
            specs,
            this,
            `Dropped ${howMany} cells in ${columnSlugs}`
        )
    }

    dropRandomPercent(dropHowMuch = 1, seed = Date.now()) {
        return this.dropRandomRows(
            Math.floor((dropHowMuch / 100) * this.numRows),
            seed
        )
    }

    filterByPopulation(minPop: number) {
        return this.filterBy((row) => {
            const name = row.entityName
            const pop = populationMap[name]
            return !pop || this.isSelected(row) || pop >= minPop
        }, `Filter out countries with population less than ${minPop}`)
    }

    // todo: speed up
    // todo: how can we just use super method?
    filterBy(
        predicate: (row: OwidRow, index: number) => boolean,
        opName: string
    ): OwidTable {
        return super.filterBy(predicate as any, opName) as OwidTable
    }

    filterBySelectedOnly() {
        return this.filterBy(
            (row) => this.isSelected(row),
            `Selected rows only`
        )
    }

    filterByFullColumnsOnly(slugs: ColumnSlug[]) {
        return this.filterBy(
            (row) =>
                slugs.every(
                    (slug) => row[slug] !== null && row[slug] !== undefined
                ),
            `Dropping rows missing a value for any of ${slugs.join(",")}`
        )
    }

    filterNegativesForLogScale(columnSlug: ColumnSlug) {
        return this.filterBy(
            (row) => row[columnSlug] > 0,
            `Remove rows if ${columnSlug} is <= 0 for log scale`
        )
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
        const newSpecs = this.specs.map((spec) => {
            if (columnSlug === spec.slug)
                return { ...spec, type: ColumnTypeNames.Percentage }
            return spec
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
            newSpecs,
            this,
            `Transformed ${columnSlug} column to be % contribution of each entity for that time`
        )
    }

    // If you want to see how much each column contributed to that entity for that year, use this.
    toPercentageFromEachColumnForEachEntityAndTime(columnSlugs: ColumnSlug[]) {
        const newSpecs = this.specs.map((spec) => {
            if (columnSlugs.includes(spec.slug))
                return { ...spec, type: ColumnTypeNames.RelativePercentage }
            return spec
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
            newSpecs,
            this,
            `Transformed columns from absolute values to % of sum of ${columnSlugs.join(
                ","
            )} `
        )
    }

    // If you wanted to build a table showing something like GDP growth relative to 1950, use this.
    toTotalGrowthForEachColumnComparedToStartTime(
        startTime: Time,
        columnSlugs: ColumnSlug[]
    ) {
        const newSpecs = this.specs.map((spec) => {
            if (columnSlugs.includes(spec.slug))
                return { ...spec, type: ColumnTypeNames.PercentChangeOverTime }
            return spec
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
            newSpecs,
            this,
            `Transformed columns from absolute values to % of time ${startTime} for columns ${columnSlugs.join(
                ","
            )} `
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): OwidTable {
        return super.sortBy(slugs, orders) as OwidTable
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

    @computed get selectedEntityNameSet() {
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

    // todo: how do I make this generic and on CoreTable?
    withColumns(columns: CoreColumnSpec[]): OwidTable {
        return new (this.constructor as any)(
            this.rows,
            this.specs.concat(columns),
            this,
            `Added new columns ${columns.map((spec) => spec.slug)}`
        )
    }

    getColorForEntityName(entityName: string) {
        return this.get("entityColor")?.getLatestValueForEntity(entityName)
    }

    specToObject() {
        const output: any = {}
        this.columnsAsArray.forEach((col) => {
            output[col.slug] = col.spec
        })
        return output
    }

    toJs() {
        return {
            columns: this.specToObject(),
            rows: this.rows,
        }
    }

    entitiesWith(columnSlugs: string[]): Set<string> {
        if (!columnSlugs.length) return new Set()
        if (columnSlugs.length === 1)
            return this.get(columnSlugs[0])!.entityNamesUniq

        return intersectionOfSets<string>(
            columnSlugs.map((slug) => this.get(slug)!.entityNamesUniq)
        )
    }

    static fromMatrix(inputTable: Grid) {
        const table = trimGrid(inputTable)
        const header = table[0]
        const rows = table.slice(1).map((row) => {
            const newRow: any = {}
            header.forEach((col, index) => {
                newRow[col] = row[index]
            })
            return newRow as OwidRow
        })
        return new OwidTable(rows)
    }

    // This takes both the Variables and Dimensions data and generates an OwidTable.
    static fromLegacy(
        json: LegacyVariablesAndEntityKey,
        grapherConfig: Partial<LegacyGrapherInterface> = {}
    ) {
        const { rows, specs } = legacyToOwidTable(json, grapherConfig)
        return new OwidTable(rows, specs)
    }
}

interface SynthOptions {
    entityCount: number
    entityNames: string[]
    timeRange: TimeRange
    columnSpecs: OwidColumnSpec[]
}

export const SynthesizeOwidTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
) => {
    const finalOptions: SynthOptions = {
        entityNames: [],
        entityCount: 2,
        timeRange: [1950, 2020],
        columnSpecs: [],
        ...options,
    }
    const { entityCount, columnSpecs, timeRange, entityNames } = finalOptions
    const colSlugs = ([
        OwidTableSlugs.entityName,
        OwidTableSlugs.entityCode,
        OwidTableSlugs.entityId,
        OwidTableSlugs.year,
    ] as ColumnSlug[]).concat(columnSpecs.map((col) => col.slug!))

    const entities = entityNames.length
        ? entityNames.map((name) => {
              return {
                  name,
                  code: name.substr(0, 3).toUpperCase(),
              }
          })
        : sampleFrom(countries, entityCount, seed)

    const rows = entities.map((entity, index) => {
        let values = columnSpecs.map((spec) => spec.generator!())
        return range(timeRange[0], timeRange[1])
            .map((year) => {
                values = columnSpecs.map((spec, index) =>
                    Math.round(
                        values[index] * (1 + spec.growthRateGenerator!() / 100)
                    )
                )
                return [entity.name, entity.code, index, year, ...values].join(
                    ","
                )
            })
            .join("\n")
    })

    return OwidTable.fromDelimited(
        `${colSlugs.join(",")}\n${rows.join("\n")}`,
        columnSpecs
    )
}

export const SynthesizeNonCountryTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
) =>
    SynthesizeOwidTable(
        {
            entityNames: ["Fire", "Earthquake", "Tornado"],
            columnSpecs: [
                {
                    slug: SampleColumnSlugs.Disasters,
                    type: ColumnTypeNames.Integer,
                    generator: getRandomNumberGenerator(0, 20, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -50,
                        50,
                        seed
                    ),
                },
            ],
            ...options,
        },
        seed
    )

export enum SampleColumnSlugs {
    Population = "Population",
    GDP = "GDP",
    LifeExpectancy = "LifeExpectancy",
    Fruit = "Fruit",
    Vegetables = "Vegetables",
    Disasters = "Disasters",
}

export const SynthesizeGDPTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now(),
    display?: LegacyVariableDisplayConfigInterface
) =>
    SynthesizeOwidTable(
        {
            columnSpecs: [
                {
                    slug: SampleColumnSlugs.Population,
                    type: ColumnTypeNames.Population,
                    source: SynthSource(SampleColumnSlugs.Population),
                    generator: getRandomNumberGenerator(1e7, 1e9, seed),
                    growthRateGenerator: getRandomNumberGenerator(-5, 5, seed),
                    display,
                },
                {
                    slug: SampleColumnSlugs.GDP,
                    type: ColumnTypeNames.Currency,
                    source: SynthSource(SampleColumnSlugs.GDP),
                    generator: getRandomNumberGenerator(1e9, 1e12, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -15,
                        15,
                        seed
                    ),
                    display,
                },
                {
                    slug: SampleColumnSlugs.LifeExpectancy,
                    type: ColumnTypeNames.Age,
                    source: SynthSource(SampleColumnSlugs.LifeExpectancy),
                    generator: getRandomNumberGenerator(60, 90, seed),
                    growthRateGenerator: getRandomNumberGenerator(-2, 2, seed),
                    display,
                },
            ],
            ...options,
        },
        seed
    )

const SynthSource = (name: string) => {
    return {
        id: name.charCodeAt(0) + name.charCodeAt(1) + name.charCodeAt(2),
        name: `${name} Almanac`,
        dataPublishedBy: `${name} Synthetic Data Team`,
        dataPublisherSource: `${name} Institute`,
        link: "http://foo.example",
        retrievedDate: "1/1/2000",
        additionalInfo: `Downloaded via FTP`,
    }
}

export const SynthesizeFruitTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
) =>
    SynthesizeOwidTable(
        {
            columnSpecs: [
                {
                    slug: SampleColumnSlugs.Fruit,
                    type: ColumnTypeNames.Numeric,
                    source: SynthSource(SampleColumnSlugs.Fruit),
                    generator: getRandomNumberGenerator(500, 1000, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -10,
                        10,
                        seed
                    ),
                },
                {
                    slug: SampleColumnSlugs.Vegetables,
                    type: ColumnTypeNames.Numeric,
                    source: SynthSource(SampleColumnSlugs.Vegetables),
                    generator: getRandomNumberGenerator(400, 1000, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -10,
                        12,
                        seed
                    ),
                },
            ],
            ...options,
        },
        seed
    )
