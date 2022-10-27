import * as lodash from "lodash"
import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
} from "../../clientUtils/OwidVariableDisplayConfigInterface.js"
import {
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableDimensionValueFull,
    OwidVariableDimensionValuePartial,
    OwidVariableMixedData,
    OwidVariableWithSourceAndType,
} from "../../clientUtils/OwidVariable.js"
import { arrToCsvRow, omitNullableValues } from "../../clientUtils/Util.js"
import {
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableId,
} from "../../clientUtils/owidTypes.js"
import { OwidSource } from "../../clientUtils/OwidSource.js"
import { CATALOG_PATH } from "../../settings/serverSettings.js"
import * as util from "util"

export interface VariableRow {
    id: number
    name: string
    shortName?: string
    code: string | null
    unit: string
    shortUnit: string | null
    description: string | null
    createdAt: Date
    updatedAt: Date
    datasetId: number
    sourceId: number
    display: OwidVariableDisplayConfigInterface
    coverage?: string
    timespan?: string
    columnOrder?: number
    catalogPath?: string
    dimensions?: Dimensions
}

interface EntityRow {
    entityId: number
    entityName: string
    entityCode: string
}

interface Dimensions {
    originalName: string
    originalShortName: string
    filters: {
        name: string
        value: string
    }[]
}

export type VariableQueryRow = Readonly<
    UnparsedVariableRow & {
        display: string
        datasetName: string
        nonRedistributable: number
        sourceName: string
        sourceDescription: string
        dimensions: string
    }
>

interface DataRow {
    value: string
    year: number
    entityId: number
    entityName: string
    entityCode: string
}

export type UnparsedVariableRow = VariableRow & { display: string }

export type Field = keyof VariableRow

export const variableTable = "variables"

const initDuckDB = (): any => {
    // require on top level could cause segfaults in combination with workerpool
    const duckdb = require("duckdb")
    const ddb = new duckdb.Database(":memory:")
    ddb.exec("INSTALL httpfs;")
    ddb.exec("LOAD httpfs;")
    return ddb
}

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    for (const row of plainRows) {
        row.display = row.display ? JSON.parse(row.display) : undefined
    }
    return plainRows
}

export function normalizeEntityName(entityName: string): string {
    return entityName.toLowerCase().trim()
}

// TODO: we'll want to split this into getVariableData and getVariableMetadata once
// the data API can provide us with the type and distinct dimension values for a
// variable. Before that we need to fetch and iterate the data before we can return
// the metadata so it doesn't make much sense to split this into two functions yet.
export async function getVariableData(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
    type VariableQueryRow = Readonly<
        UnparsedVariableRow & {
            display: string
            datasetName: string
            nonRedistributable: number
            sourceName: string
            sourceDescription: string
            dimensions: string
        }
    >

    const variableQuery: Promise<VariableQueryRow | undefined> = db.mysqlFirst(
        `
        SELECT
            variables.*,
            datasets.name AS datasetName,
            datasets.nonRedistributable AS nonRedistributable,
            sources.name AS sourceName,
            sources.description AS sourceDescription
        FROM variables
        JOIN datasets ON variables.datasetId = datasets.id
        JOIN sources ON variables.sourceId = sources.id
        WHERE variables.id = ?
        `,
        [variableId]
    )

    const row = await variableQuery
    if (row === undefined) throw new Error(`Variable ${variableId} not found`)

    // use parquet only if CATALOG_PATH env var is set and we have path to catalog in MySQL
    const parquetDataExists = row.catalogPath && row.shortName && CATALOG_PATH

    const results = parquetDataExists
        ? await readValuesFromParquet(variableId, row)
        : await readValuesFromMysql(variableId)

    const {
        sourceId,
        sourceName,
        sourceDescription,
        nonRedistributable,
        display: displayJson,
        ...variable
    } = row
    const display = JSON.parse(displayJson)
    const partialSource: OwidSource = JSON.parse(sourceDescription)
    const variableMetadata: OwidVariableWithSourceAndType = {
        ...omitNullableValues(variable),
        type: "mixed", // precise type will be updated further down
        nonRedistributable: Boolean(nonRedistributable),
        display,
        source: {
            id: sourceId,
            name: sourceName,
            dataPublishedBy: partialSource.dataPublishedBy || "",
            dataPublisherSource: partialSource.dataPublisherSource || "",
            link: partialSource.link || "",
            retrievedDate: partialSource.retrievedDate || "",
            additionalInfo: partialSource.additionalInfo || "",
        },
    }
    const variableData: OwidVariableMixedData = {
        years: [],
        entities: [],
        values: [],
    }

    const entityMap = new Map<number, OwidVariableDimensionValueFull>()
    const yearMap = new Map<number, OwidVariableDimensionValuePartial>()

    let encounteredFloatDataValues = false
    let encounteredIntDataValues = false
    let encounteredStringDataValues = false

    for (const row of results) {
        variableData.years.push(row.year)
        variableData.entities.push(row.entityId)
        const asNumber = parseFloat(row.value)
        const asInt = parseInt(row.value)
        if (!isNaN(asNumber)) {
            if (!isNaN(asInt)) encounteredIntDataValues = true
            else encounteredFloatDataValues = true
            variableData.values.push(asNumber)
        } else {
            encounteredStringDataValues = true
            variableData.values.push(row.value)
        }

        if (!entityMap.has(row.entityId)) {
            entityMap.set(row.entityId, {
                id: row.entityId,
                name: row.entityName,
                code: row.entityCode,
            })
        }

        if (!yearMap.has(row.year)) {
            yearMap.set(row.year, { id: row.year })
        }
    }

    if (encounteredFloatDataValues && encounteredStringDataValues) {
        variableMetadata.type = "mixed"
    } else if (encounteredFloatDataValues) {
        variableMetadata.type = "float"
    } else if (encounteredIntDataValues) {
        variableMetadata.type = "int"
    } else if (encounteredStringDataValues) {
        variableMetadata.type = "string"
    }

    return {
        data: variableData,
        metadata: {
            ...variableMetadata,
            dimensions: {
                years: { values: Array.from(yearMap.values()) },
                entities: { values: Array.from(entityMap.values()) },
            },
        },
    }
}

export async function getDataForMultipleVariables(
    variableIds: number[]
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const promises = variableIds.map(
        async (id) => await getVariableData(id as number)
    )
    const allVariablesDataAndMetadata = await Promise.all(promises)
    const allVariablesDataAndMetadataMap = new Map(
        allVariablesDataAndMetadata.map((item) => [item.metadata.id, item])
    )
    return allVariablesDataAndMetadataMap
}

// TODO use this in Dataset.writeCSV() maybe?
export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    const variableQuery: Promise<{ id: number; name: string }[]> =
        db.queryMysql(
            `
            SELECT id, name
            FROM variables
            WHERE id IN (?)
            `,
            [variableIds]
        )

    const dataQuery: Promise<
        {
            variableId: number
            entity: string
            year: number
            value: string
        }[]
    > = db.queryMysql(
        `
        SELECT
            data_values.variableId AS variableId,
            entities.name AS entity,
            data_values.year AS year,
            data_values.value AS value
        FROM
            data_values
            JOIN entities ON entities.id = data_values.entityId
            JOIN variables ON variables.id = data_values.variableId
        WHERE
            data_values.variableId IN (?)
        ORDER BY
            data_values.entityId ASC,
            data_values.year ASC
        `,
        [variableIds]
    )

    let variables = await variableQuery
    const variablesById = lodash.keyBy(variables, "id")

    // Throw an error if not all variables exist
    if (variables.length !== variableIds.length) {
        const fetchedVariableIds = variables.map((v) => v.id)
        const missingVariables = lodash.difference(
            variableIds,
            fetchedVariableIds
        )
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    variables = variableIds.map((variableId) => variablesById[variableId])

    const columns = ["Entity", "Year"].concat(variables.map((v) => v.name))
    stream.write(arrToCsvRow(columns))

    const variableColumnIndex: { [id: number]: number } = {}
    for (const variable of variables) {
        variableColumnIndex[variable.id] = columns.indexOf(variable.name)
    }

    const data = await dataQuery

    let row: unknown[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length) {
                stream.write(arrToCsvRow(row))
            }
            row = [datum.entity, datum.year]
            for (const _ of variables) {
                row.push("")
            }
        }
        row[variableColumnIndex[datum.variableId]] = datum.value
    }
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    const queryStart = `
        SELECT
            value,
            year,
            variables.unit AS unit,
            entities.name AS entityName
        FROM data_values
        JOIN entities on entities.id = data_values.entityId
        JOIN variables on variables.id = data_values.variableId
        WHERE entities.id = ?
        AND variables.id = ?`

    const queryStartVariables = [entityId, variableId]

    let row

    if (year) {
        row = await db.mysqlFirst(
            `${queryStart}
            AND data_values.year = ?`,
            [...queryStartVariables, year]
        )
    } else {
        row = await db.mysqlFirst(
            `${queryStart}
            ORDER BY data_values.year DESC
            LIMIT 1`,
            queryStartVariables
        )
    }

    if (!row) return

    return {
        value: Number(row.value),
        year: Number(row.year),
        unit: row.unit,
        entityName: row.entityName,
    }
}

export const getOwidChartDimensionConfigForVariable = async (
    variableId: OwidVariableId,
    chartId: number
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.mysqlFirst(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM charts
        WHERE id = ?
        `,
        [chartId]
    )
    if (!row.dimensions) return
    const dimensions = JSON.parse(row.dimensions)
    return dimensions.find(
        (dimension: OwidChartDimensionInterface) =>
            dimension.variableId === variableId
    )
}

export const getOwidVariableDisplayConfig = async (
    variableId: OwidVariableId
): Promise<OwidVariableDisplayConfigInterface | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT display FROM variables WHERE id = ?`,
        [variableId]
    )
    if (!row.display) return
    return JSON.parse(row.display)
}

const readValuesFromMysql = async (
    variableId: OwidVariableId
): Promise<DataRow[]> => {
    return db.queryMysql(
        `
        SELECT
            value,
            year,
            entities.id AS entityId,
            entities.name AS entityName,
            entities.code AS entityCode
        FROM data_values
        LEFT JOIN entities ON data_values.entityId = entities.id
        WHERE data_values.variableId = ?
        ORDER BY
            year ASC
        `,
        [variableId]
    )
}

export const constructParquetQuery = (row: VariableQueryRow): string => {
    let shortName
    let where

    if (row.dimensions) {
        const dimensions: Dimensions = JSON.parse(row.dimensions)
        shortName = dimensions.originalShortName
        where = dimensions.filters
            .map((filter) => `${filter.name} = '${filter.value}'`)
            .join(" and ")
    } else {
        shortName = row.shortName
        where = "1 = 1"
    }

    const uri = `${_.trimEnd(CATALOG_PATH, "/")}/${row.catalogPath!}.parquet`

    // backported variables use entity_id, entity_code and entity_name instead of country
    // TODO: it might be easier to keep backported variables in the same format as grapher
    // variables, i.e. with just country
    if (row.catalogPath!.startsWith("backport/")) {
        return `
            select
                ${shortName} as value,
                year,
                entity_name as entityName,
                entity_code as entityCode,
                entity_id as entityId
            from read_parquet('${uri}')
            where ${shortName} is not null and ${where}
            order by year asc
        `
    } else {
        return `
            select
                ${shortName} as value,
                year,
                country as entityName
            from read_parquet('${uri}')
            where ${shortName} is not null and ${where}
            order by year asc
        `
    }
}

export const fetchEntities = async (
    entityNames: string[]
): Promise<EntityRow[]> => {
    return db.queryMysql(
        `
            SELECT
                entities.id AS entityId,
                entities.name AS entityName,
                entities.code AS entityCode
            FROM entities WHERE LOWER(name) in (?)
            `,
        [_(entityNames).map(normalizeEntityName).uniq().value()]
    )
}

export const executeSQL = async (sql: string): Promise<any[]> => {
    // DuckDB must be initialized in a process, copying DB object from the parent process
    // gives random segfaults. It is not a problem though, as the initialization is fast (~few ms)
    const ddb = initDuckDB()
    const con = ddb.connect()
    try {
        return util.promisify(con.all).bind(con)(sql)
    } catch (error: any) {
        throw new Error(`${error.message}\n${sql}`)
    }
}

export const readValuesFromParquet = async (
    variableId: OwidVariableId,
    row: VariableQueryRow
): Promise<DataRow[]> => {
    const sql = constructParquetQuery(row)

    const results = await executeSQL(sql)

    if (results.length == 0) {
        console.warn(`No values found for variable ${variableId}`)
        return results
    }

    // backported variables already have entity info
    if (results[0].entityId) {
        return results
    }

    const entityInfo = await fetchEntities(_.map(results, "entityName"))

    // merge results with entity info
    const entityInfoDict = _.keyBy(entityInfo, (e) =>
        normalizeEntityName(e.entityName)
    )
    return results.map((row: any) => {
        const normEntityName = normalizeEntityName(row.entityName)
        if (!entityInfoDict[normEntityName]) {
            throw new Error(
                `Missing entity ${row.entityName} for variable ${variableId}`
            )
        }
        row.entityId = entityInfoDict[normEntityName].entityId
        row.entityCode = entityInfoDict[normEntityName].entityCode
        return row
    })
}
