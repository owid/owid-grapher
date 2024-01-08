import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import { retryPromise, isEmpty } from "@ourworldindata/utils"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import pl from "nodejs-polars"
import { DATA_API_URL } from "../../settings/serverSettings.js"
import { escape } from "mysql"
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
    ChartTypeName,
    DimensionProperty,
    OwidLicense,
    GrapherInterface,
    OwidProcessingLevel,
    DbRawVariable,
    VariablesTableName,
    ChartsTableName,
} from "@ourworldindata/types"

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
    schemaVersion?: number
    processingLevel?: OwidProcessingLevel
    titlePublic?: string
    titleVariant?: string
    attributionShort?: string
    citationInline?: string
    descriptionShort?: string
    descriptionFromProducer?: string
    descriptionKey?: string[] // this is json in the db but by convention it is always a list of strings
    descriptionProcessing?: string
    licenses?: OwidLicense[]
    grapherConfigAdmin?: GrapherInterface
    grapherConfigETL?: GrapherInterface
    license?: OwidLicense
    updatePeriodDays?: number
    datasetVersion?: string
    version?: string

    // missing here but existsin the DB:
    // originalMetadata
}

interface Dimensions {
    originalName: string
    originalShortName: string
    filters: {
        name: string
        value: string
    }[]
}

export type UnparsedVariableRow = Omit<
    VariableRow,
    | "display"
    | "descriptionKey"
    | "grapherConfigAdmin"
    | "grapherConfigETL"
    | "license"
    | "licenses"
> & {
    display: string
    descriptionKey?: string
    grapherConfigAdmin?: string
    grapherConfigETL?: string
    license?: string
    licenses?: string
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

export type Field = keyof VariableRow

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    const parsedRows: VariableRow[] = []
    for (const plainRow of plainRows) {
        const row = {
            ...plainRow,
            display: plainRow.display
                ? JSON.parse(plainRow.display)
                : undefined,
            descriptionKey: plainRow.descriptionKey
                ? JSON.parse(plainRow.descriptionKey)
                : [],
            grapherConfigAdmin: plainRow.grapherConfigAdmin
                ? JSON.parse(plainRow.grapherConfigAdmin)
                : [],
            grapherConfigETL: plainRow.grapherConfigETL
                ? JSON.parse(plainRow.grapherConfigETL)
                : [],
            licenses: plainRow.licenses ? JSON.parse(plainRow.licenses) : [],
            license: plainRow.license ? JSON.parse(plainRow.license) : [],
        }
        parsedRows.push(row)
    }
    return parsedRows
}

export async function getMergedGrapherConfigForVariable(
    variableId: number
): Promise<GrapherInterface | undefined> {
    const rows: Pick<
        DbRawVariable,
        "grapherConfigAdmin" | "grapherConfigETL"
    >[] = await db
        .knexInstance()
        .raw(
            `SELECT grapherConfigAdmin, grapherConfigETL FROM variables WHERE id = ?`,
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
    stream: Writable
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await db.knexInstance().raw(
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
        await db.knexInstance().raw(
            `-- sql
        SELECT unit FROM ??
        WHERE id = ?
        `,
            [VariablesTableName, variableId]
        )
    ).unit

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
    chartId: number
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.knexInstance().raw(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM ??
        WHERE id = ?
        `,
        [ChartsTableName, chartId]
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

    const entityDF = await entitiesAsDF(df.getColumn("entityId").toArray())

    return _castDataDF(df.join(entityDF, { on: "entityId" }))
}

export const dataAsDF = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    return _dataAsDFfromS3(variableIds)
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
        () =>
            fetch(dataPath, { keepalive: true }).then((response) => {
                if (!response.ok) {
                    // Trigger retry
                    throw new Error(
                        `Error fetching data from S3 for ${dataPath}: ${response.status} ${response.statusText}`
                    )
                }
                return response
            }),
        {
            maxRetries: 7,
            exponentialBackoff: true,
            initialDelay: 1000,
        }
    )
    try {
        return await resp.json()
    } catch (error: any) {
        throw new Error(
            `Error parsing JSON from response for ${dataPath}: ${
                error.message
            }\nStatus Code: ${resp.status} ${
                resp.statusText
            }\nResponse Body: ${await resp.text()}`
        )
    }
}

export const fetchS3MetadataByPath = async (
    metadataPath: string
): Promise<OwidVariableWithSourceAndDimension> => {
    const resp = await retryPromise(
        () =>
            fetch(metadataPath, { keepalive: true }).then((response) => {
                if (!response.ok) {
                    // Trigger retry
                    throw new Error(
                        `Error fetching metadata from S3 for ${metadataPath}: ${response.status} ${response.statusText}`
                    )
                }
                return response
            }),
        {
            maxRetries: 7,
            exponentialBackoff: true,
            initialDelay: 1000,
        }
    )
    try {
        return await resp.json()
    } catch (error: any) {
        throw new Error(
            `Error parsing JSON from response for ${metadataPath}: ${
                error.message
            }\nStatus Code: ${resp.status} ${
                resp.statusText
            }\nResponse Body: ${await resp.text()}`
        )
    }
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

export async function getVariableOfDatapageIfApplicable(
    grapher: GrapherInterface
): Promise<
    | {
          id: number
          metadata: OwidVariableWithSourceAndDimension
      }
    | undefined
> {
    // If we have a single Y variable and that one has a schema version >= 2,
    // meaning it has the metadata to render a datapage, AND if the metadata includes
    // text for at least one of the description* fields or titlePublic, then we show the datapage
    // based on this information.
    const yVariableIds = grapher
        .dimensions!.filter((d) => d.property === DimensionProperty.y)
        .map((d) => d.variableId)
    const xVariableIds = grapher
        .dimensions!.filter((d) => d.property === DimensionProperty.x)
        .map((d) => d.variableId)
    // Make a data page for single indicator indicator charts.
    // For scatter plots we want to only show a data page if it has no X variable mapped, which
    // is a special case where time is the X axis. Marimekko charts are the other chart that uses
    // the X dimension but there we usually map population on X which should not prevent us from
    // showing a data page.
    if (
        yVariableIds.length === 1 &&
        (grapher.type !== ChartTypeName.ScatterPlot ||
            xVariableIds.length === 0)
    ) {
        const variableId = yVariableIds[0]
        const variableMetadata = await getVariableMetadata(variableId)

        if (
            variableMetadata.schemaVersion !== undefined &&
            variableMetadata.schemaVersion >= 2 &&
            (!isEmpty(variableMetadata.descriptionShort) ||
                !isEmpty(variableMetadata.descriptionProcessing) ||
                !isEmpty(variableMetadata.descriptionKey) ||
                !isEmpty(variableMetadata.descriptionFromProducer) ||
                !isEmpty(variableMetadata.presentation?.titlePublic))
        ) {
            return { id: variableId, metadata: variableMetadata }
        }
    }
    return undefined
}

/**
 * Perform regex search over the variables table.
 */
export const searchVariables = async (
    query: string,
    limit: number
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
    const rows = await queryRegexSafe(sqlResults)

    const numTotalRows = await queryRegexCount(sqlCount)

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
const queryRegexSafe = async (query: string): Promise<any> => {
    // catch regular expression failures in MySQL and return empty result
    return await db
        .knexInstance()
        .raw(query)
        .catch((err) => {
            if (err.message.includes("regular expression")) {
                return []
            }
            throw err
        })
}

const queryRegexCount = async (query: string): Promise<number> => {
    const results = await queryRegexSafe(query)
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
