import * as _ from "lodash"
import parseUrl from "url-parse"
import * as db from "db/db"
import { getVariableData } from "db/model/Variable"
import * as fs from "fs-extra"
import { optimizeSvg } from "./svgPngExport"
import md5 from "md5"

declare var global: any
global.window = { location: { search: "" } }
global.App = { isEditor: false }

import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

export async function getChartsBySlug() {
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

export async function bakeChartToImage(
    jsonConfig: ChartConfigProps,
    outDir: string,
    slug: string,
    queryStr: string = "",
    optimizeSvgs: boolean = false,
    overwriteExisting = false,
    verbose = true
) {
    // the type definition for url.query is wrong (bc we have query string parsing disabled),
    // so we have to explicitly cast it
    const chart = new ChartConfig(jsonConfig, { queryStr })
    chart.isExporting = true
    const { width, height } = chart.idealBounds
    const outPath = `${outDir}/${slug}${queryStr ? "-" + md5(queryStr) : ""}_v${
        jsonConfig.version
    }_${width}x${height}.svg`
    if (verbose) console.log(outPath)

    if (fs.existsSync(outPath) && !overwriteExisting) return

    const variableIds = _.uniq(chart.dimensions.map(d => d.variableId))
    const vardata = await getVariableData(variableIds)
    chart.receiveData(vardata)

    let svgCode = chart.staticSVG
    if (optimizeSvgs) svgCode = await optimizeSvg(svgCode)

    fs.writeFile(outPath, svgCode)
    return svgCode
}

export async function bakeChartsToImages(
    chartUrls: string[],
    outDir: string,
    optimizeSvgs = false
) {
    await fs.mkdirp(outDir)
    const chartsBySlug = await getChartsBySlug()

    for (const urlStr of chartUrls) {
        const url = parseUrl(urlStr)
        const slug = _.last(url.pathname.split("/")) as string
        const jsonConfig = chartsBySlug.get(slug)
        if (jsonConfig) {
            bakeChartToImage(
                jsonConfig,
                outDir,
                slug,
                (url.query as unknown) as string,
                optimizeSvgs
            )
        }
    }
}
