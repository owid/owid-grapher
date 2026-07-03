import { defineGdocMigration } from "../types.js"
import { renameKey } from "../helpers.js"

/**
 * Example frontmatter migration, kept as a template and for testing against
 * a personal doc:
 *
 *   yarn gdocMigration plan --migration _example-frontmatter-rename --id <yourTestDocId>
 *
 * Each op applies to both sides: the doc's top-level `key: value` line
 * (matched case-insensitively) and the parsed field in posts_gdocs.content.
 * Ops touching denormalized frontmatter (type, slug, authors) also update
 * the corresponding posts_gdocs column.
 */
export default defineGdocMigration({
    name: "_example-frontmatter-rename",
    mode: "frontmatter",
    discover: `
        SELECT id
        FROM posts_gdocs
        WHERE JSON_CONTAINS_PATH(content, 'one', '$."hide-subscribe-banner"')
    `,
    ops: [renameKey("hide-subscribe-banner", "hide-newsletter-banner")],
})
