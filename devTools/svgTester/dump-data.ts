#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"

import {
    TransactionCloseMode,
    knexReadonlyTransaction,
    type KnexReadonlyTransaction,
} from "../../db/db.js"
import { getMostViewedGrapherIdsByChartType } from "../../db/model/Chart.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    GrapherInterface,
} from "@ourworldindata/types"

import fs from "fs-extra"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as utils from "./utils.js"
import pMap from "p-map"
import path from "path"
import { match } from "ts-pattern"

async function getMostViewedGraphers(
    trx: KnexReadonlyTransaction,
    topN: number
): Promise<GrapherInterface[]> {
    console.log(`Fetching top ${topN} most-viewed charts per chart type...`)

    const promises = ALL_GRAPHER_CHART_TYPES.map((chartType) =>
        getMostViewedGrapherIdsByChartType(trx, chartType, topN)
    )
    const chartIds = (await Promise.all(promises)).flatMap((ids) => ids)

    const allGraphers = await getPublishedGraphersBySlug(trx)

    const relevantGraphers = chartIds
        .map((chartId) => allGraphers.graphersById.get(chartId))
        .filter((grapher) => grapher !== undefined)

    return relevantGraphers
}

async function getAllPublishedGraphers(
    trx: KnexReadonlyTransaction
): Promise<GrapherInterface[]> {
    const allGraphers = await getPublishedGraphersBySlug(trx)
    return [...allGraphers.graphersBySlug.values()]
}

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        const testSuite = args.testSuite as utils.TestSuite
        const outDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
        const concurrency = args.concurrency

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const graphers = await knexReadonlyTransaction(
            async (trx) =>
                match(testSuite)
                    .with("graphers", () => getAllPublishedGraphers(trx))
                    .with("grapher-views", () => getMostViewedGraphers(trx, 25))
                    .exhaustive(),
            TransactionCloseMode.Close
        )
        console.log(`Exporting ${graphers.length} charts...`)

        const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = graphers.map(
            (grapher) => ({ config: grapher, outDir })
        )

        await pMap(saveJobs, utils.saveGrapherSchemaAndData, {
            concurrency,
        })

        console.log(`Successfully exported ${graphers.length} charts`)
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
                "Test suite to run: 'graphers' for default Grapher views, 'grapher-views' for all views of a subset of Graphers",
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
