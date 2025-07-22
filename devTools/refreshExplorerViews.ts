import * as db from "../db/db.js"
import { DbPlainExplorer } from "@ourworldindata/types"
import { refreshExplorerViewsForSlug } from "../db/model/ExplorerViews.js"

interface ExplorerProcessingStats {
    slug: string
    viewCount: number
    successCount: number
    errorCount: number
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

        // Get the view counts after refreshing
        const [totalViews, successViews, errorViews] = await Promise.all([
            knex("explorer_views")
                .where({ explorerSlug: explorer.slug })
                .count("* as count")
                .first(),
            knex("explorer_views")
                .where({ explorerSlug: explorer.slug })
                .whereNotNull("chartConfigId")
                .count("* as count")
                .first(),
            knex("explorer_views")
                .where({ explorerSlug: explorer.slug })
                .whereNotNull("error")
                .count("* as count")
                .first(),
        ])

        const endTime = performance.now()
        const duration = Math.round(endTime - startTime)

        stats.push({
            slug: explorer.slug,
            viewCount: Number(totalViews?.count || 0),
            successCount: Number(successViews?.count || 0),
            errorCount: Number(errorViews?.count || 0),
            duration,
        })
    }

    return stats
}

function printStatsTable(stats: ExplorerProcessingStats[]): void {
    console.log("\n" + "=".repeat(90))
    console.log("Explorer Processing Statistics")
    console.log("=".repeat(90))
    console.log(
        "Explorer".padEnd(25) +
            "Total".padStart(8) +
            "Success".padStart(8) +
            "Errors".padStart(8) +
            "Duration (ms)".padStart(15)
    )
    console.log("-".repeat(90))

    for (const stat of stats) {
        console.log(
            stat.slug.padEnd(25) +
                stat.viewCount.toString().padStart(8) +
                stat.successCount.toString().padStart(8) +
                stat.errorCount.toString().padStart(8) +
                stat.duration.toString().padStart(15)
        )
    }

    const totalViews = stats.reduce((sum, stat) => sum + stat.viewCount, 0)
    const totalSuccess = stats.reduce((sum, stat) => sum + stat.successCount, 0)
    const totalErrors = stats.reduce((sum, stat) => sum + stat.errorCount, 0)
    const totalDuration = stats.reduce((sum, stat) => sum + stat.duration, 0)

    console.log("-".repeat(90))
    console.log(
        "TOTAL".padEnd(25) +
            totalViews.toString().padStart(8) +
            totalSuccess.toString().padStart(8) +
            totalErrors.toString().padStart(8) +
            totalDuration.toString().padStart(15)
    )
    console.log("=".repeat(90))
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
