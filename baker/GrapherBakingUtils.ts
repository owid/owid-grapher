import glob from "glob"
import * as path from "path"
import * as lodash from "lodash-es"
import {
    BAKED_BASE_URL,
    OPTIMIZE_SVG_EXPORTS,
    BAKED_SITE_DIR,
} from "../settings/serverSettings.js"

import * as db from "../db/db.js"
import { bakeGraphersToSvgs } from "../baker/GrapherImageBaker.js"
import { warn } from "../serverUtils/slackLog.js"
import { Chart } from "../db/model/Chart.js"
import md5 from "md5"
import { Url } from "../clientUtils/urls/Url.js"

interface ChartExportMeta {
    key: string
    svgUrl: string
    version: number
    width: number
    height: number
}

// Splits a grapher URL like https://ourworldindata.org/grapher/soil-lifespans?tab=chart
// into its slug (soil-lifespans) and queryStr (?tab=chart)
export const grapherUrlToSlugAndQueryStr = (grapherUrl: string) => {
    const url = Url.fromURL(grapherUrl)
    const slug = lodash.last(url.pathname?.split("/")) as string // todo / refactor: use Url.slug
    const queryStr = url.queryStr
    return { slug, queryStr }
}

// Combines a grapher slug, and potentially its query string, to _part_ of an export file
// name. It's called fileKey and not fileName because the actual export filename also includes
// other parts, like chart version and width/height.
export const grapherSlugToExportFileKey = (
    slug: string,
    queryStr: string | undefined
) => `${slug}${queryStr ? `-${md5(queryStr)}` : ""}`

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

        const slug = lodash.last(Url.fromURL(url).pathname?.split("/"))
        if (!slug) {
            warn(`Invalid chart url ${url}`)
            continue
        }

        const chartId = slugToId[slug]
        if (chartId === undefined) {
            warn(`Couldn't find chart with slug ${slug}`)
            continue
        }

        const rows = await db.queryMysql(
            `SELECT charts.config->>"$.version" AS version FROM charts WHERE charts.id=?`,
            [chartId]
        )
        if (!rows.length) {
            warn(`Mysteriously missing chart by id ${chartId}`)
            continue
        }

        if (rows[0].version > current.version) toBake.push(url)
    }

    if (toBake.length > 0) {
        for (const grapherUrls of lodash.chunk(toBake, 5)) {
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
            const { slug, queryStr } = grapherUrlToSlugAndQueryStr(grapherUrl)
            return exportsByKey.get(
                grapherSlugToExportFileKey(slug, queryStr).toLowerCase()
            )
        },
    }
}
