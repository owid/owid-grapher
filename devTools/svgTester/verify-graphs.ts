#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import path from "path"
import workerpool from "workerpool"
import * as _ from "lodash-es"
import { match } from "ts-pattern"

import * as utils from "./utils.js"
import { grapherSlugToExportFileKey } from "../../baker/GrapherBakingUtils.js"
import { ALL_GRAPHER_CHART_TYPES, ExplorerType } from "@ourworldindata/types"
import { queryParamsToStr } from "@ourworldindata/utils"
import { ExplorerProgram } from "@ourworldindata/explorer"

async function buildExplorerVerifyJobs(params: {
    explorerDir: string
    explorerSlug: string
    referenceDataByViewId: Map<string, utils.SvgRecord>
    referencesDir: string
    differencesDir: string
    verbose: boolean
    rmOnError: boolean
}): Promise<utils.RenderExplorerJobDescription[]> {
    // Load explorer config
    const configPath = path.join(params.explorerDir, "config.tsv")
    const tsvContent = await fs.readFile(configPath, "utf-8")
    const explorerProgram = new ExplorerProgram(params.explorerSlug, tsvContent)

    // Get all choice combinations
    const allChoices = explorerProgram.decisionMatrix.allDecisionsAsQueryParams()

    // Build jobs
    const jobs: utils.RenderExplorerJobDescription[] = []
    for (const choiceParams of allChoices) {
        const queryStr = queryParamsToStr(choiceParams).replace("?", "")
        const viewId = `${params.explorerSlug}?${queryStr}`

        const referenceEntry = params.referenceDataByViewId.get(viewId)
        if (!referenceEntry) {
            console.warn(`No reference found for ${viewId}`)
            continue
        }

        jobs.push({
            explorerDir: params.explorerDir,
            explorerSlug: params.explorerSlug,
            choiceParams,
            viewId,
            referenceEntry,
            referenceDir: params.referencesDir,
            outDir: params.differencesDir,
            verbose: params.verbose,
            rmOnError: params.rmOnError,
        })
    }

    return jobs
}

async function verifyExplorers(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as utils.TestSuite

    // Input and output directories
    const dataDir = path.join(utils.SVG_REPO_PATH, testSuite, "data")
    const referencesDir = path.join(utils.SVG_REPO_PATH, testSuite, "references")
    const differencesDir = path.join(
        utils.SVG_REPO_PATH,
        testSuite,
        "differences"
    )

    if (!fs.existsSync(dataDir))
        throw `Input directory does not exist ${dataDir}`
    if (!fs.existsSync(referencesDir))
        throw `Reference directory does not exist ${referencesDir}`
    if (!fs.existsSync(differencesDir))
        fs.mkdirSync(differencesDir, { recursive: true })

    // Load reference CSV
    const referenceData = await utils.parseReferenceCsv(referencesDir)
    const referenceDataByViewId = new Map(
        referenceData.map((record) => [record.viewId, record])
    )

    // Iterate through explorer directories
    const allVerifyJobs: utils.RenderExplorerJobDescription[] = []
    const dir = await fs.opendir(dataDir)
    for await (const entry of dir) {
        if (!entry.isDirectory()) continue

        const explorerDir = path.join(dataDir, entry.name)
        const explorerSlug = entry.name

        // Build job list for this explorer
        const jobs = await buildExplorerVerifyJobs({
            explorerDir,
            explorerSlug,
            referenceDataByViewId,
            referencesDir,
            differencesDir,
            verbose: args.verbose,
            rmOnError: args.rmOnError,
        })

        allVerifyJobs.push(...jobs)
    }

    // Log how many SVGs we're going to verify
    const jobCount = allVerifyJobs.length
    if (jobCount === 0) {
        utils.logIfVerbose(args.verbose, "No matching configs found")
        process.exit(0)
    } else {
        utils.logIfVerbose(
            args.verbose,
            `Verifying ${jobCount} explorer view${jobCount > 1 ? "s" : ""}...`
        )
    }

    // Run verification sequentially (no workerpool for now)
    const validationResults: utils.VerifyResult[] = []
    for (const job of allVerifyJobs) {
        const result = await utils.renderExplorerViewAndVerify(job)
        validationResults.push(result)
    }

    utils.logIfVerbose(args.verbose, "Verifications completed")

    const exitCode = utils.displayVerifyResultsAndGetExitCode(
        validationResults,
        args.verbose
    )
    process.exit(exitCode)
}

async function verifyGraphers(args: ReturnType<typeof parseArguments>) {
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

async function main(args: ReturnType<typeof parseArguments>) {
    const testSuite = args.testSuite as utils.TestSuite

    await match(testSuite)
        .with("graphers", () => verifyGraphers(args))
        .with("grapher-views", () => verifyGraphers(args))
        .with("mdims", () => verifyGraphers(args))
        .with("explorers", () => verifyExplorers(args))
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
                    "Grapher query string to verify charts with a specific configuration, e.g. tab=chart&stackMode=relative",
            },
            allViews: {
                type: "boolean",
                description:
                    "For each Grapher, verify SVGs for all possible chart configurations. Default depends on the test suite.",
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
