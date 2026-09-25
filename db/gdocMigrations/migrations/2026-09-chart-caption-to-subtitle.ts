import { defineGdocMigration } from "../types.js"
import { renameEnrichedProperty, renameProperty } from "../helpers.js"

/**
 * Renames the `caption` property of `{.chart}` blocks to `subtitle`.
 *
 *   {.chart}                 {.chart}
 *   caption: Foo      →      subtitle: Foo
 *   {}                       {}
 */
export default defineGdocMigration({
    name: "2026-09-chart-caption-to-subtitle",
    mode: "component",
    blockType: "chart",
    discover: `
        SELECT DISTINCT gdocId
        FROM posts_gdocs_components
        WHERE config->>'$.type' = 'chart'
          AND JSON_CONTAINS_PATH(config, 'one', '$.caption')
    `,
    transform: renameProperty("caption", "subtitle"),
    dbTransform: renameEnrichedProperty("caption", "subtitle"),
    dbDownTransform: renameEnrichedProperty("subtitle", "caption"),
})
