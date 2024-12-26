#! /usr/bin/env node

import fs from "fs-extra"
import parseArgs from "minimist"
import path from "path"
import workerpool from "workerpool"

import * as utils from "./utils.js"

async function main(args: parseArgs.ParsedArgs) {
    try {
        // input and output directories
        const inDir: string = args["i"] ?? utils.DEFAULT_CONFIGS_DIR
        let outDir: string = args["o"] ?? utils.DEFAULT_REFERENCE_DIR

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
        const enableComparisons: boolean = args["compare"] ?? false
        const isolate: boolean = args["isolate"] ?? false
        const verbose: boolean = args["verbose"] ?? false

        if (isolate) {
            utils.logIfVerbose(
                verbose,
                "Running in 'isolate' mode. This will be slower, but heap usage readouts will be accurate."
            )
        } else {
            utils.logIfVerbose(
                verbose,
                "Not running in 'isolate'. Reported heap usage readouts will be inaccurate. Run in --isolate mode (way slower!) for accurate heap usage readouts."
            )
        }

        // create a directory that contains the old and new svgs for easy comparing
        if (enableComparisons) {
            outDir = path.join(outDir, "comparisons")
        }

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

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

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            chartViewsToGenerate.map((chart: utils.ChartWithQueryStr) => ({
                dir: path.join(inDir, chart.id.toString()),
                queryStr: chart.queryStr,
                outDir,
            }))

        // if verbose, log how many SVGs we're going to generate
        const jobCount = jobDescriptions.length
        if (jobCount === 0) {
            utils.logIfVerbose(verbose, "No matching configs found")
            process.exit(0)
        } else {
            utils.logIfVerbose(
                verbose,
                `Generating ${jobCount} SVG${jobCount > 1 ? "s" : ""}...`
            )
        }

        let svgRecords: utils.SvgRecord[] = []
        if (!isolate) {
            const pool = workerpool.pool(__dirname + "/worker.js", {
                minWorkers: 2,
            })

            // Parallelize the CPU heavy rendering jobs
            svgRecords = await Promise.all(
                jobDescriptions.map((job) =>
                    pool.exec("renderSvgAndSave", [job])
                )
            )
        } else {
            let i = 1
            for (const job of jobDescriptions) {
                const pool = workerpool.pool(__dirname + "/worker.js", {
                    maxWorkers: 1,
                })
                const svgRecord = await pool.exec("renderSvgAndSave", [job])
                pool.terminate()
                svgRecords.push(svgRecord)
                console.log(i++, "/", jobCount)
            }
        }

        // Copy over copies from master for easy comparing
        if (enableComparisons) {
            const comparisonDir = await fs.opendir(outDir)
            const filenames: string[] = []
            for await (const file of comparisonDir) {
                if (file.name.includes("svg")) {
                    filenames.push(file.name)
                }
            }
            const svgPath = path.join(inDir, "..", "svg")
            const masterDir = await fs.opendir(svgPath)
            for await (const file of masterDir) {
                if (filenames.includes(file.name)) {
                    await fs.copyFile(
                        path.join(svgPath, file.name),
                        path.join(outDir, file.name.replace(".svg", "_old.svg"))
                    )
                    await fs.copyFile(
                        path.join(outDir, file.name),
                        path.join(svgPath, file.name)
                    )
                }
            }
        }

        await utils.writeReferenceCsv(outDir, svgRecords)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(0)
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Export Grapher SVG renderings and a summary CSV file

Usage:
    export-graphs.js [-i] [-o] [-c | --ids] [-t | --chart-types] [-d | --random] [-f | --ids-from-file] [-q | --query-str] [--all-views] [--compare] [--isolate] [--verbose] [--help | -h]

Inputs and outputs:
    -i      Input directory containing Grapher configs and data. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    -o      Output directory that will contain the CSV file and one SVG file per grapher [default: ${utils.DEFAULT_REFERENCE_DIR}]

Charts to process:
    --ids, -c               A comma-separated list of config IDs and config ID ranges, e.g. 2,4-8,10
    --chart-types, -t       A comma-separated list of chart types, e.g. LineChart,ScatterPlot
    --random, -d            Generate SVGs for a random set of configs, optionally specify a count
    --ids-from-file, -f     Generate SVGs for a set of configs read from a file with one config ID per line

Chart configurations to test:
    --query-str, -q     Grapher query string to export charts with a specific configuration, e.g. tab=chart&stackMode=relative
    --all-views         For each Grapher, generate SVGs for all possible chart configurations
    
Other options:
    --compare       Create a directory containing the old and new SVGs for easy comparison
    --isolate       Run each export in a separate process. This yields accurate heap usage measurements, but is slower.
    --verbose       Verbose mode
    -h, --help      Display this help and exit
    `)
    process.exit(0)
} else {
    void main(parsedArgs)
}
