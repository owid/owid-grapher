// Build all charts into a static bundle
// Should support incremental builds for performance
import {createConnection, DatabaseConnection} from './database'
import { LOGO, embedSnippet } from './staticGen'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import { uniq } from 'lodash'
import * as fs from 'fs-extra'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { streamVariableData } from './models/Variable'
import {ChartPage} from './ChartPage'

export interface ChartBakerProps {
    database: string
    canonicalRoot: string
    pathRoot: string
    outDir: string
}

export class ChartBaker {
    props: ChartBakerProps
    db: DatabaseConnection
    constructor(props: ChartBakerProps) {
        this.props = props
        this.db = createConnection({ database: props.database })
        fs.mkdirpSync(this.props.outDir)
    }

    async bakeAssets() {
        const isProduction = false
        const {pathRoot, outDir} = this.props

        const buildDir = `public/build`

        const manifest = JSON.parse(await fs.readFile(`${buildDir}/manifest.json`, 'utf8'))

        await fs.mkdirp(`${outDir}/assets`)

        for (const key in manifest) {
            fs.copyFileSync(`${buildDir}/${manifest[key]}`, `${outDir}/assets/${manifest[key]}`)
        }

        const chartsJs = `${pathRoot}/assets/${manifest['charts.js']}`
        const chartsCss = `${pathRoot}/assets/${manifest['charts.css']}`

        return fs.writeFile(`${outDir}/embedCharts.js`, embedSnippet(pathRoot, chartsJs, chartsCss))
    }

    async bakeVariableData(variableIds: number[]) {
        await fs.mkdirp(`${this.props.outDir}/data/variables/`)
        const output = fs.createWriteStream(`${this.props.outDir}/data/variables/${variableIds.join("+")}`)
        return streamVariableData(variableIds, output, this.db)
    }

    async bakeChartConfig(chart: ChartConfigProps) {
        (chart as any).logosSVG = [LOGO]
        return fs.writeFile(`${this.props.outDir}/${chart.slug}.config.json`, JSON.stringify(chart))
    }

    async bakeChartPage(chart: ChartConfigProps) {
        return fs.writeFile(`${this.props.outDir}/${chart.slug}.html`, ReactDOMServer.renderToStaticMarkup(<ChartPage canonicalRoot={this.props.canonicalRoot} pathRoot={this.props.pathRoot} chart={chart}/>))
    }

    async bakeChart(chart: ChartConfigProps) {
        const variableIds = uniq(chart.dimensions.map(d => d.variableId))
        if (!variableIds.length) return

        return Promise.all([
            this.bakeVariableData(variableIds),
            this.bakeChartConfig(chart),
            this.bakeChartPage(chart),
        ])
    }

    async bakeRedirects() {
        const {pathRoot, outDir} = this.props
        const rows = await this.db.query(`
            SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
            FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
        `)


        const redirects = []
        for (const row of rows) {
            const trueSlug = JSON.parse(row.trueSlug)
            if (row.slug !== trueSlug) {
                redirects.push(`${pathRoot}/${row.slug}* ${pathRoot}/${trueSlug}:splat 302`)
            }
        }

        return fs.writeFile(`${outDir}/_redirects`, redirects.join("\n"))
    }

    async bakeAll() {
        const {db, props} = this
        const chartQuery = db.query(`SELECT config, updated_at FROM charts ORDER BY slug ASC`)
        const variableQuery = db.query(`SELECT id, updated_at FROM variables`)

        const chartRows = await chartQuery

        const exportRuns = chartRows.map(row => {
            const chart: ChartConfigProps = JSON.parse(row.config)
            return this.bakeChart(chart).then(() => console.log(chart.slug))
        })

        await Promise.all([this.bakeRedirects(), this.bakeAssets()])//.concat(exportRuns))
    }

    async end() {
        return this.db.end()
    }
}
