#! /usr/bin/env node

import * as _ from "lodash-es"
import { match } from "ts-pattern"
import fs from "fs-extra"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import path from "path"
import type { Pool } from "workerpool"

import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as utils from "./utils.js"
import { registerExitHandler } from "../../db/cleanup.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    SVG_TESTER_SUITES,
    type SvgTesterSuite,
} from "@ourworldindata/types"

async function exportGraphers(args: ReturnType<typeof parseArguments>) {
    // Declared out here so the catch below can shut it down too: that path is a
    // crash, which is precisely when orphaned workers are easiest to leave behind.
    let pool: Pool | undefined
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
        const { viewIds: manifestViewIds, dataDir } =
            await utils.loadManifestViewIds(testSuite, {
                targetViewIds,
                manifestName: args.manifest,
                verbose: args.verbose,
            })

        // Chart configurations to test
        const grapherQueryString = args.queryStr
        const shouldTestAllChartViews =
            args.allViews ?? testSuite === "grapher-views"
        const shouldTestAllTabs = args.allTabs ?? testSuite === "thumbnails"

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
            // `activePool` is what the closure below uses: narrowing does
            // not survive a captured `let`, and the outer binding only exists
            // so the catch can shut the pool down.
            const activePool = utils.createSvgTesterPool()
            pool = activePool
            // Ctrl-C and a cancelled Buildkite step both kill this process
            // without reaching the shutdown below, and child workers - unlike
            // the threads they replaced - outlive their parent.
            registerExitHandler(() => utils.shutDownPool(activePool))

            // Parallelize the CPU heavy rendering jobs. Time-boxed like the
            // verify side: a worker parked in oxfmt's native formatter never
            // settles, and refresh.sh runs this with no `timeout` wrapper at
            // all, so without this the export just hangs forever.
            svgRecords = await Promise.all(
                jobDescriptions.map((job) =>
                    activePool
                        .exec("renderSvgAndSave", [job])
                        .timeout(utils.JOB_TIMEOUT_MS)
                )
            )
        } else {
            let i = 1
            for (const job of jobDescriptions) {
                pool = utils.createSvgTesterPool(1)
                const svgRecord = await pool.exec("renderSvgAndSave", [job])
                // Awaited, unlike before: a pool per job means an un-awaited
                // teardown would leave a process behind on every iteration.
                await utils.shutDownPool(pool)
                pool = undefined
                svgRecords.push(svgRecord)
                console.log(i++, "/", jobCount)
            }
        }

        await utils.writeReferenceCsv(outDir, svgRecords)
        if (pool) await utils.shutDownPool(pool)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(0)
    } catch (error) {
        console.error("Encountered an error: ", error)
        if (pool) await utils.shutDownPool(pool)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

async function main(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as SvgTesterSuite

    await match(testSuite)
        .with("graphers", () => exportGraphers(args))
        .with("grapher-views", () => exportGraphers(args))
        .with("mdims", () => exportGraphers(args))
        .with("thumbnails", () => exportGraphers(args))
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
