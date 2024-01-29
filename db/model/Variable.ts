import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableWithSourceAndDimension,
    OwidVariableId,
    retryPromise,
    GrapherInterface,
    DbRawVariable,
    VariablesTableName,
    ChartsTableName,
} from "@ourworldindata/utils"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import pl from "nodejs-polars"
import { DATA_API_URL } from "../../settings/serverSettings.js"
import { escape } from "mysql"
import { Knex } from "knex/types"
import { knexRaw, knexRawFirst } from "../db.js"

export async function getMergedGrapherConfigForVariable(
    variableId: number,
    knex: Knex<any, any[]>
): Promise<GrapherInterface | undefined> {
    const rows: Pick<
        DbRawVariable,
        "grapherConfigAdmin" | "grapherConfigETL"
    >[] = await knexRaw(
        `SELECT grapherConfigAdmin, grapherConfigETL FROM variables WHERE id = ?`,
        knex,
        [variableId]
    )
    if (!rows.length) return
    const row = rows[0]
    const grapherConfigAdmin = row.grapherConfigAdmin
        ? JSON.parse(row.grapherConfigAdmin)
        : undefined
    const grapherConfigETL = row.grapherConfigETL
        ? JSON.parse(row.grapherConfigETL)
        : undefined
    return _.merge({}, grapherConfigAdmin, grapherConfigETL)
}

// TODO: these are domain functions and should live somewhere else
export async function getVariableMetadata(
    variableId: number
): Promise<OwidVariableWithSourceAndDimension> {
    const metadataPath = getVariableMetadataRoute(DATA_API_URL, variableId)
    const metadata = await fetchS3MetadataByPath(metadataPath)
    return metadata
}

export async function getVariableData(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
    const dataPath = getVariableDataRoute(DATA_API_URL, variableId)
    const metadataPath = getVariableMetadataRoute(DATA_API_URL, variableId)

    const [data, metadata] = await Promise.all([
        fetchS3DataValuesByPath(dataPath),
        fetchS3MetadataByPath(metadataPath),
    ])

    return {
        data: data,
        metadata: metadata,
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
    stream: Writable,
    knex: Knex<any, any[]>
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await knex.raw(
            `-- sql
        SELECT
            id as variableId,
            name as variableName,
            columnOrder
        FROM ?? v
        WHERE id IN (?)`,
            [VariablesTableName, variableIds]
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
        variablesDF.getColumn("variableId").toArray(),
        knex
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

export const getDataValue = async (
    { variableId, entityId, year }: DataValueQueryArgs,
    knex: Knex<any, any[]>
): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    let df = (await dataAsDF([variableId], knex)).filter(
        pl.col("entityId").eq(entityId)
    )

    const unit = (
        await knexRawFirst<Pick<DbRawVariable, "unit">>(
            `-- sql
        SELECT unit FROM ??
        WHERE id = ?
        `,
            knex,
            [VariablesTableName, variableId]
        )
    )?.unit

    if (year) {
        df = df.filter(pl.col("year").eq(year))
    } else {
        df = df.sort(["year"], true).limit(1)
    }

    if (df.shape.height === 0) return
    if (df.shape.height > 1) {
        throw new Error(
            `More than one data value found for variable ${variableId}, entity ${entityId}, year ${year}`
        )
    }

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
    chartId: number,
    knex: Knex<any, any[]>
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.knexRawFirst<{ dimensions: string }>(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM ??
        WHERE id = ?
        `,
        knex,
        [ChartsTableName, chartId]
    )
    if (!row?.dimensions) return
    const dimensions = JSON.parse(row.dimensions)
    return dimensions.find(
        (dimension: OwidChartDimensionInterface) =>
            dimension.variableId === variableId
    )
}

export const getOwidVariableDisplayConfig = async (
    variableId: OwidVariableId,
    knex: Knex<any, any[]>
): Promise<OwidVariableDisplayConfigInterface | undefined> => {
    const row = await knexRawFirst<Pick<DbRawVariable, "display">>(
        `SELECT display FROM variables WHERE id = ?`,
        knex,
        [variableId]
    )
    if (!row?.display) return
    return JSON.parse(row.display)
}

export const entitiesAsDF = async (
    entityIds: number[],
    knex: Knex<any, any[]>
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
            [_.uniq(entityIds)],
            knex
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
    variableIds: OwidVariableId[],
    knex: Knex<any, any[]>
): Promise<pl.DataFrame> => {
    if (variableIds.length === 0) {
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

    if (df.height === 0) {
        return emptyDataDF()
    }

    const entityDF = await entitiesAsDF(
        df.getColumn("entityId").toArray(),
        knex
    )

    return _castDataDF(df.join(entityDF, { on: "entityId" }))
}

export const dataAsDF = async (
    variableIds: OwidVariableId[],
    knex: Knex<any, any[]>
): Promise<pl.DataFrame> => {
    return _dataAsDFfromS3(variableIds, knex)
}

export const fetchS3Values = async (
    variableId: OwidVariableId
): Promise<OwidVariableMixedData> => {
    return fetchS3DataValuesByPath(
        getVariableDataRoute(DATA_API_URL, variableId)
    )
}

export const fetchS3DataValuesByPath = async (
    dataPath: string
): Promise<OwidVariableMixedData> => {
    const resp = await retryPromise(
        () => fetch(dataPath, { keepalive: true }),
        {
            maxRetries: 5,
            exponentialBackoff: true,
            initialDelay: 1000,
        }
    )
    if (!resp.ok) {
        throw new Error(
            `Error fetching data from S3 for ${dataPath}: ${resp.status} ${
                resp.statusText
            } ${await resp.text()}`
        )
    }
    return resp.json()
}

export const fetchS3MetadataByPath = async (
    metadataPath: string
): Promise<OwidVariableWithSourceAndDimension> => {
    const resp = await retryPromise(
        () => fetch(metadataPath, { keepalive: true }),
        {
            maxRetries: 5,
            exponentialBackoff: true,
            initialDelay: 1000,
        }
    )
    if (!resp.ok) {
        throw new Error(
            `Error fetching metadata from S3 for ${metadataPath}: ${
                resp.status
            } ${resp.statusText} ${await resp.text()}`
        )
    }
    return resp.json()
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
    params: any[],
    knex: Knex<any, any[]>
): Promise<pl.DataFrame> => {
    return createDataFrame(await knexRaw(sql, knex, params))
}

/**
 * Perform regex search over the variables table.
 */
export const searchVariables = async (
    query: string,
    limit: number,
    knex: Knex<any, any>
): Promise<VariablesSearchResult> => {
    const whereClauses = buildWhereClauses(query)

    const fromWhere = `
        FROM variables AS v
        LEFT JOIN active_datasets d ON d.id=v.datasetId
        LEFT JOIN users u ON u.id=d.dataEditedByUserId
        ${whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : ""}
    `
    const sqlCount = `
        SELECT COUNT(*) count
        ${fromWhere}
    `

    const sqlResults = `
        SELECT
            v.id,
            v.name,
            catalogPath,
            d.id AS datasetId,
            d.name AS datasetName,
            d.isPrivate AS isPrivate,
            d.nonRedistributable AS nonRedistributable,
            d.dataEditedAt AS uploadedAt,
            u.fullName AS uploadedBy
        ${fromWhere}
        ORDER BY d.dataEditedAt DESC
        LIMIT ${escape(limit)}
    `
    const rows = await queryRegexSafe(sqlResults, knex)

    const numTotalRows = await queryRegexCount(sqlCount, knex)

    rows.forEach((row: any) => {
        if (row.catalogPath) {
            const [path, shortName] = row.catalogPath.split("#")
            const [namespace, version, dataset, table] = path
                .substring("grapher/".length)
                .split("/")

            row.namespace = namespace
            row.version = version
            row.dataset = dataset
            row.table = table
            row.shortName = shortName
        }
    })

    return { variables: rows, numTotalRows: numTotalRows }
}

const buildWhereClauses = (query: string): string[] => {
    const whereClauses: string[] = []

    if (!query) {
        return whereClauses
    }

    for (let part of query.split(" ")) {
        part = part.trim()
        let not = " "
        if (part.startsWith("-")) {
            part = part.substring(1)
            not = "NOT "
        }
        if (part.startsWith("name:")) {
            const q = part.substring("name:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.name, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("path:")) {
            const q = part.substring("path:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.catalogPath, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("namespace:")) {
            const q = part.substring("namespace:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.name, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("version:")) {
            const q = part.substring("version:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.version, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("dataset:")) {
            const q = part.substring("dataset:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.shortName, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("table:")) {
            const q = part.substring("table:".length)
            // NOTE: we don't have the table name in any db field, it's horrible to query
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 5), '/', -1), ${escape(
                        q
                    )}, 'i')`
                )
        } else if (part.startsWith("short:")) {
            const q = part.substring("short:".length)
            q &&
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.shortName, ${escape(q)}, 'i')`
                )
        } else if (part.startsWith("before:")) {
            const q = part.substring("before:".length)
            q &&
                whereClauses.push(
                    `${not} IF(d.version is not null, d.version < ${escape(
                        q
                    )}, cast(date(d.createdAt) as char) < ${escape(q)})`
                )
        } else if (part.startsWith("after:")) {
            const q = part.substring("after:".length)
            q &&
                whereClauses.push(
                    `${not} (IF (d.version is not null, d.version = "latest" OR d.version > ${escape(
                        q
                    )}, cast(date(d.createdAt) as char) > ${escape(q)}))`
                )
        } else if (part === "is:published") {
            whereClauses.push(`${not} (NOT d.isPrivate)`)
        } else if (part === "is:private") {
            whereClauses.push(`${not} d.isPrivate`)
        } else {
            part &&
                whereClauses.push(
                    `${not} (REGEXP_LIKE(v.name, ${escape(
                        part
                    )}, 'i') OR REGEXP_LIKE(v.catalogPath, ${escape(
                        part
                    )}, 'i'))`
                )
        }
    }
    return whereClauses
}

/**
 * Run a MySQL query that's robust to regular expression failures, simply
 * returning an empty result if the query fails.
 *
 * This is useful if the regex is user-supplied and we want them to be able
 * to construct it incrementally.
 */
const queryRegexSafe = async (
    query: string,
    knex: Knex<any, any>
): Promise<any> => {
    // catch regular expression failures in MySQL and return empty result
    return await knexRaw(query, knex).catch((err) => {
        if (err.message.includes("regular expression")) {
            return []
        }
        throw err
    })
}

const queryRegexCount = async (
    query: string,
    knex: Knex<any, any>
): Promise<number> => {
    const results = await queryRegexSafe(query, knex)
    if (!results.length) {
        return 0
    }
    return results[0].count
}

export interface VariablesSearchResult {
    variables: VariableResultView[]
    numTotalRows: number
}

export interface VariableResultView {
    variableId: number
    variableName: string
    datasetId: number
    datasetName: string
    isPrivate: boolean
    nonRedistributable: boolean
    uploadedAt: string
    uploadedBy: string
    namespace: string
    version: string
    dataset: string
    table: string
    shortName: string
}
