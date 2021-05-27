import * as stream from "stream"
import * as path from "path"
import { getVariableData } from "../../db/model/Variable"
import {
    initGrapherForSvgExport,
    buildSvgOutFilename,
} from "../../baker/GrapherImageBaker"
import { createGunzip, createGzip } from "zlib"
//import { createWriteStream } from "fs"
import * as fs from "fs-extra"
import getStream from "get-stream"
import { LegacyVariablesAndEntityKey } from "../../grapher/core/LegacyVariableCode"
import { ChartTypeName } from "../../grapher/core/GrapherConstants"
import md5 from "md5"

import * as util from "util"
//import pMap from "p-map"
import { GrapherInterface } from "../../grapher/core/GrapherInterface"
import { TESTING_ONLY_reset_guid } from "../../clientUtils/Util"
import _ from "lodash"

export const finished = util.promisify(stream.finished) // (A)

interface ResultOk<T> {
    kind: "ok"
    value: T
}

interface ResultError<E> {
    kind: "error"
    error: E
}

type Result<T, E> = ResultOk<T> | ResultError<E>

const resultOk = <T, E>(value: T): Result<T, E> => ({
    kind: "ok",
    value: value,
})
const resultError = <T, E>(error: E): Result<T, E> => ({
    kind: "error",
    error: error,
})

const configFilename: string = "config.json.gz"
const dataFilename = "data.json.gz"
export type SvgRecord = {
    chartId: number
    slug: string
    chartType: ChartTypeName | undefined
    md5: string
    svgFilename: string
}

interface SvgDifference {
    startIndex: number
    referenceSvgFragment: string
    newSvgFragment: string
}

export function logIfVerbose(
    verbose: boolean,
    message: string,
    param?: unknown
) {
    if (verbose) console.log(message, param)
}

export const svgCsvHeader = `grapherId,slug,chartType,md5,svgFilename`

function findFirstDiffIndex(a: string, b: string): number {
    var i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    if (a.length === b.length && a.length === i) {
        console.warn("No difference found!")
    }
    return i
}

export async function verifySvg(
    newSvg: string,
    newSvgRecord: SvgRecord,
    referenceSvgRecord: SvgRecord,
    referenceSvgsPath: string,
    verbose: boolean
): Promise<Result<null, SvgDifference>> {
    logIfVerbose(verbose, `verifying ${newSvgRecord.chartId}`)

    if (newSvgRecord.md5 === referenceSvgRecord.md5) {
        // if the md5 hash is unchanged then there is no difference
        return resultOk(null)
    }

    const referenceSvg = await loadReferenceSvg(
        referenceSvgsPath,
        referenceSvgRecord
    )
    const preparedNewSvg = prepareSvgForComparision(newSvg)
    const preparedReferenceSvg = prepareSvgForComparision(referenceSvg)
    const firstDiffIndex = findFirstDiffIndex(
        preparedNewSvg,
        preparedReferenceSvg
    )
    logIfVerbose(verbose, `${newSvgRecord.chartId} had differences`)
    return resultError({
        startIndex: firstDiffIndex,
        referenceSvgFragment: preparedReferenceSvg.substr(
            firstDiffIndex - 20,
            40
        ),
        newSvgFragment: preparedNewSvg.substr(firstDiffIndex - 20, 40),
    })
}
export async function decideDirectoriesToVerify(
    grapherIds: number[],
    inDir: string,
    reverseDirectories: boolean,
    numPartitions: number,
    partition: number
): Promise<string[]> {
    let directories: string[] = []
    if (grapherIds.length === 0) {
        // If no grapher ids were given scan all directories in the inDir folder
        const dir = await fs.opendir(inDir)
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                directories.push(entry.name)
            }
        }
    } else {
        // if grapher ids were given check which ones exist in inDir and filter to those
        // -> if by doing so we drop some, warn the user
        directories = grapherIds.map((id) => id.toString())
        const allDirsCount = directories.length
        directories = directories.filter((item) =>
            fs.existsSync(path.join(inDir, item))
        )
        if (directories.length < allDirsCount) {
            console.warn(
                `${allDirsCount} grapher ids were given but only ${directories.length} existed as directories`
            )
        }
    }

    // Sort directories numerically (this assumes every dir == a grapher id and those are numeric)
    const directoriesToProcess = sortAndPartitionDirectories(
        directories,
        reverseDirectories,
        inDir,
        numPartitions,
        partition
    )
    return directoriesToProcess
}

export function sortAndPartitionDirectories(
    directories: string[],
    reverseDirectories: boolean,
    inDir: string,
    numPartitions: number,
    partition: number
): string[] {
    directories.sort((a, b) => parseInt(a) - parseInt(b))
    if (reverseDirectories) {
        directories.reverse()
    }
    const paths = directories.map((name) => path.join(inDir, name))
    const directoriesToProcess = []
    // Pick ever numPartition-tht element, using partition as the offset
    for (let i = 0; i < paths.length; i++) {
        if (i % numPartitions === partition - 1) {
            directoriesToProcess.push(paths[i])
        }
    }
    return directoriesToProcess
}

/** Turn a list of comma separated numbers and ranges into an array of numbers */
export function getGrapherIdListFromString(rawGrapherIds: string): number[] {
    return rawGrapherIds.split(",").flatMap((item) => {
        if (item.includes("-")) {
            const subparts = item.split("-")
            if (subparts.length !== 2) {
                console.warn(`Invalid graphid range: ${item}`)
                return []
            } else {
                const first = parseInt(subparts[0])
                const second = parseInt(subparts[1])
                return _.range(first, second + 1)
            }
        } else {
            const parsed = parseInt(item)
            if (isNaN(parsed)) {
                return []
            } else {
                return [parsed]
            }
        }
    })
}

export async function writeToGzippedFile(
    data: unknown,
    filename: string
): Promise<void> {
    const json = JSON.stringify(data)
    const writeStream = fs.createWriteStream(filename)

    const gzipStream = createGzip()
    gzipStream.pipe(writeStream)
    gzipStream.write(json)
    gzipStream.end()

    return finished(writeStream)
}
export async function saveGrapherSchemaAndData(
    config: GrapherInterface,
    outDir: string
): Promise<void> {
    const dataDir = path.join(outDir, config.id?.toString() ?? "")
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    const configPath = path.join(dataDir, configFilename)
    const promise1 = writeToGzippedFile(config, configPath)

    const dataPath = path.join(dataDir, dataFilename)
    const grapher = initGrapherForSvgExport(config, "")
    const variableIds = grapher.dimensions.map((d) => d.variableId)

    const promise2 = getVariableData(variableIds).then((vardata) =>
        writeToGzippedFile(vardata, dataPath)
    )

    await Promise.allSettled([promise1, promise2])
}

export async function renderSvg(dir: string): Promise<[string, SvgRecord]> {
    const [config, data] = await loadGrapherConfigAndData(dir)

    // Graphers sometimes need to generate ids (incrementing numbers). For this
    // they keep a stateful variable in clientutils. To minimize differences
    // between consecutive runs we reset this id here before every export
    TESTING_ONLY_reset_guid()
    const grapher = initGrapherForSvgExport(config, "")
    const { width, height } = grapher.idealBounds
    const outFilename = buildSvgOutFilename(
        config.slug!,
        "",
        config.version,
        width,
        height
    )

    grapher.receiveLegacyData(data as LegacyVariablesAndEntityKey)
    const svg = grapher.staticSVG
    const svgRecord = {
        chartId: config.id!,
        slug: config.slug!,
        chartType: config.type,
        md5: processSvgAndCalculateHash(svg),
        svgFilename: outFilename,
    }
    return Promise.resolve([svg, svgRecord])
}

const replaceRegexes = [/-select-[0-9]+-input/g]
/** Some fragments of the svgs are non-deterministic. This function is used to
    delete all such fragments */
function prepareSvgForComparision(svg: string) {
    let current = svg
    for (const replaceRegex of replaceRegexes) {
        current = svg.replace(replaceRegex, "")
    }
    return current
}
/** Remove all non-deterministic parts of the svg and then calculate an md5 hash */
export function processSvgAndCalculateHash(svg: string): string {
    const processed = prepareSvgForComparision(svg)
    return md5(processed)
}

export async function renderSvgAndSave(
    dir: string,
    outDir: string
): Promise<SvgRecord> {
    const [svg, svgRecord] = await renderSvg(dir)
    const outPath = path.join(outDir, svgRecord.svgFilename)
    await fs.writeFile(outPath, svg)
    return Promise.resolve(svgRecord)
}

export async function readGzippedJsonFile(filename: string): Promise<unknown> {
    const readStream = fs.createReadStream(filename)

    const gzipStream = createGunzip()
    readStream.pipe(gzipStream)
    const content = await getStream(gzipStream)

    return JSON.parse(content)
}

export async function loadReferenceSvg(
    referenceDir: string,
    referenceSvgRecord: SvgRecord
): Promise<string> {
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
): Promise<[GrapherInterface, unknown]> {
    if (!fs.existsSync(inputDir))
        throw `Input directory does not exist ${inputDir}`

    const configPath = path.join(inputDir, configFilename)
    const config = (await readGzippedJsonFile(configPath)) as GrapherInterface

    const dataPath = path.join(inputDir, dataFilename)
    const data = await readGzippedJsonFile(dataPath)

    return Promise.resolve([config, data])
}

export function logDifferencesToConsole(
    svgRecord: SvgRecord,
    validationResult: ResultError<SvgDifference>
): void {
    console.warn(
        `Svg was different for ${svgRecord.chartId}. The difference starts at character ${validationResult.error.startIndex}.
Reference: ${validationResult.error.referenceSvgFragment}
Current  : ${validationResult.error.newSvgFragment}`
    )
}

const resultsFilename = "results.csv"
export async function getReferenceCsvContentMap(
    referenceDir: string
): Promise<Map<number, SvgRecord>> {
    const results = await fs.readFile(
        path.join(referenceDir, resultsFilename),
        "utf-8"
    )
    const csvContentArray = results
        .split("\n")
        .splice(1)
        .map((line): [number, SvgRecord] => {
            const items = line.split(",")
            const chartId = parseInt(items[0])
            return [
                chartId,
                {
                    chartId: chartId,
                    slug: items[1],
                    chartType: items[2] as ChartTypeName,
                    md5: items[3],
                    svgFilename: items[4],
                },
            ]
        })
    const csvContentMap = new Map<number, SvgRecord>(csvContentArray)
    return csvContentMap
}

export async function writeResultsCsvFile(
    outDir: any,
    svgRecords: SvgRecord[]
): Promise<void> {
    const resultsPath = path.join(outDir, resultsFilename)
    const csvFileStream = fs.createWriteStream(resultsPath)
    csvFileStream.write(svgCsvHeader + "\n")
    for (const row of svgRecords) {
        const line = `${row.chartId},${row.slug},${row.chartType},${row.md5},${row.svgFilename}`
        csvFileStream.write(line + "\n")
    }
    csvFileStream.end()
    await finished(csvFileStream)
    csvFileStream.close()
}
