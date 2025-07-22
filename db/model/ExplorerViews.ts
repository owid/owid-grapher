import { KnexReadWriteTransaction } from "../db.js"
import {
    DbInsertExplorerView,
    serializeChartConfig,
    DbInsertChartConfig,
} from "@ourworldindata/types"
import { ExplorerProgram } from "@ourworldindata/explorer"
import { transformExplorerProgramToResolveCatalogPaths } from "./ExplorerCatalogResolver.js"
import { constructGrapherConfig } from "./ExplorerViewsHelpers.js"
import { insertChartConfig } from "./ChartConfigs.js"
import { uuidv7 } from "uuidv7"

export async function refreshExplorerViewsForSlug(
    knex: KnexReadWriteTransaction,
    slug: string
): Promise<void> {
    const explorer = await knex
        .select("slug", "tsv", "isPublished")
        .from("explorers")
        .where({ slug })
        .first()

    if (!explorer) {
        console.warn(`Explorer not found: ${slug}`)
        return
    }

    if (!explorer.isPublished) {
        console.info(`Skipping unpublished explorer: ${slug}`)
        return
    }

    console.info("Processing explorer views for... " + slug)

    const explorerViews: DbInsertExplorerView[] = []

    // init explorer program
    const rawExplorerProgram = new ExplorerProgram(slug, explorer.tsv)

    // map catalog paths to indicator ids if necessary
    const explorerProgram = (
        await transformExplorerProgramToResolveCatalogPaths(
            rawExplorerProgram,
            knex
        )
    ).program

    // iterate over all grapher rows in the explorer and construct a
    // grapher config for every row
    const grapherRows = explorerProgram.decisionMatrix.table.rows
    let successCount = 0
    let errorCount = 0

    for (const grapherRow of grapherRows) {
        const view =
            explorerProgram.decisionMatrix.getChoiceParamsForRow(grapherRow)

        try {
            const config = await constructGrapherConfig(
                knex,
                explorerProgram,
                grapherRow
            )

            // Insert the grapher config into chart_configs table first
            const chartConfigId = uuidv7()

            const chartConfig: DbInsertChartConfig = {
                id: chartConfigId,
                patch: serializeChartConfig(config), // store full config in patch for conceptual clarity
                full: serializeChartConfig(config),
                // Don't set auto-generated fields: slug, chartType, createdAt, updatedAt
            }

            await insertChartConfig(knex, chartConfig)

            explorerViews.push({
                explorerSlug: slug,
                explorerView: JSON.stringify(view),
                chartConfigId: chartConfigId,
            })
            successCount++
        } catch (error) {
            // Handle configuration failure gracefully
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            console.warn("Failed to create config for view in explorer:", {
                slug,
                errorMessage,
                view,
            })

            explorerViews.push({
                explorerSlug: slug,
                explorerView: JSON.stringify(view),
                error: errorMessage.slice(0, 500), // Limit error message length
            })
            errorCount++
        }
    }

    // Delete existing views for this explorer - chart configs will be deleted automatically
    // via ON DELETE CASCADE foreign key constraint
    await knex("explorer_views").where({ explorerSlug: slug }).delete()

    // Insert new views
    if (explorerViews.length > 0) {
        await knex.batchInsert("explorer_views", explorerViews)
    }

    console.info(
        `Refreshed ${explorerViews.length} views for explorer: ${slug} (${successCount} successful, ${errorCount} failed)`
    )
}
