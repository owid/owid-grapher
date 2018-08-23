import * as express from 'express'
import {Express, Router} from 'express'
import * as _ from 'lodash'
import {spawn} from 'child_process'
import * as path from 'path'
import * as querystring from 'querystring'
import {getConnection} from 'typeorm'

import * as db from '../db'
import * as wpdb from '../articles/wpdb'
import {BASE_DIR, DB_NAME} from '../settings'
import {JsonError, expectInt, isValidSlug, shellEscape, absoluteUrl} from './serverUtil'
import {sendMail} from '../mail'
import OldChart, {Chart} from '../model/Chart'
import UserInvitation from '../model/UserInvitation'
import {Request, Response, CurrentUser} from './authentication'
import {getVariableData} from '../model/Variable'
import { ChartConfigProps } from '../../js/charts/ChartConfig'
import CountryNameFormat, { CountryDefByKey } from '../../js/standardizer/CountryNameFormat'

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
        SELECT ${OldChart.listFields} FROM charts ORDER BY last_edited_at DESC LIMIT ?
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

api.get('/countries.json', async (req: Request, res: Response) => {
    let rows = []

    const input = req.query.input
    const output = req.query.output

    if (input === CountryNameFormat.NonStandardCountryName) {
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.query(`
            SELECT country_name as input, ` + outputColumn + ` as output
            FROM country_name_tool_countryname ccn
            LEFT JOIN country_name_tool_countrydata ccd on ccn.owid_country = ccd.id
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`)
    } else {
        const inputColumn = CountryDefByKey[input].column_name
        const outputColumn = CountryDefByKey[output].column_name

        rows = await db.query(
            `SELECT ` + inputColumn + ` as input, ` + outputColumn + ` as output
            FROM country_name_tool_countrydata ccd
            LEFT JOIN country_name_tool_continent con on con.id = ccd.continent`)
    }

    return {
        countries: rows
    }
})

api.post('/countries', async (req: Request, res: Response) => {
    const countries = req.body.countries

    const mapOwidNameToId: any = {}
    let owidRows = []

    // find owid ID
    const owidNames = Object.keys(countries).map(key => countries[key])
    owidRows = await db.query(
        `SELECT id, owid_name
        FROM country_name_tool_countrydata
        WHERE owid_name in (?)
        `, [owidNames])
    for (const row of owidRows) {
        mapOwidNameToId[row.owid_name] = row.id
    }

    // insert one by one (ideally do a bulk insert)
    for (const country of Object.keys(countries)) {
        const owidName = countries[country]

        console.log("adding " + country + ", " + mapOwidNameToId[owidName] + ", " + owidName)
        await db.execute(
            `INSERT INTO country_name_tool_countryname (country_name, owid_country)
            VALUES (?, ?)`, [country, mapOwidNameToId[owidName]])
    }

    return { success: true }
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

    const {email} = req.body

    await getConnection().transaction(async manager => {
        // Remove any previous invites for this email address to avoid duplicate accounts
        const repo = manager.getRepository(UserInvitation)
        await repo.createQueryBuilder().where(`email = :email`, {email}).delete().execute()

        const invite = new UserInvitation()
        invite.email = email
        invite.code = UserInvitation.makeInviteCode()
        invite.validTill = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        invite.created_at = new Date()
        invite.updated_at = new Date()
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
        SELECT ${OldChart.listFields}
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
        SELECT d.id, d.namespace, d.name, d.description, d.subcategoryId, d.updated_at AS updatedAt, d.isPrivate
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
        SELECT ${OldChart.listFields}
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
    await db.execute(`UPDATE datasets SET name=?, description=?, subcategoryId=?, isPrivate=? WHERE id=?`, [dataset.name, dataset.description, dataset.subcategoryId, dataset.isPrivate, datasetId])
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

api.get('/importData.json', async req => {
    // Get all datasets from the importable namespace to match against
    const datasets = await db.query(`SELECT id, name FROM datasets WHERE namespace='owid' ORDER BY name ASC`)

    // Get subcategories with their parent information as a single list
    const categories = await db.query(`
        SELECT sc.name, sc.id, c.name AS parent from dataset_subcategories sc
        JOIN dataset_categories c WHERE c.fetcher_autocreated IS FALSE
        ORDER BY c.id ASC, sc.id ASC
    `)

    // Get a unique list of all entities in the database (probably this won't scale indefinitely)
    const existingEntities = (await db.query(`SELECT name FROM entities`)).map((e: any) => e.name)

    return { datasets: datasets, categories: categories, existingEntities: existingEntities }
})

api.get('/importData/datasets/:datasetId.json', async req => {
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

/*

def store_import_data(request: HttpRequest):
    if request.method == 'POST':
        try:
            with transaction.atomic():
                data = json.loads(request.body.decode('utf-8'))
                datasetmeta = data['dataset']
                entities = data['entities']
                entitynames = data['entityNames']
                years = data['years']
                variables = data['variables']

                datasetprops = {'name': datasetmeta['name'],
                                'description': datasetmeta['description'],
                                'categoryId': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId']).categoryId,
                                'subcategoryId': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId'])
                                }

                if datasetmeta['id']:
                    dataset = Dataset.objects.get(pk=datasetmeta['id'])
                    dataset_old_name = dataset.name  # needed for version tracking csv export
                    Dataset.objects.filter(pk=datasetmeta['id']).update(updated_at=timezone.now(), **datasetprops)
                else:
                    dataset = Dataset(**datasetprops)
                    dataset_old_name = None
                    dataset.save()

                dataset_id = dataset.pk

                codes = Entity.objects.filter(validated=True).values('name', 'code')

                codes_dict = {}

                for each in codes:
                    codes_dict[each['code']] = each['name']

                entitynames_list = Entity.objects.values_list('name', flat=True)

                for i in range(0, len(entitynames)):
                    name = entitynames[i]
                    if codes_dict.get(name, 0):
                        entitynames[i] = codes_dict[name]

                entitynames_to_insert = []

                for each in entitynames:
                    if each not in entitynames_list:
                        entitynames_to_insert.append(each)

                alist = [Entity(name=val, validated=False) for val in entitynames_to_insert]

                Entity.objects.bulk_create(alist)

                codes = Entity.objects.values('name', 'id')

                entitiy_name_to_id = {}

                for each in codes:
                    entitiy_name_to_id[each['name']] = each['id']

                source_ids_by_name: Dict[str, str] = {}

                for variable in variables:
                    source_name = variable['source']['name']
                    if source_ids_by_name.get(source_name, 0):
                        source_id = source_ids_by_name[source_name]
                    else:
                        if variable['source']['id']:
                            source_id = variable['source']['id']
                        else:
                            source_id = None
                        source_desc = {
                            'dataPublishedBy': None if not variable['source']['dataPublishedBy'] else variable['source']['dataPublishedBy'],
                            'dataPublisherSource': None if not variable['source']['dataPublisherSource'] else variable['source']['dataPublisherSource'],
                            'link': None if not variable['source']['link'] else variable['source']['link'],
                            'retrievedDate': None if not variable['source']['retrievedDate'] else variable['source']['retrievedDate'],
                            'additionalInfo': None if not variable['source']['additionalInfo'] else variable['source']['additionalInfo']
                        }
                        if source_id:
                            existing_source = Source.objects.get(pk=source_id)
                            existing_source.name = variable['source']['name']
                            existing_source.updated_at = timezone.now()
                            existing_source.description = json.dumps(source_desc)
                            existing_source.save()
                        else:
                            new_source = Source(datasetId=dataset_id, name=source_name, description=json.dumps(source_desc))
                            new_source.save()
                            source_id = new_source.pk
                            source_ids_by_name[source_name] = source_id

                    values = variable['values']
                    variableprops = {'name': variable['name'], 'description': variable['description'], 'unit': variable['unit'],
                                     'coverage': variable['coverage'], 'timespan': variable['timespan'],
                                     'variableTypeId': VariableType.objects.get(pk=3),
                                     'datasetId': Dataset.objects.get(pk=dataset_id),
                                     'sourceId': Source.objects.get(pk=source_id),
                                     'uploaded_at': timezone.now(),
                                     'updated_at': timezone.now(),
                                     'uploaded_by': request.user
                                     }
                    if variable['overwriteId']:
                        Variable.objects.filter(pk=variable['overwriteId']).update(**variableprops)
                        varid = variable['overwriteId']
                    else:
                        varid = Variable(**variableprops)
                        varid.save()
                        varid = varid.pk
                    while DataValue.objects.filter(variableId__pk=varid).first():
                        with connection.cursor() as c:
                            c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                      (DataValue._meta.db_table, varid))
                            # the LIMIT is here so that the database doesn't try to delete a large number of values at
                            # once and becomes unresponsive

                    insert_string = 'INSERT into data_values (value, year, entityId, variableId) VALUES (%s, %s, %s, %s)'
                    data_values_tuple_list = []
                    for i in range(0, len(years)):
                        if values[i] == '':
                            continue
                        data_values_tuple_list.append((values[i], years[i],
                                                       entitiy_name_to_id[entitynames[entities[i]]],
                                                       varid))

                        if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                            with connection.cursor() as dbconnection:
                                dbconnection.executemany(insert_string, data_values_tuple_list)
                            data_values_tuple_list = []

                    if len(data_values_tuple_list):  # insert any leftover data_values
                        with connection.cursor() as dbconnection:
                            dbconnection.executemany(insert_string, data_values_tuple_list)
                    with connection.cursor() as cursor:
                        cursor.execute("DELETE FROM sources WHERE sources.id NOT IN (SELECT variables.sourceId FROM variables)")

                write_dataset_csv(dataset.pk, datasetprops['name'],
                                  dataset_old_name, request.user.get_full_name(), request.user.email)

                return JsonResponse({'datasetId': dataset_id}, safe=False)
        except Exception as e:
            if len(e.args) > 1:
                error_m = str(e.args[0]) + ' ' + str(e.args[1])
            else:
                error_m = e.args[0]
            return HttpResponse(error_m, status=500)*/

interface ImportPostData {
    dataset: {
        id?: number,
        name: string
    },
    entities: string[],
    years: number[],
    variables: {
        name: string,
        overwriteId?: number,
        values: string[]
    }[]
}

api.post('/importDataset', async (req: Request, res: Response) => {
    return db.transaction(async t => {
        const {dataset, entities, years, variables} = req.body as ImportPostData
        const now = new Date()

        let datasetId: number
        if (dataset.id) {
            // Updating existing dataset
            datasetId = dataset.id
        } else {
            // Creating new dataset
            const row = [dataset.name, "owid", "", now, now, 19, 375] // Initially uncategorized
            const datasetResult = await t.execute(`INSERT INTO datasets (name, namespace, description, created_at, updated_at, categoryId, subcategoryId) VALUES (?)`, [row])
            datasetId = datasetResult.insertId
        }

        // Find or create the dataset source
        // TODO probably merge source info into dataset table
        let sourceId: number|undefined
        if (datasetId) {
            // Use first source (if any)
            const rows = await t.query(`SELECT id FROM sources WHERE datasetId=? ORDER BY id ASC LIMIT 1`, [datasetId])
            if (rows[0])
                sourceId = rows[0].id
        }

        if (!sourceId) {
            // Insert default source
            const sourceRow = [dataset.name, "{}", now, now, datasetId]
            const sourceResult = await t.execute(`INSERT INTO sources (name, description, created_at, updated_at, datasetId) VALUES (?)`, [sourceRow])
            sourceId = sourceResult.insertId
        }

        // Insert any new entities into the db
        const entitiesUniq = _.uniq(entities)
        const importEntityRows = entitiesUniq.map(e => [e, false, now, now, ""])
        await t.execute(`INSERT IGNORE entities (name, validated, created_at, updated_at, displayName) VALUES ?`, [importEntityRows])

        // Map entities to entityIds
        const entityRows = await t.query(`SELECT id, name FROM entities WHERE name IN (?)`, [entitiesUniq])
        const entityIdLookup: {[key: string]: number} = {}
        for (const row of entityRows) {
            entityIdLookup[row.name] = row.id
        }

        for (const variable of variables) {
            let variableId: number
            if (variable.overwriteId) {
                // Remove any existing data values
                await t.execute(`DELETE FROM data_values WHERE variableId=?`, [variable.overwriteId])

                variableId = variable.overwriteId
            } else {
                const variableRow = [variable.name, datasetId, sourceId, now, now, now, res.locals.user.name, "", "", "", 3, "{}"]

                // Create a new variable
                // TODO migrate to clean up these fields
                const result = await t.execute(`INSERT INTO variables (name, datasetId, sourceId, created_at, updated_at, uploaded_at, uploaded_by, unit, coverage, timespan, variableTypeId, display) VALUES (?)`, [variableRow])
                variableId = result.insertId
            }

            // Insert new data values
            const valueRows = variable.values.map((value, i) =>
                [value, years[i], entityIdLookup[entities[i]], variableId]
            )
            await t.execute(`INSERT INTO data_values (value, year, entityId, variableId) VALUES ?`, [valueRows])
        }

        return { success: true, datasetId: datasetId }
    })
})

export default api
