#! /usr/bin/env node

import * as _ from "lodash-es"
import { match } from "ts-pattern"
import fs from "fs-extra"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import path from "path"
import workerpool from "workerpool"

import * as utils from "./utils.js"
import { ALL_GRAPHER_CHART_TYPES } from "@ourworldindata/types"

async function exportGraphers(args: ReturnType<typeof parseArguments>) {
    try {
        // Test suite
        const testSuite = args.testSuite as utils.TestSuite

        // Input and output directories
        const dataDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
        const outDir = path.join(utils.SVG_REPO_PATH, testSuite, "references")

        // Charts to process
        const targetViewIds = args.viewIds
        const targetChartTypes = args.chartTypes
        const randomCount = args.random

        // Chart configurations to test
        const grapherQueryString = args.queryStr
        const shouldTestAllChartViews =
            args.allViews ?? testSuite === "grapher-views"

        // Other options
        const isolate = args.isolate
        const verbose = args.verbose

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

        if (!fs.existsSync(dataDir))
            throw `Input directory does not exist ${dataDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

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

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            chartViewsToGenerate.map((chart: utils.ChartWithQueryStr) => ({
                dir: {
                    viewId: chart.viewId,
                    pathToProcess: path.join(dataDir, chart.viewId),
                },
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

async function exportExplorers(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as utils.TestSuite
    const verbose = args.verbose

    // Input and output directories
    const dataDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
    const outDir = path.join(utils.SVG_REPO_PATH, testSuite, "references")

    if (!fs.existsSync(dataDir))
        throw `Input directory does not exist ${dataDir}`
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

    // Collect all explorer directories
    const explorerJobs: { dir: string; outDir: string }[] = []
    const dir = await fs.opendir(dataDir)
    for await (const entry of dir) {
        if (!entry.isDirectory()) continue

        const explorerDataDir = path.join(dataDir, entry.name)
        explorerJobs.push({ dir: explorerDataDir, outDir })
    }

    const jobCount = explorerJobs.length
    if (jobCount === 0) {
        utils.logIfVerbose(verbose, "No explorer directories found")
        process.exit(0)
    } else {
        utils.logIfVerbose(
            verbose,
            `Exporting ${jobCount} explorer${jobCount > 1 ? "s" : ""}...`
        )
    }

    const pool = workerpool.pool(__dirname + "/worker.ts", {
        minWorkers: 2,
        maxWorkers: 12,
        workerThreadOpts: {
            execArgv: ["--require", "tsx"],
        },
    })

    const allSvgRecordsArrays: utils.SvgRecord[][] = await Promise.all(
        explorerJobs.map((job) =>
            pool.exec("renderExplorerViewsToSVGsAndSave", [job])
        )
    )

    await pool.terminate()

    const allSvgRecords = allSvgRecordsArrays.flat()
    await utils.writeReferenceCsv(outDir, allSvgRecords)
}

async function main(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as utils.TestSuite

    await match(testSuite)
        .with("graphers", () => exportGraphers(args))
        .with("grapher-views", () => exportGraphers(args))
        .with("mdims", () => exportGraphers(args))
        .with("explorers", () => exportExplorers(args))
        .exhaustive()
}

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage("Export Grapher SVG renderings and a summary CSV file")
        .command("$0 [testSuite]", false)
        .positional("testSuite", {
            type: "string",
            description: utils.TEST_SUITE_DESCRIPTION,
            default: "graphers",
            choices: utils.TEST_SUITES,
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            viewIds: {
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
                alias: "r",
                type: "number",
                description: "Generate SVGs for a random set of configs",
            },
            queryStr: {
                alias: "q",
                type: "string",
                description:
                    "Grapher query string to export charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            allViews: {
                type: "boolean",
                description:
                    "For each Grapher, generate SVGs for all possible chart configurations. Default depends on the test suite.",
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
