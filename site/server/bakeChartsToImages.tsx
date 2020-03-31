import * as _ from "lodash"
import * as parseUrl from "url-parse"
import * as db from "db/db"
import * as parseArgs from "minimist"
const argv = parseArgs(process.argv.slice(2))
import { getVariableData } from "db/model/Variable"
import * as fs from "fs-extra"
const md5 = require("md5")

declare var global: any
global.window = { location: { search: "" } }
global.App = { isEditor: false }

import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

async function getChartsBySlug() {
    const chartsBySlug: Map<string, ChartConfigProps> = new Map()
    const chartsById = new Map()

    const chartsQuery = db.query(`SELECT * FROM charts`)
    const redirectQuery = db.query(
        `SELECT slug, chart_id FROM chart_slug_redirects`
    )

    for (const row of await chartsQuery) {
        const chart = JSON.parse(row.config)
        chart.id = row.id
        chartsBySlug.set(chart.slug, chart)
        chartsById.set(row.id, chart)
    }

    for (const row of await redirectQuery) {
        chartsBySlug.set(row.slug, chartsById.get(row.chart_id))
    }

    return chartsBySlug
}

export async function bakeChartsToImages(chartUrls: string[], outDir: string) {
    await fs.mkdirp(outDir)
    const chartsBySlug = await getChartsBySlug()

    for (const urlStr of chartUrls) {
        const url = parseUrl(urlStr)
        const slug = _.last(url.pathname.split("/")) as string
        const jsonConfig = chartsBySlug.get(slug)
        if (jsonConfig) {
            const queryStr = url.query as any

            const chart = new ChartConfig(jsonConfig, { queryStr: queryStr })
            chart.isLocalExport = true
            const { width, height } = chart.idealBounds
            const outPath = `${outDir}/${slug}${
                queryStr ? "-" + (md5(queryStr) as string) : ""
            }_v${jsonConfig.version}_${width}x${height}.svg`
            console.log(outPath)

            if (!fs.existsSync(outPath)) {
                const variableIds = _.uniq(
                    chart.dimensions.map(d => d.variableId)
                )
                const vardata = await getVariableData(variableIds)
                chart.receiveData(vardata)
                fs.writeFile(outPath, chart.staticSVG)
            }
        }
    }
}
