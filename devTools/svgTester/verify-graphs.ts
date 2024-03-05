#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import workerpool from "workerpool"
import _ from "lodash"

import * as utils from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"

async function main(args: parseArgs.ParsedArgs) {
    try {
        // input and output directories
        const inDir: string = args["i"] ?? utils.DEFAULT_CONFIGS_DIR
        const referenceDir: string = args["r"] ?? utils.DEFAULT_REFERENCE_DIR
        const outDir: string = args["o"] ?? utils.DEFAULT_DIFFERENCES_DIR

        // charts to process
        const targetGrapherIds = utils.getGrapherIdListFromString(
            utils.parseArgAsString(args["ids"] ?? args["c"])
        )
        const targetChartTypes = utils.validateChartTypes(
            utils.parseArgAsList(args["chart-types"] ?? args["t"])
        )
        const randomCount = utils.parseRandomCount(args["random"] ?? args["d"])
        const chartIdsFile: string = args["ids-from-file"] ?? args["f"]

        // chart configurations to test
        const grapherQueryString: string = args["query-str"] ?? args["q"]
        const shouldTestAllChartViews: boolean = args["all-views"] ?? false

        // other options
        const suffix: string = args["suffix"] ?? ""
        const rmOnError: boolean = args["rm-on-error"] ?? false
        const verbose: boolean = args["verbose"] ?? false

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(referenceDir))
            throw `Reference directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const chartIdsToProcess = await utils.selectChartIdsToProcess(inDir, {
            chartIdsFile,
            grapherIds: targetGrapherIds,
            chartTypes: targetChartTypes,
            randomCount,
        })

        const chartViewsToGenerate = await utils.findChartViewsToGenerate(
            inDir,
            chartIdsToProcess,
            {
                queryStr: grapherQueryString,
                shouldTestAllViews: shouldTestAllChartViews,
            }
        )

        const referenceData = await utils.parseReferenceCsv(referenceDir)
        const referenceDataByChartKey = new Map(
            referenceData.map((record) => [
                grapherSlugToExportFileKey(record.slug, record.queryStr),
                record,
            ])
        )

        const verifyJobs: utils.RenderJobDescription[] =
            chartViewsToGenerate.map((chart) => {
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
            })

        // if verbose, log how many SVGs we're going to process
        const jobCount = verifyJobs.length
        if (jobCount === 0) {
            utils.logIfVerbose(verbose, "No matching configs found")
            process.exit(0)
        } else {
            utils.logIfVerbose(
                verbose,
                `Verifying ${jobCount} SVG${jobCount > 1 ? "s" : ""}...`
            )
        }

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
            verbose,
            shouldTestAllChartViews ? "__all_views" : ""
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
    console.log(`Check if grapher SVG renderings have changed vs the reference export

Usage:
    verify-graphs.js [-i] [-r] [-o] [-c | --ids] [-t | --chart-types] [-d | --random] [-f | --ids-from-file] [-q | --query-str] [--all-views] [-s | --suffix] [--rm-on-error] [--verbose] [--help | -h]

Inputs and outputs:
    -i      Input directory containing Grapher configs and data. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    -r      Input directory containing the results.csv file to check against [default: ${utils.DEFAULT_REFERENCE_DIR}]
    -o      Output directory that will contain the SVGs that were different [default: ${utils.DEFAULT_DIFFERENCES_DIR}]

Charts to process:
    --ids, -c               A comma-separated list of config IDs and config ID ranges, e.g. 2,4-8,10
    --chart-types, -t       A comma-separated list of chart types, e.g. LineChart,ScatterPlot
    --random, -d            Verify SVGs for a random set of configs, optionally specify a count
    --ids-from-file, -f     Verify SVGs for a set of configs read from a file with one config ID per line

Chart configurations to test:
    --query-str, -q     Grapher query string to verify charts with a specific configuration, e.g. tab=chart&stackMode=relative
    --all-views         For each Grapher, verify SVGs for all possible chart configurations

Other options:
    --suffix, -s    Suffix for different SVG files to create <NAME><SUFFIX>.svg files - useful if you want to set output to the same as reference
    --rm-on-error   Remove output files where we encounter errors, so errors are apparent in diffs
    --verbose       Verbose mode
    -h, --help      Display this help and exit
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
