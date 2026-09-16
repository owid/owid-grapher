import * as _ from "lodash-es"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    migrateGrapherConfigToLatestVersionAndFailOnError,
} from "@ourworldindata/grapher"
import {
    JsonError,
    DbPlainChart,
    DbRawChartConfig,
    GrapherInterface,
    OwidVariableWithSource,
    parseChartConfig,
    ChartConfigsTableName,
    R2GrapherConfigDirectory,
} from "@ourworldindata/types"
import {
    fetchS3DataValuesByPath,
    fetchS3MetadataByPath,
    getLatestIndicatorIdsByCatalogPath,
    getIndicatorChartConfigRecord,
    getIndicatorChartConfig,
    getVariablesByIds,
    searchVariables,
    searchVariablesGroupedByDataset,
    updateAllChartsThatInheritFromIndicator,
    updateAllMultiDimViewsThatInheritFromIndicator,
    updateIndicatorChartConfig,
    deleteIndicators,
} from "../../db/model/Variable.js"
import { enqueueExplorerRefreshJobsForDependencies } from "../../db/model/Explorer.js"
import { DATA_API_URL } from "../../settings/clientSettings.mjs"
import * as db from "../../db/db.js"
import {
    getParentIndicatorIdFromChartConfig,
    parseIntOrUndefined,
} from "@ourworldindata/utils"
import {
    OldChartFieldList,
    oldChartFieldList,
    assignTagsForCharts,
} from "../../db/model/Chart.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import {
    saveGrapherConfigToR2,
    saveGrapherConfigToR2ByUuid,
} from "../../serverUtils/r2/chartConfigR2Helpers.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import * as z from "zod"

export async function getVariableDataJson(
    req: Request,
    _res: HandlerResponse,
    _trx: db.KnexReadonlyTransaction
) {
    const variableStr = req.params.variableStr
    if (!variableStr) throw new JsonError("No indicator id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple indicators at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid indicator id")
    return await fetchS3DataValuesByPath(
        getVariableDataRoute(DATA_API_URL, variableId, { noCache: true })
    )
}

export async function getVariableMetadataJson(
    req: Request,
    _res: HandlerResponse,
    _trx: db.KnexReadonlyTransaction
) {
    const variableStr = req.params.variableStr
    if (!variableStr) throw new JsonError("No indicator id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple indicators at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid indicator id")
    return await fetchS3MetadataByPath(
        getVariableMetadataRoute(DATA_API_URL, variableId, { noCache: true })
    )
}

export async function getVariablesJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    // A chart's own indicators, looked up by id — the picker starts from those
    const ids = (req.query.ids as string)
        ?.split(",")
        .map((id) => parseIntOrUndefined(id.trim()))
        .filter((id): id is number => id !== undefined)
    if (ids?.length) return { variables: await getVariablesByIds(ids, trx) }

    const limit = parseIntOrUndefined(req.query.limit as string) ?? 50
    const offset = parseIntOrUndefined(req.query.offset as string) ?? 0
    const query = req.query.search as string
    // The same search, paged over the datasets the matches belong to
    if (req.query.group === "dataset")
        return await searchVariablesGroupedByDataset(query, limit, offset, trx)
    return await searchVariables(query, limit, offset, trx)
}

export async function getVariablesUsagesJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const query = `-- sql
    SELECT
        variableId,
        COUNT(DISTINCT chartId) AS usageCount
    FROM
        chart_dimensions
    GROUP BY
        variableId
    ORDER BY
        usageCount DESC`

    const rows = await db.knexRaw(trx, query)

    return rows
}

export async function getLatestIndicatorIdsByCatalogPathJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<Record<string, number | null>> {
    const catalogPathsQueryParam = (req.query.catalogPaths ?? "") as string

    const catalogPaths = catalogPathsQueryParam
        .split(",")
        .map((path) => path.trim())
        .filter((path) => path.length > 0)

    if (catalogPaths.length === 0) {
        throw new JsonError(
            "Please provide a non-empty `catalogPaths` query parameter",
            400
        )
    }

    const idsByPath = await getLatestIndicatorIdsByCatalogPath(
        catalogPaths,
        trx
    )
    return Object.fromEntries(idsByPath)
}

export async function getIndicatorChartConfigJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)
    const config = await getIndicatorChartConfig(trx, variableId)
    return config ?? {}
}

export async function getVariableJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)

    const variable = await fetchS3MetadataByPath(
        getVariableMetadataRoute(DATA_API_URL, variableId, { noCache: true })
    )

    // XXX: Patch shortName onto the end of catalogPath when it's missing,
    //      a temporary hack since our S3 metadata is out of date with our DB.
    //      See: https://github.com/owid/etl/issues/2135
    if (variable.catalogPath && !variable.catalogPath.includes("#")) {
        variable.catalogPath += `#${variable.shortName}`
    }

    const rawCharts = await db.knexRaw<
        OldChartFieldList & {
            isInheritanceEnabled: DbPlainChart["isInheritanceEnabled"]
            config: DbRawChartConfig["config"]
        }
    >(
        trx,
        `-- sql
                SELECT ${oldChartFieldList}, charts.isInheritanceEnabled, chart_configs.config AS config
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                LEFT JOIN analytics_grapher_views agv ON (agv.grapher_slug = chart_configs.slug AND chart_configs.config ->> '$.isPublished' = "true")
                LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
                JOIN chart_dimensions cd ON cd.chartId = charts.id
                WHERE cd.variableId = ?
                GROUP BY charts.id, agv.views_365d, crv.narrativeChartsCount, crv.referencesCount
            `,
        [variableId]
    )

    // check for parent indicators
    const charts = rawCharts.map((chart) => {
        const parentIndicatorId = getParentIndicatorIdFromChartConfig(
            parseChartConfig(chart.config)
        )
        const hasParentIndicator = parentIndicatorId !== undefined
        return _.omit({ ...chart, hasParentIndicator }, "config")
    })

    await assignTagsForCharts(trx, charts)

    const grapherConfigETL = await getIndicatorChartConfig(trx, variableId)

    const variableWithCharts: OwidVariableWithSource & {
        charts: Record<string, any>
        grapherConfigETL: GrapherInterface | undefined
    } = {
        ...variable,
        charts,
        grapherConfigETL,
    }

    return { variable: variableWithCharts }
}

export async function putIndicatorChartConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const variableId = expectInt(req.params.variableId)

    let validConfig: GrapherInterface
    try {
        validConfig = migrateGrapherConfigToLatestVersionAndFailOnError(
            req.body
        )
    } catch (err) {
        return {
            success: false,
            error: String(err),
        }
    }

    const indicator = await getIndicatorChartConfigRecord(trx, variableId)
    if (!indicator) {
        throw new JsonError(`Indicator with id ${variableId} not found`, 500)
    }

    const { savedPatch, updatedCharts, updatedMultiDimViews } =
        await updateIndicatorChartConfig(trx, indicator, validConfig)

    await updateGrapherConfigsInR2(trx, updatedCharts, updatedMultiDimViews)
    const chartIdsForRefresh = Array.from(
        new Set(updatedCharts.map((chart) => chart.chartId))
    )
    await enqueueExplorerRefreshJobsForDependencies(trx, {
        chartIds: chartIdsForRefresh,
        variableIds: [variableId],
    })
    const allUpdatedConfigs = [...updatedCharts, ...updatedMultiDimViews]

    if (allUpdatedConfigs.some(({ isPublished }) => isPublished)) {
        await triggerStaticBuild(
            res.locals.user,
            `Updating ETL config for indicator ${variableId}`
        )
    }

    return { success: true, savedPatch }
}

export async function deleteIndicatorChartConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const variableId = expectInt(req.params.variableId)

    const indicator = await getIndicatorChartConfigRecord(trx, variableId)
    if (!indicator) {
        throw new JsonError(`Indicator with id ${variableId} not found`, 500)
    }

    // no-op if the indicator doesn't have an ETL config
    if (!indicator.configId) return { success: true }

    const now = new Date()

    // remove reference in the variables table
    await db.knexRaw(
        trx,
        `-- sql
                UPDATE variables
                SET patchConfigIdETL = NULL
                WHERE id = ?
            `,
        [variableId]
    )

    // delete row in the chart_configs table
    await db.knexRaw(
        trx,
        `-- sql
                DELETE FROM chart_configs
                WHERE id = ?
            `,
        [indicator.configId]
    )

    const updatedCharts = await updateAllChartsThatInheritFromIndicator(
        trx,
        variableId,
        undefined,
        now
    )
    const updatedMultiDimViews =
        await updateAllMultiDimViewsThatInheritFromIndicator(
            trx,
            variableId,
            undefined,
            now
        )
    await updateGrapherConfigsInR2(trx, updatedCharts, updatedMultiDimViews)
    const chartIdsForRefresh = Array.from(
        new Set(updatedCharts.map((chart) => chart.chartId))
    )
    await enqueueExplorerRefreshJobsForDependencies(trx, {
        chartIds: chartIdsForRefresh,
        variableIds: [variableId],
    })
    const allUpdatedConfigs = [...updatedCharts, ...updatedMultiDimViews]

    if (allUpdatedConfigs.some(({ isPublished }) => isPublished)) {
        await triggerStaticBuild(
            res.locals.user,
            `Updating ETL config for indicator ${variableId}`
        )
    }

    return { success: true }
}

async function updateGrapherConfigsInR2(
    knex: db.KnexReadonlyTransaction,
    updatedCharts: { chartConfigId: string; isPublished: boolean }[],
    updatedMultiDimViews: { chartConfigId: string; isPublished: boolean }[]
): Promise<void> {
    const publishedChartConfigIds = new Set(
        updatedCharts
            .filter(({ isPublished }) => isPublished)
            .map(({ chartConfigId }) => chartConfigId)
    )
    const idsToUpdate = [...updatedCharts, ...updatedMultiDimViews]
        .filter(({ isPublished }) => isPublished)
        .map(({ chartConfigId }) => chartConfigId)
    const builder = knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "slug", "config", "configMd5")
        .whereIn("id", idsToUpdate)
    for await (const { id, slug, config, configMd5 } of builder.stream()) {
        await saveGrapherConfigToR2ByUuid(id, config, configMd5)
        if (publishedChartConfigIds.has(id) && slug)
            await saveGrapherConfigToR2(
                config,
                R2GrapherConfigDirectory.publishedGrapherBySlug,
                `${slug}.json`,
                configMd5
            )
    }
}

const deleteVariablesSchema = z.object({
    variableIds: z.array(z.number().int()),
})

/**
 * Delete a set of indicators.
 *
 * An indicator a chart, a published explorer or a live multi-dim view still
 * uses is never deleted; it comes back in `blocked` instead (but it doesn't
 * fail the whole request).
 */
export async function postVariablesDelete(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const parseResult = deleteVariablesSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(`Invalid request: ${parseResult.error}`, 400)
    }

    const { deleted, blocked } = await deleteIndicators(
        trx,
        parseResult.data.variableIds
    )

    return { success: true, deleted, blocked }
}
