import { uniq } from "lodash"
import { uuidv7 } from "uuidv7"

import {
    Base64String,
    ChartConfigsTableName,
    DbInsertChartConfig,
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
    serializeChartConfig,
} from "@ourworldindata/types"
import {
    mergeGrapherConfigs,
    MultiDimDataPageConfig,
    slugify,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { upsertMultiDimDataPage } from "../db/model/MultiDimDataPage.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getMergedGrapherConfigsForVariables,
    getVariableIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    deleteGrapherConfigFromR2ByUUID,
    saveGrapherConfigToR2ByUUID,
    saveMultiDimConfigToR2,
} from "./chartConfigR2Helpers.js"

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
    const mapping = new Map<string, string>()
    const rows = await db.knexRaw<DbPlainMultiDimXChartConfig>(
        knex,
        `-- sql
        SELECT viewId, chartConfigId
        FROM multi_dim_x_chart_configs mdxcc
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mddp.slug = ?`,
        [slug]
    )
    for (const { viewId, chartConfigId } of rows) {
        mapping.set(viewId, chartConfigId)
    }
    return mapping
}

async function saveNewMultiDimViewChartConfig(
    knex: db.KnexReadWriteTransaction,
    patchConfig: GrapherInterface,
    fullConfig: GrapherInterface
): Promise<string> {
    const chartConfigId = uuidv7()
    await db.knexRaw(
        knex,
        `-- sql
            INSERT INTO chart_configs (id, patch, full)
            VALUES (?, ?, ?)
        `,
        [
            chartConfigId,
            serializeChartConfig(patchConfig),
            serializeChartConfig(fullConfig),
        ]
    )

    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const fullConfigMd5 = await db.knexRawFirst<
        Pick<DbRawChartConfig, "full" | "fullMd5">
    >(
        knex,
        `-- sql
            select full, fullMd5 from chart_configs where id = ?`,
        [chartConfigId]
    )

    await saveGrapherConfigToR2ByUUID(
        chartConfigId,
        fullConfigMd5!.full,
        fullConfigMd5!.fullMd5 as Base64String
    )

    console.debug(`Chart config created id=${chartConfigId}`)
    return chartConfigId
}

async function updateMultiDimViewChartConfig(
    knex: db.KnexReadWriteTransaction,
    chartConfigId: string,
    patchConfig: GrapherInterface,
    fullConfig: GrapherInterface
): Promise<string> {
    await knex<DbInsertChartConfig>(ChartConfigsTableName)
        .update({
            patch: serializeChartConfig(patchConfig),
            full: serializeChartConfig(fullConfig),
        })
        .where({ id: chartConfigId })

    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const fullConfigMd5 = await db.knexRawFirst<
        Pick<DbRawChartConfig, "full" | "fullMd5">
    >(
        knex,
        `-- sql
            select full, fullMd5 from chart_configs where id = ?`,
        [chartConfigId]
    )

    await saveGrapherConfigToR2ByUUID(
        chartConfigId,
        fullConfigMd5!.full,
        fullConfigMd5!.fullMd5 as Base64String
    )

    console.debug(`Chart config updated id=${chartConfigId}`)
    return chartConfigId
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

    const enrichedViews = await Promise.all(
        config.views.map(async (view) => {
            const variableId = view.indicators.y[0]
            const patchGrapherConfig = view.config || {}
            const fullGrapherConfig = mergeGrapherConfigs(
                variableConfigs.get(variableId) ?? {},
                patchGrapherConfig,
                {
                    dimensions:
                        MultiDimDataPageConfig.viewToDimensionsConfig(view),
                    selectedEntityNames: config.defaultSelection ?? [],
                }
            )
            const existingChartConfigId = existingViewIdsToChartConfigIds.get(
                dimensionsToViewId(view.dimensions)
            )
            let chartConfigId
            if (existingChartConfigId) {
                chartConfigId = existingChartConfigId
                await updateMultiDimViewChartConfig(
                    knex,
                    chartConfigId,
                    patchGrapherConfig,
                    fullGrapherConfig
                )
                reusedChartConfigIds.add(chartConfigId)
            } else {
                chartConfigId = await saveNewMultiDimViewChartConfig(
                    knex,
                    patchGrapherConfig,
                    fullGrapherConfig
                )
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
