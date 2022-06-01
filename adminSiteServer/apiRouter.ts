/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import * as lodash from "lodash"
import { getConnection } from "typeorm"
import express from "express"
import * as db from "../db/db.js"
import * as wpdb from "../db/wpdb.js"
import {
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    BAKED_BASE_URL,
    ADMIN_BASE_URL,
} from "../settings/serverSettings.js"
import {
    expectInt,
    isValidSlug,
    absoluteUrl,
} from "../serverUtils/serverUtil.js"
import { sendMail } from "./mail.js"
import { OldChart, Chart, getGrapherById } from "../db/model/Chart.js"
import { UserInvitation } from "../db/model/UserInvitation.js"
import { Request, Response, CurrentUser } from "./authentication.js"
import { getVariableData } from "../db/model/Variable.js"
import { applyPatch } from "../clientUtils/patchHelper.js"
import {
    GrapherInterface,
    grapherKeysToSerialize,
} from "../grapher/core/GrapherInterface.js"
import { SuggestedChartRevisionStatus } from "../clientUtils/owidTypes.js"
import {
    GrapherConfigPatch,
    BulkGrapherConfigResponse,
    VariableAnnotationsResponseRow,
    BulkChartEditResponseRow,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    variableAnnotationAllowedColumnNamesAndTypes,
} from "../clientUtils/AdminSessionTypes.js"
import {
    CountryNameFormat,
    CountryDefByKey,
} from "../adminSiteClient/CountryNameFormat.js"
import { Dataset } from "../db/model/Dataset.js"
import { User } from "../db/model/User.js"
import {
    syncDatasetToGitRepo,
    removeDatasetFromGitRepo,
} from "./gitDataExport.js"
import { ChartRevision } from "../db/model/ChartRevision.js"
import { SuggestedChartRevision } from "../db/model/SuggestedChartRevision.js"
import { Post } from "../db/model/Post.js"
import { camelCaseProperties } from "../clientUtils/string.js"
import { logErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { denormalizeLatestCountryData } from "../baker/countryProfiles.js"
import { PostReference, ChartRedirect } from "../adminSiteClient/ChartEditor.js"
import { DeployQueueServer } from "../baker/DeployQueueServer.js"
import { FunctionalRouter } from "./FunctionalRouter.js"
import { JsonError, PostRow } from "../clientUtils/owidTypes.js"
import { escape } from "mysql"
import Papa from "papaparse"

import {
    OperationContext,
    parseToOperation,
} from "../clientUtils/SqlFilterSExpression.js"
import { parseIntOrUndefined } from "../clientUtils/Util.js"

const apiRouter = new FunctionalRouter()

// Call this to trigger build and deployment of static charts on change
const triggerStaticBuild = async (user: CurrentUser, commitMessage: string) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
    })
}

async function getLogsByChartId(chartId: number): Promise<ChartRevision[]> {
    const logs = await db.queryMysql(
        `SELECT userId, config, fullName as userName, l.createdAt
        FROM chart_revisions l
        LEFT JOIN users u on u.id = userId
        WHERE chartId = ?
        ORDER BY l.id DESC
        LIMIT 50`,
        [chartId]
    )
    return logs
}

const getReferencesByChartId = async (
    chartId: number
): Promise<PostReference[]> => {
    if (!wpdb.isWordpressDBEnabled) return []

    const rows = await db.queryMysql(
        `
        SELECT config->"$.slug" AS slug
        FROM charts
        WHERE id = ?
        UNION
        SELECT slug AS slug
        FROM chart_slug_redirects
        WHERE chart_id = ?
    `,
        [chartId, chartId]
    )

    const slugs = rows.map(
        (row: { slug?: string }) => row.slug && row.slug.replace(/^"|"$/g, "")
    )

    if (!slugs || slugs.length === 0) return []

    let posts = []
    // Hacky approach to find all the references to a chart by searching for
    // the chart URL through the Wordpress database.
    // The Grapher should work without the Wordpress database, so we need to
    // handle failures gracefully.
    // NOTE: Sometimes slugs can be substrings of other slugs, e.g.
    // `grapher/gdp` is a substring of `grapher/gdp-maddison`. We need to be
    // careful not to erroneously match those, which is why we switched to a
    // REGEXP.
    try {
        posts = await wpdb.singleton.query(
            `
                SELECT ID, post_title, post_name
                FROM wp_posts
                WHERE
                    (post_type='page' OR post_type='post' OR post_type='wp_block')
                    AND post_status='publish'
                    AND (
                        ${slugs
                            .map(
                                () =>
                                    `post_content REGEXP CONCAT('grapher/', ?, '[^a-zA-Z_\-]')`
                            )
                            .join(" OR ")}
                    )
            `,
            slugs.map(lodash.escapeRegExp)
        )
    } catch (error) {
        console.warn(`Error in getReferencesByChartId`)
        console.error(error)
        // We can ignore errors due to not being able to connect.
    }
    const permalinks = await wpdb.getPermalinks()
    return posts.map((post) => {
        const slug = permalinks.get(post.ID, post.post_name)
        return {
            id: post.ID,
            title: post.post_title,
            slug: slug,
            url: `${BAKED_BASE_URL}/${slug}`,
        }
    })
}

const getRedirectsByChartId = async (
    chartId: number
): Promise<ChartRedirect[]> =>
    await db.queryMysql(
        `
        SELECT id, slug, chart_id as chartId
        FROM chart_slug_redirects
        WHERE chart_id = ?
        ORDER BY id ASC`,
        [chartId]
    )

const expectChartById = async (chartId: any): Promise<GrapherInterface> => {
    const chart = await getGrapherById(expectInt(chartId))
    if (chart) return chart

    throw new JsonError(`No chart found for id ${chartId}`, 404)
}

const saveGrapher = async (
    transactionContext: db.TransactionContext,
    user: CurrentUser,
    newConfig: GrapherInterface,
    existingConfig?: GrapherInterface
) => {
    // Slugs need some special logic to ensure public urls remain consistent whenever possible
    async function isSlugUsedInRedirect() {
        const rows = await transactionContext.query(
            `SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`,
            // -1 is a placeholder ID that will never exist; but we cannot use NULL because
            // in that case we would always get back an empty resultset
            [existingConfig ? existingConfig.id : -1, newConfig.slug]
        )
        return rows.length > 0
    }

    async function isSlugUsedInOtherGrapher() {
        const rows = await transactionContext.query(
            `SELECT * FROM charts WHERE id != ? AND config->>"$.isPublished" = "true" AND JSON_EXTRACT(config, "$.slug") = ?`,
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
            await transactionContext.execute(
                `DELETE FROM chart_slug_redirects WHERE chart_id = ? AND slug = ?`,
                [existingConfig.id, existingConfig.slug]
            )
            await transactionContext.execute(
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
    // todo: drop "isExplorable"
    if (existingConfig)
        await transactionContext.query(
            `UPDATE charts SET config=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=?, isExplorable=? WHERE id = ?`,
            [newJsonConfig, now, now, user.id, false, chartId]
        )
    else {
        const result = await transactionContext.execute(
            `INSERT INTO charts (config, createdAt, updatedAt, lastEditedAt, lastEditedByUserId, isExplorable) VALUES (?)`,
            [[newJsonConfig, now, now, now, user.id, false]]
        )
        chartId = result.insertId
    }

    // Record this change in version history
    const log = new ChartRevision()
    log.chartId = chartId as number
    log.userId = user.id
    log.config = newConfig
    // TODO: the orm needs to support this but it does not :(
    log.createdAt = new Date()
    log.updatedAt = new Date()
    await transactionContext.manager.save(log)

    // Remove any old dimensions and store the new ones
    // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json
    await transactionContext.execute(
        `DELETE FROM chart_dimensions WHERE chartId=?`,
        [chartId]
    )
    for (let i = 0; i < newConfig.dimensions!.length; i++) {
        const dim = newConfig.dimensions![i]
        await transactionContext.execute(
            `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?)`,
            [[chartId, dim.variableId, dim.property, i]]
        )
    }

    // So we can generate country profiles including this chart data
    if (newConfig.isPublished)
        await denormalizeLatestCountryData(
            newConfig.dimensions!.map((d) => d.variableId)
        )

    if (
        newConfig.isPublished &&
        (!existingConfig || !existingConfig.isPublished)
    ) {
        // Newly published, set publication info
        await transactionContext.execute(
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
        await transactionContext.execute(
            `DELETE FROM chart_slug_redirects WHERE chart_id = ?`,
            [existingConfig.id]
        )
        await triggerStaticBuild(user, `Unpublishing chart ${newConfig.slug}`)
    } else if (newConfig.isPublished)
        await triggerStaticBuild(user, `Updating chart ${newConfig.slug}`)

    return chartId
}

apiRouter.get("/charts.json", async (req: Request, res: Response) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.queryMysql(
        `
        SELECT ${OldChart.listFields} FROM charts
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        ORDER BY charts.lastEditedAt DESC LIMIT ?
    `,
        [limit]
    )

    await Chart.assignTagsForCharts(charts)

    return { charts }
})

apiRouter.get("/charts.csv", async (req: Request, res: Response) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000

    // note: this query is extended from OldChart.listFields.
    const charts = await db.queryMysql(
        `
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
            publishedByUser.fullName AS publishedBy,
            charts.isExplorable AS isExplorable
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

apiRouter.get(
    "/charts/:chartId.config.json",
    async (req: Request, res: Response) => expectChartById(req.params.chartId)
)

apiRouter.get(
    "/editorData/namespaces.json",
    async (req: Request, res: Response) => {
        const rows = (await db.queryMysql(
            `SELECT DISTINCT
                namespace AS name,
                namespaces.description AS description,
                namespaces.isArchived AS isArchived
            FROM datasets
            JOIN namespaces ON namespaces.name = datasets.namespace`
        )) as { name: string; description?: string; isArchived: boolean }[]

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

apiRouter.get(
    "/charts/:chartId.logs.json",
    async (req: Request, res: Response) => ({
        logs: await getLogsByChartId(parseInt(req.params.chartId as string)),
    })
)

apiRouter.get(
    "/charts/:chartId.references.json",
    async (req: Request, res: Response) => ({
        references: await getReferencesByChartId(
            parseInt(req.params.chartId as string)
        ),
    })
)

apiRouter.get(
    "/charts/:chartId.redirects.json",
    async (req: Request, res: Response) => ({
        redirects: await getRedirectsByChartId(
            parseInt(req.params.chartId as string)
        ),
    })
)

apiRouter.get("/topics.json", async (req: Request, res: Response) => ({
    topics: await wpdb.getTopics(),
}))

apiRouter.get("/countries.json", async (req: Request, res: Response) => {
    let rows = []

    const input = req.query.input as string
    const output = req.query.output as string

    if (input === CountryNameFormat.NonStandardCountryName) {
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.queryMysql(`
            SELECT country_name as input, ${outputColumn} as output
            FROM country_name_tool_countryname ccn
            LEFT JOIN country_name_tool_countrydata ccd on ccn.owid_country = ccd.id
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`)
    } else {
        const inputColumn = CountryDefByKey[input].column_name
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.queryMysql(
            `SELECT ${inputColumn} as input, ${outputColumn} as output
            FROM country_name_tool_countrydata ccd
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`
        )
    }

    return {
        countries: rows,
    }
})

apiRouter.post("/countries", async (req: Request, res: Response) => {
    const countries = req.body.countries

    const mapOwidNameToId: any = {}
    let owidRows = []

    // find owid ID
    const owidNames = Object.keys(countries).map((key) => countries[key])
    owidRows = await db.queryMysql(
        `SELECT id, owid_name
        FROM country_name_tool_countrydata
        WHERE owid_name in (?)
        `,
        [owidNames]
    )
    for (const row of owidRows) {
        mapOwidNameToId[row.owid_name] = row.id
    }

    // insert one by one (ideally do a bulk insert)
    for (const country of Object.keys(countries)) {
        const owidName = countries[country]

        console.log(
            `adding ${country}, ${mapOwidNameToId[owidName]}, ${owidName}`
        )

        await db.execute(
            `INSERT INTO country_name_tool_countryname (country_name, owid_country)
            VALUES (?, ?)`,
            [country, mapOwidNameToId[owidName]]
        )
    }

    return { success: true }
})

apiRouter.get(
    "/editorData/:namespace.json",
    async (req: Request, res: Response) => {
        const datasets = []
        const rows = await db.queryMysql(
            `SELECT
                v.name,
                v.id,
                d.name as datasetName,
                d.namespace,
                d.isPrivate,
                d.nonRedistributable
            FROM variables as v JOIN datasets as d ON v.datasetId = d.id
            WHERE namespace=?
            ORDER BY d.updatedAt DESC
            `,
            [req.params.namespace]
        )

        let dataset:
            | {
                  name: string
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
                    name: row.datasetName,
                    namespace: row.namespace,
                    isPrivate: row.isPrivate,
                    nonRedistributable: row.nonRedistributable,
                    variables: [],
                }
            }

            dataset.variables.push({
                id: row.id,
                name: row.name,
            })
        }

        if (dataset) datasets.push(dataset)

        return { datasets: datasets }
    }
)

apiRouter.get(
    "/data/variables/:variableStr.json",
    async (req: Request, res: Response) => {
        const variableIds: number[] = req.params.variableStr
            .split("+")
            .map((v: string) => parseInt(v))
        return getVariableData(variableIds)
    }
)

apiRouter.post("/charts", async (req: Request, res: Response) => {
    const chartId = await db.transaction(async (t) => {
        return saveGrapher(t, res.locals.user, req.body)
    })
    return { success: true, chartId: chartId }
})

apiRouter.post(
    "/charts/:chartId/setTags",
    async (req: Request, res: Response) => {
        const chartId = expectInt(req.params.chartId)

        await Chart.setTags(chartId, req.body.tagIds)

        return { success: true }
    }
)

apiRouter.put("/charts/:chartId", async (req: Request, res: Response) => {
    const existingConfig = await expectChartById(req.params.chartId)

    await db.transaction(async (t) => {
        await saveGrapher(t, res.locals.user, req.body, existingConfig)
    })

    const logs = await getLogsByChartId(existingConfig.id as number)
    return { success: true, chartId: existingConfig.id, newLog: logs[0] }
})

apiRouter.delete("/charts/:chartId", async (req: Request, res: Response) => {
    const chart = await expectChartById(req.params.chartId)

    await db.transaction(async (t) => {
        await t.execute(`DELETE FROM chart_dimensions WHERE chartId=?`, [
            chart.id,
        ])
        await t.execute(`DELETE FROM chart_slug_redirects WHERE chart_id=?`, [
            chart.id,
        ])
        await t.execute(
            `DELETE FROM suggested_chart_revisions WHERE chartId=?`,
            [chart.id]
        )
        await t.execute(`DELETE FROM charts WHERE id=?`, [chart.id])
    })

    if (chart.isPublished)
        await triggerStaticBuild(
            res.locals.user,
            `Deleting chart ${chart.slug}`
        )

    return { success: true }
})

apiRouter.get(
    "/suggested-chart-revisions",
    async (req: Request, res: Response) => {
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
        const status = SuggestedChartRevision.isValidStatus(
            req.query.status as SuggestedChartRevisionStatus
        )
            ? req.query.status
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

        const suggestedChartRevisions = await db.queryMysql(
            `
            SELECT scr.id, scr.chartId, scr.updatedAt, scr.createdAt,
                scr.suggestedReason, scr.decisionReason, scr.status,
                scr.suggestedConfig, scr.originalConfig,
                createdByUser.id as createdById,
                updatedByUser.id as updatedById,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig, c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            ${status ? "WHERE scr.status = ?" : ""}
            ORDER BY ${orderBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `,
            status ? [status, limit, offset] : [limit, offset]
        )

        let numTotalRows = (
            await db.queryMysql(
                `
                SELECT COUNT(*) as count
                FROM suggested_chart_revisions
                ${status ? "WHERE status = ?" : ""}
            `,
                status ? [status] : []
            )
        )[0].count
        numTotalRows = numTotalRows ? parseInt(numTotalRows) : numTotalRows

        suggestedChartRevisions.map(
            (suggestedChartRevision: SuggestedChartRevision) => {
                suggestedChartRevision.suggestedConfig = JSON.parse(
                    suggestedChartRevision.suggestedConfig
                )
                suggestedChartRevision.existingConfig = JSON.parse(
                    suggestedChartRevision.existingConfig
                )
                suggestedChartRevision.originalConfig = JSON.parse(
                    suggestedChartRevision.originalConfig
                )
                suggestedChartRevision.canApprove =
                    SuggestedChartRevision.checkCanApprove(
                        suggestedChartRevision
                    )
                suggestedChartRevision.canReject =
                    SuggestedChartRevision.checkCanReject(
                        suggestedChartRevision
                    )
                suggestedChartRevision.canFlag =
                    SuggestedChartRevision.checkCanFlag(suggestedChartRevision)
                suggestedChartRevision.canPending =
                    SuggestedChartRevision.checkCanPending(
                        suggestedChartRevision
                    )
            }
        )

        return {
            suggestedChartRevisions: suggestedChartRevisions,
            numTotalRows: numTotalRows,
        }
    }
)

apiRouter.post(
    "/suggested-chart-revisions",
    async (req: Request, res: Response) => {
        const messages: any[] = []
        const status = SuggestedChartRevisionStatus.pending
        const suggestedReason = req.body.suggestedReason
            ? String(req.body.suggestedReason)
            : null
        const convertStringsToNull =
            typeof req.body.convertStringsToNull == "boolean"
                ? req.body.convertStringsToNull
                : true
        const suggestedConfigs = req.body.suggestedConfigs as any[]

        // suggestedConfigs must be an array of length > 0
        if (!(Array.isArray(suggestedConfigs) && suggestedConfigs.length > 0)) {
            throw new JsonError(
                "POST body must contain a `suggestedConfigs` property, which must be an Array with length > 0."
            )
        }

        // tries to convert each config field to json (e.g. the `map` field
        // should be converted to json if it is present).
        suggestedConfigs.map((config) => {
            Object.keys(config).map((k) => {
                try {
                    const json = JSON.parse(config[k])
                    config[k] = json
                } catch (error) {
                    // do nothing.
                }
            })
        })

        // checks for required keys
        const requiredKeys = ["id", "version"]
        suggestedConfigs.map((config) => {
            requiredKeys.map((k) => {
                if (!config.hasOwnProperty(k)) {
                    throw new JsonError(
                        `The "${k}" field is required, but one or more chart configs in the POST body does not contain it.`
                    )
                }
            })
        })

        // safely sets types of keys that are used in db queries below.
        const typeConversions = [
            { key: "id", expectedType: "number", f: expectInt },
            { key: "version", expectedType: "number", f: expectInt },
        ]
        suggestedConfigs.map((config) => {
            typeConversions.map((obj) => {
                config[obj.key] = obj.f(config[obj.key])
                if (
                    config[obj.key] !== null &&
                    config[obj.key] !== undefined &&
                    typeof config[obj.key] !== obj.expectedType
                ) {
                    throw new JsonError(
                        `Expected all "${obj.key}" values to be non-null and of ` +
                            `type "${obj.expectedType}", but one or more chart ` +
                            `configs contains a "${obj.key}" value that does ` +
                            `not meet this criteria.`
                    )
                }
            })
        })

        // checks for invalid keys
        const uniqKeys = new Set()
        suggestedConfigs.map((config) => {
            Object.keys(config).forEach((item) => {
                uniqKeys.add(item)
            })
        })
        const invalidKeys = [...uniqKeys].filter(
            (v) => !grapherKeysToSerialize.includes(v as string)
        )
        if (invalidKeys.length > 0) {
            throw new JsonError(
                `The following fields are not valid chart config fields: ${invalidKeys}`
            )
        }

        // checks that no duplicate chart ids are present.
        const chartIds = suggestedConfigs.map((config) => config.id)
        if (new Set(chartIds).size !== chartIds.length) {
            throw new JsonError(
                `Found one or more duplicate chart ids in POST body.`
            )
        }

        // converts some strings to null
        if (convertStringsToNull) {
            const isNullString = (value: string): boolean => {
                const nullStrings = ["nan", "na"]
                return nullStrings.includes(value.toLowerCase())
            }
            suggestedConfigs.map((config) => {
                for (const key of Object.keys(config)) {
                    if (
                        typeof config[key] == "string" &&
                        isNullString(config[key])
                    ) {
                        config[key] = null
                    }
                }
            })
        }

        // empty strings mean that the field should NOT be overwritten, so we
        // remove key-value pairs where value === ""
        suggestedConfigs.map((config) => {
            for (const key of Object.keys(config)) {
                if (config[key] === "") {
                    delete config[key]
                }
            }
        })

        await db.transaction(async (t) => {
            const whereCond1 = suggestedConfigs
                .map(
                    (config) =>
                        `(id = ${escape(
                            config.id
                        )} AND config->"$.version" = ${escape(config.version)})`
                )
                .join(" OR ")
            const whereCond2 = suggestedConfigs
                .map(
                    (config) =>
                        `(chartId = ${escape(
                            config.id
                        )} AND config->"$.version" = ${escape(config.version)})`
                )
                .join(" OR ")
            // retrieves original chart configs
            let rows: any[] = await t.query(
                `
                SELECT id, config, 1 as priority
                FROM charts
                WHERE ${whereCond1}

                UNION

                SELECT chartId as id, config, 2 as priority
                FROM chart_revisions
                WHERE ${whereCond2}

                ORDER BY priority
                `
            )

            rows.map((row) => {
                row.config = JSON.parse(row.config)
            })

            // drops duplicate id-version rows (keeping the row from the
            // `charts` table when available).
            rows = rows.filter(
                (v, i, a) =>
                    a.findIndex(
                        (el) =>
                            el.id === v.id &&
                            el.config.version === v.config.version
                    ) === i
            )
            if (rows.length < suggestedConfigs.length) {
                // identifies which particular chartId-version combinations have
                // not been found in the DB
                const missingConfigs = suggestedConfigs.filter((config) => {
                    const i = rows.findIndex((row) => {
                        return (
                            row.id === config.id &&
                            row.config.version === config.version
                        )
                    })
                    return i === -1
                })
                throw new JsonError(
                    `Failed to retrieve the following chartId-version combinations:\n${missingConfigs
                        .map((c) => {
                            return JSON.stringify({
                                id: c.id,
                                version: c.version,
                            })
                        })
                        .join(
                            "\n"
                        )}\nPlease check that each chartId and version exists.`
                )
            } else if (rows.length > suggestedConfigs.length) {
                throw new JsonError(
                    "Retrieved more chart configs than expected. This may be due to a bug on the server."
                )
            }
            const originalConfigs: Record<string, GrapherInterface> =
                rows.reduce(
                    (obj: any, row: any) => ({
                        ...obj,
                        [row.id]: row.config,
                    }),
                    {}
                )

            // some chart configs do not have an `id` field, so we check for it
            // and insert the id here as needed. This is important for the
            // lodash.isEqual condition later on.
            for (const [id, config] of Object.entries(originalConfigs)) {
                if (config.id === null || config.id === undefined) {
                    config.id = parseInt(id)
                }
            }

            // sanity check that each original config also has the required keys.
            Object.values(originalConfigs).map((config) => {
                requiredKeys.map((k) => {
                    if (!config.hasOwnProperty(k)) {
                        throw new JsonError(
                            `The "${k}" field is required, but one or more ` +
                                `chart configs in the database does not ` +
                                `contain it. Please report this issue to a ` +
                                `developer.`
                        )
                    }
                })
            })

            // if a field is null in the suggested config and the field does not
            // exist in the original config, then we can delete the field from
            // the suggested config b/c the non-existence of the field on the
            // original config is equivalent to null.
            suggestedConfigs.map((config: any) => {
                const chartId = config.id as number
                const originalConfig = originalConfigs[chartId]
                for (const key of Object.keys(config)) {
                    if (
                        config[key] === null &&
                        !originalConfig.hasOwnProperty(key)
                    ) {
                        delete config[key]
                    }
                }
            })

            // constructs array of suggested chart revisions to insert.
            const values: any[] = []
            suggestedConfigs.map((config) => {
                const chartId = config.id as number
                const originalConfig = originalConfigs[chartId]
                const suggestedConfig: GrapherInterface = Object.assign(
                    {},
                    JSON.parse(JSON.stringify(originalConfig)),
                    config
                )
                if (!lodash.isEqual(suggestedConfig, originalConfig)) {
                    if (suggestedConfig.version) {
                        suggestedConfig.version += 1
                    }
                    values.push([
                        chartId,
                        JSON.stringify(suggestedConfig),
                        JSON.stringify(originalConfig),
                        suggestedReason,
                        status,
                        res.locals.user.id,
                        new Date(),
                        new Date(),
                    ])
                }
            })

            // inserts suggested chart revisions
            const result = await t.execute(
                `
                INSERT INTO suggested_chart_revisions
                (chartId, suggestedConfig, originalConfig, suggestedReason, status, createdBy, createdAt, updatedAt)
                VALUES
                ?
                `,
                [values]
            )
            if (result.affectedRows > 0) {
                messages.push({
                    type: "success",
                    text: `${result.affectedRows} chart revisions have been queued for approval.`,
                })
            }
            if (suggestedConfigs.length - result.affectedRows > 0) {
                messages.push({
                    type: "warning",
                    text: `${
                        suggestedConfigs.length - result.affectedRows
                    } chart revisions have not been queued for approval (e.g. because the chart revision does not contain any changes).`,
                })
            }
        })

        return { success: true, messages }
    }
)

apiRouter.get(
    "/suggested-chart-revisions/:suggestedChartRevisionId",
    async (req: Request, res: Response) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )

        const suggestedChartRevision = await db.mysqlFirst(
            `
            SELECT scr.id, scr.chartId, scr.updatedAt, scr.createdAt,
                scr.suggestedReason, scr.decisionReason, scr.status,
                scr.suggestedConfig, scr.originalConfig,
                createdByUser.id as createdById,
                updatedByUser.id as updatedById,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig, c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            WHERE scr.id = ?
        `,
            [suggestedChartRevisionId]
        )

        if (!suggestedChartRevision) {
            throw new JsonError(
                `No suggested chart revision by id '${suggestedChartRevisionId}'`,
                404
            )
        }

        suggestedChartRevision.suggestedConfig = JSON.parse(
            suggestedChartRevision.suggestedConfig
        )
        suggestedChartRevision.originalConfig = JSON.parse(
            suggestedChartRevision.originalConfig
        )
        suggestedChartRevision.existingConfig = JSON.parse(
            suggestedChartRevision.existingConfig
        )
        suggestedChartRevision.canApprove =
            SuggestedChartRevision.checkCanApprove(suggestedChartRevision)
        suggestedChartRevision.canReject =
            SuggestedChartRevision.checkCanReject(suggestedChartRevision)
        suggestedChartRevision.canFlag = SuggestedChartRevision.checkCanFlag(
            suggestedChartRevision
        )
        suggestedChartRevision.canPending =
            SuggestedChartRevision.checkCanPending(suggestedChartRevision)

        return {
            suggestedChartRevision: suggestedChartRevision,
        }
    }
)

apiRouter.post(
    "/suggested-chart-revisions/:suggestedChartRevisionId/update",
    async (req: Request, res: Response) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )
        const { status, decisionReason } = req.body as {
            status: string
            decisionReason: string
        }

        await db.transaction(async (t) => {
            const suggestedChartRevision = await db.mysqlFirst(
                `SELECT id, chartId, suggestedConfig, originalConfig, status FROM suggested_chart_revisions WHERE id=?`,
                [suggestedChartRevisionId]
            )
            if (!suggestedChartRevision) {
                throw new JsonError(
                    `No suggested chart revision found for id '${suggestedChartRevisionId}'`,
                    404
                )
            }

            suggestedChartRevision.suggestedConfig = JSON.parse(
                suggestedChartRevision.suggestedConfig
            )
            suggestedChartRevision.originalConfig = JSON.parse(
                suggestedChartRevision.originalConfig
            )
            suggestedChartRevision.existingConfig = await expectChartById(
                suggestedChartRevision.chartId
            )

            const canApprove = SuggestedChartRevision.checkCanApprove(
                suggestedChartRevision
            )
            const canReject = SuggestedChartRevision.checkCanReject(
                suggestedChartRevision
            )
            const canFlag = SuggestedChartRevision.checkCanFlag(
                suggestedChartRevision
            )
            const canPending = SuggestedChartRevision.checkCanPending(
                suggestedChartRevision
            )

            const canUpdate =
                (status === "approved" && canApprove) ||
                (status === "rejected" && canReject) ||
                (status === "pending" && canPending) ||
                (status === "flagged" && canFlag)
            if (!canUpdate) {
                throw new JsonError(
                    `Suggest chart revision ${suggestedChartRevisionId} cannot be ` +
                        `updated with status="${status}".`,
                    404
                )
            }

            await t.execute(
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
            // note: the calls to saveGrapher() below will never overwrite a config
            // that has been changed since the suggestedConfig was created, because
            // if the config has been changed since the suggestedConfig was created
            // then canUpdate will be false (so an error would have been raised
            // above).
            if (status === "approved" && canApprove) {
                await saveGrapher(
                    t,
                    res.locals.user,
                    suggestedChartRevision.suggestedConfig,
                    suggestedChartRevision.existingConfig
                )
            } else if (
                status === "rejected" &&
                canReject &&
                suggestedChartRevision.status === "approved"
            ) {
                await saveGrapher(
                    t,
                    res.locals.user,
                    suggestedChartRevision.originalConfig,
                    suggestedChartRevision.existingConfig
                )
            }
        })

        return { success: true }
    }
)

apiRouter.get("/users.json", async (req: Request, res: Response) => ({
    users: await User.find({
        select: [
            "id",
            "email",
            "fullName",
            "isActive",
            "isSuperuser",
            "createdAt",
            "updatedAt",
            "lastLogin",
            "lastSeen",
        ],
        order: { lastSeen: "DESC" },
    }),
}))

apiRouter.get("/users/:userId.json", async (req: Request, res: Response) => ({
    user: await User.findOne(req.params.userId, {
        select: [
            "id",
            "email",
            "fullName",
            "isActive",
            "isSuperuser",
            "createdAt",
            "updatedAt",
            "lastLogin",
            "lastSeen",
        ],
    }),
}))

apiRouter.delete("/users/:userId", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser)
        throw new JsonError("Permission denied", 403)

    const userId = expectInt(req.params.userId)
    await db.transaction(async (t) => {
        await t.execute(`DELETE FROM users WHERE id=?`, [userId])
    })

    return { success: true }
})

apiRouter.put("/users/:userId", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser)
        throw new JsonError("Permission denied", 403)

    const user = await User.findOne(req.params.userId)
    if (!user) throw new JsonError("No such user", 404)

    user.fullName = req.body.fullName
    user.isActive = req.body.isActive
    await user.save()

    return { success: true }
})

apiRouter.post("/users/invite", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser)
        throw new JsonError("Permission denied", 403)

    const { email } = req.body

    await getConnection().transaction(async (manager) => {
        // Remove any previous invites for this email address to avoid duplicate accounts
        const repo = manager.getRepository(UserInvitation)
        await repo
            .createQueryBuilder()
            .where(`email = :email`, { email })
            .delete()
            .execute()

        const invite = new UserInvitation()
        invite.email = email
        invite.code = UserInvitation.makeInviteCode()
        invite.validTill = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        invite.createdAt = new Date()
        invite.updatedAt = new Date()
        await repo.save(invite)

        const inviteLink = absoluteUrl(`/admin/register?code=${invite.code}`)

        await sendMail({
            from: "no-reply@ourworldindata.org",
            to: email,
            subject: "Invitation to join owid-admin",
            text: `Hi, please follow this link to register on owid-admin: ${inviteLink}`,
        })
    })

    return { success: true }
})

apiRouter.get("/variables.json", async (req) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 50
    const searchStr = req.query.search

    const query = `
        SELECT
            v.id,
            v.name,
            d.id AS datasetId,
            d.name AS datasetName,
            d.isPrivate AS isPrivate,
            d.nonRedistributable AS nonRedistributable,
            d.dataEditedAt AS uploadedAt,
            u.fullName AS uploadedBy
        FROM variables AS v
        JOIN datasets d ON d.id=v.datasetId
        JOIN users u ON u.id=d.dataEditedByUserId
        ${searchStr ? "WHERE v.name LIKE ?" : ""}
        ORDER BY d.dataEditedAt DESC
        LIMIT ?
    `

    const rows = await db.queryMysql(
        query,
        searchStr ? [`%${searchStr}%`, limit] : [limit]
    )

    const numTotalRows = (
        await db.queryMysql(`SELECT COUNT(*) as count FROM variables`)
    )[0].count

    return { variables: rows, numTotalRows: numTotalRows }
})

apiRouter.get(
    "/chart-bulk-update",
    async (
        req
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
        const resultsWithStringGrapherConfigs =
            await db.queryMysql(`SELECT charts.id as id,
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
OFFSET ${offset.toString()}`)

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.queryMysql(`SELECT count(*) as count
FROM charts
WHERE ${whereClause}`)
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

apiRouter.patch("/chart-bulk-update", async (req, res) => {
    const patchesList = req.body as GrapherConfigPatch[]
    const chartIds = new Set(patchesList.map((patch) => patch.id))

    await db.transaction(async (manager) => {
        const configsAndIds = await manager.query(
            `SELECT id, config FROM charts where id IN (?)`,
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
            await saveGrapher(
                manager,
                res.locals.user,
                newConfig,
                oldValuesConfigMap.get(id)
            )
        }
    })

    return { success: true }
})

apiRouter.get(
    "/variable-annotations",
    async (
        req
    ): Promise<BulkGrapherConfigResponse<VariableAnnotationsResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "grapherConfig",
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
        const resultsWithStringGrapherConfigs =
            await db.queryMysql(`SELECT variables.id as id,
            variables.name as name,
            variables.grapherConfig as config,
            datasets.name as datasetname,
            namespaces.name as namespacename,
            variables.createdAt as createdAt,
            variables.updatedAt as updatedAt,
            variables.description as description
FROM variables
LEFT JOIN datasets on variables.datasetId = datasets.id
LEFT JOIN namespaces on datasets.namespace = namespaces.name
WHERE ${whereClause}
ORDER BY variables.id DESC
LIMIT 50
OFFSET ${offset.toString()}`)

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.queryMysql(`SELECT count(*) as count
FROM variables
LEFT JOIN datasets on variables.datasetId = datasets.id
LEFT JOIN namespaces on datasets.namespace = namespaces.name
WHERE ${whereClause}`)
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

apiRouter.patch("/variable-annotations", async (req) => {
    const patchesList = req.body as GrapherConfigPatch[]
    const variableIds = new Set(patchesList.map((patch) => patch.id))

    await db.transaction(async (manager) => {
        const configsAndIds = await manager.query(
            `SELECT id, grapherConfig FROM variables where id IN (?)`,
            [[...variableIds.values()]]
        )
        const configMap = new Map(
            configsAndIds.map((item: any) => [
                item.id,
                item.grapherConfig ? JSON.parse(item.grapherConfig) : {},
            ])
        )
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [variableId, newConfig] of configMap.entries()) {
            await manager.execute(
                `UPDATE variables SET grapherConfig = ? where id = ?`,
                [JSON.stringify(newConfig), variableId]
            )
        }
    })

    return { success: true }
})

apiRouter.get("/variables.usages.json", async (req) => {
    const query = `SELECT variableId, COUNT(DISTINCT chartId) AS usageCount
FROM chart_dimensions
GROUP BY variableId
ORDER BY usageCount DESC`

    const rows = await db.queryMysql(query)

    return rows
})

interface VariableSingleMeta {
    id: number
    name: string
    unit: string
    shortUnit: string
    description: string

    datasetId: number
    datasetName: string
    datasetNamespace: string

    vardata: string
    display: any
}

// TODO where is this used? can we get rid of VariableSingleMeta type?
apiRouter.get(
    "/variables/:variableId.json",
    async (req: Request, res: Response) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await db.mysqlFirst(
            `
        SELECT v.id, v.name, v.unit, v.shortUnit, v.description, v.sourceId, u.fullName AS uploadedBy,
               v.display, d.id AS datasetId, d.name AS datasetName, d.namespace AS datasetNamespace
        FROM variables v
        JOIN datasets d ON d.id=v.datasetId
        JOIN users u ON u.id=d.dataEditedByUserId
        WHERE v.id = ?
    `,
            [variableId]
        )

        if (!variable) {
            throw new JsonError(`No variable by id '${variableId}'`, 404)
        }

        variable.display = JSON.parse(variable.display)

        variable.source = await db.mysqlFirst(
            `SELECT id, name FROM sources AS s WHERE id = ?`,
            variable.sourceId
        )

        const charts = await db.queryMysql(
            `
        SELECT ${OldChart.listFields}
        FROM charts
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        JOIN chart_dimensions cd ON cd.chartId = charts.id
        WHERE cd.variableId = ?
        GROUP BY charts.id
    `,
            [variableId]
        )

        await Chart.assignTagsForCharts(charts)

        variable.charts = charts

        return {
            variable: variable as VariableSingleMeta,
        } /*, vardata: await getVariableData([variableId]) }*/
    }
)

apiRouter.put("/variables/:variableId", async (req: Request) => {
    const variableId = expectInt(req.params.variableId)
    const variable = (req.body as { variable: VariableSingleMeta }).variable

    await db.execute(
        `UPDATE variables SET name=?, description=?, updatedAt=?, display=? WHERE id = ?`,
        [
            variable.name,
            variable.description,
            new Date(),
            JSON.stringify(variable.display),
            variableId,
        ]
    )

    return { success: true }
})

apiRouter.delete("/variables/:variableId", async (req: Request) => {
    const variableId = expectInt(req.params.variableId)

    const variable = await db.mysqlFirst(
        `SELECT datasets.namespace FROM variables JOIN datasets ON variables.datasetId=datasets.id WHERE variables.id=?`,
        [variableId]
    )

    if (!variable) throw new JsonError(`No variable by id ${variableId}`, 404)
    else if (variable.namespace !== "owid")
        throw new JsonError(`Cannot delete bulk import variable`, 400)

    await db.transaction(async (t) => {
        await t.execute(`DELETE FROM data_values WHERE variableId=?`, [
            variableId,
        ])
        await t.execute(`DELETE FROM variables WHERE id=?`, [variableId])
    })

    return { success: true }
})

apiRouter.get("/datasets.json", async (req) => {
    const datasets = await db.queryMysql(`
        SELECT
            d.id,
            d.namespace,
            d.name,
            d.description,
            d.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            d.metadataEditedAt,
            mu.fullName AS metadataEditedByUserName,
            d.isPrivate,
            d.nonRedistributable
        FROM datasets d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        ORDER BY d.dataEditedAt DESC
    `)

    const tags = await db.queryMysql(`
        SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
        JOIN tags t ON dt.tagId = t.id
    `)
    const tagsByDatasetId = lodash.groupBy(tags, (t) => t.datasetId)
    for (const dataset of datasets) {
        dataset.tags = (tagsByDatasetId[dataset.id] || []).map((t) =>
            lodash.omit(t, "datasetId")
        )
    }
    /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

    return { datasets: datasets }
})

apiRouter.get("/datasets/:datasetId.json", async (req: Request) => {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.mysqlFirst(
        `
        SELECT d.id,
            d.namespace,
            d.name,
            d.description,
            d.updatedAt,
            d.dataEditedAt,
            d.dataEditedByUserId,
            du.fullName AS dataEditedByUserName,
            d.metadataEditedAt,
            d.metadataEditedByUserId,
            mu.fullName AS metadataEditedByUserName,
            d.isPrivate,
            d.nonRedistributable
        FROM datasets AS d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        WHERE d.id = ?
    `,
        [datasetId]
    )

    if (!dataset) throw new JsonError(`No dataset by id '${datasetId}'`, 404)

    const zipFile = await db.mysqlFirst(
        `SELECT filename FROM dataset_files WHERE datasetId=?`,
        [datasetId]
    )
    if (zipFile) dataset.zipFile = zipFile

    const variables = await db.queryMysql(
        `
        SELECT v.id, v.name, v.description, v.display
        FROM variables AS v
        WHERE v.datasetId = ?
    `,
        [datasetId]
    )

    for (const v of variables) {
        v.display = JSON.parse(v.display)
    }

    dataset.variables = variables

    // Currently for backwards compatibility datasets can still have multiple sources
    // but the UI presents only a single item of source metadata, we use the first source
    const sources = await db.queryMysql(
        `
        SELECT s.id, s.name, s.description
        FROM sources AS s
        WHERE s.datasetId = ?
        ORDER BY s.id ASC
    `,
        [datasetId]
    )

    dataset.source = JSON.parse(sources[0].description)
    dataset.source.id = sources[0].id
    dataset.source.name = sources[0].name

    const charts = await db.queryMysql(
        `
        SELECT ${OldChart.listFields}
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

    await Chart.assignTagsForCharts(charts)

    const tags = await db.queryMysql(
        `
        SELECT t.id, t.name
        FROM tags t
        JOIN dataset_tags dt ON dt.tagId = t.id
        WHERE dt.datasetId = ?
    `,
        [datasetId]
    )
    dataset.tags = tags

    const availableTags = await db.queryMysql(`
        SELECT t.id, t.name, p.name AS parentName
        FROM tags AS t
        JOIN tags AS p ON t.parentId=p.id
        WHERE p.isBulkImport IS FALSE
    `)
    dataset.availableTags = availableTags

    return { dataset: dataset }
})

apiRouter.put("/datasets/:datasetId", async (req: Request, res: Response) => {
    const datasetId = expectInt(req.params.datasetId)
    const dataset = await Dataset.findOne({ id: datasetId })
    if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

    await db.transaction(async (t) => {
        const newDataset = (req.body as { dataset: any }).dataset
        await t.execute(
            `
            UPDATE datasets
            SET
                name=?,
                description=?,
                isPrivate=?,
                nonRedistributable=?,
                metadataEditedAt=?,
                metadataEditedByUserId=?
            WHERE id=?
            `,
            [
                newDataset.name,
                newDataset.description || "",
                newDataset.isPrivate,
                newDataset.nonRedistributable,
                new Date(),
                res.locals.user.id,
                datasetId,
            ]
        )

        const tagRows = newDataset.tags.map((tag: any) => [tag.id, datasetId])
        await t.execute(`DELETE FROM dataset_tags WHERE datasetId=?`, [
            datasetId,
        ])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO dataset_tags (tagId, datasetId) VALUES ?`,
                [tagRows]
            )

        const source = newDataset.source
        const description = lodash.omit(source, ["name", "id"])
        await t.execute(`UPDATE sources SET name=?, description=? WHERE id=?`, [
            source.name,
            JSON.stringify(description),
            source.id,
        ])
    })

    // Note: not currently in transaction
    try {
        await syncDatasetToGitRepo(datasetId, {
            oldDatasetName: dataset.name,
            commitName: res.locals.user.fullName,
            commitEmail: res.locals.user.email,
        })
    } catch (err) {
        logErrorAndMaybeSendToSlack(err)
        // Continue
    }

    return { success: true }
})

apiRouter.post(
    "/datasets/:datasetId/setTags",
    async (req: Request, res: Response) => {
        const datasetId = expectInt(req.params.datasetId)

        await Dataset.setTags(datasetId, req.body.tagIds)

        return { success: true }
    }
)

apiRouter.router.put(
    "/datasets/:datasetId/uploadZip",
    express.raw({ type: "application/zip", limit: "50mb" }),
    async (req: Request, res: Response) => {
        const datasetId = expectInt(req.params.datasetId)

        await db.transaction(async (t) => {
            await t.execute(`DELETE FROM dataset_files WHERE datasetId=?`, [
                datasetId,
            ])
            await t.execute(
                `INSERT INTO dataset_files (datasetId, filename, file) VALUES (?, ?, ?)`,
                [datasetId, "additional-material.zip", req.body]
            )
        })

        res.send({ success: true })
    }
)

apiRouter.delete(
    "/datasets/:datasetId",
    async (req: Request, res: Response) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await Dataset.findOne({ id: datasetId })
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        await db.transaction(async (t) => {
            await t.execute(
                `DELETE d FROM data_values AS d JOIN variables AS v ON d.variableId=v.id WHERE v.datasetId=?`,
                [datasetId]
            )
            await t.execute(
                `DELETE d FROM country_latest_data AS d JOIN variables AS v ON d.variable_id=v.id WHERE v.datasetId=?`,
                [datasetId]
            )
            await t.execute(`DELETE FROM dataset_files WHERE datasetId=?`, [
                datasetId,
            ])
            await t.execute(`DELETE FROM variables WHERE datasetId=?`, [
                datasetId,
            ])
            await t.execute(`DELETE FROM sources WHERE datasetId=?`, [
                datasetId,
            ])
            await t.execute(`DELETE FROM datasets WHERE id=?`, [datasetId])
        })

        try {
            await removeDatasetFromGitRepo(dataset.name, dataset.namespace, {
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email,
            })
        } catch (err) {
            logErrorAndMaybeSendToSlack(err)
            // Continue
        }

        return { success: true }
    }
)

apiRouter.post(
    "/datasets/:datasetId/charts",
    async (req: Request, res: Response) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await Dataset.findOne({ id: datasetId })
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        if (req.body.republish) {
            await db.transaction(async (t) => {
                await t.execute(
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
            })
        }

        await triggerStaticBuild(
            res.locals.user,
            `Republishing all charts in dataset ${dataset.name} (${dataset.id})`
        )

        return { success: true }
    }
)

// Get a list of redirects that map old slugs to charts
apiRouter.get("/redirects.json", async (req: Request, res: Response) => ({
    redirects: await db.queryMysql(`
        SELECT r.id, r.slug, r.chart_id as chartId, JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS chartSlug
        FROM chart_slug_redirects AS r JOIN charts ON charts.id = r.chart_id
        ORDER BY r.id DESC`),
}))

apiRouter.get("/tags/:tagId.json", async (req: Request, res: Response) => {
    const tagId = expectInt(req.params.tagId) as number | null

    // NOTE (Mispy): The "uncategorized" tag is special -- it represents all untagged stuff
    // Bit fiddly to handle here but more true to normalized schema than having to remember to add the special tag
    // every time we create a new chart etcs
    const uncategorized = tagId === UNCATEGORIZED_TAG_ID

    const tag = await db.mysqlFirst(
        `
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, p.isBulkImport
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.id = ?
    `,
        [tagId]
    )

    // Datasets tagged with this tag
    const datasets = await db.queryMysql(
        `
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
        FROM datasets d
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
            const datasetTags = await db.queryMysql(
                `
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
    const charts = await db.queryMysql(
        `
        SELECT ${OldChart.listFields} FROM charts
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

    await Chart.assignTagsForCharts(charts)

    // Subcategories
    const children = await db.queryMysql(
        `
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId = ?
    `,
        [tag.id]
    )
    tag.children = children

    // Possible parents to choose from
    const possibleParents = await db.queryMysql(`
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId IS NULL AND t.isBulkImport IS FALSE
    `)
    tag.possibleParents = possibleParents

    return {
        tag,
    }
})

apiRouter.put("/tags/:tagId", async (req: Request) => {
    const tagId = expectInt(req.params.tagId)
    const tag = (req.body as { tag: any }).tag
    await db.execute(
        `UPDATE tags SET name=?, updatedAt=?, parentId=? WHERE id=?`,
        [tag.name, new Date(), tag.parentId, tagId]
    )
    return { success: true }
})

apiRouter.post("/tags/new", async (req: Request) => {
    const tag = (req.body as { tag: any }).tag
    const now = new Date()
    const result = await db.execute(
        `INSERT INTO tags (parentId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
        [tag.parentId, tag.name, now, now]
    )
    return { success: true, tagId: result.insertId }
})

apiRouter.get("/tags.json", async (req: Request, res: Response) => {
    const tags = await db.queryMysql(`
        SELECT t.id, t.name, t.parentId, t.specialType
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.isBulkImport IS FALSE AND (t.parentId IS NULL OR p.isBulkImport IS FALSE)
        ORDER BY t.name ASC
    `)

    return {
        tags,
    }
})

apiRouter.delete("/tags/:tagId/delete", async (req: Request, res: Response) => {
    const tagId = expectInt(req.params.tagId)

    await db.transaction(async (t) => {
        await t.execute(`DELETE FROM tags WHERE id=?`, [tagId])
    })

    return { success: true }
})

apiRouter.post("/charts/:chartId/redirects/new", async (req: Request) => {
    const chartId = expectInt(req.params.chartId)
    const fields = req.body as { slug: string }
    const result = await db.execute(
        `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
        [chartId, fields.slug]
    )
    const redirectId = result.insertId
    const redirect = await db.mysqlFirst(
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [redirectId]
    )
    return { success: true, redirect: redirect }
})

apiRouter.delete("/redirects/:id", async (req: Request, res: Response) => {
    const id = expectInt(req.params.id)

    const redirect = await db.mysqlFirst(
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [id]
    )

    if (!redirect) throw new JsonError(`No redirect found for id ${id}`, 404)

    await db.execute(`DELETE FROM chart_slug_redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        res.locals.user,
        `Deleting redirect from ${redirect.slug}`
    )

    return { success: true }
})

apiRouter.get("/posts.json", async (req) => {
    const rows = await Post.select(
        "id",
        "title",
        "type",
        "status",
        "updated_at"
    ).from(db.knexInstance().from(Post.table).orderBy("updated_at", "desc"))

    const tagsByPostId = await Post.tagsByPostId()

    const authorship = await wpdb.getAuthorship()

    for (const post of rows) {
        const postAsAny = post as any
        postAsAny.authors = authorship.get(post.id) || []
        postAsAny.tags = tagsByPostId.get(post.id) || []
    }

    return { posts: rows.map((r) => camelCaseProperties(r)) }
})

apiRouter.get("/newsletterPosts.json", async (req) => {
    const rows = await wpdb.singleton.query(`
        SELECT
            ID AS id,
            post_name AS name,
            post_title AS title,
            post_modified_gmt AS updatedAt,
            post_date_gmt AS publishedAt,
            post_type AS type,
            post_status AS status,
            post_excerpt AS excerpt
        FROM wp_posts
        WHERE (post_type='post' OR post_type='page') AND post_status='publish'
        ORDER BY post_date_gmt DESC`)

    const permalinks = await wpdb.getPermalinks()
    const featuresImages = await wpdb.getFeaturedImages()

    const posts = rows.map((row) => {
        const slug = permalinks.get(row.id, row.name)
        return {
            id: row.id,
            title: row.title,
            updatedAt: row.updatedAt,
            publishedAt: row.publishedAt,
            type: row.type,
            status: row.status,
            excerpt: row.excerpt,
            slug: slug,
            imageUrl: featuresImages.get(row.id),
            url: `${BAKED_BASE_URL}/${slug}`,
        }
    })

    return { posts }
})

apiRouter.post(
    "/posts/:postId/setTags",
    async (req: Request, res: Response) => {
        const postId = expectInt(req.params.postId)

        await Post.setTags(postId, req.body.tagIds)

        return { success: true }
    }
)

apiRouter.get("/posts/:postId.json", async (req: Request, res: Response) => {
    const postId = expectInt(req.params.postId)
    const post = (await db
        .knexTable(Post.table)
        .where({ id: postId })
        .select("*")
        .first()) as PostRow | undefined
    return camelCaseProperties(post)
})

apiRouter.get("/importData.json", async (req) => {
    // Get all datasets from the importable namespace to match against
    const datasets = await db.queryMysql(
        `SELECT id, name FROM datasets WHERE namespace='owid' ORDER BY name ASC`
    )

    // Get a unique list of all entities in the database (probably this won't scale indefinitely)
    const existingEntities = (
        await db.queryMysql(`SELECT name FROM entities`)
    ).map((e: any) => e.name)

    return { datasets, existingEntities }
})

apiRouter.get("/importData/datasets/:datasetId.json", async (req) => {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.mysqlFirst(
        `
        SELECT d.id, d.namespace, d.name, d.description, d.updatedAt
        FROM datasets AS d
        WHERE d.id = ?
    `,
        [datasetId]
    )

    if (!dataset) throw new JsonError(`No dataset by id '${datasetId}'`, 404)

    const variables = await db.queryMysql(
        `
        SELECT v.id, v.name
        FROM variables AS v
        WHERE v.datasetId = ?
    `,
        [datasetId]
    )

    dataset.variables = variables

    return { dataset }
})

interface ImportPostData {
    dataset: {
        id?: number
        name: string
    }
    entities: string[]
    years: number[]
    variables: {
        name: string
        overwriteId?: number
        values: string[]
    }[]
}

apiRouter.post("/importDataset", async (req: Request, res: Response) => {
    const userId = res.locals.user.id
    const { dataset, entities, years, variables } = req.body as ImportPostData

    const newDatasetId = await db.transaction(async (t) => {
        const now = new Date()

        let datasetId: number

        if (dataset.id) {
            // Updating existing dataset
            datasetId = dataset.id
            await t.execute(
                `UPDATE datasets SET dataEditedAt=?, dataEditedByUserId=? WHERE id=?`,
                [now, userId, datasetId]
            )
        } else {
            // Creating new dataset
            const row = [
                dataset.name,
                "owid",
                "",
                now,
                now,
                now,
                userId,
                now,
                userId,
                userId,
                true,
            ]
            const datasetResult = await t.execute(
                `INSERT INTO datasets (name, namespace, description, createdAt, updatedAt, dataEditedAt, dataEditedByUserId, metadataEditedAt, metadataEditedByUserId, createdByUserId, isPrivate) VALUES (?)`,
                [row]
            )
            datasetId = datasetResult.insertId
        }

        // Find or create the dataset source
        // TODO probably merge source info into dataset table
        let sourceId: number | undefined
        if (datasetId) {
            // Use first source (if any)
            const rows = await t.query(
                `SELECT id FROM sources WHERE datasetId=? ORDER BY id ASC LIMIT 1`,
                [datasetId]
            )
            if (rows[0]) sourceId = rows[0].id
        }

        if (!sourceId) {
            // Insert default source
            const sourceRow = [dataset.name, "{}", now, now, datasetId]
            const sourceResult = await t.execute(
                `INSERT INTO sources (name, description, createdAt, updatedAt, datasetId) VALUES (?)`,
                [sourceRow]
            )
            sourceId = sourceResult.insertId
        }

        // Insert any new entities into the db
        const entitiesUniq = lodash.uniq(entities)
        const importEntityRows = entitiesUniq.map((e) => [
            e,
            false,
            now,
            now,
            "",
        ])
        await t.execute(
            `INSERT IGNORE entities (name, validated, createdAt, updatedAt, displayName) VALUES ?`,
            [importEntityRows]
        )

        // Map entities to entityIds
        const entityRows = await t.query(
            `SELECT id, name FROM entities WHERE name IN (?)`,
            [entitiesUniq]
        )
        const entityIdLookup: { [key: string]: number } = {}
        console.log(
            lodash.difference(lodash.keys(entityIdLookup), entitiesUniq)
        )
        for (const row of entityRows) {
            entityIdLookup[row.name] = row.id
        }

        // Remove all existing variables not matched by overwriteId
        const existingVariables = await t.query(
            `SELECT id FROM variables v WHERE v.datasetId=?`,
            [datasetId]
        )
        const removingVariables = existingVariables.filter(
            (v: any) => !variables.some((v2) => v2.overwriteId === v.id)
        )
        const removingVariableIds = removingVariables.map(
            (v: any) => v.id
        ) as number[]
        if (removingVariableIds.length) {
            await t.execute(`DELETE FROM data_values WHERE variableId IN (?)`, [
                removingVariableIds,
            ])
            await t.execute(`DELETE FROM variables WHERE id IN (?)`, [
                removingVariableIds,
            ])
        }

        // Overwrite old variables and insert new variables
        for (const variable of variables) {
            let variableId: number
            if (variable.overwriteId) {
                // Remove any existing data values
                await t.execute(`DELETE FROM data_values WHERE variableId=?`, [
                    variable.overwriteId,
                ])

                variableId = variable.overwriteId
            } else {
                const variableRow = [
                    variable.name,
                    datasetId,
                    sourceId,
                    now,
                    now,
                    "",
                    "",
                    "",
                    "{}",
                ]

                // Create a new variable
                // TODO migrate to clean up these fields
                const result = await t.execute(
                    `INSERT INTO variables (name, datasetId, sourceId, createdAt, updatedAt, unit, coverage, timespan, display) VALUES (?)`,
                    [variableRow]
                )
                variableId = result.insertId
            }

            const valueRows = []
            for (let i = 0; i < variable.values.length; i++) {
                const value = variable.values[i]
                if (value !== "") {
                    valueRows.push([
                        value,
                        years[i],
                        entityIdLookup[entities[i]],
                        variableId,
                    ])
                }
            }

            if (valueRows.length) {
                await t.execute(
                    `INSERT INTO data_values (value, year, entityId, variableId) VALUES ?`,
                    [valueRows]
                )
            }
        }

        return datasetId
    })

    // Don't sync to git repo on import-- dataset is initially private
    //await syncDatasetToGitRepo(newDatasetId, { oldDatasetName: oldDatasetName, commitName: res.locals.user.fullName, commitEmail: res.locals.user.email })

    return { success: true, datasetId: newDatasetId }
})

apiRouter.get("/sources/:sourceId.json", async (req: Request) => {
    const sourceId = expectInt(req.params.sourceId)
    const source = await db.mysqlFirst(
        `
        SELECT s.id, s.name, s.description, s.createdAt, s.updatedAt, d.namespace
        FROM sources AS s
        JOIN datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`,
        [sourceId]
    )
    source.description = JSON.parse(source.description)
    source.variables = await db.queryMysql(
        `SELECT id, name, updatedAt FROM variables WHERE variables.sourceId=?`,
        [sourceId]
    )

    return { source: source }
})

apiRouter.get("/deploys.json", async () => ({
    deploys: await new DeployQueueServer().getDeploys(),
}))

apiRouter.put("/deploy", async (req: Request, res: Response) => {
    triggerStaticBuild(res.locals.user, "Manually triggered deploy")
})

apiRouter.get("/details", async () => ({
    details: await db.queryMysql(
        `SELECT id, category, term, title, content FROM details`
    ),
}))

apiRouter.post("/details", async (req) => {
    const { category, term, title, content } = req.body
    const result = await db.execute(
        `INSERT INTO details (category, term,title, content) VALUES (?, ?, ?, ?)`,
        [category, term, title, content]
    )

    return {
        success: true,
        id: result.insertId,
    }
})

apiRouter.delete("/details/:id", async (req) => {
    const { id } = req.params
    const matches = await db.queryMysql(
        `SELECT id, category, term, title, content FROM details WHERE id = ?`,
        [id]
    )

    if (!matches.length) {
        throw new JsonError(`No detail with id ${id} found`)
    }

    const match = matches[0]

    const references: { id: number; config: string }[] = await db.queryMysql(
        `SELECT id, config FROM charts WHERE config LIKE '%(hover::${match.category}::${match.term})%'`,
        [id]
    )

    if (references.length) {
        const ids = references.map((x) => x.id).join(", ")
        throw new JsonError(
            `Detail is being used by the following Graphers: ${ids}`
        )
    }

    await db.execute(`DELETE FROM details WHERE id=?`, [id])
    return { success: true }
})

apiRouter.put("/details/:id", async (req) => {
    const { id } = req.params
    const { category, term, title, content } = req.body
    await db.execute(
        `UPDATE details SET category=?, term=?, title=?, content=? WHERE id = ?`,
        [category, term, title, content, id]
    )
    return { success: true }
})

export { apiRouter }
