import * as db from "../db/db.js"
import { DbPlainExplorer } from "@ourworldindata/types"
import { refreshExplorerViewsForSlug } from "../db/model/ExplorerViews.js"

interface ExplorerProcessingStats {
    slug: string
    viewCount: number
    duration: number
}

async function fetchPublishedExplorers(
    knex: db.KnexReadonlyTransaction
): Promise<Pick<DbPlainExplorer, "slug" | "tsv">[]> {
    return db.knexRaw(
        knex,
        `-- sql
            SELECT slug, tsv
            FROM explorers
            WHERE isPublished IS TRUE
        `
    )
}

async function prepareGrapherConfigsForExplorerViews(
    knex: db.KnexReadWriteTransaction
): Promise<ExplorerProcessingStats[]> {
    // Delete all existing explorer views and associated chart configs first
    await db.knexRaw(
        knex,
        `
        DELETE cc FROM chart_configs cc
        INNER JOIN explorer_views ev ON cc.id = ev.chartConfigId
    `
    )
    await db.knexRaw(knex, "DELETE FROM explorer_views")

    const explorers = await fetchPublishedExplorers(knex)
    const stats: ExplorerProcessingStats[] = []

    for (const explorer of explorers) {
        const startTime = performance.now()

        await refreshExplorerViewsForSlug(knex, explorer.slug)

        // Get the view count after refreshing
        const newViewCount = await knex("explorer_views")
            .where({ explorerSlug: explorer.slug })
            .count("* as count")
            .first()

        const endTime = performance.now()
        const duration = Math.round(endTime - startTime)

        stats.push({
            slug: explorer.slug,
            viewCount: Number(newViewCount?.count || 0),
            duration,
        })
    }

    return stats
}

function printStatsTable(stats: ExplorerProcessingStats[]): void {
    console.log("\n" + "=".repeat(70))
    console.log("Explorer Processing Statistics")
    console.log("=".repeat(70))
    console.log(
        "Explorer".padEnd(30) +
            "Views".padStart(8) +
            "Duration (ms)".padStart(15)
    )
    console.log("-".repeat(70))

    for (const stat of stats) {
        console.log(
            stat.slug.padEnd(30) +
                stat.viewCount.toString().padStart(8) +
                stat.duration.toString().padStart(15)
        )
    }

    const totalViews = stats.reduce((sum, stat) => sum + stat.viewCount, 0)
    const totalDuration = stats.reduce((sum, stat) => sum + stat.duration, 0)

    console.log("-".repeat(70))
    console.log(
        "TOTAL".padEnd(30) +
            totalViews.toString().padStart(8) +
            totalDuration.toString().padStart(15)
    )
    console.log("=".repeat(70))
}

const main = async (): Promise<void> => {
    const showStats = process.argv.includes("--stats")

    try {
        const stats = await db.knexReadWriteTransaction(
            (trx) => prepareGrapherConfigsForExplorerViews(trx),
            db.TransactionCloseMode.Close
        )

        if (showStats) {
            printStatsTable(stats)
        }
    } catch (e) {
        console.error(e)
    }
}

void main()
