import * as glob from "glob"
import parseUrl from "url-parse"
import * as path from "path"
import * as lodash from "lodash"
import md5 from "md5"

import { BAKED_BASE_URL, OPTIMIZE_SVG_EXPORTS } from "settings"
import { BAKED_SITE_DIR } from "serverSettings"
import * as db from "db/db"
import { bakeGraphersToSvgs } from "baker/GrapherImageBaker"
import { log } from "adminSiteServer/log"
import { Chart } from "db/model/Chart"

// Given a grapher url with query string, create a key to match export filenames
export function grapherUrlToFilekey(grapherUrl: string) {
    const url = parseUrl(grapherUrl)
    const slug = lodash.last(url.pathname.split("/")) as string
    const queryStr = (url.query as unknown) as string
    return `${slug}${queryStr ? "-" + md5(queryStr) : ""}`
}

interface ChartExportMeta {
    key: string
    svgUrl: string
    version: number
    width: number
    height: number
}

export interface GrapherExports {
    get: (grapherUrl: string) => ChartExportMeta | undefined
}

export async function bakeGrapherUrls(urls: string[]) {
    const currentExports = await getGrapherExportsByUrl()
    const slugToId = await Chart.mapSlugsToIds()
    const toBake = []

    // Check that we need to bake this url, and don't already have an export
    for (const url of urls) {
        const current = currentExports.get(url)
        if (!current) {
            toBake.push(url)
            continue
        }

        const slug = lodash.last(parseUrl(url).pathname.split("/"))
        if (!slug) {
            log.warn(`Invalid chart url ${url}`)
            continue
        }

        const chartId = slugToId[slug]
        if (chartId === undefined) {
            log.warn(`Couldn't find chart with slug ${slug}`)
            continue
        }

        const rows = await db.query(
            `SELECT charts.config->>"$.version" AS version FROM charts WHERE charts.id=?`,
            [chartId]
        )
        if (!rows.length) {
            log.warn(`Mysteriously missing chart by id ${chartId}`)
            continue
        }

        if (rows[0].version > current.version) {
            toBake.push(url)
        }
    }

    if (toBake.length > 0) {
        for (const grapherUrls of lodash.chunk(toBake, 50)) {
            await bakeGraphersToSvgs(
                grapherUrls,
                `${BAKED_SITE_DIR}/exports`,
                OPTIMIZE_SVG_EXPORTS
            )
        }
    }
}

export async function getGrapherExportsByUrl(): Promise<GrapherExports> {
    // Index the files to see what we have available, using the most recent version
    // if multiple exports exist
    const files = glob.sync(`${BAKED_SITE_DIR}/exports/*.svg`)
    const exportsByKey = new Map<string, ChartExportMeta>()
    for (const filepath of files) {
        const filename = path.basename(filepath)
        const [key, version, dims] = filename.toLowerCase().split("_")
        const versionNumber = parseInt(version.split("v")[1])
        const [width, height] = dims.split("x")

        const current = exportsByKey.get(key)
        if (!current || current.version < versionNumber) {
            exportsByKey.set(key, {
                key: key,
                svgUrl: `${BAKED_BASE_URL}/exports/${filename}`,
                version: versionNumber,
                width: parseInt(width),
                height: parseInt(height),
            })
        }
    }

    return {
        get(grapherUrl: string) {
            return exportsByKey.get(
                grapherUrlToFilekey(grapherUrl).toLowerCase()
            )
        },
    }
}
interface ChartItemWithTags {
    id: number
    slug: string
    title: string
    tags: { id: number; name: string }[]
}

// Find all the charts we want to show on public listings
export async function getIndexableCharts(): Promise<ChartItemWithTags[]> {
    const chartItems = await db.query(
        `SELECT id, config->>"$.slug" AS slug, config->>"$.title" AS title FROM charts WHERE publishedAt IS NOT NULL`
    )

    const chartTags = await db.query(`
        SELECT ct.chartId, ct.tagId, t.name as tagName, t.parentId as tagParentId FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `)

    for (const c of chartItems) {
        c.tags = []
    }

    const chartsById = lodash.keyBy(chartItems, (c) => c.id)

    for (const ct of chartTags) {
        // XXX hardcoded filtering to public parent tags
        if (
            [
                1515,
                1507,
                1513,
                1504,
                1502,
                1509,
                1506,
                1501,
                1514,
                1511,
                1500,
                1503,
                1505,
                1508,
                1512,
                1510,
            ].indexOf(ct.tagParentId) === -1
        )
            continue

        const c = chartsById[ct.chartId]
        if (c) c.tags.push({ id: ct.tagId, name: ct.tagName })
    }

    return chartItems
}
