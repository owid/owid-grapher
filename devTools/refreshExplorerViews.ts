import * as db from "../db/db.js"
import { DbPlainExplorer } from "@ourworldindata/types"
import { refreshExplorerViewsForSlug } from "../db/model/ExplorerViews.js"

interface ExplorerProcessingStats {
    slug: string
    viewCount: number
    successCount: number
    errorCount: number
    duration: number
    isNew: boolean
    failed?: boolean
    failureReason?: string
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
    // Fetch published explorers and existing explorer slugs
    const publishedExplorers = await fetchPublishedExplorers(knex)
    const existingExplorerRows = await db.knexRaw<{ explorerSlug: string }>(
        knex,
        `-- sql
        SELECT DISTINCT explorerSlug
        FROM explorer_views
        `
    )
    const existingExplorerSlugs = new Set(
        existingExplorerRows.map((row) => row.explorerSlug)
    )

    // Categorize explorers into new, existing, and removed
    const publishedSlugs = new Set(publishedExplorers.map((e) => e.slug))
    const newExplorers = publishedExplorers.filter(
        (explorer) => !existingExplorerSlugs.has(explorer.slug)
    )
    const existingExplorers = publishedExplorers.filter((explorer) =>
        existingExplorerSlugs.has(explorer.slug)
    )
    const removedExplorers = Array.from(existingExplorerSlugs).filter(
        (slug) => !publishedSlugs.has(slug)
    )

    console.log(
        `Explorer analysis: ${newExplorers.length} new, ${existingExplorers.length} existing, ${removedExplorers.length} removed`
    )

    // Remove explorer views for unpublished explorers
    if (removedExplorers.length > 0) {
        console.log(
            `Removing views for unpublished explorers: ${removedExplorers.join(", ")}`
        )
        await knex("explorer_views")
            .whereIn("explorerSlug", removedExplorers)
            .delete()
    }

    const stats: ExplorerProcessingStats[] = []

    // Process all published explorers (both new and existing)
    for (const explorer of publishedExplorers) {
        const startTime = performance.now()
        const isNew = !existingExplorerSlugs.has(explorer.slug)

        console.log(
            `Processing explorer: ${explorer.slug} (${isNew ? "NEW" : "UPDATE"})`
        )

        try {
            // Wrap the refresh call with additional error handling
            await Promise.race([
                refreshExplorerViewsForSlug(knex, explorer.slug),
                new Promise((_, reject) => {
                    setTimeout(
                        () =>
                            reject(
                                new Error("Operation timed out after 5 minutes")
                            ),
                        5 * 60 * 1000
                    )
                }),
            ])

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
                isNew,
            })
        } catch (error) {
            const endTime = performance.now()
            const duration = Math.round(endTime - startTime)
            const failureReason =
                error instanceof Error ? error.message : String(error)

            console.error(
                `Failed to process explorer ${explorer.slug}: ${failureReason}`
            )

            stats.push({
                slug: explorer.slug,
                viewCount: 0,
                successCount: 0,
                errorCount: 0,
                duration,
                isNew,
                failed: true,
                failureReason,
            })
        }
    }

    return stats
}

function printStatsTable(stats: ExplorerProcessingStats[]): void {
    const newExplorers = stats.filter((s) => s.isNew)
    const existingExplorers = stats.filter((s) => !s.isNew)

    console.log("\n" + "=".repeat(100))
    console.log("Explorer Processing Statistics (Optimized)")
    console.log("=".repeat(100))
    console.log(
        "Explorer".padEnd(25) +
            "Status".padStart(8) +
            "Total".padStart(8) +
            "Success".padStart(8) +
            "Errors".padStart(8) +
            "Duration (ms)".padStart(15)
    )
    console.log("-".repeat(100))

    for (const stat of stats) {
        const status = stat.isNew ? "NEW" : "UPDATE"
        console.log(
            stat.slug.padEnd(25) +
                status.padStart(8) +
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

    console.log("-".repeat(100))
    console.log(
        "TOTAL".padEnd(25) +
            "".padStart(8) +
            totalViews.toString().padStart(8) +
            totalSuccess.toString().padStart(8) +
            totalErrors.toString().padStart(8) +
            totalDuration.toString().padStart(15)
    )
    console.log("=".repeat(100))

    console.log(
        `\nOptimization Summary: ${newExplorers.length} new explorers, ${existingExplorers.length} existing explorers updated efficiently`
    )

    // Print failed explorer updates
    const failedExplorers = stats.filter((s) => s.failed)
    if (failedExplorers.length > 0) {
        console.log(`\n${"=".repeat(100)}`)
        console.log("FAILED EXPLORER UPDATES")
        console.log("=".repeat(100))
        for (const failed of failedExplorers) {
            console.log(`${failed.slug}: ${failed.failureReason}`)
        }
        console.log("=".repeat(100))
        console.log(`\nTotal failed: ${failedExplorers.length}`)
    }
}

const main = async (): Promise<void> => {
    const showStats = process.argv.includes("--stats")

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
        console.error(
            "Unhandled Promise Rejection at:",
            promise,
            "reason:",
            reason
        )
    })

    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception:", error)
    })

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
