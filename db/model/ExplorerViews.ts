import { KnexReadWriteTransaction } from "../db.js"
import {
    DbInsertExplorerView,
    serializeChartConfig,
} from "@ourworldindata/types"
import { ExplorerProgram } from "@ourworldindata/explorer"
import { transformExplorerProgramToResolveCatalogPaths } from "./ExplorerCatalogResolver.js"
import { constructGrapherConfig } from "./ExplorerViewsHelpers.js"

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

        explorerViews.push({
            explorerSlug: slug,
            explorerView: JSON.stringify(view),
            grapherConfig: serializeChartConfig(config),
        })
    }

    // Delete existing views for this explorer and insert new ones
    await knex("explorer_views").where({ explorerSlug: slug }).delete()
    if (explorerViews.length > 0) {
        await knex.batchInsert("explorer_views", explorerViews)
    }

    console.info(`Refreshed ${explorerViews.length} views for explorer: ${slug}`)
}