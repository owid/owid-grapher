import * as db from "../db/db.js"
import { DbPlainExplorer } from "@ourworldindata/types"
import { refreshExplorerViewsForSlug } from "../db/model/ExplorerViews.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

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
    knex: db.KnexReadonlyTransaction,
    slugWildcard?: string
): Promise<Pick<DbPlainExplorer, "slug" | "tsv">[]> {
    let query = `-- sql
        SELECT slug, tsv
        FROM explorers
        WHERE isPublished IS TRUE`

    if (slugWildcard) {
        query += ` AND slug LIKE ?`
        return db.knexRaw(knex, query, [slugWildcard])
    }

    return db.knexRaw(knex, query)
}

async function prepareGrapherConfigsForExplorerViews(
    knex: db.KnexReadWriteTransaction,
    slugWildcard?: string
): Promise<ExplorerProcessingStats[]> {
    // Fetch published explorers and existing explorer slugs
    const publishedExplorers = await fetchPublishedExplorers(knex, slugWildcard)
    const existingExplorerViewRows = await db.knexRaw<{ explorerSlug: string }>(
        knex,
        `-- sql
        SELECT DISTINCT explorerSlug
        FROM explorer_views
        `
    )
    const existingExplorerSlugs = new Set(
        existingExplorerViewRows.map((row) => row.explorerSlug)
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
                refreshExplorerViewsForSlug(knex, explorer.slug, true),
                new Promise((_, reject) => {
                    setTimeout(
                        () =>
                            reject(
                                new Error("Operation timed out after 8 minutes")
                            ),
                        8 * 60 * 1000
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

    console.log("\nExplorer Processing Statistics (Optimized)")

    // Prepare data for console.table with meaningful column names
    const tableData = stats.map((stat) => ({
        Explorer: stat.slug,
        Status: stat.isNew ? "NEW" : "UPDATE",
        "Total Views": stat.viewCount,
        Success: stat.successCount,
        Errors: stat.errorCount,
        "Duration (ms)": stat.duration,
        Failed: stat.failed ? "Yes" : "No",
    }))

    console.table(tableData)

    const totalViews = stats.reduce((sum, stat) => sum + stat.viewCount, 0)
    const totalSuccess = stats.reduce((sum, stat) => sum + stat.successCount, 0)
    const totalErrors = stats.reduce((sum, stat) => sum + stat.errorCount, 0)
    const totalDuration = stats.reduce((sum, stat) => sum + stat.duration, 0)

    console.log(
        `\nSummary: ${totalViews} total views, ${totalSuccess} successful, ${totalErrors} errors, ${totalDuration}ms total duration`
    )

    console.log(
        `\nOptimization Summary: ${newExplorers.length} new explorers, ${existingExplorers.length} existing explorers updated efficiently`
    )

    // Print failed explorer updates
    const failedExplorers = stats.filter((s) => s.failed)
    if (failedExplorers.length > 0) {
        console.log(`\nFAILED EXPLORER UPDATES`)

        const failedTableData = failedExplorers.map((failed) => ({
            Explorer: failed.slug,
            "Failure Reason": failed.failureReason,
        }))

        console.table(failedTableData)
        console.log(`\nTotal failed: ${failedExplorers.length}`)
    }
}

interface Options {
    stats: boolean
    slug?: string
}

const main = async (options: Options): Promise<void> => {
    const { stats: showStats, slug: slugWildcard } = options

    if (slugWildcard) {
        console.log(`Filtering explorers with slug pattern: ${slugWildcard}`)
    }

    try {
        const stats = await db.knexReadWriteTransaction(
            (trx) => prepareGrapherConfigsForExplorerViews(trx, slugWildcard),
            db.TransactionCloseMode.Close
        )

        if (showStats) {
            printStatsTable(stats)
        }
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
    process.exit(0)
}

void yargs(hideBin(process.argv))
    .command<Options>(
        "$0",
        "Refresh explorer views for published explorers in the database",
        (yargs) => {
            yargs
                .option("stats", {
                    type: "boolean",
                    description: "Display detailed statistics after processing",
                    default: false,
                })
                .option("slug", {
                    type: "string",
                    description:
                        "Process only explorers matching the SQL LIKE pattern",
                })
                .example("$0", "Process all published explorers")
                .example(
                    "$0 --stats",
                    "Process all explorers and display statistics"
                )
                .example(
                    '$0 --slug="energy%" --stats',
                    "Process explorers starting with 'energy' and show stats"
                )
                .example(
                    '$0 --slug="energy-mix"',
                    "Process only the 'energy-mix' explorer"
                )
                .example(
                    '$0 --slug="%climate%"',
                    "Process explorers containing 'climate'"
                )
        },
        (argv) => {
            void main(argv)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
