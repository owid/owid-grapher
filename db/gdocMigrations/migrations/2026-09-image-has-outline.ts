import {
    defineGdocMigration,
    EnrichedBlockJson,
    RawBlockJson,
} from "../types.js"

/**
 * Adds an explicit `hasOutline: true` to every {.image} block that doesn't
 * set it. The parser has always defaulted a missing `hasOutline` to true, so
 * this makes the current behaviour explicit in the docs (and in stored
 * content that pre-dates the property) without changing what is rendered.
 *
 * Value-only migration: no interface changes or parser alias needed. Blocks
 * that already set the property, to either value, are left alone.
 */

function isSet(value: unknown): boolean {
    return value !== undefined && value !== null && value !== ""
}

export default defineGdocMigration({
    name: "2026-09-image-has-outline",
    mode: "component",
    blockType: "image",
    // Parse-time defaulting makes an explicit `hasOutline: true` and a
    // missing one indistinguishable in the DB, so discover every doc with an
    // image block anywhere in its content (posts_gdocs_components only
    // indexes `body`, missing e.g. images inside faqs); the engine re-checks
    // each block against the fetched doc.
    discover: `
        SELECT id AS gdocId
        FROM posts_gdocs
        WHERE JSON_SEARCH(content, 'one', 'image', NULL, '$**.type') IS NOT NULL
    `,
    transform: (block): RawBlockJson => {
        if (isSet(block.value.hasOutline)) return block
        return { ...block, value: { ...block.value, hasOutline: "true" } }
    },
    dbTransform: (block): EnrichedBlockJson => {
        if (isSet(block.hasOutline)) return block
        return { ...block, hasOutline: true }
    },
})
