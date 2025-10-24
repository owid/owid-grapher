import * as _ from "lodash-es"
import fs from "fs-extra"
import * as R from "remeda"

import * as db from "../db/db.js"
import {
    DbPlainTag,
    DbPlainUser,
    Url,
    PostsGdocsTableName,
    OwidGdocType,
} from "@ourworldindata/utils"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { hashMd5 } from "../serverUtils/hash.js"
import { BAKE_ON_CHANGE } from "../settings/serverSettings.js"
import { DeployQueueServer } from "./DeployQueueServer.js"

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
 * Returns a set of tags that have at least one published data insight.
 * e.g.
 *   "Women's Rights" -> true
 *   123 -> true
 */
export async function getTagsWithDataInsights(
    knex: db.KnexReadonlyTransaction
): Promise<Set<string>> {
    // Query for tags that have any published data insights
    const rows = await db.knexRaw<{ name: string }>(
        knex,
        `
        SELECT DISTINCT t.name
        FROM tags t
        JOIN ${PostsGdocsTableName}_x_tags pgt ON t.id = pgt.tagId
        JOIN ${PostsGdocsTableName} pg ON pgt.gdocId = pg.id
        WHERE
            t.slug IS NOT NULL
            AND pg.type = "${OwidGdocType.DataInsight}"
            AND pg.published = 1
            AND pg.publishedAt <= NOW()
        `
    )

    return new Set(rows.map((row) => row.name))
}

/**
 * Given a topic tag's name or ID, return its slug
 * Throws an error if no slug is found so we can log it in Sentry
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
// Call this to trigger build and deployment of static charts on change

export const triggerStaticBuild = async (
    user: DbPlainUser,
    commitMessage: string
) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
    })
}
