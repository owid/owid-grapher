import {
    ExplorerType,
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    GrapherTabName,
    GrapherInterface,
    OwidChartDimensionInterface,
    parseChartConfig,
} from "@ourworldindata/types"
import {
    Bounds,
    mergeGrapherConfigs,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    queryParamsToStr,
    TESTING_ONLY_disable_guid,
    PromiseCache,
    CoreTableInputOption,
} from "@ourworldindata/utils"
import fs, { stat } from "fs-extra"
import path from "path"
import stream from "stream"
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
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    GrapherProgrammaticInterface,
    legacyToOwidTableAndDimensions,
    legacyToOwidTableAndDimensionsWithMandatorySlug,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"
import prettier from "prettier"
import { hashMd5 } from "../../serverUtils/hash.js"
import * as R from "remeda"
import ReactDOMServer from "react-dom/server"
import {
    Explorer,
    ExplorerChartCreationMode,
    ExplorerProgram,
    ExplorerProps,
    GrapherGrammar,
} from "@ourworldindata/explorer"
import { knexRaw, KnexReadonlyTransaction } from "../../db/db.js"

export const SVG_REPO_PATH = "../owid-grapher-svgs"

export const TEST_SUITES = [
    "graphers",
    "grapher-views",
    "mdims",
    "explorers",
] as const
export type TestSuite = (typeof TEST_SUITES)[number]

export const TEST_SUITE_DESCRIPTION =
    "Test suite to run: 'graphers' for default Grapher views, 'grapher-views' for all views of a subset of Graphers. 'mdims' for all multi-dim views. 'explorers' for all Explorer views."

const CONFIG_FILENAME = "config.json"
const RESULTS_FILENAME = "results.csv"

export const finished = util.promisify(stream.finished) // (A)

export interface ChartWithQueryStr {
    viewId: string
    chartType: GrapherChartType
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

const resultError = (viewId: string, error: Error): VerifyResult => ({
    kind: "error",
    viewId,
    error,
})

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
    md5: string
    svgFilename: string
    performance?: SvgRenderPerformance
}

export interface SvgDifference {
    viewId: string
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
    if (a.length === b.length && a.length === i) {
        console.warn("No difference found even though hash was different!")
        i = -1
    }
    return i
}

export async function verifySvg(
    newSvg: string,
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

    const referenceSvg = await loadReferenceSvg(
        referenceSvgsPath,
        referenceSvgRecord
    )
    const preparedNewSvg = await prepareSvgForComparison(newSvg)
    const preparedReferenceSvg = await prepareSvgForComparison(referenceSvg)
    const firstDiffIndex = findFirstDiffIndex(
        preparedNewSvg,
        preparedReferenceSvg
    )
    // Sometimes the md5 hash comparison above indicated a difference
    // but the character by character comparison gives -1 (no differences)
    // Weird - maybe an artifact of a change in how the ids are stripped
    // across version?
    if (firstDiffIndex === -1) {
        return resultOk()
    }
    logIfVerbose(verbose, `${newSvgRecord.viewId} had differences`)
    return resultDifference({
        viewId: newSvgRecord.viewId,
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

export async function findChartViewsToGenerate(
    inDir: string,
    viewIds: string[],
    options: {
        queryStr?: string
        shouldTestAllViews?: boolean
    }
): Promise<ChartWithQueryStr[]> {
    const chartsToProcess: ChartWithQueryStr[] = []

    for (const viewId of viewIds) {
        const grapherConfig = await parseGrapherConfig(viewId, { inDir })

        const chartType =
            grapherConfig.chartTypes?.[0] ?? GRAPHER_CHART_TYPES.LineChart

        const queryStrings = options.shouldTestAllViews
            ? queryStringsByChartType[chartType]
            : options.queryStr
              ? [options.queryStr]
              : [undefined]

        for (const queryStr of queryStrings) {
            chartsToProcess.push({ viewId, chartType, queryStr })
        }
    }

    return chartsToProcess
}

export async function findValidViewIds(
    inDir: string,
    {
        grapherIds = [],
        chartTypes = [],
    }: {
        grapherIds?: number[]
        chartTypes?: GrapherChartType[]
    }
): Promise<string[]> {
    const validChartIds: string[] = []

    // If nothing is specified, scan all directories in the inDir folder
    if (grapherIds.length === 0 && chartTypes.length === 0) {
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
    if (grapherIds.length > 0) {
        const validatedChartIds = grapherIds.filter((grapherId) =>
            fs.existsSync(path.join(inDir, grapherId.toString()))
        )
        validChartIds.push(
            ...validatedChartIds.map((grapherId) => grapherId.toString())
        )
        if (validChartIds.length < grapherIds.length) {
            const invalidChartIds = _.difference(grapherIds, validatedChartIds)
            console.warn(
                `${grapherIds.length} grapher ids were given but only ${validChartIds.length} existed as directories. Missing ids: ${invalidChartIds}`
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

export async function renderSvg({
    dir,
    queryStr,
}: {
    dir: JobDirectory
    queryStr?: string
}): Promise<[string, SvgRecord]> {
    const configAndData = await loadGrapherConfigAndData(dir.pathToProcess)

    // Graphers sometimes need to generate ids (incrementing numbers). For this
    // they keep a stateful variable in clientutils. To minimize differences
    // between consecutive runs we reset this id here before every export
    TESTING_ONLY_disable_guid()

    const timeStart = Date.now()

    const grapher = initGrapherForSvgExport(
        {
            ...configAndData.config,
            adminBaseUrl: "https://ourworldindata.org",
            bakedGrapherURL: "https://ourworldindata.org/grapher",
        },
        queryStr
    )
    const { width, height } = grapher.grapherState.defaultBounds
    const outFilename = buildSvgOutFilename(
        {
            slug: dir.viewId,
            version: configAndData.config.version ?? 0,
            width,
            height,
            queryStr,
        },
        { shouldHashQueryStr: true }
    )

    grapher.grapherState.inputTable = legacyToOwidTableAndDimensions(
        configAndData.variableData,
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors
    )
    const durationReceiveData = Date.now() - timeStart

    const svg = grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
    const durationTotal = Date.now() - timeStart

    const svgRecord: SvgRecord = {
        viewId: dir.viewId,
        chartType: grapher.grapherState.activeTab,
        queryStr,
        md5: await processSvgAndCalculateHash(svg),
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
    return Promise.resolve([svg, svgRecord])
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
    return await prettier.format(svg, {
        parser: "html",
        tabWidth: 4,
    })
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
}
export async function renderSvgAndSave(
    jobDescription: RenderSvgAndSaveJobDescription
): Promise<SvgRecord> {
    const { dir, outDir, queryStr } = jobDescription
    const [svg, svgRecord] = await renderSvg({ dir, queryStr })
    const outPath = path.join(outDir, svgRecord.svgFilename)
    const cleanedSvg = await prepareSvgForComparison(svg)
    await fs.writeFile(outPath, cleanedSvg)
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
        throw `Input directory does not exist ${referenceFilename}`
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
    // this on the variable level and bake those separately into a different directory
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
    verbose: boolean
    rmOnError?: boolean
}

export async function renderAndVerifySvg({
    dir,
    referenceEntry,
    referenceDir,
    outDir,
    queryStr,
    verbose,
    rmOnError,
}: RenderJobDescription): Promise<VerifyResult> {
    try {
        if (!dir) throw "Dir was not defined"
        if (!referenceEntry) throw "ReferenceEntry was not defined"
        if (!referenceDir) throw "ReferenceDir was not defined"
        if (!outDir) throw "outdir was not defined"

        const [svg, svgRecord] = await renderSvg({ dir, queryStr })

        const validationResult = await verifySvg(
            svg,
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
                const cleanedSvg = await prepareSvgForComparison(svg)
                await fs.writeFile(outputPath, cleanedSvg)
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

export function displayVerifyResultsAndGetExitCode(
    validationResults: VerifyResult[],
    verbose: boolean
): number {
    let returnCode: number

    const errorResults = validationResults.filter(
        (result) => result.kind === "error"
    ) as VerifyResultError[]

    const differenceResults = validationResults.filter(
        (result) => result.kind === "difference"
    ) as VerifyResultDifference[]

    if (errorResults.length === 0 && differenceResults.length === 0) {
        logIfVerbose(
            verbose,
            `There were no differences in all graphs processed`
        )
        returnCode = 0
    } else {
        if (errorResults.length) {
            console.warn(
                `${errorResults.length} graphs threw errors: ${errorResults
                    .map((err) => err.viewId)
                    .join()}`
            )
            for (const result of errorResults) {
                console.log(result.viewId?.toString(), result.error) // write to stdout one grapher id per file for easy piping to other processes
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
                console.log("", result.difference.viewId) // write to stdout one grapher id per file for easy piping to other processes
            }
        }
        returnCode = errorResults.length + differenceResults.length
    }
    return returnCode
}

export function readLinesFromFile(filename: string): string[] {
    const content = fs.readFileSync(filename, "utf-8")
    return content.split("\n")
}

export function getExplorerType(
    explorerProgram: ExplorerProgram
): ExplorerType {
    const decisionMatrix = explorerProgram.decisionMatrix

    // It's an indicator-based explorer if any row refers to yVariableIds
    const yVariableIdsColumn = decisionMatrix.table.get(
        GrapherGrammar.yVariableIds.keyword
    )
    if (yVariableIdsColumn.numValues > 0) return ExplorerType.Indicator

    // If all rows refer to grapher IDs, it's a grapher-based explorer
    const grapherIdsColumn = decisionMatrix.table.get(
        GrapherGrammar.grapherId.keyword
    )
    if (grapherIdsColumn.numValues === decisionMatrix.numRows)
        return ExplorerType.Grapher

    // Otherwise, it's a CSV-based explorer
    return ExplorerType.Csv
}

const loadInputTableForConfig = async (
    dir: string,
    args: {
        dimensions?: OwidChartDimensionInterface[]
        selectedEntityColors?: {
            [entityName: string]: string | undefined
        }
    }
) => {
    if (!args.dimensions || args.dimensions.length === 0) return undefined

    // Load variable data from disk for the requested dimensions
    const variableIds = args.dimensions.map((d) => d.variableId)
    const variableDataMap = new Map()

    for (const variableId of variableIds) {
        const dataPath = path.join(dir, `${variableId}.data.json`)
        const metadataPath = path.join(dir, `${variableId}.metadata.json`)

        if (!(await fs.pathExists(dataPath))) {
            console.warn(`Missing data file for variable ${variableId}`)
            continue
        }

        const data = await fs.readJson(dataPath)
        const metadata = await fs.readJson(metadataPath)
        variableDataMap.set(variableId, { data, metadata })
    }

    // Convert to OwidTable
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variableDataMap,
        args.dimensions,
        args.selectedEntityColors
    )

    return inputTable
}

async function loadPartialGrapherConfigs(
    dir: string
): Promise<GrapherProgrammaticInterface[]> {
    const partialGrapherConfigs: GrapherProgrammaticInterface[] = []

    // Read all .config.json files in the directory
    const files = await fs.readdir(dir)
    const configFiles = files.filter((file) => file.endsWith(".config.json"))

    for (const configFile of configFiles) {
        const variableId = parseInt(configFile.replace(".config.json", ""))
        if (isNaN(variableId)) continue

        const configPath = path.join(dir, configFile)
        const config = await fs.readJson(configPath)
        partialGrapherConfigs.push(config)
    }

    return partialGrapherConfigs
}

// Patch ExplorerProgram's static tableDataLoader to support file:// URLs
// This allows us to load CSV files from disk during testing without
// modifying global fetch or requiring network access
function patchExplorerTableLoader(): void {
    ;(ExplorerProgram as any).tableDataLoader = new PromiseCache(
        async (url: string): Promise<CoreTableInputOption> => {
            if (url.startsWith("file://")) {
                const filePath = url.replace("file://", "")
                const content = await fs.readFile(filePath, "utf-8")
                return content
            }

            const response = await fetch(url)
            if (!response.ok) throw new Error(response.statusText)
            const tableInput: CoreTableInputOption = url.endsWith(".json")
                ? await response.json()
                : await response.text()
            return tableInput
        }
    )
}

export async function renderExplorerViewsToSVGsAndSave({
    dir,
    outDir,
}: {
    dir: string
    outDir: string
}): Promise<SvgRecord[]> {
    // Set up file-aware table loader for local CSV files
    patchExplorerTableLoader()

    const configPath = path.join(dir, "config.tsv")
    const tsvContent = await fs.readFile(configPath, "utf-8")

    const explorerSlug = path.basename(dir)
    const explorerProgram = new ExplorerProgram(explorerSlug, tsvContent)
    const explorerType = getExplorerType(explorerProgram)

    // Skip Grapher explorers
    if (explorerType === ExplorerType.Grapher) return []

    const width = DEFAULT_GRAPHER_WIDTH
    const height = DEFAULT_GRAPHER_HEIGHT
    const bounds = new Bounds(0, 0, width, height)

    // Load partial grapher configs
    const partialGrapherConfigs = await loadPartialGrapherConfigs(dir)

    const explorerProps: ExplorerProps = {
        slug: explorerSlug,
        program: tsvContent,
        isEmbeddedInAnOwidPage: true,
        adminBaseUrl: "https://ourworldindata.org",
        bakedBaseUrl: "https://ourworldindata.org",
        bakedGrapherUrl: "https://ourworldindata.org/grapher",
        dataApiUrl: "https://api.ourworldindata.org/v1/indicators", // Unused
        partialGrapherConfigs,
        bounds,
        staticBounds: bounds,
        loadInputTableForConfig: (args) => loadInputTableForConfig(dir, args),
    }

    const choices = explorerProgram.decisionMatrix.allDecisionsAsQueryParams()

    console.log(
        `Rendering ${choices.length} views for explorer: ${explorerSlug}`
    )

    const svgRecords: SvgRecord[] = []

    for (const choiceParams of choices) {
        // Reset GUID for each view to ensure deterministic output
        TESTING_ONLY_disable_guid()

        // Create a fresh Explorer instance for each view
        const explorer = new Explorer(explorerProps)

        // Set the explorer to this specific choice combination
        explorer.explorerProgram.decisionMatrix.setValuesFromChoiceParams(
            choiceParams
        )

        // Skip if this is a grapher id based row
        if (
            explorer.explorerProgram.chartCreationMode ===
            ExplorerChartCreationMode.FromGrapherId
        )
            continue

        // Update the explorer
        const oldRow = explorer.explorerProgram.currentlySelectedGrapherRow || 0
        await explorer.reactToUserChangingSelection(oldRow)

        // Generate SVG for this view
        const svg = explorer.grapherState.generateStaticSvg(
            ReactDOMServer.renderToStaticMarkup
        )
        const cleanedSvg = await prepareSvgForComparison(svg)

        const queryStr = queryParamsToStr(choiceParams).replace("?", "")
        const viewId = `${explorerSlug}?${queryStr}`

        const outFilename = buildSvgOutFilename(
            {
                slug: explorerSlug,
                version: 0, // Explorers don't have versions
                width,
                height,
                queryStr,
            },
            { shouldHashQueryStr: true }
        )

        await fs.writeFile(path.join(outDir, outFilename), cleanedSvg)

        svgRecords.push({
            viewId,
            chartType: explorer.grapherState.activeTab,
            md5: await processSvgAndCalculateHash(svg),
            svgFilename: outFilename,
        })
    }

    return svgRecords
}

export async function verifyExplorerViews({
    explorerDir,
    explorerSlug,
    referencesDir,
    differencesDir,
    verbose,
    rmOnError,
}: {
    explorerDir: string
    explorerSlug: string
    referencesDir: string
    differencesDir: string
    verbose: boolean
    rmOnError: boolean
}): Promise<VerifyResult[]> {
    // Set up file-aware table loader for local CSV files
    patchExplorerTableLoader()

    // Load reference CSV in the worker to avoid passing massive arrays between processes
    const referenceData = await parseReferenceCsv(referencesDir)
    const referenceDataByViewId = new Map(
        referenceData.map((record) => [record.viewId, record])
    )

    // Load explorer config ONCE
    const configPath = path.join(explorerDir, "config.tsv")
    const tsvContent = await fs.readFile(configPath, "utf-8")
    const explorerProgram = new ExplorerProgram(explorerSlug, tsvContent)
    const explorerType = getExplorerType(explorerProgram)

    // Skip Grapher explorers
    if (explorerType === ExplorerType.Grapher) return []

    const width = DEFAULT_GRAPHER_WIDTH
    const height = DEFAULT_GRAPHER_HEIGHT
    const bounds = new Bounds(0, 0, width, height)

    // Load partial grapher configs ONCE
    const partialGrapherConfigs = await loadPartialGrapherConfigs(explorerDir)

    // Set up explorer props to reuse
    const explorerProps: ExplorerProps = {
        slug: explorerSlug,
        program: tsvContent,
        isEmbeddedInAnOwidPage: true,
        adminBaseUrl: "https://ourworldindata.org",
        bakedBaseUrl: "https://ourworldindata.org",
        bakedGrapherUrl: "https://ourworldindata.org/grapher",
        dataApiUrl: "https://api.ourworldindata.org/v1/indicators", // Unused
        partialGrapherConfigs,
        bounds,
        staticBounds: bounds,
        loadInputTableForConfig: (args) =>
            loadInputTableForConfig(explorerDir, args),
    }

    // Get all choice combinations
    const allChoices = explorerProgram.decisionMatrix.allDecisionsAsQueryParams()

    console.log(
        `Verifying ${allChoices.length} views for explorer: ${explorerSlug}`
    )

    const results: VerifyResult[] = []

    // Process all views for this explorer sequentially to reuse loaded data
    for (const choiceParams of allChoices) {
        const queryStr = queryParamsToStr(choiceParams).replace("?", "")
        const viewId = `${explorerSlug}?${queryStr}`

        const referenceEntry = referenceDataByViewId.get(viewId)
        if (!referenceEntry) {
            console.warn(`No reference found for ${viewId}`)
            continue
        }

        try {
            logIfVerbose(verbose, `Verifying explorer view ${viewId}`)

            // Reset GUID for deterministic output
            TESTING_ONLY_disable_guid()

            // Create a fresh Explorer instance for this view, reusing shared config
            const explorer = new Explorer(explorerProps)

            // Set the explorer to this specific choice combination
            explorer.explorerProgram.decisionMatrix.setValuesFromChoiceParams(
                choiceParams
            )

            // Skip if this is a grapher id based row
            if (
                explorer.explorerProgram.chartCreationMode ===
                ExplorerChartCreationMode.FromGrapherId
            ) {
                results.push({ kind: "ok" })
                continue
            }

            // Update the explorer
            const oldRow = explorer.explorerProgram.currentlySelectedGrapherRow || 0
            await explorer.reactToUserChangingSelection(oldRow)

            // Generate SVG for this view
            const svg = explorer.grapherState.generateStaticSvg(
                ReactDOMServer.renderToStaticMarkup
            )

            const outFilename = buildSvgOutFilename(
                {
                    slug: explorerSlug,
                    version: 0, // Explorers don't have versions
                    width,
                    height,
                    queryStr,
                },
                { shouldHashQueryStr: true }
            )

            const svgRecord: SvgRecord = {
                viewId,
                chartType: explorer.grapherState.activeTab,
                md5: await processSvgAndCalculateHash(svg),
                svgFilename: outFilename,
            }

            // Verify against reference
            const validationResult = await verifySvg(
                svg,
                svgRecord,
                referenceEntry,
                referencesDir,
                verbose
            )

            // If there was a difference, write the SVG
            if (validationResult.kind === "difference") {
                if (verbose) logDifferencesToConsole(svgRecord, validationResult)
                const pathFragments = path.parse(svgRecord.svgFilename)
                const outputPath = path.join(
                    differencesDir,
                    pathFragments.name + pathFragments.ext
                )
                const cleanedSvg = await prepareSvgForComparison(svg)
                await fs.writeFile(outputPath, cleanedSvg)
            }

            results.push(validationResult)
        } catch (err) {
            console.error(`Threw error for ${viewId}:`, err)
            if (rmOnError) {
                const outPath = path.join(differencesDir, referenceEntry.svgFilename)
                await fs.unlink(outPath).catch(() => {
                    /* ignore ENOENT */
                })
            }
            results.push(resultError(viewId, err as Error))
        }
    }

    return results
}

export async function savePartialGrapherConfigs(
    variableIds: number[],
    outDir: string,
    knex: KnexReadonlyTransaction
): Promise<void> {
    // Fetch partial grapher configs for each variable
    type ChartRow = {
        id: number
        grapherConfigAdmin: string | null
        grapherConfigETL: string | null
    }
    const partialGrapherConfigRows: ChartRow[] = await knexRaw(
        knex,
        `-- sql
        SELECT
            v.id,
            cc_etl.patch AS grapherConfigETL,
            cc_admin.patch AS grapherConfigAdmin
        FROM variables v
            LEFT JOIN chart_configs cc_admin ON cc_admin.id=v.grapherConfigIdAdmin
            LEFT JOIN chart_configs cc_etl ON cc_etl.id=v.grapherConfigIdETL
        WHERE v.id IN (?)`,
        [variableIds]
    )

    const parseRow = (
        row: ChartRow
    ): { variableId: number; config: GrapherInterface } => {
        const adminConfig: GrapherProgrammaticInterface = row.grapherConfigAdmin
            ? parseChartConfig(row.grapherConfigAdmin)
            : {}
        const etlConfig: GrapherProgrammaticInterface = row.grapherConfigETL
            ? parseChartConfig(row.grapherConfigETL)
            : {}

        const mergedConfig = mergeGrapherConfigs(etlConfig, adminConfig)

        // Set the variable id as the config id
        mergedConfig.id = row.id

        // Explorers set their own dimensions, so we don't need to include them here
        delete mergedConfig.dimensions

        return { variableId: row.id, config: mergedConfig }
    }

    const partialGrapherConfigs = partialGrapherConfigRows
        .filter((row) => row.grapherConfigAdmin || row.grapherConfigETL)
        .map((row) => parseRow(row))

    for (const { variableId, config } of partialGrapherConfigs) {
        const configPath = path.join(outDir, `${variableId}.config.json`)
        await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    }
}
