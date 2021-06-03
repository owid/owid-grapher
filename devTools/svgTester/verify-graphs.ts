#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"

import * as path from "path"

import { ChartTypeName } from "../../grapher/core/GrapherConstants"
const Pool = require("multiprocessing").Pool
const pool = new Pool()

async function main(parsedArgs: parseArgs.ParsedArgs) {
    // perpare and check arguments
    const inDir = parsedArgs["i"] ?? "grapherData"
    const referenceDir = parsedArgs["r"] ?? "grapherSvgs"
    const outDir = parsedArgs["o"] ?? "differentGrapherSvgs"
    const reverseDirectories = parsedArgs["l"] ?? false
    const verbose = parsedArgs["v"] ?? false
    // minimist turns a single number into a JS number so we do toString to normalize (TS types are misleading)
    const rawGrapherIds: string = (parsedArgs["g"] ?? "").toString()

    if (!fs.existsSync(inDir)) throw `Input directory does not exist ${inDir}`
    if (!fs.existsSync(referenceDir))
        throw `Reference directory does not exist ${inDir}`
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

    // Get the directories to process as a list and the content of the csv file with the md5 hashes etc as a map of grapher id -> SvgResult
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

    // Parellize the CPU heavy verification using the multiprocessing library. This library stringifies the invocation to other processes
    // so this call uses the intermediate verify-graphs-runner script. This call will then in parallel take the descriptions of the verifyJobs,
    // load the config and data and intialize a grapher, create the default svg output and check if it's md5 hash is the same as the one in
    // the reference csv file (from the csvContentMap lookup above). The entire parallel operation returns a promise containing an array
    // or result values.
    const validationResults: utils.Result<
        null,
        utils.SvgDifference
    >[] = await pool.map(
        verifyJobs,
        path.join(__dirname, "verify-graphs-runner")
    )

    utils.logIfVerbose(verbose, "Verifications completed")

    const exitCode = utils.displayVerifyResultsAndGetExitCode(
        validationResults,
        verbose,
        directoriesToProcess
    )
    // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
    // was not required before introducing the multiprocessing library.
    process.exit(exitCode)
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
