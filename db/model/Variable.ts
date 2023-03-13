import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import https from "https"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableDimensionValueFull,
    OwidVariableDimensionValuePartial,
    OwidVariableMixedData,
    OwidVariableWithSourceAndType,
    omitNullableValues,
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableId,
    OwidSource,
    retryPromise,
} from "@ourworldindata/utils"
import fetch from "node-fetch"
import pl from "nodejs-polars"

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
    dataPath?: string
    dimensions?: Dimensions
}

interface Dimensions {
    originalName: string
    originalShortName: string
    filters: {
        name: string
        value: string
    }[]
}

export type UnparsedVariableRow = Omit<VariableRow, "display"> & {
    display: string
}

export type VariableQueryRow = Readonly<
    Omit<UnparsedVariableRow, "dimensions"> & {
        display: string
        datasetName: string
        nonRedistributable: number
        sourceName: string
        sourceDescription: string
        dimensions: string
    }
>

interface S3DataRow {
    value: string
    year: number
    entityId: number
}

type DataRow = S3DataRow & { entityName: string; entityCode: string }

export type Field = keyof VariableRow

export const variableTable = "variables"

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    for (const row of plainRows) {
        row.display = row.display ? JSON.parse(row.display) : undefined
    }
    return plainRows as VariableRow[]
}

// TODO: we'll want to split this into getVariableData and getVariableMetadata once
// the data API can provide us with the type and distinct dimension values for a
// variable. Before that we need to fetch and iterate the data before we can return
// the metadata so it doesn't make much sense to split this into two functions yet.
export async function getVariableData(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
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

    // load data from data_values or S3 if `dataPath` exists
    const results = await dataAsRecords([variableId])

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

export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await readSQLasDF(
            `
        SELECT
            id as variableId,
            name as variableName,
            columnOrder
        FROM variables v
        WHERE id IN (?)`,
            [variableIds]
        )
    ).withColumn(pl.col("variableId").cast(pl.Int32))

    // Throw an error if not all variables exist
    if (variablesDF.shape.height !== variableIds.length) {
        const fetchedVariableIds = variablesDF.getColumn("variableId").toArray()
        const missingVariables = _.difference(variableIds, fetchedVariableIds)
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    // get data values as dataframe
    const dataValuesDF = await dataAsDF(
        variablesDF.getColumn("variableId").toArray()
    )

    dataValuesDF
        .join(variablesDF, { on: "variableId" })
        .sort(["columnOrder", "variableId"])
        // variables as columns
        .pivot("value", {
            index: ["entityName", "year"],
            columns: "variableName",
        })
        .sort(["entityName", "year"])
        .rename({ entityName: "Entity", year: "Year" })
        .writeCSV(stream)
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    let df = (await dataAsDF([variableId])).filter(
        pl.col("entityId").eq(entityId)
    )

    const unit = (
        await db.mysqlFirst(
            `
        SELECT unit FROM variables
        WHERE id = ?
        `,
            [variableId]
        )
    ).unit

    if (year) {
        df = df.filter(pl.col("year").eq(year))
    } else {
        df = df.sort(["year"], true).limit(1)
    }

    if (df.shape.height == 0) return

    const row = df.toRecords()[0]

    return {
        value: Number(row.value),
        year: Number(row.year),
        unit: unit,
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

export const entitiesAsDF = async (
    entityIds: number[]
): Promise<pl.DataFrame> => {
    return (
        await readSQLasDF(
            `
        SELECT
            id AS entityId,
            name AS entityName,
            code AS entityCode
        FROM entities WHERE id in (?)
        `,
            [_.uniq(entityIds)]
        )
    ).select(
        pl.col("entityId").cast(pl.Int32),
        pl.col("entityName").cast(pl.Utf8),
        pl.col("entityCode").cast(pl.Utf8)
    )
}

const _castDataDF = (df: pl.DataFrame): pl.DataFrame => {
    return df.select(
        pl.col("variableId").cast(pl.Int32),
        pl.col("entityId").cast(pl.Int32),
        pl.col("entityName").cast(pl.Utf8),
        pl.col("entityCode").cast(pl.Utf8),
        pl.col("year").cast(pl.Int32),
        pl.col("value").cast(pl.Utf8)
    )
}

const emptyDataDF = (): pl.DataFrame => {
    return _castDataDF(
        pl.DataFrame({
            variableId: [],
            entityId: [],
            entityName: [],
            entityCode: [],
            year: [],
            value: [],
        })
    )
}

export const _dataAsDFfromS3 = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    if (variableIds.length == 0) {
        return emptyDataDF()
    }

    const dfs = await Promise.all(
        variableIds.map(async (variableId) => {
            const s3values = await fetchS3Values(variableId)
            // convert values to strings before creating dataframe
            s3values.values = s3values.values.map((value) => {
                // convert all to string except nulls and undefined
                return value === null || value === undefined
                    ? value
                    : value.toString()
            })
            return createDataFrame(s3values)
                .rename({
                    values: "value",
                    entities: "entityId",
                    years: "year",
                })
                .select(
                    pl.col("entityId").cast(pl.Int32),
                    pl.col("year").cast(pl.Int32),
                    pl.col("value").cast(pl.Utf8),
                    pl.lit(variableId).cast(pl.Int32).alias("variableId")
                )
        })
    )

    const df = pl.concat(dfs)

    if (df.height == 0) {
        return emptyDataDF()
    }

    const entityDF = await entitiesAsDF(df.getColumn("entityId").toArray())

    return _castDataDF(df.join(entityDF, { on: "entityId" }))
}

const _dataAsDFfromMySQL = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    if (variableIds.length == 0) {
        return emptyDataDF()
    }

    // this function will be eventually deprecated by _dataAsDFfromS3
    const df = await readSQLasDF(
        `
    SELECT
        data_values.variableId as variableId,
        value,
        year,
        entities.id AS entityId,
        entities.name AS entityName,
        entities.code AS entityCode
    FROM data_values
    LEFT JOIN entities ON data_values.entityId = entities.id
    WHERE data_values.variableId in (?)
        `,
        [variableIds]
    )

    if (df.height == 0) {
        return emptyDataDF()
    }

    return _castDataDF(df)
}

export const dataAsDF = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    // return variables values as a DataFrame from either S3 or data_values table
    const rows = await db.queryMysql(
        `
    SELECT
        id,
        dataPath
    FROM variables
    WHERE id in (?)
    `,
        [variableIds]
    )

    // variables with dataPath are stored in S3 and variables without it
    // are stored in data_values table
    const variableIdsWithDataPath = rows
        .filter((row: any) => row.dataPath)
        .map((row: any) => row.id)

    const variableIdsWithoutDataPath = rows
        .filter((row: any) => !row.dataPath)
        .map((row: any) => row.id)

    return pl.concat([
        await _dataAsDFfromMySQL(variableIdsWithoutDataPath),
        await _dataAsDFfromS3(variableIdsWithDataPath),
    ])
}

export const getOwidVariableDataPath = async (
    variableId: OwidVariableId
): Promise<string | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT dataPath FROM variables WHERE id = ?`,
        [variableId]
    )
    return row.dataPath
}

// limit number of concurrent requests to 20 when fetching values from S3
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 20,
})

export const fetchS3Values = async (
    variableId: OwidVariableId
): Promise<OwidVariableMixedData> => {
    const dataPath = await getOwidVariableDataPath(variableId)
    if (!dataPath) {
        throw new Error(`Missing dataPath for variable ${variableId}`)
    }
    return fetchS3ValuesByPath(dataPath)
}

export const fetchS3ValuesByPath = async (
    dataPath: string
): Promise<OwidVariableMixedData> => {
    // avoid cache as Cloudflare worker caches up to 1 hour
    const resp = await retryPromise(() =>
        fetch(`${dataPath}?nocache`, { agent: httpsAgent })
    )
    if (!resp.ok) {
        throw new Error(
            `Error fetching data from S3 for ${dataPath}: ${resp.status} ${resp.statusText}`
        )
    }
    return resp.json()
}

export const dataAsRecords = async (
    variableIds: OwidVariableId[]
): Promise<DataRow[]> => {
    // return data values as a list of DataRows
    return (await dataAsDF(variableIds)).toRecords() as DataRow[]
}

export const createDataFrame = (data: unknown): pl.DataFrame => {
    if (Array.isArray(data)) {
        // transpose list of objects into object of lists because polars raises
        // an error when creating a dataframe with null values (see https://github.com/pola-rs/nodejs-polars/issues/20)
        // otherwise we'd just use pl.DataFrame(rows)
        const keys = _.keys(data[0])
        const values = _.map(keys, (key) => _.map(data, key))

        return pl.DataFrame(_.zipObject(keys, values))
    } else {
        return pl.DataFrame(data)
    }
}

export const readSQLasDF = async (
    sql: string,
    params: any[]
): Promise<pl.DataFrame> => {
    return createDataFrame(await db.queryMysql(sql, params))
}
