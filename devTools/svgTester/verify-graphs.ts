#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"

import * as path from "path"

import { ChartTypeName } from "../../grapher/core/GrapherConstants"
const Pool = require("multiprocessing").Pool
//import { Pool } from "multiprocessing"
const pool = new Pool()
async function main(parsedArgs: parseArgs.ParsedArgs) {
    // perpare and check arguments
    const inDir = parsedArgs["i"] ?? "grapherData"
    const referenceDir = parsedArgs["r"] ?? "grapherSvgs"
    const outDir = parsedArgs["o"] ?? "differentGrapherSvgs"
    const numPartitions = parsedArgs["n"] ?? 1
    const partition = parsedArgs["p"] ?? 1
    const reverseDirectories = parsedArgs["l"] ?? false
    const verbose = parsedArgs["v"] ?? false
    // minimist turns a single number into a JS number so we do toString to normalize (TS types are misleading)
    const rawGrapherIds: string = (parsedArgs["g"] ?? "").toString()

    if (partition <= 0) throw "Partition must be >= 1"
    if (partition > numPartitions) throw "Partition must be <= numPartitions"
    if (numPartitions <= 0) throw "numPartitions must be >= 1"
    if (numPartitions > 1000) throw "numPartitions must be <= 1000"
    if (!fs.existsSync(inDir)) throw `Input directory does not exist ${inDir}`
    if (!fs.existsSync(referenceDir))
        throw `Reference directory does not exist ${inDir}`
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

    const {
        directoriesToProcess,
        csvContentMap,
    } = await utils.prepareVerifyRun(
        rawGrapherIds,
        inDir,
        reverseDirectories,
        referenceDir
    )

    const verifyJobs = directoriesToProcess.map((dir) => ({
        dir,
        referenceEntry: csvContentMap.get(parseInt(dir)),
        referenceDir,
        outDir,
        verbose,
    }))

    const validationResults: utils.Result<
        null,
        utils.SvgDifference
    >[] = await pool.map(verifyJobs, `${__dirname}\\verify-graphs-runner`)

    utils.logIfVerbose(verbose, "Verifications completed")

    const errorResults = validationResults.filter(
        (result) => result.kind === "error"
    ) as utils.ResultError<utils.SvgDifference>[]

    if (errorResults.length === 0) {
        utils.logIfVerbose(
            verbose,
            `There were no differences in all ${directoriesToProcess.length} graphs processed`
        )
        process.exitCode = 0
    } else {
        console.warn(
            `${errorResults.length} graphs had differences: ${errorResults
                .map((err) => err.error.chartId)
                .join()}`
        )
        for (const result of errorResults) {
            console.log("", result.error.chartId) // write to stdout one grapher id per file for easy piping to other processes
        }
        process.exitCode = errorResults.length
    }
    process.exit()
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`verify-graphs.js - utility to check if grapher svg renderings have changed vs the reference export

Usage:
    verify-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -r DIR         Input directory containing the results.csv file to check against [default: grapherSvgs]
    -o DIR         Output directory that will contain the svg files that were different [default: differentGrapherSvgs]
    -g IDS         Manually specify ids to verify (use comma separated ids and ranges, all without spaces. E.g.: 2,4-8,10)
    -l             Reverse the order (start from last). Useful to test different generation order.
    -v             Verbose mode
    `)
} else {
    try {
        main(parsedArgs)
    } catch (error) {
        console.error("Encountered an error", error)
        process.exitCode = -1
    }
}
