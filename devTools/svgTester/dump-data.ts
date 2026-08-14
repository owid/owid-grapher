#! /usr/bin/env node

import path from "path"
import { match } from "ts-pattern"
import {
    TransactionCloseMode,
    knexReadonlyTransaction,
    type KnexReadonlyTransaction,
} from "../../db/db.js"
import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"
import { getMostViewedGrapherIdsByChartType } from "../../db/model/Chart.js"
import { getAllPublishedMultiDimDataPages } from "../../db/model/MultiDimDataPage.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    GrapherInterface,
    ChartConfigsTableName,
    DbRawChartConfig,
    SVG_TESTER_SUITES,
    type SvgTesterSuite,
} from "@ourworldindata/types"
import { parseChartConfig, queryParamsToStr } from "@ourworldindata/utils"

import fs from "fs-extra"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as utils from "./utils.js"
import pMap from "p-map"
import { assertAnalyticsPageviewsPopulated } from "../../db/model/Pageview.js"

interface ChartInfo {
    id: string
    config: GrapherInterface
}

async function getMostViewedGraphersPerChartType(
    trx: KnexReadonlyTransaction,
    topN = 10
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
    return allGraphers.graphersBySlug
        .values()
        .map((config) => ({
            id: config.slug!, // All published graphers have slugs
            config,
        }))
        .toArray()
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
        .select("id", "config")
        .whereIn("id", [...chartConfigIds])

    const chartConfigsById = new Map(
        rows.map((row) => [row.id, parseChartConfig(row.config)])
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

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        const testSuite = args.testSuite as SvgTesterSuite
        const testSuiteDir = path.join(SVG_TESTER_REPO_PATH, testSuite)
        const outDir = path.join(testSuiteDir, "configs")
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
            .with("thumbnails", async () => {
                // Thumbnails uses a manifest to specify which charts to test
                // The actual data is read from the graphers suite
                await knexReadonlyTransaction(
                    assertAnalyticsPageviewsPopulated,
                    TransactionCloseMode.Close
                )
                const charts = await knexReadonlyTransaction(
                    getMostViewedGraphersPerChartType,
                    TransactionCloseMode.Close
                )

                // Extract slugs
                const slugs = charts.map((chart) => chart.id)

                // Write manifest file
                const manifest: utils.GrapherViewsManifest = { slugs }
                const manifestPath = path.join(
                    testSuiteDir,
                    "top.manifest.json"
                )
                await fs.writeFile(
                    manifestPath,
                    JSON.stringify(manifest, null, 2)
                )

                console.log(
                    `Wrote manifest for ${slugs.length} charts to ${manifestPath}`
                )
                console.log(
                    "Note: thumbnails reuses data from the graphers suite"
                )
            })
            .with("grapher-views", async () => {
                // Grapher-views uses a manifest to specify which charts to test
                // The actual data is read from the graphers suite
                await knexReadonlyTransaction(
                    assertAnalyticsPageviewsPopulated,
                    TransactionCloseMode.Close
                )
                const charts = await knexReadonlyTransaction(
                    getMostViewedGraphersPerChartType,
                    TransactionCloseMode.Close
                )

                // Extract slugs
                const slugs = charts.map((chart) => chart.id)

                // Write manifest file
                const manifest: utils.GrapherViewsManifest = { slugs }
                const manifestPath = path.join(
                    testSuiteDir,
                    "top.manifest.json"
                )
                await fs.writeFile(
                    manifestPath,
                    JSON.stringify(manifest, null, 2)
                )

                console.log(
                    `Wrote manifest for ${slugs.length} charts to ${manifestPath}`
                )
                console.log(
                    "Note: grapher-views reuses data from the graphers suite"
                )
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
            choices: SVG_TESTER_SUITES,
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
