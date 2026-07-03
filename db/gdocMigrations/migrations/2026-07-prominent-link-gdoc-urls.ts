import { extractUrl } from "../../model/Gdoc/gdocUtils.js"
import {
    defineGdocMigration,
    EnrichedBlockJson,
    RawBlockJson,
} from "../types.js"

/**
 * Rewrites internal {.prominent-link} URLs from https://ourworldindata.org/…
 * to the docs.google.com URL of the gdoc behind them, so the content graph
 * resolves and metadata (title, excerpt, thumbnail) comes from the linked
 * doc automatically. Explicitly-set metadata that the link now provides is
 * dropped; `description` is kept, since it may be an intentional override.
 *
 * Value-only migration: no interface changes or parser alias needed. URLs
 * that don't cleanly resolve to a single published gdoc (grapher pages,
 * anchors/query strings, redirect wildcards, ambiguous slugs) are left
 * unchanged — re-run after fixing and they'll be picked up.
 */

async function resolveUrl(
    url: unknown,
    resolve: (url: string) => Promise<string | null>
): Promise<string | null> {
    if (typeof url !== "string") return null
    // raw values may be link-styled: url: <a href="https://…">…</a>
    return resolve(extractUrl(url))
}

export default defineGdocMigration({
    name: "prominent-link-gdoc-urls",
    mode: "component",
    blockType: "prominent-link",
    discover: `
        SELECT DISTINCT gdocId
        FROM posts_gdocs_components
        WHERE config->>'$.type' = 'prominent-link'
          AND config->>'$.url' LIKE 'https://ourworldindata.org/%'
    `,
    transform: async (block, context): Promise<RawBlockJson> => {
        const gdocUrl = await resolveUrl(
            block.value.url,
            context.resolveOwidUrlToGdocUrl
        )
        if (!gdocUrl) return block
        const value: Record<string, unknown> = { ...block.value, url: gdocUrl }
        delete value.title
        delete value.thumbnail
        delete value.filename // not a real key, but authors have typed it
        return { ...block, value }
    },
    dbTransform: async (block, context): Promise<EnrichedBlockJson> => {
        const gdocUrl = await resolveUrl(
            block.url,
            context.resolveOwidUrlToGdocUrl
        )
        if (!gdocUrl) return block
        const result: EnrichedBlockJson = { ...block, url: gdocUrl }
        delete result.title
        delete result.thumbnail
        return result
    },
})
