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

export const svgCsvHeader = `grapherId,slug,chartType,md5,svgFilename`

function findFirstDiffIndex(a: string, b: string): number {
    var i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    if (a.length === b.length && a.length === i) {
        console.log("Weird - everything was the same")
    }
    return i
}

export async function verifySvg(
    newSvg: string,
    newSvgRecord: SvgRecord,
    referenceSvgRecord: SvgRecord,
    referenceSvgsPath: string
): Promise<Result<null, SvgDifference>> {
    console.log(`verifying ${newSvgRecord.chartId}`)

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
    console.log(`${newSvgRecord.chartId} had differences`)
    return resultError({
        startIndex: firstDiffIndex,
        referenceSvgFragment: preparedReferenceSvg.substr(
            firstDiffIndex - 20,
            40
        ),
        newSvgFragment: preparedNewSvg.substr(firstDiffIndex - 20, 40),
    })
}
export async function decideDirectoriesToProcess(
    grapherIds: number[],
    inDir: string,
    reverseDirectories: boolean,
    numPartitions: number,
    partition: number
) {
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
            console.log(
                `${allDirsCount} grapher ids were given but only ${directories.length} existed as directories`
            )
        }
    }

    // Sort directories numerically (this assumes every dir == a grapher id and those are numeric)
    directories.sort((a, b) => parseInt(a) - parseInt(b))
    if (reverseDirectories) {
        directories.reverse()
    }
    directories = directories.map((name) => path.join(inDir, name))
    const directoriesToProcess = []
    // Pick ever numPartition-tht element, using partition as the offset
    for (let i = 0; i < directories.length; i++) {
        if (i % numPartitions === partition - 1) {
            directoriesToProcess.push(directories[i])
        }
    }
    return directoriesToProcess
}

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

export async function writeToFile(
    data: unknown,
    filename: string
): Promise<void> {
    const json = JSON.stringify(data)
    const writeStream = fs.createWriteStream(filename)

    // writeStream.write(json)
    // writeStream.end()

    const gzipStream = createGzip()
    gzipStream.pipe(writeStream)
    gzipStream.write(json)
    gzipStream.end()

    return finished(writeStream)
}
export async function saveGrapherSchemaAndData(
    config: GrapherInterface,
    outDir: string
) {
    const dataDir = path.join(outDir, config.id?.toString() ?? "")
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    const configFilename = path.join(dataDir, "config.json.gz")
    const promise1 = writeToFile(config, configFilename)

    const dataFilename = path.join(dataDir, "data.json.gz")
    const grapher = initGrapherForSvgExport(config, "")
    const variableIds = grapher.dimensions.map((d) => d.variableId)

    const promise2 = getVariableData(variableIds).then((vardata) =>
        writeToFile(vardata, dataFilename)
    )

    const settled = await Promise.allSettled([promise1, promise2])
}

export async function renderSvg(dir: string): Promise<[string, SvgRecord]> {
    const [config, data] = await loadGrapherConfigAndData(dir)

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

const replaceRegexes = [
    // /id="[-\w\d]{1,100}"/g.compile(),
    /-select-[0-9]+-input/g,
]
function prepareSvgForComparision(svg: string) {
    let current = svg
    for (const replaceRegex of replaceRegexes) {
        current = svg.replace(replaceRegex, "")
    }
    return current
}
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

    // const content = await getStream(readStream)

    const gzipStream = createGunzip()
    readStream.pipe(gzipStream)
    const content = await getStream(gzipStream)

    return JSON.parse(content)
}

export async function loadReferenceSvg(
    referenceDir: string,
    referenceSvgRecord: SvgRecord
) {
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

    const configFilename = path.join(inputDir, "config.json.gz")
    const config = (await readGzippedJsonFile(
        configFilename
    )) as GrapherInterface

    const dataFilename = path.join(inputDir, "data.json.gz")
    const data = await readGzippedJsonFile(dataFilename)

    return Promise.resolve([config, data])
}

export function logDifferencesToConsole(
    svgRecord: SvgRecord,
    validationResult: ResultError<SvgDifference>
) {
    console.warn(
        `Svg was different for ${svgRecord.chartId}. The difference starts at character ${validationResult.error.startIndex}.
Reference: ${validationResult.error.referenceSvgFragment}
Current  : ${validationResult.error.newSvgFragment}`
    )
}

export async function getReferenceCsvContentMap(referenceDir: string) {
    const results = await fs.readFile(
        path.join(referenceDir, "results.csv"),
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
