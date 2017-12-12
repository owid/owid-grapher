import * as express from 'express'
import { db } from './database'
import { uniq } from 'lodash'
const app = express()

app.get('/grapher/admin/charts/:id/edit', (req, res) => {
    const baseUrl = "http://l:3000/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    res.send(`
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>owid-grapher</title>
                <meta name="_token" value="kpdrWCwSD2Y2PYEErYpfRSNn6xivJWvXv6jPo0iuLuio2rin0dEC56PDMkgnZmrg">
                <meta name="description" content="">
                <link href="http://localhost:8090/charts.css" rel="stylesheet" type="text/css">
                <link href="http://localhost:8090/editor.css" rel="stylesheet" type="text/css">
            </head>
            <body>
                <script src="http://localhost:8090/charts.js"></script>
                <script src="http://localhost:8090/editor.js"></script>
                <script type="text/javascript">
                    window.Global = {}
                    Global.rootUrl = "${baseUrl}"
                    window.App = {}
                    App.isEditor = true
                    App.isDebug = ${isDebug}
                    window.admin = new Admin("${baseUrl}", "${cacheTag}", "${currentUser}")
                    admin.start(document.body)
                </script>
            </body>
        </html>
    `)
})

app.get('/grapher/admin/editorData.:cacheTag.json', (req, res) => {
    console.log(req.params.cacheTag)

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
        config.id = row.id
        config.title = row.name
        config.slug = row.slug
        config['chart-type'] = row.type
        config.internalNotes = row.notes
        config['data-entry-url'] = row.origin_url
        config.published = row.published

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
            SELECT value, year, fk_var_id as variableId, entities.id as entityId,
            entities.name as entityName, entities.code as entityCode
            FROM data_values
            LEFT JOIN entities ON data_values.fk_ent_id = entities.id
            WHERE data_values.fk_var_id IN (?)
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

app.listen(3000, () => console.log("Express started"))
