import { defineGdocMigration } from "../types.js"
import { renameEnrichedProperty, renameProperty } from "../helpers.js"

/**
 * Example migration, kept as a template and for testing the tool against a
 * personal doc (the underscore prefix marks it as not-a-real-migration):
 *
 *   yarn gdocMigration plan --migration _example-chart-caption-to-subtitle --id <yourTestDocId>
 *
 * The service account (GDOCS_CLIENT_EMAIL) needs edit access to the doc.
 *
 * A real migration also ships a thin db/migration wrapper that applies
 * `dbTransform` to posts_gdocs.content at deploy time:
 *
 *   await applyGdocMigrationToDb(queryRunner, chartCaptionToSubtitle)
 */
export default defineGdocMigration({
    name: "_example-chart-caption-to-subtitle",
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
})
