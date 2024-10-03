/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import * as lodash from "lodash"
import * as db from "../db/db.js"
import {
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    BAKED_BASE_URL,
    ADMIN_BASE_URL,
    DATA_API_URL,
} from "../settings/serverSettings.js"
import {
    Base64String,
    expectInt,
    isValidSlug,
} from "../serverUtils/serverUtil.js"
import {
    OldChartFieldList,
    assignTagsForCharts,
    getChartConfigById,
    getChartSlugById,
    getGptTopicSuggestions,
    getRedirectsByChartId,
    oldChartFieldList,
    setChartTags,
    getParentByChartConfig,
    getPatchConfigByChartId,
    isInheritanceEnabledForChart,
    getParentByChartId,
} from "../db/model/Chart.js"
import { Request } from "./authentication.js"
import {
    getMergedGrapherConfigForVariable,
    fetchS3MetadataByPath,
    fetchS3DataValuesByPath,
    searchVariables,
    getGrapherConfigsForVariable,
    updateGrapherConfigAdminOfVariable,
    updateGrapherConfigETLOfVariable,
    updateAllChartsThatInheritFromIndicator,
    getAllChartsForIndicator,
} from "../db/model/Variable.js"
import { updateExistingFullConfig } from "../db/model/ChartConfigs.js"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    GDOCS_BASE_URL,
    camelCaseProperties,
    GdocsContentSource,
    isEmpty,
    JsonError,
    OwidGdocPostInterface,
    parseIntOrUndefined,
    DbRawPostWithGdocPublishStatus,
    OwidVariableWithSource,
    TaggableType,
    DbChartTagJoin,
    pick,
    Json,
    checkIsGdocPostExcludingFragments,
    checkIsPlainObjectWithGuard,
    mergeGrapherConfigs,
    diffGrapherConfigs,
    omitUndefinedValues,
    getParentVariableIdFromChartConfig,
    omit,
    gdocUrlRegex,
} from "@ourworldindata/utils"
import { applyPatch } from "../adminShared/patchHelper.js"
import {
    OperationContext,
    parseToOperation,
} from "../adminShared/SqlFilterSExpression.js"
import {
    BulkChartEditResponseRow,
    BulkGrapherConfigResponse,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    GrapherConfigPatch,
    variableAnnotationAllowedColumnNamesAndTypes,
    VariableAnnotationsResponseRow,
} from "../adminShared/AdminSessionTypes.js"
import {
    DbPlainDatasetTag,
    GrapherInterface,
    OwidGdocType,
    DbPlainUser,
    UsersTableName,
    DbPlainTag,
    DbRawVariable,
    parseOriginsRow,
    PostsTableName,
    DbRawPost,
    DbPlainChartSlugRedirect,
    DbPlainChart,
    DbInsertChartRevision,
    serializeChartConfig,
    DbRawOrigin,
    DbRawPostGdoc,
    PostsGdocsXImagesTableName,
    PostsGdocsLinksTableName,
    PostsGdocsTableName,
    DbPlainDataset,
    DbInsertUser,
    FlatTagGraph,
    DbRawChartConfig,
    parseChartConfig,
    R2GrapherConfigDirectory,
} from "@ourworldindata/types"
import { uuidv7 } from "uuidv7"
import {
    defaultGrapherConfig,
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import { getDatasetById, setTagsForDataset } from "../db/model/Dataset.js"
import { getUserById, insertUser, updateUser } from "../db/model/User.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import {
    syncDatasetToGitRepo,
    removeDatasetFromGitRepo,
} from "./gitDataExport.js"
import { denormalizeLatestCountryData } from "../baker/countryProfiles.js"
import {
    indexIndividualGdocPost,
    removeIndividualGdocPostFromIndex,
} from "../baker/algolia/algoliaUtils.js"
import { References } from "../adminSiteClient/ChartEditor.js"
import { DeployQueueServer } from "../baker/DeployQueueServer.js"
import { FunctionalRouter } from "./FunctionalRouter.js"
import Papa from "papaparse"
import {
    setTagsForPost,
    getTagsByPostId,
    getWordpressPostReferencesByChartId,
    getGdocsPostReferencesByChartId,
} from "../db/model/Post.js"
import {
    checkHasChanges,
    checkIsLightningUpdate,
    GdocPublishingAction,
    getPublishingAction,
} from "../adminSiteClient/gdocsDeploy.js"
import { createGdocAndInsertOwidGdocPostContent } from "../db/model/Gdoc/archieToGdoc.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    getRouteWithROTransaction,
    deleteRouteWithRWTransaction,
    putRouteWithRWTransaction,
    postRouteWithRWTransaction,
    patchRouteWithRWTransaction,
    getRouteNonIdempotentWithRWTransaction,
} from "./functionalRouterHelpers.js"
import { getPublishedLinksTo } from "../db/model/Link.js"
import {
    getChainedRedirect,
    getRedirectById,
    getRedirects,
    redirectWithSourceExists,
} from "../db/model/Redirect.js"
import { getMinimalGdocPostsByIds } from "../db/model/Gdoc/GdocBase.js"
import {
    GdocLinkUpdateMode,
    createOrLoadGdocById,
    gdocFromJSON,
    getAllGdocIndexItemsOrderedByUpdatedAt,
    getAndLoadGdocById,
    getGdocBaseObjectById,
    setLinksForGdoc,
    setTagsForGdoc,
    addImagesToContentGraph,
    updateGdocContentOnly,
    upsertGdoc,
} from "../db/model/Gdoc/GdocFactory.js"
import { match } from "ts-pattern"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { GdocHomepage } from "../db/model/Gdoc/GdocHomepage.js"
import { GdocAuthor } from "../db/model/Gdoc/GdocAuthor.js"
import path from "path"
import {
    deleteGrapherConfigFromR2,
    deleteGrapherConfigFromR2ByUUID,
    saveGrapherConfigToR2,
    saveGrapherConfigToR2ByUUID,
} from "./chartConfigR2Helpers.js"
import { fetchImagesFromDriveAndSyncToS3 } from "../db/model/Image.js"

const apiRouter = new FunctionalRouter()

// Call this to trigger build and deployment of static charts on change
const triggerStaticBuild = async (user: DbPlainUser, commitMessage: string) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
    })
}

const enqueueLightningChange = async (
    user: DbPlainUser,
    commitMessage: string,
    slug: string
) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
        slug,
    })
}

async function getLogsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<
    {
        userId: number
        config: Json
        userName: string
        createdAt: Date
    }[]
> {
    const logs = await db.knexRaw<{
        userId: number
        config: string
        userName: string
        createdAt: Date
    }>(
        knex,
        `SELECT userId, config, fullName as userName, l.createdAt
        FROM chart_revisions l
        LEFT JOIN users u on u.id = userId
        WHERE chartId = ?
        ORDER BY l.id DESC
        LIMIT 50`,
        [chartId]
    )
    return logs.map((log) => ({
        ...log,
        config: JSON.parse(log.config),
    }))
}

const getReferencesByChartId = async (
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
    const [postsWordpress, postsGdocs, explorerSlugs] = await Promise.all([
        postsWordpressPromise,
        postGdocsPromise,
        explorerSlugsPromise,
    ])

    return {
        postsGdocs,
        postsWordpress,
        explorers: explorerSlugs.map(
            (row: { explorerSlug: string }) => row.explorerSlug
        ),
    }
}

const expectChartById = async (
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
): Promise<{ patchConfig: GrapherInterface; fullConfig: GrapherInterface }> => {
    // grab the parent of the chart if inheritance should be enabled
    const parent = shouldInherit
        ? await getParentByChartConfig(knex, config)
        : undefined
    const fullParentConfig = mergeGrapherConfigs(
        defaultGrapherConfig,
        parent?.config ?? {}
    )

    // compute patch and full configs
    const patchConfig = diffGrapherConfigs(config, fullParentConfig)
    const fullConfig = mergeGrapherConfigs(fullParentConfig, patchConfig)
    const fullConfigStringified = serializeChartConfig(fullConfig)

    // insert patch & full configs into the chart_configs table
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
            fullConfigStringified,
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

    return { patchConfig, fullConfig }
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
): Promise<{ patchConfig: GrapherInterface; fullConfig: GrapherInterface }> => {
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
    const fullParentConfig = mergeGrapherConfigs(
        defaultGrapherConfig,
        parent?.config ?? {}
    )

    // compute patch and full configs
    const patchConfig = diffGrapherConfigs(config, fullParentConfig)
    const fullConfig = mergeGrapherConfigs(fullParentConfig, patchConfig)
    const fullConfigStringified = serializeChartConfig(fullConfig)

    const chartConfigId = await db.knexRawFirst<Pick<DbPlainChart, "configId">>(
        knex,
        `SELECT configId FROM charts WHERE id = ?`,
        [chartId]
    )

    if (!chartConfigId)
        throw new JsonError(`No chart config found for id ${chartId}`, 404)

    const now = new Date()

    // update configs
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET
                patch=?,
                full=?,
                updatedAt=?
            WHERE id = ?
        `,
        [
            serializeChartConfig(patchConfig),
            fullConfigStringified,
            now,
            chartConfigId.configId,
        ]
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

    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const fullConfigMd5 = await db.knexRawFirst<
        Pick<DbRawChartConfig, "full" | "fullMd5">
    >(
        knex,
        `-- sql
            select full, fullMd5 from chart_configs where id = ?`,
        [chartConfigId.configId]
    )

    await saveGrapherConfigToR2ByUUID(
        chartConfigId.configId,
        fullConfigMd5!.full,
        fullConfigMd5!.fullMd5 as Base64String
    )

    return { patchConfig, fullConfig }
}

const saveGrapher = async (
    knex: db.KnexReadWriteTransaction,
    {
        user,
        newConfig,
        existingConfig,
        shouldInherit,
        referencedVariablesMightChange = true,
    }: {
        user: DbPlainUser
        newConfig: GrapherInterface // Note that it is valid for newConfig to be of an older schema version which means that GrapherInterface as a type is slightly misleading
        existingConfig?: GrapherInterface
        // if undefined, keep inheritance as is.
        // if true or false, enable or disable inheritance
        shouldInherit?: boolean
        // if the variables a chart uses can change then we need
        // to update the latest country data which takes quite a long time (hundreds of ms)
        referencedVariablesMightChange?: boolean
    }
) => {
    // Slugs need some special logic to ensure public urls remain consistent whenever possible
    async function isSlugUsedInRedirect() {
        const rows = await db.knexRaw<DbPlainChartSlugRedirect>(
            knex,
            `SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`,
            // -1 is a placeholder ID that will never exist; but we cannot use NULL because
            // in that case we would always get back an empty resultset
            [existingConfig ? existingConfig.id : -1, newConfig.slug]
        )
        return rows.length > 0
    }

    async function isSlugUsedInOtherGrapher() {
        const rows = await db.knexRaw<Pick<DbPlainChart, "id">>(
            knex,
            `-- sql
                SELECT c.id
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE
                    c.id != ?
                    AND cc.full ->> "$.isPublished" = "true"
                    AND cc.slug = ?
            `,
            // -1 is a placeholder ID that will never exist; but we cannot use NULL because
            // in that case we would always get back an empty resultset
            [existingConfig ? existingConfig.id : -1, newConfig.slug]
        )
        return rows.length > 0
    }

    // When a chart is published, check for conflicts
    if (newConfig.isPublished) {
        if (!isValidSlug(newConfig.slug))
            throw new JsonError(`Invalid chart slug ${newConfig.slug}`)
        else if (await isSlugUsedInRedirect())
            throw new JsonError(
                `This chart slug was previously used by another chart: ${newConfig.slug}`
            )
        else if (await isSlugUsedInOtherGrapher())
            throw new JsonError(
                `This chart slug is in use by another published chart: ${newConfig.slug}`
            )
        else if (
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

    // if the schema version is missing, assume it's the latest
    if (newConfig.$schema === undefined) {
        newConfig.$schema = defaultGrapherConfig.$schema
    } else if (
        newConfig.$schema ===
        "https://files.ourworldindata.org/schemas/grapher-schema.004.json"
    ) {
        // TODO: find a more principled way to do schema upgrades

        // grapher-schema.004 -> grapher-schema.005 removed the obsolete hideLinesOutsideTolerance field
        const configForMigration = newConfig as any
        delete configForMigration.hideLinesOutsideTolerance
        configForMigration.$schema = defaultGrapherConfig.$schema
        newConfig = configForMigration
    }

    // add the isPublished field if is missing
    if (newConfig.isPublished === undefined) {
        newConfig.isPublished = false
    }

    // Execute the actual database update or creation
    let chartId: number
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
        patchConfig = configs.patchConfig
        fullConfig = configs.fullConfig
    } else {
        const configs = await saveNewChart(knex, {
            config: newConfig,
            user,
            shouldInherit,
        })
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
        // We need to get the full config and the md5 hash from the database instead of
        // computing our own md5 hash because MySQL normalizes JSON and our
        // client computed md5 would be different from the ones computed by and stored in R2
        const fullConfigMd5 = await db.knexRawFirst<
            Pick<DbRawChartConfig, "full" | "fullMd5">
        >(
            knex,
            `-- sql
            select cc.full, cc.fullMd5 from chart_configs cc
            join charts c on c.configId = cc.id
            where c.id = ?`,
            [chartId]
        )

        await saveGrapherConfigToR2(
            fullConfigMd5!.full,
            R2GrapherConfigDirectory.publishedGrapherBySlug,
            `${fullConfig.slug}.json`,
            fullConfigMd5!.fullMd5 as Base64String
        )
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

getRouteWithROTransaction(apiRouter, "/charts.json", async (req, res, trx) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
            SELECT ${oldChartFieldList} FROM charts
            JOIN chart_configs ON chart_configs.id = charts.configId
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            ORDER BY charts.lastEditedAt DESC LIMIT ?
        `,
        [limit]
    )

    await assignTagsForCharts(trx, charts)

    return { charts }
})

getRouteWithROTransaction(apiRouter, "/charts.csv", async (req, res, trx) => {
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
                chart_configs.full->>"$.type" AS type,
                chart_configs.full->>"$.internalNotes" AS internalNotes,
                chart_configs.full->>"$.variantName" AS variantName,
                chart_configs.full->>"$.isPublished" AS isPublished,
                chart_configs.full->>"$.tab" AS tab,
                JSON_EXTRACT(chart_configs.full, "$.hasChartTab") = true AS hasChartTab,
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
})

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.config.json",
    async (req, res, trx) => expectChartById(trx, req.params.chartId)
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.parent.json",
    async (req, res, trx) => {
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
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.patchConfig.json",
    async (req, res, trx) => {
        const chartId = expectInt(req.params.chartId)
        const config = await expectPatchConfigByChartId(trx, chartId)
        return config
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/editorData/namespaces.json",
    async (req, res, trx) => {
        const rows = await db.knexRaw<{
            name: string
            description?: string
            isArchived: boolean
        }>(
            trx,
            `SELECT DISTINCT
                namespace AS name,
                namespaces.description AS description,
                namespaces.isArchived AS isArchived
            FROM active_datasets
            JOIN namespaces ON namespaces.name = active_datasets.namespace`
        )

        return {
            namespaces: lodash
                .sortBy(rows, (row) => row.description)
                .map((namespace) => ({
                    ...namespace,
                    isArchived: !!namespace.isArchived,
                })),
        }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.logs.json",
    async (req, res, trx) => ({
        logs: await getLogsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    })
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.references.json",
    async (req, res, trx) => {
        const references = {
            references: await getReferencesByChartId(
                parseInt(req.params.chartId as string),
                trx
            ),
        }
        return references
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.redirects.json",
    async (req, res, trx) => ({
        redirects: await getRedirectsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    })
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.pageviews.json",
    async (req, res, trx) => {
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
)

getRouteWithROTransaction(
    apiRouter,
    "/editorData/variables.json",
    async (req, res, trx) => {
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
)

apiRouter.get("/data/variables/data/:variableStr.json", async (req, res) => {
    const variableStr = req.params.variableStr as string
    if (!variableStr) throw new JsonError("No variable id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple variables at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid variable id")
    return await fetchS3DataValuesByPath(
        getVariableDataRoute(DATA_API_URL, variableId) + "?nocache"
    )
})

apiRouter.get(
    "/data/variables/metadata/:variableStr.json",
    async (req, res) => {
        const variableStr = req.params.variableStr as string
        if (!variableStr) throw new JsonError("No variable id given")
        if (variableStr.includes("+"))
            throw new JsonError(
                "Requesting multiple variables at the same time is no longer supported"
            )
        const variableId = parseInt(variableStr)
        if (isNaN(variableId)) throw new JsonError("Invalid variable id")
        return await fetchS3MetadataByPath(
            getVariableMetadataRoute(DATA_API_URL, variableId) + "?nocache"
        )
    }
)

postRouteWithRWTransaction(apiRouter, "/charts", async (req, res, trx) => {
    let shouldInherit: boolean | undefined
    if (req.query.inheritance) {
        shouldInherit = req.query.inheritance === "enable"
    }

    const { chartId } = await saveGrapher(trx, {
        user: res.locals.user,
        newConfig: req.body,
        shouldInherit,
    })

    return { success: true, chartId: chartId }
})

postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/setTags",
    async (req, res, trx) => {
        const chartId = expectInt(req.params.chartId)

        await setChartTags(trx, chartId, req.body.tags)

        return { success: true }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId",
    async (req, res, trx) => {
        let shouldInherit: boolean | undefined
        if (req.query.inheritance) {
            shouldInherit = req.query.inheritance === "enable"
        }

        const existingConfig = await expectChartById(trx, req.params.chartId)

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
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId",
    async (req, res, trx) => {
        const chart = await expectChartById(trx, req.params.chartId)
        const links = await getPublishedLinksTo(trx, [chart.slug!])
        if (links.length) {
            const sources = links.map((link) => link.sourceSlug).join(", ")
            throw new Error(
                `Cannot delete chart in-use in the following published documents: ${sources}`
            )
        }

        await db.knexRaw(trx, `DELETE FROM chart_dimensions WHERE chartId=?`, [
            chart.id,
        ])
        await db.knexRaw(
            trx,
            `DELETE FROM chart_slug_redirects WHERE chart_id=?`,
            [chart.id]
        )

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
)

getRouteWithROTransaction(apiRouter, "/users.json", async (req, res, trx) => ({
    users: await trx
        .select(
            "id" satisfies keyof DbPlainUser,
            "email" satisfies keyof DbPlainUser,
            "fullName" satisfies keyof DbPlainUser,
            "isActive" satisfies keyof DbPlainUser,
            "isSuperuser" satisfies keyof DbPlainUser,
            "createdAt" satisfies keyof DbPlainUser,
            "updatedAt" satisfies keyof DbPlainUser,
            "lastLogin" satisfies keyof DbPlainUser,
            "lastSeen" satisfies keyof DbPlainUser
        )
        .from<DbPlainUser>(UsersTableName)
        .orderBy("lastSeen", "desc"),
}))

getRouteWithROTransaction(
    apiRouter,
    "/users/:userId.json",
    async (req, res, trx) => {
        const id = parseIntOrUndefined(req.params.userId)
        if (!id) throw new JsonError("No user id given")
        const user = await getUserById(trx, id)
        return { user }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/users/:userId",
    async (req, res, trx) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const userId = expectInt(req.params.userId)
        await db.knexRaw(trx, `DELETE FROM users WHERE id=?`, [userId])

        return { success: true }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/users/:userId",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const userId = parseIntOrUndefined(req.params.userId)
        const user =
            userId !== undefined ? await getUserById(trx, userId) : null
        if (!user) throw new JsonError("No such user", 404)

        user.fullName = req.body.fullName
        user.isActive = req.body.isActive

        await updateUser(trx, userId!, pick(user, ["fullName", "isActive"]))

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/users/add",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const { email, fullName } = req.body

        await insertUser(trx, {
            email,
            fullName,
        })

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables.json",
    async (req, res, trx) => {
        const limit = parseIntOrUndefined(req.query.limit as string) ?? 50
        const query = req.query.search as string
        return await searchVariables(query, limit, trx)
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/chart-bulk-update",
    async (
        req,
        res,
        trx
    ): Promise<BulkGrapherConfigResponse<BulkChartEditResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "chart_configs.full",
            whitelistedColumnNamesAndTypes:
                chartBulkUpdateAllowedColumnNamesAndTypes,
        }
        const filterSExpr =
            req.query.filter !== undefined
                ? parseToOperation(req.query.filter as string, context)
                : undefined

        const offset = parseIntOrUndefined(req.query.offset as string) ?? 0

        // Note that our DSL generates sql here that we splice directly into the SQL as text
        // This is a potential for a SQL injection attack but we control the DSL and are
        // careful there to only allow carefully guarded vocabularies from being used, not
        // arbitrary user input
        const whereClause = filterSExpr?.toSql() ?? "true"
        const resultsWithStringGrapherConfigs = await db.knexRaw(
            trx,
            `-- sql
                SELECT
                    charts.id as id,
                    chart_configs.full as config,
                    charts.createdAt as createdAt,
                    charts.updatedAt as updatedAt,
                    charts.lastEditedAt as lastEditedAt,
                    charts.publishedAt as publishedAt,
                    lastEditedByUser.fullName as lastEditedByUser,
                    publishedByUser.fullName as publishedByUser
                FROM charts
                LEFT JOIN chart_configs ON chart_configs.id = charts.configId
                LEFT JOIN users lastEditedByUser ON lastEditedByUser.id=charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id=charts.publishedByUserId
                WHERE ${whereClause}
                ORDER BY charts.id DESC
                LIMIT 50
                OFFSET ${offset.toString()}
            `
        )

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.knexRaw<{ count: number }>(
            trx,
            `-- sql
                SELECT count(*) as count
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                WHERE ${whereClause}
            `
        )
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

patchRouteWithRWTransaction(
    apiRouter,
    "/chart-bulk-update",
    async (req, res, trx) => {
        const patchesList = req.body as GrapherConfigPatch[]
        const chartIds = new Set(patchesList.map((patch) => patch.id))

        const configsAndIds = await db.knexRaw<
            Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
        >(
            trx,
            `-- sql
                SELECT c.id, cc.full as config
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE c.id IN (?)
            `,
            [[...chartIds.values()]]
        )
        const configMap = new Map<number, GrapherInterface>(
            configsAndIds.map((item: any) => [
                item.id,
                // make sure that the id is set, otherwise the update behaviour is weird
                // TODO: discuss if this has unintended side effects
                item.config ? { ...JSON.parse(item.config), id: item.id } : {},
            ])
        )
        const oldValuesConfigMap = new Map(configMap)
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [id, newConfig] of configMap.entries()) {
            await saveGrapher(trx, {
                user: res.locals.user,
                newConfig,
                existingConfig: oldValuesConfigMap.get(id),
                referencedVariablesMightChange: false,
            })
        }

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variable-annotations",
    async (
        req,
        res,
        trx
    ): Promise<BulkGrapherConfigResponse<VariableAnnotationsResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "grapherConfigAdmin",
            whitelistedColumnNamesAndTypes:
                variableAnnotationAllowedColumnNamesAndTypes,
        }
        const filterSExpr =
            req.query.filter !== undefined
                ? parseToOperation(req.query.filter as string, context)
                : undefined

        const offset = parseIntOrUndefined(req.query.offset as string) ?? 0

        // Note that our DSL generates sql here that we splice directly into the SQL as text
        // This is a potential for a SQL injection attack but we control the DSL and are
        // careful there to only allow carefully guarded vocabularies from being used, not
        // arbitrary user input
        const whereClause = filterSExpr?.toSql() ?? "true"
        const resultsWithStringGrapherConfigs = await db.knexRaw(
            trx,
            `-- sql
                SELECT
                    variables.id as id,
                    variables.name as name,
                    chart_configs.patch as config,
                    d.name as datasetname,
                    namespaces.name as namespacename,
                    variables.createdAt as createdAt,
                    variables.updatedAt as updatedAt,
                    variables.description as description
                FROM variables
                LEFT JOIN active_datasets as d on variables.datasetId = d.id
                LEFT JOIN namespaces on d.namespace = namespaces.name
                LEFT JOIN chart_configs on variables.grapherConfigIdAdmin = chart_configs.id
                WHERE ${whereClause}
                ORDER BY variables.id DESC
                LIMIT 50
                OFFSET ${offset.toString()}
            `
        )

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.knexRaw<{ count: number }>(
            trx,
            `-- sql
                SELECT count(*) as count
                FROM variables
                LEFT JOIN active_datasets as d on variables.datasetId = d.id
                LEFT JOIN namespaces on d.namespace = namespaces.name
                LEFT JOIN chart_configs on variables.grapherConfigIdAdmin = chart_configs.id
                WHERE ${whereClause}
            `
        )
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

patchRouteWithRWTransaction(
    apiRouter,
    "/variable-annotations",
    async (req, res, trx) => {
        const patchesList = req.body as GrapherConfigPatch[]
        const variableIds = new Set(patchesList.map((patch) => patch.id))

        const configsAndIds = await db.knexRaw<
            Pick<DbRawVariable, "id"> & {
                grapherConfigAdmin: DbRawChartConfig["patch"]
            }
        >(
            trx,
            `-- sql
              SELECT v.id, cc.patch AS grapherConfigAdmin
              FROM variables v
              LEFT JOIN chart_configs cc ON v.grapherConfigIdAdmin = cc.id
              WHERE v.id IN (?)
          `,
            [[...variableIds.values()]]
        )
        const configMap = new Map(
            configsAndIds.map((item: any) => [
                item.id,
                item.grapherConfigAdmin
                    ? JSON.parse(item.grapherConfigAdmin)
                    : {},
            ])
        )
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [variableId, newConfig] of configMap.entries()) {
            const variable = await getGrapherConfigsForVariable(trx, variableId)
            if (!variable) continue
            await updateGrapherConfigAdminOfVariable(trx, variable, newConfig)
        }

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables.usages.json",
    async (req, res, trx) => {
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
)

getRouteWithROTransaction(
    apiRouter,
    "/variables/grapherConfigETL/:variableId.patchConfig.json",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)
        const variable = await getGrapherConfigsForVariable(trx, variableId)
        if (!variable) {
            throw new JsonError(`Variable with id ${variableId} not found`, 500)
        }
        return variable.etl?.patchConfig ?? {}
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables/grapherConfigAdmin/:variableId.patchConfig.json",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)
        const variable = await getGrapherConfigsForVariable(trx, variableId)
        if (!variable) {
            throw new JsonError(`Variable with id ${variableId} not found`, 500)
        }
        return variable.admin?.patchConfig ?? {}
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables/mergedGrapherConfig/:variableId.json",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)
        const config = await getMergedGrapherConfigForVariable(trx, variableId)
        return config ?? {}
    }
)

// Used in VariableEditPage
getRouteWithROTransaction(
    apiRouter,
    "/variables/:variableId.json",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await fetchS3MetadataByPath(
            getVariableMetadataRoute(DATA_API_URL, variableId) + "?nocache"
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
            }
        >(
            trx,
            `-- sql
                SELECT ${oldChartFieldList}, charts.isInheritanceEnabled, chart_configs.full AS config
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                JOIN chart_dimensions cd ON cd.chartId = charts.id
                WHERE cd.variableId = ?
                GROUP BY charts.id
            `,
            [variableId]
        )

        // check for parent indicators
        const charts = rawCharts.map((chart) => {
            const parentIndicatorId = getParentVariableIdFromChartConfig(
                parseChartConfig(chart.config)
            )
            const hasParentIndicator = parentIndicatorId !== undefined
            return omit({ ...chart, hasParentIndicator }, "config")
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
            const [varDims, otherDims] = lodash.partition(
                mergedGrapherConfig.dimensions ?? [],
                (dim) => dim.variableId === variableId
            )
            const varDimsWithDisplay = varDims.map((dim) => ({
                display: variable.display,
                ...dim,
            }))
            mergedGrapherConfig.dimensions = [
                ...varDimsWithDisplay,
                ...otherDims,
            ]
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
)

// inserts a new config or updates an existing one
putRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigETL",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await getGrapherConfigsForVariable(trx, variableId)
        if (!variable) {
            throw new JsonError(`Variable with id ${variableId} not found`, 500)
        }

        const { savedPatch, updatedCharts } =
            await updateGrapherConfigETLOfVariable(trx, variable, req.body)

        // trigger build if any published chart has been updated
        if (updatedCharts.some((chart) => chart.isPublished)) {
            await triggerStaticBuild(
                res.locals.user,
                `Updating ETL config for variable ${variableId}`
            )
        }

        return { success: true, savedPatch }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigETL",
    async (req, res, trx) => {
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

        // update all charts that inherit from the indicator
        const updatedCharts = await updateAllChartsThatInheritFromIndicator(
            trx,
            variableId,
            {
                patchConfigAdmin: variable.admin?.patchConfig,
                updatedAt: now,
            }
        )

        // trigger build if any published chart has been updated
        if (updatedCharts.some((chart) => chart.isPublished)) {
            await triggerStaticBuild(
                res.locals.user,
                `Updating ETL config for variable ${variableId}`
            )
        }

        return { success: true }
    }
)

// inserts a new config or updates an existing one
putRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigAdmin",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await getGrapherConfigsForVariable(trx, variableId)
        if (!variable) {
            throw new JsonError(`Variable with id ${variableId} not found`, 500)
        }

        const { savedPatch, updatedCharts } =
            await updateGrapherConfigAdminOfVariable(trx, variable, req.body)

        // trigger build if any published chart has been updated
        if (updatedCharts.some((chart) => chart.isPublished)) {
            await triggerStaticBuild(
                res.locals.user,
                `Updating admin-authored config for variable ${variableId}`
            )
        }

        return { success: true, savedPatch }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigAdmin",
    async (req, res, trx) => {
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

        // update all charts that inherit from the indicator
        const updatedCharts = await updateAllChartsThatInheritFromIndicator(
            trx,
            variableId,
            {
                patchConfigETL: variable.etl?.patchConfig,
                updatedAt: now,
            }
        )

        // trigger build if any published chart has been updated
        if (updatedCharts.some((chart) => chart.isPublished)) {
            await triggerStaticBuild(
                res.locals.user,
                `Updating admin-authored config for variable ${variableId}`
            )
        }

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables/:variableId/charts.json",
    async (req, res, trx) => {
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
)

getRouteWithROTransaction(
    apiRouter,
    "/datasets.json",
    async (req, res, trx) => {
        const datasets = await db.knexRaw<Record<string, any>>(
            trx,
            `-- sql
        WITH variable_counts AS (
            SELECT
                v.datasetId,
                COUNT(DISTINCT cd.chartId) as numCharts
            FROM chart_dimensions cd
            JOIN variables v ON cd.variableId = v.id
            GROUP BY v.datasetId
        )
        SELECT
            ad.id,
            ad.namespace,
            ad.name,
            d.shortName,
            ad.description,
            ad.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            ad.metadataEditedAt,
            mu.fullName AS metadataEditedByUserName,
            ad.isPrivate,
            ad.nonRedistributable,
            d.version,
            vc.numCharts
        FROM active_datasets ad
        LEFT JOIN variable_counts vc ON ad.id = vc.datasetId
        JOIN users du ON du.id=ad.dataEditedByUserId
        JOIN users mu ON mu.id=ad.metadataEditedByUserId
        JOIN datasets d ON d.id=ad.id
        ORDER BY ad.dataEditedAt DESC
    `
        )

        const tags = await db.knexRaw<
            Pick<DbPlainTag, "id" | "name"> &
                Pick<DbPlainDatasetTag, "datasetId">
        >(
            trx,
            `-- sql
        SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
        JOIN tags t ON dt.tagId = t.id
    `
        )
        const tagsByDatasetId = lodash.groupBy(tags, (t) => t.datasetId)
        for (const dataset of datasets) {
            dataset.tags = (tagsByDatasetId[dataset.id] || []).map((t) =>
                lodash.omit(t, "datasetId")
            )
        }
        /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

        return { datasets: datasets }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/datasets/:datasetId.json",
    async (req: Request, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await db.knexRawFirst<Record<string, any>>(
            trx,
            `-- sql
        SELECT d.id,
            d.namespace,
            d.name,
            d.shortName,
            d.version,
            d.description,
            d.updatedAt,
            d.dataEditedAt,
            d.dataEditedByUserId,
            du.fullName AS dataEditedByUserName,
            d.metadataEditedAt,
            d.metadataEditedByUserId,
            mu.fullName AS metadataEditedByUserName,
            d.isPrivate,
            d.isArchived,
            d.nonRedistributable,
            d.updatePeriodDays
        FROM datasets AS d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        WHERE d.id = ?
    `,
            [datasetId]
        )

        if (!dataset)
            throw new JsonError(`No dataset by id '${datasetId}'`, 404)

        const zipFile = await db.knexRawFirst<{ filename: string }>(
            trx,
            `SELECT filename FROM dataset_files WHERE datasetId=?`,
            [datasetId]
        )
        if (zipFile) dataset.zipFile = zipFile

        const variables = await db.knexRaw<
            Pick<
                DbRawVariable,
                "id" | "name" | "description" | "display" | "catalogPath"
            >
        >(
            trx,
            `-- sql
            SELECT
                v.id,
                v.name,
                v.description,
                v.display,
                v.catalogPath
            FROM
                variables AS v
            WHERE
                v.datasetId = ?
    `,
            [datasetId]
        )

        for (const v of variables) {
            v.display = JSON.parse(v.display)
        }

        dataset.variables = variables

        // add all origins
        const origins: DbRawOrigin[] = await db.knexRaw<DbRawOrigin>(
            trx,
            `-- sql
            SELECT DISTINCT
                o.*
            FROM
                origins_variables AS ov
                JOIN origins AS o ON ov.originId = o.id
                JOIN variables AS v ON ov.variableId = v.id
            WHERE
                v.datasetId = ?
    `,
            [datasetId]
        )

        const parsedOrigins = origins.map(parseOriginsRow)

        dataset.origins = parsedOrigins

        const sources = await db.knexRaw<{
            id: number
            name: string
            description: string
        }>(
            trx,
            `
        SELECT s.id, s.name, s.description
        FROM sources AS s
        WHERE s.datasetId = ?
        ORDER BY s.id ASC
    `,
            [datasetId]
        )

        // expand description of sources and add to dataset as variableSources
        dataset.variableSources = sources.map((s: any) => {
            return {
                id: s.id,
                name: s.name,
                ...JSON.parse(s.description),
            }
        })

        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `-- sql
                SELECT ${oldChartFieldList}
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                JOIN chart_dimensions AS cd ON cd.chartId = charts.id
                JOIN variables AS v ON cd.variableId = v.id
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                WHERE v.datasetId = ?
                GROUP BY charts.id
            `,
            [datasetId]
        )

        dataset.charts = charts

        await assignTagsForCharts(trx, charts)

        const tags = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `
        SELECT t.id, t.name
        FROM tags t
        JOIN dataset_tags dt ON dt.tagId = t.id
        WHERE dt.datasetId = ?
    `,
            [datasetId]
        )
        dataset.tags = tags

        const availableTags = await db.knexRaw<{
            id: number
            name: string
            parentName: string
        }>(
            trx,
            `
        SELECT t.id, t.name, p.name AS parentName
        FROM tags AS t
        JOIN tags AS p ON t.parentId=p.id
    `
        )
        dataset.availableTags = availableTags

        return { dataset: dataset }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId",
    async (req, res, trx) => {
        // Only updates `nonRedistributable` and `tags`, other fields come from ETL
        // and are not editable
        const datasetId = expectInt(req.params.datasetId)
        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        const newDataset = (req.body as { dataset: any }).dataset
        await db.knexRaw(
            trx,
            `
            UPDATE datasets
            SET
                nonRedistributable=?,
                metadataEditedAt=?,
                metadataEditedByUserId=?
            WHERE id=?
            `,
            [
                newDataset.nonRedistributable,
                new Date(),
                res.locals.user.id,
                datasetId,
            ]
        )

        const tagRows = newDataset.tags.map((tag: any) => [tag.id, datasetId])
        await db.knexRaw(trx, `DELETE FROM dataset_tags WHERE datasetId=?`, [
            datasetId,
        ])
        if (tagRows.length)
            for (const tagRow of tagRows) {
                await db.knexRaw(
                    trx,
                    `INSERT INTO dataset_tags (tagId, datasetId) VALUES (?, ?)`,
                    tagRow
                )
            }

        try {
            await syncDatasetToGitRepo(trx, datasetId, {
                oldDatasetName: dataset.name,
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email,
            })
        } catch (err) {
            await logErrorAndMaybeSendToBugsnag(err, req)
            // Continue
        }

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/setArchived",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)
        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        await db.knexRaw(trx, `UPDATE datasets SET isArchived = 1 WHERE id=?`, [
            datasetId,
        ])
        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/setTags",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        await setTagsForDataset(trx, datasetId, req.body.tagIds)

        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        await db.knexRaw(
            trx,
            `DELETE d FROM country_latest_data AS d JOIN variables AS v ON d.variable_id=v.id WHERE v.datasetId=?`,
            [datasetId]
        )
        await db.knexRaw(trx, `DELETE FROM dataset_files WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM variables WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM sources WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM datasets WHERE id=?`, [datasetId])

        try {
            await removeDatasetFromGitRepo(dataset.name, dataset.namespace, {
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email,
            })
        } catch (err: any) {
            await logErrorAndMaybeSendToBugsnag(err, req)
            // Continue
        }

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/charts",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        if (req.body.republish) {
            await db.knexRaw(
                trx,
                `-- sql
                    UPDATE chart_configs cc
                    JOIN charts c ON c.configId = cc.id
                    SET
                        cc.patch = JSON_SET(cc.patch, "$.version", cc.patch->"$.version" + 1),
                        cc.full = JSON_SET(cc.full, "$.version", cc.full->"$.version" + 1)
                    WHERE c.id IN (
                        SELECT DISTINCT chart_dimensions.chartId
                        FROM chart_dimensions
                        JOIN variables ON variables.id = chart_dimensions.variableId
                        WHERE variables.datasetId = ?
                    )`,
                [datasetId]
            )
        }

        await triggerStaticBuild(
            res.locals.user,
            `Republishing all charts in dataset ${dataset.name} (${dataset.id})`
        )

        return { success: true }
    }
)

// Get a list of redirects that map old slugs to charts
getRouteWithROTransaction(
    apiRouter,
    "/redirects.json",
    async (req, res, trx) => ({
        redirects: await db.knexRaw(
            trx,
            `-- sql
                SELECT
                    r.id,
                    r.slug,
                    r.chart_id as chartId,
                    chart_configs.slug AS chartSlug
                FROM chart_slug_redirects AS r
                JOIN charts ON charts.id = r.chart_id
                JOIN chart_configs ON chart_configs.id = charts.configId
                ORDER BY r.id DESC
            `
        ),
    })
)

getRouteWithROTransaction(
    apiRouter,
    "/site-redirects.json",
    async (req, res, trx) => ({ redirects: await getRedirects(trx) })
)

postRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/new",
    async (req: Request, res, trx) => {
        const { source, target } = req.body
        const sourceAsUrl = new URL(source, "https://ourworldindata.org")
        if (sourceAsUrl.pathname === "/")
            throw new JsonError("Cannot redirect from /", 400)
        if (await redirectWithSourceExists(trx, source)) {
            throw new JsonError(
                `Redirect with source ${source} already exists`,
                400
            )
        }
        const chainedRedirect = await getChainedRedirect(trx, source, target)
        if (chainedRedirect) {
            throw new JsonError(
                "Creating this redirect would create a chain, redirect from " +
                    `${chainedRedirect.source} to ${chainedRedirect.target} ` +
                    "already exists. " +
                    (target === chainedRedirect.source
                        ? `Please create the redirect from ${source} to ` +
                          `${chainedRedirect.target} directly instead.`
                        : `Please delete the existing redirect and create a ` +
                          `new redirect from ${chainedRedirect.source} to ` +
                          `${target} instead.`),
                400
            )
        }
        const { insertId: id } = await db.knexRawInsert(
            trx,
            `INSERT INTO redirects (source, target) VALUES (?, ?)`,
            [source, target]
        )
        await triggerStaticBuild(
            res.locals.user,
            `Creating redirect id=${id} source=${source} target=${target}`
        )
        return { success: true, redirect: { id, source, target } }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/:id",
    async (req, res, trx) => {
        const id = expectInt(req.params.id)
        const redirect = await getRedirectById(trx, id)
        if (!redirect) {
            throw new JsonError(`No redirect found for id ${id}`, 404)
        }
        await db.knexRaw(trx, `DELETE FROM redirects WHERE id=?`, [id])
        await triggerStaticBuild(
            res.locals.user,
            `Deleting redirect id=${id} source=${redirect.source} target=${redirect.target}`
        )
        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/tags/:tagId.json",
    async (req, res, trx) => {
        const tagId = expectInt(req.params.tagId) as number | null

        // NOTE (Mispy): The "uncategorized" tag is special -- it represents all untagged stuff
        // Bit fiddly to handle here but more true to normalized schema than having to remember to add the special tag
        // every time we create a new chart etcs
        const uncategorized = tagId === UNCATEGORIZED_TAG_ID

        // TODO: when we have types for our endpoints, make tag of that type instead of any
        const tag: any = await db.knexRawFirst<
            Pick<
                DbPlainTag,
                | "id"
                | "name"
                | "specialType"
                | "updatedAt"
                | "parentId"
                | "slug"
            >
        >(
            trx,
            `-- sql
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, t.slug
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.id = ?
    `,
            [tagId]
        )

        // Datasets tagged with this tag
        const datasets = await db.knexRaw<
            Pick<
                DbPlainDataset,
                | "id"
                | "namespace"
                | "name"
                | "description"
                | "createdAt"
                | "updatedAt"
                | "dataEditedAt"
                | "isPrivate"
                | "nonRedistributable"
            > & { dataEditedByUserName: string }
        >(
            trx,
            `-- sql
        SELECT
            d.id,
            d.namespace,
            d.name,
            d.description,
            d.createdAt,
            d.updatedAt,
            d.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            d.isPrivate,
            d.nonRedistributable
        FROM active_datasets d
        JOIN users du ON du.id=d.dataEditedByUserId
        LEFT JOIN dataset_tags dt ON dt.datasetId = d.id
        WHERE dt.tagId ${uncategorized ? "IS NULL" : "= ?"}
        ORDER BY d.dataEditedAt DESC
    `,
            uncategorized ? [] : [tagId]
        )
        tag.datasets = datasets

        // The other tags for those datasets
        if (tag.datasets.length) {
            if (uncategorized) {
                for (const dataset of tag.datasets) dataset.tags = []
            } else {
                const datasetTags = await db.knexRaw<{
                    datasetId: number
                    id: number
                    name: string
                }>(
                    trx,
                    `-- sql
                SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
                JOIN tags t ON dt.tagId = t.id
                WHERE dt.datasetId IN (?)
            `,
                    [tag.datasets.map((d: any) => d.id)]
                )
                const tagsByDatasetId = lodash.groupBy(
                    datasetTags,
                    (t) => t.datasetId
                )
                for (const dataset of tag.datasets) {
                    dataset.tags = tagsByDatasetId[dataset.id].map((t) =>
                        lodash.omit(t, "datasetId")
                    )
                }
            }
        }

        // Charts using datasets under this tag
        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `-- sql
                SELECT ${oldChartFieldList} FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                LEFT JOIN chart_tags ct ON ct.chartId=charts.id
                JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
                WHERE ct.tagId ${tagId === UNCATEGORIZED_TAG_ID ? "IS NULL" : "= ?"}
                GROUP BY charts.id
                ORDER BY charts.updatedAt DESC
            `,
            uncategorized ? [] : [tagId]
        )
        tag.charts = charts

        await assignTagsForCharts(trx, charts)

        // Subcategories
        const children = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId = ?
    `,
            [tag.id]
        )
        tag.children = children

        // Possible parents to choose from
        const possibleParents = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId IS NULL
    `
        )
        tag.possibleParents = possibleParents

        return {
            tag,
        }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/tags/:tagId",
    async (req: Request, res, trx) => {
        const tagId = expectInt(req.params.tagId)
        const tag = (req.body as { tag: any }).tag
        await db.knexRaw(
            trx,
            `UPDATE tags SET name=?, updatedAt=?, slug=? WHERE id=?`,
            [tag.name, new Date(), tag.slug, tagId]
        )
        if (tag.slug) {
            // See if there's a published gdoc with a matching slug.
            // We're not enforcing that the gdoc be a topic page, as there are cases like /human-development-index,
            // where the page for the topic is just an article.
            const gdoc = await db.knexRaw<Pick<DbRawPostGdoc, "slug">>(
                trx,
                `-- sql
                SELECT slug FROM posts_gdocs pg
                WHERE EXISTS (
                        SELECT 1
                        FROM posts_gdocs_x_tags gt
                        WHERE pg.id = gt.gdocId AND gt.tagId = ?
                ) AND pg.published = TRUE AND pg.slug = ?`,
                [tagId, tag.slug]
            )
            if (!gdoc.length) {
                return {
                    success: true,
                    tagUpdateWarning: `The tag's slug has been updated, but there isn't a published Gdoc page with the same slug.

Are you sure you haven't made a typo?`,
                }
            }
        }
        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/tags/new",
    async (req: Request, res, trx) => {
        const tag = req.body
        function validateTag(
            tag: unknown
        ): tag is { name: string; slug: string | null } {
            return (
                checkIsPlainObjectWithGuard(tag) &&
                typeof tag.name === "string" &&
                (tag.slug === null ||
                    (typeof tag.slug === "string" && tag.slug !== ""))
            )
        }
        if (!validateTag(tag)) throw new JsonError("Invalid tag", 400)

        const conflictingTag = await db.knexRawFirst<{
            name: string
            slug: string | null
        }>(
            trx,
            `SELECT name, slug FROM tags WHERE name = ? OR (slug IS NOT NULL AND slug = ?)`,
            [tag.name, tag.slug]
        )
        if (conflictingTag)
            throw new JsonError(
                conflictingTag.name === tag.name
                    ? `Tag with name ${tag.name} already exists`
                    : `Tag with slug ${tag.slug} already exists`,
                400
            )

        const now = new Date()
        const result = await db.knexRawInsert(
            trx,
            `INSERT INTO tags (name, slug, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
            // parentId will be deprecated soon once we migrate fully to the tag graph
            [tag.name, tag.slug, now, now]
        )
        return { success: true, tagId: result.insertId }
    }
)

getRouteWithROTransaction(apiRouter, "/tags.json", async (req, res, trx) => {
    return { tags: await db.getMinimalTagsWithIsTopic(trx) }
})

deleteRouteWithRWTransaction(
    apiRouter,
    "/tags/:tagId/delete",
    async (req, res, trx) => {
        const tagId = expectInt(req.params.tagId)

        await db.knexRaw(trx, `DELETE FROM tags WHERE id=?`, [tagId])

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/redirects/new",
    async (req: Request, res, trx) => {
        const chartId = expectInt(req.params.chartId)
        const fields = req.body as { slug: string }
        const result = await db.knexRawInsert(
            trx,
            `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
            [chartId, fields.slug]
        )
        const redirectId = result.insertId
        const redirect = await db.knexRaw<DbPlainChartSlugRedirect>(
            trx,
            `SELECT * FROM chart_slug_redirects WHERE id = ?`,
            [redirectId]
        )
        return { success: true, redirect: redirect }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/redirects/:id",
    async (req, res, trx) => {
        const id = expectInt(req.params.id)

        const redirect = await db.knexRawFirst<DbPlainChartSlugRedirect>(
            trx,
            `SELECT * FROM chart_slug_redirects WHERE id = ?`,
            [id]
        )

        if (!redirect)
            throw new JsonError(`No redirect found for id ${id}`, 404)

        await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE id=?`, [
            id,
        ])
        await triggerStaticBuild(
            res.locals.user,
            `Deleting redirect from ${redirect.slug}`
        )

        return { success: true }
    }
)

getRouteWithROTransaction(apiRouter, "/posts.json", async (req, res, trx) => {
    const raw_rows = await db.knexRaw(
        trx,
        `-- sql
        WITH
            posts_tags_aggregated AS (
                SELECT
                    post_id,
                    IF(
                        COUNT(tags.id) = 0,
                        JSON_ARRAY(),
                        JSON_ARRAYAGG(JSON_OBJECT("id", tags.id, "name", tags.name))
                    ) AS tags
                FROM
                    post_tags
                    LEFT JOIN tags ON tags.id = post_tags.tag_id
                GROUP BY
                    post_id
            ),
            post_gdoc_slug_successors AS (
                SELECT
                    posts.id,
                    IF(
                        COUNT(gdocSlugSuccessor.id) = 0,
                        JSON_ARRAY(),
                        JSON_ARRAYAGG(
                            JSON_OBJECT("id", gdocSlugSuccessor.id, "published", gdocSlugSuccessor.published)
                        )
                    ) AS gdocSlugSuccessors
                FROM
                    posts
                    LEFT JOIN posts_gdocs gdocSlugSuccessor ON gdocSlugSuccessor.slug = posts.slug
                GROUP BY
                    posts.id
            )
            SELECT
                posts.id AS id,
                posts.title AS title,
                posts.type AS TYPE,
                posts.slug AS slug,
                STATUS,
                updated_at_in_wordpress,
                posts.authors,
                posts_tags_aggregated.tags AS tags,
                gdocSuccessorId,
                gdocSuccessor.published AS isGdocSuccessorPublished,
                -- posts can either have explict successors via the gdocSuccessorId column
                -- or implicit successors if a gdoc has been created that uses the same slug
                -- as a Wp post (the gdoc one wins once it is published)
                post_gdoc_slug_successors.gdocSlugSuccessors AS gdocSlugSuccessors
            FROM
                posts
                LEFT JOIN post_gdoc_slug_successors ON post_gdoc_slug_successors.id = posts.id
                LEFT JOIN posts_gdocs gdocSuccessor ON gdocSuccessor.id = posts.gdocSuccessorId
                LEFT JOIN posts_tags_aggregated ON posts_tags_aggregated.post_id = posts.id
            ORDER BY
                updated_at_in_wordpress DESC`,
        []
    )
    const rows = raw_rows.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags),
        isGdocSuccessorPublished: !!row.isGdocSuccessorPublished,
        gdocSlugSuccessors: JSON.parse(row.gdocSlugSuccessors),
        authors: JSON.parse(row.authors),
    }))

    return { posts: rows }
})

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/setTags",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)

        await setTagsForPost(trx, postId, req.body.tagIds)

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/posts/:postId.json",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)
        const post = (await trx
            .table(PostsTableName)
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPost | undefined
        return camelCaseProperties({ ...post })
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/createGdoc",
    async (req: Request, res, trx) => {
        const postId = expectInt(req.params.postId)
        const allowRecreate = !!req.body.allowRecreate
        const post = (await trx
            .table("posts_with_gdoc_publish_status")
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPostWithGdocPublishStatus | undefined

        if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
        const existingGdocId = post.gdocSuccessorId
        if (!allowRecreate && existingGdocId)
            throw new JsonError("A gdoc already exists for this post", 400)
        if (allowRecreate && existingGdocId && post.isGdocPublished) {
            throw new JsonError(
                "A gdoc already exists for this post and it is already published",
                400
            )
        }
        if (post.archieml === null)
            throw new JsonError(
                `ArchieML was not present for post with id ${postId}`,
                500
            )
        const tagsByPostId = await getTagsByPostId(trx)
        const tags = tagsByPostId.get(postId) || []
        const archieMl = JSON.parse(
            // Google Docs interprets &region in grapher URLS as ®ion
            // So we escape them here
            post.archieml.replaceAll("&", "&amp;")
        ) as OwidGdocPostInterface
        const gdocId = await createGdocAndInsertOwidGdocPostContent(
            archieMl.content,
            post.gdocSuccessorId
        )
        // If we did not yet have a gdoc associated with this post, we need to register
        // the gdocSuccessorId and create an entry in the posts_gdocs table. Otherwise
        // we don't need to make changes to the DB (only the gdoc regeneration was required)
        if (!existingGdocId) {
            post.gdocSuccessorId = gdocId
            // This is not ideal - we are using knex for on thing and typeorm for another
            // which means that we can't wrap this in a transaction. We should probably
            // move posts to use typeorm as well or at least have a typeorm alternative for it
            await trx
                .table(PostsTableName)
                .where({ id: postId })
                .update("gdocSuccessorId", gdocId)

            const gdoc = new GdocPost(gdocId)
            gdoc.slug = post.slug
            gdoc.content.title = post.title
            gdoc.content.type = archieMl.content.type || OwidGdocType.Article
            gdoc.published = false
            gdoc.createdAt = new Date()
            gdoc.publishedAt = post.published_at
            await upsertGdoc(trx, gdoc)
            await setTagsForGdoc(trx, gdocId, tags)
        }
        return { googleDocsId: gdocId }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/unlinkGdoc",
    async (req: Request, res, trx) => {
        const postId = expectInt(req.params.postId)
        const post = (await trx
            .table("posts_with_gdoc_publish_status")
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPostWithGdocPublishStatus | undefined

        if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
        const existingGdocId = post.gdocSuccessorId
        if (!existingGdocId)
            throw new JsonError("No gdoc exists for this post", 400)
        if (existingGdocId && post.isGdocPublished) {
            throw new JsonError(
                "The GDoc is already published - you can't unlink it",
                400
            )
        }
        // This is not ideal - we are using knex for on thing and typeorm for another
        // which means that we can't wrap this in a transaction. We should probably
        // move posts to use typeorm as well or at least have a typeorm alternative for it
        await trx
            .table(PostsTableName)
            .where({ id: postId })
            .update("gdocSuccessorId", null)

        await trx
            .table(PostsGdocsTableName)
            .where({ id: existingGdocId })
            .delete()

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/sources/:sourceId.json",
    async (req: Request, res, trx) => {
        const sourceId = expectInt(req.params.sourceId)

        const source = await db.knexRawFirst<Record<string, any>>(
            trx,
            `
        SELECT s.id, s.name, s.description, s.createdAt, s.updatedAt, d.namespace
        FROM sources AS s
        JOIN active_datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`,
            [sourceId]
        )
        if (!source) throw new JsonError(`No source by id '${sourceId}'`, 404)
        source.variables = await db.knexRaw(
            trx,
            `SELECT id, name, updatedAt FROM variables WHERE variables.sourceId=?`,
            [sourceId]
        )

        return { source: source }
    }
)

apiRouter.get("/deploys.json", async () => ({
    deploys: await new DeployQueueServer().getDeploys(),
}))

apiRouter.put("/deploy", async (req, res) => {
    return triggerStaticBuild(res.locals.user, "Manually triggered deploy")
})

getRouteWithROTransaction(apiRouter, "/gdocs", (req, res, trx) => {
    return getAllGdocIndexItemsOrderedByUpdatedAt(trx)
})

getRouteNonIdempotentWithRWTransaction(
    apiRouter,
    "/gdocs/:id",
    async (req, res, trx) => {
        const id = req.params.id
        const contentSource = req.query.contentSource as
            | GdocsContentSource
            | undefined

        try {
            // Beware: if contentSource=gdocs this will update images in the DB+S3 even if the gdoc is published
            const gdoc = await getAndLoadGdocById(trx, id, contentSource)

            if (!gdoc.published) {
                await updateGdocContentOnly(trx, id, gdoc)
            }

            res.set("Cache-Control", "no-store")
            res.send(gdoc)
        } catch (error) {
            console.error("Error fetching gdoc", error)
            res.status(500).json({
                error: { message: String(error), status: 500 },
            })
        }
    }
)

/**
 * Handles all four `GdocPublishingAction` cases
 * - SavingDraft (no action)
 * - Publishing (index and bake)
 * - Updating (index and bake (potentially via lightning deploy))
 * - Unpublishing (remove from index and bake)
 */
async function indexAndBakeGdocIfNeccesary(
    trx: db.KnexReadWriteTransaction,
    user: Required<DbInsertUser>,
    prevGdoc: GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor,
    nextGdoc: GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor
) {
    const prevJson = prevGdoc.toJSON()
    const nextJson = nextGdoc.toJSON()
    const hasChanges = checkHasChanges(prevGdoc, nextGdoc)
    const action = getPublishingAction(prevJson, nextJson)
    const isGdocPost = checkIsGdocPostExcludingFragments(nextJson)

    await match(action)
        .with(GdocPublishingAction.SavingDraft, lodash.noop)
        .with(GdocPublishingAction.Publishing, async () => {
            if (isGdocPost) {
                await indexIndividualGdocPost(
                    nextJson,
                    trx,
                    // If the gdoc is being published for the first time, prevGdoc.slug will be undefined
                    // In that case, we pass nextJson.slug to see if it has any page views (i.e. from WP)
                    prevGdoc.slug || nextJson.slug
                )
            }
            await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
        })
        .with(GdocPublishingAction.Updating, async () => {
            if (isGdocPost) {
                await indexIndividualGdocPost(nextJson, trx, prevGdoc.slug)
            }
            if (checkIsLightningUpdate(prevJson, nextJson, hasChanges)) {
                await enqueueLightningChange(
                    user,
                    `Lightning update ${nextJson.slug}`,
                    nextJson.slug
                )
            } else {
                await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
            }
        })
        .with(GdocPublishingAction.Unpublishing, async () => {
            if (isGdocPost) {
                await removeIndividualGdocPostFromIndex(nextJson)
            }
            await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
        })
        .exhaustive()
}

/**
 * Only supports creating a new empty Gdoc or updating an existing one. Does not
 * support creating a new Gdoc from an existing one. Relevant updates will
 * trigger a deploy.
 */
putRouteWithRWTransaction(apiRouter, "/gdocs/:id", async (req, res, trx) => {
    const { id } = req.params

    if (isEmpty(req.body)) {
        return createOrLoadGdocById(trx, id)
    }

    const prevGdoc = await getAndLoadGdocById(trx, id)
    if (!prevGdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    const nextGdoc = gdocFromJSON(req.body)
    await nextGdoc.loadState(trx)

    await addImagesToContentGraph(trx, nextGdoc)

    await setLinksForGdoc(
        trx,
        nextGdoc.id,
        nextGdoc.links,
        nextGdoc.published
            ? GdocLinkUpdateMode.DeleteAndInsert
            : GdocLinkUpdateMode.DeleteOnly
    )

    await upsertGdoc(trx, nextGdoc)

    await indexAndBakeGdocIfNeccesary(trx, res.locals.user, prevGdoc, nextGdoc)

    return nextGdoc
})

async function validateTombstoneRelatedLinkUrl(
    trx: db.KnexReadonlyTransaction,
    relatedLink?: string
) {
    if (!relatedLink || !relatedLink.startsWith(GDOCS_BASE_URL)) return
    const id = relatedLink.match(gdocUrlRegex)?.[1]
    if (!id) {
        throw new JsonError(`Invalid related link: ${relatedLink}`)
    }
    const [gdoc] = await getMinimalGdocPostsByIds(trx, [id])
    if (!gdoc) {
        throw new JsonError(`Google Doc with ID ${id} not found`)
    }
    if (!gdoc.published) {
        throw new JsonError(`Google Doc with ID ${id} is not published`)
    }
}

deleteRouteWithRWTransaction(apiRouter, "/gdocs/:id", async (req, res, trx) => {
    const { id } = req.params

    const gdoc = await getGdocBaseObjectById(trx, id, false)
    if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    const gdocSlug = getCanonicalUrl("", gdoc)
    const { tombstone } = req.body

    if (tombstone) {
        await validateTombstoneRelatedLinkUrl(trx, tombstone.relatedLinkUrl)
        const slug = gdocSlug.replace("/", "")
        const { relatedLinkThumbnail } = tombstone
        if (relatedLinkThumbnail) {
            await fetchImagesFromDriveAndSyncToS3(trx, [relatedLinkThumbnail])
        }
        await trx
            .table("posts_gdocs_tombstones")
            .insert({ ...tombstone, gdocId: id, slug })
        await trx
            .table("redirects")
            .insert({ source: gdocSlug, target: `/deleted${gdocSlug}` })
    }

    await trx
        .table("posts")
        .where({ gdocSuccessorId: gdoc.id })
        .update({ gdocSuccessorId: null })

    await trx.table(PostsGdocsLinksTableName).where({ sourceId: id }).delete()
    await trx.table(PostsGdocsXImagesTableName).where({ gdocId: id }).delete()
    await trx.table(PostsGdocsTableName).where({ id }).delete()
    if (gdoc.published && checkIsGdocPostExcludingFragments(gdoc)) {
        await removeIndividualGdocPostFromIndex(gdoc)
    }
    if (gdoc.published) {
        if (!tombstone && gdocSlug && gdocSlug !== "/") {
            // Assets have TTL of one week in Cloudflare. Add a redirect to make sure
            // the page is no longer accessible.
            // https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention
            console.log(`Creating redirect for "${gdocSlug}" to "/"`)
            await db.knexRawInsert(
                trx,
                `INSERT INTO redirects (source, target, ttl)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 DAY))`,
                [gdocSlug, "/"]
            )
        }
        await triggerStaticBuild(res.locals.user, `Deleting ${gdocSlug}`)
    }
    return {}
})

postRouteWithRWTransaction(
    apiRouter,
    "/gdocs/:gdocId/setTags",
    async (req, res, trx) => {
        const { gdocId } = req.params
        const { tagIds } = req.body
        const tagIdsAsObjects: { id: number }[] = tagIds.map((id: number) => ({
            id: id,
        }))

        await setTagsForGdoc(trx, gdocId, tagIdsAsObjects)

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-topics/${TaggableType.Charts}/:chartId.json`,
    async (
        req: Request,
        res,
        trx
    ): Promise<Record<"topics", DbChartTagJoin[]>> => {
        const chartId = parseIntOrUndefined(req.params.chartId)
        if (!chartId) throw new JsonError(`Invalid chart ID`, 400)

        const topics = await getGptTopicSuggestions(trx, chartId)

        if (!topics.length)
            throw new JsonError(
                `No GPT topic suggestions found for chart ${chartId}`,
                404
            )

        return {
            topics,
        }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req, res, trx) => {
        const { slug } = req.params
        const { tagIds } = req.body
        const explorer = await trx.table("explorers").where({ slug }).first()
        if (!explorer)
            throw new JsonError(`No explorer found for slug ${slug}`, 404)

        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        for (const tagId of tagIds) {
            await trx
                .table("explorer_tags")
                .insert({ explorerSlug: slug, tagId })
        }

        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req: Request, res, trx) => {
        const { slug } = req.params
        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        return { success: true }
    }
)

// Get an ArchieML output of all the work produced by an author. This includes
// gdoc articles, gdoc modular/linear topic pages and wordpress modular topic
// pages. Data insights are excluded. This is used to manually populate the
// [.secondary] section of the {.research-and-writing} block of author pages
// using the alternate template, which highlights topics rather than articles.
getRouteWithROTransaction(apiRouter, "/all-work", async (req, res, trx) => {
    type WordpressPageRecord = {
        isWordpressPage: number
    } & Record<
        "slug" | "title" | "subtitle" | "thumbnail" | "authors" | "publishedAt",
        string
    >
    type GdocRecord = Pick<DbRawPostGdoc, "id" | "publishedAt">

    const author = req.query.author || "Max Roser"
    const gdocs = await db.knexRaw<GdocRecord>(
        trx,
        `-- sql
            SELECT id, publishedAt
            FROM posts_gdocs
            WHERE JSON_CONTAINS(content->'$.authors', '"${author}"')
            AND type NOT IN ("data-insight", "fragment")
            AND published = 1
    `
    )

    // type: page
    const wpModularTopicPages = await db.knexRaw<WordpressPageRecord>(
        trx,
        `-- sql
        SELECT
            wpApiSnapshot->>"$.slug" as slug,
            wpApiSnapshot->>"$.title.rendered" as title,
            wpApiSnapshot->>"$.excerpt.rendered" as subtitle,
            TRUE as isWordpressPage,
            wpApiSnapshot->>"$.authors_name" as authors,
            wpApiSnapshot->>"$.featured_media_paths.medium_large" as thumbnail,
            wpApiSnapshot->>"$.date" as publishedAt
        FROM posts p
        WHERE wpApiSnapshot->>"$.content" LIKE '%topic-page%'
        AND JSON_CONTAINS(wpApiSnapshot->'$.authors_name', '"${author}"')
        AND wpApiSnapshot->>"$.status" = 'publish'
        AND NOT EXISTS (
            SELECT 1 FROM posts_gdocs pg
            WHERE pg.slug = p.slug
            AND pg.content->>'$.type' LIKE '%topic-page'
        )
        `
    )

    const isWordpressPage = (
        post: WordpressPageRecord | GdocRecord
    ): post is WordpressPageRecord =>
        (post as WordpressPageRecord).isWordpressPage === 1

    function* generateProperty(key: string, value: string) {
        yield `${key}: ${value}\n`
    }

    const sortByDateDesc = (
        a: GdocRecord | WordpressPageRecord,
        b: GdocRecord | WordpressPageRecord
    ): number => {
        if (!a.publishedAt || !b.publishedAt) return 0
        return (
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        )
    }

    function* generateAllWorkArchieMl() {
        for (const post of [...gdocs, ...wpModularTopicPages].sort(
            sortByDateDesc
        )) {
            if (isWordpressPage(post)) {
                yield* generateProperty(
                    "url",
                    `https://ourworldindata.org/${post.slug}`
                )
                yield* generateProperty("title", post.title)
                yield* generateProperty("subtitle", post.subtitle)
                yield* generateProperty(
                    "authors",
                    JSON.parse(post.authors).join(", ")
                )
                const parsedPath = path.parse(post.thumbnail)
                yield* generateProperty(
                    "filename",
                    // /app/uploads/2021/09/reducing-fertilizer-768x301.png -> reducing-fertilizer.png
                    path.format({
                        name: parsedPath.name.replace(/-\d+x\d+$/, ""),
                        ext: parsedPath.ext,
                    })
                )
                yield "\n"
            } else {
                // this is a gdoc
                yield* generateProperty(
                    "url",
                    `https://docs.google.com/document/d/${post.id}/edit`
                )
                yield "\n"
            }
        }
    }

    res.type("text/plain")
    return [...generateAllWorkArchieMl()].join("")
})

getRouteWithROTransaction(
    apiRouter,
    "/flatTagGraph.json",
    async (req, res, trx) => {
        const flatTagGraph = await db.getFlatTagGraph(trx)
        return flatTagGraph
    }
)

postRouteWithRWTransaction(apiRouter, "/tagGraph", async (req, res, trx) => {
    const tagGraph = req.body?.tagGraph as unknown
    if (!tagGraph) {
        throw new JsonError("No tagGraph provided", 400)
    }

    function validateFlatTagGraph(
        tagGraph: Record<any, any>
    ): tagGraph is FlatTagGraph {
        if (lodash.isObject(tagGraph)) {
            for (const [key, value] of Object.entries(tagGraph)) {
                if (!lodash.isString(key) && isNaN(Number(key))) {
                    return false
                }
                if (!lodash.isArray(value)) {
                    return false
                }
                for (const tag of value) {
                    if (
                        !(
                            checkIsPlainObjectWithGuard(tag) &&
                            lodash.isNumber(tag.weight) &&
                            lodash.isNumber(tag.parentId) &&
                            lodash.isNumber(tag.childId)
                        )
                    ) {
                        return false
                    }
                }
            }
        }

        return true
    }
    const isValid = validateFlatTagGraph(tagGraph)
    if (!isValid) {
        throw new JsonError("Invalid tag graph provided", 400)
    }
    await db.updateTagGraph(trx, tagGraph)
    res.send({ success: true })
})

export { apiRouter }
