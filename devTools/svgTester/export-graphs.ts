#! /usr/bin/env node

import * as _ from "lodash-es"
import fs from "fs-extra"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import path from "path"
import workerpool from "workerpool"

import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as utils from "./utils.js"
import { MAX_WORKERS } from "./utils.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    SVG_TESTER_SUITES,
    type SvgTesterSuite,
} from "@ourworldindata/types"

async function exportGraphers(args: ReturnType<typeof parseArguments>) {
    try {
        // Test suite
        const testSuite = args.testSuite as SvgTesterSuite

        // Input and output directories
        const testSuiteDir = path.join(SVG_TESTER_REPO_PATH, testSuite)
        const outDir = path.join(testSuiteDir, "references")

        // Charts to process
        const targetViewIds = args.viewIds
        const targetChartTypes = args.chartTypes
        const randomCount = args.random

        // Load manifest and determine data directory
        const {
            viewIds: manifestViewIds,
            dataDir,
            manifestName,
        } = await utils.loadManifestViewIds(testSuite, {
            targetViewIds,
            manifestName: args.manifest,
        })

        // Chart configurations to test
        const grapherQueryString = args.queryStr
        const shouldTestAllChartViews =
            args.allViews ?? testSuite === "grapher-views"
        const shouldTestAllTabs = args.allTabs ?? testSuite === "thumbnails"

        // Other options
        const isolate = args.isolate

        if (!fs.existsSync(dataDir))
            throw `Input directory does not exist ${dataDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const startedAt = Date.now()

        const chartIdsToProcess = await utils.selectChartIdsToProcess(dataDir, {
            viewIds: targetViewIds ?? manifestViewIds ?? undefined,
            chartTypes: targetChartTypes,
            randomCount,
        })

        const chartViewsToGenerate = await utils.findChartViewsToGenerate(
            dataDir,
            chartIdsToProcess,
            {
                queryStr: grapherQueryString,
                shouldTestAllViews: shouldTestAllChartViews,
                shouldTestAllTabs,
            }
        )

        const variant = testSuite === "thumbnails" ? "thumbnail" : "default"

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            chartViewsToGenerate.map((chart: utils.ChartWithQueryStr) => ({
                dir: {
                    viewId: chart.viewId,
                    pathToProcess: path.join(dataDir, chart.viewId),
                },
                queryStr: chart.queryStr,
                outDir,
                variant,
            }))

        const jobCount = jobDescriptions.length
        if (jobCount === 0) {
            console.log(`${testSuite}: nothing to do, no configs matched`)
            process.exit(0)
        }

        utils.logRunStart(testSuite, "exporting", jobCount, manifestName)

        let svgRecords: utils.SvgRecord[] = []
        if (!isolate) {
            const pool = workerpool.pool(__dirname + "/worker.ts", {
                minWorkers: 2,
                maxWorkers: MAX_WORKERS,
                workerThreadOpts: {
                    execArgv: ["--require", "tsx"],
                },
            })

            const progress = utils.startProgress(testSuite, jobCount, pool)

            // Parallelize the CPU heavy rendering jobs
            try {
                svgRecords = await Promise.all(
                    jobDescriptions.map((job) =>
                        pool
                            .exec("renderSvgAndSave", [job])
                            .then((svgRecord: utils.SvgRecord) => {
                                progress.recordResult()
                                return svgRecord
                            })
                    )
                )
            } finally {
                progress.stop()
            }
        } else {
            console.log(
                `${testSuite}: isolate mode, one chart per process - slower, but heap readouts are accurate`
            )
            // A fresh single-worker pool per chart, so one is busy by construction
            const progress = utils.startProgress(testSuite, jobCount, {
                stats: () => ({ busyWorkers: 1 }),
            })
            try {
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
                    progress.recordResult()
                }
            } finally {
                progress.stop()
            }
        }

        await utils.writeReferenceCsv(outDir, svgRecords)
        utils.logExportSummary(
            testSuite,
            svgRecords.length,
            Date.now() - startedAt
        )
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(0)
    } catch (error) {
        console.error(`${args.testSuite}: export failed`, error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(1)
    }
}

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage("Export Grapher SVG renderings and a summary CSV file")
        .command("$0 [testSuite]", false)
        .positional("testSuite", {
            type: "string",
            description: utils.TEST_SUITE_DESCRIPTION,
            default: "graphers",
            choices: SVG_TESTER_SUITES,
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .options({
            viewIds: {
                alias: "c",
                type: "string",
                array: true,
                description:
                    "A space-separated list of grapher slugs or mdim view ids, e.g. 'life-expectancy population'",
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
            allTabs: {
                type: "boolean",
                description:
                    "For each Grapher, generate thumbnail SVGs for all available tabs. Default depends on the test suite.",
            },
            manifest: {
                type: "string",
                description:
                    "Manifest filename (e.g. 'top.manifest.json') specifying which charts to export. For grapher-views and thumbnails, defaults to 'top.manifest.json' if --viewIds is not provided. For other test suites, all charts in the data directory are exported if neither manifest nor --viewIds is provided.",
            },
            isolate: {
                type: "boolean",
                description:
                    "Run each export in a separate process. This yields accurate heap usage measurements, but is slower.",
                default: false,
            },
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

void exportGraphers(parseArguments())
