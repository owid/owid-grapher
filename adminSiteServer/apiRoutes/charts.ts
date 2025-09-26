import { migrateGrapherConfigToLatestVersionAndFailOnError } from "@ourworldindata/grapher"
import {
    GrapherInterface,
    JsonError,
    DbPlainUser,
    Base64String,
    serializeChartConfig,
    DbPlainChart,
    R2GrapherConfigDirectory,
    DbInsertChartRevision,
    DbRawChartConfig,
    ChartConfigsTableName,
    DbChartTagJoin,
} from "@ourworldindata/types"
import {
    diffGrapherConfigs,
    mergeGrapherConfigs,
    parseIntOrUndefined,
    omitUndefinedValues,
} from "@ourworldindata/utils"
import Papa from "papaparse"
import { uuidv7 } from "uuidv7"
import { References } from "../../adminSiteClient/AbstractChartEditor.js"
import { NarrativeChartMinimalInformation } from "../../adminSiteClient/ChartEditor.js"
import { denormalizeLatestCountryData } from "../../baker/countryProfiles.js"
import {
    getChartConfigById,
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
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    BAKED_BASE_URL,
    ADMIN_BASE_URL,
} from "../../settings/clientSettings.js"
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
import { getPublishedLinksTo } from "../../db/model/Link.js"

import { Request } from "../authentication.js"
import e from "express"
import { DataInsightMinimalInformation } from "../../adminShared/AdminTypes.js"
import { validateNewGrapherSlug } from "../validation.js"

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
            join explorers e on explorerSlug = e.slug
        WHERE
            chartId = ?
            and e.isPublished = 1`,
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
    const dataInsightsPromise = db.knexRaw<DataInsightMinimalInformation>(
        knex,
        `-- sql
        WITH chart_slugs AS (
            SELECT cc.slug as main_slug, c.id as chart_id
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE c.id = ?

            UNION ALL

            SELECT cr.slug as main_slug, c.id as chart_id
            FROM charts c
            JOIN chart_slug_redirects cr ON cr.chart_id = c.id
            WHERE c.id = ?
        ),
        gdoc_grapher_slugs AS (
            SELECT
                pg.id,
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
    ] = await Promise.all([
        postsWordpressPromise,
        postGdocsPromise,
        explorerSlugsPromise,
        narrativeChartsPromise,
        dataInsightsPromise,
    ])

    return {
        postsGdocs,
        postsWordpress,
        explorers: explorerSlugs.map(
            (row: { explorerSlug: string }) => row.explorerSlug
        ),
        narrativeCharts,
        dataInsights,
    }
}

export const expectChartById = async (
    knex: db.KnexReadonlyTransaction,
    chartId: any
): Promise<GrapherInterface> => {
    const chart = await getChartConfigById(knex, expectInt(chartId))
    if (chart) return chart.config

    throw new JsonError(`No chart found for id ${chartId}`, 404)
}

const expectPatchConfigByChartId = async (
    knex: db.KnexReadonlyTransaction,
    chartId: any
): Promise<GrapherInterface> => {
    const patchConfig = await getPatchConfigByChartId(knex, expectInt(chartId))
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
        // new charts inherit by default
        shouldInherit = true,
    }: { config: GrapherInterface; user: DbPlainUser; shouldInherit?: boolean }
): Promise<{
    chartConfigId: Base64String
    patchConfig: GrapherInterface
    fullConfig: GrapherInterface
}> => {
    // grab the parent of the chart if inheritance should be enabled
    const parent = shouldInherit
        ? await getParentByChartConfig(knex, config)
        : undefined

    // compute patch and full configs
    const patchConfig = diffGrapherConfigs(config, parent?.config ?? {})
    const fullConfig = mergeGrapherConfigs(parent?.config ?? {}, patchConfig)

    // insert patch & full configs into the chart_configs table
    // We can't quite use `saveNewChartConfigInDbAndR2` here, because
    // we need to update the chart id in the config after inserting it.
    const chartConfigId = uuidv7() as Base64String
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

    // add a new chart to the charts table
    const result = await db.knexRawInsert(
        knex,
        `-- sql
            INSERT INTO charts (configId, isInheritanceEnabled, lastEditedAt, lastEditedByUserId)
            VALUES (?, ?, ?, ?)
        `,
        [chartConfigId, shouldInherit, new Date(), user.id]
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

    // compute patch and full configs
    const patchConfig = diffGrapherConfigs(config, parent?.config ?? {})
    const fullConfig = mergeGrapherConfigs(parent?.config ?? {}, patchConfig)

    const chartConfigIdRow = await db.knexRawFirst<
        Pick<DbPlainChart, "configId">
    >(knex, `SELECT configId FROM charts WHERE id = ?`, [chartId])

    if (!chartConfigIdRow)
        throw new JsonError(`No chart config found for id ${chartId}`, 404)

    const now = new Date()

    const { chartConfigId } = await updateChartConfigInDbAndR2(
        knex,
        chartConfigIdRow.configId as Base64String,
        patchConfig,
        fullConfig
    )

    // update charts row
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE charts
            SET isInheritanceEnabled=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=?
            WHERE id = ?
        `,
        [shouldInherit, now, now, user.id, chartId]
    )

    return { chartConfigId, patchConfig, fullConfig }
}

export const saveGrapher = async (
    knex: db.KnexReadWriteTransaction,
    {
        user,
        newConfig,
        existingConfig,
        shouldInherit,
        referencedVariablesMightChange = true,
    }: {
        user: DbPlainUser
        newConfig: GrapherInterface
        existingConfig?: GrapherInterface
        // if undefined, keep inheritance as is.
        // if true or false, enable or disable inheritance
        shouldInherit?: boolean
        // if the variables a chart uses can change then we need
        // to update the latest country data which takes quite a long time (hundreds of ms)
        referencedVariablesMightChange?: boolean
    }
) => {
    // Try to migrate the new config to the latest version
    newConfig = migrateGrapherConfigToLatestVersionAndFailOnError(newConfig)

    // When a chart is published, check for conflicts
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
            shouldInherit,
        })
        chartConfigId = configs.chartConfigId
        patchConfig = configs.patchConfig
        fullConfig = configs.fullConfig
    } else {
        const configs = await saveNewChart(knex, {
            config: newConfig,
            user,
            shouldInherit,
        })
        chartConfigId = configs.chartConfigId
        patchConfig = configs.patchConfig
        fullConfig = configs.fullConfig
        chartId = fullConfig.id!
    }

    // Record this change in version history
    const chartRevisionLog = {
        chartId: chartId as number,
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

    // So we can generate country profiles including this chart data
    if (fullConfig.isPublished && referencedVariablesMightChange)
        // TODO: remove this ad hoc knex transaction context when we switch the function to knex
        await denormalizeLatestCountryData(
            knex,
            newDimensions.map((d) => d.variableId)
        )

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

    return {
        chartId,
        savedPatch: patchConfig,
    }
}

export async function updateGrapherConfigsInR2(
    knex: db.KnexReadonlyTransaction,
    updatedCharts: { chartConfigId: string; isPublished: boolean }[],
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
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
            SELECT ${oldChartFieldList},
                round(views_365d / 365, 1) as pageviewsPerDay,
                crv.narrativeChartsCount,
                crv.referencesCount
            FROM charts
            JOIN chart_configs ON chart_configs.id = charts.configId
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN analytics_pageviews on (analytics_pageviews.url = CONCAT("https://ourworldindata.org/grapher/", chart_configs.slug) AND chart_configs.full ->> '$.isPublished' = "true" )
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
            ORDER BY charts.lastEditedAt DESC LIMIT ?
        `,
        [limit]
    )

    await assignTagsForCharts(trx, charts)

    return { charts }
}

export async function getChartsCsv(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000

    // note: this query is extended from OldChart.listFields.
    const charts = await db.knexRaw(
        trx,
        `-- sql
            SELECT
                charts.id,
                chart_configs.full->>"$.version" AS version,
                CONCAT("${BAKED_BASE_URL}/grapher/", chart_configs.full->>"$.slug") AS url,
                CONCAT("${ADMIN_BASE_URL}", "/admin/charts/", charts.id, "/edit") AS editUrl,
                chart_configs.full->>"$.slug" AS slug,
                chart_configs.full->>"$.title" AS title,
                chart_configs.full->>"$.subtitle" AS subtitle,
                chart_configs.full->>"$.sourceDesc" AS sourceDesc,
                chart_configs.full->>"$.note" AS note,
                chart_configs.chartType AS type,
                chart_configs.full->>"$.internalNotes" AS internalNotes,
                chart_configs.full->>"$.variantName" AS variantName,
                chart_configs.full->>"$.isPublished" AS isPublished,
                chart_configs.full->>"$.tab" AS tab,
                chart_configs.chartType IS NOT NULL AS hasChartTab,
                JSON_EXTRACT(chart_configs.full, "$.hasMapTab") = true AS hasMapTab,
                chart_configs.full->>"$.originUrl" AS originUrl,
                charts.lastEditedAt,
                charts.lastEditedByUserId,
                lastEditedByUser.fullName AS lastEditedBy,
                charts.publishedAt,
                charts.publishedByUserId,
                publishedByUser.fullName AS publishedBy
            FROM charts
            JOIN chart_configs ON chart_configs.id = charts.configId
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            ORDER BY charts.lastEditedAt DESC
            LIMIT ?
        `,
        [limit]
    )
    // note: retrieving references is VERY slow.
    // await Promise.all(
    //     charts.map(async (chart: any) => {
    //         const references = await getReferencesByChartId(chart.id)
    //         chart.references = references.length
    //             ? references.map((ref) => ref.url)
    //             : ""
    //     })
    // )
    // await Chart.assignTagsForCharts(charts)
    res.setHeader("Content-disposition", "attachment; filename=charts.csv")
    res.setHeader("content-type", "text/csv")
    const csv = Papa.unparse(charts)
    return csv
}

export async function getChartConfigJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return expectChartById(trx, req.params.chartId)
}

export async function getChartParentJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = expectInt(req.params.chartId)
    const parent = await getParentByChartId(trx, chartId)
    const isInheritanceEnabled = await isInheritanceEnabledForChart(
        trx,
        chartId
    )
    return omitUndefinedValues({
        variableId: parent?.variableId,
        config: parent?.config,
        isActive: isInheritanceEnabled,
    })
}

export async function getChartPatchConfigJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = expectInt(req.params.chartId)
    const config = await expectPatchConfigByChartId(trx, chartId)
    return config
}

export async function getChartLogsJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return {
        logs: await getLogsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    }
}

export async function getChartReferencesJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const references = {
        references: await getReferencesByChartId(
            parseInt(req.params.chartId as string),
            trx
        ),
    }
    return references
}

export async function getChartRedirectsJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return {
        redirects: await getRedirectsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    }
}

export async function getChartPageviewsJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const slug = await getChartSlugById(
        trx,
        parseInt(req.params.chartId as string)
    )
    if (!slug) return {}

    const pageviewsByUrl = await db.knexRawFirst(
        trx,
        `-- sql
        SELECT *
        FROM
            analytics_pageviews
        WHERE
            url = ?`,
        [`https://ourworldindata.org/grapher/${slug}`]
    )

    return {
        pageviews: pageviewsByUrl ?? undefined,
    }
}

export async function getChartTagsJson(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const chartId = expectInt(req.params.chartId)
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
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    let shouldInherit: boolean | undefined
    if (req.query.inheritance) {
        shouldInherit = req.query.inheritance === "enable"
    }

    try {
        const { chartId } = await saveGrapher(trx, {
            user: res.locals.user,
            newConfig: req.body,
            shouldInherit,
        })

        return { success: true, chartId: chartId }
    } catch (err) {
        return { success: false, error: { message: String(err), status: 500 } }
    }
}

export async function setChartTagsHandler(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = expectInt(req.params.chartId)

    await setChartTags(trx, chartId, req.body.tags, res.locals.user.id)

    return { success: true }
}

export async function updateChart(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    let shouldInherit: boolean | undefined
    if (req.query.inheritance) {
        shouldInherit = req.query.inheritance === "enable"
    }

    const existingConfig = await expectChartById(trx, req.params.chartId)

    try {
        const { chartId, savedPatch } = await saveGrapher(trx, {
            user: res.locals.user,
            newConfig: req.body,
            existingConfig,
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

export async function deleteChart(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const chart = await expectChartById(trx, req.params.chartId)
    if (chart.slug) {
        const links = await getPublishedLinksTo(trx, [chart.slug])
        if (links.length) {
            const sources = links.map((link) => link.slug).join(", ")
            throw new Error(
                `Cannot delete chart in-use in the following published documents: ${sources}`
            )
        }
    }

    await db.knexRaw(trx, `DELETE FROM chart_dimensions WHERE chartId=?`, [
        chart.id,
    ])
    await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE chart_id=?`, [
        chart.id,
    ])

    const row = await db.knexRawFirst<Pick<DbPlainChart, "configId">>(
        trx,
        `SELECT configId FROM charts WHERE id = ?`,
        [chart.id]
    )
    if (!row || !row.configId)
        throw new JsonError(`No chart config found for id ${chart.id}`, 404)
    if (row) {
        await db.knexRaw(trx, `DELETE FROM charts WHERE id=?`, [chart.id])
        await db.knexRaw(trx, `DELETE FROM chart_configs WHERE id=?`, [
            row.configId,
        ])
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
