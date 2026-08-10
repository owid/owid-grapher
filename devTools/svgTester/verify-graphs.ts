#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import path from "path"
import workerpool from "workerpool"
import * as _ from "lodash-es"

import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as utils from "./utils.js"
import { JOB_TIMEOUT_MS, MAX_WORKERS } from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"
import {
    ALL_GRAPHER_CHART_TYPES,
    SVG_TESTER_SUITES,
    type SvgTesterSuite,
} from "@ourworldindata/types"

async function verifyGraphers(args: ReturnType<typeof parseArguments>) {
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
        const rmOnError = args.rmOnError

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
                    rmOnError,
                }
            })

        const jobCount = verifyJobs.length
        if (jobCount === 0) {
            console.log(`${testSuite}: nothing to do, no configs matched`)
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

        utils.logRunStart(testSuite, "verifying", jobCount, manifestName)

        const pool = workerpool.pool(__dirname + "/worker.ts", {
            minWorkers: 2,
            maxWorkers: MAX_WORKERS,
            workerThreadOpts: {
                execArgv: ["--require", "tsx"],
            },
        })

        const progress = utils.startProgress(testSuite, jobCount, pool, {
            withOutcomes: true,
        })

        // Parallelize the CPU heavy verification using the workerpool library
        // This call will then in parallel take the descriptions of the verifyJobs,
        // load the config and data and intialize a grapher, create the default svg output and check if it's md5 hash is the same as the one in
        // the reference csv file (from the referenceDataByChartKey lookup above). The entire parallel operation returns a promise containing an array
        // of result values.
        let validationResults: utils.VerifyResult[]
        try {
            validationResults = await Promise.all(
                verifyJobs.map((job) =>
                    pool
                        .exec("renderAndVerifySvg", [job])
                        .timeout(JOB_TIMEOUT_MS)
                        .catch((err: Error) => {
                            // Only pool-level rejections reach here - a job that
                            // throws is caught inside renderAndVerifySvg, which
                            // logs it and resolves. So nothing else reports these.
                            if (err?.name === "TimeoutError")
                                console.warn(
                                    `${job.dir.viewId}: timed out after ${JOB_TIMEOUT_MS}ms`
                                )
                            else
                                console.error(
                                    `${job.dir.viewId}: worker failed`,
                                    err
                                )
                            return utils.resultError(
                                job.dir.viewId,
                                err,
                                job.referenceEntry.resolvedQueryStr ||
                                    job.queryStr
                            )
                        })
                        .then((result: utils.VerifyResult) => {
                            progress.recordResult(result)
                            return result
                        })
                )
            )
        } finally {
            progress.stop()
        }

        if (validationResults.length !== verifyJobs.length)
            // This is a sanity check that should never trigger
            throw `Ran ${verifyJobs.length} verify jobs but only got ${validationResults.length} results!`

        const summary = utils.summariseVerifyResults(validationResults, {
            suite: testSuite,
            startedAt,
            durationMs: Date.now() - startedAt.getTime(),
        })
        await utils.writeVerifyResults(testSuiteDir, summary)

        utils.logVerifySummary(summary)

        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(utils.verifyExitCode(summary))
    } catch (error) {
        console.error(`${args.testSuite}: verify failed`, error)
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
                    `${args.testSuite}: could not write the results file either`,
                    writeError
                )
            })
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(1)
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
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

void verifyGraphers(parseArguments())
