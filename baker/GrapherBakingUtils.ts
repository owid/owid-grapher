import * as _ from "lodash-es"
import fs from "fs-extra"

import * as db from "../db/db.js"
import { DbPlainTag } from "@ourworldindata/utils"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"

/**
 * Given a topic tag's name, return its slug.
 */
export async function getSlugForTopicTag(
    knex: db.KnexReadonlyTransaction,
    tagName: string
): Promise<string | undefined> {
    const tag = await db.knexRawFirst<Pick<DbPlainTag, "slug">>(
        knex,
        `-- sql
        SELECT slug FROM tags WHERE name = ? AND slug IS NOT NULL`,
        [tagName]
    )

    return tag?.slug ?? undefined
}

export async function deleteOldGraphers(
    bakedSiteDir: string,
    newSlugs: string[]
) {
    // Delete any that are missing from the database
    const oldSlugs = fs
        .globSync(`${bakedSiteDir}/grapher/*.html`)
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
