#! /usr/bin/env node

import fs from "fs-extra"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import path from "path"
import workerpool from "workerpool"

import * as utils from "./utils.js"
import { ALL_GRAPHER_CHART_TYPES } from "@ourworldindata/types"

async function main(args: ReturnType<typeof parseArguments>) {
    try {
        // input and output directories
        const inDir: string = args.i
        let outDir: string = args.o

        // charts to process
        const targetGrapherIds = args.ids
        const targetChartTypes = args.chartTypes
        const randomCount = args.random

        // chart configurations to test
        const grapherQueryString: string = args.queryStr ?? ""
        const shouldTestAllChartViews: boolean = args.allViews

        // other options
        const enableComparisons: boolean = args.compare
        const isolate: boolean = args.isolate
        const verbose: boolean = args.verbose

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
            const pool = workerpool.pool(__dirname + "/worker.ts", {
                minWorkers: 2,
                workerThreadOpts: {
                    execArgv: ["--require", "tsx"],
                },
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
                const pool = workerpool.pool(__dirname + "/worker.ts", {
                    maxWorkers: 1,
                    workerThreadOpts: {
                        execArgv: ["--require", "tsx"],
                    },
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

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage("Export Grapher SVG renderings and a summary CSV file")
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            i: {
                type: "string",
                description:
                    "Input directory containing Grapher configs and data",
                default: "../owid-grapher-svgs/graphers/default-views/data",
            },
            o: {
                type: "string",
                description:
                    "Output directory that will contain the CSV file and one SVG file per grapher",
                default:
                    "../owid-grapher-svgs/graphers/default-views/references",
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
                    "Grapher query string to export charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            "all-views": {
                type: "boolean",
                description:
                    "For each Grapher, generate SVGs for all possible chart configurations",
                default: false,
            },
            compare: {
                type: "boolean",
                description:
                    "Create a directory containing the old and new SVGs for easy comparison",
                default: false,
            },
            isolate: {
                type: "boolean",
                description:
                    "Run each export in a separate process. This yields accurate heap usage measurements, but is slower.",
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
