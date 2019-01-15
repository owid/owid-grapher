import * as glob from 'glob'
import * as parseUrl from 'url-parse'
const exec = require('child-process-promise').exec
import * as path from 'path'
import * as _ from 'lodash'
import * as md5 from 'md5'

import {GRAPHER_DIR, BAKED_DIR} from './settings'
import * as grapherDb from './grapherDb'

// Given a grapher url with query string, create a key to match export filenames
export function grapherUrlToFilekey(grapherUrl: string) {
    const url = parseUrl(grapherUrl)
    const slug = _.last(url.pathname.split('/')) as string
    const queryStr = url.query as any
    return `${slug}${queryStr ? "-"+md5(queryStr) : ""}`
}

interface ChartExportMeta {
    key: string
    svgUrl: string
    version: number
    width: number
    height: number
}

export interface GrapherExports {
    get: (grapherUrl: string) => ChartExportMeta
}

export async function mapSlugsToIds(): Promise<{ [slug: string]: number }> {
    const redirects = await grapherDb.query(`SELECT chart_id, slug FROM chart_slug_redirects`)
    const rows = await grapherDb.query(`SELECT id, JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug FROM charts`)

    const slugToId: {[slug: string]: number} = {}
    for (const row of redirects) {
        slugToId[row.slug] = row.chart_id
    }
    for (const row of rows) {
        slugToId[row.slug] = row.id
    }
    return slugToId
}

export async function bakeGrapherUrls(urls: string[], opts: { silent?: boolean } = {}) {
    const currentExports = await getGrapherExportsByUrl()
    const slugToId = await mapSlugsToIds()
    const toBake = []

    // Check that we need to bake this url, and don't already have an export
    for (const url of urls) {
        const current = currentExports.get(url)
        if (!current) {
            toBake.push(url)
            continue
        }

        const slug = _.last(parseUrl(url).pathname.split('/'))
        if (!slug) {
            console.error(`Invalid chart url ${url}`)
            continue
        }

        const chartId = slugToId[slug]  
        const rows = await grapherDb.query(`SELECT charts.config->>"$.version" AS version FROM charts WHERE charts.id=?`, [chartId])
        if (!rows.length) {
            console.error(`Mysteriously missing chart by id ${chartId}`)
            continue
        }

        if (rows[0].version > current.version) {
            toBake.push(url)
        }
    }

    if (toBake.length > 0) {
        const args = [`${GRAPHER_DIR}/dist/src/bakeChartsToImages.js`]
        args.push(...toBake)
        args.push(`${BAKED_DIR}/exports`)
        const promise = exec(`cd ${GRAPHER_DIR} && node ${args.map(arg => JSON.stringify(arg)).join(" ")}`)
        if (!opts.silent)
            promise.childProcess.stdout.on('data', (data: any) => console.log(data.toString().trim()))
        await promise    
    }

}

export async function getGrapherExportsByUrl(): Promise<{ get: (grapherUrl: string) => ChartExportMeta }> {
    // Index the files to see what we have available, using the most recent version
    // if multiple exports exist
    const files = glob.sync(`${BAKED_DIR}/exports/*.svg`)
    const exportsByKey = new Map()
    for (const filepath of files) {
        const filename = path.basename(filepath)
        const [key, version, dims] = filename.split("_")
        const versionNumber = parseInt(version.split('v')[1])
        const [width, height] = dims.split("x")

        const current = exportsByKey.get(key)
        if (!current || current.version < versionNumber) {
            exportsByKey.set(key, {
                key: key,
                svgUrl: `/exports/${filename}`,
                version: versionNumber,
                width: parseInt(width),
                height: parseInt(height)
            })
        }
    }

    return {
        get(grapherUrl: string) {
            return exportsByKey.get(grapherUrlToFilekey(grapherUrl))
        }
    }
}