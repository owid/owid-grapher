import {
    LegacyVariableConfig,
    OwidSource,
    LegacyEntityMeta,
    LegacyVariablesAndEntityKey,
    LegacyVariableId,
} from "./LegacyVariableCode"
import {
    groupBy,
    diffDateISOStringInDays,
    max,
    min,
    sortBy,
    parseDelimited,
    intersectionOfSets,
    getRandomNumberGenerator,
    range,
    findClosestTimeIndex,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import { EPOCH_DATE, Time, TimeRange } from "grapher/core/GrapherConstants"
import {
    ColumnTypeNames,
    Year,
    ColumnSlug,
    EntityId,
    EntityCode,
    Integer,
    EntityName,
} from "./CoreTableConstants"
import {
    AbstractCoreColumn,
    AbstractCoreTable,
    MapOfColumnSpecs,
    CoreColumnSpec,
    CoreRow,
    SelectionColumn,
} from "./CoreTable"

export interface OwidColumnSpec extends CoreColumnSpec {
    owidVariableId?: LegacyVariableId
    coverage?: string
    datasetId?: string
    datasetName?: string
    source?: OwidSource
    isDailyMeasurement?: boolean // todo: remove
}

const globalEntityIds = new Map()
export const generateEntityId = (entityName: string) => {
    if (!globalEntityIds.has(entityName))
        globalEntityIds.set(entityName, globalEntityIds.size)
    return globalEntityIds.get(entityName)
}

// This is a row with the additional columns specific to our OWID data model
interface OwidRow extends CoreRow {
    entityName: EntityName
    entityCode: EntityCode
    entityId: EntityId
    time: Time
    year?: Year
    day?: Integer
    date?: string
}

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends AbstractCoreTable<OwidRow> {
    static fromDelimited(csvOrTsv: string, specs?: OwidColumnSpec[]) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []

        const missingColumns = OwidTable.requiredColumnSpecs.filter(
            (spec) => !colSlugs.includes(spec.slug)
        )

        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns.join(
                    ","
                )}'`
            )

        const table = new OwidTable((parsed as any) as OwidRow[])
        if (specs) table.addSpecs(specs, true)
        table.addSpecs(OwidTable.requiredColumnSpecs, true)
        return table
    }

    clone() {
        return new OwidTable(
            this.rows,
            this.columnsAsArray.map((col) => col.spec)
        )
    }

    @computed get columnsByOwidVarId() {
        const map = new Map<number, AbstractCoreColumn>()
        Array.from(this.columns.values()).forEach((column, index) => {
            map.set(
                (column.spec as OwidColumnSpec).owidVariableId ?? index,
                column
            )
        })
        return map
    }

    @computed get entityType() {
        return "Country"
    }

    @computed get availableEntityNames() {
        return Array.from(this.availableEntityNameSet)
    }

    @computed get availableEntityNameSet() {
        return new Set(this.rows.map((row) => row.entityName))
    }

    @computed get unfilteredEntities() {
        return new Set(this.unfilteredRows.map((row) => row.entityName))
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
    @computed get entityCodeToNameMap() {
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
        return this.rows.filter((row) => row.year).map((row) => row.year!)
    }

    @computed get hasDayColumn() {
        return this.columns.has("day")
    }

    @computed get dayColumn() {
        return this.columns.get("day")
    }

    @computed get rowsByEntityName() {
        const map = new Map<EntityName, OwidRow[]>()
        this.rows.forEach((row) => {
            const name = row.entityName
            if (!map.has(name)) map.set(name, [])
            map.get(name)!.push(row)
        })
        return map
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
        this.initDefaultEntitySelectionColumn()
        const set = new Set(entityNames)
        this.rows.forEach((row) => {
            row[this.defaultEntitySelectionSlug] = set.has(row.entityName)
        })
    }

    @action.bound clearSelection() {
        this.selectedEntityNames.forEach((name) => {
            this.deselectEntity(name)
        })
    }

    @action.bound selectAll() {
        this.unselectedEntityNames.forEach((name) => {
            this.selectEntity(name)
        })
    }

    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        this.setSelectedEntities(codesInData.map((code) => map.get(code)!))
        return codesInData
    }

    @action.bound setSelectedEntitiesByEntityId(entityIds: EntityId[]) {
        const map = this.entityIdToNameMap
        this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    private defaultEntitySelectionSlug = "is_entity_selected"
    private initDefaultEntitySelectionColumn() {
        if (!this.columnsBySlug.has(this.defaultEntitySelectionSlug))
            this.columns.set(
                this.defaultEntitySelectionSlug,
                new SelectionColumn(this, {
                    slug: this.defaultEntitySelectionSlug,
                })
            )
    }

    isEntitySelected(entityName: EntityName) {
        return this.selectedEntityNameSet.has(entityName)
    }

    @computed get selectedEntityNameSet() {
        return new Set(this.selectedEntityNames)
    }

    @computed get selectedEntityCodes() {
        const map = this.entityNameToCodeMap
        return Array.from(this.selectedEntityNameSet)
            .map((name) => map.get(name))
            .filter((code) => code) as string[]
    }

    getColorForEntityName(entityName: string) {
        // Todo: restore Grapher keycolors functionality
        const colors = {
            Africa: "#923E8B",
            Antarctica: "#5887A1",
            Asia: "#2D8587",
            Europe: "#4C5C78",
            "North America": "#E04E4B",
            Oceania: "#A8633C",
            "South America": "#932834",
        }
        return Object.values(colors)[entityName.charCodeAt(0) % 7]
    }

    @action.bound toggleSelection(entityName: EntityName) {
        if (this.isEntitySelected(entityName)) this.deselectEntity(entityName)
        else this.selectEntity(entityName)
    }

    @action.bound selectEntity(entityName: EntityName) {
        this.initDefaultEntitySelectionColumn()

        this.rowsByEntityName
            .get(entityName)
            ?.forEach((row) => (row[this.defaultEntitySelectionSlug] = true))
        return this
    }

    @action.bound deselectEntity(entityName: EntityName) {
        this.rowsByEntityName
            .get(entityName)
            ?.forEach((row) => delete row[this.defaultEntitySelectionSlug])
        return this
    }

    specToObject() {
        const output: any = {}
        Array.from(this.columns.values()).forEach((col) => {
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
            return this.columnsBySlug.get(columnSlugs[0])!.entityNamesUniq

        return intersectionOfSets<string>(
            columnSlugs.map(
                (slug) => this.columnsBySlug.get(slug)!.entityNamesUniq
            )
        )
    }

    private static annotationsToMap(annotations: string) {
        // Todo: let's delete this and switch to traditional columns
        const entityAnnotationsMap = new Map<string, string>()
        const delimiter = ":"
        annotations.split("\n").forEach((line) => {
            const [key, ...words] = line.split(delimiter)
            entityAnnotationsMap.set(key.trim(), words.join(delimiter).trim())
        })
        return entityAnnotationsMap
    }

    static makeAnnotationColumnSlug(columnSlug: ColumnSlug) {
        return columnSlug + "-annotations"
    }

    private static columnSpecFromLegacyVariable(
        variable: LegacyVariableConfig
    ): OwidColumnSpec {
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
        } = variable

        // Without this the much used var 123 appears as "Countries Continent". We could rename in Grapher but not sure the effects of that.
        const name = variable.id == 123 ? "Continent" : variable.name

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
            source,
            owidVariableId: variable.id,
            type: ColumnTypeNames.Numeric,
        }
    }

    static requiredColumnSpecs: OwidColumnSpec[] = [
        {
            name: "Entity",
            slug: "entityName",
            type: ColumnTypeNames.Categorical,
        },
        {
            slug: "entityId",
            type: ColumnTypeNames.Categorical,
        },
        {
            name: "Code",
            slug: "entityCode",
            type: ColumnTypeNames.Categorical,
        },
    ]

    static legacyVariablesToTabular(json: LegacyVariablesAndEntityKey) {
        let rows: OwidRow[] = []
        const entityMetaById: { [id: string]: LegacyEntityMeta } =
            json.entityKey
        const columnSpecs: MapOfColumnSpecs = new Map()
        OwidTable.requiredColumnSpecs.forEach((spec) => {
            columnSpecs.set(spec.slug, spec)
        })

        for (const key in json.variables) {
            const variable = json.variables[key]

            const entityNames =
                variable.entities?.map((id) => entityMetaById[id].name) || []
            const entityCodes =
                variable.entities?.map((id) => entityMetaById[id].code) || []

            const columnSpec = OwidTable.columnSpecFromLegacyVariable(variable)
            const columnSlug = columnSpec.slug
            columnSpec.isDailyMeasurement
                ? columnSpecs.set("day", {
                      slug: "day",
                      type: ColumnTypeNames.Date,
                      name: "Date",
                  })
                : columnSpecs.set("year", {
                      slug: "year",
                      type: ColumnTypeNames.Year,
                      name: "Year",
                  })
            columnSpecs.set(columnSlug, columnSpec)

            // todo: remove. move annotations to their own first class column.
            let annotationsColumnSlug: string
            let annotationMap: Map<string, string>
            if (variable.display?.entityAnnotationsMap) {
                annotationsColumnSlug = OwidTable.makeAnnotationColumnSlug(
                    columnSlug
                )
                annotationMap = OwidTable.annotationsToMap(
                    variable.display.entityAnnotationsMap
                )
                columnSpecs.set(annotationsColumnSlug, {
                    slug: annotationsColumnSlug,
                    type: ColumnTypeNames.String,
                    name: `${columnSpec.name} Annotations`,
                })
            }

            const timeColumnName = columnSpec.isDailyMeasurement
                ? "day"
                : "year"

            // Todo: remove
            const display = variable.display
            const yearsNeedTransform =
                display &&
                display.yearIsDay &&
                display.zeroDay !== undefined &&
                display.zeroDay !== EPOCH_DATE
            const yearsRaw = variable.years || []
            const years =
                yearsNeedTransform && display
                    ? OwidTable.convertLegacyYears(yearsRaw, display.zeroDay!)
                    : yearsRaw

            const values = variable.values || []
            const entities = variable.entities || []

            const newRows = values.map((value, index) => {
                const entityName = entityNames[index]
                const time = years[index]
                const row: OwidRow = {
                    [timeColumnName]: time,
                    time,
                    [columnSlug]: value,
                    entityName,
                    entityId: entities[index],
                    entityCode: entityCodes[index],
                }
                if (annotationsColumnSlug)
                    row[annotationsColumnSlug] = annotationMap.get(entityName)
                return row
            })
            rows = rows.concat(newRows)
        }
        const groupMap = groupBy(rows, (row) => {
            const timePart =
                row.year !== undefined ? `year:${row.year}` : `day:${row.day}`
            return timePart + " " + row.entityName
        })

        const joinedRows: OwidRow[] = Object.keys(groupMap).map((groupKey) =>
            Object.assign({}, ...groupMap[groupKey])
        )

        return {
            rows: sortBy(joinedRows, ["year", "day"]),
            columnSpecs,
        }
    }

    // todo: move "unit conversions" to computed columns
    @action.bound applyUnitConversionAndOverwriteLegacyColumn(
        unitConversionFactor: number,
        variableId: LegacyVariableId
    ) {
        const sourceColumn = this.columnsByOwidVarId.get(variableId)!
        this.addNumericComputedColumn({
            ...sourceColumn.spec,
            fn: (row) => row[sourceColumn.slug] * unitConversionFactor,
        })
    }

    @action.bound loadFromLegacy(json: LegacyVariablesAndEntityKey) {
        const { rows, columnSpecs } = OwidTable.legacyVariablesToTabular(json)
        return this.load(rows, columnSpecs, false)
    }

    // todo: remove
    private static convertLegacyYears(years: number[], zeroDay: string) {
        // Only shift years if the variable zeroDay is different from EPOCH_DATE
        // When the dataset uses days (`yearIsDay == true`), the days are expressed as integer
        // days since the specified `zeroDay`, which can be different for different variables.
        // In order to correctly join variables with different `zeroDay`s in a single chart, we
        // normalize all days to be in reference to a single epoch date.
        const diff = diffDateISOStringInDays(zeroDay, EPOCH_DATE)
        return years.map((y) => y + diff)
    }
}

interface SynthOptions {
    countryCount: number
    timeRange: TimeRange
    columnSpecs: OwidColumnSpec[]
}

// Generate a fake table for testing
export const SynthesizeOwidTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
) => {
    const finalOptions = {
        countryCount: 2,
        timeRange: [1950, 2020],
        columnSpecs: [
            { slug: "Population", type: "Population", range: [1e6, 1e8] },
            { slug: "GDP", type: "Currency", range: [1e6, 1e8] },
        ] as OwidColumnSpec[],
        ...options,
    }
    const { countryCount, columnSpecs, timeRange } = finalOptions
    const colSlugs = ["entityName", "entityCode", "entityId", "year"].concat(
        columnSpecs.map((col) => col.slug!)
    )

    const valueGenerators = columnSpecs.map((col, index) =>
        getRandomNumberGenerator(col.range![0], col.range![1], seed + index)
    )

    // todo: support N countries
    const countries = [
        "Germany",
        "France",
        "Iceland",
        "Australia",
        "China",
        "Nigeria",
        "Brazil",
        "Canada",
        "Fiji",
        "Japan",
    ].slice(0, countryCount)

    const rows = countries.map((country, index) =>
        range(timeRange[0], timeRange[1])
            .map((year) =>
                [
                    country,
                    country.substr(0, 3).toUpperCase(),
                    index,
                    year,
                    ...columnSpecs.map((slug, index) =>
                        valueGenerators[index]()
                    ),
                ].join(",")
            )
            .join("\n")
    )

    const table = OwidTable.fromDelimited(
        `${colSlugs.join(",")}\n${rows.join("\n")}`,
        columnSpecs
    )

    return table
}
