#! /usr/bin/env node

import fs from "fs-extra"
import parseArgs from "minimist"
import path from "path"
import workerpool from "workerpool"

import * as utils from "./utils.js"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const inDir = parsedArgs["i"] ?? utils.DEFAULT_CONFIGS_DIR
        let outDir = parsedArgs["o"] ?? utils.DEFAULT_REFERENCE_DIR
        const targetGrapherIds = utils.getGrapherIdListFromString(
            utils.parseArgAsString(parsedArgs["c"])
        )
        const targetChartTypes = utils.validateChartTypes(
            utils.parseArgAsList(parsedArgs["t"])
        )
        const grapherQueryString = parsedArgs["q"]
        const shouldTestAllChartViews = parsedArgs["all-views"] ?? false
        const enableComparisons = parsedArgs["compare"] ?? false
        const isolate = parsedArgs["isolate"] ?? false
        const randomCount = utils.parseRandomCount(parsedArgs["random"])
        const verbose = parsedArgs["v"] ?? false

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

        const chartsToProcess = await utils.findChartsToProcess(inDir, {
            grapherIds: targetGrapherIds,
            chartTypes: targetChartTypes,
            randomCount,
            queryStr: grapherQueryString,
            shouldTestAllViews: shouldTestAllChartViews,
            verbose,
        })

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            chartsToProcess.map((chart: utils.ChartForTesting) => ({
                dir: path.join(inDir, chart.id.toString()),
                queryStr: chart.queryStr,
                outDir,
            }))

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
                console.log(i++, "/", jobDescriptions.length)
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
    console.log(`export-graphs.js - utility to export grapher svg renderings and a summary csv file

Usage:
    export-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR             Input directory containing the data. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    -o DIR             Output directory that will contain the csv file and one svg file per grapher [default: ${utils.DEFAULT_REFERENCE_DIR}]
    -c IDS             A comma-separated list of config IDs and config ID ranges that you want to run instead of generating SVGs from all configs, e.g. 2,4-8,10 [default: undefined]
    -t TYPES           A comma-separated list of chart types that you want to run instead of generating SVGs from all configs [default: undefined]
    -q QUERY_STRING    Grapher query string to export a specific chart view [default: undefined]
    --random COUNT     Generate SVGs for a random set of configs [default: false]
    --all-views        Generate SVGs for all chart views [default: false]
    --compare          Create a directory containing the old and new SVGs for easy comparison [default: false]
    --isolate          Run each export in a separate process. This yields accurate heap usage measurements, but is slower. [default: false]
    -v                 Verbose mode
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
