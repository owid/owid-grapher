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
    for (const grapherRow of grapherRows) {
        const view =
            explorerProgram.decisionMatrix.getChoiceParamsForRow(grapherRow)

        const config = await constructGrapherConfig(
            knex,
            explorerProgram,
            grapherRow
        )

        // Insert the grapher config into chart_configs table first
        const chartConfigId = uuidv7()
        const now = new Date()

        const chartConfig: DbInsertChartConfig = {
            id: chartConfigId,
            patch: JSON.stringify({}), // empty patch since this is a complete config
            full: serializeChartConfig(config),
            slug: null,
            chartType: null,
            createdAt: now,
            updatedAt: now,
        }

        await insertChartConfig(knex, chartConfig)

        explorerViews.push({
            explorerSlug: slug,
            explorerView: JSON.stringify(view),
            chartConfigId: chartConfigId,
        })
    }

    // Delete existing views for this explorer and their chart configs, then insert new ones
    // First get the chart config IDs to delete
    const existingViews = await knex("explorer_views")
        .where({ explorerSlug: slug })
        .select("chartConfigId")

    const chartConfigIdsToDelete = existingViews.map((row) => row.chartConfigId)

    // Delete the explorer views (this will also delete via foreign key constraint)
    await knex("explorer_views").where({ explorerSlug: slug }).delete()

    // Clean up the orphaned chart configs
    if (chartConfigIdsToDelete.length > 0) {
        await knex("chart_configs")
            .whereIn("id", chartConfigIdsToDelete)
            .delete()
    }

    // Insert new views
    if (explorerViews.length > 0) {
        await knex.batchInsert("explorer_views", explorerViews)
    }

    console.info(
        `Refreshed ${explorerViews.length} views for explorer: ${slug}`
    )
}
