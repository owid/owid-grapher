import * as _ from "lodash-es"
import * as R from "remeda"
import { migrateGrapherConfigToLatestVersionAndFailOnError } from "@ourworldindata/grapher"
import {
    GrapherInterface,
    JsonError,
    DbPlainUser,
    Base64String,
    parseChartConfig,
    serializeChartConfig,
    DbPlainChart,
    R2GrapherConfigDirectory,
    DbInsertChartRevision,
    DbRawChartConfig,
    ChartConfigsTableName,
    DbChartTagJoin,
    ContentGraphLinkType,
    StaticVizTableName,
    DbPlainAnalyticsGrapherView,
    AnalyticsGrapherViewWithRank,
} from "@ourworldindata/types"
import {
    diffGrapherConfigs,
    mergeGrapherConfigs,
    parseIntOrUndefined,
    omitUndefinedValues,
} from "@ourworldindata/utils"
import { v7 as uuidv7, validate as uuidValidate } from "uuid"
import {
    References,
    StaticVizReference,
} from "../../adminSiteClient/AbstractChartEditor.js"
import { NarrativeChartMinimalInformation } from "../../adminSiteClient/ChartEditor.js"
import {
    getChartConfigById,
    getChartIdByConfigId,
    getForceDatapageByChartId,
    getPatchConfigByChartId,
    getParentByChartConfig,
    isInheritanceEnabledForChart,
    OldChartFieldList,
    oldChartFieldList,
    assignTagsForCharts,
    getParentByChartId,
    getRedirectsByChartId,
    getChartSlugById,
    setChartTags,
} from "../../db/model/Chart.js"
import {
    getWordpressPostReferencesByChartId,
    getGdocsPostReferencesByChartId,
} from "../../db/model/Post.js"
import { UpdatedChartInheritanceRecord } from "../../db/model/Variable.js"
import { enqueueExplorerRefreshJobsForDependencies } from "../../db/model/Explorer.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    retrieveChartConfigFromDbAndSaveToR2,
    updateChartConfigInDbAndR2,
} from "../chartConfigHelpers.js"
import {
    deleteGrapherConfigFromR2,
    deleteGrapherConfigFromR2ByUUID,
    saveGrapherConfigToR2ByUUID,
} from "../../serverUtils/r2/chartConfigR2Helpers.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import * as db from "../../db/db.js"
import { getLogsByChartId } from "../getLogsByChartId.js"
import { getChartsRecords } from "../../baker/algolia/utils/charts.js"

import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import { DataInsightMinimalInformation } from "../../adminShared/AdminTypes.js"
import {
    validateNewGrapherSlug,
    validateDraftGrapherSlug,
} from "../validation.js"

export const getReferencesByChartId = async (
    chartId: number,
    knex: db.KnexReadonlyTransaction
): Promise<References> => {
    const postsWordpressPromise = getWordpressPostReferencesByChartId(
        chartId,
        knex
    )
    const postGdocsPromise = getGdocsPostReferencesByChartId(chartId, knex)
    const explorerSlugsPromise = db.knexRaw<{ explorerSlug: string }>(
        knex,
        `SELECT DISTINCT
            explorerSlug
        FROM
            explorer_charts
        WHERE
            chartId = ?`,
        [chartId]
    )
    const narrativeChartsPromise = db.knexRaw<NarrativeChartMinimalInformation>(
        knex,
        `-- sql
        SELECT nc.id, nc.name, cc.full ->> "$.title" AS title
        FROM narrative_charts nc
        JOIN chart_configs cc ON cc.id = nc.chartConfigId
        WHERE nc.parentChartId = ?`,
        [chartId]
    )
    const chartSlugsPromise = db.knexRaw<{ targetSlug: string }>(
        knex,
        `-- sql
        SELECT cc.slug AS targetSlug
        FROM charts c
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE c.id = ?

        UNION ALL

        SELECT cr.slug AS targetSlug
        FROM chart_slug_redirects cr
        WHERE cr.chart_id = ?`,
        [chartId, chartId]
    )
    const staticVizPromise = chartSlugsPromise.then((slugRows) => {
        const uniqueSlugs = Array.from(
            new Set(slugRows.map((row) => row.targetSlug).filter(Boolean))
        )
        if (!uniqueSlugs.length) return [] as StaticVizReference[]
        const placeholders = uniqueSlugs.map(() => "?").join(", ")
        return db.knexRaw<StaticVizReference>(
            knex,
            `-- sql
            SELECT
                sv.id,
                sv.name,
                sv.grapherSlug,
                '${ContentGraphLinkType.StaticViz}' AS type
            FROM ${StaticVizTableName} sv
            WHERE sv.grapherSlug IN (${placeholders})`,
            uniqueSlugs
        )
    })
    const dataInsightsPromise = db.knexRaw<DataInsightMinimalInformation>(
        knex,
        `-- sql
        WITH chart_slugs AS (
            SELECT cc.slug as main_slug, c.id as chart_id
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE c.id = ? AND cc.slug != '' AND cc.slug IS NOT NULL

            UNION ALL

            SELECT cr.slug as main_slug, c.id as chart_id
            FROM charts c
            JOIN chart_slug_redirects cr ON cr.chart_id = c.id
            WHERE c.id = ? AND cr.slug != '' AND cr.slug IS NOT NULL
        ),
        gdoc_grapher_slugs AS (
            SELECT
                pg.id,
                pg.slug,
                pg.type,
                pg.content ->> '$.title' AS title,
                pg.published,
                pg.content ->> '$."narrative-chart"' AS narrativeChart,
                pg.content ->> '$."figma-url"' AS figmaUrl,
                SUBSTRING_INDEX(SUBSTRING_INDEX(pg.content ->> '$."grapher-url"', '/grapher/', -1), '\\?', 1) AS extracted_slug,
                -- prepare for a join on the images table by filename (only works for data insights where the image block comes first)
                COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename') AS image_filename
            FROM posts_gdocs pg
            WHERE pg.type = 'data-insight'
        )
        SELECT
            ggs.id AS gdocId,
            ggs.slug,
            ggs.type,
            ggs.title,
            ggs.published,
            ggs.narrativeChart,
            ggs.figmaUrl,
            JSON_OBJECT(
                'id', i.id,
                'filename', i.filename,
                'cloudflareId', i.cloudflareId,
                'originalWidth', i.originalWidth
            ) AS image
        FROM gdoc_grapher_slugs ggs
        JOIN chart_slugs cs ON cs.main_slug = ggs.extracted_slug
        LEFT JOIN images i ON i.filename = ggs.image_filename AND i.replacedBy IS NULL`,
        [chartId, chartId]
    )
    const [
        postsWordpress,
        postsGdocs,
        explorerSlugs,
        narrativeCharts,
        dataInsights,
        staticVizReferences,
    ] = await Promise.all([
        postsWordpressPromise,
        postGdocsPromise,
        explorerSlugsPromise,
        narrativeChartsPromise,
        dataInsightsPromise,
        staticVizPromise,
    ])

    return {
        postsGdocs,
        postsWordpress,
        explorers: explorerSlugs.map(
            (row: { explorerSlug: string }) => row.explorerSlug
        ),
        narrativeCharts,
        dataInsights,
        staticViz: staticVizReferences,
    }
}

/**
 * Resolves a value that is either a numeric chart id or a chart's config UUID
 * (`charts.configId`) to the numeric chart id. Route handlers use this so that
 * `:chartId` params accept both forms of addressing a chart.
 */
export const expectChartId = async (
    knex: db.KnexReadonlyTransaction,
    chartIdOrConfigId: string | number | undefined
): Promise<number> => {
    if (
        typeof chartIdOrConfigId === "number" ||
        (typeof chartIdOrConfigId === "string" &&
            /^\d+$/.test(chartIdOrConfigId))
    )
        return expectInt(chartIdOrConfigId)

    if (
        typeof chartIdOrConfigId === "string" &&
        uuidValidate(chartIdOrConfigId)
    ) {
        const chartId = await getChartIdByConfigId(knex, chartIdOrConfigId)
        if (chartId === undefined)
            throw new JsonError(
                `No chart found for config id ${chartIdOrConfigId}`,
                404
            )
        return chartId
    }

    throw new JsonError(
        `Expected integer chart id or config UUID, got '${chartIdOrConfigId}'`,
        400
    )
}

export const expectChartById = async (
    knex: db.KnexReadonlyTransaction,
    chartIdOrConfigId: string | number | undefined
): Promise<GrapherInterface> => {
    const chartId = await expectChartId(knex, chartIdOrConfigId)
    const chart = await getChartConfigById(knex, chartId)
    if (chart) return chart.config

    throw new JsonError(`No chart found for id ${chartIdOrConfigId}`, 404)
}

const expectPatchConfigByChartId = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<GrapherInterface> => {
    const patchConfig = await getPatchConfigByChartId(knex, chartId)
    if (!patchConfig) {
        throw new JsonError(`No chart found for id ${chartId}`, 404)
    }
    return patchConfig
}

const saveNewChart = async (
    knex: db.KnexReadWriteTransaction,
    {
        config,
        user,
        forceDatapage = false,
        // new charts inherit by default
        shouldInherit = true,
        chartConfigId: providedChartConfigId,
    }: {
        config: GrapherInterface
        user: DbPlainUser
        forceDatapage?: boolean
        shouldInherit?: boolean
        // callers may supply the new chart's config UUID (e.g. the ETL, which
        // generates the chart's identity client-side); otherwise one is generated
        chartConfigId?: string
    }
): Promise<{
    chartConfigId: Base64String
    patchConfig: GrapherInterface
    fullConfig: GrapherInterface
}> => {
    if (providedChartConfigId) {
        if (!uuidValidate(providedChartConfigId))
            throw new JsonError(
                `Invalid config UUID '${providedChartConfigId}'`,
                400
            )
        const existingRow = await db.knexRawFirst<Pick<DbRawChartConfig, "id">>(
            knex,
            `SELECT id FROM chart_configs WHERE id = ?`,
            [providedChartConfigId]
        )
        if (existingRow)
            throw new JsonError(
                `A chart config with id ${providedChartConfigId} already exists`,
                409
            )
    }

    // grab the parent of the chart if inheritance should be enabled
    const parent = shouldInherit
        ? await getParentByChartConfig(knex, config)
        : undefined

    // compute patch and full configs
    const patchConfig = diffGrapherConfigs(config, parent?.config ?? {})
    const fullConfig = mergeGrapherConfigs(parent?.config ?? {}, patchConfig)

    const now = new Date()

    // insert patch & full configs into the chart_configs table
    // We can't quite use `saveNewChartConfigInDbAndR2` here, because
    // we need to update the chart id in the config after inserting it.
    const chartConfigId = (providedChartConfigId ?? uuidv7()) as Base64String
    await db.knexRaw(
        knex,
        `-- sql
            INSERT INTO chart_configs (id, patch, full, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?)
        `,
        [
            chartConfigId,
            serializeChartConfig(patchConfig),
            serializeChartConfig(fullConfig),
            now,
            now,
        ]
    )

    // add a new chart to the charts table
    const result = await db.knexRawInsert(
        knex,
        `-- sql
            INSERT INTO charts (
                configId,
                isInheritanceEnabled,
                forceDatapage,
                createdAt,
                updatedAt,
                lastEditedAt,
                lastEditedByUserId
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [chartConfigId, shouldInherit, forceDatapage, now, now, now, user.id]
    )

    // The chart config itself has an id field that should store the id of the chart - update the chart now so this is true
    const chartId = result.insertId
    patchConfig.id = chartId
    fullConfig.id = chartId
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs cc
            JOIN charts c ON c.configId = cc.id
            SET
                cc.patch=JSON_SET(cc.patch, '$.id', ?),
                cc.full=JSON_SET(cc.full, '$.id', ?)
            WHERE c.id = ?
        `,
        [chartId, chartId, chartId]
    )

    await retrieveChartConfigFromDbAndSaveToR2(knex, chartConfigId)

    return { chartConfigId, patchConfig, fullConfig }
}

const updateExistingChart = async (
    knex: db.KnexReadWriteTransaction,
    params: {
        config: GrapherInterface
        user: DbPlainUser
        chartId: number
        forceDatapage?: boolean
        // if undefined, keep inheritance as is.
        // if true or false, enable or disable inheritance
        shouldInherit?: boolean
    }
): Promise<{
    chartConfigId: string
    patchConfig: GrapherInterface
    fullConfig: GrapherInterface
}> => {
    const { config, user, chartId } = params

    // make sure that the id of the incoming config matches the chart id
    config.id = chartId

    // if inheritance is enabled, grab the parent from its config
    const shouldInherit =
        params.shouldInherit ??
        (await isInheritanceEnabledForChart(knex, chartId))
    const parent = shouldInherit
        ? await getParentByChartConfig(knex, config)
        : undefined

    // fetch the chart's main config id and its ETL-authored config — a separate
    // chart_configs row reached via charts.configIdETL (written via
    // PUT /charts/:id/etlConfig) — so we keep that layer when recomputing
    // patch/full.
    const chartConfigIdRow = await db.knexRawFirst<
        Pick<DbPlainChart, "configId"> & { etlConfig: string | null }
    >(
        knex,
        `-- sql
            SELECT c.configId, cc_etl.full AS etlConfig
            FROM charts c
            LEFT JOIN chart_configs cc_etl ON cc_etl.id = c.configIdETL
            WHERE c.id = ?
        `,
        [chartId]
    )

    if (!chartConfigIdRow)
        throw new JsonError(`No chart config found for id ${chartId}`, 404)

    const etlConfig = chartConfigIdRow.etlConfig
        ? parseChartConfig(chartConfigIdRow.etlConfig)
        : {}

    // compute patch and full configs.
    // The "parent stack" against which we diff is the indicator's grapher
    // config plus the chart's own etlConfig (if any). Patch only carries
    // admin-authored overrides on top of that stack.
    const parentStack = mergeGrapherConfigs(parent?.config ?? {}, etlConfig)
    let patchConfig = diffGrapherConfigs(config, parentStack)
    // `diffGrapherConfigs` always retains `dimensions` (it's in `REQUIRED_KEYS`),
    // even when they match the parent. For ETL-managed charts that turns
    // every admin no-op Save into a phantom "dimensions override" stuck in
    // patch — which would then block subsequent ETL changes to the chart's
    // indicators. Drop the residue when the chart has an etlConfig and
    // `dimensions` matches the parent stack. An admin who actually changed
    // dimensions sees them stay in patch (real override) and that override
    // survives subsequent ETL pushes, like any other admin field override.
    if (
        !_.isEmpty(etlConfig) &&
        _.isEqual(patchConfig.dimensions, parentStack.dimensions)
    ) {
        patchConfig = _.omit(patchConfig, "dimensions")
    }
    const fullConfig = mergeGrapherConfigs(parentStack, patchConfig)

    const now = new Date()

    const { chartConfigId } = await updateChartConfigInDbAndR2(
        knex,
        chartConfigIdRow.configId,
        patchConfig,
        fullConfig,
        now
    )

    const forceDatapage =
        params.forceDatapage ?? (await getForceDatapageByChartId(knex, chartId))

    // update charts row
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE charts
            SET isInheritanceEnabled=?, forceDatapage=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=?
            WHERE id = ?
        `,
        [shouldInherit, forceDatapage, now, now, user.id, chartId]
    )

    return { chartConfigId, patchConfig, fullConfig }
}

export const saveGrapher = async (
    knex: db.KnexReadWriteTransaction,
    {
        user,
        newConfig,
        existingConfig,
        forceDatapage,
        shouldInherit,
        chartConfigId: providedChartConfigId,
    }: {
        user: DbPlainUser
        newConfig: GrapherInterface
        existingConfig?: GrapherInterface
        forceDatapage?: boolean
        // if undefined, keep inheritance as is.
        // if true or false, enable or disable inheritance
        shouldInherit?: boolean
        // only used when creating a new chart, see `saveNewChart`
        chartConfigId?: string
    }
) => {
    // Try to migrate the new config to the latest version
    newConfig = migrateGrapherConfigToLatestVersionAndFailOnError(newConfig)

    // Validate slug if:
    // 1. Publishing - slug is required
    // 2. Draft with non-empty slug - prevent duplicates (empty slugs are allowed for drafts)
    if (newConfig.isPublished) {
        await validateNewGrapherSlug(knex, newConfig.slug, existingConfig?.id)
        if (
            existingConfig &&
            existingConfig.isPublished &&
            existingConfig.slug !== newConfig.slug
        ) {
            // Changing slug of an existing chart, delete any old redirect and create new one
            await db.knexRaw(
                knex,
                `DELETE FROM chart_slug_redirects WHERE chart_id = ? AND slug = ?`,
                [existingConfig.id, existingConfig.slug]
            )
            await db.knexRaw(
                knex,
                `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
                [existingConfig.id, existingConfig.slug]
            )
            // When we rename grapher configs, make sure to delete the old one (the new one will be saved below)
            await deleteGrapherConfigFromR2(
                R2GrapherConfigDirectory.publishedGrapherBySlug,
                `${existingConfig.slug}.json`
            )
        }
    } else if (newConfig.slug && newConfig.slug.length > 0) {
        // Only validate non-empty slugs for drafts (empty slugs are allowed for drafts)
        // Use draft-specific validation that skips redirect checks
        await validateDraftGrapherSlug(knex, newConfig.slug, existingConfig?.id)
    }

    if (existingConfig)
        // Bump chart version, very important for cachebusting
        newConfig.version = existingConfig.version! + 1
    else if (newConfig.version)
        // If a chart is republished, we want to keep incrementing the old version number,
        // otherwise it can lead to clients receiving cached versions of the old data.
        newConfig.version += 1
    else newConfig.version = 1

    // add the isPublished field if is missing
    if (newConfig.isPublished === undefined) {
        newConfig.isPublished = false
    }

    // Execute the actual database update or creation
    let chartId: number
    let chartConfigId: string
    let patchConfig: GrapherInterface
    let fullConfig: GrapherInterface
    if (existingConfig) {
        chartId = existingConfig.id!
        const configs = await updateExistingChart(knex, {
            config: newConfig,
            user,
            chartId,
            forceDatapage,
            shouldInherit,
        })
        chartConfigId = configs.chartConfigId
        patchConfig = configs.patchConfig
        fullConfig = configs.fullConfig
    } else {
        const configs = await saveNewChart(knex, {
            config: newConfig,
            user,
            forceDatapage,
            shouldInherit,
            chartConfigId: providedChartConfigId,
        })
        chartConfigId = configs.chartConfigId
        patchConfig = configs.patchConfig
        fullConfig = configs.fullConfig
        chartId = fullConfig.id!
    }

    // Record this change in version history
    const chartRevisionLog = {
        chartId: chartId,
        userId: user.id,
        config: serializeChartConfig(patchConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
    } satisfies DbInsertChartRevision
    await db.knexRaw(
        knex,
        `INSERT INTO chart_revisions (chartId, userId, config, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [
            chartRevisionLog.chartId,
            chartRevisionLog.userId,
            chartRevisionLog.config,
            chartRevisionLog.createdAt,
            chartRevisionLog.updatedAt,
        ]
    )

    // Remove any old dimensions and store the new ones
    // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json
    await db.knexRaw(knex, `DELETE FROM chart_dimensions WHERE chartId=?`, [
        chartId,
    ])

    const newDimensions = fullConfig.dimensions ?? []
    for (const [i, dim] of newDimensions.entries()) {
        await db.knexRaw(
            knex,
            `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?, ?, ?, ?)`,
            [chartId, dim.variableId, dim.property, i]
        )
    }

    if (fullConfig.isPublished) {
        await retrieveChartConfigFromDbAndSaveToR2(knex, chartConfigId, {
            directory: R2GrapherConfigDirectory.publishedGrapherBySlug,
            filename: `${fullConfig.slug}.json`,
        })
    }

    if (
        fullConfig.isPublished &&
        (!existingConfig || !existingConfig.isPublished)
    ) {
        // Newly published, set publication info
        await db.knexRaw(
            knex,
            `UPDATE charts SET publishedAt=?, publishedByUserId=? WHERE id = ? `,
            [new Date(), user.id, chartId]
        )
        await triggerStaticBuild(user, `Publishing chart ${fullConfig.slug}`)
    } else if (
        !fullConfig.isPublished &&
        existingConfig &&
        existingConfig.isPublished
    ) {
        // Unpublishing chart, delete any existing redirects to it
        await db.knexRaw(
            knex,
            `DELETE FROM chart_slug_redirects WHERE chart_id = ?`,
            [existingConfig.id]
        )
        await deleteGrapherConfigFromR2(
            R2GrapherConfigDirectory.publishedGrapherBySlug,
            `${existingConfig.slug}.json`
        )
        await triggerStaticBuild(user, `Unpublishing chart ${fullConfig.slug}`)
    } else if (fullConfig.isPublished)
        await triggerStaticBuild(user, `Updating chart ${fullConfig.slug}`)

    await enqueueExplorerRefreshJobsForDependencies(knex, {
        chartIds: [chartId],
    })

    return {
        chartId,
        savedPatch: patchConfig,
    }
}

export async function updateGrapherConfigsInR2(
    knex: db.KnexReadonlyTransaction,
    updatedCharts: UpdatedChartInheritanceRecord[],
    updatedMultiDimViews: { chartConfigId: string; isPublished: boolean }[]
) {
    const idsToUpdate = [
        ...updatedCharts.filter(({ isPublished }) => isPublished),
        ...updatedMultiDimViews,
    ].map(({ chartConfigId }) => chartConfigId)
    const builder = knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "full", "fullMd5")
        .whereIn("id", idsToUpdate)
    for await (const { id, full, fullMd5 } of builder.stream()) {
        await saveGrapherConfigToR2ByUUID(id, full, fullMd5)
    }
}

export async function getChartsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
            SELECT ${oldChartFieldList}
            FROM charts
            JOIN chart_configs ON chart_configs.id = charts.configId
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN analytics_grapher_views agv ON (agv.grapher_slug = chart_configs.slug AND chart_configs.full ->> '$.isPublished' = "true")
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
            ORDER BY charts.lastEditedAt DESC LIMIT ?
        `,
        [limit]
    )

    await assignTagsForCharts(trx, charts)

    return { charts }
}

export async function getChartConfigJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    return expectChartById(trx, req.params.chartId)
}

export async function getChartParentJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)
    const parent = await getParentByChartId(trx, chartId)
    const isInheritanceEnabled = await isInheritanceEnabledForChart(
        trx,
        chartId
    )

    // Return the two layers above the admin's `patch` separately, so the
    // editor on the client can merge them with awareness of which fields
    // come from which layer:
    //   - `variableConfig`: the indicator's grapher_config (variable.grapherConfigETL).
    //     Only applied to the chart when `isInheritanceEnabled` is true.
    //   - `etlConfig`: the chart's own ETL-authored config — a separate
    //     chart_configs row reached via charts.configIdETL.
    //     Always applied, independent of indicator inheritance.
    const etlConfigRow = await db.knexRawFirst<{ etlConfig: string | null }>(
        trx,
        `SELECT cc_etl.full AS etlConfig FROM charts c LEFT JOIN chart_configs cc_etl ON cc_etl.id = c.configIdETL WHERE c.id = ?`,
        [chartId]
    )
    const etlConfig = etlConfigRow?.etlConfig
        ? parseChartConfig(etlConfigRow.etlConfig)
        : undefined

    return omitUndefinedValues({
        variableId: parent?.variableId,
        variableConfig: parent?.config,
        etlConfig,
        isInheritanceEnabled,
    })
}

export async function getChartSettingsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)
    const forceDatapage = await getForceDatapageByChartId(trx, chartId)
    return { forceDatapage }
}

export async function getChartPatchConfigJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)
    const config = await expectPatchConfigByChartId(trx, chartId)
    return config
}

export async function getChartLogsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    return {
        logs: await getLogsByChartId(
            trx,
            await expectChartId(trx, req.params.chartId)
        ),
    }
}

export async function getChartReferencesJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const references = {
        references: await getReferencesByChartId(
            await expectChartId(trx, req.params.chartId),
            trx
        ),
    }
    return references
}

export async function getChartRedirectsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    return {
        redirects: await getRedirectsByChartId(
            trx,
            await expectChartId(trx, req.params.chartId)
        ),
    }
}

export async function getChartViewsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const slug = await getChartSlugById(
        trx,
        await expectChartId(trx, req.params.chartId)
    )
    if (!slug) return {}

    const viewsBySlug = await db.knexRawFirst<
        DbPlainAnalyticsGrapherView & {
            total_charts: number | null
            rank_7d: number | null
            rank_14d: number | null
            rank_365d: number | null
        }
    >(
        trx,
        `-- sql
        SELECT
            v.*,
            ranked.total_charts,
            ranked.rank_7d,
            ranked.rank_14d,
            ranked.rank_365d
        FROM analytics_grapher_views v
        LEFT JOIN (
            SELECT
                v.grapher_slug,
                COUNT(*) OVER () AS total_charts,
                RANK() OVER (ORDER BY v.views_7d DESC) AS rank_7d,
                RANK() OVER (ORDER BY v.views_14d DESC) AS rank_14d,
                RANK() OVER (ORDER BY v.views_365d DESC) AS rank_365d
            FROM analytics_grapher_views v
            JOIN chart_configs cc
                ON cc.slug = v.grapher_slug
                AND cc.full ->> "$.isPublished" = "true"
            JOIN charts c ON c.configId = cc.id
        ) ranked ON ranked.grapher_slug = v.grapher_slug
        WHERE v.grapher_slug = ?`,
        [slug]
    )

    if (!viewsBySlug) return {}

    const views: AnalyticsGrapherViewWithRank = R.omitBy(
        viewsBySlug,
        (value): value is null => value === null
    )
    return { views }
}

export async function getChartTagsJson(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)
    const chartTags = await db.knexRaw<DbChartTagJoin>(
        trx,
        `-- sql
            SELECT ct.tagId as id, ct.keyChartLevel, ct.isApproved, t.name
            FROM chart_tags ct
            JOIN charts c ON c.id=ct.chartId
            JOIN tags t ON t.id=ct.tagId
            WHERE ct.chartId = ?
        `,
        [chartId]
    )
    return { tags: chartTags }
}

export async function createChart(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    let shouldInherit: boolean | undefined
    if (req.query.inheritance) {
        shouldInherit = req.query.inheritance === "enable"
    }
    let forceDatapage: boolean | undefined
    if (req.query.forceDatapage) {
        forceDatapage = req.query.forceDatapage === "true"
    }

    try {
        const { chartId } = await saveGrapher(trx, {
            user: res.locals.user,
            newConfig: req.body,
            forceDatapage,
            shouldInherit,
        })

        return { success: true, chartId: chartId }
    } catch (err) {
        return { success: false, error: { message: String(err), status: 500 } }
    }
}

export async function setChartTagsHandler(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)

    await setChartTags(trx, chartId, req.body.tags, res.locals.user.id)

    return { success: true }
}

export async function updateChart(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    let shouldInherit: boolean | undefined
    if (req.query.inheritance) {
        shouldInherit = req.query.inheritance === "enable"
    }
    let forceDatapage: boolean | undefined
    if (req.query.forceDatapage) {
        forceDatapage = req.query.forceDatapage === "true"
    }

    const existingConfig = await expectChartById(trx, req.params.chartId)

    try {
        const { chartId, savedPatch } = await saveGrapher(trx, {
            user: res.locals.user,
            newConfig: req.body,
            existingConfig,
            forceDatapage,
            shouldInherit,
        })

        const logs = await getLogsByChartId(trx, existingConfig.id as number)
        return {
            success: true,
            chartId,
            savedPatch,
            newLog: logs[0],
        }
    } catch (err) {
        return {
            success: false,
            error: { message: String(err), status: 500 },
        }
    }
}

// Chart-table-style fields that are never inherited. The chart's patch always
// keeps these even when they match the parent stack — same convention as
// `KEYS_EXCLUDED_FROM_INHERITANCE` in `mergeGrapherConfigs`.
const NON_INHERITABLE_PATCH_KEYS = [
    "$schema",
    "id",
    "slug",
    "version",
    "isPublished",
] as const

/**
 * Recompute the chart's `patch` against a new parent stack. Strips redundant
 * patch entries that now match the parent stack — including `dimensions` that
 * merely echo the parent (e.g. leftover from a bootstrap create), so those
 * don't linger and block ETL from re-versioning the indicator.
 *
 * A genuine admin override — `dimensions` that actually differ from the parent
 * stack — is deliberately kept and wins over `etlConfig`, so a manual change to
 * the plotted variables in the admin survives ETL pushes. The trade-off is that
 * ETL can't re-version a chart whose dimensions were hand-edited; a warning for
 * such "unlinked" dimensions is planned as a follow-up.
 *
 * Differs from `diffGrapherConfigs` only in that we don't keep `REQUIRED_KEYS`
 * (`$schema`, `dimensions`) unconditionally; every field falls through to the
 * parent stack when they match, and only real admin overrides (values that
 * actually differ from the parent stack) survive in patch. The admin save
 * path applies the same convention for `dimensions` on ETL-managed charts;
 * see `updateExistingChart`.
 */
function rediffPatchAgainstNewParentStack(
    existingPatch: GrapherInterface,
    newParentStack: GrapherInterface
): GrapherInterface {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(existingPatch)) {
        if ((NON_INHERITABLE_PATCH_KEYS as readonly string[]).includes(key)) {
            result[key] = value
        } else if (
            !_.isEqual(value, (newParentStack as Record<string, unknown>)[key])
        ) {
            result[key] = value
        }
    }
    return result as GrapherInterface
}

/**
 * Refresh `chart_dimensions` and the chart's grapher_config in R2 (both the
 * UUID-keyed object and, if published, the slug-keyed object).
 *
 * Shared by the ETL config endpoints; the regular `saveGrapher` path has its
 * own inline equivalent because it also has to handle publish-state
 * transitions (slug redirects, publishedAt, etc.) that an ETL push never does.
 */
async function refreshChartDimensionsAndR2(
    trx: db.KnexReadWriteTransaction,
    chartId: number,
    chartConfigId: Base64String,
    fullConfig: GrapherInterface
): Promise<void> {
    await db.knexRaw(trx, `DELETE FROM chart_dimensions WHERE chartId = ?`, [
        chartId,
    ])
    const dimensions = fullConfig.dimensions ?? []
    for (const [i, dim] of dimensions.entries()) {
        await db.knexRaw(
            trx,
            `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?, ?, ?, ?)`,
            [chartId, dim.variableId, dim.property, i]
        )
    }
    await retrieveChartConfigFromDbAndSaveToR2(trx, chartConfigId)
    if (fullConfig.isPublished && fullConfig.slug) {
        await retrieveChartConfigFromDbAndSaveToR2(trx, chartConfigId, {
            directory: R2GrapherConfigDirectory.publishedGrapherBySlug,
            filename: `${fullConfig.slug}.json`,
        })
    }
}

async function insertChartRevision(
    trx: db.KnexReadWriteTransaction,
    chartId: number,
    userId: number,
    patchConfig: GrapherInterface,
    now: Date
): Promise<void> {
    const chartRevisionLog = {
        chartId,
        userId,
        config: serializeChartConfig(patchConfig),
        createdAt: now,
        updatedAt: now,
    } satisfies DbInsertChartRevision
    await db.knexRaw(
        trx,
        `INSERT INTO chart_revisions (chartId, userId, config, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [
            chartRevisionLog.chartId,
            chartRevisionLog.userId,
            chartRevisionLog.config,
            chartRevisionLog.createdAt,
            chartRevisionLog.updatedAt,
        ]
    )
}

/**
 * Inserts or updates the chart's ETL-authored grapher config.
 *
 * The chart's ETL-authored config lives in its own `chart_configs` row,
 * reached via `charts.configIdETL`. It's a layer between the indicator's
 * grapher_config (variableETL) and the chart's admin-authored `patch`. ETL
 * writes only to that row; admin writes only to `patch`. The rendered `full`
 * is `merge(variableETL, etlConfig, patch)`.
 *
 * On each call we also re-diff the existing `patch` against the new parent
 * stack: redundant patch entries are stripped so future ETL changes to those
 * fields propagate (this matters especially for `dimensions`, which the
 * bootstrap creation flow writes into patch and which would otherwise block
 * future indicator re-versioning).
 *
 * Also bumps `version`, refreshes `chart_dimensions`, saves to R2 (UUID +
 * slug if published), records a chart_revisions entry, and triggers a static
 * build if the chart is published — same housekeeping as `saveGrapher`.
 */
export async function putChartsChartIdEtlConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = expectInt(req.params.chartId)

    // ETL's stable identity for this chart (mirrors `multi_dim_data_pages.catalogPath`).
    // Optional so other callers don't clobber it; persisted via COALESCE below.
    const catalogPath = (req.query.catalogPath as string | undefined) ?? null

    let etlConfig: GrapherInterface
    try {
        etlConfig = migrateGrapherConfigToLatestVersionAndFailOnError(req.body)
    } catch (err) {
        return { success: false, error: String(err) }
    }

    const row = await db.knexRawFirst<
        Pick<
            DbPlainChart,
            "configId" | "configIdETL" | "isInheritanceEnabled"
        > &
            Pick<DbRawChartConfig, "patch" | "full">
    >(
        trx,
        `-- sql
            SELECT c.configId, c.configIdETL, c.isInheritanceEnabled, cc.patch, cc.full
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE c.id = ?
        `,
        [chartId]
    )

    if (!row) {
        throw new JsonError(`Chart with id ${chartId} not found`, 404)
    }

    const existingPatch = parseChartConfig(row.patch)
    const existingFull = parseChartConfig(row.full)

    // Look up the chart's parent indicator (only if inheritance is enabled).
    // Resolve it from the *incoming* config (existing full with this push's
    // etlConfig applied on top), not the stale `existingFull`: when ETL
    // re-points the chart at a new y-variable (e.g. on dataset re-versioning),
    // the parent must be the new indicator, otherwise `full` would inherit the
    // old indicator's fields until a later recompute.
    const incomingFull = mergeGrapherConfigs(existingFull, etlConfig)
    const parent = row.isInheritanceEnabled
        ? await getParentByChartConfig(trx, incomingFull)
        : undefined

    const newParentStack = mergeGrapherConfigs(parent?.config ?? {}, etlConfig)

    const newPatch = rediffPatchAgainstNewParentStack(
        existingPatch,
        newParentStack
    )

    // Bump version for cache-busting on every ETL push, mirroring saveGrapher.
    const newVersion = (existingFull.version ?? 0) + 1
    newPatch.version = newVersion

    const newFullConfig: GrapherInterface = {
        ...mergeGrapherConfigs(newParentStack, newPatch),
        id: chartId,
        version: newVersion,
    }

    const now = new Date()

    // Upsert the ETL-authored config into its own chart_configs row
    // (patch == full, absolute — like variables.grapherConfigIdETL rows),
    // reached via charts.configIdETL. This intermediate row is never uploaded
    // to R2; only the chart's main `full` is served.
    const serializedEtlConfig = serializeChartConfig(etlConfig)
    if (row.configIdETL) {
        await db.knexRaw(
            trx,
            `-- sql
                UPDATE chart_configs
                SET patch = ?, full = ?, updatedAt = ?
                WHERE id = ?
            `,
            [serializedEtlConfig, serializedEtlConfig, now, row.configIdETL]
        )
    } else {
        const etlConfigId = uuidv7()
        await db.knexRaw(
            trx,
            `-- sql
                INSERT INTO chart_configs (id, patch, full, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?)
            `,
            [etlConfigId, serializedEtlConfig, serializedEtlConfig, now, now]
        )
        await db.knexRaw(
            trx,
            `UPDATE charts SET configIdETL = ?, updatedAt = ? WHERE id = ?`,
            [etlConfigId, now, chartId]
        )
    }

    // Update the chart's main config row with the recomputed patch/full.
    await db.knexRaw(
        trx,
        `-- sql
            UPDATE chart_configs cc
            JOIN charts c ON c.configId = cc.id
            SET
                cc.patch = ?,
                cc.full = ?,
                cc.updatedAt = ?,
                c.updatedAt = ?,
                c.catalogPath = COALESCE(?, c.catalogPath)
            WHERE c.id = ?
        `,
        [
            serializeChartConfig(newPatch),
            serializeChartConfig(newFullConfig),
            now,
            now,
            catalogPath,
            chartId,
        ]
    )

    await insertChartRevision(trx, chartId, res.locals.user.id, newPatch, now)

    await refreshChartDimensionsAndR2(
        trx,
        chartId,
        row.configId as Base64String,
        newFullConfig
    )

    if (newFullConfig.isPublished) {
        await triggerStaticBuild(
            res.locals.user,
            `Updating ETL config for chart ${chartId}`
        )
    }

    return { success: true, etlConfig, patch: newPatch }
}

/**
 * Clears the chart's ETL-authored grapher config. The chart's `full` is
 * recomputed against the (possibly empty) variable inheritance stack only,
 * and the admin patch is re-diffed against that smaller stack. Same
 * housekeeping as the PUT endpoint.
 */
export async function deleteChartsChartIdEtlConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = expectInt(req.params.chartId)

    const row = await db.knexRawFirst<
        Pick<
            DbPlainChart,
            "configId" | "configIdETL" | "isInheritanceEnabled"
        > &
            Pick<DbRawChartConfig, "patch" | "full">
    >(
        trx,
        `-- sql
            SELECT c.configId, c.configIdETL, c.isInheritanceEnabled, cc.patch, cc.full
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE c.id = ?
        `,
        [chartId]
    )

    if (!row) {
        throw new JsonError(`Chart with id ${chartId} not found`, 404)
    }

    // no-op if the chart doesn't have an ETL config
    if (!row.configIdETL) return { success: true }

    const existingPatch = parseChartConfig(row.patch)
    const existingFull = parseChartConfig(row.full)

    const parent = row.isInheritanceEnabled
        ? await getParentByChartConfig(trx, existingFull)
        : undefined

    const newParentStack = parent?.config ?? {}
    const newPatch = rediffPatchAgainstNewParentStack(
        existingPatch,
        newParentStack
    )

    const newVersion = (existingFull.version ?? 0) + 1
    newPatch.version = newVersion

    const newFullConfig: GrapherInterface = {
        ...mergeGrapherConfigs(newParentStack, newPatch),
        id: chartId,
        version: newVersion,
    }

    const now = new Date()

    // Clear the pointer first, then delete the now-orphaned ETL config row
    // (the FK is ON DELETE RESTRICT, so the pointer has to go first).
    const etlConfigId = row.configIdETL
    await db.knexRaw(
        trx,
        `UPDATE charts SET configIdETL = NULL, updatedAt = ? WHERE id = ?`,
        [now, chartId]
    )
    await db.knexRaw(trx, `DELETE FROM chart_configs WHERE id = ?`, [
        etlConfigId,
    ])

    // Update the chart's main config row with the recomputed patch/full.
    await db.knexRaw(
        trx,
        `-- sql
            UPDATE chart_configs cc
            JOIN charts c ON c.configId = cc.id
            SET
                cc.patch = ?,
                cc.full = ?,
                cc.updatedAt = ?,
                c.updatedAt = ?
            WHERE c.id = ?
        `,
        [
            serializeChartConfig(newPatch),
            serializeChartConfig(newFullConfig),
            now,
            now,
            chartId,
        ]
    )

    await insertChartRevision(trx, chartId, res.locals.user.id, newPatch, now)

    await refreshChartDimensionsAndR2(
        trx,
        chartId,
        row.configId as Base64String,
        newFullConfig
    )

    if (newFullConfig.isPublished) {
        await triggerStaticBuild(
            res.locals.user,
            `Clearing ETL config for chart ${chartId}`
        )
    }

    return { success: true, patch: newPatch }
}

export async function deleteChart(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const chart = await expectChartById(trx, req.params.chartId)
    if (chart.id) {
        const references = await getReferencesByChartId(chart.id, trx).then(
            (references) => Object.values(references).flat()
        )
        if (references.length) {
            throw new JsonError(
                `Cannot delete chart in-use in the following places:` +
                    references.join(", ")
            )
        }
    }

    await db.knexRaw(trx, `DELETE FROM chart_dimensions WHERE chartId=?`, [
        chart.id,
    ])
    await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE chart_id=?`, [
        chart.id,
    ])

    const row = await db.knexRawFirst<
        Pick<DbPlainChart, "configId" | "configIdETL">
    >(trx, `SELECT configId, configIdETL FROM charts WHERE id = ?`, [chart.id])
    if (!row || !row.configId)
        throw new JsonError(`No chart config found for id ${chart.id}`, 404)
    if (row) {
        // Delete the chart first (the referencing side of both configId and
        // configIdETL FKs), then its config rows. The ETL config row, if any,
        // is the chart's own and isn't shared, so it's safe to drop.
        await db.knexRaw(trx, `DELETE FROM charts WHERE id=?`, [chart.id])
        await db.knexRaw(trx, `DELETE FROM chart_configs WHERE id=?`, [
            row.configId,
        ])
        if (row.configIdETL) {
            await db.knexRaw(trx, `DELETE FROM chart_configs WHERE id=?`, [
                row.configIdETL,
            ])
        }
    }

    if (chart.isPublished)
        await triggerStaticBuild(
            res.locals.user,
            `Deleting chart ${chart.slug}`
        )

    await deleteGrapherConfigFromR2ByUUID(row.configId)
    if (chart.isPublished)
        await deleteGrapherConfigFromR2(
            R2GrapherConfigDirectory.publishedGrapherBySlug,
            `${chart.slug}.json`
        )

    return { success: true }
}

/**
 * Generate a preview of Algolia index records for a chart.
 * Returns the records that would be created when indexing this chart.
 */
export async function getChartRecordsJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = await expectChartId(trx, req.params.chartId)
    const records = await getChartsRecords(trx, { chartIds: [chartId] })
    return { records }
}
