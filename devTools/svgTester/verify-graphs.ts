#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import fs from "fs-extra"

import workerpool from "workerpool"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        // prepare and check arguments
        const inDir = parsedArgs["i"] ?? utils.DEFAULT_CONFIGS_DIR
        const referenceDir = parsedArgs["r"] ?? utils.DEFAULT_REFERENCE_DIR
        const outDir = parsedArgs["o"] ?? utils.DEFAULT_DIFFERENCES_DIR
        const verbose = parsedArgs["v"] ?? false
        const suffix = parsedArgs["s"] ?? ""
        const targetGrapherIds = utils.getGrapherIdListFromString(
            utils.parseArgAsString(parsedArgs["c"])
        )
        const targetChartTypes = utils.parseArgAsList(parsedArgs["t"])
        const randomCount =
            utils.parseArgAsOptionalNumber(parsedArgs["random"], {
                defaultIfFlagIsSpecified: 10,
            }) || undefined
        const rmOnError = parsedArgs["rmOnError"] ?? false

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(referenceDir))
            throw `Reference directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        // Get the directories to process as a list and the content of the csv file with the md5 hashes etc as a map of grapher id -> SvgResult
        const directoriesToProcess = await utils.getDirectoriesToProcess(
            inDir,
            {
                grapherIds: targetGrapherIds,
                chartTypes: targetChartTypes,
                randomCount,
            }
        )
        const csvContentMap =
            await utils.getReferenceCsvContentMap(referenceDir)

        const verifyJobs = directoriesToProcess.map((dir) => ({
            dir,
            referenceEntry: csvContentMap.get(dir.chartId)!,
            referenceDir,
            outDir,
            verbose,
            suffix,
            rmOnError,
        }))

        const pool = workerpool.pool(__dirname + "/worker.js", {
            minWorkers: 2,
        })

        // Parallelize the CPU heavy verification using the workerpool library
        // This call will then in parallel take the descriptions of the verifyJobs,
        // load the config and data and intialize a grapher, create the default svg output and check if it's md5 hash is the same as the one in
        // the reference csv file (from the csvContentMap lookup above). The entire parallel operation returns a promise containing an array
        // of result values.
        const validationResults: utils.VerifyResult[] = await Promise.all(
            verifyJobs.map((job) => pool.exec("renderAndVerifySvg", [job]))
        )

        if (validationResults.length !== verifyJobs.length)
            // This is a sanity check that should never trigger
            throw `Ran ${verifyJobs.length} verify jobs but only got ${validationResults.length} results!`

        utils.logIfVerbose(verbose, "Verifications completed")

        const exitCode = utils.displayVerifyResultsAndGetExitCode(
            validationResults,
            verbose,
            directoriesToProcess
        )
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(exitCode)
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`verify-graphs.js - utility to check if grapher svg renderings have changed vs the reference export

Usage:
    verify-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR              Input directory containing the data. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    -r DIR              Input directory containing the results.csv file to check against [default: ${utils.DEFAULT_REFERENCE_DIR}]
    -o DIR              Output directory that will contain the svg files that were different [default: ${utils.DEFAULT_DIFFERENCES_DIR}]
    -c IDS              Manually specify ids to verify (use comma separated ids and ranges, all without spaces. E.g.: 2,4-8,10)
    -t TYPES            A comma-separated list of chart types that you want to run instead of generating SVGs from all configs [default: undefined]
    -v                  Verbose mode
    -s SUFFIX           Suffix for different svg files to create <NAME><SUFFIX>.svg files - useful if you want to set output to the same as reference
    --random NUMBER     Verify a random set of charts [default: false]
    --rmOnError         Remove output files where we encounter errors, so errors are apparent in diffs
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
