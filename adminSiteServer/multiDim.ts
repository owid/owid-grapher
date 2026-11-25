import * as _ from "lodash-es"

import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    IndicatorConfig,
    IndicatorEntryBeforePreProcessing,
    IndicatorsBeforePreProcessing,
    JsonError,
    MultiDimDataPageConfigEnriched,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
    MultiDimXChartConfigsTableName,
    MultiDimViewDimensionsTableName,
    NarrativeChartsTableName,
    R2GrapherConfigDirectory,
    View,
} from "@ourworldindata/types"
import { mergeGrapherConfigs, dimensionsToViewId } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import {
    buildMdimViewPatchConfig,
    getMdimViewConfigWithSchema,
    upsertMultiDimDataPage,
} from "../db/model/MultiDimDataPage.js"
import { parseAndMigrateChartConfig } from "../db/model/ChartConfigs.js"
import {
    assertValidGrapherConfig,
    ingestGrapherConfig,
} from "../db/grapherConfigValidation.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getIndicatorChartConfigs,
    getIndicatorIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    deleteGrapherConfigFromR2,
    deleteGrapherConfigsFromR2ByUuid,
    saveMultiDimConfigToR2,
} from "../serverUtils/r2/chartConfigR2Helpers.js"
import {
    saveNewChartConfigInDbAndR2,
    updateChartConfigInDbAndR2,
} from "./chartConfigHelpers.js"

function catalogPathFromIndicatorEntry(
    entry: IndicatorEntryBeforePreProcessing
): string | undefined {
    if (typeof entry === "string") return entry
    if (typeof entry === "object" && "catalogPath" in entry) {
        return entry.catalogPath
    }
    return undefined
}

function getAllCatalogPaths(views: View<IndicatorsBeforePreProcessing>[]) {
    const paths = []
    for (const view of views) {
        const { y, x, size, color } = view.indicators
        if (y) {
            if (Array.isArray(y)) {
                paths.push(...y.map(catalogPathFromIndicatorEntry))
            } else {
                paths.push(catalogPathFromIndicatorEntry(y))
            }
        }
        for (const entry of [x, size, color]) {
            if (entry) paths.push(catalogPathFromIndicatorEntry(entry))
        }
    }
    return paths.filter((path) => path !== undefined)
}

async function resolveMultiDimDataPageCatalogPathsToIndicatorIds(
    knex: db.KnexReadonlyTransaction,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<MultiDimDataPageConfigPreProcessed> {
    const allCatalogPaths = getAllCatalogPaths(rawConfig.views)

    const catalogPathToIndicatorIdMap = await getIndicatorIdsByCatalogPath(
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

    function resolveSingleField(
        indicator?: IndicatorEntryBeforePreProcessing
    ): IndicatorConfig | undefined {
        if (typeof indicator === "number") return { id: indicator }
        if (typeof indicator === "string") {
            const id = catalogPathToIndicatorIdMap.get(indicator)
            return id ? { id } : undefined
        }
        if (typeof indicator === "object") {
            if ("id" in indicator) return indicator
            if ("catalogPath" in indicator) {
                const id = catalogPathToIndicatorIdMap.get(
                    indicator.catalogPath
                )
                return id ? { ...indicator, id } : undefined
            }
        }
        return undefined
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

type ExistingView = Pick<
    DbPlainMultiDimXChartConfig,
    "chartConfigId" | "variableId"
>

async function getExistingViewsByViewId(
    knex: db.KnexReadonlyTransaction,
    catalogPath: string
): Promise<Map<string, ExistingView>> {
    const rows = await db.knexRaw<
        Pick<
            DbPlainMultiDimXChartConfig,
            "viewId" | "chartConfigId" | "variableId"
        >
    >(
        knex,
        `-- sql
        SELECT viewId, chartConfigId, variableId
        FROM multi_dim_x_chart_configs mdxcc
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mddp.catalogPath = ?`,
        [catalogPath]
    )
    return new Map(
        rows.map(({ viewId, chartConfigId, variableId }) => [
            viewId,
            { chartConfigId, variableId },
        ])
    )
}

async function retrieveMultiDimConfigFromDbAndSaveToR2(
    knex: db.KnexReadonlyTransaction,
    id: number
) {
    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const result = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("slug", "config", "configMd5", "published")
        .where({ id })
        .first()
    const { slug, config: normalizedConfig, configMd5, published } = result!
    // Like charts, only published multi-dims are stored by slug, since the
    // site serves their config, data and images from there.
    if (slug && published) {
        await saveMultiDimConfigToR2(normalizedConfig, slug, configMd5)
    }
}

async function upsertMultiDimConfig(
    knex: db.KnexReadWriteTransaction,
    catalogPath: string,
    config: MultiDimDataPageConfigEnriched
) {
    const id = await upsertMultiDimDataPage(knex, {
        catalogPath,
        config: JSON.stringify(config),
    })
    if (id === 0) {
        // There are no updates to the config, return the existing id.
        console.debug(
            `There are no changes to multi dim config catalogPath=${catalogPath}`
        )
        const result = await knex<DbPlainMultiDimDataPage>(
            MultiDimDataPagesTableName
        )
            .select("id")
            .where({ catalogPath })
            .first()
        return result!.id
    }
    await retrieveMultiDimConfigFromDbAndSaveToR2(knex, id)
    return id
}

async function cleanUpOrphanedChartConfigs(
    knex: db.KnexReadWriteTransaction,
    orphanedChartConfigIds: string[]
) {
    if (orphanedChartConfigIds.length === 0) return

    await knex<DbPlainMultiDimXChartConfig>(MultiDimXChartConfigsTableName)
        .whereIn("chartConfigId", orphanedChartConfigIds)
        .delete()

    await knex<DbRawChartConfig>(ChartConfigsTableName)
        .whereIn("id", orphanedChartConfigIds)
        .delete()

    // Delete the R2 copies only once the transaction commits. Deleting them
    // inside it holds the row locks above until every R2 request finishes,
    // and a rollback after the deletes leaves the restored configs without
    // their R2 copies. An orphaned config isn't referenced anywhere, so a
    // failed delete only leaves an unused object behind and we just log it.
    knex.executionPromise.then(
        () =>
            deleteGrapherConfigsFromR2ByUuid(
                orphanedChartConfigIds,
                logErrorAndMaybeCaptureInSentry
            ),
        // A rolled-back transaction keeps the configs, so there is nothing to delete
        () => undefined
    )
}

export async function upsertMultiDim(
    knex: db.KnexReadWriteTransaction,
    catalogPath: string,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<number> {
    // Lock the multi-dim's row first, so that concurrent upserts of the same
    // multi-dim (e.g. an ETL retry while the first request is still running)
    // run one after another. Without it, both work out the same orphaned views
    // and the second one fails deep in the upsert, waiting on the first one's
    // row locks. A multi-dim that doesn't exist yet has no row to lock.
    // Publishing and deleting lock the row first too (see
    // getMultiDimDataPageByIdForUpdate), so the writers can't deadlock.
    const existingMultiDim = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("published")
        .where({ catalogPath })
        .forUpdate()
        .first()
    const config = await resolveMultiDimDataPageCatalogPathsToIndicatorIds(
        knex,
        rawConfig
    )
    validateViewConfigs(config)
    validateDimensionPresentations(config)
    const indicatorConfigs = await getIndicatorChartConfigs(
        knex,
        _.uniq(config.views.map((view) => view.indicators.y[0].id))
    )
    const existingIsPublished = existingMultiDim
        ? Boolean(existingMultiDim.published)
        : undefined
    const existingViews = await getExistingViewsByViewId(knex, catalogPath)
    const reusedChartConfigIds = new Set<string>()

    const preparedViews = config.views.map((view) => {
        const variableId = view.indicators.y[0].id
        const patchGrapherConfig = buildMdimViewPatchConfig(
            config,
            view,
            existingIsPublished
        )
        const fullGrapherConfig = mergeGrapherConfigs(
            indicatorConfigs.get(variableId) ?? {},
            patchGrapherConfig
        )

        assertValidGrapherConfig(fullGrapherConfig)

        return { view, fullGrapherConfig }
    })

    const enrichedViews = await Promise.all(
        preparedViews.map(async ({ view, fullGrapherConfig }) => {
            const existingChartConfigId = existingViews.get(
                dimensionsToViewId(view.dimensions)
            )?.chartConfigId
            let chartConfigId
            if (existingChartConfigId) {
                chartConfigId = existingChartConfigId
                await updateChartConfigInDbAndR2(
                    knex,
                    chartConfigId,
                    fullGrapherConfig
                )
                reusedChartConfigIds.add(chartConfigId)
                console.debug(`Chart config updated id=${chartConfigId}`)
            } else {
                const result = await saveNewChartConfigInDbAndR2(
                    knex,
                    fullGrapherConfig
                )
                chartConfigId = result.chartConfigId
                await knex(MultiDimViewDimensionsTableName).insert({
                    chartConfigId,
                    dimensions: JSON.stringify(view.dimensions),
                })
                console.debug(`Chart config created id=${chartConfigId}`)
            }
            return { ...view, fullConfigId: chartConfigId }
        })
    )

    const orphanedChartConfigIds = existingViews
        .values()
        .map((existingView) => existingView.chartConfigId)
        .filter((chartConfigId) => !reusedChartConfigIds.has(chartConfigId))
        .toArray()
    await cleanUpOrphanedChartConfigs(knex, orphanedChartConfigIds)

    const enrichedConfig = { ...config, views: enrichedViews }
    const multiDimId = await upsertMultiDimConfig(
        knex,
        catalogPath,
        enrichedConfig
    )
    for (const view of enrichedConfig.views) {
        const viewId = dimensionsToViewId(view.dimensions)
        const variableId = view.indicators.y[0].id
        const existingView = existingViews.get(viewId)
        // Skip unchanged rows: each upsert takes locks that concurrent
        // upserts of other multi-dims can deadlock on.
        if (
            existingView?.chartConfigId === view.fullConfigId &&
            existingView.variableId === variableId
        )
            continue
        await upsertMultiDimXChartConfigs(knex, {
            multiDimId,
            viewId,
            variableId,
            chartConfigId: view.fullConfigId,
        })
    }
    return multiDimId
}

/** Throws if a dimension explicitly configured as a toggle group has grouped choices */
function validateDimensionPresentations(
    config: MultiDimDataPageConfigPreProcessed
): void {
    for (const dimension of config.dimensions) {
        if (
            dimension.presentation?.type === "toggle-buttons" &&
            dimension.choices.some((choice) => choice.group)
        ) {
            throw new JsonError(
                `Dimension "${dimension.slug}" is configured as a toggle group, ` +
                    `but has grouped choices. Choice groups are only supported in dropdowns.`
            )
        }
    }
}

/** Throws if any view config declares no schema version or fails validation */
function validateViewConfigs(config: MultiDimDataPageConfigPreProcessed): void {
    for (const view of config.views) {
        const viewConfig = getMdimViewConfigWithSchema(config, view)
        if (viewConfig) ingestGrapherConfig(viewConfig)
    }
}

async function getViewChartConfigs(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
): Promise<Map<string, GrapherInterface>> {
    const rows = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "config")
        .whereIn("id", ids)
    return new Map(
        rows.map((row) => [row.id, parseAndMigrateChartConfig(row.config)])
    )
}

export async function setMultiDimPublished(
    knex: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    published: boolean
) {
    const viewConfigs = await getViewChartConfigs(
        knex,
        multiDim.config.views.map((view) => view.fullConfigId)
    )

    await Promise.all(
        multiDim.config.views.map(async (view) => {
            const { fullConfigId: chartConfigId } = view
            const config = viewConfigs.get(chartConfigId)
            if (!config) {
                throw new JsonError(
                    `Chart config not found id=${chartConfigId}`,
                    404
                )
            }
            config.isPublished = published
            await updateChartConfigInDbAndR2(knex, chartConfigId, config)
        })
    )

    await knex(MultiDimDataPagesTableName)
        .where({ id: multiDim.id })
        .update({ published })
    if (published) {
        await retrieveMultiDimConfigFromDbAndSaveToR2(knex, multiDim.id)
    } else if (multiDim.slug) {
        await deleteGrapherConfigFromR2(
            R2GrapherConfigDirectory.multiDim,
            `${multiDim.slug}.json`
        )
    }
    return { ...multiDim, published }
}

export async function setMultiDimSlug(
    knex: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    slug: string
) {
    await knex(MultiDimDataPagesTableName)
        .where({ id: multiDim.id })
        .update({ slug })
    await deleteGrapherConfigFromR2(
        R2GrapherConfigDirectory.multiDim,
        `${multiDim.slug}.json`
    )
    await retrieveMultiDimConfigFromDbAndSaveToR2(knex, multiDim.id)
    return { ...multiDim, slug }
}

/** Deletes an unpublished multi-dim together with its view chart configs.
 *  Rows in multi_dim_view_dimensions are kept, since that table is append-only
 *  (analytics use it to resolve chart config ids of past views). */
export async function deleteUnpublishedMultiDim(
    knex: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage
): Promise<void> {
    if (multiDim.published) {
        throw new JsonError(
            "Cannot delete a published multi-dim. Unpublish it first.",
            400
        )
    }

    const narrativeCharts = await db.knexRaw<{ name: string }>(
        knex,
        `-- sql
        SELECT nc.name
        FROM ${NarrativeChartsTableName} nc
        JOIN ${MultiDimXChartConfigsTableName} mdxcc
            ON mdxcc.id = nc.parentMultiDimXChartConfigId
        WHERE mdxcc.multiDimId = ?`,
        [multiDim.id]
    )
    if (narrativeCharts.length > 0) {
        throw new JsonError(
            `Cannot delete multi-dim: narrative charts are based on it (${narrativeCharts.map((nc) => nc.name).join(", ")}). Please delete them first.`,
            400
        )
    }

    const chartConfigIds = (
        await knex<DbPlainMultiDimXChartConfig>(MultiDimXChartConfigsTableName)
            .select("chartConfigId")
            .where({ multiDimId: multiDim.id })
    ).map((row) => row.chartConfigId)

    // Redirects only take effect once a multi-dim is published, so the ones
    // pointing to an unpublished multi-dim are inactive and can go with it.
    await knex(MultiDimRedirectsTableName)
        .where({ multiDimId: multiDim.id })
        .delete()
    await knex(MultiDimXChartConfigsTableName)
        .where({ multiDimId: multiDim.id })
        .delete()
    await knex(ChartConfigsTableName).whereIn("id", chartConfigIds).delete()
    await knex(MultiDimDataPagesTableName).where({ id: multiDim.id }).delete()

    // R2 deletions can't be rolled back, so a failure must not roll back the
    // DB deletes above: that would restore a multi-dim whose configs are
    // already partly gone from R2. A leftover config of a deleted, unpublished
    // multi-dim isn't served anywhere, so we only log the failure.
    await deleteGrapherConfigsFromR2ByUuid(
        chartConfigIds,
        logErrorAndMaybeCaptureInSentry
    )
    if (multiDim.slug) {
        await deleteGrapherConfigFromR2(
            R2GrapherConfigDirectory.multiDim,
            `${multiDim.slug}.json`
        ).catch(logErrorAndMaybeCaptureInSentry)
    }
}
