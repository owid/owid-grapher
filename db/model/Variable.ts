import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    retryPromise,
    isEmpty,
    omitUndefinedValues,
    mergeGrapherConfigs,
    diffGrapherConfigs,
} from "@ourworldindata/utils"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import pl from "nodejs-polars"
import { uuidv7 } from "uuidv7"
import { DATA_API_URL } from "../../settings/serverSettings.js"
import { escape } from "mysql2"
import {
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    OwidVariableId,
    GRAPHER_CHART_TYPES,
    DimensionProperty,
    GrapherInterface,
    DbRawVariable,
    VariablesTableName,
    DbRawChartConfig,
    parseChartConfig,
    DbEnrichedChartConfig,
    DbEnrichedVariable,
    DbPlainChart,
    DbPlainMultiDimXChartConfig,
} from "@ourworldindata/types"
import { knexRaw, knexRawFirst } from "../db.js"
import {
    updateExistingConfigPair,
    updateExistingFullConfig,
} from "./ChartConfigs.js"

interface ChartConfigPair {
    configId: DbEnrichedChartConfig["id"]
    patchConfig: DbEnrichedChartConfig["patch"]
    fullConfig: DbEnrichedChartConfig["full"]
}

interface VariableWithGrapherConfigs {
    variableId: DbEnrichedVariable["id"]
    admin?: ChartConfigPair
    etl?: ChartConfigPair
}

export async function getGrapherConfigsForVariable(
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<VariableWithGrapherConfigs | undefined> {
    const variable = await knexRawFirst<
        Pick<
            DbRawVariable,
            "id" | "grapherConfigIdAdmin" | "grapherConfigIdETL"
        > & {
            patchConfigAdmin?: DbRawChartConfig["patch"]
            patchConfigETL?: DbRawChartConfig["patch"]
            fullConfigAdmin?: DbRawChartConfig["full"]
            fullConfigETL?: DbRawChartConfig["full"]
        }
    >(
        knex,
        `-- sql
            SELECT
                v.id,
                v.grapherConfigIdAdmin,
                v.grapherConfigIdETL,
                cc_admin.patch AS patchConfigAdmin,
                cc_admin.full AS fullConfigAdmin,
                cc_etl.patch AS patchConfigETL,
                cc_etl.full AS fullConfigETL
            FROM variables v
            LEFT JOIN chart_configs cc_admin ON v.grapherConfigIdAdmin = cc_admin.id
            LEFT JOIN chart_configs cc_etl ON v.grapherConfigIdETL = cc_etl.id
            WHERE v.id = ?
        `,
        [variableId]
    )

    if (!variable) return

    const maybeParseChartConfig = (
        config: string | undefined
    ): GrapherInterface => (config ? parseChartConfig(config) : {})

    const admin = variable.grapherConfigIdAdmin
        ? {
              configId: variable.grapherConfigIdAdmin,
              patchConfig: maybeParseChartConfig(variable.patchConfigAdmin),
              fullConfig: maybeParseChartConfig(variable.fullConfigAdmin),
          }
        : undefined

    const etl = variable.grapherConfigIdETL
        ? {
              configId: variable.grapherConfigIdETL,
              patchConfig: maybeParseChartConfig(variable.patchConfigETL),
              fullConfig: maybeParseChartConfig(variable.fullConfigETL),
          }
        : undefined

    return omitUndefinedValues({
        variableId: variable.id,
        admin,
        etl,
    })
}

export async function getMergedGrapherConfigForVariable(
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<GrapherInterface | undefined> {
    const variable = await getGrapherConfigsForVariable(knex, variableId)
    return variable?.admin?.fullConfig ?? variable?.etl?.fullConfig
}

export async function getMergedGrapherConfigsForVariables(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<Map<number, GrapherInterface>> {
    // FIXME: Optimize to a single query that only fetches the data we need.
    const variables = await Promise.all(
        variableIds.map((variableId) => {
            return getGrapherConfigsForVariable(knex, variableId)
        })
    )
    const configs = new Map<number, GrapherInterface>()
    for (const variable of variables) {
        if (variable) {
            const config =
                variable.admin?.fullConfig ?? variable.etl?.fullConfig
            if (config) {
                configs.set(variable.variableId, config)
            }
        }
    }
    return configs
}

export async function insertNewGrapherConfigForVariable(
    knex: db.KnexReadonlyTransaction,
    {
        type,
        variableId,
        patchConfig,
        fullConfig,
    }: {
        type: "admin" | "etl"
        variableId: number
        patchConfig: GrapherInterface
        fullConfig: GrapherInterface
    }
): Promise<void> {
    // insert chart configs into the database
    const configId = uuidv7()
    await db.knexRaw(
        knex,
        `-- sql
            INSERT INTO chart_configs (id, patch, full)
            VALUES (?, ?, ?)
        `,
        [configId, JSON.stringify(patchConfig), JSON.stringify(fullConfig)]
    )

    // make a reference to the config from the variables table
    const column =
        type === "admin" ? "grapherConfigIdAdmin" : "grapherConfigIdETL"
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE variables
            SET ?? = ?
            WHERE id = ?
        `,
        [column, configId, variableId]
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

async function findAllChartsThatInheritFromIndicator(
    trx: db.KnexReadonlyTransaction,
    variableId: number
): Promise<
    {
        chartConfigId: string
        patchConfig: GrapherInterface
        isPublished: boolean
    }[]
> {
    const charts = await db.knexRaw<{
        chartConfigId: DbRawChartConfig["id"]
        patchConfig: DbRawChartConfig["patch"]
        isPublished: boolean
    }>(
        trx,
        `-- sql
            SELECT
                cc.id as chartConfigId,
                cc.patch as patchConfig,
                cc.full ->> "$.isPublished" as isPublished
            FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                JOIN charts_x_parents cxp ON c.id = cxp.chartId
            WHERE
                c.isInheritanceEnabled IS TRUE
                AND cxp.variableId = ?
        `,
        [variableId]
    )
    return charts.map((chart) => ({
        ...chart,
        patchConfig: parseChartConfig(chart.patchConfig),
    }))
}

export async function updateAllChartsThatInheritFromIndicator(
    trx: db.KnexReadWriteTransaction,
    variableId: number,
    {
        updatedAt,
        patchConfigETL,
        patchConfigAdmin,
    }: {
        updatedAt: Date
        patchConfigETL?: GrapherInterface
        patchConfigAdmin?: GrapherInterface
    }
): Promise<{ chartConfigId: string; isPublished: boolean }[]> {
    const inheritingCharts = await findAllChartsThatInheritFromIndicator(
        trx,
        variableId
    )

    for (const chart of inheritingCharts) {
        const fullConfig = mergeGrapherConfigs(
            patchConfigETL ?? {},
            patchConfigAdmin ?? {},
            chart.patchConfig
        )
        await db.knexRaw(
            trx,
            `-- sql
                UPDATE chart_configs cc
                JOIN charts c ON c.configId = cc.id
                SET
                    cc.full = ?,
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

    // let the caller know if any charts were updated
    return inheritingCharts
}

async function findAllMultiDimViewsThatInheritFromIndicator(
    trx: db.KnexReadonlyTransaction,
    variableId: number
): Promise<
    {
        chartConfigId: string
        patchConfig: GrapherInterface
        isPublished: boolean
    }[]
> {
    const charts = await db.knexRaw<{
        chartConfigId: DbPlainMultiDimXChartConfig["chartConfigId"]
        patchConfig: DbRawChartConfig["patch"]
        isPublished: boolean
    }>(
        trx,
        `-- sql
            SELECT
                mdxcc.chartConfigId as chartConfigId,
                cc.patch as patchConfig,
                md.published as isPublished
            FROM multi_dim_data_pages md
                JOIN multi_dim_x_chart_configs mdxcc ON mdxcc.multiDimId = md.id
                JOIN chart_configs cc ON cc.id = mdxcc.chartConfigId
            WHERE mdxcc.variableId = ?
        `,
        [variableId]
    )
    return charts.map((chart) => ({
        ...chart,
        patchConfig: parseChartConfig(chart.patchConfig),
    }))
}

export async function updateAllMultiDimViewsThatInheritFromIndicator(
    trx: db.KnexReadWriteTransaction,
    variableId: number,
    {
        updatedAt,
        patchConfigETL,
        patchConfigAdmin,
    }: {
        updatedAt: Date
        patchConfigETL?: GrapherInterface
        patchConfigAdmin?: GrapherInterface
    }
): Promise<
    {
        chartConfigId: string
        patchConfig: GrapherInterface
        isPublished: boolean
    }[]
> {
    const inheritingViews = await findAllMultiDimViewsThatInheritFromIndicator(
        trx,
        variableId
    )

    for (const view of inheritingViews) {
        const fullConfig = mergeGrapherConfigs(
            patchConfigETL ?? {},
            patchConfigAdmin ?? {},
            view.patchConfig
        )
        await db.knexRaw(
            trx,
            `-- sql
                UPDATE chart_configs
                SET
                    full = ?,
                    updatedAt = ?
                WHERE id = ?
            `,
            [JSON.stringify(fullConfig), updatedAt, view.chartConfigId]
        )
    }

    // let the caller know if any views were updated
    return inheritingViews
}

export async function updateGrapherConfigETLOfVariable(
    trx: db.KnexReadWriteTransaction,
    variable: VariableWithGrapherConfigs,
    config: GrapherInterface
): Promise<{
    savedPatch: GrapherInterface
    updatedCharts: { chartConfigId: string; isPublished: boolean }[]
    updatedMultiDimViews: { chartConfigId: string; isPublished: boolean }[]
}> {
    const { variableId } = variable

    const configETL = makeConfigValidForIndicator({
        config,
        variableId,
    })

    // Set the updatedAt manually instead of letting the DB do it so it is the
    // same across different tables. The inconsistency caused issues in the
    // past in chart-sync.
    const now = new Date()

    if (variable.etl) {
        await updateExistingConfigPair(trx, {
            configId: variable.etl.configId,
            patchConfig: configETL,
            fullConfig: configETL,
            updatedAt: now,
        })
    } else {
        await insertNewGrapherConfigForVariable(trx, {
            type: "etl",
            variableId,
            patchConfig: configETL,
            fullConfig: configETL,
        })
    }

    // update admin-authored full config it is exists
    if (variable.admin) {
        const fullConfig = mergeGrapherConfigs(
            configETL,
            variable.admin.patchConfig
        )
        await updateExistingFullConfig(trx, {
            configId: variable.admin.configId,
            config: fullConfig,
            updatedAt: now,
        })
    }

    const updates = {
        patchConfigETL: configETL,
        patchConfigAdmin: variable.admin?.patchConfig,
        updatedAt: now,
    }
    const updatedCharts = await updateAllChartsThatInheritFromIndicator(
        trx,
        variableId,
        updates
    )
    const updatedMultiDimViews =
        await updateAllMultiDimViewsThatInheritFromIndicator(
            trx,
            variableId,
            updates
        )

    return {
        savedPatch: configETL,
        updatedCharts,
        updatedMultiDimViews,
    }
}

export async function updateGrapherConfigAdminOfVariable(
    trx: db.KnexReadWriteTransaction,
    variable: VariableWithGrapherConfigs,
    config: GrapherInterface
): Promise<{
    savedPatch: GrapherInterface
    updatedCharts: { chartConfigId: string; isPublished: boolean }[]
    updatedMultiDimViews: { chartConfigId: string; isPublished: boolean }[]
}> {
    const { variableId } = variable

    const validConfig = makeConfigValidForIndicator({
        config,
        variableId,
    })

    const patchConfigAdmin = diffGrapherConfigs(
        validConfig,
        variable.etl?.fullConfig ?? {}
    )

    const fullConfigAdmin = mergeGrapherConfigs(
        variable.etl?.patchConfig ?? {},
        patchConfigAdmin
    )

    // Set the updatedAt manually instead of letting the DB do it so it is the
    // same across different tables. The inconsistency caused issues in the
    // past in chart-sync.
    const now = new Date()

    if (variable.admin) {
        await updateExistingConfigPair(trx, {
            configId: variable.admin.configId,
            patchConfig: patchConfigAdmin,
            fullConfig: fullConfigAdmin,
            updatedAt: now,
        })
    } else {
        await insertNewGrapherConfigForVariable(trx, {
            type: "admin",
            variableId,
            patchConfig: patchConfigAdmin,
            fullConfig: fullConfigAdmin,
        })
    }

    const updates = {
        patchConfigETL: variable.etl?.patchConfig ?? {},
        patchConfigAdmin: patchConfigAdmin,
        updatedAt: now,
    }
    const updatedCharts = await updateAllChartsThatInheritFromIndicator(
        trx,
        variableId,
        updates
    )
    const updatedMultiDimViews =
        await updateAllMultiDimViewsThatInheritFromIndicator(
            trx,
            variableId,
            updates
        )

    return {
        savedPatch: patchConfigAdmin,
        updatedCharts,
        updatedMultiDimViews,
    }
}

export async function getAllChartsForIndicator(
    trx: db.KnexReadonlyTransaction,
    variableId: number
): Promise<
    {
        chartId: DbPlainChart["id"]
        config: GrapherInterface
        isPublished: boolean
        isChild: boolean
        isInheritanceEnabled: DbPlainChart["isInheritanceEnabled"]
    }[]
> {
    const charts = await db.knexRaw<{
        chartId: DbPlainChart["id"]
        config: DbRawChartConfig["full"]
        isPublished: boolean
        isChild: boolean
        isInheritanceEnabled: DbPlainChart["isInheritanceEnabled"]
    }>(
        trx,
        `-- sql
        SELECT
            c.id AS chartId,
            cc.full AS config,
            cc.full ->> '$.isPublished' = "true" AS isPublished,
            cxp.variableId = ? AS isChild,
            c.isInheritanceEnabled
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        JOIN chart_dimensions cd ON cd.chartId = c.id
        LEFT JOIN charts_x_parents cxp ON c.id = cxp.chartId
        WHERE
            cd.variableId = ?
        `,
        [variableId, variableId]
    )

    return charts.map((chart) => ({
        chartId: chart.chartId,
        config: parseChartConfig(chart.config),
        isPublished: !!chart.isPublished,
        isChild: !!chart.isChild,
        isInheritanceEnabled: !!chart.isInheritanceEnabled,
    }))
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
    params: any[],
    knex: db.KnexReadonlyTransaction
): Promise<pl.DataFrame> => {
    return createDataFrame(await db.knexRaw(knex, sql, params))
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
        (grapher.chartTypes?.[0] !== GRAPHER_CHART_TYPES.ScatterPlot ||
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

export const getVariableIdsByCatalogPath = async (
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
