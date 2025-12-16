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
    concurrency: number
): Promise<void> {
    console.log(`Exporting ${charts.length} charts...`)

    const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = charts.map(
        (chart) => ({ id: chart.id, config: chart.config, outDir })
    )

    await pMap(saveJobs, utils.saveGrapherSchemaAndData, { concurrency })

    console.log(`Successfully exported ${charts.length} charts`)
}

async function dumpExplorerWithData(
    explorerProgram: ExplorerProgram,
    outDir: string,
    knex: KnexReadonlyTransaction
) {
    const explorerSlug = explorerProgram.slug
    const explorerType = utils.getExplorerType(explorerProgram)

    // For now, only indicator-based explorers are supported
    if (explorerType !== ExplorerType.Indicator) return

    console.log(`Exporting explorer: ${explorerSlug} (${explorerType})`)

    // Create output directory for this explorer
    const explorerDir = path.join(outDir, explorerSlug)
    if (!fs.existsSync(explorerDir))
        fs.mkdirSync(explorerDir, { recursive: true })

    // Save the explorer config
    const tsvPath = path.join(explorerDir, "config.tsv")
    await fs.writeFile(tsvPath, explorerProgram.toString())

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
        .exhaustive()
}

async function saveExplorerConfigAndData(
    explorers: ExplorerProgram[],
    outDir: string,
    knex: KnexReadonlyTransaction
): Promise<void> {
    console.log(`Exporting ${explorers.length} explorers...`)

    for (const explorer of explorers) {
        await dumpExplorerWithData(explorer, outDir, knex)
    }

    console.log(`Successfully exported ${explorers.length} explorers`)
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
                await saveGrapherSchemaAndData(charts, outDir, concurrency)
            })
            .with("grapher-views", async () => {
                const charts = await knexReadonlyTransaction(
                    getMostViewedGraphers,
                    TransactionCloseMode.Close
                )
                await saveGrapherSchemaAndData(charts, outDir, concurrency)
            })
            .with("mdims", async () => {
                const mdimViews = await knexReadonlyTransaction(
                    getAllPublishedMultiDimViews,
                    TransactionCloseMode.Close
                )
                await saveGrapherSchemaAndData(mdimViews, outDir, concurrency)
            })
            .with("explorers", async () => {
                const explorerAdminServer = new ExplorerAdminServer()

                await knexReadonlyTransaction(async (trx) => {
                    const rawExplorers =
                        await explorerAdminServer.getAllPublishedExplorers(trx)

                    const explorersToExport = rawExplorers.filter(
                        (explorer) => {
                            const type = utils.getExplorerType(explorer)
                            return type === ExplorerType.Indicator
                        }
                    )

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

                    await saveExplorerConfigAndData(explorers, outDir, trx)
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
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

const argv = parseArguments()
void main(argv)
