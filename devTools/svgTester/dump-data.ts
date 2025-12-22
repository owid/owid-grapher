#! /usr/bin/env node

import path from "path"
import { match } from "ts-pattern"
import * as _ from "lodash-es"
import {
    TransactionCloseMode,
    knexReadonlyTransaction,
    type KnexReadonlyTransaction,
} from "../../db/db.js"
import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"
import { getMostViewedGrapherIdsByChartType } from "../../db/model/Chart.js"
import { getAllPublishedMultiDimDataPages } from "../../db/model/MultiDimDataPage.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    ExplorerType,
    GrapherInterface,
    ChartConfigsTableName,
    DbRawChartConfig,
} from "@ourworldindata/types"
import { parseChartConfig, queryParamsToStr } from "@ourworldindata/utils"
import { ExplorerProgram } from "@ourworldindata/explorer"

import fs from "fs-extra"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as utils from "./utils.js"
import pMap from "p-map"
import { ExplorerAdminServer } from "../../explorerAdminServer/ExplorerAdminServer.js"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { transformExplorerProgramToResolveCatalogPaths } from "../../db/model/ExplorerCatalogResolver.js"

interface ChartInfo {
    id: string
    config: GrapherInterface
}

async function getMostViewedGraphers(
    trx: KnexReadonlyTransaction,
    topN = 25
): Promise<ChartInfo[]> {
    console.log(`Fetching top ${topN} most-viewed charts per chart type...`)

    const promises = ALL_GRAPHER_CHART_TYPES.map((chartType) =>
        getMostViewedGrapherIdsByChartType(trx, chartType, topN)
    )
    const chartIds = (await Promise.all(promises)).flatMap((ids) => ids)

    const allGraphers = await getPublishedGraphersBySlug(trx)

    const relevantGraphers = chartIds
        .map((chartId) => {
            const config = allGraphers.graphersById.get(chartId)
            if (!config) return undefined
            return {
                id: config.slug!, // All published graphers have slugs
                config,
            }
        })
        .filter((chart) => chart !== undefined)

    return relevantGraphers
}

async function getAllPublishedGraphers(
    trx: KnexReadonlyTransaction
): Promise<ChartInfo[]> {
    const allGraphers = await getPublishedGraphersBySlug(trx)
    return [...allGraphers.graphersBySlug.values()].map((config) => ({
        id: config.slug!, // All published graphers have slugs
        config,
    }))
}

async function getAllPublishedMultiDimViews(
    trx: KnexReadonlyTransaction
): Promise<ChartInfo[]> {
    const multiDims = await getAllPublishedMultiDimDataPages(trx)

    // Collect all unique chart config IDs from all views
    const chartConfigIds = new Set<string>()
    for (const multiDim of multiDims) {
        for (const view of multiDim.config.views) {
            chartConfigIds.add(view.fullConfigId)
        }
    }

    // Fetch all chart configs
    const rows = await trx<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "full")
        .whereIn("id", [...chartConfigIds])

    const chartConfigsById = new Map(
        rows.map((row) => [row.id, parseChartConfig(row.full)])
    )

    // Create a config for each view with slug + viewId as the ID
    const chartConfigs: ChartInfo[] = []
    for (const multiDim of multiDims) {
        for (const view of multiDim.config.views) {
            const config = chartConfigsById.get(view.fullConfigId)
            if (!config) continue

            const queryStr = queryParamsToStr(view.dimensions)
            const id = `${multiDim.slug}${queryStr}`

            chartConfigs.push({ id, config })
        }
    }

    return chartConfigs
}

async function saveGrapherSchemaAndData(
    charts: ChartInfo[],
    outDir: string,
    { concurrency }: { concurrency: number }
): Promise<void> {
    console.log(`Exporting ${charts.length} charts...`)

    const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = charts.map(
        (chart) => ({ id: chart.id, config: chart.config, outDir })
    )

    await pMap(saveJobs, utils.saveGrapherSchemaAndData, { concurrency })

    console.log(`Successfully exported ${charts.length} charts`)
}

interface ExplorerViewManifest {
    totalViews: number
    selectedViews: number
    viewsToTest: Array<{
        index: number
        queryStr: string
    }>
}

function allocateViewCount({
    totalViews,
    pageviews,
    totalPageviews,
    targetTotalViews,
    minViews = 10,
}: {
    totalViews: number
    pageviews: number
    totalPageviews: number
    targetTotalViews: number
    minViews?: number
}): number {
    // Allocate based on popularity
    const pageviewRatio = totalPageviews > 0 ? pageviews / totalPageviews : 0
    const allocated = Math.floor(targetTotalViews * pageviewRatio)

    // Apply constraints
    return Math.max(minViews, Math.min(allocated, totalViews))
}

function selectViewsToTest(
    allChoices: Array<Record<string, string>>,
    targetCount: number
): Array<{ index: number; choiceParams: Record<string, string> }> {
    if (targetCount >= allChoices.length) {
        // Test all views
        return allChoices.map((params, index) => ({
            index,
            choiceParams: params,
        }))
    }

    // Always include first view (default)
    const selected = [{ index: 0, choiceParams: allChoices[0] }]

    // Random sample for remaining
    const remaining = targetCount - 1
    const availableIndices = _.range(1, allChoices.length)

    const sampledIndices = _.sampleSize(availableIndices, remaining)

    for (const index of sampledIndices) {
        selected.push({ index, choiceParams: allChoices[index] })
    }

    return _.sortBy(selected, "index")
}

async function writeManifestFile({
    totalViews,
    selectedViews,
    explorerDir,
    manifestFilename = "top.manifest.json",
}: {
    totalViews: number
    selectedViews: Array<{
        index: number
        choiceParams: Record<string, string>
    }>
    explorerDir: string
    manifestFilename?: string
}): Promise<void> {
    const manifest: ExplorerViewManifest = {
        totalViews,
        selectedViews: selectedViews.length,
        viewsToTest: selectedViews.map((v) => ({
            index: v.index,
            queryStr: queryParamsToStr(v.choiceParams).replace("?", ""),
        })),
    }

    const manifestPath = path.join(explorerDir, manifestFilename)
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}

async function dumpExplorerWithData({
    knex,
    explorerProgram,
    outDir,
    pageviews,
    totalPageviews,
    targetTotalViews,
}: {
    knex: KnexReadonlyTransaction
    explorerProgram: ExplorerProgram
    outDir: string
    pageviews: number
    totalPageviews: number
    targetTotalViews: number
}) {
    const explorerSlug = explorerProgram.slug
    const explorerType = utils.getExplorerType(explorerProgram)

    // Skip grapher based explorers (already tested via the graphers suite)
    if (explorerType === ExplorerType.Grapher) return

    console.log(`Exporting explorer: ${explorerSlug} (${explorerType})`)

    // Create output directory for this explorer
    const explorerDir = path.join(outDir, explorerSlug)
    if (!fs.existsSync(explorerDir))
        fs.mkdirSync(explorerDir, { recursive: true })

    // Save the explorer config
    const tsvPath = path.join(explorerDir, "config.tsv")
    await fs.writeFile(tsvPath, explorerProgram.toString())

    // Determine which views to test
    if (pageviews > 0) {
        const allChoices =
            explorerProgram.decisionMatrix.allDecisionsAsQueryParams()
        const totalViews = allChoices.length

        const numViewsToTest = allocateViewCount({
            totalViews,
            pageviews,
            totalPageviews,
            targetTotalViews,
        })
        const selectedViews = selectViewsToTest(allChoices, numViewsToTest)

        console.log(
            `  Sampling ${selectedViews.length}/${totalViews} views (${Math.round((selectedViews.length / totalViews) * 100)}%)`
        )

        // Write manifest json file
        await writeManifestFile({ totalViews, selectedViews, explorerDir })
    }

    await match(explorerType)
        .with(ExplorerType.Indicator, async () => {
            const { requiredVariableIds, allVariableIds } =
                explorerProgram.decisionMatrix

            if (allVariableIds.length > 0) {
                await utils.writeVariableDataAndMetadataFiles(
                    allVariableIds,
                    explorerDir
                )
            }

            if (requiredVariableIds.length > 0)
                await utils.savePartialGrapherConfigs(
                    requiredVariableIds,
                    explorerDir,
                    knex
                )
        })
        .with(ExplorerType.Csv, async () => {
            const tableSlugs = explorerProgram.tableSlugs
            const urlReplacements = new Map<string, string>()

            for (const tableSlug of tableSlugs) {
                const tableDef = explorerProgram.getTableDef(tableSlug)
                if (!tableDef || tableDef.inlineData || !tableDef.url) continue

                const tableName = tableSlug || "default"

                try {
                    const response = await fetch(tableDef.url)
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch ${tableDef.url}: ${response.status} ${response.statusText}`
                        )
                    }
                    const csvContent = await response.text()
                    const csvPath = path.join(explorerDir, `${tableName}.csv`)
                    await fs.writeFile(csvPath, csvContent)

                    // Track the URL replacement for updating TSV
                    urlReplacements.set(tableDef.url, `file://${csvPath}`)
                } catch (error) {
                    console.error(
                        `Error fetching table ${tableName}:`,
                        error instanceof Error ? error.message : error
                    )
                }
            }

            // Replace remote URLs with local file paths in the TSV
            if (urlReplacements.size > 0) {
                let modifiedTsvContent = explorerProgram.toString()
                for (const [originalUrl, localPath] of urlReplacements) {
                    modifiedTsvContent = modifiedTsvContent.replaceAll(
                        originalUrl,
                        localPath
                    )
                }
                await fs.writeFile(tsvPath, modifiedTsvContent)
            }
        })
        .exhaustive()
}

async function saveExplorerConfigAndData(
    knex: KnexReadonlyTransaction,
    explorers: ExplorerProgram[],
    outDir: string,
    {
        pageviewsByUrl,
        targetTotalViews,
    }: {
        pageviewsByUrl: { [url: string]: { views_365d: number } }
        targetTotalViews: number
    }
): Promise<void> {
    console.log(`Exporting ${explorers.length} explorers...`)

    // Calculate total pageviews for all explorers
    const explorerPageviewsBySlug = new Map(
        explorers.map((explorer) => {
            const url = `/explorers/${explorer.slug}`
            return [explorer.slug, pageviewsByUrl[url]?.views_365d ?? 0]
        })
    )

    const totalPageviews = _.sum(
        explorers.map(
            (explorer) => explorerPageviewsBySlug.get(explorer.slug) ?? 0
        )
    )
    const totalPageviewsExcludingCovid =
        totalPageviews - (explorerPageviewsBySlug.get("covid") ?? 0)

    for (const explorer of explorers) {
        const pageviews = explorerPageviewsBySlug.get(explorer.slug) ?? 0

        // For COVID, always test all views
        // For others, use the allocation calculation (excluding COVID pageviews)
        const totalPageviews =
            explorer.slug === "covid"
                ? pageviews // Use COVID's own pageviews so it gets 100% allocation
                : totalPageviewsExcludingCovid

        await dumpExplorerWithData({
            explorerProgram: explorer,
            outDir,
            knex,
            pageviews,
            totalPageviews,
            targetTotalViews,
        })
    }

    // Count total views across all explorers by reading manifests
    let totalViewsAcrossAllExplorers = 0
    for (const explorer of explorers) {
        const explorerDir = path.join(outDir, explorer.slug)
        const manifestPath = path.join(explorerDir, "top.manifest.json")
        if (await fs.pathExists(manifestPath)) {
            const manifest: ExplorerViewManifest =
                await fs.readJson(manifestPath)
            totalViewsAcrossAllExplorers += manifest.selectedViews
        }
    }

    console.log(`Successfully exported ${explorers.length} explorers`)
    console.log(`Total explorer views to test: ${totalViewsAcrossAllExplorers}`)
}

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        const testSuite = args.testSuite as utils.TestSuite
        const outDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
        const concurrency = args.concurrency

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        await match(testSuite)
            .with("graphers", async () => {
                const charts = await knexReadonlyTransaction(
                    getAllPublishedGraphers,
                    TransactionCloseMode.Close
                )
                await saveGrapherSchemaAndData(charts, outDir, { concurrency })
            })
            .with("grapher-views", async () => {
                const charts = await knexReadonlyTransaction(
                    getMostViewedGraphers,
                    TransactionCloseMode.Close
                )
                await saveGrapherSchemaAndData(charts, outDir, { concurrency })
            })
            .with("mdims", async () => {
                const mdimViews = await knexReadonlyTransaction(
                    getAllPublishedMultiDimViews,
                    TransactionCloseMode.Close
                )
                await saveGrapherSchemaAndData(mdimViews, outDir, {
                    concurrency,
                })
            })
            .with("explorers", async () => {
                const explorerAdminServer = new ExplorerAdminServer()
                const targetTotalViews = args.targetViews

                await knexReadonlyTransaction(async (trx) => {
                    // Fetch pageview data for all explorers
                    const pageviewsByUrl =
                        await getAnalyticsPageviewsByUrlObj(trx)

                    const rawExplorers =
                        await explorerAdminServer.getAllPublishedExplorers(trx)

                    // Ignore explorers that are Grapher ID based
                    // (they are covered by the grapher tests)
                    const explorersToExport = rawExplorers.filter(
                        (explorer) => {
                            const type = utils.getExplorerType(explorer)
                            return type !== ExplorerType.Grapher
                        }
                    )

                    // Resolve catalog paths in explorer programs
                    const explorers = await Promise.all(
                        explorersToExport.map(async (explorer) => {
                            const result =
                                await transformExplorerProgramToResolveCatalogPaths(
                                    explorer,
                                    trx
                                )
                            return result.program
                        })
                    )

                    await saveExplorerConfigAndData(trx, explorers, outDir, {
                        pageviewsByUrl,
                        targetTotalViews,
                    })
                }, TransactionCloseMode.Close)
            })
            .exhaustive()
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage("Export configs and data for all graphers")
        .command("$0 [testSuite]", false)
        .positional("testSuite", {
            type: "string",
            description: utils.TEST_SUITE_DESCRIPTION,
            default: "graphers",
            choices: utils.TEST_SUITES,
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            concurrency: {
                type: "number",
                description: "Number of charts to export in parallel.",
                default: 32,
            },
            targetViews: {
                type: "number",
                description:
                    "Target total number of explorer views to test (for explorers test suite). Views are allocated proportionally based on pageviews.",
                default: 2000,
            },
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

const argv = parseArguments()
void main(argv)
