import {
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    GrapherTabName,
    GrapherInterface,
    GrapherVariant,
    GRAPHER_TAB_NAMES,
    GrapherChartOrMapType,
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
import stream from "stream"
import { execFileSync } from "child_process"
import {
    buildSvgOutFilename,
    initGrapherForSvgExport,
} from "../../baker/GrapherImageBaker.js"
import { getVariableData } from "../../db/model/Variable.js"

import * as _ from "lodash-es"
import util from "util"
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
import { format, type FormatConfig } from "oxfmt"
import oxfmtConfig from "../../.oxfmtrc.json"
import { hashMd5 } from "../../serverUtils/hash.js"
import * as R from "remeda"
import ReactDOMServer from "react-dom/server"

export const SVG_REPO_PATH = "../owid-grapher-svgs"

export const TEST_SUITES = [
    "graphers",
    "grapher-views",
    "mdims",
    "thumbnails",
] as const
export type TestSuite = (typeof TEST_SUITES)[number]

export const TEST_SUITE_DESCRIPTION =
    "Test suite to run: 'graphers' for default Grapher views, 'grapher-views' for all views of a subset of Graphers. 'mdims' for all multi-dim views. 'thumbnails' for thumbnail versions (300x160) of all published graphers."

const CONFIG_FILENAME = "config.json"
const RESULTS_FILENAME = "results.csv"

export const VERIFY_RESULTS_FILENAME = "verify-results.json"

export const finished = util.promisify(stream.finished) // (A)

export interface ChartWithQueryStr {
    viewId: string
    chartType: GrapherChartOrMapType
    queryStr?: string
}

export interface VerifyResultOk {
    kind: "ok"
}

export interface VerifyResultDifference {
    kind: "difference"
    difference: SvgDifference
}

export interface VerifyResultError {
    kind: "error"
    viewId: string
    error: Error
}

export type VerifyResult =
    | VerifyResultOk
    | VerifyResultDifference
    | VerifyResultError

const resultOk = (): VerifyResult => ({
    kind: "ok",
})

export const resultError = (viewId: string, error: Error): VerifyResult => ({
    kind: "error",
    viewId,
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

export type SvgRenderPerformance = {
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

export interface SvgDifference {
    viewId: string
    queryStr?: string
    chartType: GrapherTabName | undefined
    svgFilename: string
    startIndex: number
    referenceSvgFragment: string
    newSvgFragment: string
}

export interface JobDirectory {
    viewId: string
    pathToProcess: string
}

export interface JobConfigAndData {
    config: GrapherInterface
    variableData: MultipleOwidVariableDataDimensionsMap
    totalDataFileSize: number
}

export function logIfVerbose(verbose: boolean, message: string, param?: any) {
    if (verbose)
        if (param) console.log(message, param)
        else console.log(message)
}

function findFirstDiffIndex(a: string, b: string): number {
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    // No difference found even though hash was different
    if (a.length === b.length && a.length === i) i = -1
    return i
}

export async function verifySvg(
    preparedNewSvg: string,
    newSvgRecord: SvgRecord,
    referenceSvgRecord: SvgRecord,
    referenceSvgsPath: string,
    verbose: boolean
): Promise<VerifyResult> {
    logIfVerbose(verbose, `verifying ${newSvgRecord.viewId}`)

    if (newSvgRecord.md5 === referenceSvgRecord.md5) {
        // if the md5 hash is unchanged then there is no difference
        return resultOk()
    }

    // The stored reference .svg file is already in oxfmt-formatted canonical
    // form - that's what wrote it in the first place (renderSvgAndSave /
    // commit_differences), and formatting is idempotent (verified: reformatting
    // an already-formatted reference file is a no-op). So compare the
    // freshly-formatted new svg directly against the file's bytes first,
    // without paying for a reformat on every single chart.
    //
    // Note results.csv's md5 column can go stale independently of the .svg
    // file itself (commit_differences in svg-tester.sh updates the file but
    // never the CSV), which is why the fast-path check above frequently
    // misses even when there's no real difference - don't rely on md5 for
    // anything beyond that optimistic early-exit.
    const referenceSvgRaw = await loadReferenceSvg(
        referenceSvgsPath,
        referenceSvgRecord
    )
    let preparedReferenceSvg = referenceSvgRaw
    let firstDiffIndex = findFirstDiffIndex(preparedNewSvg, referenceSvgRaw)

    if (firstDiffIndex !== -1) {
        // Only reached if the direct comparison found a difference. The
        // reference file is normally already canonical (see above), but if
        // it was written by an older oxfmt version/config than what's
        // running now, a fresh render can look "different" purely from
        // formatting drift rather than an actual content change. Reformat
        // and re-compare before concluding it's a real difference - this
        // only costs an extra format() call on charts that didn't match on
        // the first (cheap) try.
        preparedReferenceSvg = await prepareSvgForComparison(referenceSvgRaw)
        firstDiffIndex = findFirstDiffIndex(
            preparedNewSvg,
            preparedReferenceSvg
        )
    }

    if (firstDiffIndex === -1) {
        return resultOk()
    }
    logIfVerbose(verbose, `${newSvgRecord.viewId} had differences`)
    return resultDifference({
        viewId: newSvgRecord.viewId,
        queryStr: newSvgRecord.resolvedQueryStr ?? newSvgRecord.queryStr,
        chartType: newSvgRecord.chartType,
        svgFilename: newSvgRecord.svgFilename,
        startIndex: firstDiffIndex,
        referenceSvgFragment: preparedReferenceSvg.substring(
            firstDiffIndex - 20,
            firstDiffIndex + 20
        ),
        newSvgFragment: preparedNewSvg.substring(
            firstDiffIndex - 20,
            firstDiffIndex + 20
        ),
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
export function getAvailableTabsFromConfig(
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
    const chartsToProcess: ChartWithQueryStr[] = []

    for (const viewId of viewIds) {
        const grapherConfig = await parseGrapherConfig(viewId, { inDir })

        const chartType =
            grapherConfig.chartTypes?.[0] ?? GRAPHER_CHART_TYPES.LineChart

        // If shouldTestAllTabs is true, generate entries for each available tab
        if (options.shouldTestAllTabs) {
            const availableTabs = getAvailableTabsFromConfig(grapherConfig)
            for (const tab of availableTabs) {
                const tabParam = mapGrapherTabNameToQueryParam(tab)
                const queryStr = `tab=${tabParam}`
                chartsToProcess.push({ viewId, chartType: tab, queryStr })
            }
        } else {
            // Existing behavior for shouldTestAllViews and queryStr
            const queryStrings = options.shouldTestAllViews
                ? queryStringsByChartType[chartType]
                : options.queryStr
                  ? [options.queryStr]
                  : [undefined]

            for (const queryStr of queryStrings) {
                chartsToProcess.push({ viewId, chartType, queryStr })
            }
        }
    }

    return chartsToProcess
}

export async function findValidViewIds(
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

export async function parseGrapherConfig(
    chartId: string,
    { inDir }: { inDir: string }
): Promise<GrapherInterface> {
    const grapherConfigPath = path.join(inDir, chartId, "config.json")
    const grapherConfig = await fs.readJson(grapherConfigPath)
    return grapherConfig
}

export async function writeToFile(data: unknown, filename: string) {
    const json = JSON.stringify(data, null, 2)
    await fs.writeFile(filename, json)
}

export async function writeVariableDataAndMetadataFiles(
    variableIds: number[],
    outDir: string
): Promise<void> {
    const writeVariablePromises = variableIds.map(async (variableId) => {
        const dataPath = path.join(outDir, `${variableId}.data.json`)
        const metadataPath = path.join(outDir, `${variableId}.metadata.json`)

        const variableData = await getVariableData(variableId)

        await writeToFile(variableData.data, dataPath)
        await writeToFile(variableData.metadata, metadataPath)
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
        writeVariableDataAndMetadataFiles(variableIds, dataDir),
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

    // Formatting the SVG (to strip non-deterministic fragments before hashing)
    // is the expensive part of this function. Compute it once here and hand it
    // back to callers instead of letting them redundantly reformat the same
    // raw svg again for comparison/output purposes.
    const preparedSvg = await prepareSvgForComparison(svg)

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
async function prepareSvgForComparison(svg: string): Promise<string> {
    let current = svg
    for (const replaceRegex of replaceRegexes) {
        current = current.replace(replaceRegex, "")
    }
    return await formatSvg(current)
}

async function formatSvg(svg: string): Promise<string> {
    const result = await format("input.html", svg, oxfmtConfig as FormatConfig)
    return result.code
}

/** Remove all non-deterministic parts of the svg and then calculate an md5 hash */
export async function processSvgAndCalculateHash(svg: string): Promise<string> {
    const processed = await prepareSvgForComparison(svg)
    return hashMd5(processed)
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

export async function readJsonFile(filename: string): Promise<unknown> {
    const content = await fs.readJson(filename)
    return content
}

export async function loadReferenceSvg(
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

export async function loadGrapherConfigAndData(
    inputDir: string
): Promise<JobConfigAndData> {
    if (!fs.existsSync(inputDir))
        throw `Input directory does not exist ${inputDir}`

    const configPath = path.join(inputDir, CONFIG_FILENAME)
    const rawConfig = (await readJsonFile(configPath)) as GrapherInterface
    const config = migrateGrapherConfigToLatestVersion(rawConfig) // ensure the config is migrated to the latest schema version

    // TODO: this bakes the same commonly used variables over and over again - deduplicate
    // this on the variable level and bake those separately into a different directory.
    // Tried an in-process per-worker-thread cache here; measured no difference (see PR
    // description) because data loading isn't the bottleneck, so leaving this as-is.
    const variableIds = config.dimensions?.map((d) => d.variableId) ?? []
    const loadDataPromises = variableIds.map(async (variableId) => {
        const dataPath = path.join(inputDir, `${variableId}.data.json`)
        const metadataPath = path.join(inputDir, `${variableId}.metadata.json`)
        const dataFileSize = await stat(dataPath).then((stats) => stats.size)
        const data = (await readJsonFile(dataPath)) as OwidVariableMixedData
        const metadata = (await readJsonFile(
            metadataPath
        )) as OwidVariableWithSourceAndDimension
        return { data, metadata, dataFileSize }
    })

    const data = await Promise.all(loadDataPromises)

    const variableData = new Map(data.map((d) => [d.metadata.id, d]))
    const totalDataFileSize = _.sum(data.map((d) => d.dataFileSize))

    return { config, variableData, totalDataFileSize }
}

export function logDifferencesToConsole(
    svgRecord: SvgRecord,
    validationResult: VerifyResultDifference
): void {
    console.warn(
        `Svg was different for ${svgRecord.viewId}. The difference starts at character ${validationResult.difference.startIndex}.
Reference: ${validationResult.difference.referenceSvgFragment}
Current  : ${validationResult.difference.newSvgFragment}`
    )
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
    verbose: boolean
    rmOnError?: boolean
}

export async function renderAndVerifySvg({
    dir,
    referenceEntry,
    referenceDir,
    outDir,
    queryStr,
    variant = "default",
    verbose,
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
            referenceDir,
            verbose
        )
        // verifySvg returns a Result type - if it is success we don't care any further
        // but if there was an error then we write the svg and a message to stderr
        switch (validationResult.kind) {
            case "difference": {
                if (verbose)
                    logDifferencesToConsole(svgRecord, validationResult)
                const pathFragments = path.parse(svgRecord.svgFilename)
                const outputPath = path.join(
                    outDir,
                    pathFragments.name + pathFragments.ext
                )
                await fs.writeFile(outputPath, preparedSvg)
                break
            }
        }
        return Promise.resolve(validationResult)
    } catch (err) {
        console.error(`Threw error for ${referenceEntry.viewId}:`, err)
        if (rmOnError) {
            const outPath = path.join(outDir, referenceEntry.svgFilename)
            await fs.unlink(outPath).catch(() => {
                /* ignore ENOENT */
            })
        }
        return Promise.resolve(resultError(referenceEntry.viewId, err as Error))
    }
}

// "running" is written before the first render and overwritten when the run
// finishes. A file left in that state means the process died before it could
// report - killed by the `timeout` wrapper or Buildkite cancelling the step, say -
// which is otherwise indistinguishable from a suite that was never selected.
export type VerifyRunStatus = "running" | "ok" | "differences" | "error"

export interface VerifyDifferenceEntry {
    viewId: string
    queryStr?: string
    chartType?: string
    svgFilename: string
}

export interface VerifyErrorEntry {
    viewId: string
    kind: "timeout" | "render"
    message: string
}

export interface VerifyRunSummary {
    suite: TestSuite
    status: VerifyRunStatus
    startedAt: string
    durationMs: number
    grapherCommit: string | null
    svgsCommit: string | null
    counts: {
        total: number
        ok: number
        differences: number
        errors: number
    }
    differences: VerifyDifferenceEntry[]
    errors: VerifyErrorEntry[]
}

// A `.timeout()` breach and a render crash both arrive through the same `.catch`
// in verify-graphs.ts, so the only thing distinguishing them is the error name
// workerpool gives a timeout. Errors crossing a worker boundary are structured
// clones rather than real Error instances, hence the defensive access.
function classifyVerifyError(error: Error): VerifyErrorEntry["kind"] {
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
        suite: TestSuite
        startedAt: Date
        durationMs: number
    }
): VerifyRunSummary {
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
            kind: classifyVerifyError(result.error),
            // The stack stays on stderr for the CI log; this file is a status
            // report, not a crash dump.
            message: verifyErrorMessage(result.error),
        }))

    // An errored suite is reported as errored even if it also found differences:
    // we can't claim to know what changed when part of the run didn't complete.
    const status: VerifyRunStatus = errors.length
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
        svgsCommit: resolveCommit(SVG_REPO_PATH),
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

// Written next to verify-graphs.log so both live with the suite they describe.
// Nothing commits it: create_report/commit_differences in svg-tester.sh add
// explicit paths only.
export async function writeVerifyResults(
    testSuiteDir: string,
    summary: VerifyRunSummary
): Promise<void> {
    const outPath = path.join(testSuiteDir, VERIFY_RESULTS_FILENAME)
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
    suite: TestSuite,
    startedAt: Date
): Promise<void> {
    await writeVerifyResults(testSuiteDir, {
        suite,
        status: "running",
        startedAt: startedAt.toISOString(),
        durationMs: 0,
        grapherCommit: resolveCommit(),
        svgsCommit: resolveCommit(SVG_REPO_PATH),
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
    suite: TestSuite,
    error: unknown
): Promise<void> {
    const startedAt = new Date()
    await writeVerifyResults(testSuiteDir, {
        suite,
        status: "error",
        startedAt: startedAt.toISOString(),
        durationMs: 0,
        grapherCommit: resolveCommit(),
        svgsCommit: resolveCommit(SVG_REPO_PATH),
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

export const EXIT_CODE_DIFFERENCES = 2
export const EXIT_CODE_ERROR = 1

export function verifyExitCode(summary: VerifyRunSummary): number {
    if (summary.counts.errors > 0) return EXIT_CODE_ERROR
    if (summary.counts.differences > 0) return EXIT_CODE_DIFFERENCES
    return 0
}

// Human-facing output. The machine-readable version of all this is
// verify-results.json.
export function reportVerifyResults(
    validationResults: VerifyResult[],
    verbose: boolean
): void {
    const errorResults = validationResults.filter(
        (result) => result.kind === "error"
    )

    const differenceResults = validationResults.filter(
        (result) => result.kind === "difference"
    )

    if (errorResults.length === 0 && differenceResults.length === 0) {
        logIfVerbose(
            verbose,
            `There were no differences in all graphs processed`
        )
        return
    }

    if (errorResults.length) {
        console.warn(
            `${errorResults.length} graphs threw errors: ${errorResults
                .map((err) => err.viewId)
                .join()}`
        )
        for (const result of errorResults) {
            console.log(`${result.viewId}: ${verifyErrorMessage(result.error)}`)
        }
    }

    if (differenceResults.length) {
        console.warn(
            `${
                differenceResults.length
            } graphs had differences: ${differenceResults
                .map((err) => err.difference.viewId)
                .join()}`
        )
        for (const result of differenceResults) {
            console.log(result.difference.viewId)
        }
    }
}

export function readLinesFromFile(filename: string): string[] {
    const content = fs.readFileSync(filename, "utf-8")
    return content.split("\n")
}

export interface GrapherViewsManifest {
    slugs: string[]
    dataDir: string // Relative path to the data directory (e.g., "../graphers/data")
}

// Load manifest from a specific path
export async function loadManifestFromPath(
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
    testSuite: TestSuite,
    options: {
        targetViewIds?: string[]
        manifestName?: string
        verbose?: boolean
    }
): Promise<{ viewIds: string[] | null; dataDir: string }> {
    const { verbose = false } = options

    const testSuiteDir = path.join(SVG_REPO_PATH, testSuite)
    const defaultDataDir = path.join(testSuiteDir, "data")

    // For grapher-views and thumbnails, load the manifest to resolve dataDir
    // (these suites don't have their own data/ directory)
    if (testSuite === "grapher-views" || testSuite === "thumbnails") {
        const defaultManifestName = "top.manifest.json"
        const manifestName = options.manifestName ?? defaultManifestName
        const manifestPath = path.join(testSuiteDir, manifestName)
        const manifest = await loadManifestFromPath(manifestPath)

        if (manifest) {
            const dataDir = path.join(testSuiteDir, manifest.dataDir)

            // viewIds are explicitly provided
            if (options.targetViewIds) {
                logIfVerbose(
                    verbose,
                    `Using data directory: ${manifest.dataDir}`
                )
                return { viewIds: null, dataDir }
            }

            logIfVerbose(
                verbose,
                `Read ${manifest.slugs.length} chart slugs from manifest: ${manifestName}`
            )
            logIfVerbose(verbose, `Using data directory: ${manifest.dataDir}`)

            return { viewIds: manifest.slugs, dataDir }
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
        return { viewIds: null, dataDir: defaultDataDir }
    }

    // For other test suites, only load manifest if explicitly provided
    if (options.manifestName) {
        const manifestPath = path.join(testSuiteDir, options.manifestName)
        const manifest = await loadManifestFromPath(manifestPath)

        if (manifest) {
            const dataDir = path.join(testSuiteDir, manifest.dataDir)
            logIfVerbose(
                verbose,
                `Read ${manifest.slugs.length} chart slugs from manifest: ${options.manifestName}`
            )
            logIfVerbose(verbose, `Using data directory: ${manifest.dataDir}`)
            return { viewIds: manifest.slugs, dataDir }
        } else {
            console.warn(`Warning: Manifest not found at ${manifestPath}`)
        }
    }

    // Default: no manifest, use default data directory
    return { viewIds: null, dataDir: defaultDataDir }
}
