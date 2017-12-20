import { ChartConfigProps } from '../js/charts/ChartConfig'
import { streamVariableData } from './models/Variable'
import { settings } from './settings'
import {uniq} from 'lodash'
import * as parseArgs from 'minimist'
import * as fs from 'fs-extra'
import { DatabaseConnection } from './database'
import { MysqlError } from 'mysql'
const argv = parseArgs(process.argv.slice(2))
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import {ChartPage} from './ChartPage'

/*const chartId = parseInt(argv._[0])

if (isNaN(chartId))
    throw new Error(`Invalid row id rows{argv._[0]}`)*/

// TODO: redirects

export async function writeVariables(variableIds: number[], baseDir: string, db: DatabaseConnection) {
    await fs.mkdirp(`${baseDir}/data/variables/`)
    const output = fs.createWriteStream(`${baseDir}/data/variables/${variableIds.join("+")}`)
    streamVariableData(variableIds, output, db)
}

export async function writeChartPage(chart: ChartConfigProps, baseDir: string) {
    await fs.mkdirp(`${baseDir}/${chart.slug}/`)
    return fs.writeFile(`${baseDir}/${chart.slug}/index.html`, ReactDOMServer.renderToStaticMarkup(<ChartPage chart={chart}/>))
}

export async function writeChartConfig(chart: ChartConfigProps, baseDir: string) {
    fs.writeFile(`${baseDir}/${chart.slug}.config.json`, JSON.stringify(chart))
}

export async function writeChart(chart: ChartConfigProps, baseDir: string, db: DatabaseConnection) {
    const variableIds = uniq(chart.dimensions.map(d => d.variableId))
    if (!variableIds.length) return

    await Promise.all([
        writeVariables(variableIds, baseDir, db),
        writeChartConfig(chart, baseDir),
        writeChartPage(chart, baseDir),
    ])
}

export async function exportEmbedSnippet(baseDir: string) {
    const isProduction = false

    let chartsJs, chartsCss
    if (isProduction) {
        const manifest = JSON.parse(await fs.readFile(`public/build/manifest.json`, 'utf8'))
        chartsJs = manifest['charts.js']
        chartsCss = manifest['charts.css']
    } else {
        chartsCss = "http://localhost:8090/charts.css"
        chartsJs = "http://localhost:8090/charts.js"
    }

    const snippet = `
        window.App = {};
        window.Global = { rootUrl: '${settings.baseUrl}' };

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

    return await fs.writeFile(`${baseDir}/embedCharts.js`, snippet)
}

export async function exportAll(baseDir: string, db: DatabaseConnection) {
    const rows = await db.query(`SELECT config FROM charts ORDER BY slug ASC`)

    const exportRuns = rows.slice(0, 1).map(row => {
        const chart: ChartConfigProps = JSON.parse(row.config)
        return writeChart(chart, baseDir, db).then(() => console.log(chart.slug))
    })

    await Promise.all([exportEmbedSnippet(baseDir)].concat(exportRuns))
    db.end()
}
