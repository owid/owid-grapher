import * as _ from "lodash-es"
import fs from "fs-extra"
import { glob } from "glob"
import * as R from "remeda"

import { Url } from "@ourworldindata/utils"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { hashMd5 } from "../serverUtils/hash.js"

// Splits a grapher URL like https://ourworldindata.org/grapher/soil-lifespans?tab=chart
// into its slug (soil-lifespans) and queryStr (?tab=chart)
export const grapherUrlToSlugAndQueryStr = (grapherUrl: string) => {
    const url = Url.fromURL(grapherUrl)
    const slug = R.last(url.pathname?.split("/") ?? []) as string // todo / refactor: use Url.slug
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
        ? hashMd5(queryStr ?? "")
        : queryStr
    return `${slug}${queryStr ? `${separator}${maybeHashedQueryStr}` : ""}`
}

export async function deleteOldGraphers(
    bakedSiteDir: string,
    newSlugs: string[]
) {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = _.without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        const path = `${bakedSiteDir}/grapher/${slug}.html`
        console.log(`DELETING ${path}`)
        fs.unlink(path, (err) => {
            if (err) console.error(`Error deleting ${path}`, err)
        })
    }
}
