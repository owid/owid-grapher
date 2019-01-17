// Build all charts into a static bundle
// Should support incremental builds for performance
import { ENV, BUILD_GRAPHER_PATH, BASE_DIR } from './settings'

import { uniq, without, chunk } from 'lodash'
import * as fs from 'fs-extra'
import * as React from 'react'
import * as path from 'path'
import * as glob from 'glob'
const md5 = require('md5')

import * as db from './db'
import { embedSnippet } from './staticGen'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import {ChartPage} from './site/ChartPage'
import { bakeImageExports } from './svgPngExport'
import { getVariableData } from './model/Variable'
import { renderToHtmlPage, exec } from './admin/serverUtil'

export interface ChartBakerProps {
    repoDir: string
}

export class ChartBaker {
    props: ChartBakerProps
    baseDir: string

    // Keep a list of the files we've generated to add to git later
    stagedFiles: string[] = []

    constructor(props: ChartBakerProps) {
        this.props = props
        this.baseDir = path.join(this.props.repoDir, BUILD_GRAPHER_PATH)
        fs.mkdirpSync(this.baseDir)
    }

    async bakeAssets() {
        if (ENV === "production") {
            const buildDir = `dist/webpack`

            const manifest = JSON.parse(await fs.readFile(`${buildDir}/manifest.json`, 'utf8'))

            await fs.mkdirp(path.join(this.baseDir, 'assets'))

            for (const key in manifest) {
                if (key === "charts.js" || key === "commons.css" || key === "commons.js") {
                    const outPath = path.join(this.baseDir, `assets/${key === "commons.css" ? 'css/' : 'js/'}/${manifest[key]}`)
                    fs.copySync(`${buildDir}/${manifest[key]}`, outPath)
                    this.stage(outPath)
                } else if (key.match(/.js$/) || key.match(/.css$/)) {
                    continue // Not interested in the admin js/css, but keep the fonts and such
                }
            }
        }

        await fs.writeFile(`${this.baseDir}/embedCharts.js`, embedSnippet())
        this.stage(`${this.baseDir}/embedCharts.js`)
    }

    async bakeVariableData(variableIds: number[], outPath: string): Promise<string> {
        await fs.mkdirp(`${this.baseDir}/data/variables/`)
        const vardata = await getVariableData(variableIds)
        await fs.writeFile(outPath, JSON.stringify(vardata))
        this.stage(outPath)
        return vardata
    }

    async bakeChartPage(chart: ChartConfigProps) {
        const outPath = `${this.baseDir}/${chart.slug}.html`
        await fs.writeFile(outPath, renderToHtmlPage(<ChartPage chart={chart}/>))
        this.stage(outPath)
    }

    async bakeChart(chart: ChartConfigProps) {
        const {baseDir, props} = this

        const htmlPath = `${baseDir}/${chart.slug}.html`
        let isSameVersion = false
        try {
            // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
            const html = await fs.readFile(htmlPath, 'utf8')
            const match = html.match(/jsonConfig\s*=\s*(\{.+\})/)
            if (match) {
                const fileVersion = JSON.parse(match[1]).version
                isSameVersion = chart.version === fileVersion
            }
        } catch (err) {
            if (err.code !== 'ENOENT')
                console.error(err)
        }

        const variableIds = uniq(chart.dimensions.map(d => d.variableId))
        if (!variableIds.length) return

        // Make sure we bake the variables successfully before outputing the chart html
        const vardataPath = `${this.baseDir}/data/variables/${variableIds.join("+")}.json`
        if (!isSameVersion || !fs.existsSync(vardataPath)) {
            await this.bakeVariableData(variableIds, vardataPath)
        }

        // Always bake the html for every chart; it's cheap to do so
        await this.bakeChartPage(chart)

        try {
            await fs.mkdirp(`${this.baseDir}/exports/`)
            const svgPath = `${this.baseDir}/exports/${chart.slug}.svg`
            const pngPath = `${this.baseDir}/exports/${chart.slug}.png`
            if (!isSameVersion || !fs.existsSync(svgPath) || !fs.existsSync(pngPath)) {
                const vardata = JSON.parse(await fs.readFile(vardataPath, 'utf8'))
                await bakeImageExports(`${this.baseDir}/exports`, chart, vardata)
                this.stage(svgPath)
                this.stage(pngPath)
            }
        } catch (err) {
            console.error(err)
        }
    }

    async bakeRedirects() {
        const {repoDir} = this.props
        const redirects = []

        // Redirect /grapher/latest
        const latestRows = await db.query(`SELECT JSON_EXTRACT(config, "$.slug") as slug FROM charts where starred=1`)
        for (const row of latestRows) {
            redirects.push(`${BUILD_GRAPHER_PATH}/latest ${BUILD_GRAPHER_PATH}/${JSON.parse(row.slug)} 302`)
        }

        // Redirect old slugs to new slugs
        const rows = await db.query(`
            SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
            FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
        `)

        for (const row of rows) {
            const trueSlug = JSON.parse(row.trueSlug)
            if (row.slug !== trueSlug) {
                redirects.push(`${BUILD_GRAPHER_PATH}/${row.slug} ${BUILD_GRAPHER_PATH}/${trueSlug} 302`)
            }
        }

        await fs.writeFile(`${repoDir}/_redirects`, redirects.join("\n"))
        this.stage(`${repoDir}/_redirects`)
    }

    async bakeHeaders() {
        const {repoDir} = this.props

        const headers = `${BUILD_GRAPHER_PATH}/data/variables/*
  Cache-Control: public, max-age=31556926
  Access-Control-Allow-Origin: *

${BUILD_GRAPHER_PATH}/assets/*
  Cache-Control: public, max-age=31556926

${BUILD_GRAPHER_PATH}/exports/*
  Cache-Control: public, max-age=31556926

${BUILD_GRAPHER_PATH}/*
  Access-Control-Allow-Origin: *
`
        await fs.writeFile(`${repoDir}/_headers`, headers)
        this.stage(`${repoDir}/_headers`)
    }

    async bakeCharts(opts: { regenConfig?: boolean, regenData?: boolean, regenImages?: boolean } = {}) {
        const {baseDir, props} = this
        const rows = await db.query(`SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true ORDER BY JSON_EXTRACT(config, "$.slug") ASC`)

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
        const oldSlugs = glob.sync(`${baseDir}/*.html`).map(slug => slug.replace(`${baseDir}/`, '').replace(".html", ""))
        const toRemove = without(oldSlugs, ...newSlugs)
        for (const slug of toRemove) {
            console.log(`DELETING ${slug}`)
            try {
                const paths = [`${baseDir}/${slug}.html`, `${baseDir}/exports/${slug}.png`]//, `${baseDir}/exports/${slug}.svg`]
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

    async exec(cmd: string, message?: string) {
        if (message)
            console.log(message)
        else
            console.log(cmd)
        await exec(cmd)
    }

    stage(targetPath: string) {
        console.log(targetPath)
        this.stagedFiles.push(targetPath)
    }

    async deploy(commitMsg: string, authorEmail?: string, authorName?: string) {
        const {repoDir} = this.props

        // Ensure there is a git repo in repoDir
        await this.exec(`cd ${repoDir} && git init`)

        if (fs.existsSync(path.join(repoDir, ".netlify/state.json"))) {
            // Deploy directly to Netlify (faster than using the github hook)
            await this.exec(`cd ${repoDir} && ${BASE_DIR}/node_modules/.bin/netlify deploy -d . --prod`)
        }

        for (const files of chunk(this.stagedFiles, 100)) {
            await this.exec(`cd ${repoDir} && git add -A ${files.join(" ")}`, `Staging ${files.length} files`)
        }
        if (authorEmail && authorName && commitMsg) {
            await this.exec(`cd ${repoDir} && git commit -m '${commitMsg}' --author='${authorName} <${authorEmail}>' && git push origin master`)
        } else {
            await this.exec(`cd ${repoDir} && git commit -m "${commitMsg}" && git push origin master`)
        }
    }

    async end() {
        return db.end()
    }
}
