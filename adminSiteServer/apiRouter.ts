/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import * as lodash from "lodash"
import * as db from "../db/db.js"
import { DEPRECATEDgetTopics } from "../db/DEPRECATEDwpdb.js"
import {
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    BAKED_BASE_URL,
    ADMIN_BASE_URL,
    DATA_API_URL,
} from "../settings/serverSettings.js"
import { expectInt, isValidSlug } from "../serverUtils/serverUtil.js"
import {
    OldChartFieldList,
    assignTagsForCharts,
    getChartConfigById,
    getChartSlugById,
    getGptTopicSuggestions,
    getRedirectsByChartId,
    oldChartFieldList,
    setChartTags,
} from "../db/model/Chart.js"
import { Request } from "./authentication.js"
import {
    getMergedGrapherConfigForVariable,
    fetchS3MetadataByPath,
    fetchS3DataValuesByPath,
    searchVariables,
} from "../db/model/Variable.js"
import {
    applyPatch,
    BulkChartEditResponseRow,
    BulkGrapherConfigResponse,
    camelCaseProperties,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    GdocsContentSource,
    GrapherConfigPatch,
    isEmpty,
    JsonError,
    OperationContext,
    OwidGdocPostInterface,
    parseIntOrUndefined,
    parseToOperation,
    DbRawPostWithGdocPublishStatus,
    SuggestedChartRevisionStatus,
    variableAnnotationAllowedColumnNamesAndTypes,
    VariableAnnotationsResponseRow,
    OwidVariableWithSource,
    OwidChartDimensionInterface,
    DimensionProperty,
    TaggableType,
    DbChartTagJoin,
    pick,
    Json,
    checkIsGdocPostExcludingFragments,
} from "@ourworldindata/utils"
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
    DbRawChart,
    DbInsertChartRevision,
    serializeChartConfig,
    DbRawOrigin,
    DbRawPostGdoc,
    PostsGdocsXImagesTableName,
    PostsGdocsLinksTableName,
    PostsGdocsTableName,
    DbPlainDataset,
    DbInsertUser,
} from "@ourworldindata/types"
import {
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
import {
    getQueryEnrichedSuggestedChartRevision,
    getQueryEnrichedSuggestedChartRevisions,
    isValidStatus,
} from "../db/model/SuggestedChartRevision.js"
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

const saveGrapher = async (
    knex: db.KnexReadWriteTransaction,
    user: DbPlainUser,
    newConfig: GrapherInterface,
    existingConfig?: GrapherInterface,
    referencedVariablesMightChange = true // if the variables a chart uses can change then we need
    // to update the latest country data which takes quite a long time (hundreds of ms)
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
        const rows = await db.knexRaw<Pick<DbRawChart, "id">>(
            knex,
            `SELECT id FROM charts WHERE id != ? AND config->>"$.isPublished" = "true" AND JSON_EXTRACT(config, "$.slug") = ?`,
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

    // Execute the actual database update or creation
    const now = new Date()
    let chartId = existingConfig && existingConfig.id
    const newJsonConfig = JSON.stringify(newConfig)
    if (existingConfig)
        await db.knexRaw(
            knex,
            `UPDATE charts SET config=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=? WHERE id = ?`,
            [newJsonConfig, now, now, user.id, chartId]
        )
    else {
        const result = await db.knexRawInsert(
            knex,
            `INSERT INTO charts (config, createdAt, updatedAt, lastEditedAt, lastEditedByUserId) VALUES (?, ?, ?, ?, ?)`,
            [newJsonConfig, now, now, now, user.id]
        )
        chartId = result.insertId
        // The chart config itself has an id field that should store the id of the chart - update the chart now so this is true
        newConfig.id = chartId
        await db.knexRaw(knex, `UPDATE charts SET config=? WHERE id = ?`, [
            JSON.stringify(newConfig),
            chartId,
        ])
    }

    // Record this change in version history

    const chartRevisionLog = {
        chartId: chartId as number,
        userId: user.id,
        config: serializeChartConfig(newConfig),
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

    const newDimensions = newConfig.dimensions ?? []
    for (const [i, dim] of newDimensions.entries()) {
        await db.knexRaw(
            knex,
            `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?, ?, ?, ?)`,
            [chartId, dim.variableId, dim.property, i]
        )
    }

    // So we can generate country profiles including this chart data
    if (newConfig.isPublished && referencedVariablesMightChange)
        // TODO: remove this ad hoc knex transaction context when we switch the function to knex
        await denormalizeLatestCountryData(
            knex,
            newDimensions.map((d) => d.variableId)
        )

    if (
        newConfig.isPublished &&
        (!existingConfig || !existingConfig.isPublished)
    ) {
        // Newly published, set publication info
        await db.knexRaw(
            knex,
            `UPDATE charts SET publishedAt=?, publishedByUserId=? WHERE id = ? `,
            [now, user.id, chartId]
        )
        await triggerStaticBuild(user, `Publishing chart ${newConfig.slug}`)
    } else if (
        !newConfig.isPublished &&
        existingConfig &&
        existingConfig.isPublished
    ) {
        // Unpublishing chart, delete any existing redirects to it
        await db.knexRaw(
            knex,
            `DELETE FROM chart_slug_redirects WHERE chart_id = ?`,
            [existingConfig.id]
        )
        await triggerStaticBuild(user, `Unpublishing chart ${newConfig.slug}`)
    } else if (newConfig.isPublished)
        await triggerStaticBuild(user, `Updating chart ${newConfig.slug}`)

    return chartId
}

getRouteWithROTransaction(apiRouter, "/charts.json", async (req, res, trx) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
        SELECT ${oldChartFieldList} FROM charts
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
            charts.config->>"$.version" AS version,
            CONCAT("${BAKED_BASE_URL}/grapher/", charts.config->>"$.slug") AS url,
            CONCAT("${ADMIN_BASE_URL}", "/admin/charts/", charts.id, "/edit") AS editUrl,
            charts.config->>"$.slug" AS slug,
            charts.config->>"$.title" AS title,
            charts.config->>"$.subtitle" AS subtitle,
            charts.config->>"$.sourceDesc" AS sourceDesc,
            charts.config->>"$.note" AS note,
            charts.config->>"$.type" AS type,
            charts.config->>"$.internalNotes" AS internalNotes,
            charts.config->>"$.variantName" AS variantName,
            charts.config->>"$.isPublished" AS isPublished,
            charts.config->>"$.tab" AS tab,
            JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
            JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
            charts.config->>"$.originUrl" AS originUrl,
            charts.lastEditedAt,
            charts.lastEditedByUserId,
            lastEditedByUser.fullName AS lastEditedBy,
            charts.publishedAt,
            charts.publishedByUserId,
            publishedByUser.fullName AS publishedBy
        FROM charts
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

apiRouter.get("/topics.json", async (req, res) => ({
    topics: await DEPRECATEDgetTopics(),
}))
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
    const chartId = await saveGrapher(trx, res.locals.user, req.body)

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
        const existingConfig = await expectChartById(trx, req.params.chartId)

        await saveGrapher(trx, res.locals.user, req.body, existingConfig)

        const logs = await getLogsByChartId(trx, existingConfig.id as number)
        return { success: true, chartId: existingConfig.id, newLog: logs[0] }
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
        await db.knexRaw(
            trx,
            `DELETE FROM suggested_chart_revisions WHERE chartId=?`,
            [chart.id]
        )
        await db.knexRaw(trx, `DELETE FROM charts WHERE id=?`, [chart.id])

        if (chart.isPublished)
            await triggerStaticBuild(
                res.locals.user,
                `Deleting chart ${chart.slug}`
            )

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/suggested-chart-revisions",
    async (req, res, trx) => {
        const isValidSortBy = (sortBy: string) => {
            return [
                "updatedAt",
                "createdAt",
                "suggestedReason",
                "id",
                "chartId",
                "status",
                "variableId",
                "chartUpdatedAt",
                "chartCreatedAt",
            ].includes(sortBy)
        }
        const isValidSortOrder = (sortOrder: string) => {
            return (
                sortOrder !== undefined &&
                sortOrder !== null &&
                ["ASC", "DESC"].includes(sortOrder.toUpperCase())
            )
        }
        const limit =
            req.query.limit !== undefined ? expectInt(req.query.limit) : 10000
        const offset =
            req.query.offset !== undefined ? expectInt(req.query.offset) : 0
        const sortBy = isValidSortBy(req.query.sortBy as string)
            ? req.query.sortBy
            : "updatedAt"
        const sortOrder = isValidSortOrder(req.query.sortOrder as string)
            ? (req.query.sortOrder as string).toUpperCase()
            : "DESC"
        const status: string | null = isValidStatus(
            req.query.status as SuggestedChartRevisionStatus
        )
            ? (req.query.status as string)
            : null

        let orderBy
        if (sortBy === "variableId") {
            orderBy =
                "CAST(scr.suggestedConfig->>'$.dimensions[0].variableId' as SIGNED)"
        } else if (sortBy === "chartUpdatedAt") {
            orderBy = "c.updatedAt"
        } else if (sortBy === "chartCreatedAt") {
            orderBy = "c.createdAt"
        } else {
            orderBy = `scr.${sortBy}`
        }

        const numTotalRows = (
            await db.knexRaw<{ count: number }>(
                trx,
                `
                SELECT COUNT(*) as count
                FROM suggested_chart_revisions
                ${status ? "WHERE status = ?" : ""}
            `,
                status ? [status] : []
            )
        )[0].count

        const enrichedSuggestedChartRevisions =
            await getQueryEnrichedSuggestedChartRevisions(
                trx,
                orderBy,
                sortOrder,
                status,
                limit,
                offset
            )

        return {
            suggestedChartRevisions: enrichedSuggestedChartRevisions,
            numTotalRows: numTotalRows,
        }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/suggested-chart-revisions/:suggestedChartRevisionId",
    async (req, res, trx) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )

        const suggestedChartRevision = getQueryEnrichedSuggestedChartRevision(
            trx,
            suggestedChartRevisionId
        )

        if (!suggestedChartRevision) {
            throw new JsonError(
                `No suggested chart revision by id '${suggestedChartRevisionId}'`,
                404
            )
        }

        return {
            suggestedChartRevision: suggestedChartRevision,
        }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/suggested-chart-revisions/:suggestedChartRevisionId/update",
    async (req, res, trx) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )

        // Note: there was a suggestedConfig here that was not used - might have been a
        // mistake in a refactoring that wasn't found before?
        const { status, decisionReason } = req.body as {
            status: string
            decisionReason: string
        }

        const suggestedChartRevision =
            await getQueryEnrichedSuggestedChartRevision(
                trx,
                suggestedChartRevisionId
            )

        if (!suggestedChartRevision) {
            throw new JsonError(
                `No suggested chart revision found for id '${suggestedChartRevisionId}'`,
                404
            )
        }

        const canUpdate =
            (status === "approved" && suggestedChartRevision.canApprove) ||
            (status === "rejected" && suggestedChartRevision.canReject) ||
            (status === "pending" && suggestedChartRevision.canPending) ||
            (status === "flagged" && suggestedChartRevision.canFlag)
        if (!canUpdate) {
            throw new JsonError(
                `Suggest chart revision ${suggestedChartRevisionId} cannot be ` +
                    `updated with status="${status}".`,
                404
            )
        }

        await db.knexRaw(
            trx,
            `
                UPDATE suggested_chart_revisions
                SET status=?, decisionReason=?, updatedAt=?, updatedBy=?
                WHERE id = ?
                `,
            [
                status,
                decisionReason,
                new Date(),
                res.locals.user.id,
                suggestedChartRevisionId,
            ]
        )

        // Update config ONLY when APPROVE button is clicked
        // Makes sense when the suggested config is a sugegstion by GPT, otherwise is redundant but we are cool with it
        if (status === SuggestedChartRevisionStatus.approved) {
            await db.knexRaw(
                trx,
                `
                    UPDATE suggested_chart_revisions
                    SET suggestedConfig=?
                    WHERE id = ?
                    `,
                [
                    JSON.stringify(suggestedChartRevision.suggestedConfig),
                    suggestedChartRevisionId,
                ]
            )
        }
        // note: the calls to saveGrapher() below will never overwrite a config
        // that has been changed since the suggestedConfig was created, because
        // if the config has been changed since the suggestedConfig was created
        // then canUpdate will be false (so an error would have been raised
        // above).

        if (status === "approved" && suggestedChartRevision.canApprove) {
            await saveGrapher(
                trx,
                res.locals.user,
                suggestedChartRevision.suggestedConfig,
                suggestedChartRevision.existingConfig
            )
        } else if (
            status === "rejected" &&
            suggestedChartRevision.canReject &&
            suggestedChartRevision.status === "approved"
        ) {
            await saveGrapher(
                trx,
                res.locals.user,
                suggestedChartRevision.originalConfig,
                suggestedChartRevision.existingConfig
            )
        }

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
            grapherConfigFieldName: "config",
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
            `SELECT charts.id as id,
            charts.config as config,
            charts.createdAt as createdAt,
            charts.updatedAt as updatedAt,
            charts.lastEditedAt as lastEditedAt,
            charts.publishedAt as publishedAt,
            lastEditedByUser.fullName as lastEditedByUser,
            publishedByUser.fullName as publishedByUser
FROM charts
LEFT JOIN users lastEditedByUser ON lastEditedByUser.id=charts.lastEditedByUserId
LEFT JOIN users publishedByUser ON publishedByUser.id=charts.publishedByUserId
WHERE ${whereClause}
ORDER BY charts.id DESC
LIMIT 50
OFFSET ${offset.toString()}`
        )

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.knexRaw<{ count: number }>(
            trx,
            `SELECT count(*) as count
FROM charts
WHERE ${whereClause}`
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
            Pick<DbRawChart, "id" | "config">
        >(trx, `SELECT id, config FROM charts where id IN (?)`, [
            [...chartIds.values()],
        ])
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
            await saveGrapher(
                trx,
                res.locals.user,
                newConfig,
                oldValuesConfigMap.get(id),
                false
            )
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
            `SELECT variables.id as id,
            variables.name as name,
            variables.grapherConfigAdmin as config,
            d.name as datasetname,
            namespaces.name as namespacename,
            variables.createdAt as createdAt,
            variables.updatedAt as updatedAt,
            variables.description as description
FROM variables
LEFT JOIN active_datasets as d on variables.datasetId = d.id
LEFT JOIN namespaces on d.namespace = namespaces.name
WHERE ${whereClause}
ORDER BY variables.id DESC
LIMIT 50
OFFSET ${offset.toString()}`
        )

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.knexRaw<{ count: number }>(
            trx,
            `SELECT count(*) as count
FROM variables
LEFT JOIN active_datasets as d on variables.datasetId = d.id
LEFT JOIN namespaces on d.namespace = namespaces.name
WHERE ${whereClause}`
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
            Pick<DbRawVariable, "id" | "grapherConfigAdmin">
        >(trx, `SELECT id, grapherConfigAdmin FROM variables where id IN (?)`, [
            [...variableIds.values()],
        ])
        const configMap = new Map(
            configsAndIds.map((item: any) => [
                item.id,
                item.grapherConfigAdmin ? JSON.parse(item.grapherConfig) : {},
            ])
        )
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [variableId, newConfig] of configMap.entries()) {
            await db.knexRaw(
                trx,
                `UPDATE variables SET grapherConfigAdmin = ? where id = ?`,
                [JSON.stringify(newConfig), variableId]
            )
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

        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `-- sql
            SELECT ${oldChartFieldList}
            FROM charts
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            JOIN chart_dimensions cd ON cd.chartId = charts.id
            WHERE cd.variableId = ?
            GROUP BY charts.id
            `,
            [variableId]
        )

        await assignTagsForCharts(trx, charts)

        const grapherConfig = await getMergedGrapherConfigForVariable(
            variableId,
            trx
        )
        if (
            grapherConfig &&
            (!grapherConfig.dimensions || grapherConfig.dimensions.length === 0)
        ) {
            const dimensions: OwidChartDimensionInterface[] = [
                {
                    variableId: variableId,
                    property: DimensionProperty.y,
                    display: variable.display,
                },
            ]
            grapherConfig.dimensions = dimensions
        }

        const variablesWithCharts: OwidVariableWithSource & {
            charts: Record<string, any>
            grapherConfig: GrapherInterface | undefined
        } = {
            ...variable,
            charts,
            grapherConfig,
        }

        return {
            variable: variablesWithCharts,
        } /*, vardata: await getVariableData([variableId]) }*/
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
        WHERE p.isBulkImport IS FALSE
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
            await db.knexRaw(
                trx,
                `INSERT INTO dataset_tags (tagId, datasetId) VALUES (?, ?)`,
                tagRows
            )

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
                `
            UPDATE charts
            SET config = JSON_SET(config, "$.version", config->"$.version" + 1)
            WHERE id IN (
                SELECT DISTINCT chart_dimensions.chartId
                FROM chart_dimensions
                JOIN variables ON variables.id = chart_dimensions.variableId
                WHERE variables.datasetId = ?
            )
            `,
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
        SELECT r.id, r.slug, r.chart_id as chartId, JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS chartSlug
        FROM chart_slug_redirects AS r JOIN charts ON charts.id = r.chart_id
        ORDER BY r.id DESC`
        ),
    })
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
                | "isBulkImport"
            >
        >(
            trx,
            `-- sql
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, t.slug, p.isBulkImport
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
        WHERE t.parentId IS NULL AND t.isBulkImport IS FALSE
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
            `UPDATE tags SET name=?, updatedAt=?, parentId=?, slug=? WHERE id=?`,
            [tag.name, new Date(), tag.parentId, tag.slug, tagId]
        )
        if (tag.slug) {
            // See if there's a published gdoc with a matching slug.
            // We're not enforcing that the gdoc be a topic page, as there are cases like /human-development-index,
            // where the page for the topic is just an article.
            const gdoc = await db.knexRaw<Pick<DbRawPostGdoc, "slug">>(
                trx,
                `SELECT slug FROM posts_gdocs pg
             WHERE EXISTS (
                    SELECT 1
                    FROM posts_gdocs_x_tags gt
                    WHERE pg.id = gt.gdocId AND gt.tagId = ?
            ) AND pg.published = TRUE`,
                [tag.id]
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
        const tag = (req.body as { tag: any }).tag
        const now = new Date()
        const result = await db.knexRawInsert(
            trx,
            `INSERT INTO tags (parentId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
            [tag.parentId, tag.name, now, now]
        )
        return { success: true, tagId: result.insertId }
    }
)

getRouteWithROTransaction(apiRouter, "/tags.json", async (req, res, trx) => {
    const tags = await db.knexRaw(
        trx,
        `-- sql
        SELECT t.id, t.name, t.parentId, t.specialType
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.isBulkImport IS FALSE AND (t.parentId IS NULL OR p.isBulkImport IS FALSE)
        ORDER BY t.name ASC
    `
    )

    return {
        tags,
    }
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

deleteRouteWithRWTransaction(apiRouter, "/gdocs/:id", async (req, res, trx) => {
    const { id } = req.params

    const gdoc = await getGdocBaseObjectById(trx, id, false)
    if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

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
    await triggerStaticBuild(res.locals.user, `Deleting ${gdoc.slug}`)
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

export { apiRouter }
