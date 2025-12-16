#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"

import { match } from "ts-pattern"
import {
    TransactionCloseMode,
    knexReadonlyTransaction,
    type KnexReadonlyTransaction,
} from "../../db/db.js"
import { getMostViewedGrapherIdsByChartType } from "../../db/model/Chart.js"
import { getAllPublishedMultiDimDataPages } from "../../db/model/MultiDimDataPage.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    GrapherInterface,
    ChartConfigsTableName,
    DbRawChartConfig,
} from "@ourworldindata/types"
import { parseChartConfig, dimensionsToViewId } from "@ourworldindata/utils"

import fs from "fs-extra"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as utils from "./utils.js"
import pMap from "p-map"
import path from "path"

async function getMostViewedGraphers(
    trx: KnexReadonlyTransaction,
    topN: number
): Promise<{ id: string; config: GrapherInterface }[]> {
    console.log(`Fetching top ${topN} most-viewed charts per chart type...`)

    const promises = ALL_GRAPHER_CHART_TYPES.map((chartType) =>
        getMostViewedGrapherIdsByChartType(trx, chartType, topN)
    )
    const chartIds = (await Promise.all(promises)).flatMap((ids) => ids)

    const allGraphers = await getPublishedGraphersBySlug(trx)

    const relevantGraphers = chartIds
        .map((chartId) => ({
            id: chartId.toString(),
            config: allGraphers.graphersById.get(chartId),
        }))
        .filter(
            (chart): chart is { id: string; config: GrapherInterface } =>
                chart.config !== undefined
        )

    return relevantGraphers
}

async function getAllPublishedGraphers(
    trx: KnexReadonlyTransaction
): Promise<{ id: string; config: GrapherInterface }[]> {
    const allGraphers = await getPublishedGraphersBySlug(trx)
    return [...allGraphers.graphersBySlug.values()].map((config) => ({
        id: config.id!.toString(),
        config,
    }))
}

async function getAllPublishedMultiDimViews(
    trx: KnexReadonlyTransaction
): Promise<{ id: string; config: GrapherInterface }[]> {
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
    const chartConfigs: { id: string; config: GrapherInterface }[] = []
    for (const multiDim of multiDims) {
        for (const view of multiDim.config.views) {
            const config = chartConfigsById.get(view.fullConfigId)
            if (!config) continue

            const viewId = dimensionsToViewId(view.dimensions)
            const compositeId = `${multiDim.slug}__${viewId}`

            chartConfigs.push({ id: compositeId, config })
        }
    }

    return chartConfigs
}

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        const testSuite = args.testSuite as utils.TestSuite
        const outDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
        const concurrency = args.concurrency

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const charts = await knexReadonlyTransaction(
            async (trx) =>
                match(testSuite)
                    .with("graphers", () => getAllPublishedGraphers(trx))
                    .with("grapher-views", () => getMostViewedGraphers(trx, 25))
                    .with("mdims", () => getAllPublishedMultiDimViews(trx))
                    .exhaustive(),
            TransactionCloseMode.Close
        )
        console.log(`Exporting ${charts.length} charts...`)

        const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = charts.map(
            (grapher) => ({ id: grapher.id, config: grapher.config, outDir })
        )

        await pMap(saveJobs, utils.saveGrapherSchemaAndData, {
            concurrency,
        })

        console.log(`Successfully exported ${charts.length} charts`)
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
            description:
                "Test suite to run: 'graphers' for default Grapher views, 'grapher-views' for all views of a subset of Graphers. 'mdims' for all multi-dim views.",
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
