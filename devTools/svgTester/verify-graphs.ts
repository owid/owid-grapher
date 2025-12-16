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
        // input and output directories
        const inDir: string = args.i
        const referenceDir: string = args.r
        const outDir: string = args.o

        // charts to process
        const targetGrapherIds = args.ids
        const targetChartTypes = args.chartTypes
        const randomCount = args.random

        // chart configurations to test
        const grapherQueryString: string = args.queryStr ?? ""
        const shouldTestAllChartViews: boolean = args.allViews

        // other options
        const suffix: string = args.suffix ?? ""
        const rmOnError: boolean = args.rmOnError
        const verbose: boolean = args.verbose

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(referenceDir))
            throw `Reference directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const chartIdsToProcess = await utils.selectChartIdsToProcess(inDir, {
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
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            i: {
                type: "string",
                description:
                    "Input directory containing Grapher configs and data",
                default: "../owid-grapher-svgs/graphers/default-views/data",
            },
            r: {
                type: "string",
                description:
                    "Input directory containing the results.csv file to check against",
                default:
                    "../owid-grapher-svgs/graphers/default-views/references",
            },
            o: {
                type: "string",
                description:
                    "Output directory that will contain the SVGs that were different",
                default:
                    "../owid-grapher-svgs/graphers/default-views/differences",
            },
            ids: {
                alias: "c",
                type: "number",
                array: true,
                description:
                    "A space-separated list of config IDs, e.g. '2 4 8 10'",
            },
            "chart-types": {
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
            "query-str": {
                alias: "q",
                type: "string",
                description:
                    "Grapher query string to verify charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            "all-views": {
                type: "boolean",
                description:
                    "For each Grapher, verify SVGs for all possible chart configurations",
                default: false,
            },
            suffix: {
                alias: "s",
                type: "string",
                description:
                    "Suffix for different SVG files to create <NAME><SUFFIX>.svg files",
            },
            "rm-on-error": {
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
