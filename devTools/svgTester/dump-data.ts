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

async function main(parsedArgs: ReturnType<typeof parseArguments>) {
    try {
        const outDir = parsedArgs.o
        const topN = parsedArgs.top
        const concurrency = parsedArgs.concurrency

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const graphers = await knexReadonlyTransaction(
            async (trx) =>
                topN !== undefined
                    ? getMostViewedGraphers(trx, topN)
                    : getAllPublishedGraphers(trx),
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
        .options({
            o: {
                type: "string",
                description:
                    "Output directory. Inside it one dir per grapher will be created.",
                default: "../owid-grapher-svgs/graphers/default-views/data",
            },
            top: {
                type: "number",
                description:
                    "Export only the top N most-viewed charts per chart type. If not specified, all charts are exported.",
            },
            concurrency: {
                type: "number",
                description: "Number of charts to export in parallel.",
                default: 32,
            },
        })
        .example([
            ["$0", "Export all charts"],
            ["$0 --top 25", "Export top 25 most-viewed charts per chart type"],
            [
                "$0 --top 10 -o /tmp",
                "Export top 10 most-viewed charts per chart type to /tmp",
            ],
            ["$0 --concurrency 16", "Export all charts with concurrency of 16"],
            [
                "$0 --top 5 --concurrency 8",
                "Export top 5 charts per type with concurrency of 8",
            ],
        ])
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

const argv = parseArguments()
void main(argv)
