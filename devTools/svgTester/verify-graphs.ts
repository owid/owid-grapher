#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import path from "path"
import workerpool from "workerpool"
import * as _ from "lodash-es"

import * as utils from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"
import { ALL_GRAPHER_CHART_TYPES } from "@ourworldindata/types"

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        // Test suite
        const testSuite = args.testSuite as utils.TestSuite

        // Input and output directories
        const dataDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
        const referencesDir = path.join(
            utils.SVG_REPO_PATH,
            testSuite,
            "references"
        )
        const differencesDir = path.join(
            utils.SVG_REPO_PATH,
            testSuite,
            "differences"
        )

        // charts to process
        const targetViewIds = args.viewIds
        const targetChartTypes = args.chartTypes
        const randomCount = args.random

        // Chart configurations to test
        const grapherQueryString = args.queryStr
        const shouldTestAllChartViews =
            args.allViews ?? testSuite === "grapher-views"

        // Other options
        const suffix = args.suffix
        const rmOnError = args.rmOnError
        const verbose = args.verbose

        if (!fs.existsSync(dataDir))
            throw `Input directory does not exist ${dataDir}`
        if (!fs.existsSync(referencesDir))
            throw `Reference directory does not exist ${dataDir}`
        if (!fs.existsSync(differencesDir)) fs.mkdirSync(differencesDir)

        const chartIdsToProcess = await utils.selectChartIdsToProcess(dataDir, {
            viewIds: targetViewIds,
            chartTypes: targetChartTypes,
            randomCount,
        })

        const chartViewsToGenerate = await utils.findChartViewsToGenerate(
            dataDir,
            chartIdsToProcess,
            {
                queryStr: grapherQueryString,
                shouldTestAllViews: shouldTestAllChartViews,
            }
        )

        const referenceData = await utils.parseReferenceCsv(referencesDir)
        const referenceDataByChartKey = new Map(
            referenceData.map((record) => [
                grapherSlugToExportFileKey(record.viewId, record.queryStr),
                record,
            ])
        )

        const verifyJobs: utils.RenderJobDescription[] =
            chartViewsToGenerate.map((chart) => {
                const { viewId, queryStr } = chart
                const key = grapherSlugToExportFileKey(viewId, queryStr)
                const referenceEntry = referenceDataByChartKey.get(key)!
                const pathToProcess = path.join(dataDir, viewId)
                return {
                    dir: { viewId: chart.viewId, pathToProcess },
                    referenceEntry,
                    referenceDir: referencesDir,
                    outDir: differencesDir,
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

        const pool = workerpool.pool(__dirname + "/worker.ts", {
            minWorkers: 2,
            maxWorkers: 12,
            workerThreadOpts: {
                execArgv: ["--require", "tsx"],
            },
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

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage(
            "Check if grapher SVG renderings have changed vs the reference export"
        )
        .command("$0 [testSuite]", false)
        .positional("testSuite", {
            type: "string",
            description: utils.TEST_SUITE_DESCRIPTION,
            default: "graphers",
            choices: utils.TEST_SUITES,
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            "view-ids": {
                alias: "c",
                type: "string",
                array: true,
                description:
                    "A space-separated list of grapher IDs or mdim view ids, e.g. '2 4 8 10'",
            },
            chartTypes: {
                alias: "t",
                type: "string",
                array: true,
                choices: ALL_GRAPHER_CHART_TYPES,
                description:
                    "A space-separated list of chart types, e.g. 'LineChart ScatterPlot'",
            },
            random: {
                alias: "d",
                type: "number",
                description: "Generate SVGs for a random set of configs",
            },
            queryStr: {
                alias: "q",
                type: "string",
                description:
                    "Grapher query string to verify charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            allViews: {
                type: "boolean",
                description:
                    "For each Grapher, verify SVGs for all possible chart configurations. Default depends on the test suite.",
            },
            suffix: {
                alias: "s",
                type: "string",
                description:
                    "Suffix for different SVG files to create <NAME><SUFFIX>.svg files",
                default: "",
            },
            rmOnError: {
                type: "boolean",
                description:
                    "Remove output files where we encounter errors, so errors are apparent in diffs",
                default: false,
            },
            verbose: {
                type: "boolean",
                description: "Verbose mode",
                default: false,
            },
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

const argv = parseArguments()
void main(argv)
