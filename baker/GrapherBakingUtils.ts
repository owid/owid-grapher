import * as glob from "glob"
import parseUrl from "url-parse"
import * as path from "path"
import * as lodash from "lodash"
import { BAKED_BASE_URL, OPTIMIZE_SVG_EXPORTS } from "settings"
import { BAKED_SITE_DIR } from "serverSettings"
import * as db from "db/db"
import { bakeGraphersToSvgs } from "baker/GrapherImageBaker"
import { log } from "adminSiteServer/log"
import { Chart } from "db/model/Chart"
import md5 from "md5"

interface ChartExportMeta {
    key: string
    svgUrl: string
    version: number
    width: number
    height: number
}

// Given a grapher url with query string, create a key to match export filenames
const grapherUrlToFilekey = (grapherUrl: string) => {
    const url = parseUrl(grapherUrl)
    const slug = lodash.last(url.pathname.split("/")) as string
    const queryStr = (url.query as unknown) as string
    return `${slug}${queryStr ? "-" + md5(queryStr) : ""}`
}

export interface GrapherExports {
    get: (grapherUrl: string) => ChartExportMeta | undefined
}

export const bakeGrapherUrls = async (urls: string[]) => {
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

        if (rows[0].version > current.version) toBake.push(url)
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

export const getGrapherExportsByUrl = async (): Promise<GrapherExports> => {
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
