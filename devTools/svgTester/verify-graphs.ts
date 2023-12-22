#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import workerpool from "workerpool"
import _ from "lodash"

import * as utils from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        // input and output directories
        const inDir = parsedArgs["i"] ?? utils.DEFAULT_CONFIGS_DIR
        const referenceDir = parsedArgs["r"] ?? utils.DEFAULT_REFERENCE_DIR
        const outDir = parsedArgs["o"] ?? utils.DEFAULT_DIFFERENCES_DIR

        // charts to process
        const chartIdsFile = parsedArgs["from-file"]
        const targetGrapherIds = utils.getGrapherIdListFromString(
            utils.parseArgAsString(parsedArgs["configs"])
        )
        const targetChartTypes = utils.validateChartTypes(
            utils.parseArgAsList(parsedArgs["types"])
        )
        const randomCount = utils.parseRandomCount(parsedArgs["random"])

        // chart configurations to test
        const grapherQueryString = parsedArgs["query-str"]
        const shouldTestAllChartViews = parsedArgs["all-views"] ?? false

        // other options
        const suffix = parsedArgs["suffix"] ?? ""
        const rmOnError = parsedArgs["rmOnError"] ?? false
        const verbose = parsedArgs["verbose"] ?? false

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(referenceDir))
            throw `Reference directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const chartsToProcess = await utils.findChartsToProcess(inDir, {
            chartIdsFile,
            grapherIds: targetGrapherIds,
            chartTypes: targetChartTypes,
            randomCount,
            queryStr: grapherQueryString,
            shouldTestAllViews: shouldTestAllChartViews,
            verbose,
        })

        const referenceData = await utils.parseReferenceCsv(referenceDir)
        const referenceDataByChartKey = new Map(
            referenceData.map((record) => [
                grapherSlugToExportFileKey(record.slug, record.queryStr),
                record,
            ])
        )

        const verifyJobs: utils.RenderJobDescription[] = chartsToProcess.map(
            (chart) => {
                const { id, slug, queryStr } = chart
                const key = grapherSlugToExportFileKey(slug, queryStr)
                const referenceEntry = referenceDataByChartKey.get(key)!
                const pathToProcess = path.join(inDir, id.toString())
                return {
                    dir: { chartId: chart.id, pathToProcess },
                    referenceEntry,
                    referenceDir,
                    outDir,
                    queryStr,
                    verbose,
                    suffix,
                    rmOnError,
                }
            }
        )

        const pool = workerpool.pool(__dirname + "/worker.js", {
            minWorkers: 2,
        })

        // Parallelize the CPU heavy verification using the workerpool library
        // This call will then in parallel take the descriptions of the verifyJobs,
        // load the config and data and intialize a grapher, create the default svg output and check if it's md5 hash is the same as the one in
        // the reference csv file (from the referenceDataByChartKey lookup above). The entire parallel operation returns a promise containing an array
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
            verbose
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
    verify-graphs.js [-i DIR] [-r DIR] [-o DIR] [--configs IDS] [--types TYPES] [--query-str STRING] [--random COUNT] [--suffix SUFFIX] [--all-views] [--rmOnError] [--verbose] [--help | -h]

Options:
    -i DIR                  Input directory containing the data. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    -r DIR                  Input directory containing the results.csv file to check against [default: ${utils.DEFAULT_REFERENCE_DIR}]
    -o DIR                  Output directory that will contain the svg files that were different [default: ${utils.DEFAULT_DIFFERENCES_DIR}]
    
    --configs IDS           Manually specify ids to verify (use comma separated ids and ranges, all without spaces. E.g.: 2,4-8,10)
    --types TYPES           A comma-separated list of chart types that you want to run instead of generating SVGs from all configs [default: undefined]
    --query-str STRING      Grapher query string to verify a specific chart view [default: undefined]
    --random COUNT          Verify a random set of charts [default: false]

    --suffix SUFFIX         Suffix for different svg files to create <NAME><SUFFIX>.svg files - useful if you want to set output to the same as reference
    --all-views             Verify SVGs for all chart views [default: false]
    --rmOnError             Remove output files where we encounter errors, so errors are apparent in diffs
    --verbose               Verbose mode
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
