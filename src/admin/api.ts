import * as db from '../db'
import {getVariableData} from '../models/Variable'
import { ChartConfigProps } from '../../js/charts/ChartConfig'
import * as _ from 'lodash'
import {Request, Response, User} from './authentication'
import {Express} from 'express'
import {JsonError, expectInt} from './serverUtil'

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

async function expectChartById(chartId: number): Promise<ChartConfigProps> {
    const chart = await getChartById(chartId)

    if (chart) {
        return chart
    } else {
        throw new JsonError(`No chart found for id ${chartId}`, 404)
    }
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
            await db.query(`UPDATE charts SET config=?, updated_at=?, last_edited_at=?, last_edited_by=? WHERE id = ? `, [JSON.stringify(newConfig), now, now, user.name, chartId])
        } else {
            const result = await db.query(`INSERT INTO charts (config, created_at, updated_at, last_edited_at, last_edited_by, starred) VALUES (?)`, [[JSON.stringify(newConfig), now, now, now, user.name, false]])
            chartId = result.insertId
        }

        if (newConfig.isPublished && (!existingConfig || !existingConfig.isPublished)) {
            // Newly published, set publication info
            await db.query(`UPDATE charts SET published_at=?, published_by=? WHERE id = ? `, [now, user.name, chartId])
        }

        // Store dimensions
        // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json

        await db.query(`DELETE FROM chart_dimensions WHERE chartId=?`, [chartId])

        for (let i = 0; i < newConfig.dimensions.length; i++) {
            const dim = newConfig.dimensions[i]
            await db.query(`INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?)`, [[chartId, dim.variableId, dim.property, i]])

            if (dim.saveToVariable) {
                const display = JSON.parse((await db.query(`SELECT display FROM variables WHERE id=?`, [dim.variableId]))[0].display)

                for (const key in dim.display) {
                    display[key] = (dim as any)[key]
                }

                await db.query(`UPDATE variables SET display=? WHERE id=?`, [JSON.stringify(display), dim.variableId])
            }
        }

        return chartId
    })
}

// Retrieve list of charts and their associated variables, for the admin index page
export async function chartsIndex(req: Request, res: Response) {
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

    return {
        charts: charts,
        numTotalCharts: numTotalCharts
    }
}

export async function chartsConfig(req: Request, res: Response) {
    return await expectChartById(req.params.chartId)
}

export async function editorNamespaces(req: Request, res: Response) {
    const rows = await db.query(`SELECT DISTINCT namespace FROM datasets`) as any[]

    return {
        namespaces: rows.map(row => row.namespace)
    }
}

export async function editorDataForNamespace(req: Request, res: Response) {
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

    return { datasets: datasets }
}

export async function variablesGetData(req: Request, res: Response) {
    const variableIds: number[] = req.params.variableStr.split("+").map((v: string) => parseInt(v))
    return await getVariableData(variableIds)
}

// Mark a chart for display on the front page
export async function chartsStar(req: Request, res: Response) {
    db.query(`UPDATE charts SET starred=(charts.id=?)`, req.params.chartId)

    //Chart.bake(request.user, chart.slug)

    return { success: true }
}

export async function chartsCreate(req: Request, res: Response) {
    const chartId = await saveChart(res.locals.user, req.body)
    return { success: true, chartId: chartId }
}

export async function chartsUpdate(req: Request, res: Response) {
    const existingConfig = await expectChartById(req.params.chartId)
    await saveChart(res.locals.user, req.body, existingConfig)

    // bake

    return { success: true, chartId: existingConfig.id }
}

export async function chartsDelete(req: Request, res: Response) {
    await db.transaction(async () => {
        await db.query(`DELETE FROM chart_dimensions WHERE chartId=?`, [req.params.chartId])
        await db.query(`DELETE FROM chart_slug_redirects WHERE chart_id=?`, [req.params.chartId])
        await db.query(`DELETE FROM charts WHERE id=?`, [req.params.chartId])
    })

    // bake

    return { success: true }
}

export interface UserIndexMeta {
    id: number
    name: string
    fullName: string
    createdAt: Date
    updatedAt: Date
    isActive: boolean
}

export async function usersIndex(req: Request, res: Response): Promise<{ users: UserIndexMeta[] }> {
    const rows = await db.query(`SELECT id, email, full_name as fullName, name, created_at as createdAt, updated_at as updatedAt, is_active as isActive FROM users`)
    return { users: rows }
}

export async function usersGet(req: Request, res: Response): Promise<{ user: UserIndexMeta }> {
    const rows = await db.query(`SELECT id, email, full_name as fullName, name, created_at as createdAt, updated_at as updatedAt, is_active as isActive FROM users WHERE id=?`, [req.params.userId])

    if (rows.length)
        return { user: rows[0] }
    else
        throw new JsonError("No such user", 404)
}

export async function usersDelete(req: Request, res: Response) {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    await db.transaction(async () => {
        await db.query(`DELETE FROM user_invitations WHERE user_id=?`, req.params.userId)
        await db.query(`DELETE FROM users WHERE id=?`, req.params.userId)
    })

    return { success: true }
}

export async function usersUpdate(req: Request, res: Response) {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    await db.query(`UPDATE users SET full_name=?, is_active=? WHERE id=?`, [req.body.fullName, req.body.isActive, req.params.userId])
    return { success: true }
}

export async function usersInvite(req: Request, res: Response) {
    if (!res.locals.user.isSuperuser) {
        throw new JsonError("Permission denied", 403)
    }

    // TODO
}

export interface VariableSingleMeta {
    id: number
    unit: string
    shortUnit: string
    description: string

    datasetId: number
    datasetName: string
    datasetNamespace: string

    vardata: string
}

export async function variablesGet(req: Request, res: Response): Promise<{ variable: VariableSingleMeta }> {
    const variableId = expectInt(req.params.variableId)

    const variable =(await db.query(`
        SELECT v.id, v.unit, v.short_unit AS shortUnit, v.description, v.sourceId, v.uploaded_by AS uploadedBy,
               d.id AS datasetId, d.name AS datasetName, d.namespace AS datasetNamespace
        FROM variables AS v
        JOIN datasets AS d ON d.id = v.fk_dst_id
        WHERE v.id = ?
    `, [variableId]))[0]

    if (!variable) {
        throw new JsonError(`No variable by id '${variableId}'`, 404)
    }

    variable.vardata = await getVariableData([variableId])

    return variable
}