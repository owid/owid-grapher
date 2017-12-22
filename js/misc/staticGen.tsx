import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as fs from 'fs-extra'
import {uniq} from 'lodash'

const baseUrl = ""

function embedSnippet() {
    const chartsJs = "http://localhost:8090/charts.js"
    const chartsCss = "http://localhost:8090/charts.css"

    return `
        window.App = {};
        window.Global = { rootUrl: '${baseUrl}' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '${chartsCss}';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasPolyfill = true;
            if (hasGrapher)
                window.Grapher.embedAll();
        }
        script.src = "https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasGrapher = true;
            if (hasPolyfill)
                window.Grapher.embedAll();
        }
        script.src = '${chartsJs}';
        document.head.appendChild(script);
    `
}

class ChartPage extends React.Component<{ chart: ChartRow }> {
    render() {
        const {props} = this
        const {chart} = this.props

        const canonicalUrl = `${baseUrl}/${chart.slug}`
        const imageUrl = `${canonicalUrl}.png`
        const configPath = `${canonicalUrl}.config.json`
        const title = chart.name
        const description = JSON.parse(chart.config).subtitle || "An interactive visualization from Our World in Data."

        return <html lang="en">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title>{title} - Our World in Data</title>
                <meta name="description" content={description}/>
                <link rel="canonical" href={canonicalUrl}/>
                <meta property="fb:app_id" content="1149943818390250"/>
                <meta property="og:url" content={canonicalUrl}/>
                <meta property="og:title" content={title}/>
                <meta property="og:description" content={description}/>
                <meta property="og:image" content={imageUrl}/>
                <meta property="og:image:width" content="1080"/>
                <meta property="og:image:height" content="720"/>
                <meta property="og:site_name" content="Our World in Data"/>
                <meta name="twitter:card" content="summary_large_image"/>
                <meta name="twitter:site" content="@MaxCRoser"/>
                <meta name="twitter:creator" content="@MaxCRoser"/>
                <meta name="twitter:title" content={title}/>
                <meta name="twitter:description" content={description}/>
                <meta name="twitter:image" content={imageUrl}/>
                <style>
                    {`html, body {
                        height: 100%;
                        margin: 0;
                    }

                    figure[data-grapher-src] {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        width: 100%;
                        height: 100%;
                    }`}
                </style>
                <script src={`${baseUrl}/embedCharts.js`}></script>
            </head>
            <body className="singleChart">
                <figure data-grapher-src={canonicalUrl}></figure>
            </body>
        </html>
    }
}

import * as mysql from 'mysql'
import * as async from 'async'
import * as md5 from 'md5'

function writeVariables(conn: mysql.Connection, variableIds: number[], callback: (cacheTag: string) => void) {
    const meta: any = { variables: {} }

    const variableQuery = `
        SELECT v.*, v.short_unit as shortUnit, d.name as datasetName, s.id as s_id, s.name as s_name, s.description as s_description FROM variables as v
            JOIN datasets as d ON v.fk_dst_id = d.id
            JOIN sources as s on v.sourceId = s.id
            WHERE v.id IN (?)
    `

    conn.query(variableQuery, variableIds, (err, variables) => {
        if (err) throw err

        const varCacheTag = md5(variables.map((row: any) => row.updated_at).join("+"))

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
                additionalInfo: sourceDescription.additionalInfo ||""
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

        conn.query(dataQuery, variableIds, (err, results) => {
            if (err) throw err

            fs.ensureDirSync("tmp/netlify/data/variables")
            const stream = fs.createWriteStream(`tmp/netlify/data/variables/${variableIds.join("+")}`)

            stream.write(JSON.stringify(meta))

            const entityKey: { [entityId: number]: { name: string, code: string }|undefined } = {}
            const seenVariables: { [variableId: number]: true|undefined } = {}

            for (const row of results) {
                if (seenVariables[row.variableId] === undefined) {
                    seenVariables[row.variableId] = true
                    stream.write("\r\n")
                    stream.write(row.variableId.toString())
                }

                stream.write(`;${row.year},${row.entityId},${row.value}`)

                if (entityKey[row.entityId] === undefined) {
                    entityKey[row.entityId] = { name: row.entityName, code: row.entityCode }
                }
            }

            stream.write("\r\n")
            stream.write(JSON.stringify(entityKey))
            stream.close()

            callback(varCacheTag)
        })
    })
}

interface ChartRow {
    id: number
    slug: string
    name: string
    config: string
    origin_url: string
    notes: string
    published: boolean
    starred: boolean
    type: string
}

interface DimensionRow {
    chartId: number
    variableId: number
}

function exportChart(conn: mysql.Connection, chart: ChartRow, callback: () => void) {
    const htmlPath = "tmp/netlify/" + chart.slug + ".html"
    const configPath = "tmp/netlify/" + chart.slug + ".config.json"

    conn.query("SELECT * FROM chart_dimensions WHERE chartId=?", chart.id, (err, dimensions: DimensionRow[]) => {
        if (err) throw err

        const variableIds = uniq(dimensions.map(dim => dim.variableId))
        if (variableIds.length === 0) return

        writeVariables(conn, variableIds, cacheTag => {
            const config = JSON.parse(chart.config)
            config.id = chart.id
            config.variableCacheTag = cacheTag

            fs.writeFileSync(configPath, JSON.stringify(config))
            fs.writeFileSync(htmlPath, ReactDOMServer.renderToStaticMarkup(<ChartPage chart={chart}/>))
            callback()
        })
    })
}

function main() {
    const conn = mysql.createConnection({
        host: "localhost",
        user: "root",
        database: "dev_grapher"
    })

    conn.connect()

    fs.writeFileSync("tmp/embedCharts.js", embedSnippet())
 
    conn.query("SELECT * FROM charts WHERE published=1", (err, results) => {
        if (err) throw err

        for (const chart of results) {
            exportChart(conn, chart, () => console.log(chart.slug))
        }
    })


    //writeVariables(conn, [121])
    //writeChartConfig(conn, "child-mortality")
}

main()

/*def variables(request, ids):
"""
:param request: Request object
:param ids: ids of requested variables
:return: json file of requested variables in plain text format
"""
meta = { "variables": {} }

# First, grab all the variable metadata needed by the frontend
variable_ids = [int(idStr) for idStr in ids.split('+')]
variables = Variable.objects.filter(id__in=variable_ids).select_related('fk_dst_id', 'sourceId').values(
    'id', 'name', 'description', 'unit', 'short_unit',
    'displayName', 'displayUnit', 'displayShortUnit', 'displayUnitConversionFactor', 'displayTolerance', 'displayIsProjection',
    'fk_dst_id__name', 'sourceId__pk', 'sourceId__name', 'sourceId__description'
)

# Process the metadata into a nicer form
for variable in variables:
    variable['shortUnit'] = variable.pop('short_unit')
    variable['datasetName'] = variable.pop('fk_dst_id__name')
    source_description = json.loads(variable.pop('sourceId__description'))
    variable['source'] = source_description
    variable['source']['id'] = variable.pop('sourceId__pk')
    variable['source']['name'] = variable.pop('sourceId__name')
    variable['source']['dataPublishedBy'] = "" if not source_description['dataPublishedBy'] else source_description['dataPublishedBy']
    variable['source']['dataPublisherSource'] = "" if not source_description['dataPublisherSource'] else source_description[
        'dataPublisherSource']
    variable['source']['link'] = "" if not source_description['link'] else source_description['link']
    variable['source']['retrievedDate'] = "" if not source_description['retrievedDate'] else source_description['retrievedDate']
    variable['source']['additionalInfo'] = "" if not source_description['additionalInfo'] else source_description[
        'additionalInfo']
    meta['variables'][variable['id']] = variable

# Now fetch the actual data, using a custom csv-like transfer format
# for efficiency (this is the most common expensive operation in the grapher)
varstring = ""
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT value, year, fk_var_id as var_id, entities.id as entity_id, 
        entities.name as entity_name, entities.code as entity_code 
        FROM data_values 
        LEFT JOIN entities ON data_values.fk_ent_id = entities.id 
        WHERE data_values.fk_var_id IN %s 
        ORDER BY var_id ASC, year ASC
    """, [variable_ids])
    rows = dictfetchall(cursor)

def stream():
    yield json.dumps(meta)

    entitykey = {}
    seen_variables = {}
    for row in rows:
        if row['var_id'] not in seen_variables:
            seen_variables[row['var_id']] = True
            yield "\r\n"
            yield str(row['var_id'])

        yield f";{row['year']},{row['entity_id']},{row['value']}"

        if row['entity_id'] not in entitykey:
            entitykey[row['entity_id']] = {'name': row['entity_name'], 'code': row['entity_code']}

    yield "\r\n"
    yield json.dumps(entitykey)

response = StreamingHttpResponse(stream(), content_type="text/plain")

if get_query_string(request):
    response['Cache-Control'] = 'max-age=31536000 public'
else:
    response['Cache-Control'] = 'no-cache'

return response*/

//console.log(ReactDOMServer.renderToStaticMarkup(<ChartPage chart={{title: "foo"}}/>))
