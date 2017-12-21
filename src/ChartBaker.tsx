// Build all charts into a static bundle
// Should support incremental builds for performance
import {createConnection, DatabaseConnection} from './database'
import { LOGO, embedSnippet } from './staticGen'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import { uniq } from 'lodash'
import * as fs from 'fs-extra'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { getVariableData } from './models/Variable'
import {ChartPage} from './ChartPage'
import * as path from 'path'
import * as md5 from 'md5'

export interface ChartBakerProps {
    database: string
    canonicalRoot: string
    pathRoot: string
    repoDir: string
}

export class ChartBaker {
    props: ChartBakerProps
    db: DatabaseConnection
    baseDir: string
    constructor(props: ChartBakerProps) {
        this.props = props
        this.db = createConnection({ database: props.database })
        this.baseDir = path.join(this.props.repoDir, this.props.pathRoot)
        fs.mkdirpSync(this.baseDir)
    }

    async bakeAssets() {
        const isProduction = false
        const {pathRoot} = this.props

        const buildDir = `public/build`

        const manifest = JSON.parse(await fs.readFile(`${buildDir}/manifest.json`, 'utf8'))

        await fs.mkdirp(path.join(this.baseDir, 'assets'))

        for (const key in manifest) {
            fs.copyFileSync(`${buildDir}/${manifest[key]}`, path.join(this.baseDir, `assets/${manifest[key]}`))
        }

        const chartsJs = `${pathRoot}/assets/${manifest['charts.js']}`
        const chartsCss = `${pathRoot}/assets/${manifest['charts.css']}`

        await fs.writeFile(`${this.baseDir}/embedCharts.js`, embedSnippet(pathRoot, chartsJs, chartsCss))
    }

    async bakeVariableData(variableIds: number[]) {
        await fs.mkdirp(`${this.baseDir}/data/variables/`)
        const vardata = await getVariableData(variableIds, this.db)
        await fs.writeFile(`${this.baseDir}/data/variables/${variableIds.join("-")}`, vardata)
    }

    async bakeChartConfig(chart: ChartConfigProps) {
        (chart as any).logosSVG = [LOGO]
        await fs.writeFile(`${this.baseDir}/${chart.slug}.config.json`, JSON.stringify(chart))
    }

    async bakeChartPage(chart: ChartConfigProps) {
        await fs.writeFile(`${this.baseDir}/${chart.slug}.html`, ReactDOMServer.renderToStaticMarkup(<ChartPage canonicalRoot={this.props.canonicalRoot} pathRoot={this.props.pathRoot} chart={chart}/>))
    }

    async bakeChart(chart: ChartConfigProps) {
        const variableIds = uniq(chart.dimensions.map(d => d.variableId))
        if (!variableIds.length) return

        const variables = await this.db.query(`SELECT updated_at FROM variables WHERE id IN (?)`, [variableIds]);
        (chart as any).variableCacheTag = md5(variables.map(v => v.updated_at).join("+"))

        await Promise.all([
            this.bakeVariableData(variableIds),
            this.bakeChartConfig(chart),
            this.bakeChartPage(chart),
        ])
    }

    async bakeRedirects() {
        const {pathRoot, repoDir} = this.props
        const rows = await this.db.query(`
            SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
            FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
        `)

        const redirects = []
        for (const row of rows) {
            const trueSlug = JSON.parse(row.trueSlug)
            if (row.slug !== trueSlug) {
                redirects.push(`${pathRoot}/${row.slug} ${pathRoot}/${trueSlug} 302`)
                redirects.push(`${pathRoot}/${row.slug}.config.json ${pathRoot}/${trueSlug}.config.json 302`)
            }
        }

        return fs.writeFile(`${repoDir}/_redirects`, redirects.join("\n"))
    }

    async bakeHeaders() {
        const {pathRoot, repoDir} = this.props

        const headers = `${pathRoot}/data/variables/*
  Cache-Control: public, max-age=31556926

${pathRoot}/assets/*
  Cache-Control: public, max-age=31556926
`
        return fs.writeFile(`${repoDir}/_headers`, headers)
    }

    /*async bakeAllVariables() {
        // Find all variables used by charts and bake them
        const {db} = this
        const chartQuery = db.query(`SELECT JSON_EXTRACT(config, "$.dimensions") as dimensions FROM charts ORDER BY slug ASC`)
        const rows = await chartQuery

        const variableIds = []
        for (const row of rows) {
            const dimensions: { variableId: number }[] = JSON.parse(row.dimensions)
            variableIds.push(...dimensions.map(d => d.variableId))
        }

        console.log(uniq(variableIds))
    }*/

    async bakeAll() {
        const {db, props} = this
        const chartQuery = db.query(`SELECT config FROM charts ORDER BY slug ASC`)
        const variableQuery = db.query(`SELECT id, updated_at FROM variables`)

        const charts: ChartConfigProps[] = (await chartQuery).map(row => JSON.parse(row.config))

        const exportRuns = charts.map(chart => {
            return this.bakeChart(chart).then(() => console.log(chart.slug))
        })

        await Promise.all([this.bakeRedirects(), this.bakeHeaders(), this.bakeAssets()].concat(exportRuns))
    }

    async end() {
        return this.db.end()
    }
}
