// Build all charts into a static bundle
// Should support incremental builds for performance
import {createConnection, DatabaseConnection} from './database'
import { embedSnippet } from './staticGen'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import { uniq, without, chunk } from 'lodash'
import * as fs from 'fs-extra'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { getVariableData } from './models/Variable'
import {ChartPage} from './ChartPage'
import * as path from 'path'
import * as md5 from 'md5'
import * as glob from 'glob'
import * as shell from 'shelljs'
import { bakeMediaCard } from './svgPngExport'

import { ENV, WEBPACK_DEV_URL, DB_NAME } from './settings'

export interface ChartBakerProps {
    canonicalRoot: string
    pathRoot: string
    repoDir: string

    regenConfig?: boolean
    regenImages?: boolean
    regenData?: boolean
}

export class ChartBaker {
    props: ChartBakerProps
    db: DatabaseConnection
    baseDir: string

    // Keep a list of the files we've generated to add to git later
    stagedFiles: string[] = []

    constructor(props: ChartBakerProps) {
        this.props = props
        this.db = createConnection({ database: DB_NAME })
        this.baseDir = path.join(this.props.repoDir, this.props.pathRoot)
        fs.mkdirpSync(this.baseDir)
    }

    async bakeAssets() {
        const {pathRoot} = this.props

        let chartsJs = `${WEBPACK_DEV_URL}/charts.js`
        let chartsCss = `${WEBPACK_DEV_URL}/charts.css`

        if (ENV === "production") {
            const buildDir = `grapher_admin/static/build`

            const manifest = JSON.parse(await fs.readFile(`${buildDir}/manifest.json`, 'utf8'))

            await fs.mkdirp(path.join(this.baseDir, 'assets'))

            for (const key in manifest) {
                let outPath = path.join(this.baseDir, `assets/${manifest[key]}`)
                if (key === "charts.js" || key === "charts.css")
                    outPath = path.join(this.baseDir, `assets/${key}`) // We'll handle the fingerprinting for these separately
                else if (key.match(/.js$/) || key.match(/.css$/))
                    continue // Not interested in the admin js/css

                fs.copySync(`${buildDir}/${manifest[key]}`, outPath)
                this.stage(outPath)
            }

            chartsJs = `${pathRoot}/assets/charts.js?v=${manifest['charts.js']}`
            chartsCss = `${pathRoot}/assets/charts.css?v=${manifest['charts.css']}`
        }

        await fs.writeFile(`${this.baseDir}/embedCharts.js`, embedSnippet(pathRoot, chartsJs, chartsCss))
        this.stage(`${this.baseDir}/embedCharts.js`)
    }

    async bakeVariableData(variableIds: number[], outPath: string): Promise<string> {
        await fs.mkdirp(`${this.baseDir}/data/variables/`)
        const vardata = await getVariableData(variableIds, this.db)
        await fs.writeFile(outPath, vardata)
        this.stage(outPath)
        return vardata
    }

    async bakeChartConfig(chart: ChartConfigProps) {
        const outPath = `${this.baseDir}/${chart.slug}.config.json`
        await fs.writeFile(outPath, JSON.stringify(chart))
        this.stage(outPath)
    }

    async bakeChartPage(chart: ChartConfigProps) {
        const outPath = `${this.baseDir}/${chart.slug}.html`
        await fs.writeFile(outPath, ReactDOMServer.renderToStaticMarkup(<ChartPage canonicalRoot={this.props.canonicalRoot} pathRoot={this.props.pathRoot} chart={chart}/>))
        this.stage(outPath)
    }

    async bakeChart(chart: ChartConfigProps) {
        const {baseDir, props} = this

        const configPath = `${baseDir}/${chart.slug}.config.json`
        let isConfigIdentical = false
        try {
            // If the chart config is the same version, we can potentially skip baking the data (which is by far the slowest part)
            const fileVersion = JSON.parse(await fs.readFile(configPath, 'utf8')).version
            isConfigIdentical = chart.version === fileVersion
        } catch (err) {
            if (err.code !== 'ENOENT')
                console.error(err)
        }

        const variableIds = uniq(chart.dimensions.map(d => d.variableId))
        if (!variableIds.length) return

        // Make sure we bake the variables successfully before outputing the chart config
        const vardataPath = `${this.baseDir}/data/variables/${variableIds.join("+")}`
        if (!isConfigIdentical || props.regenData) {
            await this.bakeVariableData(variableIds, vardataPath)
        }

        //if (!isConfigIdentical || props.regenConfig)
        await Promise.all([this.bakeChartConfig(chart), this.bakeChartPage(chart)])

        // Twitter/fb cards are expensive to make and not super important, so we keep the old ones if we can
        try {
            await fs.mkdirp(`${this.baseDir}/exports/`)
            const imagePath = `${this.baseDir}/exports/${chart.slug}.png`
            if (!fs.existsSync(imagePath) || props.regenImages) {
                const vardata = await fs.readFile(vardataPath, 'utf8')
                await bakeMediaCard(`${this.baseDir}/exports`, chart, vardata)
                this.stage(imagePath)
            }
        } catch (err) {
            console.error(err)
        }
    }

    async bakeRedirects() {
        const {pathRoot, repoDir} = this.props
        const redirects = []

        // Redirect /grapher/latest
        const latestRows = await this.db.query(`SELECT JSON_EXTRACT(config, "$.slug") as slug FROM charts where starred=1`)
        for (const row of latestRows) {
            redirects.push(`${pathRoot}/latest ${pathRoot}/${JSON.parse(row.slug)} 302`)
        }

        // Redirect chart ids to slugs
        const idRows = await this.db.query(`SELECT id, JSON_EXTRACT(config, "$.slug") as slug FROM charts`)
        for (const row of idRows) {
            redirects.push(`${pathRoot}/${row.id}.config.json ${pathRoot}/${JSON.parse(row.slug)}.config.json`)
            redirects.push(`${pathRoot}/${row.id} ${pathRoot}/${JSON.parse(row.slug)} 302`)
        }

        // Redirect old slugs to new slugs
        const rows = await this.db.query(`
            SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
            FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
        `)

        for (const row of rows) {
            const trueSlug = JSON.parse(row.trueSlug)
            if (row.slug !== trueSlug) {
                redirects.push(`${pathRoot}/${row.slug}.config.json ${pathRoot}/${trueSlug}.config.json 302`)
                redirects.push(`${pathRoot}/${row.slug} ${pathRoot}/${trueSlug} 302`)
            }
        }

        await fs.writeFile(`${repoDir}/_redirects`, redirects.join("\n"))
        this.stage(`${repoDir}/_redirects`)
    }

    async bakeHeaders() {
        const {pathRoot, repoDir} = this.props

        const headers = `${pathRoot}/data/variables/*
  Cache-Control: public, max-age=31556926
  Access-Control-Allow-Origin: *

${pathRoot}/assets/*
  Cache-Control: public, max-age=31556926

${pathRoot}/exports/*
  Cache-Control: public, max-age=31556926

${pathRoot}/*.json
  Access-Control-Allow-Origin: *
`
        await fs.writeFile(`${repoDir}/_headers`, headers)
        this.stage(`${repoDir}/_headers`)
    }

    async bakeCharts(opts: { regenConfig?: boolean, regenData?: boolean, regenImages?: boolean } = {}) {
        const {db, baseDir, props} = this
        const rows = await db.query(`SELECT id, config, updated_at FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true ORDER BY slug ASC`)

        const newSlugs = []
        let requests = []
        for (const row of rows) {
            const chart: ChartConfigProps = JSON.parse(row.config)
            chart.id = row.id
            newSlugs.push(chart.slug)

            requests.push(this.bakeChart(chart))
            // Execute in batches
            if (requests.length > 50) {
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
                const paths = [`${baseDir}/${slug}.config.json`, `${baseDir}/${slug}.html`, `${baseDir}/exports/${slug}.png`]//, `${baseDir}/exports/${slug}.svg`]
                await Promise.all(paths.map(p => fs.unlink(p)))
                paths.map(p => this.stage(p))
            } catch (err) {
                console.error(err)
            }
        }

        return Promise.all(requests)
    }

    async bakeAll() {
        await this.bakeRedirects()
        await this.bakeHeaders()
        await this.bakeAssets()
        await this.bakeCharts()
    }

    exec(cmd: string) {
        console.log(cmd)
        shell.exec(cmd)
    }

    stage(targetPath: string) {
        console.log(targetPath)
        this.stagedFiles.push(targetPath)
    }

    async deploy(authorEmail?: string, authorName?: string, commitMsg?: string) {
        const {repoDir} = this.props
        for (const files of chunk(this.stagedFiles, 100)) {
            this.exec(`cd ${repoDir} && git add -A ${files.join(" ")}`)
        }
        if (authorEmail && authorName && commitMsg) {
            this.exec(`cd ${repoDir} && git commit --author='${authorName} <${authorEmail}>' -m '${commitMsg}' && git push origin master`)
        } else {
            this.exec(`cd ${repoDir} && git commit -m "Automated update" && git push origin master`)
        }
    }

    async end() {
        return this.db.end()
    }
}
