import * as db from '../db'
import {getVariableData} from '../models/Variable'
import { ChartConfigProps } from '../../js/charts/ChartConfig'
import * as _ from 'lodash'
import {Request, Response, User} from './authentication'

function jsonError(res: Response, message: string, code?: number) {
    code = code || 400
    res.status(code).send({
        error: {
            code: code,
            message: message
        }
    })
}

class JsonError extends Error {
    code: number
    constructor(message: string, code?: number) {
        super(message)
        this.code = code || 400
    }
}

// Retrieve list of charts and their associated variables, for the admin index page
export async function getChartsJson(req: Request, res: Response) {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 10000
    const charts = await db.query(`
        SELECT
            id,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.title")) AS title,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.type")) AS type,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.internalNotes")) AS internalNotes,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.isPublished")) AS isPublished,
            JSON_UNQUOTE(JSON_EXTRACT(config, "$.tab")) AS tab,
            JSON_EXTRACT(config, "$.hasChartTab") = true AS hasChartTab,
            JSON_EXTRACT(config, "$.hasMapTab") = true AS hasMapTab,
            starred AS isStarred,
            last_edited_at AS lastEditedAt,
            last_edited_by AS lastEditedBy,
            published_at AS publishedAt,
            published_by AS publishedBy
        FROM charts ORDER BY last_edited_at DESC LIMIT ?
    `, [limit]) as any[]

    const chartIds = charts.map(row => row.id)

    const variableRows = await db.query(`
        SELECT dims.chartId, v.id as variableId, v.name as variableName
        FROM chart_dimensions AS dims
        JOIN variables AS v ON v.id=dims.variableId WHERE dims.chartId IN (?)
    `, [chartIds])

    const variablesByChartId = new Map<number, { id: number, name: string }[]>()
    for (const row of variableRows) {
        const variables = variablesByChartId.get(row.chartId) || []
        variables.push({ id: row.variableId, name: row.variableName })
        variablesByChartId.set(row.chartId, variables)
    }

    for (const chart of charts) {
        chart.variables = variablesByChartId.get(chart.id) || []
    }

    const numTotalCharts = (await db.query(`SELECT COUNT(*) AS total FROM charts`))[0].total

    res.send({
        charts: charts,
        numTotalCharts: numTotalCharts
    })
}

export async function getChartConfig(req: Request, res: Response) {
    const chart = (await db.query(`SELECT id, config FROM charts WHERE id=?`, [req.params.chartId]))[0]

    if (chart) {
        const config = JSON.parse(chart.config)
        config.id = chart.id
        res.send(config)
    } else {
        jsonError(res, "No such chart", 404)
    }
}

export async function getNamespaces(req: Request, res: Response) {
    const rows = await db.query(`SELECT DISTINCT namespace FROM datasets`) as any[]

    res.send({
        namespaces: rows.map(row => row.namespace)
    })
}

export async function getNamespaceData(req: Request, res: Response) {
    const datasets = []
    const rows = await db.query(
        `SELECT v.name, v.id, d.name as datasetName, d.namespace
         FROM variables as v JOIN datasets as d ON v.fk_dst_id = d.id
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

    res.send({
        datasets: datasets
    })
}

export async function getVariables(req: Request, res: Response) {
    const variableIds: number[] = req.params.variableStr.split("+").map((v: string) => parseInt(v))
    res.send(await getVariableData(variableIds))
}

// Mark a chart for display on the front page
export async function starChart(req: Request, res: Response) {
    db.query(`UPDATE charts SET starred=(charts.id=?)`, req.params.chartId)

    //Chart.bake(request.user, chart.slug)

    res.send({ success: true })
}

function isValidSlug(slug: any) {
    return _.isString(slug) && slug.length > 1 && slug.match(/^[\w-]+$/)
}

async function saveChart(user: User, newConfig: ChartConfigProps, existingConfig?: ChartConfigProps) {
    return await db.transaction(async () => {
        async function isSlugUsedInRedirect() {
            const rows = await db.query(`SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`, [existingConfig ? existingConfig.id : undefined, newConfig.slug])
            return rows.length > 0
        }

        async function isSlugUsedInOtherChart() {
            const rows = await db.query(`SELECT * FROM charts WHERE JSON_EXTRACT(config, "$.isPublished") IS TRUE AND JSON_EXTRACT(config, "$.slug") = ?`, [existingConfig ? existingConfig.id : undefined, newConfig.slug])
            return rows.length > 0
        }

        if (newConfig.isPublished && (!existingConfig || newConfig.slug !== existingConfig.slug)) {
            if (!isValidSlug(newConfig.slug)) {
                throw new JsonError(`Invalid chart slug ${newConfig.slug}`)
            } else if (await isSlugUsedInRedirect()) {
                throw new JsonError(`This chart slug was previously used by another chart: ${newConfig.slug}`)
            } else if (await isSlugUsedInOtherChart()) {
                throw new JsonError(`This chart slug is in use by another published chart: ${newConfig.slug}`)
            } else if (existingConfig && existingConfig.isPublished) {
                // Changing slug of an existing chart, create redirect
                await db.query(`INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`, [existingConfig.id, existingConfig.slug])
            }
        }

        // Bump chart version
        if (existingConfig)
            newConfig.version = existingConfig.version + 1
        else
            newConfig.version = 1

        const now = new Date()
        let chartId = existingConfig && existingConfig.id
        if (existingConfig) {
            await db.query(`UPDATE charts WHERE id = ? SET config=?, updated_at=?, last_edited_at=?, last_edited_by=?`, [chartId, newConfig, now, now, user.name])
        } else {
            const result = await db.query(`INSERT INTO charts (config, updated_at, last_edited_at, last_edited_by) VALUES (?)`, [[newConfig, now, now, user.name]])
            chartId = result.insertId
        }

        if (newConfig.isPublished && (!existingConfig || !existingConfig.isPublished)) {
            // Newly published, set publication info
            await db.query(`UPDATE charts WHERE id = ? SET published_at=?, published_by=?`, [chartId, now, user.name])
        }

        return chartId
    })
}

export async function createChart(req: Request, res: Response) {
    const chartId = await saveChart(res.locals.user, req.body)
    res.send({ success: true, chartId: chartId })
}

export async function updateChart(req: Request, res: Response) {
    let existingConfig: ChartConfigProps|undefined
    const chart = (await db.query(`SELECT id, config FROM charts WHERE id=?`, [req.params.chartId]))[0]
    console.log(req.params.chartId)

    if (chart) {
        const config = JSON.parse(chart.config)
        config.id = chart.id
        existingConfig = config
    } else {
        jsonError(res, "No such chart", 404)
        return
    }

    const chartId = await saveChart(res.locals.user, req.body, existingConfig)
    res.send({ success: true, chartId: chartId })
}