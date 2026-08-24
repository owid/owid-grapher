import * as _ from "lodash-es"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    retryPromise,
    omitUndefinedValues,
    mergeGrapherConfigs,
    getOwidDataFetchUserAgent,
} from "@ourworldindata/utils"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import pl from "nodejs-polars"
import { DATA_API_URL } from "../../settings/serverSettings.js"
import { deleteGrapherConfigFromR2ByUuid } from "../../serverUtils/r2/chartConfigR2Helpers.js"
import pMap from "p-map"
import { escape } from "mysql2"
import {
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    OwidVariableId,
    DimensionProperty,
    GrapherInterface,
    DbRawVariable,
    VariablesTableName,
    DatasetsTableName,
    DbRawChartConfig,
    DbPlainDatapage,
    parseChartConfig,
    DbEnrichedChartConfig,
    DbEnrichedVariable,
    DbPlainChart,
    DbPlainMultiDimXChartConfig,
    MultiDimXChartConfigsTableName,
    Distribution,
    DatasetOwners,
    DbPlainDataset,
    normalizeDescriptionKey,
} from "@ourworldindata/types"
import { knexRaw, knexRawFirst } from "../db.js"
import { insertChartConfig, updateChartConfig } from "./ChartConfigs.js"
import {
    buildMdimViewPatchConfig,
    getMultiDimDataPageById,
} from "./MultiDimDataPage.js"

interface IndicatorChartConfigRecord {
    variableId: DbEnrichedVariable["id"]
    configId?: DbEnrichedChartConfig["id"]
}

export async function getIndicatorChartConfigRecord(
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<IndicatorChartConfigRecord | undefined> {
    const variable = await knexRawFirst<
        Pick<DbRawVariable, "id" | "patchConfigIdETL">
    >(
        knex,
        `-- sql
            SELECT v.id, v.patchConfigIdETL
            FROM variables v
            WHERE v.id = ?
        `,
        [variableId]
    )

    if (!variable) return

    return omitUndefinedValues({
        variableId: variable.id,
        configId: variable.patchConfigIdETL,
    })
}

export async function getIndicatorChartConfig(
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<GrapherInterface | undefined> {
    const row = await knexRawFirst<{ config: string }>(
        knex,
        `-- sql
            SELECT cc.config
            FROM variables v
            JOIN chart_configs cc ON cc.id = v.patchConfigIdETL
            WHERE v.id = ?
        `,
        [variableId]
    )

    return row ? parseChartConfig(row.config) : undefined
}

export async function getIndicatorChartConfigs(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<Map<number, GrapherInterface>> {
    if (!variableIds.length) return new Map()

    const rows = await knexRaw<{ variableId: number; config: string }>(
        knex,
        `-- sql
            SELECT v.id AS variableId, cc.config AS config
            FROM variables v
            JOIN chart_configs cc ON cc.id = v.patchConfigIdETL
            WHERE v.id IN (?)
        `,
        [variableIds]
    )

    return new Map(
        rows.map((row) => [row.variableId, parseChartConfig(row.config)])
    )
}

export async function insertIndicatorChartConfig(
    knex: db.KnexReadWriteTransaction,
    {
        variableId,
        config,
        now,
    }: {
        variableId: number
        config: GrapherInterface
        now: Date
    }
): Promise<void> {
    const configId = await insertChartConfig(knex, {
        config,
        createdAt: now,
        updatedAt: now,
    })

    await db.knexRaw(
        knex,
        `-- sql
            UPDATE variables
            SET patchConfigIdETL = ?
            WHERE id = ?
        `,
        [configId, variableId]
    )
}

function makeConfigValidForIndicator({
    config,
    variableId,
}: {
    config: GrapherInterface
    variableId: number
}): GrapherInterface {
    const updatedConfig = { ...config }

    // validate the given y-dimensions
    const defaultDimension = { property: DimensionProperty.y, variableId }
    const [yDimensions, otherDimensions] = _.partition(
        updatedConfig.dimensions ?? [],
        (dimension) => dimension.property === DimensionProperty.y
    )
    if (yDimensions.length === 0) {
        updatedConfig.dimensions = [defaultDimension, ...otherDimensions]
    } else if (yDimensions.length >= 0) {
        const givenDimension = yDimensions.find(
            (dimension) => dimension.variableId === variableId
        )
        updatedConfig.dimensions = [
            givenDimension ?? defaultDimension,
            ...otherDimensions,
        ]
    }

    return updatedConfig
}

export interface UpdatedChartInheritanceRecord {
    chartId: number
    chartConfigId: string
    patchConfig: GrapherInterface
    isPublished: boolean
}

interface ChartInheritanceRecordWithEtlConfig extends UpdatedChartInheritanceRecord {
    patchConfigETL: GrapherInterface | null
}

async function findAllChartsThatInheritFromIndicator(
    trx: db.KnexReadonlyTransaction,
    variableId: number
): Promise<ChartInheritanceRecordWithEtlConfig[]> {
    const charts = await db.knexRaw<{
        chartId: DbPlainChart["id"]
        chartConfigId: DbRawChartConfig["id"]
        patchConfig: DbRawChartConfig["config"]
        patchConfigETL: DbRawChartConfig["config"] | null
        isPublished: number
    }>(
        trx,
        `-- sql
            SELECT
                c.id as chartId,
                cc.id as chartConfigId,
                cc_patch.config as patchConfig,
                cc_etl.config as patchConfigETL,
                cc.config ->> "$.isPublished" = "true" as isPublished
            FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                JOIN chart_configs cc_patch ON cc_patch.id = c.patchConfigId
                LEFT JOIN chart_configs cc_etl ON cc_etl.id = c.patchConfigIdETL
                JOIN charts_x_parents cxp ON c.id = cxp.chartId
            WHERE
                c.isInheritanceEnabled IS TRUE
                AND cxp.variableId = ?
        `,
        [variableId]
    )
    return charts.map((chart) => ({
        chartId: chart.chartId,
        chartConfigId: chart.chartConfigId,
        patchConfig: parseChartConfig(chart.patchConfig),
        patchConfigETL: chart.patchConfigETL
            ? parseChartConfig(chart.patchConfigETL)
            : null,
        isPublished: Boolean(chart.isPublished),
    }))
}

export async function updateAllChartsThatInheritFromIndicator(
    trx: db.KnexReadWriteTransaction,
    variableId: number,
    patchConfigETL: GrapherInterface | undefined,
    updatedAt: Date
): Promise<UpdatedChartInheritanceRecord[]> {
    const inheritingCharts = await findAllChartsThatInheritFromIndicator(
        trx,
        variableId
    )

    for (const chart of inheritingCharts) {
        const fullConfig = mergeGrapherConfigs(
            patchConfigETL ?? {},
            chart.patchConfigETL ?? {},
            chart.patchConfig
        )
        await db.knexRaw(
            trx,
            `-- sql
                UPDATE chart_configs cc
                JOIN charts c ON c.configId = cc.id
                SET
                    cc.config = ?,
                    cc.updatedAt = ?,
                    c.updatedAt = ?
                WHERE cc.id = ?
            `,
            [
                JSON.stringify(fullConfig),
                updatedAt,
                updatedAt,
                chart.chartConfigId,
            ]
        )
    }

    // strip the internal patchConfigETL field before returning to callers
    return inheritingCharts.map(
        ({ chartId, chartConfigId, patchConfig, isPublished }) => ({
            chartId,
            chartConfigId,
            patchConfig,
            isPublished,
        })
    )
}

interface MultiDimViewInheritanceRecord {
    chartConfigId: string
    patchConfig: GrapherInterface
    isPublished: boolean
}

async function findAllMultiDimViewsThatInheritFromIndicator(
    trx: db.KnexReadonlyTransaction,
    variableId: number
): Promise<MultiDimViewInheritanceRecord[]> {
    const rows = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    )
        .select("multiDimId", "chartConfigId")
        .where({ variableId })
    const multiDimIds = _.uniq(rows.map((row) => row.multiDimId))
    const chartConfigIds = new Set(rows.map((row) => row.chartConfigId))

    const inheritingViews = []
    for (const multiDimId of multiDimIds) {
        const multiDim = await getMultiDimDataPageById(trx, multiDimId)
        if (!multiDim) continue
        const isPublished = Boolean(multiDim.published)
        for (const view of multiDim.config.views) {
            if (!chartConfigIds.has(view.fullConfigId)) continue
            inheritingViews.push({
                chartConfigId: view.fullConfigId,
                isPublished,
                patchConfig: buildMdimViewPatchConfig(
                    multiDim.config,
                    view,
                    isPublished
                ),
            })
        }
    }
    return inheritingViews
}

export async function updateAllMultiDimViewsThatInheritFromIndicator(
    trx: db.KnexReadWriteTransaction,
    variableId: number,
    patchConfigETL: GrapherInterface | undefined,
    updatedAt: Date
): Promise<MultiDimViewInheritanceRecord[]> {
    const inheritingViews = await findAllMultiDimViewsThatInheritFromIndicator(
        trx,
        variableId
    )

    for (const view of inheritingViews) {
        const fullConfig = mergeGrapherConfigs(
            patchConfigETL ?? {},
            view.patchConfig
        )
        await updateChartConfig(trx, {
            configId: view.chartConfigId,
            config: fullConfig,
            updatedAt,
        })
    }

    return inheritingViews
}

export async function updateIndicatorChartConfig(
    trx: db.KnexReadWriteTransaction,
    indicator: IndicatorChartConfigRecord,
    config: GrapherInterface
): Promise<{
    savedPatch: GrapherInterface
    updatedCharts: UpdatedChartInheritanceRecord[]
    updatedMultiDimViews: { chartConfigId: string; isPublished: boolean }[]
}> {
    const { variableId } = indicator

    const configETL = makeConfigValidForIndicator({
        config,
        variableId,
    })

    // Set the updatedAt manually instead of letting the DB do it so it is the
    // same across different tables. The inconsistency caused issues in the
    // past in chart-sync.
    const now = new Date()

    if (indicator.configId) {
        await updateChartConfig(trx, {
            configId: indicator.configId,
            config: configETL,
            updatedAt: now,
        })
    } else {
        await insertIndicatorChartConfig(trx, {
            variableId,
            config: configETL,
            now,
        })
    }

    const updatedCharts = await updateAllChartsThatInheritFromIndicator(
        trx,
        variableId,
        configETL,
        now
    )
    const updatedMultiDimViews =
        await updateAllMultiDimViewsThatInheritFromIndicator(
            trx,
            variableId,
            configETL,
            now
        )

    return {
        savedPatch: configETL,
        updatedCharts,
        updatedMultiDimViews,
    }
}

/**
 * Returns the indicator ID to use for datapage metadata if the grapher is
 * eligible for a datapage, otherwise undefined.
 */
export async function getDatapageIndicatorId(
    knex: db.KnexReadonlyTransaction,
    grapher: GrapherInterface,
    options?: {
        forceDatapage?: boolean
    }
): Promise<number | undefined> {
    // If a data page is forced, simply return the first y-dimension
    if (options?.forceDatapage) {
        const yVariableIds = grapher
            .dimensions!.filter((d) => d.property === DimensionProperty.y)
            .map((d) => d.variableId)
        return yVariableIds[0]
    }

    if (!grapher.id) {
        console.warn(
            "Grapher must have an ID to check for datapage eligibility"
        )
        return undefined
    }

    const row = await knexRawFirst<DbPlainDatapage>(
        knex,
        `-- sql
            SELECT variableId
            FROM datapages
            WHERE chartId = ?
        `,
        [grapher.id]
    )

    return row?.variableId
}

// TODO: these are domain functions and should live somewhere else
export async function getVariableMetadata(
    variableId: number,
    { noCache }: { noCache?: boolean } = {}
): Promise<OwidVariableWithSourceAndDimension> {
    const metadataPath = getVariableMetadataRoute(DATA_API_URL, variableId, {
        noCache,
    })
    const metadata = await fetchS3MetadataByPath(metadataPath)
    return metadata
}

export async function getVariableData(
    variableId: number,
    { noCache }: { noCache?: boolean } = {}
): Promise<OwidVariableDataMetadataDimensions> {
    const dataPath = getVariableDataRoute(DATA_API_URL, variableId, { noCache })
    const metadataPath = getVariableMetadataRoute(DATA_API_URL, variableId, {
        noCache,
    })

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
    const promises = variableIds.map(async (id) => await getVariableData(id))
    const allVariablesDataAndMetadata = await Promise.all(promises)
    const allVariablesDataAndMetadataMap = new Map(
        allVariablesDataAndMetadata.map((item) => [item.metadata.id, item])
    )
    return allVariablesDataAndMetadataMap
}

export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable,
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await readSQLasDF(
            `-- sql
        SELECT
            id as variableId,
            name as variableName,
            columnOrder
        FROM variables v
        WHERE id IN (?)`,
            [variableIds],
            knex
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

export const entitiesAsDF = async (
    entityIds: number[],
    knex: db.KnexReadonlyTransaction
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
    knex: db.KnexReadonlyTransaction
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
    knex: db.KnexReadonlyTransaction
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

const createS3JsonParseError = (
    error: any,
    path: string,
    resp: Response
): Error => {
    return new Error(
        `Error parsing JSON from response for ${path}: ${
            error.message
        }\nStatus Code: ${resp.status} ${resp.statusText}\nRe-run the grapher step in ETL with FORCE_UPLOAD=1.`
    )
}

// Tag our server-side data API fetches with a descriptive User-Agent; see
// getOwidDataFetchUserAgent. This code only ever runs in Node (the baker and
// admin), so a value is always present, but we guard for undefined anyway.
const dataFetchHeaders: HeadersInit | undefined = (() => {
    const userAgent = getOwidDataFetchUserAgent()
    return userAgent ? { "User-Agent": userAgent } : undefined
})()

export const fetchS3DataValuesByPath = async (
    dataPath: string
): Promise<OwidVariableMixedData> => {
    const resp = await retryPromise(
        () =>
            fetch(dataPath, {
                keepalive: true,
                headers: dataFetchHeaders,
            }).then((response) => {
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
        throw createS3JsonParseError(error, dataPath, resp)
    }
}

export const fetchS3MetadataByPath = async (
    metadataPath: string
): Promise<OwidVariableWithSourceAndDimension> => {
    const resp = await retryPromise(
        () =>
            fetch(metadataPath, {
                keepalive: true,
                headers: dataFetchHeaders,
            }).then((response) => {
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
        const metadata = await resp.json()
        // Metadata files written before the string migration hold arrays.
        metadata.descriptionKey = normalizeDescriptionKey(
            metadata.descriptionKey
        )
        return metadata
    } catch (error: any) {
        throw createS3JsonParseError(error, metadataPath, resp)
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
    params: any[],
    knex: db.KnexReadonlyTransaction
): Promise<pl.DataFrame> => {
    return createDataFrame(await db.knexRaw(knex, sql, params))
}

export async function getVariableOfDatapageIfApplicable(
    knex: db.KnexReadonlyTransaction,
    grapher: GrapherInterface,
    options?: { forceDatapage?: boolean }
): Promise<
    { id: number; metadata: OwidVariableWithSourceAndDimension } | undefined
> {
    const indicatorId = await getDatapageIndicatorId(knex, grapher, options)
    if (indicatorId) {
        const fullMetadata = await getVariableMetadata(indicatorId, {
            noCache: true,
        })
        return { id: indicatorId, metadata: fullMetadata }
    }
    return undefined
}

export async function getVariableDistribution(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<Distribution> {
    if (!variableIds.length) return { allowed: true }

    const result = await knexRawFirst<{
        hasNonRedistributableVariable: number
    }>(
        knex,
        `-- sql
            SELECT MAX(COALESCE(d.nonRedistributable, 0)) AS hasNonRedistributableVariable
            FROM variables v
            LEFT JOIN active_datasets d ON d.id = v.datasetId
            WHERE v.id IN (?)
        `,
        [variableIds]
    )

    if (!result?.hasNonRedistributableVariable) return { allowed: true }

    const sourceLinksRows = await knexRaw<{ sourceLink: string | null }>(
        knex,
        `-- sql
            SELECT DISTINCT COALESCE(o.urlMain, s.description->>'$.link') AS sourceLink
            FROM variables v
            LEFT JOIN active_datasets d ON d.id = v.datasetId
            LEFT JOIN origins_variables ov ON ov.variableId = v.id
            LEFT JOIN origins o ON o.id = ov.originId
            LEFT JOIN sources s ON s.id = v.sourceId
            WHERE v.id IN (?)
              AND COALESCE(d.nonRedistributable, 0) = 1
              AND COALESCE(o.urlMain, s.description->>'$.link') IS NOT NULL
        `,
        [variableIds]
    )

    return {
        allowed: false,
        sourceLinks: sourceLinksRows
            .map((row) => row.sourceLink)
            .filter((link): link is string => !!link),
    }
}

export async function getOwnersForVariables(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<DatasetOwners[]> {
    if (!variableIds.length) return []

    const rows = await knexRaw<Pick<DbPlainDataset, "id" | "name" | "owners">>(
        knex,
        `-- sql
            SELECT DISTINCT
                d.id AS id,
                d.name AS name,
                d.owners AS owners
            FROM variables v
            JOIN active_datasets d ON d.id = v.datasetId
            WHERE v.id IN (?)
              AND d.owners IS NOT NULL
        `,
        [variableIds]
    )

    return rows
        .map((row) => ({
            datasetId: row.id,
            datasetName: row.name,
            owners: row.owners ? (JSON.parse(row.owners) as string[]) : [],
        }))
        .filter((dataset) => dataset.owners.length > 0)
}

/**
 * Perform regex search over the variables table.
 */
export const searchVariables = async (
    query: string,
    limit: number,
    knex: db.KnexReadonlyTransaction
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
            v.catalogPath AS catalogPath,
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
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.name, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("path:")) {
            const q = part.substring("path:".length)
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.catalogPath, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("namespace:")) {
            const q = part.substring("namespace:".length)
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.name, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("version:")) {
            const q = part.substring("version:".length)
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.version, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("dataset:")) {
            const q = part.substring("dataset:".length)
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(d.shortName, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("table:")) {
            const q = part.substring("table:".length)
            // NOTE: we don't have the table name in any db field, it's horrible to query
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 5), '/', -1), ${escape(
                        q
                    )}, 'i')`
                )
            }
        } else if (part.startsWith("short:")) {
            const q = part.substring("short:".length)
            if (q) {
                whereClauses.push(
                    `${not} REGEXP_LIKE(v.shortName, ${escape(q)}, 'i')`
                )
            }
        } else if (part.startsWith("before:")) {
            const q = part.substring("before:".length)
            if (q) {
                whereClauses.push(
                    `${not} IF(d.version is not null, d.version < ${escape(
                        q
                    )}, cast(date(d.createdAt) as char) < ${escape(q)})`
                )
            }
        } else if (part.startsWith("after:")) {
            const q = part.substring("after:".length)
            if (q) {
                whereClauses.push(
                    `${not} (IF (d.version is not null, d.version = "latest" OR d.version > ${escape(
                        q
                    )}, cast(date(d.createdAt) as char) > ${escape(q)}))`
                )
            }
        } else if (part === "is:published") {
            whereClauses.push(`${not} (NOT d.isPrivate)`)
        } else if (part === "is:private") {
            whereClauses.push(`${not} d.isPrivate`)
        } else {
            if (part) {
                whereClauses.push(
                    `${not} (REGEXP_LIKE(v.name, ${escape(
                        part
                    )}, 'i') OR REGEXP_LIKE(v.catalogPath, ${escape(
                        part
                    )}, 'i'))`
                )
            }
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
    knex: db.KnexReadonlyTransaction
): Promise<any> => {
    // catch regular expression failures in MySQL and return empty result
    return await knexRaw(knex, query).catch((err) => {
        if (err.message.includes("regular expression")) {
            return []
        }
        throw err
    })
}

const queryRegexCount = async (
    query: string,
    knex: db.KnexReadonlyTransaction
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

export const getIndicatorIdsByCatalogPath = async (
    catalogPaths: string[],
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, number | null>> => {
    const rows: Pick<DbRawVariable, "id" | "catalogPath">[] = await knex
        .select("id", "catalogPath")
        .from(VariablesTableName)
        .whereIn("catalogPath", catalogPaths)

    const rowsByPath = _.keyBy(rows, "catalogPath")

    // `rowsByPath` only contains the rows that were found, so we need to create
    // a map where all keys from `catalogPaths` are present, and set the value to
    // undefined if no row was found for that catalog path.
    return new Map(
        // Sort for good measure and determinism.
        catalogPaths.sort().map((path) => [path, rowsByPath[path]?.id ?? null])
    )
}

/**
 * Resolve the latest variable id for each given catalog path.
 *
 * Catalog paths follow the structure
 * `channel/namespace/version/dataset/table#column`, where the version (the 3rd
 * path segment) is an ISO date such as `2024-07-15`. This helper takes a
 * version-agnostic catalog path (with the version segment replaced by 'latest',
 * e.g. `grapher/worldbank_wdi/latest/wdi/wdi#ny_gdp_pcap_pp_kd`) and returns
 * the id of the most recent version
 */
export const getLatestIndicatorIdsByCatalogPath = async (
    catalogPaths: string[],
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, number | null>> => {
    const VERSION_SEGMENT_INDEX = 2 // The version is the 3rd path segment
    const getVersion = (catalogPath: string | null): string =>
        catalogPath?.split("/")[VERSION_SEGMENT_INDEX] ?? ""

    // Escape the LIKE wildcards `%` and `_`
    const escapeLike = (segment: string): string =>
        segment.replace(/[\\%_]/g, "\\$&")

    const entries = await Promise.all(
        catalogPaths.map(async (catalogPath) => {
            // Replace the version segment with a SQL wildcard so we match every
            // published version of the indicator, and escape the rest.
            const likePattern = catalogPath
                .split("/")
                .map((segment, index) =>
                    index === VERSION_SEGMENT_INDEX ? "%" : escapeLike(segment)
                )
                .join("/")

            const rows: Pick<DbRawVariable, "id" | "catalogPath">[] =
                await knex(VariablesTableName)
                    .join(
                        DatasetsTableName,
                        `${VariablesTableName}.datasetId`,
                        `${DatasetsTableName}.id`
                    )
                    .where(
                        `${VariablesTableName}.catalogPath`,
                        "like",
                        likePattern
                    )
                    .where(`${DatasetsTableName}.isArchived`, 0) // Ignore archived datasets
                    .select(
                        `${VariablesTableName}.id`,
                        `${VariablesTableName}.catalogPath`
                    )

            // Pick the most recent version
            const latest = _.maxBy(rows, (row) => getVersion(row.catalogPath))

            return [catalogPath, latest?.id ?? null] as const
        })
    )

    return new Map(entries)
}

/**
 * Tables holding one or more rows per indicator that have to be cleared before
 * the indicator row itself can be deleted
 */
const INDICATOR_CHILD_TABLES = [
    "origins_variables",
    "tags_variables_topic_tags",
    "posts_gdocs_variables_faqs",
    "explorer_variables",
    "multi_dim_x_chart_configs",
] as const

/** One indicator a chart, an explorer or a multi-dim view still uses, and what uses it. */
export interface BlockedIndicator {
    variableId: number
    variableName: string | null
    usedBy: "chart" | "explorer" | "multiDimView"
    /** Chart slug or id, explorer slug, or `catalogPath#viewId` */
    ref: string | null
}

export interface DeleteIndicatorsResult {
    deleted: number[]
    blocked: BlockedIndicator[]
}

/**
 * Delete indicators, refusing any a chart, an explorer or a multi-dim view
 * still uses.
 *
 * An indicator in use is never deleted, but it also doesn't result in a failed
 * transaction: the caller can report the blocked indicators to the user and
 * let them decide what to do.
 */
export async function deleteIndicators(
    trx: db.KnexReadWriteTransaction,
    indicatorIds: number[]
): Promise<DeleteIndicatorsResult> {
    if (indicatorIds.length === 0) return { deleted: [], blocked: [] }

    const existingIndicators = await trx<DbRawVariable>(VariablesTableName)
        .whereIn("id", indicatorIds)
        .select("id", "sourceId", "patchConfigIdETL")

    if (existingIndicators.length === 0) return { deleted: [], blocked: [] }
    const existingIndicatorIds = existingIndicators.map(
        (indicator) => indicator.id
    )

    // Check if any of the indicators are still in use by a chart, an explorer
    // or a multi-dim view
    const blocked = await db.knexRaw<BlockedIndicator>(
        trx,
        `-- sql
        SELECT DISTINCT
            cd.variableId,
            v.name AS variableName,
            'chart' AS usedBy,
            -- Fall back to the chart ID if the slug is missing
            COALESCE(cc.slug, c.id) AS ref
        FROM chart_dimensions cd
        JOIN variables v ON v.id = cd.variableId
        JOIN charts c ON c.id = cd.chartId
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE cd.variableId IN (?)

        UNION ALL

        SELECT DISTINCT
            ev.variableId,
            v.name AS variableName,
            'explorer' AS usedBy,
            ev.explorerSlug AS ref
        FROM explorer_variables ev
        JOIN variables v ON v.id = ev.variableId
        JOIN explorers e ON e.slug = ev.explorerSlug
        WHERE ev.variableId IN (?) AND e.isPublished

        UNION ALL

        SELECT DISTINCT
            mdxcc.variableId,
            v.name AS variableName,
            'multiDimView' AS usedBy,
            CONCAT(mddp.catalogPath, '#', mdxcc.viewId) AS ref
        FROM multi_dim_x_chart_configs mdxcc
        JOIN variables v ON v.id = mdxcc.variableId
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mdxcc.variableId IN (?) AND (
            mddp.published
            -- Both of these reference the view (or its config) with a RESTRICT foreign key:
            -- deleting it throws and takes the whole transaction with it.
            OR EXISTS (
                SELECT 1 FROM narrative_charts nc
                WHERE nc.parentMultiDimXChartConfigId = mdxcc.id
            )
            OR EXISTS (
                SELECT 1 FROM multi_dim_redirects mdr
                WHERE mdr.viewConfigId = mdxcc.chartConfigId
            )
        )

        ORDER BY variableId, usedBy, ref
        `,
        [existingIndicatorIds, existingIndicatorIds, existingIndicatorIds]
    )

    const blockedIndicatorIds = new Set(blocked.map((row) => row.variableId))
    const deletableIndicators = existingIndicators.filter(
        (indicator) => !blockedIndicatorIds.has(indicator.id)
    )
    const deletableIndicatorIds = deletableIndicators.map(
        (indicator) => indicator.id
    )

    if (deletableIndicatorIds.length === 0) return { deleted: [], blocked }

    // Collect the IDs of the chart configs for the indicators being deleted
    const indicatorConfigIds = _.compact(
        deletableIndicators.map((indicator) => indicator.patchConfigIdETL)
    )
    const multiDimConfigIds = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    )
        .whereIn("variableId", deletableIndicatorIds)
        .pluck("chartConfigId")
    const chartConfigIds = _.uniq([...indicatorConfigIds, ...multiDimConfigIds])

    // Collect origin and source IDs for the indicators being deleted
    const originIds = await trx("origins_variables")
        .whereIn("variableId", deletableIndicatorIds)
        .pluck("originId")
    const sourceIds = _.compact(
        deletableIndicators.map((indicator) => indicator.sourceId)
    )

    // Delete all child rows of the indicators being deleted
    for (const table of INDICATOR_CHILD_TABLES) {
        await trx(table).whereIn("variableId", deletableIndicatorIds).delete()
    }

    // Delete the indicators themselves
    await trx(VariablesTableName).whereIn("id", deletableIndicatorIds).delete()

    // Delete now-orphaned origins and sources
    if (originIds.length > 0) {
        await db.knexRaw(
            trx,
            `-- sql
            DELETE o FROM origins o
            LEFT JOIN origins_variables ov ON ov.originId = o.id
            WHERE o.id IN (?) AND ov.originId IS NULL
            `,
            [originIds]
        )
    }
    if (sourceIds.length > 0) {
        await db.knexRaw(
            trx,
            `-- sql
            DELETE s FROM sources s
            LEFT JOIN variables v ON v.sourceId = s.id
            WHERE s.id IN (?) AND v.sourceId IS NULL
            `,
            [sourceIds]
        )
    }

    // Delete chart configs from the DB and from R2
    if (chartConfigIds.length > 0) {
        await trx("chart_configs").whereIn("id", chartConfigIds).delete()

        // Only multi dim chart configs are stored in R2
        await pMap(
            multiDimConfigIds,
            // A failed delete should not roll this transaction back.
            // The next sync to R2 will clean up any orphaned objects.
            (id) => deleteGrapherConfigFromR2ByUuid(id).catch(console.error),
            { concurrency: 20 }
        )
    }

    return { deleted: deletableIndicatorIds, blocked }
}
