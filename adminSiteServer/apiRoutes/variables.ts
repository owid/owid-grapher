import * as _ from "lodash-es"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    migrateGrapherConfigToLatestVersionAndFailOnError,
} from "@ourworldindata/grapher"
import {
    DbRawVariable,
    DbPlainDataset,
    JsonError,
    DbPlainChart,
    DbRawChartConfig,
    GrapherInterface,
    OwidVariableWithSource,
    parseChartConfig,
} from "@ourworldindata/types"
import {
    fetchS3DataValuesByPath,
    fetchS3MetadataByPath,
    getAllChartsForIndicator,
    getGrapherConfigsForVariable,
    getMergedGrapherConfigForVariable,
    searchVariables,
    updateAllChartsThatInheritFromIndicator,
    updateAllMultiDimViewsThatInheritFromIndicator,
    updateGrapherConfigAdminOfVariable,
    updateGrapherConfigETLOfVariable,
} from "../../db/model/Variable.js"
import { enqueueExplorerRefreshJobsForDependencies } from "../../db/model/Explorer.js"
import { DATA_API_URL } from "../../settings/clientSettings.js"
import * as db from "../../db/db.js"
import {
    getParentVariableIdFromChartConfig,
    parseIntOrUndefined,
} from "@ourworldindata/utils"
import {
    OldChartFieldList,
    oldChartFieldList,
    assignTagsForCharts,
} from "../../db/model/Chart.js"
import { updateExistingFullConfig } from "../../db/model/ChartConfigs.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import { updateGrapherConfigsInR2 } from "./charts.js"
import { Request } from "../authentication.js"
import e from "express"

export async function getEditorVariablesJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const datasets = []
    const rows = await db.knexRaw<
        Pick<DbRawVariable, "name" | "id"> & {
            datasetId: number
            datasetName: string
            datasetVersion: string
        } & Pick<
                DbPlainDataset,
                "namespace" | "isPrivate" | "nonRedistributable"
            >
    >(
        trx,
        `-- sql
        SELECT
                v.name,
                v.id,
                d.id as datasetId,
                d.name as datasetName,
                d.version as datasetVersion,
                d.namespace,
                d.isPrivate,
                d.nonRedistributable
            FROM variables as v JOIN active_datasets as d ON v.datasetId = d.id
            ORDER BY d.updatedAt DESC
            `
    )

    let dataset:
        | {
              id: number
              name: string
              version: string
              namespace: string
              isPrivate: boolean
              nonRedistributable: boolean
              variables: { id: number; name: string }[]
          }
        | undefined
    for (const row of rows) {
        if (!dataset || row.datasetName !== dataset.name) {
            if (dataset) datasets.push(dataset)

            dataset = {
                id: row.datasetId,
                name: row.datasetName,
                version: row.datasetVersion,
                namespace: row.namespace,
                isPrivate: !!row.isPrivate,
                nonRedistributable: !!row.nonRedistributable,
                variables: [],
            }
        }

        dataset.variables.push({
            id: row.id,
            name: row.name ?? "",
        })
    }

    if (dataset) datasets.push(dataset)

    return { datasets: datasets }
}

export async function getVariableDataJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const variableStr = req.params.variableStr as string
    if (!variableStr) throw new JsonError("No variable id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple variables at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid variable id")
    return await fetchS3DataValuesByPath(
        getVariableDataRoute(DATA_API_URL, variableId, { noCache: true })
    )
}

export async function getVariableMetadataJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const variableStr = req.params.variableStr as string
    if (!variableStr) throw new JsonError("No variable id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple variables at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid variable id")
    return await fetchS3MetadataByPath(
        getVariableMetadataRoute(DATA_API_URL, variableId, { noCache: true })
    )
}

export async function getVariablesJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 50
    const query = req.query.search as string
    return await searchVariables(query, limit, trx)
}

export async function getVariablesUsagesJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
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

export async function getVariablesGrapherConfigETLPatchConfigJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)
    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }
    return variable.etl?.patchConfig ?? {}
}

export async function getVariablesGrapherConfigAdminPatchConfigJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)
    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }
    return variable.admin?.patchConfig ?? {}
}

export async function getVariablesMergedGrapherConfigJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)
    const config = await getMergedGrapherConfigForVariable(trx, variableId)
    return config ?? {}
}

export async function getVariablesVariableIdJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
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
            config: DbRawChartConfig["full"]
            narrativeChartsCount: number
            referencesCount: number
        }
    >(
        trx,
        `-- sql
                SELECT ${oldChartFieldList}, charts.isInheritanceEnabled, chart_configs.full AS config,
                    round(views_365d / 365, 1) as pageviewsPerDay,
                    crv.narrativeChartsCount,
                    crv.referencesCount
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                LEFT JOIN analytics_pageviews on (analytics_pageviews.url = CONCAT("https://ourworldindata.org/grapher/", chart_configs.slug) AND chart_configs.full ->> '$.isPublished' = "true" )
                LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
                JOIN chart_dimensions cd ON cd.chartId = charts.id
                WHERE cd.variableId = ?
                GROUP BY charts.id, views_365d, crv.narrativeChartsCount, crv.referencesCount
            `,
        [variableId]
    )

    // check for parent indicators
    const charts = rawCharts.map((chart) => {
        const parentIndicatorId = getParentVariableIdFromChartConfig(
            parseChartConfig(chart.config)
        )
        const hasParentIndicator = parentIndicatorId !== undefined
        return _.omit({ ...chart, hasParentIndicator }, "config")
    })

    await assignTagsForCharts(trx, charts)

    const variableWithConfigs = await getGrapherConfigsForVariable(
        trx,
        variableId
    )
    const grapherConfigETL = variableWithConfigs?.etl?.patchConfig
    const grapherConfigAdmin = variableWithConfigs?.admin?.patchConfig
    const mergedGrapherConfig =
        variableWithConfigs?.admin?.fullConfig ??
        variableWithConfigs?.etl?.fullConfig

    // add the variable's display field to the merged grapher config
    if (mergedGrapherConfig) {
        const [varDims, otherDims] = _.partition(
            mergedGrapherConfig.dimensions ?? [],
            (dim) => dim.variableId === variableId
        )
        const varDimsWithDisplay = varDims.map((dim) => ({
            display: variable.display,
            ...dim,
        }))
        mergedGrapherConfig.dimensions = [...varDimsWithDisplay, ...otherDims]
    }

    const variableWithCharts: OwidVariableWithSource & {
        charts: Record<string, any>
        grapherConfig: GrapherInterface | undefined
        grapherConfigETL: GrapherInterface | undefined
        grapherConfigAdmin: GrapherInterface | undefined
    } = {
        ...variable,
        charts,
        grapherConfig: mergedGrapherConfig,
        grapherConfigETL,
        grapherConfigAdmin,
    }

    return {
        variable: variableWithCharts,
    } /*, vardata: await getVariableData([variableId]) }*/
}

export async function putVariablesVariableIdGrapherConfigETL(
    req: Request,
    res: e.Response<any, Record<string, any>>,
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

    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }

    const { savedPatch, updatedCharts, updatedMultiDimViews } =
        await updateGrapherConfigETLOfVariable(trx, variable, validConfig)

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
            `Updating ETL config for variable ${variableId}`
        )
    }

    return { success: true, savedPatch }
}

export async function deleteVariablesVariableIdGrapherConfigETL(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const variableId = expectInt(req.params.variableId)

    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }

    // no-op if the variable doesn't have an ETL config
    if (!variable.etl) return { success: true }

    const now = new Date()

    // remove reference in the variables table
    await db.knexRaw(
        trx,
        `-- sql
                UPDATE variables
                SET grapherConfigIdETL = NULL
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
        [variable.etl.configId]
    )

    // update admin config if there is one
    if (variable.admin) {
        await updateExistingFullConfig(trx, {
            configId: variable.admin.configId,
            config: variable.admin.patchConfig,
            updatedAt: now,
        })
    }

    const updates = {
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
            `Updating ETL config for variable ${variableId}`
        )
    }

    return { success: true }
}

export async function putVariablesVariableIdGrapherConfigAdmin(
    req: Request,
    res: e.Response<any, Record<string, any>>,
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

    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }

    const { savedPatch, updatedCharts, updatedMultiDimViews } =
        await updateGrapherConfigAdminOfVariable(trx, variable, validConfig)

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
            `Updating admin-authored config for variable ${variableId}`
        )
    }

    return { success: true, savedPatch }
}

export async function deleteVariablesVariableIdGrapherConfigAdmin(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const variableId = expectInt(req.params.variableId)

    const variable = await getGrapherConfigsForVariable(trx, variableId)
    if (!variable) {
        throw new JsonError(`Variable with id ${variableId} not found`, 500)
    }

    // no-op if the variable doesn't have an admin-authored config
    if (!variable.admin) return { success: true }

    const now = new Date()

    // remove reference in the variables table
    await db.knexRaw(
        trx,
        `-- sql
                UPDATE variables
                SET grapherConfigIdAdmin = NULL
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
        [variable.admin.configId]
    )

    const updates = {
        patchConfigETL: variable.etl?.patchConfig,
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
            `Updating admin-authored config for variable ${variableId}`
        )
    }

    return { success: true }
}

export async function getVariablesVariableIdChartsJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const variableId = expectInt(req.params.variableId)
    const charts = await getAllChartsForIndicator(trx, variableId)
    return charts.map((chart) => ({
        id: chart.chartId,
        title: chart.config.title,
        variantName: chart.config.variantName,
        isChild: chart.isChild,
        isInheritanceEnabled: chart.isInheritanceEnabled,
        isPublished: chart.isPublished,
    }))
}
