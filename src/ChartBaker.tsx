// Build all charts into a static bundle
// Should support incremental builds for performance
import {createConnection, DatabaseConnection} from './database'
import { LOGO, embedSnippet } from './staticGen'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import { uniq, without } from 'lodash'
import * as fs from 'fs-extra'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { getVariableData } from './models/Variable'
import {ChartPage} from './ChartPage'
import * as path from 'path'
import * as md5 from 'md5'
import * as glob from 'glob'
import * as shell from 'shelljs'

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
            const outPath = path.join(this.baseDir, `assets/${manifest[key]}`)
            fs.copySync(`${buildDir}/${manifest[key]}`, outPath)
            console.log(outPath)
        }

        const chartsJs = `${pathRoot}/assets/${manifest['charts.js']}`
        const chartsCss = `${pathRoot}/assets/${manifest['charts.css']}`

        await fs.writeFile(`${this.baseDir}/embedCharts.js`, embedSnippet(pathRoot, chartsJs, chartsCss))
        console.log(`${this.baseDir}/embedCharts.js`)
    }

    async bakeVariableData(variableIds: number[]) {
        await fs.mkdirp(`${this.baseDir}/data/variables/`)
        const vardata = await getVariableData(variableIds, this.db)
        const outPath = `${this.baseDir}/data/variables/${variableIds.join("+")}`
        await fs.writeFile(`${this.baseDir}/data/variables/${variableIds.join("+")}`, vardata)
        console.log(outPath)
    }

    async bakeChartConfig(chart: ChartConfigProps) {
        (chart as any).logosSVG = [LOGO]
        const outPath = `${this.baseDir}/${chart.slug}.config.json`
        await fs.writeFile(outPath, JSON.stringify(chart))
        console.log(outPath)
    }

    async bakeChartPage(chart: ChartConfigProps) {
        const outPath = `${this.baseDir}/${chart.slug}.html`
        await fs.writeFile(outPath, ReactDOMServer.renderToStaticMarkup(<ChartPage canonicalRoot={this.props.canonicalRoot} pathRoot={this.props.pathRoot} chart={chart}/>))
        console.log(outPath)
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

        await fs.writeFile(`${repoDir}/_redirects`, redirects.join("\n"))
        console.log(`${repoDir}/_redirects`)
    }

    async bakeHeaders() {
        const {pathRoot, repoDir} = this.props

        const headers = `${pathRoot}/data/variables/*
  Cache-Control: public, max-age=31556926

${pathRoot}/assets/*
  Cache-Control: public, max-age=31556926

`
        await fs.writeFile(`${repoDir}/_headers`, headers)
        console.log(`${repoDir}/_headers`)
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

    async bakeCharts() {
        const {db, baseDir, props} = this
        const rows = await db.query(`SELECT config, updated_at FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true ORDER BY slug ASC`)

        const newSlugs = []
        let requests = []
        for (const row of rows) {
            const chart: ChartConfigProps = JSON.parse(row.config)
            newSlugs.push(chart.slug)

            const configPath = `${baseDir}/${chart.slug}.config.json`
            try {
                const stat = fs.statSync(configPath)
                if (stat.mtime >= row.updated_at)
                    continue
            } catch (err) {
                if (err.code !== 'ENOENT')
                    console.error(err)
            }

            requests.push(this.bakeChart(chart))
            // Execute in batches
            if (requests.length > 20) {
                await Promise.all(requests)
                requests = []
            }
        }

        // Delete any that are missing from the database
        const oldSlugs = glob.sync(`${baseDir}/*.config.json`).map(slug => slug.replace(`${baseDir}/`, '').replace(".config.json", ""))
        const toRemove = without(oldSlugs, ...newSlugs)
        for (const slug of toRemove) {
            console.log(`DELETING ${slug}`)
            try {
                await fs.unlink(`${baseDir}/${slug}.config.json`)
                await fs.unlink(`${baseDir}/${slug}.html`)
            } catch (err) {
                console.error(err)
            }
        }

        return Promise.all(requests)
    }

    async bakeAll() {
        await this.bakeCharts()
        await this.bakeRedirects()
        await this.bakeHeaders()
        await this.bakeAssets()
    }

    exec(cmd: string) {
        console.log(cmd)
        shell.exec(cmd)
    }

    async deploy(authorEmail?: string, authorName?: string, commitMsg?: string) {
        const {repoDir} = this.props
        if (authorEmail && authorName && commitMsg) {
            this.exec(`cd ${repoDir} && git add -A . && git commit --author='${authorName} <${authorEmail}>' -a -m '${commitMsg}'`)
        } else {
            this.exec(`cd ${repoDir} && git add -A . && git commit -a -m "Automated update"`)
        }
        this.exec(`cd ${repoDir} && git push origin master`)
    }

    async end() {
        return this.db.end()
    }
}
