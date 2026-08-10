import {
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    GrapherTabName,
    GrapherInterface,
    GrapherVariant,
    GRAPHER_TAB_NAMES,
    GrapherChartOrMapType,
    type SvgTesterSuite,
    SVG_TESTER_VERIFY_RESULTS_FILENAME,
    type SvgTesterVerifyRunStatus,
    type SvgTesterVerifyErrorEntry,
    type SvgTesterVerifyRunSummary,
} from "@ourworldindata/types"
import {
    Bounds,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    TESTING_ONLY_disable_guid,
} from "@ourworldindata/utils"
import fs, { stat } from "fs-extra"
import path from "path"
import { execFileSync } from "child_process"
import {
    buildSvgOutFilename,
    initGrapherForSvgExport,
} from "../../baker/GrapherImageBaker.js"
import { getVariableData } from "../../db/model/Variable.js"

import * as _ from "lodash-es"
import { getHeapStatistics } from "v8"
import { queryStringsByChartType } from "./chart-configurations.js"
import * as d3 from "d3-dsv"
import {
    GrapherProgrammaticInterface,
    legacyToOwidTableAndDimensions,
    migrateGrapherConfigToLatestVersion,
    GrapherState,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { hashMd5 } from "../../serverUtils/hash.js"
import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as R from "remeda"
import ReactDOMServer from "react-dom/server"
import pMap from "p-map"

export const TEST_SUITE_DESCRIPTION =
    "Test suite to run: 'graphers' for default Grapher views, 'grapher-views' for all views of a subset of Graphers. 'mdims' for all multi-dim views. 'thumbnails' for thumbnail versions (300x160) of all published graphers."

const CONFIG_FILENAME = "config.json"
const RESULTS_FILENAME = "results.csv"

// Variable data is shared by every suite
export const VARIABLES_DIR = path.join(SVG_TESTER_REPO_PATH, "variables")

// Reading one config.json per chart is ~4,500 tiny reads for the graphers suite.
// Doing them serially costs half a second before a single svg is rendered; any
// concurrency at all removes that, so this is kept low enough not to sit on a
// few thousand open file descriptors.
const CONFIG_READ_CONCURRENCY = 32

export interface ChartWithQueryStr {
    viewId: string
    chartType: GrapherChartOrMapType
    queryStr?: string
}

interface VerifyResultOk {
    kind: "ok"
}

interface VerifyResultDifference {
    kind: "difference"
    difference: SvgDifference
}

interface VerifyResultError {
    kind: "error"
    viewId: string
    queryStr?: string
    error: Error
}

export type VerifyResult =
    | VerifyResultOk
    | VerifyResultDifference
    | VerifyResultError

const resultOk = (): VerifyResult => ({
    kind: "ok",
})

export const resultError = (
    viewId: string,
    error: Error,
    queryStr?: string
): VerifyResult => ({
    kind: "error",
    viewId,
    queryStr: queryStr || undefined,
    error,
})

// A single chart/view should render in well under a second; this is a generous
// safety margin so one stuck render can't hang the entire run indefinitely.
export const JOB_TIMEOUT_MS = 2 * 60 * 1000

// Each worker is a separate Node worker_thread with its own V8 isolate/heap -
// heap is not shared, so peak memory scales close to linearly with worker count
// regardless of how much of that concurrency is actually used. Swept 4/6/8/12 on
// a 300-chart sample under two different host-contention levels (see the
// verify-graphs PR description for both full tables) - 6 came out as the sweet
// spot both times: meaningfully less memory than 8 or 12, and equal-or-better
// wall-clock, not just a cheaper-but-slower tradeoff. Override via
// SVG_TESTER_MAX_WORKERS on memory-constrained hosts.
export const MAX_WORKERS = Number(process.env.SVG_TESTER_MAX_WORKERS) || 6

const resultDifference = (difference: SvgDifference): VerifyResult => ({
    kind: "difference",
    difference: difference,
})

type SvgRenderPerformance = {
    durationReceiveData: number
    durationTotal: number
    heapUsed: number
    totalDataFileSize: number
}

export type SvgRecord = {
    viewId: string
    chartType: GrapherTabName | undefined
    queryStr?: string
    resolvedQueryStr?: string // The query string after resolving placeholders like <firstSeries>
    md5: string
    svgFilename: string
    performance?: SvgRenderPerformance
}

interface SvgDifference {
    viewId: string
    queryStr?: string
    chartType: GrapherTabName | undefined
    svgFilename: string
}

interface JobDirectory {
    viewId: string
    pathToProcess: string
}

interface JobConfigAndData {
    config: GrapherInterface
    variableData: MultipleOwidVariableDataDimensionsMap
    totalDataFileSize: number
}

/** Seconds under a minute, whole minutes above it. */
function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.round(seconds / 60)}m`
}

async function verifySvg(
    preparedNewSvg: string,
    newSvgRecord: SvgRecord,
    referenceSvgRecord: SvgRecord,
    referenceSvgsPath: string
): Promise<VerifyResult> {
    if (newSvgRecord.md5 === referenceSvgRecord.md5) {
        // if the md5 hash is unchanged then there is no difference
        return resultOk()
    }

    // The stored reference .svg file is the output of prepareSvgForComparison,
    // same as `preparedNewSvg` - that's what wrote it in the first place
    // (renderSvgAndSave / commit_differences) - so the two compare byte for
    // byte.
    const preparedReferenceSvg = await loadReferenceSvg(
        referenceSvgsPath,
        referenceSvgRecord
    )

    if (preparedNewSvg === preparedReferenceSvg) {
        // Same bytes, different md5 - results.csv has drifted from the references
        console.warn(
            `${newSvgRecord.viewId}: md5 differs but the svg is identical, run 'make svgtest.md5s'`
        )
        return resultOk()
    }
    return resultDifference({
        viewId: newSvgRecord.viewId,
        queryStr: newSvgRecord.resolvedQueryStr ?? newSvgRecord.queryStr,
        chartType: newSvgRecord.chartType,
        svgFilename: newSvgRecord.svgFilename,
    })
}

export async function selectChartIdsToProcess(
    inDir: string,
    options: {
        viewIds?: string[]
        chartTypes?: GrapherChartType[]
        randomCount?: number
    }
): Promise<string[]> {
    let validViewIds = await findValidViewIds(inDir, options)

    if (options.randomCount !== undefined) {
        validViewIds = R.sample(validViewIds, options.randomCount)
    }

    return _.sortBy(validViewIds)
}

// Get available tabs from a grapher config
// Returns tabs that should be tested (excludes table tab)
function getAvailableTabsFromConfig(
    config: GrapherInterface
): GrapherChartOrMapType[] {
    const tabs: GrapherChartOrMapType[] = []

    // Add map tab if available
    if (config.hasMapTab) {
        tabs.push(GRAPHER_TAB_NAMES.WorldMap)
    }

    // Add chart types (or default to LineChart and DiscreteBar if none specified)
    const chartTypes =
        config.chartTypes && config.chartTypes.length > 0
            ? config.chartTypes
            : [GRAPHER_CHART_TYPES.LineChart, GRAPHER_CHART_TYPES.DiscreteBar]

    tabs.push(...chartTypes)

    return tabs
}

export async function findChartViewsToGenerate(
    inDir: string,
    viewIds: string[],
    options: {
        queryStr?: string
        shouldTestAllViews?: boolean
        shouldTestAllTabs?: boolean
    }
): Promise<ChartWithQueryStr[]> {
    // pMap keeps the input order, so the job list stays deterministic
    const chartsPerView = await pMap(
        viewIds,
        async (viewId): Promise<ChartWithQueryStr[]> => {
            const grapherConfig = await parseGrapherConfig(viewId, { inDir })

            const chartType =
                grapherConfig.chartTypes?.[0] ?? GRAPHER_CHART_TYPES.LineChart

            // If shouldTestAllTabs is true, generate entries for each available tab
            if (options.shouldTestAllTabs) {
                return getAvailableTabsFromConfig(grapherConfig).map((tab) => ({
                    viewId,
                    chartType: tab,
                    queryStr: `tab=${mapGrapherTabNameToQueryParam(tab)}`,
                }))
            }

            // Existing behavior for shouldTestAllViews and queryStr
            const queryStrings = options.shouldTestAllViews
                ? queryStringsByChartType[chartType]
                : options.queryStr
                  ? [options.queryStr]
                  : [undefined]

            return queryStrings.map((queryStr) => ({
                viewId,
                chartType,
                queryStr,
            }))
        },
        { concurrency: CONFIG_READ_CONCURRENCY }
    )

    return chartsPerView.flat()
}

async function findValidViewIds(
    inDir: string,
    {
        viewIds = [],
        chartTypes = [],
    }: {
        viewIds?: string[]
        chartTypes?: GrapherChartType[]
    }
): Promise<string[]> {
    const validChartIds: string[] = []

    // If nothing is specified, scan all directories in the inDir folder
    if (viewIds.length === 0 && chartTypes.length === 0) {
        const dir = await fs.opendir(inDir)
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                const viewId = entry.name
                validChartIds.push(viewId)
            }
        }
        return validChartIds
    }

    // If grapher ids were given check which ones exist in inDir and filter to those
    // -> if by doing so we drop some, warn the user
    if (viewIds.length > 0) {
        const validatedChartIds = viewIds.filter((viewId) =>
            fs.existsSync(path.join(inDir, viewId))
        )
        validChartIds.push(...validatedChartIds)
        if (validChartIds.length < viewIds.length) {
            const invalidChartIds = _.difference(viewIds, validatedChartIds)
            console.warn(
                `${viewIds.length} view ids were given but only ${validChartIds.length} existed as directories. Missing ids: ${invalidChartIds}`
            )
        }
    }

    // If chart types are given, scan all directories and add those that match a given chart type
    if (chartTypes.length > 0) {
        const dir = await fs.opendir(inDir)
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                const viewId = entry.name
                const grapherConfig = await parseGrapherConfig(viewId, {
                    inDir,
                })
                const chartType =
                    grapherConfig.chartTypes?.[0] ??
                    GRAPHER_CHART_TYPES.LineChart
                if (chartTypes.includes(chartType)) {
                    validChartIds.push(viewId)
                }
            }
        }
    }

    return validChartIds
}

async function parseGrapherConfig(
    chartId: string,
    { inDir }: { inDir: string }
): Promise<GrapherInterface> {
    const grapherConfigPath = path.join(inDir, chartId, "config.json")
    const grapherConfig = await fs.readJson(grapherConfigPath)
    return grapherConfig
}

// Not fs.writeJson: that appends a final newline, which would rewrite every
// dumped file in the svgs repo on the next refresh and shift totalDataFileSize
// for every chart.
async function writeToFile(data: unknown, filename: string) {
    const json = JSON.stringify(data, null, 2)
    await fs.writeFile(filename, json)
}

// Charts are dumped concurrently and share variables, so the same id is asked
// for many times over. Keyed by the in-flight promise rather than by "does the
// file exist yet" so two concurrent charts can't both start writing it.
const variableWrites = new Map<number, Promise<void>>()

async function writeVariableDataAndMetadataFiles(
    variableIds: number[]
): Promise<void> {
    await fs.ensureDir(VARIABLES_DIR)

    const writeVariablePromises = variableIds.map((variableId) => {
        const inFlight = variableWrites.get(variableId)
        if (inFlight) return inFlight

        const write = (async () => {
            const variableData = await getVariableData(variableId)
            await writeToFile(
                variableData.data,
                path.join(VARIABLES_DIR, `${variableId}.data.json`)
            )
            await writeToFile(
                variableData.metadata,
                path.join(VARIABLES_DIR, `${variableId}.metadata.json`)
            )
        })().catch((error) => {
            // Don't let one transient failure poison every other chart that
            // uses this variable - the next one to ask for it retries.
            variableWrites.delete(variableId)
            throw error
        })

        variableWrites.set(variableId, write)
        return write
    })

    await Promise.allSettled(writeVariablePromises)
}

export interface SaveGrapherSchemaAndDataJob {
    config: GrapherInterface
    id: string
    outDir: string
}
export async function saveGrapherSchemaAndData(
    jobDescription: SaveGrapherSchemaAndDataJob
): Promise<void> {
    const config = jobDescription.config
    const outDir = jobDescription.outDir
    const dataDir = path.join(outDir, jobDescription.id ?? "")
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    const configPath = path.join(dataDir, CONFIG_FILENAME)
    const promise1 = writeToFile(config, configPath)

    const grapher = initGrapherForSvgExport(config)
    const variableIds = grapher.grapherState.dimensions.map((d) => d.variableId)

    await Promise.allSettled([
        promise1,
        writeVariableDataAndMetadataFiles(variableIds),
    ])
}

function resolveFocusPlaceholderInQueryString(
    queryStr: string | undefined,
    grapherState: GrapherState
): { focusedSeriesName?: string; resolvedQueryStr: string } {
    if (!queryStr) return { resolvedQueryStr: "" }

    const params = new URLSearchParams(queryStr)
    const focus = params.get("focus")

    // No focus param at all — nothing to resolve
    if (!focus) return { resolvedQueryStr: queryStr }

    // Explicit (non-placeholder) focus value — pass through as-is
    if (!focus.startsWith("<"))
        return { focusedSeriesName: focus, resolvedQueryStr: queryStr }

    // Placeholder: resolve <firstSeries> to actual series name
    const seriesName = grapherState.chartState.series[0]?.seriesName

    if (focus === "<firstSeries>" && seriesName) {
        const focusedSeriesName = seriesName
        params.set("focus", focusedSeriesName)
        return { focusedSeriesName, resolvedQueryStr: params.toString() }
    } else {
        params.delete("focus")
        return { resolvedQueryStr: params.toString() }
    }
}

export async function renderSvg({
    dir,
    queryStr,
    variant = "default",
}: {
    dir: JobDirectory
    queryStr?: string
    variant?: "default" | "thumbnail"
}): Promise<[string, SvgRecord, string]> {
    const configAndData = await loadGrapherConfigAndData(dir.pathToProcess)

    // Graphers sometimes need to generate ids (incrementing numbers). For this
    // they keep a stateful variable in clientutils. To minimize differences
    // between consecutive runs we reset this id here before every export
    TESTING_ONLY_disable_guid()

    const timeStart = Date.now()

    // Drop the focus param because it may contain a placeholder value
    // (the focused entity/column is manually added later)
    const queryStrWithoutFocus = new URLSearchParams(queryStr)
    queryStrWithoutFocus.delete("focus")

    const config: GrapherProgrammaticInterface = {
        ...configAndData.config,
        adminBaseUrl: "https://ourworldindata.org",
        bakedGrapherURL: "https://ourworldindata.org/grapher",
    }

    // Apply thumbnail settings if variant is thumbnail
    if (variant === "thumbnail") {
        const thumbnailBounds = new Bounds(
            0,
            0,
            GRAPHER_THUMBNAIL_WIDTH,
            GRAPHER_THUMBNAIL_HEIGHT
        )
        config.staticBounds = thumbnailBounds
        config.variant = GrapherVariant.Thumbnail
        config.baseFontSize = 14
    }

    const grapher = initGrapherForSvgExport(
        config,
        queryStrWithoutFocus.toString()
    )

    grapher.grapherState.inputTable = legacyToOwidTableAndDimensions(
        configAndData.variableData,
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors
    )

    // Resolve focus placeholders after the chart has data and series are available
    const { focusedSeriesName, resolvedQueryStr } =
        resolveFocusPlaceholderInQueryString(queryStr, grapher.grapherState)

    // Set the focused series if applicable
    if (focusedSeriesName !== undefined) {
        grapher.grapherState.focusArray.clearAllAndAdd(focusedSeriesName)
    }

    const { width, height } = grapher.grapherState.staticBounds
    const outFilename = buildSvgOutFilename(
        {
            slug: dir.viewId,
            version: configAndData.config.version ?? 0,
            width,
            height,
            queryStr: resolvedQueryStr,
        },
        { shouldHashQueryStr: true }
    )

    const durationReceiveData = Date.now() - timeStart

    const svg = await grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
    const durationTotal = Date.now() - timeStart

    // What gets hashed, written out and compared - callers take it from here
    // rather than re-deriving it from the raw svg.
    const preparedSvg = prepareSvgForComparison(svg)

    const svgRecord: SvgRecord = {
        viewId: dir.viewId,
        chartType: grapher.grapherState.activeTab,
        queryStr: queryStr ?? "",
        resolvedQueryStr,
        md5: hashMd5(preparedSvg),
        svgFilename: outFilename,
        performance: {
            durationReceiveData,
            durationTotal,
            // The heap size measurement is only accurate if the parent process is run with `--isolate`, otherwise the same
            // process is used for multiple graphs and the heap size accumulates
            heapUsed: getHeapStatistics().used_heap_size,
            totalDataFileSize: configAndData.totalDataFileSize,
        },
    }
    return Promise.resolve([svg, svgRecord, preparedSvg])
}

const replaceRegexes = [/id="react-select-\d+-.+"/g]
/** Some fragments of the svgs are non-deterministic. This function is used to
    delete all such fragments */
function prepareSvgForComparison(svg: string): string {
    let current = svg
    for (const replaceRegex of replaceRegexes) {
        current = current.replace(replaceRegex, "")
    }
    // React renders the whole svg onto a single line, and the line diff in the
    // admin needs lines to work with, so break it up one tag per line. `><`
    // only ever occurs at a tag boundary because React escapes `>` in text and
    // in attributes.
    return current.replaceAll("><", ">\n<")
}

export interface RenderSvgAndSaveJobDescription {
    dir: JobDirectory
    outDir: string
    queryStr?: string
    variant?: "default" | "thumbnail"
}
export async function renderSvgAndSave(
    jobDescription: RenderSvgAndSaveJobDescription
): Promise<SvgRecord> {
    const { dir, outDir, queryStr, variant = "default" } = jobDescription
    const [, svgRecord, preparedSvg] = await renderSvg({
        dir,
        queryStr,
        variant,
    })
    const outPath = path.join(outDir, svgRecord.svgFilename)
    await fs.writeFile(outPath, preparedSvg)
    return Promise.resolve(svgRecord)
}

async function loadReferenceSvg(
    referenceDir: string,
    referenceSvgRecord: SvgRecord
): Promise<string> {
    if (!referenceDir) throw "RefereneDir was empty in loadReferenceSvg"
    if (!referenceSvgRecord) throw "reference svg record was not defined"
    if (!referenceSvgRecord.svgFilename)
        throw "reference svg record.svgfilename was not defined"
    const referenceFilename = path.join(
        referenceDir,
        referenceSvgRecord.svgFilename
    )
    if (!fs.existsSync(referenceFilename))
        throw `Reference SVG does not exist ${referenceFilename}`
    const svg = await fs.readFile(referenceFilename, "utf-8")
    return svg
}

async function loadGrapherConfigAndData(
    inputDir: string
): Promise<JobConfigAndData> {
    if (!fs.existsSync(inputDir))
        throw `Input directory does not exist ${inputDir}`

    const configPath = path.join(inputDir, CONFIG_FILENAME)
    const rawConfig = (await fs.readJson(configPath)) as GrapherInterface
    const config = migrateGrapherConfigToLatestVersion(rawConfig) // ensure the config is migrated to the latest schema version

    const variableIds = config.dimensions?.map((d) => d.variableId) ?? []
    const loadDataPromises = variableIds.map(async (variableId) => {
        const dataPath = path.join(VARIABLES_DIR, `${variableId}.data.json`)
        const metadataPath = path.join(
            VARIABLES_DIR,
            `${variableId}.metadata.json`
        )
        const dataFileSize = await stat(dataPath).then((stats) => stats.size)
        const data = (await fs.readJson(dataPath)) as OwidVariableMixedData
        const metadata = (await fs.readJson(
            metadataPath
        )) as OwidVariableWithSourceAndDimension
        return { data, metadata, dataFileSize }
    })

    const data = await Promise.all(loadDataPromises)

    const variableData = new Map(data.map((d) => [d.metadata.id, d]))
    const totalDataFileSize = _.sum(data.map((d) => d.dataFileSize))

    return { config, variableData, totalDataFileSize }
}

export async function parseReferenceCsv(
    referenceDir: string
): Promise<SvgRecord[]> {
    const pathname = path.join(referenceDir, RESULTS_FILENAME)
    const rawContent = await fs.readFile(pathname, "utf-8")
    return d3.csvParse(rawContent, (d) => ({
        viewId: d.viewId,
        chartType: d.chartType,
        queryStr: d.queryStr,
        resolvedQueryStr: d.resolvedQueryStr,
        md5: d.md5,
        svgFilename: d.svgFilename,
        performance: {
            durationReceiveData: parseInt(d.durationReceiveData ?? ""),
            durationTotal: parseInt(d.durationTotal ?? ""),
            heapUsed: parseInt(d.heapUsed ?? ""),
            totalDataFileSize: parseInt(d.totalDataFileSize ?? ""),
        },
    })) as SvgRecord[]
}

export async function writeReferenceCsv(
    outDir: string,
    svgRecords: SvgRecord[]
): Promise<void> {
    const resultsPath = path.join(outDir, RESULTS_FILENAME)
    const csvAsString = d3.csvFormat(
        svgRecords.map((record) => ({
            viewId: record.viewId,
            chartType: record.chartType,
            queryStr: record.queryStr,
            resolvedQueryStr: record.resolvedQueryStr,
            md5: record.md5,
            svgFilename: record.svgFilename,
            durationReceiveData: record.performance?.durationReceiveData,
            durationTotal: record.performance?.durationTotal,
            heapUsed: record.performance?.heapUsed,
            totalDataFileSize: record.performance?.totalDataFileSize,
        }))
    )
    fs.writeFileSync(resultsPath, csvAsString)
}

export interface RenderJobDescription {
    dir: JobDirectory
    referenceEntry: SvgRecord
    referenceDir: string
    outDir: string
    queryStr?: string
    variant?: "default" | "thumbnail"
    rmOnError?: boolean
}

export async function renderAndVerifySvg({
    dir,
    referenceEntry,
    referenceDir,
    outDir,
    queryStr,
    variant = "default",
    rmOnError,
}: RenderJobDescription): Promise<VerifyResult> {
    try {
        if (!dir) throw "Dir was not defined"
        if (!referenceEntry) throw "ReferenceEntry was not defined"
        if (!referenceDir) throw "ReferenceDir was not defined"
        if (!outDir) throw "outdir was not defined"

        const [, svgRecord, preparedSvg] = await renderSvg({
            dir,
            queryStr,
            variant,
        })

        const validationResult = await verifySvg(
            preparedSvg,
            svgRecord,
            referenceEntry,
            referenceDir
        )
        // Differing svgs get written out so the admin report can diff them
        // against the reference
        if (validationResult.kind === "difference") {
            const pathFragments = path.parse(svgRecord.svgFilename)
            const outputPath = path.join(
                outDir,
                pathFragments.name + pathFragments.ext
            )
            await fs.writeFile(outputPath, preparedSvg)
        }
        return Promise.resolve(validationResult)
    } catch (err) {
        console.error(`${referenceEntry.viewId}: render failed`, err)
        if (rmOnError) {
            const outPath = path.join(outDir, referenceEntry.svgFilename)
            await fs.unlink(outPath).catch(() => {
                /* ignore ENOENT */
            })
        }
        return Promise.resolve(
            resultError(
                referenceEntry.viewId,
                err as Error,
                referenceEntry.resolvedQueryStr || referenceEntry.queryStr
            )
        )
    }
}

// A `.timeout()` breach and a render crash both arrive through the same `.catch`
// in verify-graphs.ts, so the only thing distinguishing them is the error name
// workerpool gives a timeout. Errors crossing a worker boundary are structured
// clones rather than real Error instances, hence the defensive access.
function classifyVerifyError(error: Error): SvgTesterVerifyErrorEntry["kind"] {
    return error?.name === "TimeoutError" ? "timeout" : "render"
}

// Several failure paths in here `throw` a plain string rather than an Error, and
// errors crossing a worker boundary are structured clones, so `.message` is not
// something we can count on.
function verifyErrorMessage(error: Error): string {
    return String(error?.message ?? error)
}

export function summariseVerifyResults(
    validationResults: VerifyResult[],
    options: {
        suite: SvgTesterSuite
        startedAt: Date
        durationMs: number
    }
): SvgTesterVerifyRunSummary {
    const differences = validationResults
        .filter((result) => result.kind === "difference")
        .map(({ difference }) => ({
            viewId: difference.viewId,
            // The default view has an empty query string; omit rather than
            // recording `""`.
            queryStr: difference.queryStr || undefined,
            chartType: difference.chartType,
            svgFilename: difference.svgFilename,
        }))

    const errors = validationResults
        .filter((result) => result.kind === "error")
        .map((result) => ({
            viewId: result.viewId,
            queryStr: result.queryStr,
            kind: classifyVerifyError(result.error),
            // The stack stays on stderr for the CI log; this file is a status
            // report, not a crash dump.
            message: verifyErrorMessage(result.error),
        }))

    // An errored suite is reported as errored even if it also found differences:
    // we can't claim to know what changed when part of the run didn't complete.
    const status: SvgTesterVerifyRunStatus = errors.length
        ? "error"
        : differences.length
          ? "differences"
          : "ok"

    return {
        suite: options.suite,
        status,
        startedAt: options.startedAt.toISOString(),
        durationMs: options.durationMs,
        grapherCommit: resolveCommit(),
        svgsCommit: resolveCommit(SVG_TESTER_REPO_PATH),
        counts: {
            total: validationResults.length,
            ok: validationResults.length - differences.length - errors.length,
            differences: differences.length,
            errors: errors.length,
        },
        differences,
        errors,
    }
}

export async function writeVerifyResults(
    testSuiteDir: string,
    summary: SvgTesterVerifyRunSummary
): Promise<void> {
    const outPath = path.join(testSuiteDir, SVG_TESTER_VERIFY_RESULTS_FILENAME)
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2) + "\n")
}

// Written before the first render so that the file's existence proves the suite
// started. If the process is killed before it can overwrite this - the `timeout`
// wrapper in svg-tester.sh, a cancelled Buildkite step, kill_stale_runs - the
// leftover "running" status is what tells the reader it died mid-run. Deliberately
// not a signal handler: `timeout` signals `yarn`, not the node process underneath
// it, and nothing can catch the SIGKILL that follows --kill-after anyway.
// The counts are zeroed placeholders and mean nothing until the run finishes.
export async function writeVerifyRunStarted(
    testSuiteDir: string,
    suite: SvgTesterSuite,
    startedAt: Date
): Promise<void> {
    await writeVerifyResults(testSuiteDir, {
        suite,
        status: "running",
        startedAt: startedAt.toISOString(),
        durationMs: 0,
        grapherCommit: resolveCommit(),
        svgsCommit: resolveCommit(SVG_TESTER_REPO_PATH),
        counts: { total: 0, ok: 0, differences: 0, errors: 0 },
        differences: [],
        errors: [],
    })
}

// For failures that happen before or around the run itself (missing directories,
// an unreadable reference CSV, the job-count sanity check) rather than for a
// single chart. Without this, such a run leaves no results file at all and is
// indistinguishable from a suite that was never started.
export async function writeVerifyRunFailure(
    testSuiteDir: string,
    suite: SvgTesterSuite,
    error: unknown
): Promise<void> {
    const startedAt = new Date()
    await writeVerifyResults(testSuiteDir, {
        suite,
        status: "error",
        startedAt: startedAt.toISOString(),
        durationMs: 0,
        grapherCommit: resolveCommit(),
        svgsCommit: resolveCommit(SVG_TESTER_REPO_PATH),
        counts: { total: 0, ok: 0, differences: 0, errors: 1 },
        differences: [],
        errors: [
            {
                viewId: "",
                kind: "render",
                message: String(error instanceof Error ? error.message : error),
            },
        ],
    })
}

// Best-effort: in CI the commit is handed to us, locally we ask git, and if
// neither works the field is null rather than the run failing over provenance.
function resolveCommit(cwd?: string): string | null {
    if (!cwd && process.env.BUILDKITE_COMMIT)
        return process.env.BUILDKITE_COMMIT
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
            cwd,
            encoding: "utf-8",
        }).trim()
    } catch {
        return null
    }
}

/** How often the run reports progress */
const PROGRESS_INTERVAL_MS = 30 * 1000

/**
 * Periodic progress while a suite runs, shared by verify and export. Verify
 * passes each result so the line can break the tally down by outcome; export
 * has no outcomes to report and just counts jobs off.
 */
export function startProgress(
    suite: SvgTesterSuite,
    total: number,
    pool: { stats: () => { busyWorkers: number } },
    options: { withOutcomes?: boolean } = {}
): { recordResult: (result?: VerifyResult) => void; stop: () => void } {
    const startedAt = Date.now()
    const counts = { done: 0, ok: 0, differences: 0, errors: 0 }

    const timer = setInterval(() => {
        const parts = [`${counts.done}/${total}`]
        if (options.withOutcomes)
            parts.push(
                `${counts.ok} ok`,
                `${counts.differences} differ`,
                `${counts.errors} errored`
            )
        parts.push(
            `${pool.stats().busyWorkers} busy`,
            formatDuration(Date.now() - startedAt)
        )
        console.log(`${suite}: ${parts.join(" · ")}`)
    }, PROGRESS_INTERVAL_MS)
    // Never hold the process open on our account
    timer.unref?.()

    return {
        recordResult: (result?: VerifyResult) => {
            counts.done += 1
            if (!result) return
            if (result.kind === "ok") counts.ok += 1
            else if (result.kind === "difference") counts.differences += 1
            else counts.errors += 1
        },
        stop: () => clearInterval(timer),
    }
}

const EXIT_CODE_DIFFERENCES = 2
const EXIT_CODE_ERROR = 1

export function verifyExitCode(summary: SvgTesterVerifyRunSummary): number {
    if (summary.counts.errors > 0) return EXIT_CODE_ERROR
    if (summary.counts.differences > 0) return EXIT_CODE_DIFFERENCES
    return 0
}

/** Opening line for both scripts: what is about to run, and over how many views. */
export function logRunStart(
    suite: SvgTesterSuite,
    verb: string,
    count: number,
    manifestName?: string
): void {
    const parts = [`${verb} ${count} svg${count === 1 ? "" : "s"}`]
    if (manifestName) parts.push(`manifest ${manifestName}`)
    console.log(`${suite}: ${parts.join(" · ")}`)
}

export function logExportSummary(
    suite: SvgTesterSuite,
    count: number,
    durationMs: number
): void {
    console.log(`${suite}: ${count} exported in ${formatDuration(durationMs)}`)
}

/**
 * The run's closing line. Which views differed is not repeated here - the admin
 * report, verify-results.json and the differences/ directory all have it, in
 * more useful form than a list of slugs.
 */
export function logVerifySummary(summary: SvgTesterVerifyRunSummary): void {
    const { suite, counts } = summary
    const parts = [
        `${counts.total} verified in ${formatDuration(summary.durationMs)}`,
    ]
    if (counts.differences === 0 && counts.errors === 0) parts.push("all match")
    else {
        if (counts.differences) parts.push(`${counts.differences} differ`)
        if (counts.errors) parts.push(`${counts.errors} errored`)
    }
    console.log(`${suite}: ${parts.join(" · ")}`)
}

export interface GrapherViewsManifest {
    slugs: string[]
}

// grapher-views and thumbnails have no data/ of their own - they re-test charts
// the graphers suite already dumped.
function dataDirForSuite(testSuite: SvgTesterSuite): string {
    const suiteOwningTheData =
        testSuite === "grapher-views" || testSuite === "thumbnails"
            ? "graphers"
            : testSuite
    return path.join(SVG_TESTER_REPO_PATH, suiteOwningTheData, "data")
}

// Load manifest from a specific path
async function loadManifestFromPath(
    manifestPath: string
): Promise<GrapherViewsManifest | null> {
    if (!fs.existsSync(manifestPath)) {
        return null
    }
    const manifest: GrapherViewsManifest = await fs.readJson(manifestPath)
    return manifest
}

// Load manifest with appropriate defaults for test suites that require it
// Returns the manifest view IDs and the data directory to use
export async function loadManifestViewIds(
    testSuite: SvgTesterSuite,
    options: {
        targetViewIds?: string[]
        manifestName?: string
    }
): Promise<{
    viewIds: string[] | null
    dataDir: string
    manifestName?: string
}> {
    const testSuiteDir = path.join(SVG_TESTER_REPO_PATH, testSuite)
    const dataDir = dataDirForSuite(testSuite)

    // grapher-views and thumbnails are defined by their manifest: without one
    // they would fall back to every chart in the graphers suite.
    if (testSuite === "grapher-views" || testSuite === "thumbnails") {
        const defaultManifestName = "top.manifest.json"
        const manifestName = options.manifestName ?? defaultManifestName
        const manifestPath = path.join(testSuiteDir, manifestName)
        const manifest = await loadManifestFromPath(manifestPath)

        if (manifest) {
            // viewIds are explicitly provided
            if (options.targetViewIds) return { viewIds: null, dataDir }

            return { viewIds: manifest.slugs, dataDir, manifestName }
        } else {
            throw new Error(
                `No manifest found at ${manifestPath}. For ${testSuite}, you must either:\n` +
                    `  1. Provide a manifest file (default: top.manifest.json), or\n` +
                    `  2. Explicitly specify --viewIds to process specific charts`
            )
        }
    }

    // For other test suites, skip manifest if viewIds are explicitly provided
    if (options.targetViewIds) {
        return { viewIds: null, dataDir }
    }

    // For other test suites, only load manifest if explicitly provided
    if (options.manifestName) {
        const manifestPath = path.join(testSuiteDir, options.manifestName)
        const manifest = await loadManifestFromPath(manifestPath)

        if (manifest) {
            return {
                viewIds: manifest.slugs,
                dataDir,
                manifestName: options.manifestName,
            }
        } else {
            console.warn(`Warning: Manifest not found at ${manifestPath}`)
        }
    }

    // Default: no manifest, every chart in the suite's data directory
    return { viewIds: null, dataDir }
}
