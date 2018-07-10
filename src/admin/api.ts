import * as express from 'express'
import {Express, Router} from 'express'
import * as _ from 'lodash'
import {spawn} from 'child_process'
import * as path from 'path'

import * as db from '../db'
import * as wpdb from '../articles/wpdb'
import {BASE_DIR, DB_NAME} from '../settings'
import {JsonError, expectInt, isValidSlug, shellEscape} from './serverUtil'
import Chart from '../model/Chart'
import {Request, Response, CurrentUser} from './authentication'
import {getVariableData} from '../model/Variable'
import { ChartConfigProps } from '../../js/charts/ChartConfig'

// Little wrapper to automatically send returned objects as JSON, makes
// the API code a bit cleaner
class FunctionalRouter {
    router: Router
    constructor() {
        this.router = Router()
        // Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
        this.router.use(express.json())
    }

    wrap(callback: (req: Request, res: Response) => Promise<any>) {
        return async (req: Request, res: Response) => {
            res.send(await callback(req, res))
        }
    }

    get(targetPath: string, callback: (req: Request, res: Response) => Promise<any>) {
        this.router.get(targetPath, this.wrap(callback))
    }

    post(targetPath: string, callback: (req: Request, res: Response) => Promise<any>) {
        this.router.post(targetPath, this.wrap(callback))
    }

    put(targetPath: string, callback: (req: Request, res: Response) => Promise<any>) {
        this.router.put(targetPath, this.wrap(callback))
    }

    delete(targetPath: string, callback: (req: Request, res: Response) => Promise<any>) {
        this.router.delete(targetPath, this.wrap(callback))
    }
}

const api = new FunctionalRouter()

// Call this to trigger build and deployment of static charts on change
async function triggerStaticBuild(user: CurrentUser, commitMessage: string) {
    const email = shellEscape(user.email)
    const name = shellEscape(user.fullName)
    const message = shellEscape(commitMessage)
    const bakeCharts = path.join(BASE_DIR, 'dist/src/bakeCharts.js')
    const cmd = `node ${bakeCharts} ${email} ${name} ${message} >> /tmp/${DB_NAME}-static.log 2>&1`
    const subprocess = spawn(cmd, [], { detached: true, stdio: 'ignore', shell: true })
    subprocess.unref()
}

async function getChartById(chartId: number): Promise<ChartConfigProps|undefined> {
    const chart = (await db.query(`SELECT id, config FROM charts WHERE id=?`, [chartId]))[0]

    if (chart) {
        const config = JSON.parse(chart.config)
        config.id = chart.id
        return config
    } else {
        return undefined
    }
}

async function expectChartById(chartId: any): Promise<ChartConfigProps> {
    const chart = await getChartById(expectInt(chartId))

    if (chart) {
        return chart
    } else {
        throw new JsonError(`No chart found for id ${chartId}`, 404)
    }
}

async function saveChart(user: CurrentUser, newConfig: ChartConfigProps, existingConfig?: ChartConfigProps) {
    return db.transaction(async t => {
        // Slugs need some special logic to ensure public urls remain consistent whenever possible
        async function isSlugUsedInRedirect() {
            const rows = await t.query(`SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`, [existingConfig ? existingConfig.id : undefined, newConfig.slug])
            return rows.length > 0
        }

        async function isSlugUsedInOtherChart() {
            const rows = await t.query(`SELECT * FROM charts WHERE id != ? AND JSON_EXTRACT(config, "$.isPublished") IS TRUE AND JSON_EXTRACT(config, "$.slug") = ?`, [existingConfig ? existingConfig.id : undefined, newConfig.slug])
            return rows.length > 0
        }

        // When a chart is published, or when the slug of a published chart changes, check for conflicts
        if (newConfig.isPublished && (!existingConfig || newConfig.slug !== existingConfig.slug)) {
            if (!isValidSlug(newConfig.slug)) {
                throw new JsonError(`Invalid chart slug ${newConfig.slug}`)
            } else if (await isSlugUsedInRedirect()) {
                throw new JsonError(`This chart slug was previously used by another chart: ${newConfig.slug}`)
            } else if (await isSlugUsedInOtherChart()) {
                throw new JsonError(`This chart slug is in use by another published chart: ${newConfig.slug}`)
            } else if (existingConfig && existingConfig.isPublished) {
                // Changing slug of an existing chart, delete any old redirect and create new one
                await t.execute(`DELETE FROM chart_slug_redirects WHERE chart_id = ? AND slug = ?`, [existingConfig.id, existingConfig.slug])
                await t.execute(`INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`, [existingConfig.id, existingConfig.slug])
            }
        }

        // Bump chart version, very important for cachebusting
        if (existingConfig)
            newConfig.version = existingConfig.version + 1
        else
            newConfig.version = 1

        // Execute the actual database update or creation
        const now = new Date()
        let chartId = existingConfig && existingConfig.id
        if (existingConfig) {
            await t.query(
                `UPDATE charts SET config=?, updated_at=?, last_edited_at=?, last_edited_by=? WHERE id = ?`,
                [JSON.stringify(newConfig), now, now, user.name, chartId]
            )
        } else {
            const result = await t.execute(
                `INSERT INTO charts (config, created_at, updated_at, last_edited_at, last_edited_by, starred) VALUES (?)`,
                [[JSON.stringify(newConfig), now, now, now, user.name, false]]
            )
            chartId = result.insertId
        }

        // Remove any old dimensions and store the new ones
        // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json
        await t.execute(`DELETE FROM chart_dimensions WHERE chartId=?`, [chartId])
        for (let i = 0; i < newConfig.dimensions.length; i++) {
            const dim = newConfig.dimensions[i]
            await t.execute(`INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?)`, [[chartId, dim.variableId, dim.property, i]])

            if (dim.saveToVariable) {
                const display = JSON.parse((await t.query(`SELECT display FROM variables WHERE id=?`, [dim.variableId]))[0].display)

                for (const key in dim.display) {
                    display[key] = (dim as any)[key]
                }

                await t.execute(`UPDATE variables SET display=? WHERE id=?`, [JSON.stringify(display), dim.variableId])
            }
        }

        console.log(newConfig.isPublished, existingConfig && existingConfig.isPublished)

        if (newConfig.isPublished && (!existingConfig || !existingConfig.isPublished)) {
            // Newly published, set publication info
            await t.execute(`UPDATE charts SET published_at=?, published_by=? WHERE id = ? `, [now, user.name, chartId])
            await triggerStaticBuild(user, `Publishing chart ${newConfig.slug}`)
        } else if (!newConfig.isPublished && existingConfig && existingConfig.isPublished) {
            // Unpublishing chart, delete any existing redirects to it
            await t.execute(`DELETE FROM chart_slug_redirects WHERE chart_id = ?`, [existingConfig.id])
            await triggerStaticBuild(user, `Unpublishing chart ${newConfig.slug}`)
        } else if (newConfig.isPublished) {
            await triggerStaticBuild(user, `Updating chart ${newConfig.slug}`)
        }

        return chartId
    })
}

api.get('/charts.json', async (req: Request, res: Response) => {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 10000
    const charts = await db.query(`
        SELECT ${Chart.listFields} FROM charts ORDER BY last_edited_at DESC LIMIT ?
    `, [limit])

    return {
        charts: charts
    }
})

api.get('/charts/:chartId.config.json', async (req: Request, res: Response) => {
    return expectChartById(req.params.chartId)
})

api.get('/editorData/namespaces.json', async (req: Request, res: Response) => {
    const rows = await db.query(`SELECT DISTINCT namespace FROM datasets`) as { namespace: string }[]

    return {
        namespaces: rows.map(row => row.namespace)
    }
})

api.get('/editorData/:namespace.json', async (req: Request, res: Response) => {
    const datasets = []
    const rows = await db.query(
        `SELECT v.name, v.id, d.name as datasetName, d.namespace
         FROM variables as v JOIN datasets as d ON v.datasetId = d.id
         WHERE namespace=? ORDER BY d.updated_at DESC`, [req.params.namespace])

    let dataset: { name: string, namespace: string, variables: { id: number, name: string }[] }|undefined
    for (const row of rows) {
        if (!dataset || row.datasetName !== dataset.name) {
            if (dataset)
                datasets.push(dataset)

            dataset = {
                name: row.datasetName,
                namespace: row.namespace,
                variables: []
            }
        }

        dataset.variables.push({
            id: row.id,
            name: row.name
        })
    }

    if (dataset)
        datasets.push(dataset)

    return { datasets: datasets }
})

api.get('/data/variables/:variableStr.json', async (req: Request, res: Response) => {
    const variableIds: number[] = req.params.variableStr.split("+").map((v: string) => parseInt(v))
    return getVariableData(variableIds)
})

// Mark a chart for display on the front page
api.post('/charts/:chartId/star', async (req: Request, res: Response) => {
    const chart = await expectChartById(req.params.chartId)

    await db.execute(`UPDATE charts SET starred=(charts.id=?)`, [chart.id])
    await triggerStaticBuild(res.locals.user, `Setting front page chart to ${chart.slug}`)

    return { success: true }
})

api.post('/charts', async (req: Request, res: Response) => {
    const chartId = await saveChart(res.locals.user, req.body)
    return { success: true, chartId: chartId }
})

api.put('/charts/:chartId', async (req: Request, res: Response) => {
    const existingConfig = await expectChartById(req.params.chartId)

    await saveChart(res.locals.user, req.body, existingConfig)

    return { success: true, chartId: existingConfig.id }
})

api.delete('/charts/:chartId', async (req: Request, res: Response) => {
    const chart = await expectChartById(req.params.chartId)

    await db.transaction(async t => {
        await t.execute(`DELETE FROM chart_dimensions WHERE chartId=?`, [chart.id])
        await t.execute(`DELETE FROM chart_slug_redirects WHERE chart_id=?`, [chart.id])
        await t.execute(`DELETE FROM charts WHERE id=?`, [chart.id])
    })

    if (chart.isPublished)
        await triggerStaticBuild(res.locals.user, `Deleting chart ${chart.slug}`)

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

api.get('/users.json', async (req: Request, res: Response) => {
    const rows = await db.query(`SELECT id, email, full_name as fullName, name, created_at as createdAt, updated_at as updatedAt, is_active as isActive FROM users`)
    return { users: rows as UserIndexMeta[] }
})

api.get('/users/:userId.json', async (req: Request, res: Response) => {
    const rows = await db.query(`SELECT id, email, full_name as fullName, name, created_at as createdAt, updated_at as updatedAt, is_active as isActive FROM users WHERE id=?`, [req.params.userId])

    if (rows.length)
        return { user: rows[0] as UserIndexMeta }
    else
        throw new JsonError("No such user", 404)
})

api.delete('/users/:userId', async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    await db.transaction(async t => {
        await t.execute(`DELETE FROM user_invitations WHERE user_id=?`, req.params.userId)
        await t.execute(`DELETE FROM users WHERE id=?`, req.params.userId)
    })

    return { success: true }
})

api.put('/users/:userId', async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    await db.execute(`UPDATE users SET full_name=?, is_active=? WHERE id=?`, [req.body.fullName, req.body.isActive, req.params.userId])
    return { success: true }
})

api.post('/users/invite', async (req: Request, res: Response) => {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    // TODO
})

api.get('/variables.json', async req => {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 50
    const searchStr = req.query.search

    const query = `
        SELECT v.id, v.name, v.uploaded_at AS uploadedAt, v.uploaded_by AS uploadedBy
        FROM variables AS v
        ${searchStr ? "WHERE v.name LIKE ?" : ""}
        ORDER BY v.uploaded_at DESC
        LIMIT ?
    `

    const rows = await db.query(query, searchStr ? [`%${searchStr}%`, limit] : [limit])

    const numTotalRows = (await db.query(`SELECT COUNT(*) as count FROM variables`))[0].count

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

api.get('/variables/:variableId.json', async (req: Request, res: Response) => {
    const variableId = expectInt(req.params.variableId)

    const variable = await db.get(`
        SELECT v.id, v.name, v.unit, v.short_unit AS shortUnit, v.description, v.sourceId, v.uploaded_by AS uploadedBy,
               v.display, d.id AS datasetId, d.name AS datasetName, d.namespace AS datasetNamespace
        FROM variables AS v
        JOIN datasets AS d ON d.id = v.datasetId
        WHERE v.id = ?
    `, [variableId])

    if (!variable) {
        throw new JsonError(`No variable by id '${variableId}'`, 404)
    }

    variable.display = JSON.parse(variable.display)

    variable.source = await db.get(`SELECT id, name FROM sources AS s WHERE id = ?`, variable.sourceId)

    const charts = await db.query(`
        SELECT ${Chart.listFields}
        FROM charts
        JOIN chart_dimensions AS cd ON cd.chartId = charts.id
        WHERE cd.variableId = ?
        GROUP BY charts.id
    `, [variableId])

    variable.charts = charts

    return { variable: variable as VariableSingleMeta }/*, vardata: await getVariableData([variableId]) }*/
})

api.put('/variables/:variableId', async (req: Request) => {
    const variableId = expectInt(req.params.variableId)
    const variable = (req.body as { variable: VariableSingleMeta }).variable

    await db.execute(`UPDATE variables SET name=?, unit=?, short_unit=?, description=?, updated_at=?, display=? WHERE id = ?`,
        [variable.name, variable.unit, variable.shortUnit, variable.description, new Date(), JSON.stringify(variable.display), variableId])
    return { success: true }
})

api.delete('/variables/:variableId', async (req: Request) => {
    const variableId = expectInt(req.params.variableId)

    const variable = await db.get(`SELECT datasets.namespace FROM variables JOIN datasets ON variables.datasetId=datasets.id WHERE variables.id=?`, [variableId])

    if (!variable) {
        throw new JsonError(`No variable by id ${variableId}`, 404)
    } else if (variable.namespace !== 'owid') {
        throw new JsonError(`Cannot delete bulk import variable`, 400)
    }

    await db.transaction(async t => {
        await t.execute(`DELETE FROM data_values WHERE variableId=?`, [variableId])
        await t.execute(`DELETE FROM variables WHERE id=?`, [variableId])
    })

    return { success: true }
})

api.get('/datasets.json', async req => {
    const rows = await db.query(`
        SELECT d.id, d.namespace, d.name, d.description, c.name AS categoryName, sc.name AS subcategoryName, d.created_at AS createdAt, d.updated_at AS updatedAt
        FROM datasets AS d
        LEFT JOIN dataset_categories AS c ON c.id=d.categoryId
        LEFT JOIN dataset_subcategories AS sc ON sc.id=d.subcategoryId
        ORDER BY d.created_at DESC
    `)
    /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

    return { datasets: rows }
})

api.get('/datasets/:datasetId.json', async (req: Request) => {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.get(`
        SELECT d.id, d.namespace, d.name, d.description, d.subcategoryId, d.updated_at AS updatedAt
        FROM datasets AS d
        WHERE d.id = ?
    `, [datasetId])

    if (!dataset) {
        throw new JsonError(`No dataset by id '${datasetId}'`, 404)
    }

    const variables = await db.query(`
        SELECT v.id, v.name, v.uploaded_at AS uploadedAt, v.uploaded_by AS uploadedBy
        FROM variables AS v
        WHERE v.datasetId = ?
    `, [datasetId])

    dataset.variables = variables

    const sources = await db.query(`
        SELECT s.id, s.name
        FROM sources AS s
        WHERE s.datasetId = ?
    `, [datasetId])

    dataset.sources = sources

    const charts = await db.query(`
        SELECT ${Chart.listFields}
        FROM charts
        JOIN chart_dimensions AS cd ON cd.chartId = charts.id
        JOIN variables AS v ON cd.variableId = v.id
        WHERE v.datasetId = ?
        GROUP BY charts.id
    `, [datasetId])

    dataset.charts = charts

    const availableCategories = await db.query(`
        SELECT sc.id, sc.name, c.name AS parentName, c.fetcher_autocreated AS isAutocreated
        FROM dataset_subcategories AS sc
        JOIN dataset_categories AS c ON sc.categoryId=c.id
    `)

    dataset.availableCategories = availableCategories

    return { dataset: dataset }
})

api.put('/datasets/:datasetId', async (req: Request) => {
    const datasetId = expectInt(req.params.datasetId)
    const dataset = (req.body as { dataset: any }).dataset
    await db.execute(`UPDATE datasets SET name=?, description=?, subcategoryId=? WHERE id=?`, [dataset.name, dataset.description, dataset.subcategoryId, datasetId])
    return { success: true }
})

api.delete('/datasets/:datasetId', async (req: Request) => {
    const datasetId = expectInt(req.params.datasetId)
    await db.transaction(async t => {
        await t.execute(`DELETE d FROM data_values AS d JOIN variables AS v ON d.variableId=v.id WHERE v.datasetId=?`, [datasetId])
        await t.execute(`DELETE FROM variables WHERE datasetId=?`, [datasetId])
        await t.execute(`DELETE FROM sources WHERE datasetId=?`, [datasetId])
        await t.execute(`DELETE FROM datasets WHERE id=?`, [datasetId])
    })

    return { success: true }
})

api.get('/sources/:sourceId.json', async (req: Request) => {
    const sourceId = expectInt(req.params.sourceId)
    const source = await db.get(`
        SELECT s.id, s.name, s.description, s.created_at AS createdAt, s.updated_at AS updatedAt, d.namespace AS namespace
        FROM sources AS s
        JOIN datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`, [sourceId])
    source.description = JSON.parse(source.description)
    source.variables = await db.query(`SELECT id, name, uploaded_at AS uploadedAt FROM variables WHERE variables.sourceId=?`, [sourceId])

    return { source: source }
})

api.put('/sources/:sourceId', async (req: Request) => {
    const sourceId = expectInt(req.params.sourceId)
    const source = (req.body as { source: any }).source
    await db.execute(`UPDATE sources SET name=?, description=? WHERE id=?`, [source.name, JSON.stringify(source.description), sourceId])
    return { success: true }
})

// Get a list of redirects that map old slugs to charts
api.get('/redirects.json', async (req: Request, res: Response) => {
    const redirects = await db.query(`
        SELECT r.id, r.slug, r.chart_id as chartId, JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS chartSlug
        FROM chart_slug_redirects AS r JOIN charts ON charts.id = r.chart_id
        ORDER BY r.id DESC`)

    return {
        redirects: redirects
    }
})

api.delete('/redirects/:id', async (req: Request, res: Response) => {
    const id = expectInt(req.params.id)

    const redirect = await db.get(`SELECT * FROM chart_slug_redirects WHERE id = ?`, [id])

    if (!redirect) {
        throw new JsonError(`No redirect found for id ${id}`, 404)
    }

    await db.execute(`DELETE FROM chart_slug_redirects WHERE id=?`, [id])
    await triggerStaticBuild(res.locals.user, `Deleting redirect from ${redirect.slug}`)

    return { success: true }
})

api.get('/posts.json', async req => {
    const rows = await wpdb.query(`
        SELECT ID AS id, post_title AS title, post_modified_gmt AS updatedAt, post_type AS type, post_status AS status
        FROM wp_posts 
        WHERE (post_type='post' OR post_type='page') 
            AND (post_status='publish' OR post_status='pending' OR post_status='private' OR post_status='draft') 
        ORDER BY post_modified DESC`)
    
    const authorship = await wpdb.getAuthorship()

    for (const post of rows) {
        post.authors = authorship.get(post.id)||[]
    }

    return { posts: rows }
})

export default api