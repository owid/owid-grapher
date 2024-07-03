import { glob } from "glob"
import path from "path"
import * as lodash from "lodash"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_SITE_DIR,
} from "../settings/serverSettings.js"
import { BAKED_SITE_EXPORTS_BASE_URL } from "../settings/clientSettings.js"

import * as db from "../db/db.js"
import { bakeGraphersToSvgs } from "../baker/GrapherImageBaker.js"
import { warn } from "../serverUtils/errorLog.js"
import { mapSlugsToIds } from "../db/model/Chart.js"
import md5 from "md5"
import { DbPlainTag, Url } from "@ourworldindata/utils"

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
    queryStr: string | undefined,
    {
        shouldHashQueryStr = true,
        separator = "-",
    }: { shouldHashQueryStr?: boolean; separator?: string } = {}
) => {
    const maybeHashedQueryStr = shouldHashQueryStr
        ? md5(queryStr ?? "")
        : queryStr
    return `${slug}${queryStr ? `${separator}${maybeHashedQueryStr}` : ""}`
}

export interface GrapherExports {
    get: (grapherUrl: string) => ChartExportMeta | undefined
}

export const bakeGrapherUrls = async (
    knex: db.KnexReadonlyTransaction,
    urls: string[]
) => {
    const currentExports = await getGrapherExportsByUrl()
    const slugToId = await mapSlugsToIds(knex)
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

        const rows = await db.knexRaw<{ version: number }>(
            knex,
            `-- sql
                SELECT cc.config->>"$.version" AS version
                FROM charts c
                JOIN chart_configs cc ON c.configId = cc.id
                WHERE c.id=?
            `,
            [chartId]
        )
        if (!rows.length) {
            warn(`Mysteriously missing chart by id ${chartId}`)
            continue
        }

        if (rows[0].version > current.version) toBake.push(url)
    }

    if (toBake.length > 0) {
        await bakeGraphersToSvgs(
            knex,
            toBake,
            `${BAKED_SITE_DIR}/exports`,
            OPTIMIZE_SVG_EXPORTS
        )
    }
}

export const getGrapherExportsByUrl = async (): Promise<GrapherExports> => {
    // Index the files to see what we have available, using the most recent version
    // if multiple exports exist
    const files = await glob(`${BAKED_SITE_DIR}/exports/*.svg`)
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
                svgUrl: `${BAKED_SITE_EXPORTS_BASE_URL}/${filename}`,
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

/**
 * Returns a map that can resolve Tag names and Tag IDs to the Tag's slug
 * e.g.
 *   "Women's Rights" -> "womens-rights"
 *   123 -> "womens-rights"
 */
export async function getTagToSlugMap(
    knex: db.KnexReadonlyTransaction
): Promise<Record<string | number, string>> {
    const tags = await db.knexRaw<Pick<DbPlainTag, "name" | "id" | "slug">>(
        knex,
        `SELECT slug, name, id FROM tags WHERE slug IS NOT NULL`
    )
    const tagsByIdAndName: Record<string | number, string> = {}
    for (const tag of tags) {
        if (tag.slug) {
            tagsByIdAndName[tag.name] = tag.slug
            tagsByIdAndName[tag.id] = tag.slug
        }
    }

    return tagsByIdAndName
}

/**
 * Given a topic tag's name or ID, return its slug
 * Throws an error if no slug is found so we can log it in Bugsnag
 */
export async function getSlugForTopicTag(
    knex: db.KnexReadonlyTransaction,
    identifier: string | number
): Promise<string> {
    const propertyToMatch = typeof identifier === "string" ? "slug" : "id"
    const tagsByIdAndName = await getTagToSlugMap(knex)
    const slug = tagsByIdAndName[identifier]

    if (!slug) {
        throw new Error(
            `No slug found for tag with ${propertyToMatch}: "${identifier}"`
        )
    }

    return slug
}
