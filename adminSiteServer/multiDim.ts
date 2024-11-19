import { uniq } from "lodash"

import {
    defaultGrapherConfig,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"
import {
    Base64String,
    ChartConfigsTableName,
    DbPlainMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    IndicatorEntryBeforePreProcessing,
    MultiDimDataPageConfigEnriched,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
    MultiDimDimensionChoices,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import {
    mergeGrapherConfigs,
    MultiDimDataPageConfig,
    slugify,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import {
    isMultiDimDataPagePublished,
    upsertMultiDimDataPage,
} from "../db/model/MultiDimDataPage.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getMergedGrapherConfigsForVariables,
    getVariableIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    deleteGrapherConfigFromR2ByUUID,
    saveMultiDimConfigToR2,
} from "./chartConfigR2Helpers.js"
import {
    saveNewChartConfigInDbAndR2,
    updateChartConfigInDbAndR2,
} from "./chartConfigHelpers.js"

function dimensionsToViewId(dimensions: MultiDimDimensionChoices) {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => slugify(value))
        .join("__")
        .toLowerCase()
}

async function resolveMultiDimDataPageCatalogPathsToIndicatorIds(
    knex: db.KnexReadonlyTransaction,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<MultiDimDataPageConfigPreProcessed> {
    const allCatalogPaths = rawConfig.views
        .flatMap((view) =>
            Object.values(view.indicators).flatMap((indicatorOrIndicators) =>
                Array.isArray(indicatorOrIndicators)
                    ? indicatorOrIndicators
                    : [indicatorOrIndicators]
            )
        )
        .filter((indicator) => typeof indicator === "string")

    const catalogPathToIndicatorIdMap = await getVariableIdsByCatalogPath(
        allCatalogPaths,
        knex
    )

    const missingCatalogPaths = new Set(
        allCatalogPaths.filter(
            (indicator) => !catalogPathToIndicatorIdMap.has(indicator)
        )
    )

    if (missingCatalogPaths.size > 0) {
        throw new Error(
            `Could not find the following catalog paths for MDD ${rawConfig.title} in the database: ${Array.from(
                missingCatalogPaths
            ).join(", ")}`
        )
    }

    function resolveSingleField(indicator?: IndicatorEntryBeforePreProcessing) {
        if (typeof indicator === "string") {
            const indicatorId = catalogPathToIndicatorIdMap.get(indicator)
            return indicatorId ?? undefined
        }
        return indicator
    }

    function resolveSingleOrArrayField(
        indicator:
            | IndicatorEntryBeforePreProcessing
            | IndicatorEntryBeforePreProcessing[]
    ) {
        const indicatorIds = []
        if (Array.isArray(indicator)) {
            for (const item of indicator) {
                const resolved = resolveSingleField(item)
                if (resolved) indicatorIds.push(resolved)
            }
        } else {
            const resolved = resolveSingleField(indicator)
            if (resolved) indicatorIds.push(resolved)
        }
        return indicatorIds
    }

    return {
        ...rawConfig,
        views: rawConfig.views.map((view) => ({
            ...view,
            indicators: {
                y: resolveSingleOrArrayField(view.indicators.y),
                x: resolveSingleField(view.indicators.x),
                size: resolveSingleField(view.indicators.size),
                color: resolveSingleField(view.indicators.color),
            },
        })),
    }
}

async function getViewIdToChartConfigIdMap(
    knex: db.KnexReadonlyTransaction,
    slug: string
) {
    const rows = await db.knexRaw<DbPlainMultiDimXChartConfig>(
        knex,
        `-- sql
        SELECT viewId, chartConfigId
        FROM multi_dim_x_chart_configs mdxcc
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mddp.slug = ?`,
        [slug]
    )
    return new Map(
        rows.map((row) => [row.viewId, row.chartConfigId as Base64String])
    )
}

async function saveMultiDimConfig(
    knex: db.KnexReadWriteTransaction,
    slug: string,
    config: MultiDimDataPageConfigEnriched
) {
    const id = await upsertMultiDimDataPage(knex, {
        slug,
        config: JSON.stringify(config),
    })
    if (id === 0) {
        // There are no updates to the config, return the existing id.
        console.debug(`There are no changes to multi dim config slug=${slug}`)
        const result = await knex<DbPlainMultiDimDataPage>(
            MultiDimDataPagesTableName
        )
            .select("id")
            .where({ slug })
            .first()
        return result!.id
    }
    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const result = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("config", "configMd5")
        .where({ id })
        .first()
    const { config: normalizedConfig, configMd5 } = result!
    await saveMultiDimConfigToR2(normalizedConfig, slug, configMd5)
    return id
}

async function cleanUpOrphanedChartConfigs(
    knex: db.KnexReadWriteTransaction,
    orphanedChartConfigIds: string[]
) {
    await knex<DbPlainMultiDimXChartConfig>(MultiDimXChartConfigsTableName)
        .whereIn("chartConfigId", orphanedChartConfigIds)
        .delete()
    await knex<DbRawChartConfig>(ChartConfigsTableName)
        .whereIn("id", orphanedChartConfigIds)
        .delete()
    for (const id of orphanedChartConfigIds) {
        await deleteGrapherConfigFromR2ByUUID(id)
    }
}

export async function createMultiDimConfig(
    knex: db.KnexReadWriteTransaction,
    slug: string,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<number> {
    const config = await resolveMultiDimDataPageCatalogPathsToIndicatorIds(
        knex,
        rawConfig
    )
    const variableConfigs = await getMergedGrapherConfigsForVariables(
        knex,
        uniq(config.views.map((view) => view.indicators.y[0]))
    )
    const existingViewIdsToChartConfigIds = await getViewIdToChartConfigIdMap(
        knex,
        slug
    )
    const reusedChartConfigIds = new Set<string>()
    const { grapherConfigSchema } = config
    // TODO: Remove when we build a way to publish mdims in the admin.
    const isPublished = await isMultiDimDataPagePublished(knex, slug)

    const enrichedViews = await Promise.all(
        config.views.map(async (view) => {
            const variableId = view.indicators.y[0]
            // Main config for each view.
            const mainGrapherConfig: GrapherInterface = {
                $schema: defaultGrapherConfig.$schema,
                dimensions: MultiDimDataPageConfig.viewToDimensionsConfig(view),
                selectedEntityNames: config.defaultSelection ?? [],
                slug,
            }
            if (isPublished) {
                mainGrapherConfig.isPublished = true
            }
            let viewGrapherConfig = {}
            if (view.config) {
                viewGrapherConfig = grapherConfigSchema
                    ? { $schema: grapherConfigSchema, ...view.config }
                    : view.config
                if ("$schema" in viewGrapherConfig) {
                    viewGrapherConfig =
                        migrateGrapherConfigToLatestVersion(viewGrapherConfig)
                }
            }
            const patchGrapherConfig = mergeGrapherConfigs(
                viewGrapherConfig,
                mainGrapherConfig
            )
            const fullGrapherConfig = mergeGrapherConfigs(
                variableConfigs.get(variableId) ?? {},
                patchGrapherConfig
            )
            const existingChartConfigId = existingViewIdsToChartConfigIds.get(
                dimensionsToViewId(view.dimensions)
            )
            let chartConfigId
            if (existingChartConfigId) {
                chartConfigId = existingChartConfigId
                await updateChartConfigInDbAndR2(
                    knex,
                    chartConfigId,
                    patchGrapherConfig,
                    fullGrapherConfig
                )
                reusedChartConfigIds.add(chartConfigId)
                console.debug(`Chart config updated id=${chartConfigId}`)
            } else {
                const result = await saveNewChartConfigInDbAndR2(
                    knex,
                    undefined,
                    patchGrapherConfig,
                    fullGrapherConfig
                )
                chartConfigId = result.chartConfigId
                console.debug(`Chart config created id=${chartConfigId}`)
            }
            return { ...view, fullConfigId: chartConfigId }
        })
    )

    const orphanedChartConfigIds = Array.from(
        existingViewIdsToChartConfigIds.values()
    ).filter((id) => !reusedChartConfigIds.has(id))
    await cleanUpOrphanedChartConfigs(knex, orphanedChartConfigIds)

    const enrichedConfig = { ...config, views: enrichedViews }
    const multiDimId = await saveMultiDimConfig(knex, slug, enrichedConfig)
    for (const view of enrichedConfig.views) {
        await upsertMultiDimXChartConfigs(knex, {
            multiDimId,
            viewId: dimensionsToViewId(view.dimensions),
            variableId: view.indicators.y[0],
            chartConfigId: view.fullConfigId,
        })
    }
    return multiDimId
}
