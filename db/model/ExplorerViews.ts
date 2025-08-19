import { KnexReadWriteTransaction, knexRaw } from "../db.js"
import {
    DbInsertExplorerView,
    DbRawExplorerView,
    serializeChartConfig,
    DbInsertChartConfig,
    parseChartConfig,
    GrapherInterface,
    DbPlainChart,
    DbRawChartConfig,
} from "@ourworldindata/types"
import {
    ExplorerProgram,
    Explorer,
    ExplorerProps,
} from "@ourworldindata/explorer"
import { transformExplorerProgramToResolveCatalogPaths } from "./ExplorerCatalogResolver.js"
import { insertChartConfig, updateExistingConfigPair } from "./ChartConfigs.js"
import { uuidv7 } from "uuidv7"
import { isEqual, difference } from "lodash-es"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { stringify } from "safe-stable-stringify"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import {
    ADMIN_BASE_URL,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"

interface ExplorerDataForViews {
    transformedProgram: ExplorerProgram
    grapherConfigs: GrapherInterface[]
    partialGrapherConfigs: GrapherInterface[]
}

async function fetchExplorerDataForViews(
    knex: KnexReadWriteTransaction,
    explorerProgram: ExplorerProgram,
    _loadMetadataOnly?: boolean
): Promise<ExplorerDataForViews> {
    const transformResult = await transformExplorerProgramToResolveCatalogPaths(
        explorerProgram,
        knex,
        logErrorAndMaybeCaptureInSentry
    )
    const { program: transformedProgram, unresolvedCatalogPaths } =
        transformResult
    if (unresolvedCatalogPaths?.size) {
        void logErrorAndMaybeCaptureInSentry(
            new Error(
                `${unresolvedCatalogPaths.size} catalog paths cannot be found for explorer ${transformedProgram.slug}: ${[...unresolvedCatalogPaths].join(", ")}.`
            )
        )
    }

    // This needs to run after transformExplorerProgramToResolveCatalogPaths, so that the catalog paths
    // have already been resolved and all the required grapher and variable IDs are available
    const { requiredGrapherIds, requiredVariableIds } =
        transformedProgram.decisionMatrix

    type ChartRow = { id: number; config: string }
    let grapherConfigRows: ChartRow[] = []
    if (requiredGrapherIds.length)
        grapherConfigRows = await knexRaw<
            Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
        >(
            knex,
            `-- sql
                SELECT c.id, cc.full as config
                FROM charts c
                JOIN chart_configs cc ON c.configId=cc.id
                WHERE c.id IN (?)
            `,
            [requiredGrapherIds]
        )

    let partialGrapherConfigRows: {
        id: number
        grapherConfigAdmin: string | null
        grapherConfigETL: string | null
    }[] = []
    if (requiredVariableIds.length) {
        partialGrapherConfigRows = await knexRaw(
            knex,
            `-- sql
                SELECT
                    v.id,
                    cc_etl.patch AS grapherConfigETL,
                    cc_admin.patch AS grapherConfigAdmin
                FROM variables v
                    LEFT JOIN chart_configs cc_admin ON cc_admin.id=v.grapherConfigIdAdmin
                    LEFT JOIN chart_configs cc_etl ON cc_etl.id=v.grapherConfigIdETL
                WHERE v.id IN (?)
            `,
            [requiredVariableIds]
        )

        // check if all required variable IDs exist in the database
        const existingIds = partialGrapherConfigRows.map((row) => row.id)
        const missingIds = difference(requiredVariableIds, existingIds)
        if (missingIds.length > 0) {
            void logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Referenced variable IDs do not exist in the database for explorer ${transformedProgram.slug}: ${missingIds.join(", ")}.`
                )
            )
        }
    }

    const parseGrapherConfigFromRow = (row: ChartRow): GrapherInterface => {
        const config = JSON.parse(row.config)
        config.id = row.id // Ensure each grapher has an id
        config.adminBaseUrl = ADMIN_BASE_URL
        config.bakedGrapherURL = BAKED_GRAPHER_URL
        return config
    }
    const grapherConfigs = grapherConfigRows.map(parseGrapherConfigFromRow)
    const partialGrapherConfigs = partialGrapherConfigRows
        .filter((row) => row.grapherConfigAdmin || row.grapherConfigETL)
        .map((row) => {
            const adminConfig = row.grapherConfigAdmin
                ? parseGrapherConfigFromRow({
                      id: row.id,
                      config: row.grapherConfigAdmin as string,
                  })
                : {}
            const etlConfig = row.grapherConfigETL
                ? parseGrapherConfigFromRow({
                      id: row.id,
                      config: row.grapherConfigETL as string,
                  })
                : {}
            const mergedConfig = mergeGrapherConfigs(etlConfig, adminConfig)
            // explorers set their own dimensions, so we don't need to include them here
            const mergedConfigWithoutDimensions = {
                ...mergedConfig,
                dimensions: undefined,
            }
            return mergedConfigWithoutDimensions
        })

    return {
        transformedProgram,
        grapherConfigs,
        partialGrapherConfigs,
    }
}

function createExplorerForViews(
    data: ExplorerDataForViews,
    loadMetadataOnly?: boolean
): Explorer {
    const { transformedProgram, grapherConfigs, partialGrapherConfigs } = data

    const props: ExplorerProps = {
        ...transformedProgram.toJson(),
        grapherConfigs,
        partialGrapherConfigs,
        isEmbeddedInAnOwidPage: false,
        isInStandalonePage: false,
        adminBaseUrl: ADMIN_BASE_URL,
        bakedBaseUrl: BAKED_BASE_URL,
        bakedGrapherUrl: BAKED_GRAPHER_URL,
        dataApiUrl: DATA_API_URL,
        loadMetadataOnly,
        throwOnMissingGrapher: true,
        setupGrapher: false, // We will set up the grapher later in iterateExplorerViews
    }

    // Create Explorer with setupGrapher: false to avoid setting up the actual grapher
    return new Explorer(props)
}

async function iterateExplorerViews(
    explorer: Explorer,
    _knex: KnexReadWriteTransaction
): Promise<Array<DbInsertExplorerView & { config?: GrapherInterface }>> {
    const explorerProgram = explorer.explorerProgram
    const generatedViews: Array<
        DbInsertExplorerView & { config?: GrapherInterface }
    > = []
    const grapherRows = explorerProgram.decisionMatrix.table.rows

    for (const grapherRow of grapherRows) {
        const view =
            explorerProgram.decisionMatrix.getChoiceParamsForRow(grapherRow)
        const explorerViewStr = JSON.stringify(view)

        try {
            // Set the slide to this specific view - this will update the explorer's state
            explorer.setSlide(view)

            // Trigger the grapher update from the explorer
            await explorer.updateGrapherFromExplorer()

            // Extract the generated config from the explorer's grapher state
            const config = explorer.grapherState.toObject(false)

            // Grapher uses an internal fallback chain for some important properties.
            // For explorer views we want to have a config that materializes as much
            // as possible of what is shown, even if by default grapher would fall back
            // to defaults (e.g. from the first Y indicator metadata), so we fill
            // the important properties with the fallback defaults here
            config.title = config.title ?? explorer.grapherState.defaultTitle
            config.subtitle =
                config.subtitle ?? explorer.grapherState.currentSubtitle

            if (!config) {
                throw new Error(
                    "Failed to generate grapher config from Explorer"
                )
            }

            generatedViews.push({
                explorerSlug: explorerProgram.slug,
                dimensions: explorerViewStr,
                config: config,
            })
        } catch (error) {
            // Handle configuration failure gracefully
            const errorMessage =
                error instanceof Error ? error.message : String(error)

            generatedViews.push({
                explorerSlug: explorerProgram.slug,
                dimensions: explorerViewStr,
                error: errorMessage.slice(0, 500), // Limit error message length
            })
        }
    }

    return generatedViews
}

export async function refreshExplorerViewsForSlug(
    knex: KnexReadWriteTransaction,
    slug: string,
    loadMetadataOnly?: boolean
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
        "dimensions" | "chartConfigId" | "error"
    > & {
        full: string | null
    }

    const existingViews: ExistingView[] = await knex
        .select("ev.dimensions", "ev.chartConfigId", "ev.error", "cc.full")
        .from("explorer_views as ev")
        .leftJoin("chart_configs as cc", "ev.chartConfigId", "cc.id")
        .where("ev.explorerSlug", slug)

    // Create a map for efficient lookup of existing views
    // Use deterministic JSON serialization as the key
    const existingViewsMap = new Map<string, ExistingView>()

    for (const view of existingViews) {
        try {
            const parsedView = JSON.parse(view.dimensions)
            const deterministicKey = stringify(parsedView as object)
            existingViewsMap.set(deterministicKey, view)
        } catch (ex) {
            // Skip views with invalid JSON - this indicates a data integrity issue
            void logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Explorer view contains invalid JSON for explorer ${slug}: ${view.dimensions}`
                )
            )
            throw new Error(
                `Failed to parse explorer view dimensions for explorer ${slug}: ${ex.message}`
            )
        }
    }

    // init explorer program
    const rawExplorerProgram = new ExplorerProgram(slug, explorer.tsv)

    // Create full Explorer instance and iterate over its views
    const explorerData = await fetchExplorerDataForViews(
        knex,
        rawExplorerProgram,
        loadMetadataOnly
    )
    const explorerInstance = createExplorerForViews(
        explorerData,
        loadMetadataOnly
    )

    // Generate all new views with their configs using the full Explorer instance
    type GeneratedView = DbInsertExplorerView & {
        config?: GrapherInterface // GrapherInterface - temporary field for comparison
    }

    const generatedViews: GeneratedView[] = await iterateExplorerViews(
        explorerInstance,
        knex
    )

    // Compare generated views with existing views and categorize them
    const unchangedViews: string[] = []
    const updatedViews: { existing: ExistingView; generated: GeneratedView }[] =
        []
    const newViews: GeneratedView[] = []
    const generatedViewsSet = new Set<string>()

    for (const generatedView of generatedViews) {
        generatedViewsSet.add(generatedView.dimensions)

        // Find existing view using deterministic serialization for O(1) lookup
        const generatedViewObj = JSON.parse(generatedView.dimensions)
        const deterministicKey = stringify(generatedViewObj as object)
        const existingView = existingViewsMap.get(deterministicKey)

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
                unchangedViews.push(generatedView.dimensions)
            } else {
                updatedViews.push({
                    existing: existingView,
                    generated: generatedView,
                })
            }
        }
    }

    // Find views to remove (exist in DB but not in generated views)
    const generatedViewKeys = new Set<string>()
    for (const generatedView of generatedViews) {
        const generatedViewObj = JSON.parse(generatedView.dimensions)
        const deterministicKey = stringify(generatedViewObj as object)
        generatedViewKeys.add(deterministicKey)
    }

    const removedViews: ExistingView[] = []
    for (const [existingKey, existingView] of existingViewsMap) {
        if (!generatedViewKeys.has(existingKey)) {
            removedViews.push(existingView)
        }
    }

    // Execute minimal database operations

    // Remove deleted views first
    if (removedViews.length > 0) {
        const removedViewStrings = removedViews.map((v) => v.dimensions)
        await knex("explorer_views")
            .where("explorerSlug", slug)
            .whereIn("dimensions", removedViewStrings)
            .delete()
    }

    // Update existing views with changed configs
    for (const { existing, generated } of updatedViews) {
        if (generated.error) {
            // Update to error state, remove chart config reference
            // Delete the chart config if it exists before removing the reference
            if (existing.chartConfigId) {
                await knex("chart_configs")
                    .where("id", existing.chartConfigId)
                    .delete()
            }

            await knex("explorer_views")
                .where("explorerSlug", slug)
                .where("dimensions", existing.dimensions)
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
                .where("dimensions", existing.dimensions)
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
                .where("dimensions", existing.dimensions)
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
