import { KnexReadWriteTransaction } from "../db.js"
import {
    DbInsertExplorerView,
    DbRawExplorerView,
    serializeChartConfig,
    DbInsertChartConfig,
    parseChartConfig,
    GrapherInterface,
} from "@ourworldindata/types"
import { ExplorerProgram } from "@ourworldindata/explorer"
import { transformExplorerProgramToResolveCatalogPaths } from "./ExplorerCatalogResolver.js"
import { constructGrapherConfig } from "./ExplorerViewsHelpers.js"
import { insertChartConfig, updateExistingConfigPair } from "./ChartConfigs.js"
import { uuidv7 } from "uuidv7"
import { isEqual } from "lodash-es"

// Deterministic JSON serialization that always sorts keys alphabetically
function serializeExplorerView(view: Record<string, any>): string {
    const sortedView: Record<string, any> = {}
    Object.keys(view)
        .sort()
        .forEach((key) => {
            sortedView[key] = view[key]
        })
    return JSON.stringify(sortedView)
}

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
        return
    }

    if (!explorer.isPublished) {
        return
    }

    // Fetch existing explorer views with their chart configs
    type ExistingView = Pick<
        DbRawExplorerView,
        "explorerView" | "chartConfigId" | "error"
    > & {
        full: string | null
    }

    const existingViews: ExistingView[] = await knex
        .select("ev.explorerView", "ev.chartConfigId", "ev.error", "cc.full")
        .from("explorer_views as ev")
        .leftJoin("chart_configs as cc", "ev.chartConfigId", "cc.id")
        .where("ev.explorerSlug", slug)

    // Create a map for efficient lookup of existing views
    // Normalize existing view JSON strings to handle legacy data with different key ordering
    const existingViewsMap = new Map<string, ExistingView>()
    
    for (const view of existingViews) {
        try {
            // Parse and re-serialize with sorted keys to normalize
            const parsedView = JSON.parse(view.explorerView)
            const normalizedKey = serializeExplorerView(parsedView)
            existingViewsMap.set(normalizedKey, view)
        } catch {
            // If parsing fails, use original string as fallback
            existingViewsMap.set(view.explorerView, view)
        }
    }

    // init explorer program
    const rawExplorerProgram = new ExplorerProgram(slug, explorer.tsv)

    // map catalog paths to indicator ids if necessary
    const explorerProgram = (
        await transformExplorerProgramToResolveCatalogPaths(
            rawExplorerProgram,
            knex
        )
    ).program

    // Generate all new views with their configs (without inserting to DB yet)
    type GeneratedView = DbInsertExplorerView & {
        config?: GrapherInterface // GrapherInterface - temporary field for comparison
    }

    const generatedViews: GeneratedView[] = []
    const grapherRows = explorerProgram.decisionMatrix.table.rows

    for (const grapherRow of grapherRows) {
        const view =
            explorerProgram.decisionMatrix.getChoiceParamsForRow(grapherRow)
        const explorerViewStr = serializeExplorerView(view)

        try {
            const config = await constructGrapherConfig(
                knex,
                explorerProgram,
                grapherRow
            )

            generatedViews.push({
                explorerSlug: slug,
                explorerView: explorerViewStr,
                config: config,
            })
        } catch (error) {
            // Handle configuration failure gracefully
            const errorMessage =
                error instanceof Error ? error.message : String(error)

            generatedViews.push({
                explorerSlug: slug,
                explorerView: explorerViewStr,
                error: errorMessage.slice(0, 500), // Limit error message length
            })
        }
    }

    // Compare generated views with existing views and categorize them
    const unchangedViews: string[] = []
    const updatedViews: { existing: ExistingView; generated: GeneratedView }[] =
        []
    const newViews: GeneratedView[] = []
    const generatedViewsSet = new Set<string>()

    for (const generatedView of generatedViews) {
        generatedViewsSet.add(generatedView.explorerView)
        const existingView = existingViewsMap.get(generatedView.explorerView)

        if (!existingView) {
            // New view that doesn't exist yet
            newViews.push(generatedView)
        } else {
            // View exists, check if config has changed
            let configsEqual = false

            if (existingView.error && generatedView.error) {
                // Both have errors, compare error messages
                configsEqual = existingView.error === generatedView.error
            } else if (
                !existingView.error &&
                !generatedView.error &&
                existingView.full &&
                generatedView.config
            ) {
                // Both have successful configs, compare them
                try {
                    const existingConfig = parseChartConfig(existingView.full)
                    configsEqual = isEqual(existingConfig, generatedView.config)
                } catch {
                    configsEqual = false
                }
            }
            // If one has error and other doesn't, configsEqual remains false

            if (configsEqual) {
                unchangedViews.push(generatedView.explorerView)
            } else {
                updatedViews.push({
                    existing: existingView,
                    generated: generatedView,
                })
            }
        }
    }

    // Find views to remove (exist in DB but not in generated views)
    const removedViews: ExistingView[] = []
    for (const [explorerViewStr, existingView] of existingViewsMap) {
        if (!generatedViewsSet.has(explorerViewStr)) {
            removedViews.push(existingView)
        }
    }

    // Execute minimal database operations

    // Remove deleted views first
    if (removedViews.length > 0) {
        const removedViewStrings = removedViews.map((v) => v.explorerView)
        await knex("explorer_views")
            .where("explorerSlug", slug)
            .whereIn("explorerView", removedViewStrings)
            .delete()
    }

    // Update existing views with changed configs
    for (const { existing, generated } of updatedViews) {
        if (generated.error) {
            // Update to error state, remove chart config reference
            await knex("explorer_views")
                .where("explorerSlug", slug)
                .where("explorerView", existing.explorerView)
                .update({
                    error: generated.error,
                    chartConfigId: null,
                })
        } else if (generated.config && existing.chartConfigId) {
            // Update existing chart config
            await updateExistingConfigPair(knex, {
                configId: existing.chartConfigId,
                patchConfig: generated.config,
                fullConfig: generated.config,
                updatedAt: new Date(),
            })

            // Clear any previous error
            await knex("explorer_views")
                .where("explorerSlug", slug)
                .where("explorerView", existing.explorerView)
                .update({ error: null })
        } else if (generated.config && !existing.chartConfigId) {
            // Create new chart config for previously failed view
            const chartConfigId = uuidv7()
            const chartConfig: DbInsertChartConfig = {
                id: chartConfigId,
                patch: serializeChartConfig(generated.config),
                full: serializeChartConfig(generated.config),
            }
            await insertChartConfig(knex, chartConfig)

            await knex("explorer_views")
                .where("explorerSlug", slug)
                .where("explorerView", existing.explorerView)
                .update({
                    chartConfigId: chartConfigId,
                    error: null,
                })
        }
    }

    // Insert new views
    if (newViews.length > 0) {
        const explorerViewsToInsert: DbInsertExplorerView[] = []

        for (const newView of newViews) {
            if (newView.error) {
                const { config: _config, ...insertView } = newView
                explorerViewsToInsert.push(insertView)
            } else if (newView.config) {
                // Create chart config first
                const chartConfigId = uuidv7()
                const chartConfig: DbInsertChartConfig = {
                    id: chartConfigId,
                    patch: serializeChartConfig(newView.config),
                    full: serializeChartConfig(newView.config),
                }
                await insertChartConfig(knex, chartConfig)

                const { config: _config, ...insertView } = newView
                explorerViewsToInsert.push({
                    ...insertView,
                    chartConfigId: chartConfigId,
                })
            }
        }

        if (explorerViewsToInsert.length > 0) {
            await knex.batchInsert("explorer_views", explorerViewsToInsert)
        }
    }
}
