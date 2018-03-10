import * as express from 'express'
import { db } from './database'
import { uniq } from 'lodash'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import * as async from 'async'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import AdminSPA from './AdminSPA'

const app = express()
app.use(express.json())

app.get('/grapher/admin/editorData.:cacheTag.json', (req, res) => {
    interface Dataset {
        name: string
        namespace: string
        variables: { name: string, id: number }[]
    }

    const datasets: Dataset[] = []

    db.query(`SELECT v.name, v.id, d.name as datasetName, d.namespace FROM variables as v JOIN datasets as d ON v.fk_dst_id = d.id ORDER BY d.id`, (err, rows) => {
        if (err) throw err

        let dataset: Dataset | undefined
        for (const row of rows) {
            if (!dataset || row.datasetName !== dataset.name) {
                if (dataset) datasets.push(dataset)
                dataset = { name: row.datasetName, namespace: row.namespace, variables: [] }
            }

            dataset.variables.push({ name: row.name, id: row.id })
        }

        res.json({
            datasets: datasets,
            namespaces: uniq(datasets.map(d => d.namespace))
        })
    })
})

app.get('/grapher/admin/charts/:chartId.config.json', (req, res) => {
    const { chartId } = req.params

    db.query(`SELECT * FROM charts WHERE id=?`, chartId, (err, rows) => {
        if (err) throw err

        if (rows.length === 0) {
            res.status(404).send(`No chart found for id ${chartId}`)
            return
        }

        const row = rows[0]
        const config = JSON.parse(row.config)

        res.json(config)
        //        config['logosSVG'] = [LOGO]
        //        config.variableCacheTag = cacheTag
    })
})

app.get('/grapher/data/variables/:variableIds', (req, res) => {
    const variableIds: number[] = req.params.variableIds.split("+").map((s: string) => parseInt(s))
    const meta: any = { variables: {} }

    const variableQuery = `
        SELECT v.*, v.short_unit as shortUnit, d.name as datasetName, s.id as s_id, s.name as s_name, s.description as s_description FROM variables as v
            JOIN datasets as d ON v.fk_dst_id = d.id
            JOIN sources as s on v.sourceId = s.id
            WHERE v.id IN (?)
    `

    db.query(variableQuery, variableIds, (err, variables) => {
        if (err) throw err

        for (const row of variables) {
            row.shortUnit = row.short_unit; delete row.short_unit
            const sourceDescription = JSON.parse(row.s_description); delete row.s_description
            row.source = {
                id: row.s_id,
                name: row.s_name,
                dataPublishedBy: sourceDescription.dataPublishedBy || "",
                dataPublisherSource: sourceDescription.dataPublisherSource || "",
                link: sourceDescription.link || "",
                retrievedData: sourceDescription.retrievedData || "",
                additionalInfo: sourceDescription.additionalInfo || ""
            }
            meta.variables[row.id] = row
        }

        const dataQuery = `
            SELECT value, year, variableId as variableId, entities.id as entityId,
            entities.name as entityName, entities.code as entityCode
            FROM data_values
            LEFT JOIN entities ON data_values.entityId = entities.id
            WHERE data_values.variableId IN (?)
            ORDER BY variableId ASC, year ASC
        `

        db.query(dataQuery, variableIds, (err, results) => {
            if (err) throw err

            res.write(JSON.stringify(meta))

            const entityKey: { [entityId: number]: { name: string, code: string } | undefined } = {}
            const seenVariables: { [variableId: number]: true | undefined } = {}

            for (const row of results) {
                if (seenVariables[row.variableId] === undefined) {
                    seenVariables[row.variableId] = true
                    res.write("\r\n")
                    res.write(row.variableId.toString())
                }

                res.write(`;${row.year},${row.entityId},${row.value}`)

                if (entityKey[row.entityId] === undefined) {
                    entityKey[row.entityId] = { name: row.entityName, code: row.entityCode }
                }
            }

            res.write("\r\n")
            res.write(JSON.stringify(entityKey))
            res.end()
        })
    })
})

app.put('/grapher/admin/charts/:chartId', (req, res) => {
    const chart = req.body as ChartConfigProps

    function doSave() {

    }

    if (chart.isPublished) {
        const check1 = (callback: (good: boolean) => void) => {
            db.query("SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?", [chart.id, chart.slug], (err, rows) => {
                if (err) throw err
                if (rows.length > 0) {
                    res.status(402).send(`This chart slug was previously used by another chart: ${chart.slug}`)
                    callback(false)
                } else {
                    callback(true)
                }
            })
        }

        const check2 = (callback: (good: boolean) => void) => {
            db.query(`SELECT * FROM charts WHERE id != ? AND config->"$.slug" = ? AND config->"$.isPublished" IS TRUE`, [chart.id, chart.slug], (err, rows) => {
                if (err) throw err
                if (rows.length > 0) {
                    res.status(402).send(`This chart slug is currently in use by another chart: ${chart.slug}`)
                    callback(false)
                } else {
                    callback(true)
                }
            })
        }

        async.every([check1, check2], (check, callback) => check(callback), (err, result) => {
            if (err) throw err
            if (result) doSave()
        })
    }
    /*def savechart(chart: Chart, data: Dict, user: User):
    isExisting = chart.id != None

    if data.get('published'):
        if ChartSlugRedirect.objects.filter(~Q(chart_id=chart.pk)).filter(Q(slug=data['slug'])):
            return HttpResponse("This chart slug was previously used by another chart: %s" % data["slug"], status=402)
        elif Chart.objects.filter(~Q(pk=chart.pk)).filter(config__slug=data['slug'], config__isPublished=True):
            return HttpResponse("This chart slug is currently in use by another chart: %s" % data["slug"], status=402)
        elif chart.config.get('isPublished') and chart.config.get('slug') and chart.config.get('slug') != data['slug']:
            # Changing the slug of an already published chart-- create a redirect
            try:
                old_chart_redirect = ChartSlugRedirect.objects.get(slug=chart.slug)
                old_chart_redirect.chart_id = chart.pk
                old_chart_redirect.save()
            except ChartSlugRedirect.DoesNotExist:
                new_chart_redirect = ChartSlugRedirect()
                new_chart_redirect.chart_id = chart.pk
                new_chart_redirect.slug = chart.slug
                new_chart_redirect.save()

    data.pop("logosSVG", None)

    dims = []

    chart.config = json.dumps(data)
    chart.last_edited_at = timezone.now()
    chart.last_edited_by = user
    chart.save()

    for i, dim in enumerate(data["dimensions"]):
        variable = Variable.objects.get(id=dim["variableId"])

        newdim = ChartDimension()
        newdim.chartId = chart
        newdim.variableId = variable
        newdim.property = dim.get('property', None)
        newdim.order = i

        newdim.displayName = dim.get('displayName', None)
        newdim.unit = dim.get('unit', None)
        newdim.shortUnit = dim.get('shortUnit', None)
        newdim.conversionFactor = dim.get('conversionFactor', None)
        newdim.tolerance = dim.get('tolerance', None)
        newdim.isProjection = dim.get('isProjection', None)
        newdim.targetYear = dim.get('targetYear', None)


        if dim.get('saveToVariable'):
            if newdim.displayName:
                variable.displayName = newdim.displayName
            if newdim.unit:
                variable.displayUnit = newdim.unit
            if newdim.shortUnit:
                variable.displayShortUnit = newdim.shortUnit
            if newdim.conversionFactor:
                variable.displayUnitConversionFactor = newdim.conversionFactor
            if 'tolerance' in dim:
                variable.displayTolerance = newdim.tolerance
            variable.displayIsProjection = bool(newdim.isProjection)
            variable.save()*/
})

// Default route: single page admin app
app.get('*', (req, res) => {
    const baseUrl = "http://l:3000/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    res.send(ReactDOMServer.renderToStaticMarkup(<AdminSPA currentUser="jaiden"/>))
})


app.listen(3000, () => console.log("Express started"))
