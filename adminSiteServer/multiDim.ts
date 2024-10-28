import { uniq } from "lodash"
import { uuidv7 } from "uuidv7"

import {
    Base64String,
    DbPlainMultiDimDataPage,
    DbRawChartConfig,
    GrapherInterface,
    IndicatorEntryBeforePreProcessing,
    MultiDimDataPageConfigEnriched,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
    serializeChartConfig,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { upsertMultiDimDataPage } from "../db/model/MultiDimDataPage.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getMergedGrapherConfigsForVariables,
    getVariableIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    saveGrapherConfigToR2ByUUID,
    saveMultiDimConfigToR2,
} from "./chartConfigR2Helpers.js"

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
        console.warn(
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
    const enrichedViews = await Promise.all(
        config.views.map(async (view) => {
            const variableId = view.indicators.y[0]
            const fullGrapherConfig = {
                ...variableConfigs.get(variableId),
                ...view.config,
                dimensions: MultiDimDataPageConfig.viewToDimensionsConfig(view),
                selectedEntityNames: config.defaultSelection ?? [],
            }
            const chartConfigId = await saveNewMultiDimViewChartConfig(
                knex,
                view.config || {},
                fullGrapherConfig
            )
            return { ...view, fullConfigId: chartConfigId }
        })
    )
    const enrichedConfig = { ...config, views: enrichedViews }
    const multiDimId = await saveMultiDimConfig(knex, slug, enrichedConfig)
    for (const view of enrichedConfig.views) {
        await upsertMultiDimXChartConfigs(knex, {
            multiDimId,
            variableId: view.indicators.y[0],
            chartConfigId: view.fullConfigId,
        })
    }
    return multiDimId
}
