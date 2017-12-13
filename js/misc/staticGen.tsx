import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as fs from 'fs-extra'
import {uniq} from 'lodash'

const baseUrl = ""

const LOGO = "<svg><a xmlns:xlink=\"http://www.w3.org/1999/xlink\" xlink:href=\"https://ourworldindata.org\" target=\"_blank\"><g><rect x=\"0\" y=\"0\" fill=\"#1B2543\" width=\"211.2\" height=\"130.1\"/><rect x=\"0\" y=\"112.2\" fill=\"#E63912\" width=\"211.2\" height=\"17.9\"/><g><rect x=\"1.2\" y=\"12.3\" fill=\"none\" width=\"210.2\" height=\"99.2\"/><path fill=\"#FFFFFF\" d=\"M37.8,32.2c0,12.7-7.7,19.4-17.1,19.4c-9.7,0-16.6-7.5-16.6-18.7c0-11.7,7.3-19.3,17.1-19.3 C31.3,13.7,37.8,21.3,37.8,32.2z M9.2,32.8c0,7.9,4.3,14.9,11.8,14.9c7.5,0,11.8-6.9,11.8-15.3c0-7.3-3.8-14.9-11.8-14.9 C13.1,17.5,9.2,24.8,9.2,32.8z\"/><path fill=\"#FFFFFF\" d=\"M62.7,43.8c0,2.7,0.1,5.1,0.2,7.2h-4.3l-0.3-4.3h-0.1c-1.3,2.1-4,4.9-8.8,4.9c-4.2,0-9.1-2.3-9.1-11.6 V24.6h4.8v14.6c0,5,1.5,8.4,5.9,8.4c3.2,0,5.5-2.2,6.3-4.4c0.3-0.7,0.4-1.6,0.4-2.5V24.6h4.8V43.8z\"/><path fill=\"#FFFFFF\" d=\"M67.3,32.8c0-3.1-0.1-5.8-0.2-8.2h4.2l0.2,5.2h0.2c1.2-3.5,4.1-5.8,7.3-5.8c0.5,0,0.9,0.1,1.4,0.2v4.5 c-0.5-0.1-1-0.2-1.6-0.2c-3.4,0-5.8,2.6-6.5,6.2c-0.1,0.7-0.2,1.4-0.2,2.2V51h-4.8V32.8z\"/><path fill=\"#FFFFFF\" d=\"M95.4,51l-9.4-36.8h5l4.4,18.6c1.1,4.6,2.1,9.2,2.7,12.7h0.1c0.6-3.7,1.8-8,3-12.8l4.9-18.5h5l4.5,18.7 c1,4.4,2,8.7,2.6,12.6h0.1c0.8-4,1.8-8.1,3-12.7l4.9-18.5h4.9L120.6,51h-5L111,31.9c-1.1-4.7-1.9-8.3-2.4-12h-0.1 c-0.7,3.7-1.5,7.3-2.8,12L100.4,51H95.4z\"/><path fill=\"#FFFFFF\" d=\"M154.9,37.6c0,9.8-6.8,14-13.2,14c-7.2,0-12.7-5.2-12.7-13.6c0-8.8,5.8-14,13.1-14 C149.8,24,154.9,29.5,154.9,37.6z M133.9,37.9c0,5.8,3.3,10.1,8,10.1c4.6,0,8-4.3,8-10.3c0-4.5-2.2-10.1-7.9-10.1 C136.3,27.6,133.9,32.8,133.9,37.9z\"/><path fill=\"#FFFFFF\" d=\"M158.2,32.8c0-3.1-0.1-5.8-0.2-8.2h4.2l0.2,5.2h0.2c1.2-3.5,4.1-5.8,7.3-5.8c0.5,0,0.9,0.1,1.4,0.2v4.5 c-0.5-0.1-1-0.2-1.6-0.2c-3.4,0-5.8,2.6-6.5,6.2c-0.1,0.7-0.2,1.4-0.2,2.2V51h-4.8V32.8z\"/><path fill=\"#FFFFFF\" d=\"M173.5,12.3h4.8V51h-4.8V12.3z\"/><path fill=\"#FFFFFF\" d=\"M206.5,12.3v31.9c0,2.3,0.1,5,0.2,6.8h-4.3l-0.2-4.6H202c-1.5,2.9-4.7,5.2-9,5.2 c-6.4,0-11.3-5.4-11.3-13.4c-0.1-8.8,5.4-14.2,11.9-14.2c4,0,6.8,1.9,8,4h0.1V12.3H206.5z M201.7,35.4c0-0.6-0.1-1.4-0.2-2 c-0.7-3.1-3.3-5.6-6.9-5.6c-5,0-7.9,4.4-7.9,10.2c0,5.3,2.6,9.8,7.8,9.8c3.2,0,6.2-2.1,7.1-5.7c0.2-0.7,0.2-1.3,0.2-2.1V35.4z\"/><path fill=\"#FFFFFF\" d=\"M42.8,64c0.1,1.6-1.1,2.9-3.1,2.9c-1.7,0-2.9-1.3-2.9-2.9c0-1.7,1.3-3,3-3C41.7,61,42.8,62.3,42.8,64z M37.4,97.8V71.4h4.8v26.4H37.4z\"/><path fill=\"#FFFFFF\" d=\"M47.5,78.6c0-2.7-0.1-5-0.2-7.1h4.3l0.3,4.4h0.1c1.3-2.5,4.4-5,8.8-5c3.7,0,9.4,2.2,9.4,11.2v15.8h-4.8 V82.6c0-4.3-1.6-7.8-6.1-7.8c-3.2,0-5.6,2.2-6.5,4.9c-0.2,0.6-0.3,1.4-0.3,2.2v15.9h-4.8V78.6z\"/><path fill=\"#FFFFFF\" d=\"M84,61.6c2.9-0.4,6.3-0.8,10.1-0.8c6.8,0,11.7,1.6,14.9,4.6c3.3,3,5.2,7.3,5.2,13.2c0,6-1.9,10.9-5.3,14.3 c-3.4,3.4-9.1,5.3-16.3,5.3c-3.4,0-6.2-0.2-8.6-0.4V61.6z M88.8,94.1c1.2,0.2,3,0.3,4.8,0.3c10.2,0,15.7-5.7,15.7-15.6 c0.1-8.7-4.9-14.2-14.9-14.2c-2.5,0-4.3,0.2-5.6,0.5V94.1z\"/><path fill=\"#FFFFFF\" d=\"M132.1,97.8l-0.4-3.3h-0.2c-1.5,2.1-4.3,3.9-8.1,3.9c-5.4,0-8.1-3.8-8.1-7.6c0-6.4,5.7-9.9,15.9-9.8v-0.5 c0-2.2-0.6-6.1-6-6.1c-2.5,0-5,0.8-6.9,2l-1.1-3.2c2.2-1.4,5.4-2.3,8.7-2.3c8.1,0,10.1,5.5,10.1,10.8v9.9c0,2.3,0.1,4.5,0.4,6.3 H132.1z M131.4,84.4c-5.3-0.1-11.2,0.8-11.2,5.9c0,3.1,2.1,4.6,4.5,4.6c3.4,0,5.6-2.2,6.4-4.4c0.2-0.5,0.3-1,0.3-1.5V84.4z\"/><path fill=\"#FFFFFF\" d=\"M146.6,63.9v7.6h6.9v3.7h-6.9v14.2c0,3.3,0.9,5.1,3.6,5.1c1.3,0,2.2-0.2,2.8-0.3l0.2,3.6 c-0.9,0.4-2.4,0.7-4.3,0.7c-2.2,0-4-0.7-5.2-2c-1.4-1.4-1.9-3.8-1.9-6.9V75.1h-4.1v-3.7h4.1v-6.3L146.6,63.9z\"/><path fill=\"#FFFFFF\" d=\"M171.4,97.8l-0.4-3.3h-0.2c-1.5,2.1-4.3,3.9-8.1,3.9c-5.4,0-8.1-3.8-8.1-7.6c0-6.4,5.7-9.9,15.9-9.8v-0.5 c0-2.2-0.6-6.1-6-6.1c-2.5,0-5,0.8-6.9,2l-1.1-3.2c2.2-1.4,5.4-2.3,8.7-2.3c8.1,0,10.1,5.5,10.1,10.8v9.9c0,2.3,0.1,4.5,0.4,6.3 H171.4z M170.7,84.4c-5.3-0.1-11.2,0.8-11.2,5.9c0,3.1,2.1,4.6,4.5,4.6c3.4,0,5.6-2.2,6.4-4.4c0.2-0.5,0.3-1,0.3-1.5V84.4z\"/></g></g></a></svg>"

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
            config['logosSVG'] = [LOGO]
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
