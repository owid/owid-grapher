import * as db from "../db/db.js"
import { getGptTopicSuggestions } from "../db/model/Chart.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

interface BatchTagWithGptArgs {
    debug?: boolean
    limit?: number
}

/*
Add GPT topics to eligible charts (and later posts, explorers).

Usage:
$ yarn batchTagWithGpt --help

Example: yarn batchTagWithGpt --debug --limit 1

Note: this script is not called automatically yet, and needs to be run manually.
*/
export const batchTagWithGpt = async ({
    debug,
    limit,
}: BatchTagWithGptArgs = {}) => {
    db.knexReadonlyTransaction((trx) =>
        batchTagChartsWithGpt(trx, { debug, limit })
    )
}

const batchTagChartsWithGpt = async (
    knex: db.KnexReadonlyTransaction,
    { debug, limit }: BatchTagWithGptArgs = {}
) => {
    // Identify all charts that need tagging. Get all charts that aren't tagged
    // with a topic tag or the "Unlisted" tag. This includes charts that have no
    // tags at all)
    const chartsToTag = await db.knexRaw<{ id: number }>(
        knex,
        `-- sql
    SELECT id
    FROM charts
    WHERE id
    NOT IN (
        SELECT chartId
        FROM chart_tags
        JOIN tags ON chart_tags.tagId = tags.id
        WHERE tags.slug IS NOT NULL OR tags.name = 'Unlisted'
    )
    GROUP BY id
    ${limit ? `LIMIT ${limit}` : ""}
    `
    )

    // Iterate through the charts and tag them with GPT-suggested topics
    for (const chart of chartsToTag) {
        const gptTopicSuggestions = await getGptTopicSuggestions(knex, chart.id)

        for (const tag of gptTopicSuggestions) {
            if (debug) console.log("Tagging chart", chart.id, "with", tag.id)
            // Insert the suggested chart-tag association if it doesn't already
            // exist, giving priority to the existing tags. This is to make sure
            // already curated tags and their associated key chart levels and
            // validation statuses are preserved.
            await db.knexRaw(
                knex,
                `-- sql
            INSERT IGNORE into chart_tags (chartId, tagId) VALUES (${chart.id},${tag.id})
        `
            )
        }
    }
}

if (require.main === module) {
    yargs(hideBin(process.argv))
        .command<BatchTagWithGptArgs>(
            "$0",
            "Batch tag charts with GPT topics",
            (yargs) => {
                yargs
                    .option("debug", {
                        alias: "d",
                        type: "boolean",
                        description: "Enable debug mode",
                        default: false,
                    })
                    .option("limit", {
                        alias: "l",
                        type: "number",
                        description: "Limit the number of items processed",
                    })
            },
            async (argv) => {
                try {
                    await db.knexReadonlyTransaction((trx) =>
                        batchTagChartsWithGpt(trx, argv)
                    )
                } finally {
                    await db.closeTypeOrmAndKnexConnections()
                }
            }
        )
        .help()
        .alias("help", "h")
        .strict().argv
}
