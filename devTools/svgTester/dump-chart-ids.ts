#! /usr/bin/env node

import fs from "fs-extra"
import parseArgs from "minimist"

import { TransactionCloseMode, knexReadonlyTransaction } from "../../db/db.js"
import { getMostViewedGrapherIdsByChartType } from "../../db/model/Chart.js"
import { CHART_TYPES } from "./utils.js"

const DEFAULT_OUT_FILE = "../owid-grapher-svgs/most-viewed-charts.txt"
const CHART_COUNT_PER_TYPE = 25

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const outFile = parsedArgs["o"] ?? DEFAULT_OUT_FILE

        const chartIds = await knexReadonlyTransaction(async (trx) => {
            const promises = CHART_TYPES.flatMap((chartType) =>
                getMostViewedGrapherIdsByChartType(
                    trx,
                    chartType,
                    CHART_COUNT_PER_TYPE
                )
            )
            const chartIds = (await Promise.all(promises)).flatMap((ids) => ids)
            return chartIds
        }, TransactionCloseMode.Close)

        console.log(`Writing ${chartIds.length} chart ids to ${outFile}`)

        fs.writeFileSync(outFile, chartIds.join("\n"))

        process.exit(0)
    } catch (error) {
        console.error("Encountered an error: ", error)
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Write most viewed chart ids to file for testing

Usage:
    dump-chart-ids.js [-o]

Options:
    -o   Output file with one chart id per line [default: ${DEFAULT_OUT_FILE}]
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
