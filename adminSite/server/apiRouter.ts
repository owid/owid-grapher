/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import * as lodash from "lodash"
import { getConnection } from "typeorm"
import * as bodyParser from "body-parser"

import * as db from "db/db"
import * as wpdb from "db/wpdb"
import { UNCATEGORIZED_TAG_ID, BAKE_ON_CHANGE } from "serverSettings"
import {
    JsonError,
    expectInt,
    isValidSlug,
    absoluteUrl
} from "utils/server/serverUtil"
import { sendMail } from "adminSite/server/utils/mail"
import { OldChart, Chart, getChartById } from "db/model/Chart"
import { UserInvitation } from "db/model/UserInvitation"
import { Request, Response, CurrentUser } from "./utils/authentication"
import { getVariableData, writeVariableCSV } from "db/model/Variable"
import { ChartConfigProps } from "charts/core/ChartConfig"
import {
    CountryNameFormat,
    CountryDefByKey
} from "adminSite/client/CountryNameFormat"
import { Dataset } from "db/model/Dataset"
import { User } from "db/model/User"
import {
    syncDatasetToGitRepo,
    removeDatasetFromGitRepo
} from "adminSite/server/utils/gitDataExport"
import { ChartRevision } from "db/model/ChartRevision"
import { Post } from "db/model/Post"
import { camelCaseProperties } from "utils/object"
import { log } from "utils/server/log"
import { denormalizeLatestCountryData } from "site/server/countryProfiles"
import { BAKED_BASE_URL } from "settings"
import { PostReference, ChartRedirect } from "adminSite/client/ChartEditor"
import { enqueueDeploy } from "deploy/queue"
import { isExplorable } from "utils/charts"
import { FunctionalRouter } from "./utils/FunctionalRouter"
import { addExplorerApiRoutes } from "explorer/admin/ExplorerBaker"
import { addGitCmsApiRoutes } from "gitCms/server"

const apiRouter = new FunctionalRouter()

// Call this to trigger build and deployment of static charts on change
async function triggerStaticBuild(user: CurrentUser, commitMessage: string) {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    enqueueDeploy({
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage
    })
}

async function getLogsByChartId(chartId: number): Promise<ChartRevision[]> {
    const logs = await db.query(
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

async function getReferencesByChartId(
    chartId: number
): Promise<PostReference[]> {
    const rows = await db.query(
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

    if (slugs && slugs.length > 0) {
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
            posts = await wpdb.query(
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
            console.error(error)
            // We can ignore errors due to not being able to connect.
        }
        const permalinks = await wpdb.getPermalinks()
        return posts.map(post => {
            const slug = permalinks.get(post.ID, post.post_name)
            return {
                id: post.ID,
                title: post.post_title,
                slug: slug,
                url: `${BAKED_BASE_URL}/${slug}`
            }
        })
    } else {
        return []
    }
}

async function getRedirectsByChartId(
    chartId: number
): Promise<ChartRedirect[]> {
    const redirects = await db.query(
        `
        SELECT id, slug, chart_id as chartId
        FROM chart_slug_redirects
        WHERE chart_id = ?
        ORDER BY id ASC`,
        [chartId]
    )
    return redirects
}

async function expectChartById(chartId: any): Promise<ChartConfigProps> {
    const chart = await getChartById(expectInt(chartId))

    if (chart) {
        return chart
    } else {
        throw new JsonError(`No chart found for id ${chartId}`, 404)
    }
}

function omitSaveToVariable(config: ChartConfigProps): ChartConfigProps {
    const newConfig = lodash.clone(config)
    newConfig.dimensions = newConfig.dimensions.map(dim => {
        return lodash.omit(dim, ["saveToVariable"])
    })
    return newConfig
}

async function saveChart(
    user: CurrentUser,
    newConfig: ChartConfigProps,
    existingConfig?: ChartConfigProps
) {
    return db.transaction(async t => {
        // Slugs need some special logic to ensure public urls remain consistent whenever possible
        async function isSlugUsedInRedirect() {
            const rows = await t.query(
                `SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`,
                [existingConfig ? existingConfig.id : undefined, newConfig.slug]
            )
            return rows.length > 0
        }

        async function isSlugUsedInOtherChart() {
            const rows = await t.query(
                `SELECT * FROM charts WHERE id != ? AND JSON_EXTRACT(config, "$.isPublished") IS TRUE AND JSON_EXTRACT(config, "$.slug") = ?`,
                [existingConfig ? existingConfig.id : undefined, newConfig.slug]
            )
            return rows.length > 0
        }

        // When a chart is published, check for conflicts
        if (newConfig.isPublished) {
            if (!isValidSlug(newConfig.slug)) {
                throw new JsonError(`Invalid chart slug ${newConfig.slug}`)
            } else if (await isSlugUsedInRedirect()) {
                throw new JsonError(
                    `This chart slug was previously used by another chart: ${newConfig.slug}`
                )
            } else if (await isSlugUsedInOtherChart()) {
                throw new JsonError(
                    `This chart slug is in use by another published chart: ${newConfig.slug}`
                )
            } else if (
                existingConfig &&
                existingConfig.isPublished &&
                existingConfig.slug !== newConfig.slug
            ) {
                // Changing slug of an existing chart, delete any old redirect and create new one
                await t.execute(
                    `DELETE FROM chart_slug_redirects WHERE chart_id = ? AND slug = ?`,
                    [existingConfig.id, existingConfig.slug]
                )
                await t.execute(
                    `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
                    [existingConfig.id, existingConfig.slug]
                )
            }
        }

        if (existingConfig) {
            // Bump chart version, very important for cachebusting
            newConfig.version = existingConfig.version + 1
        } else if (newConfig.version) {
            // If a chart is republished, we want to keep incrementing the old version number,
            // otherwise it can lead to clients receiving cached versions of the old data.
            newConfig.version += 1
        } else {
            newConfig.version = 1
        }

        // Execute the actual database update or creation
        const now = new Date()
        let chartId = existingConfig && existingConfig.id

        // We shouldn't store the 'saveToVariable' setting in the database.
        // It is a one-off setting to apply the settings to the variable, it
        // should not be ticked after a refresh.
        const newJsonConfig = JSON.stringify(omitSaveToVariable(newConfig))

        if (existingConfig) {
            await t.query(
                `UPDATE charts SET config=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=?, isExplorable=? WHERE id = ?`,
                [
                    newJsonConfig,
                    now,
                    now,
                    user.id,
                    isExplorable(newConfig),
                    chartId
                ]
            )
        } else {
            const result = await t.execute(
                `INSERT INTO charts (config, createdAt, updatedAt, lastEditedAt, lastEditedByUserId, starred, isExplorable) VALUES (?)`,
                [
                    [
                        newJsonConfig,
                        now,
                        now,
                        now,
                        user.id,
                        false,
                        isExplorable(newConfig)
                    ]
                ]
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
        await t.manager.save(log)

        // Remove any old dimensions and store the new ones
        // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json
        await t.execute(`DELETE FROM chart_dimensions WHERE chartId=?`, [
            chartId
        ])
        for (let i = 0; i < newConfig.dimensions.length; i++) {
            const dim = newConfig.dimensions[i]
            await t.execute(
                `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?)`,
                [[chartId, dim.variableId, dim.property, i]]
            )

            if (dim.saveToVariable) {
                const display = JSON.parse(
                    (
                        await t.query(
                            `SELECT display FROM variables WHERE id=?`,
                            [dim.variableId]
                        )
                    )[0].display
                )

                for (const key in dim.display) {
                    display[key] = (dim.display as any)[key]
                }

                await t.execute(`UPDATE variables SET display=? WHERE id=?`, [
                    JSON.stringify(display),
                    dim.variableId
                ])
            }
        }

        // So we can generate country profiles including this chart data
        if (newConfig.isPublished) {
            await denormalizeLatestCountryData(
                newConfig.dimensions.map(d => d.variableId)
            )
        }

        if (
            newConfig.isPublished &&
            (!existingConfig || !existingConfig.isPublished)
        ) {
            // Newly published, set publication info
            await t.execute(
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
            await t.execute(
                `DELETE FROM chart_slug_redirects WHERE chart_id = ?`,
                [existingConfig.id]
            )
            await triggerStaticBuild(
                user,
                `Unpublishing chart ${newConfig.slug}`
            )
        } else if (newConfig.isPublished) {
            await triggerStaticBuild(user, `Updating chart ${newConfig.slug}`)
        }

        return chartId
    })
}

apiRouter.get("/charts.json", async (req: Request, res: Response) => {
    const limit =
        req.query.limit !== undefined ? parseInt(req.query.limit) : 10000
    const charts = await db.query(
        `
        SELECT ${OldChart.listFields} FROM charts
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        ORDER BY charts.lastEditedAt DESC LIMIT ?
    `,
        [limit]
    )

    await Chart.assignTagsForCharts(charts)

    return {
        charts: charts
    }
})

apiRouter.get(
    "/charts/:chartId.config.json",
    async (req: Request, res: Response) => {
        return expectChartById(req.params.chartId)
    }
)

apiRouter.get(
    "/editorData/namespaces.json",
    async (req: Request, res: Response) => {
        const rows = (await db.query(
            `SELECT DISTINCT namespace AS name, namespaces.description FROM datasets JOIN namespaces ON namespaces.name = datasets.namespace`
        )) as { name: string; description: string }[]

        return {
            namespaces: lodash.sortBy(rows, row => row.description)
        }
    }
)

apiRouter.get(
    "/charts/:chartId.logs.json",
    async (req: Request, res: Response) => {
        const logs = await getLogsByChartId(req.params.chartId)
        return {
            logs: logs
        }
    }
)

apiRouter.get(
    "/charts/:chartId.references.json",
    async (req: Request, res: Response) => {
        const references = await getReferencesByChartId(req.params.chartId)
        return {
            references: references
        }
    }
)

apiRouter.get(
    "/charts/:chartId.redirects.json",
    async (req: Request, res: Response) => {
        const redirects = await getRedirectsByChartId(req.params.chartId)
        return {
            redirects: redirects
        }
    }
)

apiRouter.get("/countries.json", async (req: Request, res: Response) => {
    let rows = []

    const input = req.query.input
    const output = req.query.output

    if (input === CountryNameFormat.NonStandardCountryName) {
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.query(`
            SELECT country_name as input, ${outputColumn} as output
            FROM country_name_tool_countryname ccn
            LEFT JOIN country_name_tool_countrydata ccd on ccn.owid_country = ccd.id
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`)
    } else {
        const inputColumn = CountryDefByKey[input].column_name
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.query(
            `SELECT ${inputColumn} as input, ${outputColumn} as output
            FROM country_name_tool_countrydata ccd
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`
        )
    }

    return {
        countries: rows
    }
})

apiRouter.post("/countries", async (req: Request, res: Response) => {
    const countries = req.body.countries

    const mapOwidNameToId: any = {}
    let owidRows = []

    // find owid ID
    const owidNames = Object.keys(countries).map(key => countries[key])
    owidRows = await db.query(
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
        const rows = await db.query(
            `SELECT v.name, v.id, d.name as datasetName, d.namespace, d.isPrivate
         FROM variables as v JOIN datasets as d ON v.datasetId = d.id
         WHERE namespace=? ORDER BY d.updatedAt DESC`,
            [req.params.namespace]
        )

        let dataset:
            | {
                  name: string
                  namespace: string
                  isPrivate: boolean
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
                    variables: []
                }
            }

            dataset.variables.push({
                id: row.id,
                name: row.name
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

// Mark a chart for display on the front page
apiRouter.post("/charts/:chartId/star", async (req: Request, res: Response) => {
    const chart = await expectChartById(req.params.chartId)

    await db.execute(`UPDATE charts SET starred=(charts.id=?)`, [chart.id])
    await triggerStaticBuild(
        res.locals.user,
        `Setting front page chart to ${chart.slug}`
    )

    return { success: true }
})

apiRouter.post("/charts", async (req: Request, res: Response) => {
    const chartId = await saveChart(res.locals.user, req.body)
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

    await saveChart(res.locals.user, req.body, existingConfig)

    const logs = await getLogsByChartId(existingConfig.id as number)
    return { success: true, chartId: existingConfig.id, newLog: logs[0] }
})

apiRouter.delete("/charts/:chartId", async (req: Request, res: Response) => {
    const chart = await expectChartById(req.params.chartId)

    await db.transaction(async t => {
        await t.execute(`DELETE FROM chart_dimensions WHERE chartId=?`, [
            chart.id
        ])
        await t.execute(`DELETE FROM chart_slug_redirects WHERE chart_id=?`, [
            chart.id
        ])
        await t.execute(`DELETE FROM charts WHERE id=?`, [chart.id])
    })

    if (chart.isPublished)
        await triggerStaticBuild(
            res.locals.user,
            `Deleting chart ${chart.slug}`
        )

    return { success: true }
})

export interface UserIndexMeta {
    id: number
    name: string
    fullName: string
    createdAt: Date
    updatedAt: Date
    isActive: boolean
}

apiRouter.get("/users.json", async (req: Request, res: Response) => {
    return {
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
                "lastSeen"
            ],
            order: { lastSeen: "DESC" }
        })
    }
})

apiRouter.get("/users/:userId.json", async (req: Request, res: Response) => {
    const user = await User.findOne(req.params.userId, {
        select: [
            "id",
            "email",
            "fullName",
            "isActive",
            "isSuperuser",
            "createdAt",
            "updatedAt",
            "lastLogin",
            "lastSeen"
        ]
    })
    return { user: user }
})

apiRouter.delete("/users/:userId", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    const userId = expectInt(req.params.userId)
    await db.transaction(async t => {
        await t.execute(`DELETE FROM users WHERE id=?`, [userId])
    })

    return { success: true }
})

apiRouter.put("/users/:userId", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    const user = await User.findOne(req.params.userId)
    if (!user) throw new JsonError("No such user", 404)

    user.fullName = req.body.fullName
    user.isActive = req.body.isActive
    await user.save()

    return { success: true }
})

apiRouter.post("/users/invite", async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    const { email } = req.body

    await getConnection().transaction(async manager => {
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
            text: `Hi, please follow this link to register on owid-admin: ${inviteLink}`
        })
    })

    return { success: true }
})

apiRouter.get("/variables.json", async req => {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 50
    const searchStr = req.query.search

    const query = `
        SELECT v.id, v.name, d.id AS datasetId, d.name AS datasetName, d.isPrivate AS isPrivate, d.dataEditedAt AS uploadedAt, u.fullName AS uploadedBy
        FROM variables AS v
        JOIN datasets d ON d.id=v.datasetId
        JOIN users u ON u.id=d.dataEditedByUserId
        ${searchStr ? "WHERE v.name LIKE ?" : ""}
        ORDER BY d.dataEditedAt DESC
        LIMIT ?
    `

    const rows = await db.query(
        query,
        searchStr ? [`%${searchStr}%`, limit] : [limit]
    )

    const numTotalRows = (
        await db.query(`SELECT COUNT(*) as count FROM variables`)
    )[0].count

    return { variables: rows, numTotalRows: numTotalRows }
})

export interface VariableSingleMeta {
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

apiRouter.get(
    "/variables/:variableId.json",
    async (req: Request, res: Response) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await db.get(
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

        variable.source = await db.get(
            `SELECT id, name FROM sources AS s WHERE id = ?`,
            variable.sourceId
        )

        const charts = await db.query(
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
            variable: variable as VariableSingleMeta
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
            variableId
        ]
    )

    return { success: true }
})

apiRouter.delete("/variables/:variableId", async (req: Request) => {
    const variableId = expectInt(req.params.variableId)

    const variable = await db.get(
        `SELECT datasets.namespace FROM variables JOIN datasets ON variables.datasetId=datasets.id WHERE variables.id=?`,
        [variableId]
    )

    if (!variable) {
        throw new JsonError(`No variable by id ${variableId}`, 404)
    } else if (variable.namespace !== "owid") {
        throw new JsonError(`Cannot delete bulk import variable`, 400)
    }

    await db.transaction(async t => {
        await t.execute(`DELETE FROM data_values WHERE variableId=?`, [
            variableId
        ])
        await t.execute(`DELETE FROM variables WHERE id=?`, [variableId])
    })

    return { success: true }
})

apiRouter.get("/datasets.json", async req => {
    const datasets = await db.query(`
        SELECT d.id, d.namespace, d.name, d.description, d.dataEditedAt, du.fullName AS dataEditedByUserName, d.metadataEditedAt, mu.fullName AS metadataEditedByUserName, d.isPrivate
        FROM datasets d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        ORDER BY d.dataEditedAt DESC
    `)

    const tags = await db.query(`
        SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
        JOIN tags t ON dt.tagId = t.id
    `)
    const tagsByDatasetId = lodash.groupBy(tags, t => t.datasetId)
    for (const dataset of datasets) {
        dataset.tags = (tagsByDatasetId[dataset.id] || []).map(t =>
            lodash.omit(t, "datasetId")
        )
    }
    /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

    return { datasets: datasets }
})

apiRouter.get("/datasets/:datasetId.json", async (req: Request) => {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.get(
        `
        SELECT d.id, d.namespace, d.name, d.description, d.updatedAt, d.isPrivate, d.dataEditedAt, d.dataEditedByUserId, du.fullName AS dataEditedByUserName, d.metadataEditedAt, d.metadataEditedByUserId, mu.fullName AS metadataEditedByUserName, d.isPrivate
        FROM datasets AS d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        WHERE d.id = ?
    `,
        [datasetId]
    )

    if (!dataset) {
        throw new JsonError(`No dataset by id '${datasetId}'`, 404)
    }

    const zipFile = await db.get(
        `SELECT filename FROM dataset_files WHERE datasetId=?`,
        [datasetId]
    )
    if (zipFile) dataset.zipFile = zipFile

    const variables = await db.query(
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
    const sources = await db.query(
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

    const charts = await db.query(
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

    const tags = await db.query(
        `
        SELECT t.id, t.name
        FROM tags t
        JOIN dataset_tags dt ON dt.tagId = t.id
        WHERE dt.datasetId = ?
    `,
        [datasetId]
    )
    dataset.tags = tags

    const availableTags = await db.query(`
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

    await db.transaction(async t => {
        const newDataset = (req.body as { dataset: any }).dataset
        await t.execute(
            `UPDATE datasets SET name=?, description=?, isPrivate=?, metadataEditedAt=?, metadataEditedByUserId=? WHERE id=?`,
            [
                newDataset.name,
                newDataset.description || "",
                newDataset.isPrivate,
                new Date(),
                res.locals.user.id,
                datasetId
            ]
        )

        const tagRows = newDataset.tags.map((tag: any) => [tag.id, datasetId])
        await t.execute(`DELETE FROM dataset_tags WHERE datasetId=?`, [
            datasetId
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
            source.id
        ])
    })

    // Note: not currently in transaction
    try {
        await syncDatasetToGitRepo(datasetId, {
            oldDatasetName: dataset.name,
            commitName: res.locals.user.fullName,
            commitEmail: res.locals.user.email
        })
    } catch (err) {
        log.error(err)
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
    bodyParser.raw({ type: "application/zip", limit: "50mb" }),
    async (req: Request, res: Response) => {
        const datasetId = expectInt(req.params.datasetId)

        await db.transaction(async t => {
            await t.execute(`DELETE FROM dataset_files WHERE datasetId=?`, [
                datasetId
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

        await db.transaction(async t => {
            await t.execute(
                `DELETE d FROM data_values AS d JOIN variables AS v ON d.variableId=v.id WHERE v.datasetId=?`,
                [datasetId]
            )
            await t.execute(
                `DELETE d FROM country_latest_data AS d JOIN variables AS v ON d.variable_id=v.id WHERE v.datasetId=?`,
                [datasetId]
            )
            await t.execute(`DELETE FROM dataset_files WHERE datasetId=?`, [
                datasetId
            ])
            await t.execute(`DELETE FROM variables WHERE datasetId=?`, [
                datasetId
            ])
            await t.execute(`DELETE FROM sources WHERE datasetId=?`, [
                datasetId
            ])
            await t.execute(`DELETE FROM datasets WHERE id=?`, [datasetId])
        })

        try {
            await removeDatasetFromGitRepo(dataset.name, dataset.namespace, {
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email
            })
        } catch (err) {
            log.error(err)
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
            await db.transaction(async t => {
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
apiRouter.get("/redirects.json", async (req: Request, res: Response) => {
    const redirects = await db.query(`
        SELECT r.id, r.slug, r.chart_id as chartId, JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS chartSlug
        FROM chart_slug_redirects AS r JOIN charts ON charts.id = r.chart_id
        ORDER BY r.id DESC`)

    return {
        redirects: redirects
    }
})

apiRouter.get("/tags/:tagId.json", async (req: Request, res: Response) => {
    const tagId = expectInt(req.params.tagId) as number | null

    // NOTE (Mispy): The "uncategorized" tag is special -- it represents all untagged stuff
    // Bit fiddly to handle here but more true to normalized schema than having to remember to add the special tag
    // every time we create a new chart etcs
    const uncategorized = tagId === UNCATEGORIZED_TAG_ID

    const tag = await db.get(
        `
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, p.isBulkImport
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.id = ?
    `,
        [tagId]
    )

    // Datasets tagged with this tag
    const datasets = await db.query(
        `
        SELECT d.id, d.namespace, d.name, d.description, d.createdAt, d.updatedAt, d.dataEditedAt, du.fullName AS dataEditedByUserName, d.isPrivate
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
            const datasetTags = await db.query(
                `
                SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
                JOIN tags t ON dt.tagId = t.id
                WHERE dt.datasetId IN (?)
            `,
                [tag.datasets.map((d: any) => d.id)]
            )
            const tagsByDatasetId = lodash.groupBy(
                datasetTags,
                t => t.datasetId
            )
            for (const dataset of tag.datasets) {
                dataset.tags = tagsByDatasetId[dataset.id].map(t =>
                    lodash.omit(t, "datasetId")
                )
            }
        }
    }

    // Charts using datasets under this tag
    const charts = await db.query(
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
    const children = await db.query(
        `
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId = ?
    `,
        [tag.id]
    )
    tag.children = children

    // Possible parents to choose from
    const possibleParents = await db.query(`
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId IS NULL AND t.isBulkImport IS FALSE
    `)
    tag.possibleParents = possibleParents

    return {
        tag: tag
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
    const tags = await db.query(`
        SELECT t.id, t.name, t.parentId, t.specialType
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.isBulkImport IS FALSE AND (t.parentId IS NULL OR p.isBulkImport IS FALSE)
        ORDER BY t.name ASC
    `)

    return {
        tags: tags
    }
})

apiRouter.delete("/tags/:tagId/delete", async (req: Request, res: Response) => {
    const tagId = expectInt(req.params.tagId)

    await db.transaction(async t => {
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
    const redirect = await db.get(
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [redirectId]
    )
    return { success: true, redirect: redirect }
})

apiRouter.delete("/redirects/:id", async (req: Request, res: Response) => {
    const id = expectInt(req.params.id)

    const redirect = await db.get(
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [id]
    )

    if (!redirect) {
        throw new JsonError(`No redirect found for id ${id}`, 404)
    }

    await db.execute(`DELETE FROM chart_slug_redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        res.locals.user,
        `Deleting redirect from ${redirect.slug}`
    )

    return { success: true }
})

apiRouter.get("/posts.json", async req => {
    const rows = await Post.select(
        "id",
        "title",
        "type",
        "status",
        "updated_at"
    ).from(db.knex().from(Post.table).orderBy("updated_at", "desc"))

    const tagsByPostId = await Post.tagsByPostId()

    // const rows = await wpdb.query(`
    //     SELECT ID AS id, post_title AS title, post_modified_gmt AS updatedAt, post_type AS type, post_status AS status
    //     FROM wp_posts
    //     WHERE (post_type='post' OR post_type='page')
    //         AND (post_status='publish' OR post_status='pending' OR post_status='private' OR post_status='draft')
    //     ORDER BY post_modified DESC`)

    const authorship = await wpdb.getAuthorship()

    for (const post of rows) {
        ;(post as any).authors = authorship.get(post.id) || []
        ;(post as any).tags = tagsByPostId.get(post.id) || []
    }

    return { posts: rows.map(r => camelCaseProperties(r)) }
})

apiRouter.get("/newsletterPosts.json", async req => {
    const rows = await wpdb.query(`
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

    const posts = rows.map(row => {
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
            url: `${BAKED_BASE_URL}/${slug}`
        }
    })

    return { posts: posts }
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
        .table(Post.table)
        .where({ id: postId })
        .select("*")
        .first()) as Post.Row
    return camelCaseProperties(post)
})

apiRouter.get("/importData.json", async req => {
    // Get all datasets from the importable namespace to match against
    const datasets = await db.query(
        `SELECT id, name FROM datasets WHERE namespace='owid' ORDER BY name ASC`
    )

    // Get a unique list of all entities in the database (probably this won't scale indefinitely)
    const existingEntities = (await db.query(`SELECT name FROM entities`)).map(
        (e: any) => e.name
    )

    return { datasets: datasets, existingEntities: existingEntities }
})

apiRouter.get("/importData/datasets/:datasetId.json", async req => {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.get(
        `
        SELECT d.id, d.namespace, d.name, d.description, d.updatedAt
        FROM datasets AS d
        WHERE d.id = ?
    `,
        [datasetId]
    )

    if (!dataset) {
        throw new JsonError(`No dataset by id '${datasetId}'`, 404)
    }

    const variables = await db.query(
        `
        SELECT v.id, v.name
        FROM variables AS v
        WHERE v.datasetId = ?
    `,
        [datasetId]
    )

    dataset.variables = variables

    return { dataset: dataset }
})

// Currently unused, may be useful later
/*api.post('/importValidate', async req => {
    const entities: string[] = req.body.entities

    // https://stackoverflow.com/questions/440615/best-way-to-check-that-a-list-of-items-exists-in-an-sql-database-column
    return db.transaction(async t => {
        await t.execute(`CREATE TEMPORARY TABLE entitiesToCheck (name VARCHAR(255))`)
        await t.execute(`INSERT INTO entitiesToCheck VALUES ${Array(entities.length).fill("(?)").join(",")}`, entities)

        const rows = await t.query(`
            SELECT ec.name FROM entitiesToCheck ec LEFT OUTER JOIN entities e ON ec.name = e.name WHERE e.name IS NULL
        `)

        await t.execute(`DROP TEMPORARY TABLE entitiesToCheck`)

        return { unknownEntities: rows.map((e: any) => e.name) }
    })
})*/

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

    const newDatasetId = await db.transaction(async t => {
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
                true
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
        const importEntityRows = entitiesUniq.map(e => [e, false, now, now, ""])
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
            (v: any) => !variables.some(v2 => v2.overwriteId === v.id)
        )
        const removingVariableIds = removingVariables.map(
            (v: any) => v.id
        ) as number[]
        if (removingVariableIds.length) {
            await t.execute(`DELETE FROM data_values WHERE variableId IN (?)`, [
                removingVariableIds
            ])
            await t.execute(`DELETE FROM variables WHERE id IN (?)`, [
                removingVariableIds
            ])
        }

        // Overwrite old variables and insert new variables
        for (const variable of variables) {
            let variableId: number
            if (variable.overwriteId) {
                // Remove any existing data values
                await t.execute(`DELETE FROM data_values WHERE variableId=?`, [
                    variable.overwriteId
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
                    "{}"
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
                        variableId
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
    const source = await db.get(
        `
        SELECT s.id, s.name, s.description, s.createdAt, s.updatedAt, d.namespace
        FROM sources AS s
        JOIN datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`,
        [sourceId]
    )
    source.description = JSON.parse(source.description)
    source.variables = await db.query(
        `SELECT id, name, updatedAt FROM variables WHERE variables.sourceId=?`,
        [sourceId]
    )

    return { source: source }
})

addExplorerApiRoutes(apiRouter)
addGitCmsApiRoutes(apiRouter)

// Legacy code, preventing modification, just in case
//
// api.put('/sources/:sourceId', async (req: Request) => {
//     const sourceId = expectInt(req.params.sourceId)
//     const source = (req.body as { source: any }).source
//     await db.execute(`UPDATE sources SET name=?, description=? WHERE id=?`, [source.name, JSON.stringify(source.description), sourceId])
//     return { success: true }
// })

export { apiRouter }
