#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import path from "path"
import * as _ from "lodash-es"
import { match } from "ts-pattern"

import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as utils from "./utils.js"
import { JOB_TIMEOUT_MS } from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"
import { registerExitHandler } from "../../db/cleanup.js"
import type { Pool } from "workerpool"
import {
    ALL_GRAPHER_CHART_TYPES,
    SVG_TESTER_SUITES,
    type SvgTesterSuite,
} from "@ourworldindata/types"

async function verifyGraphers(args: ReturnType<typeof parseArguments>) {
    // Declared out here so the catch below can shut it down too: that path is a
    // crash, which is precisely when orphaned workers are easiest to leave behind.
    let pool: Pool | undefined
    try {
        // Test suite
        const testSuite = args.testSuite as SvgTesterSuite

        // Input and output directories
        const testSuiteDir = path.join(SVG_TESTER_REPO_PATH, testSuite)
        const referencesDir = path.join(testSuiteDir, "references")
        const differencesDir = path.join(testSuiteDir, "differences")

        // charts to process
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
        const rmOnError = args.rmOnError
        const verbose = args.verbose

        if (!fs.existsSync(dataDir))
            throw `Input directory does not exist ${dataDir}`
        if (!fs.existsSync(referencesDir))
            throw `Reference directory does not exist ${referencesDir}`
        if (!fs.existsSync(differencesDir)) fs.mkdirSync(differencesDir)

        // Claim the results file up front: from here on its absence means the
        // suite never started, and a lingering "running" status means it was
        // killed before it could report.
        const startedAt = new Date()
        await utils.writeVerifyRunStarted(testSuiteDir, testSuite, startedAt)

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

        const referenceData = await utils.parseReferenceCsv(referencesDir)
        const referenceDataByChartKey = new Map(
            referenceData.map((record) => [
                grapherSlugToExportFileKey(record.viewId, record.queryStr),
                record,
            ])
        )

        const variant = testSuite === "thumbnails" ? "thumbnail" : "default"

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
                    variant,
                    verbose,
                    rmOnError,
                }
            })

        const jobCount = verifyJobs.length
        if (jobCount === 0) {
            utils.logIfVerbose(verbose, "No matching configs found")
            // Nothing to do is a legitimate outcome, but it still has to
            // overwrite the "running" placeholder written above.
            await utils.writeVerifyResults(
                testSuiteDir,
                utils.summariseVerifyResults([], {
                    suite: testSuite,
                    startedAt,
                    durationMs: Date.now() - startedAt.getTime(),
                })
            )
            process.exit(0)
        }

        console.log(`Verifying ${jobCount} SVG${jobCount > 1 ? "s" : ""}...`)

        // `activePool` is what the closures below use: narrowing does not
        // survive a captured `let`, and the outer binding only exists so the
        // catch can shut the pool down.
        const activePool = utils.createSvgTesterPool()
        pool = activePool
        // Ctrl-C and a cancelled Buildkite step both kill this process without
        // reaching the shutdown below, and child workers - unlike the threads
        // they replaced - outlive their parent.
        registerExitHandler(() => utils.shutDownPool(activePool))

        const progress = utils.startVerifyProgress(
            testSuite,
            jobCount,
            activePool
        )
        const guard = utils.startRunGuard()

        // Parallelize the CPU heavy verification using the workerpool library
        // This call will then in parallel take the descriptions of the verifyJobs,
        // load the config and data and intialize a grapher, create the default svg output and check if it's md5 hash is the same as the one in
        // the reference csv file (from the referenceDataByChartKey lookup above).
        // Results land in this array as they settle rather than only at the end,
        // so a stalled run can still report everything that did finish - the
        // race below resolves as soon as the guard gives up, without them.
        const settledResults: (utils.VerifyResult | undefined)[] = new Array(
            jobCount
        )
        let abortError: utils.SuiteAbortedError | undefined
        try {
            const allSettled = Promise.all(
                verifyJobs.map((job, index) =>
                    activePool
                        .exec("renderAndVerifySvg", [job])
                        .timeout(JOB_TIMEOUT_MS)
                        .catch((err: Error) => {
                            if (err?.name === "TimeoutError")
                                console.warn(
                                    `Timed out after ${JOB_TIMEOUT_MS}ms: ${job.dir.viewId}`
                                )
                            return utils.resultError(
                                job.dir.viewId,
                                err,
                                job.queryStr
                            )
                        })
                        .then((result: utils.VerifyResult) => {
                            settledResults[index] = result
                            progress.recordResult(result)
                            guard.recordResult(result)
                            return result
                        })
                )
            )
            abortError = await Promise.race([
                allSettled.then(() => undefined),
                guard.aborted,
            ])
        } finally {
            progress.stop()
            guard.stop()
        }

        // Jobs the sick pool never got to are errored rather than dropped, so
        // the totals still add up to the number of jobs the suite set out to run.
        if (abortError) console.error(`Giving up: ${abortError.message}`)
        const validationResults = verifyJobs.map(
            (job, index) =>
                settledResults[index] ??
                utils.resultError(
                    job.dir.viewId,
                    abortError ?? new Error("Job produced no result"),
                    job.queryStr
                )
        )

        utils.logIfVerbose(verbose, "Verifications completed")

        const summary = utils.summariseVerifyResults(validationResults, {
            suite: testSuite,
            startedAt,
            durationMs: Date.now() - startedAt.getTime(),
        })
        await utils.writeVerifyResults(testSuiteDir, summary)

        utils.reportVerifyResults(validationResults, verbose)

        await utils.shutDownPool(activePool)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(utils.verifyExitCode(summary, !!abortError))
    } catch (error) {
        console.error("Encountered an error: ", error)
        // Record the failure too, so that "the suite never got to run" is
        // distinguishable from "the suite ran and found nothing" by whoever
        // reads the results file. Best-effort: if even this write fails there's
        // nothing useful left to do but exit.
        await utils
            .writeVerifyRunFailure(
                path.join(SVG_TESTER_REPO_PATH, args.testSuite),
                args.testSuite as SvgTesterSuite,
                error
            )
            .catch((writeError) => {
                console.error(
                    "Could not write the results file either: ",
                    writeError
                )
            })
        if (pool) await utils.shutDownPool(pool)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(1)
    }
}

async function main(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as SvgTesterSuite

    await match(testSuite)
        .with("graphers", () => verifyGraphers(args))
        .with("grapher-views", () => verifyGraphers(args))
        .with("mdims", () => verifyGraphers(args))
        .with("thumbnails", () => verifyGraphers(args))
        .exhaustive()
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
                    "Grapher query string to verify charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            allViews: {
                type: "boolean",
                description:
                    "For each Grapher, verify SVGs for all possible chart configurations. Default depends on the test suite.",
            },
            allTabs: {
                type: "boolean",
                description:
                    "For each Grapher, verify thumbnail SVGs for all available tabs. Default depends on the test suite.",
            },
            manifest: {
                type: "string",
                description:
                    "Manifest filename (e.g. 'top.manifest.json') specifying which charts to test. For grapher-views and thumbnails, defaults to 'top.manifest.json' if --viewIds is not provided. For other test suites, all charts in the data directory are tested if neither manifest nor --viewIds is provided.",
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
